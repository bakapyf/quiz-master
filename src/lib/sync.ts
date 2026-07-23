import { db, notifyDataChanged } from "./db";

const SYNC_FILE = "quiz-master-data.json";

export interface SyncStatus {
  enabled: boolean;
  serverName: string;
  url: string;
  lastSync: number;
  lastExport: number;
  error: string;
}

interface SyncConfig {
  url: string;
  username: string;
  password: string;
}

let status: SyncStatus = {
  enabled: false,
  serverName: "",
  url: "",
  lastSync: 0,
  lastExport: 0,
  error: "",
};
let listeners: Array<(s: SyncStatus) => void> = [];
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function updateStatus(partial: Partial<SyncStatus>) {
  status = { ...status, ...partial };
  listeners.forEach((fn) => fn(status));
}

export function getSyncStatus(): SyncStatus {
  return { ...status };
}

export function onSyncStatusChange(fn: (s: SyncStatus) => void) {
  listeners.push(fn);
  (async () => {
    const saved = localStorage.getItem("quiz-webdav-config");
    if (saved) {
      try {
        const cfg = JSON.parse(saved);
        updateStatus({
          enabled: true,
          serverName: cfg.serverName || new URL(cfg.url).hostname,
          url: cfg.url,
        });
      } catch {}
    }
    fn(status);
  })();
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

function getConfig(): SyncConfig | null {
  const saved = localStorage.getItem("quiz-webdav-config");
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

function authHeaders(cfg: SyncConfig): Record<string, string> {
  const token = btoa(`${cfg.username}:${cfg.password}`);
  return {
    Authorization: `Basic ${token}`,
  };
}

function buildUrl(cfg: SyncConfig): string {
  const base = cfg.url.replace(/\/+$/, "");
  return `${base}/${SYNC_FILE}`;
}

export async function importFromWebDAV(): Promise<{
  ok: boolean;
  message: string;
}> {
  const cfg = getConfig();
  if (!cfg) return { ok: false, message: "未配置同步" };

  const url = buildUrl(cfg);

  try {
    const res = await fetch(url, {
      headers: authHeaders(cfg),
    });

    if (res.status === 404) {
      return { ok: true, message: "云端暂无数据" };
    }

    if (!res.ok) {
      return {
        ok: false,
        message: `下载失败: HTTP ${res.status}`,
      };
    }

    const text = await res.text();
    const remote = JSON.parse(text);

    // Merge remote data into local DB
    if (remote.questionBanks) {
      for (const bank of remote.questionBanks) {
        const existing = await db.questionBanks.get(bank.id!);
        if (!existing) await db.questionBanks.put(bank);
      }
    }
    if (remote.questions) {
      for (const q of remote.questions) {
        const existing = await db.questions.get(q.id!);
        if (!existing) await db.questions.put(q);
      }
    }
    if (remote.quizRecords) {
      for (const r of remote.quizRecords) {
        const existing = await db.quizRecords.get(r.id!);
        if (!existing) await db.quizRecords.put(r);
      }
    }
    if (remote.examSessions) {
      for (const es of remote.examSessions) {
        const existing = await db.examSessions.get(es.id!);
        if (!existing) await db.examSessions.put(es);
      }
    }
    if (remote.favorites) {
      for (const f of remote.favorites) {
        const existing = await db.favorites.get(f.id!);
        if (!existing) await db.favorites.put(f);
      }
    }

    updateStatus({ lastSync: Date.now(), error: "" });
    notifyDataChanged();
    return {
      ok: true,
      message: `同步完成，拉取了 ${remote.questions?.length || 0} 道题目`,
    };
  } catch (e: any) {
    updateStatus({ error: e.message });
    return { ok: false, message: e.message };
  }
}

export async function exportToWebDAV(): Promise<{
  ok: boolean;
  message: string;
}> {
  const cfg = getConfig();
  if (!cfg) return { ok: false, message: "未配置同步" };

  const url = buildUrl(cfg);

  try {
    const data = {
      questionBanks: await db.questionBanks.toArray(),
      questions: await db.questions.toArray(),
      quizRecords: await db.quizRecords.toArray(),
      examSessions: await db.examSessions.toArray(),
      favorites: await db.favorites.toArray(),
      version: 2,
      exportedAt: Date.now(),
    };

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        ...authHeaders(cfg),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data, null, 2),
    });

    if (!res.ok) {
      return {
        ok: false,
        message: `上传失败: HTTP ${res.status}`,
      };
    }

    updateStatus({ lastExport: Date.now(), error: "" });
    return { ok: true, message: "上传成功" };
  } catch (e: any) {
    updateStatus({ error: e.message });
    return { ok: false, message: e.message };
  }
}

export async function saveConfig(
  url: string,
  username: string,
  password: string,
  serverName: string
): Promise<boolean> {
  const cleanUrl = url.replace(/\/+$/, "");
  const cfg: SyncConfig = { url: cleanUrl, username, password };

  // Test connection
  try {
    const testRes = await fetch(cleanUrl + "/", {
      method: "PROPFIND",
      headers: {
        ...authHeaders(cfg),
        Depth: "0",
      },
    });

    if (!testRes.ok && testRes.status !== 207) {
      updateStatus({ error: `连接失败: HTTP ${testRes.status}` });
      return false;
    }
  } catch (e: any) {
    updateStatus({ error: "连接失败: " + e.message });
    return false;
  }

  localStorage.setItem(
    "quiz-webdav-config",
    JSON.stringify({ url: cleanUrl, username, password, serverName })
  );

  updateStatus({
    enabled: true,
    serverName,
    url: cleanUrl,
    error: "",
  });

  // Set up auto-save
  window.addEventListener("quiz-data-changed", scheduleAutoSave);

  // Import existing data from cloud
  await importFromWebDAV();

  return true;
}

export async function disableSync() {
  localStorage.removeItem("quiz-webdav-config");
  window.removeEventListener("quiz-data-changed", scheduleAutoSave);
  updateStatus({
    enabled: false,
    serverName: "",
    url: "",
    lastSync: 0,
    lastExport: 0,
    error: "",
  });
}

function scheduleAutoSave() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    exportToWebDAV();
  }, 5000);
}
