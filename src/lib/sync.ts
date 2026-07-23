import { db, notifyDataChanged } from "./db";
import type { Question, QuestionBank, QuizRecord, ExamSession, Favorite } from "../types";

const SYNC_FILE = "quiz-master-data.json";

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
  }
}

// ── GitHub Gist Sync ─────────────────────────────────

const GIST_API = "https://api.github.com";

interface GistConfig {
  token: string;
  gistId: string;
}

function getGistConfig(): GistConfig | null {
  try {
    return JSON.parse(localStorage.getItem("quiz-gist-config") || "null");
  } catch { return null; }
}

async function gistFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const cfg = getGistConfig();
  if (!cfg) throw new Error("未配置 GitHub");
  return fetch(`${GIST_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github.v3+json",
      ...(options.headers || {}),
    },
  });
}

export async function saveGitHubConfig(token: string): Promise<{ ok: boolean; message: string }> {
  // Verify token by trying to get the authenticated user
  try {
    const userRes = await fetch(`${GIST_API}/user`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
    });
    if (!userRes.ok) return { ok: false, message: "Token 无效，请检查" };
    const user = await userRes.json();
    const userName = user.login;

    // Create a gist
    const createRes = await fetch(`${GIST_API}/gists`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/vnd.github.v3+json" },
      body: JSON.stringify({
        description: "Quiz Master 同步数据",
        public: false,
        files: { [SYNC_FILE]: { content: JSON.stringify({ version: 2, exportedAt: Date.now() }) } },
      }),
    });
    if (!createRes.ok) return { ok: false, message: "Gist 创建失败" };
    const gist = await createRes.json();
    const gistId = gist.id;

    localStorage.setItem("quiz-gist-config", JSON.stringify({ token, gistId }));
    updateStatus({ enabled: true, mode: "gist", serverName: `GitHub (${userName})`, url: gist.html_url, error: "" });
    window.addEventListener("quiz-data-changed", scheduleGistExport);

    const r = await importFromGist();
    return r;
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
}

export async function disconnectGitHub() {
  localStorage.removeItem("quiz-gist-config");
  window.removeEventListener("quiz-data-changed", scheduleGistExport);
  updateStatus({ enabled: false, mode: "", serverName: "", url: "", lastSync: 0, lastExport: 0, error: "" });
}

async function importFromGist(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await gistFetch(`/gists/${getGistConfig()?.gistId}`);
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
    const gist = await res.json();
    const content = gist.files?.[SYNC_FILE]?.content;
    if (!content) return { ok: true, message: "云端暂无数据" };
    await mergeData(content);
    updateStatus({ lastSync: Date.now(), error: "" });
    notifyDataChanged();
    return { ok: true, message: "从 GitHub 拉取成功" };
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
}

async function exportToGist(): Promise<{ ok: boolean; message: string }> {
  try {
    const data = await dumpData();
    const res = await gistFetch(`/gists/${getGistConfig()?.gistId}`, {
      method: "PATCH",
      body: JSON.stringify({ files: { [SYNC_FILE]: { content: JSON.stringify(data, null, 2) } } }),
    });
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
    updateStatus({ lastExport: Date.now(), error: "" });
    return { ok: true, message: "推送到 GitHub 成功" };
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
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

function scheduleFolderExport() {
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = setTimeout(() => exportToFolder(), 3000);
}

export { importFromGist, exportToGist };

// ── Shared ──────────────────────────────────────────

export interface SyncStatus {
  enabled: boolean;
  mode: "webdav" | "folder" | "gist" | "";
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
    // Check GitHub config
    const gistCfg = getGistConfig();
    if (gistCfg) {
      try {
        const userRes = await fetch(`${GIST_API}/user`, {
          headers: { Authorization: `Bearer ${gistCfg.token}`, Accept: "application/vnd.github.v3+json" },
        });
        if (userRes.ok) {
          const user = await userRes.json();
          updateStatus({ enabled: true, mode: "gist", serverName: `GitHub (${user.login})` });
        }
      } catch {}
    }
    // Check folder config
    const folder = localStorage.getItem("quiz-folder-sync");
    if (folder) {
      try {
        const info = JSON.parse(folder);
        updateStatus({ enabled: false, mode: "folder", serverName: `📁 ${info.folderName}` });
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

function scheduleGistExport() {
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = setTimeout(() => exportToGist(), 5000);
}
