import { useState, useEffect } from "react";
import {
  Moon, Sun, Trash2, Download, Upload, Cloud, CheckCircle, CloudOff, FolderOpen, Github,
} from "lucide-react";
import { db } from "../lib/db";
import {
  getSyncStatus, onSyncStatusChange, saveGitHubConfig, disconnectGitHub,
  importFromGist, exportToGist, selectSyncFolder, disconnectFolder, supportsFolderSync,
  type SyncStatus,
} from "../lib/sync";

export default function Settings() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const [gitToken, setGitToken] = useState("");

  useEffect(() => { return onSyncStatusChange(setSyncStatus); }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  };

  const handleGitHubConnect = async () => {
    if (!gitToken.trim()) { setMsg("请输入 GitHub Token"); return; }
    const r = await saveGitHubConfig(gitToken.trim());
    setMsg(r.message);
    if (r.ok) setGitToken("");
  };

  const handleGistPull = async () => { const r = await importFromGist(); setMsg(r.message); if (r.ok) window.location.reload(); };
  const handleGistPush = async () => { const r = await exportToGist(); setMsg(r.message); };
  const handleSelectFolder = async () => { const ok = await selectSyncFolder(); if (ok) setMsg("同步文件夹已设置"); };

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = {
        questionBanks: await db.questionBanks.toArray(),
        questions: await db.questions.toArray(),
        quizRecords: await db.quizRecords.toArray(),
        examSessions: await db.examSessions.toArray(),
        favorites: await db.favorites.toArray(),
        version: 2, exportedAt: Date.now(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `quiz-master-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      setMsg("导出成功");
    } catch (e) { setMsg("导出失败: " + e); }
    setExporting(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      for (const t of ["questionBanks", "questions", "quizRecords", "examSessions", "favorites"]) {
        if (data[t]) await (db as any)[t].bulkAdd(data[t]);
      }
      setMsg("恢复成功");
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) { setMsg("恢复失败: " + e); }
  };

  const formatTime = (ts: number) => ts ? new Date(ts).toLocaleString("zh-CN") : "---";

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold">设置</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">管理应用偏好和云同步</p>
      </div>

      {msg && <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm">{msg}</div>}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">

        {/* GitHub 同步 */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">GitHub 同步（推荐）</h3>
          <p className="text-xs text-slate-400 mb-3">任何浏览器可用，数据自动存到私人 GitHub Gist，免费不限设备</p>

          {syncStatus.mode === "gist" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <CheckCircle size={18} className="text-emerald-500" />
                <div className="text-sm flex-1">
                  <p className="font-medium">{syncStatus.serverName}</p>
                  <p className="text-xs text-slate-500">
                    {syncStatus.url && <a href={syncStatus.url} target="_blank" rel="noreferrer" className="underline mr-2">查看 Gist</a>}
                    拉取: {formatTime(syncStatus.lastSync)} · 推送: {formatTime(syncStatus.lastExport)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleGistPull} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"><Cloud size={14} /> 拉取</button>
                <button onClick={handleGistPush} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"><Cloud size={14} /> 推送</button>
                <button onClick={disconnectGitHub} className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><CloudOff size={14} /> 断开</button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <input type="password" value={gitToken} onChange={e => setGitToken(e.target.value)}
                placeholder="GitHub Personal Access Token"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:outline-none focus:border-indigo-300" />
              <button onClick={handleGitHubConnect}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                <Github size={16} /> 连接 GitHub
              </button>
              <p className="text-[11px] text-slate-400">
                在 <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="underline">github.com/settings/tokens</a> 生成 Token，勾选 <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">gist</code> 权限
              </p>
            </div>
          )}
        </div>

        {/* 文件夹同步 */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">文件夹同步</h3>
          <p className="text-xs text-slate-400 mb-3">适用 Chrome/Edge，选坚果云/iCloud 本地目录自动读写</p>
          {syncStatus.mode === "folder" ? (
            <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <CheckCircle size={18} className="text-emerald-500" />
              <span className="text-sm flex-1 font-medium">{syncStatus.serverName}</span>
              <button onClick={disconnectFolder} className="text-xs text-slate-500 hover:text-red-500">断开</button>
            </div>
          ) : supportsFolderSync() ? (
            <button onClick={handleSelectFolder} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
              <FolderOpen size={16} /> 选择同步文件夹
            </button>
          ) : (
            <p className="text-xs text-slate-400">当前浏览器不支持（请用 Chrome/Edge）</p>
          )}
        </div>

        {/* 外观 */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">外观</h3>
          <button onClick={toggleDark} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <div className="flex items-center gap-3">
              {dark ? <Sun size={20} /> : <Moon size={20} />}
              <div className="text-left"><p className="text-sm font-medium">深色模式</p><p className="text-xs text-slate-500">{dark ? "已开启" : "已关闭"}</p></div>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors relative ${dark ? "bg-indigo-600" : "bg-slate-300"}`}>
              <div className="w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform" style={{ transform: dark ? "translateX(18px)" : "" }} />
            </div>
          </button>
        </div>

        {/* 数据管理 */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">数据管理</h3>
          <div className="space-y-1">
            <button onClick={handleExport} disabled={exporting} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left">
              <Download size={18} className="text-indigo-500" />
              <div><p className="text-sm font-medium">{exporting ? "导出中..." : "导出数据"}</p><p className="text-xs text-slate-500">备份到 JSON 文件</p></div>
            </button>
            <label className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
              <Upload size={18} className="text-indigo-500" />
              <div><p className="text-sm font-medium">恢复数据</p><p className="text-xs text-slate-500">从 JSON 文件恢复</p></div>
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </div>

        {/* 危险操作 */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">危险操作</h3>
          <button onClick={async () => {
            if (!confirm("确定清除所有数据？")) return;
            await db.questionBanks.clear(); await db.questions.clear(); await db.quizRecords.clear();
            await db.favorites.clear(); await db.examSessions.clear();
            setMsg("已清除"); setTimeout(() => window.location.reload(), 1000);
          }} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left">
            <Trash2 size={18} className="text-red-500" />
            <div><p className="text-sm font-medium text-red-600">清除所有数据</p><p className="text-xs text-slate-500">不可撤销</p></div>
          </button>
        </div>
      </div>

      <div className="text-center text-xs text-slate-400">
        <p>Quiz Master v1.0.0</p>
      </div>
    </div>
  );
}
