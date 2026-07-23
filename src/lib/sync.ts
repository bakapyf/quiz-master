import { db, notifyDataChanged } from "./db";

const SYNC_FILE = "quiz-master-data.json";

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: "read" | "readwrite";
    }) => Promise<FileSystemDirectoryHandle>;
  }
}

export interface SyncStatus {
  enabled: boolean;
  folderName: string;
  lastSync: number;
  lastExport: number;
  error: string;
}

let dirHandle: FileSystemDirectoryHandle | null = null;
let status: SyncStatus = {
  enabled: false,
  folderName: "",
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
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function supportsFileSystemAccess(): boolean {
  return typeof window !== "undefined" && !!window.showDirectoryPicker;
}

export async function selectSyncFolder(): Promise<boolean> {
  if (!supportsFileSystemAccess()) return false;

  try {
    const handle = await window.showDirectoryPicker!({
      mode: "readwrite",
    });
    dirHandle = handle;

    const info = {
      folderName: handle.name,
      enabled: true,
      lastSync: Date.now(),
    };
    localStorage.setItem("quiz-sync-folder", JSON.stringify(info));
    updateStatus({ ...info, error: "" });

    // Load existing data from the folder
    await importFromFolder();

    // Set up auto-save listener
    window.addEventListener("quiz-data-changed", scheduleAutoSave);

    return true;
  } catch (e: any) {
    if (e.name === "AbortError") return false;
    updateStatus({ error: e.message || String(e) });
    return false;
  }
}

export async function disableSync() {
  dirHandle = null;
  localStorage.removeItem("quiz-sync-folder");
  window.removeEventListener("quiz-data-changed", scheduleAutoSave);
  updateStatus({
    enabled: false,
    folderName: "",
    lastSync: 0,
    lastExport: 0,
    error: "",
  });
}

export async function initSyncFromStorage() {
  const saved = localStorage.getItem("quiz-sync-folder");
  if (!saved) return;

  try {
    const info = JSON.parse(saved);
    if (info.enabled && supportsFileSystemAccess()) {
      // Folder handle can't be stored - need to re-prompt
      // Show a prompt or just disable
      updateStatus({
        enabled: false,
        folderName: info.folderName,
        error: "需要重新选择同步文件夹",
      });
    }
  } catch {}
}

async function importFromFolder() {
  if (!dirHandle) return;

  try {
    const fileHandle = await dirHandle.getFileHandle(SYNC_FILE, {
      create: false,
    });
    const file = await fileHandle.getFile();
    const text = await file.text();
    const remote = JSON.parse(text);

    // Merge: import remote data into local DB
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

    updateStatus({ lastSync: Date.now() });
    notifyDataChanged();
  } catch (e: any) {
    // File doesn't exist yet - that's OK for first sync
    if (e.name !== "NotFoundError") {
      updateStatus({ error: "读取失败: " + e.message });
    }
  }
}

export async function exportToFolder(): Promise<boolean> {
  if (!dirHandle) {
    updateStatus({ error: "未选择同步文件夹" });
    return false;
  }

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

    const fileHandle = await dirHandle.getFileHandle(SYNC_FILE, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();

    updateStatus({ lastExport: Date.now(), error: "" });
    return true;
  } catch (e: any) {
    updateStatus({ error: "保存失败: " + e.message });
    return false;
  }
}

function scheduleAutoSave() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    exportToFolder();
  }, 3000);
}

export function getSyncReport(): SyncStatus {
  return { ...status };
}
