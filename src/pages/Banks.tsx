import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Library,
  Upload,
  Trash2,
  FileText,
  Clock,
  ChevronRight,
  Merge,
  CheckSquare,
  X,
  Pencil,
  Check,
} from "lucide-react";
import { db, notifyDataChanged } from "../lib/db";
import { parseFile, parsedToQuestions } from "../lib/parsers";
import type { QuestionBank } from "../types";

export default function Banks() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [merging, setMerging] = useState(false);
  const [mergeName, setMergeName] = useState("");

  const loadBanks = async () => {
    const allBanks = await db.questionBanks
      .orderBy("createdAt")
      .reverse()
      .toArray();
    setBanks(allBanks);
  };

  useEffect(() => {
    loadBanks();
  }, []);

  const handleFileImport = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setImporting(true);
    setImportMsg("");

    for (const file of Array.from(files)) {
      try {
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        let content: string | ArrayBuffer;
        if (ext === "xlsx" || ext === "xls") {
          content = await file.arrayBuffer();
        } else {
          content = await file.text();
        }

        const parsed = parseFile(content, file.name);

        if (parsed.length === 0) {
          setImportMsg(`文件 ${file.name} 未识别到题目`);
          continue;
        }

        const bankId = await db.questionBanks.add({
          name: file.name.replace(/\.[^.]+$/, ""),
          source: ext.toUpperCase(),
          questionCount: parsed.length,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        const questions = parsedToQuestions(parsed, bankId as number);
        await db.questions.bulkAdd(questions);

        notifyDataChanged();

        setImportMsg(
          `成功导入: ${file.name} (${parsed.length} 题)`
        );
      } catch (err) {
        setImportMsg(`导入失败: ${file.name} - ${err}`);
      }
    }

    await loadBanks();
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const deleteBank = async (bank: QuestionBank) => {
    if (
      !confirm(`确定删除题库 "${bank.name}" 及其所有题目？`)
    )
      return;
    await db.questions.where({ bankId: bank.id }).delete();
    await db.quizRecords.where({ bankId: bank.id }).delete();
    await db.favorites.where({ bankId: bank.id }).delete();
    await db.questionBanks.delete(bank.id!);
    notifyDataChanged();
    await loadBanks();
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const startRename = (bank: QuestionBank) => {
    setEditingId(bank.id!);
    setEditName(bank.name);
  };

  const confirmRename = async () => {
    if (!editingId || !editName.trim()) return;
    await db.questionBanks.update(editingId, { name: editName.trim() });
    setEditingId(null);
    await loadBanks();
  };

  const startMerge = () => {
    if (selected.size < 2) return;
    setMergeName("合并题库");
    setMerging(true);
  };

  const confirmMerge = async () => {
    if (selected.size < 2) return;

    const selectedBanks = banks.filter((b) => selected.has(b.id!));
    const name = mergeName.trim() || "合并题库";

    const bankId = await db.questionBanks.add({
      name,
      source: "MERGE",
      questionCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    let totalQuestions = 0;
    for (const bank of selectedBanks) {
      const questions = await db.questions
        .where({ bankId: bank.id })
        .toArray();
      const reorderedQuestions = questions.map((q, i) => ({
        ...q,
        id: undefined as any,
        bankId: bankId as number,
        order: totalQuestions + i,
      }));
      await db.questions.bulkAdd(reorderedQuestions);
      totalQuestions += questions.length;
    }

    await db.questionBanks.update(bankId as number, {
      questionCount: totalQuestions,
    });

    setMerging(false);
    setSelectMode(false);
    setSelected(new Set());
    notifyDataChanged();
    await loadBanks();
  };

  const selectedCount = selected.size;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">题库管理</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            支持 MD · JSON · CSV · Excel 格式导入
          </p>
        </div>
        <div className="flex items-center gap-2">
          {banks.length > 0 && (
            <button
              onClick={() => {
                setSelectMode(!selectMode);
                setSelected(new Set());
              }}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                selectMode
                  ? "bg-indigo-600 text-white"
                  : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <CheckSquare size={16} />
              {selectMode ? "取消" : "选择"}
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Upload size={16} />
            {importing ? "导入中..." : "导入题库"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.json,.csv,.xlsx,.xls"
            multiple
            onChange={handleFileImport}
            className="hidden"
          />
        </div>
      </div>

      {selectMode && selectedCount > 0 && (
        <div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
            已选 {selectedCount} 个题库
          </span>
          {selectedCount >= 2 && (
            <button
              onClick={startMerge}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
            >
              <Merge size={14} />
              合并选中题库
            </button>
          )}
        </div>
      )}

      {importMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-lg text-sm">
          {importMsg}
        </div>
      )}

      {/* Merge name dialog */}
      {merging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-96 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">合并题库</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              将 {selectedCount} 个题库合并为一个新题库
            </p>
            <input
              value={mergeName}
              onChange={(e) => setMergeName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-indigo-300"
              placeholder="新题库名称"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmMerge();
              }}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setMerging(false)}
                className="flex-1 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmMerge}
                disabled={!mergeName.trim()}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                确认合并
              </button>
            </div>
          </div>
        </div>
      )}

      {banks.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
          <Library
            size={48}
            className="mx-auto text-slate-300 dark:text-slate-600 mb-4"
          />
          <h3 className="text-lg font-semibold mb-2">还没有题库</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4 text-sm">
            点击上方按钮导入你的题目文件
          </p>
          <div className="flex justify-center gap-2 text-xs text-slate-400">
            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">
              .md
            </span>
            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">
              .json
            </span>
            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">
              .csv
            </span>
            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">
              .xlsx
            </span>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {banks.map((bank) => (
            <div
              key={bank.id}
              className={`bg-white dark:bg-slate-900 rounded-xl border transition-colors overflow-hidden ${
                selected.has(bank.id!)
                  ? "border-indigo-400 dark:border-indigo-600 ring-1 ring-indigo-200 dark:ring-indigo-800"
                  : "border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700"
              }`}
            >
              <div className="p-4 flex items-center">
                {selectMode && (
                  <button
                    onClick={() => toggleSelect(bank.id!)}
                    className={`mr-3 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      selected.has(bank.id!)
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    {selected.has(bank.id!) && <Check size={12} />}
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  {editingId === bank.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-indigo-300 rounded bg-white dark:bg-slate-800 focus:outline-none focus:border-indigo-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmRename();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <button
                        onClick={confirmRename}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <Link
                      to={
                        selectMode ? "#" : `/banks/${bank.id}`
                      }
                      onClick={(e) => {
                        if (selectMode) {
                          e.preventDefault();
                          toggleSelect(bank.id!);
                        }
                      }}
                      className="font-medium hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors block truncate"
                    >
                      {bank.name}
                    </Link>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <FileText size={12} /> {bank.questionCount} 题
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] uppercase">
                        {bank.source}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(bank.createdAt).toLocaleDateString(
                        "zh-CN"
                      )}
                    </span>
                  </div>
                </div>
                {!selectMode && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startRename(bank)}
                      className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                      title="重命名"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => navigate(`/banks/${bank.id}`)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                      title="开始学习"
                    >
                      <ChevronRight size={18} />
                    </button>
                    <button
                      onClick={() => deleteBank(bank)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="删除题库"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
