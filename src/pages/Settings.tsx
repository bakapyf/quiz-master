import { useState, useEffect } from "react";
import {
  Moon,
  Sun,
  Trash2,
  Download,
  Upload,
  FolderSync,
  CheckCircle,
  XCircle,
  FolderOpen,
  CloudOff,
} from "lucide-react";
import { db } from "../lib/db";
import {
  supportsFileSystemAccess,
  selectSyncFolder,
  disableSync,
  exportToFolder,
  initSyncFromStorage,
  onSyncStatusChange,
  getSyncStatus,
  type SyncStatus,
} from "../lib/sync";

export default function Settings() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());

  useEffect(() => {
    initSyncFromStorage();
    return onSyncStatusChange(setSyncStatus);
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  };

  const handleExport = async () => {
    setExporting(true);
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
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quiz-master-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("导出成功");
    } catch (e) {
      setMsg("导出失败: " + e);
    }
    setExporting(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.questionBanks)
        await db.questionBanks.bulkAdd(data.questionBanks);
      if (data.questions) await db.questions.bulkAdd(data.questions);
      if (data.quizRecords)
        await db.quizRecords.bulkAdd(data.quizRecords);
      if (data.examSessions)
        await db.examSessions.bulkAdd(data.examSessions);
      if (data.favorites) await db.favorites.bulkAdd(data.favorites);

      setMsg("恢复成功，请刷新页面");
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setMsg("恢复失败: " + e);
    }
    setImporting(false);
  };

  const handleSelectFolder = async () => {
    const ok = await selectSyncFolder();
    if (ok) setMsg("同步文件夹已设置");
  };

  const formatTime = (ts: number) => {
    if (!ts) return "---";
    return new Date(ts).toLocaleString("zh-CN");
  };

  const hasFileAPI = supportsFileSystemAccess();

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold">设置</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          管理应用偏好和云同步
        </p>
      </div>

      {msg && (
        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm">
          {msg}
        </div>
      )}

      {/* Cloud Sync */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
        <div className="p-4">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            云同步
          </h3>

          {!hasFileAPI && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg mb-3 text-sm text-amber-700 dark:text-amber-300">
              Safari 不支持自动同步。请用下面的手动导出/导入方式，配合云端文件夹使用。
            </div>
          )}

          {syncStatus.enabled ? (
            /* Synced state */
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <CheckCircle size={18} className="text-emerald-500" />
                <div>
                  <p className="text-sm font-medium">
                    已同步到 {syncStatus.folderName}
                  </p>
                  <p className="text-xs text-slate-500">
                    上次同步: {formatTime(syncStatus.lastSync)}
                    {" · "}
                    上次保存: {formatTime(syncStatus.lastExport)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={exportToFolder}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <FolderSync size={14} />
                  立即同步
                </button>
                <button
                  onClick={() => {
                    disableSync();
                    setMsg("云同步已关闭");
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <CloudOff size={14} />
                  断开
                </button>
              </div>
            </div>
          ) : (
            /* Not synced */
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                选择一个云端文件夹（坚果云/Infini Cloud/iCloud/Dropbox），
                数据会自动同步到多台设备。
              </p>
              {hasFileAPI ? (
                <button
                  onClick={handleSelectFolder}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  <FolderOpen size={16} />
                  选择同步文件夹
                </button>
              ) : (
                <div className="text-xs text-slate-400">
                  推荐使用 Chrome/Edge 浏览器以启用自动同步
                </div>
              )}
            </div>
          )}

          {syncStatus.error && (
            <p className="mt-2 text-xs text-red-500">{syncStatus.error}</p>
          )}
        </div>

        {/* Appearance */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            外观
          </h3>
          <button
            onClick={toggleDark}
            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              {dark ? <Sun size={20} /> : <Moon size={20} />}
              <div className="text-left">
                <p className="text-sm font-medium">深色模式</p>
                <p className="text-xs text-slate-500">
                  {dark ? "已开启" : "已关闭"}
                </p>
              </div>
            </div>
            <div
              className={`w-10 h-6 rounded-full transition-colors relative ${
                dark ? "bg-indigo-600" : "bg-slate-300"
              }`}
            >
              <div
                className="w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform"
                style={{
                  transform: dark ? "translateX(18px)" : "",
                }}
              />
            </div>
          </button>
        </div>

        {/* Data */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            数据管理
          </h3>
          <div className="space-y-1">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <Download size={18} className="text-indigo-500" />
              <div>
                <p className="text-sm font-medium">
                  {exporting ? "导出中..." : "导出数据"}
                </p>
                <p className="text-xs text-slate-500">
                  备份所有题库、进度、收藏到JSON文件
                </p>
              </div>
            </button>

            <label className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
              <Upload size={18} className="text-indigo-500" />
              <div>
                <p className="text-sm font-medium">
                  {importing ? "恢复中..." : "恢复数据"}
                </p>
                <p className="text-xs text-slate-500">
                  从备份JSON文件恢复数据
                </p>
              </div>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Danger */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            危险操作
          </h3>
          <button
            onClick={async () => {
              if (!confirm("确定要清除所有数据吗？此操作不可撤销！"))
                return;
              await db.questionBanks.clear();
              await db.questions.clear();
              await db.quizRecords.clear();
              await db.favorites.clear();
              await db.examSessions.clear();
              setMsg("所有数据已清除");
              setTimeout(() => window.location.reload(), 1000);
            }}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
          >
            <Trash2 size={18} className="text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-600">
                清除所有数据
              </p>
              <p className="text-xs text-slate-500">
                删除所有题库、答题记录和收藏
              </p>
            </div>
          </button>
        </div>
      </div>

      <div className="text-center text-xs text-slate-400">
        <p>Quiz Master v1.0.0</p>
        <p className="mt-1">Built with React + TypeScript + IndexedDB</p>
      </div>
    </div>
  );
}
