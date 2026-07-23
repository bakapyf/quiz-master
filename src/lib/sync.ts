import { db, notifyDataChanged } from "./db";

const SYNC_FILE = "quiz-master-data.json";
const CORS_PROXY = "https://corsproxy.io/?url=";
let usePublicProxy = false;

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: "read" | "readwrite";
    }) => Promise<FileSystemDirectoryHandle>;
  }
}

// ── WebDAV via proxy ─────────────────────────────────

async function proxyFetch(targetUrl: string, options: RequestInit = {}): Promise<Response> {
  if (usePublicProxy) {
    return fetch(CORS_PROXY + encodeURIComponent(targetUrl), options);
  }
  try {
    const res = await fetch(`/api/proxy?url=${encodeURIComponent(targetUrl)}`, options);
    if (res.status === 404) throw new Error("proxy not found");
    return res;
  } catch {
    usePublicProxy = true;
    return fetch(CORS_PROXY + encodeURIComponent(targetUrl), options);
  }
}

interface WebDAVConfig {
  url: string;
  username: string;
  password: string;
  serverName: string;
}

function getWebDAVConfig(): WebDAVConfig | null {
  try {
    return JSON.parse(localStorage.getItem("quiz-webdav-config") || "null");
  } catch { return null; }
}

function authHeaders(cfg: WebDAVConfig): Record<string, string> {
  return { Authorization: `Basic ${btoa(`${cfg.username}:${cfg.password}`)}` };
}

function davUrl(cfg: WebDAVConfig): string {
  return `${cfg.url.replace(/\/+$/, "")}/${SYNC_FILE}`;
}

async function importFromWebDAV(): Promise<{ ok: boolean; message: string }> {
  const cfg = getWebDAVConfig();
  if (!cfg) return { ok: false, message: "未配置" };
  try {
    const res = await proxyFetch(davUrl(cfg), { headers: authHeaders(cfg) });
    if (res.status === 404) return { ok: true, message: "云端暂无数据" };
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
    await mergeData(await res.text());
    updateStatus({ lastSync: Date.now(), error: "" });
    notifyDataChanged();
    return { ok: true, message: "拉取成功" };
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
}

async function exportToWebDAV(): Promise<{ ok: boolean; message: string }> {
  const cfg = getWebDAVConfig();
  if (!cfg) return { ok: false, message: "未配置" };
  try {
    const data = await dumpData();
    const res = await proxyFetch(davUrl(cfg), {
      method: "PUT",
      headers: { ...authHeaders(cfg), "Content-Type": "application/json" },
      body: JSON.stringify(data, null, 2),
    });
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
    updateStatus({ lastExport: Date.now(), error: "" });
    return { ok: true, message: "推送成功" };
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
}

export async function saveWebDAVConfig(url: string, username: string, password: string, serverName: string): Promise<boolean> {
  localStorage.setItem("quiz-webdav-config", JSON.stringify({ url, username, password, serverName }));
  updateStatus({ enabled: true, serverName, url, error: "" });
  window.addEventListener("quiz-data-changed", scheduleAutoSave);
  const r = await importFromWebDAV();
  if (!r.ok) updateStatus({ error: r.message });
  return true;
}

export async function disconnectWebDAV() {
  localStorage.removeItem("quiz-webdav-config");
  window.removeEventListener("quiz-data-changed", scheduleAutoSave);
  updateStatus({ enabled: false, serverName: "", url: "", lastSync: 0, lastExport: 0, error: "" });
}

// ── File System Access API (folder sync) ────────────

let dirHandle: FileSystemDirectoryHandle | null = null;

export function supportsFolderSync(): boolean {
  return typeof window !== "undefined" && !!window.showDirectoryPicker;
}

export async function selectSyncFolder(): Promise<boolean> {
  if (!supportsFolderSync()) return false;
  try {
    const handle = await window.showDirectoryPicker!({ mode: "readwrite" });
    dirHandle = handle;
    const info = JSON.stringify({ folderName: handle.name, enabled: true });
    localStorage.setItem("quiz-folder-sync", info);
    updateStatus({ enabled: true, serverName: `📁 ${handle.name}`, url: "", error: "" });
    await importFromFolder();
    window.addEventListener("quiz-data-changed", scheduleFolderExport);
    return true;
  } catch (e: any) {
    if (e.name !== "AbortError") updateStatus({ error: e.message });
    return false;
  }
}

export async function disconnectFolder() {
  dirHandle = null;
  localStorage.removeItem("quiz-folder-sync");
  window.removeEventListener("quiz-data-changed", scheduleFolderExport);
  updateStatus({ enabled: false, serverName: "", url: "", lastSync: 0, lastExport: 0, error: "" });
}

async function importFromFolder() {
  if (!dirHandle) return;
  try {
    const fh = await dirHandle.getFileHandle(SYNC_FILE, { create: false });
    await mergeData(await (await fh.getFile()).text());
    updateStatus({ lastSync: Date.now(), error: "" });
    notifyDataChanged();
  } catch (e: any) {
    if (e.name !== "NotFoundError") updateStatus({ error: e.message });
  }
}

async function exportToFolder() {
  if (!dirHandle) return;
  try {
    const data = await dumpData();
    const fh = await dirHandle.getFileHandle(SYNC_FILE, { create: true });
    const w = await fh.createWritable();
    await w.write(JSON.stringify(data, null, 2));
    await w.close();
    updateStatus({ lastExport: Date.now(), error: "" });
  } catch (e: any) {
    updateStatus({ error: e.message });
  }
}

// ── Shared ──────────────────────────────────────────

export interface SyncStatus {
  enabled: boolean;
  mode: "webdav" | "folder" | "";
  serverName: string;
  url: string;
  lastSync: number;
  lastExport: number;
  error: string;
}

let status: SyncStatus = { enabled: false, mode: "", serverName: "", url: "", lastSync: 0, lastExport: 0, error: "" };
let listeners: Array<(s: SyncStatus) => void> = [];
let autoTimer: ReturnType<typeof setTimeout> | null = null;

function updateStatus(p: Partial<SyncStatus>) {
  status = { ...status, ...p };
  listeners.forEach((fn) => fn(status));
}

export function getSyncStatus(): SyncStatus {
  return { ...status };
}

export function onSyncStatusChange(fn: (s: SyncStatus) => void) {
  listeners.push(fn);
  (async () => {
    const dav = getWebDAVConfig();
    if (dav) {
      updateStatus({ enabled: true, mode: "webdav", serverName: dav.serverName, url: dav.url });
      window.addEventListener("quiz-data-changed", scheduleAutoSave);
    }
    const folder = localStorage.getItem("quiz-folder-sync");
    if (folder) {
      try {
        const info = JSON.parse(folder);
        updateStatus({ enabled: false, mode: "folder", serverName: `📁 ${info.folderName}`, url: "" });
      } catch {}
    }
    fn(status);
  })();
  return () => { listeners = listeners.filter((l) => l !== fn); };
}

async function dumpData() {
  return {
    questionBanks: await db.questionBanks.toArray(),
    questions: await db.questions.toArray(),
    quizRecords: await db.quizRecords.toArray(),
    examSessions: await db.examSessions.toArray(),
    favorites: await db.favorites.toArray(),
    version: 2,
    exportedAt: Date.now(),
  };
}

async function mergeData(text: string) {
  const remote = JSON.parse(text);
  for (const [table, items] of Object.entries(remote)) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const existing = await (db as any)[table]?.get(item.id);
      if (!existing) await (db as any)[table]?.put(item);
    }
  }
}

function scheduleAutoSave() {
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = setTimeout(() => exportToWebDAV(), 5000);
}

function scheduleFolderExport() {
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = setTimeout(() => exportToFolder(), 3000);
}

export { importFromWebDAV, exportToWebDAV, importFromFolder as importFromFolderStatic, exportToFolder as exportToFolderStatic };
