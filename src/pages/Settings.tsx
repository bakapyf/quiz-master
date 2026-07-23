import { useState, useEffect } from "react";
import {
  Moon,
  Sun,
  Trash2,
  Download,
  Upload,
  Cloud,
  CheckCircle,
  CloudOff,
  Link,
  Key,
} from "lucide-react";
import { db } from "../lib/db";
import {
  getSyncStatus,
  onSyncStatusChange,
  saveConfig,
  disableSync,
  importFromWebDAV,
  exportToWebDAV,
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

  const [wurl, setWurl] = useState("");
  const [wuser, setWuser] = useState("");
  const [wpass, setWpass] = useState("");
  const [wName, setWName] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [syncAction, setSyncAction] = useState("");

  useEffect(() => {
    return onSyncStatusChange((s) => {
      setSyncStatus(s);
      if (s.enabled) {
        setWurl(s.url);
        setWName(s.serverName);
      }
    });
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  };

  const handleConnect = async () => {
    if (!wurl || !wuser || !wpass) {
      setMsg("请填写完整信息");
      return;
    }
    setConnecting(true);
    const name = wName || new URL(wurl).hostname;
    const ok = await saveConfig(wurl, wuser, wpass, name);
    if (ok) {
      setMsg("连接成功！已自动从云端拉取数据");
    } else {
      setMsg("连接失败，请检查地址和账号密码");
    }
    setConnecting(false);
  };

  const handleDisconnect = () => {
    disableSync();
    setWurl("");
    setWuser("");
    setWpass("");
    setWName("");
    setMsg("已断开云同步");
  };

  const handlePull = async () => {
    setSyncAction("拉取中...");
    const r = await importFromWebDAV();
    setSyncAction("");
    setMsg(r.message);
    if (r.ok) window.location.reload();
  };

  const handlePush = async () => {
    setSyncAction("推送中...");
    const r = await exportToWebDAV();
    setSyncAction("");
    setMsg(r.message);
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

  const formatTime = (ts: number) => {
    if (!ts) return "---";
    return new Date(ts).toLocaleString("zh-CN");
  };

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

      {/* WebDAV Sync */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
        <div className="p-4">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            云同步 (WebDAV)
          </h3>

          {syncStatus.enabled ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <CheckCircle size={18} className="text-emerald-500" />
                <div className="text-sm">
                  <p className="font-medium">
                    已连接 {syncStatus.serverName}
                  </p>
                  <p className="text-xs text-slate-500">
                    上次拉取: {formatTime(syncStatus.lastSync)}
                    {" · "}
                    上次推送: {formatTime(syncStatus.lastExport)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handlePull}
                  disabled={!!syncAction}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {syncAction === "拉取中..." ? (
                    "拉取中..."
                  ) : (
                    <>
                      <Cloud size={14} />
                      从云端拉取
                    </>
                  )}
                </button>
                <button
                  onClick={handlePush}
                  disabled={!!syncAction}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {syncAction === "推送中..." ? (
                    "推送中..."
                  ) : (
                    <>
                      <Cloud size={14} />
                      推送到云端
                    </>
                  )}
                </button>
                <button
                  onClick={handleDisconnect}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <CloudOff size={14} />
                  断开
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                和 Zotero 一样通过 WebDAV 连接云端服务。支持坚果云、Infini
                Cloud、Nextcloud 等。
              </p>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <Link size={14} className="text-slate-400 flex-shrink-0" />
                  <input
                    value={wurl}
                    onChange={(e) => setWurl(e.target.value)}
                    placeholder="WebDAV 地址，如 https://dav.jianguoyun.com/dav/"
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:outline-none focus:border-indigo-300"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Key size={14} className="text-slate-400 flex-shrink-0" />
                  <input
                    value={wuser}
                    onChange={(e) => setWuser(e.target.value)}
                    placeholder="用户名 / 邮箱"
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:outline-none focus:border-indigo-300"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Key size={14} className="text-slate-400 flex-shrink-0" />
                  <input
                    type="password"
                    value={wpass}
                    onChange={(e) => setWpass(e.target.value)}
                    placeholder="密码（坚果云需用应用密码）"
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:outline-none focus:border-indigo-300"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Cloud size={14} className="text-slate-400 flex-shrink-0" />
                  <input
                    value={wName}
                    onChange={(e) => setWName(e.target.value)}
                    placeholder="服务名称（可选，如：我的坚果云）"
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:outline-none focus:border-indigo-300"
                  />
                </div>
              </div>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <Cloud size={16} />
                {connecting ? "连接中..." : "连接并同步"}
              </button>
              <p className="text-xs text-slate-400">
                坚果云用户请在坚果云网页端→账户信息→安全选项→生成第三方应用密码
              </p>
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
