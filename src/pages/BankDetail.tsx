import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  ListOrdered,
  Shuffle,
  Clock,
  Eye,
  BookOpen,
  FileQuestion,
  Heart,
  Trash2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { db, notifyDataChanged } from "../lib/db";
import type { QuestionBank, QuestionType } from "../types";

export default function BankDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [progress, setProgress] = useState({ answered: 0, correct: 0 });
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!id) return;
    (async () => {
      const b = await db.questionBanks.get(Number(id));
      if (!b) return;
      setBank(b);

      const qs = await db.questions
        .where({ bankId: b.id })
        .sortBy("order");
      setQuestions(qs);

      const counts: Record<string, number> = {};
      for (const q of qs) {
        const label = typeLabel(q.type);
        counts[label] = (counts[label] || 0) + 1;
      }
      setTypeCounts(counts);

      const p = await db.getBankProgress(b.id!);
      setProgress({
        answered: p.totalAnswered,
        correct: p.correctCount,
      });
    })();
  }, [id]);

  const deleteBank = async () => {
    if (!bank) return;
    if (!confirm(`确定删除题库 "${bank.name}" 及其所有题目？`)) return;
    await db.questions.where({ bankId: bank.id }).delete();
    await db.quizRecords.where({ bankId: bank.id }).delete();
    await db.favorites.where({ bankId: bank.id }).delete();
    await db.questionBanks.delete(bank.id!);
    notifyDataChanged();
    navigate("/banks");
  };

  const startRename = () => {
    if (!bank) return;
    setNewName(bank.name);
    setEditingName(true);
  };

  const confirmRename = async () => {
    if (!bank || !newName.trim()) return;
    await db.questionBanks.update(bank.id!, { name: newName.trim() });
    setBank({ ...bank, name: newName.trim() });
    setEditingName(false);
  };

  if (!bank) {
    return (
      <div className="text-center py-16 text-slate-500">加载中...</div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/banks")}
          className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 px-2 py-1 text-lg font-bold border border-indigo-300 rounded bg-white dark:bg-slate-800 focus:outline-none focus:border-indigo-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmRename();
                  if (e.key === "Escape") setEditingName(false);
                }}
              />
              <button
                onClick={confirmRename}
                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
              >
                <Check size={18} />
              </button>
              <button
                onClick={() => setEditingName(false)}
                className="p-1 text-slate-400 hover:bg-slate-100 rounded"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <h2 className="text-2xl font-bold truncate">{bank.name}</h2>
          )}
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {bank.questionCount} 题 · {bank.source}
          </p>
        </div>
        <button
          onClick={startRename}
          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
          title="重命名"
        >
          <Pencil size={18} />
        </button>
        <button
          onClick={deleteBank}
          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          title="删除题库"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-center">
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {progress.answered}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">已答题数</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {progress.answered > 0
              ? Math.round((progress.correct / progress.answered) * 100)
              : 0}
            %
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">正确率</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-center">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {progress.answered - progress.correct}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">错题数</p>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">题目类型分布</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(typeCounts).map(([type, count]) => (
            <span
              key={type}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-sm"
            >
              {type} × {count}
            </span>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">选择学习模式</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            {
              mode: "sequential",
              icon: ListOrdered,
              label: "顺序答题",
              desc: "按题库顺序逐一作答",
              color:
                "border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/10",
            },
            {
              mode: "random",
              icon: Shuffle,
              label: "随机答题",
              desc: "题目随机排序，打乱顺序",
              color:
                "border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/10",
            },
            {
              mode: "exam",
              icon: Clock,
              label: "模拟考试",
              desc: "限时答题，自动评分",
              color:
                "border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/10",
            },
            {
              mode: "browse",
              icon: Eye,
              label: "浏览模式",
              desc: "直接查看题目和答案，用于记忆",
              color:
                "border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/10",
            },
          ].map((item) => (
            <button
              key={item.mode}
              onClick={() => {
                if (item.mode === "browse") {
                  navigate(`/banks/${bank.id}/browse`);
                } else if (item.mode === "exam") {
                  navigate(`/banks/${bank.id}/exam`);
                } else {
                  navigate(
                    `/banks/${bank.id}/quiz?mode=${item.mode}`
                  );
                }
              }}
              className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-colors ${item.color}`}
            >
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                <item.icon size={20} />
              </div>
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {item.desc}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Wrong and favorites shortcuts */}
      {progress.answered > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">专项练习</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <Link
              to={`/wrong?bankId=${bank.id}`}
              className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-red-300 transition-colors"
            >
              <FileQuestion size={20} className="text-red-500" />
              <div>
                <p className="font-medium">只看错题</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  复习错题，巩固知识
                </p>
              </div>
            </Link>
            <Link
              to={`/favorites?bankId=${bank.id}`}
              className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-pink-300 transition-colors"
            >
              <Heart size={20} className="text-pink-500" />
              <div>
                <p className="font-medium">收藏题目</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  查看已收藏的题目
                </p>
              </div>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function typeLabel(type: QuestionType): string {
  switch (type) {
    case "single_choice":
      return "单选题";
    case "multiple_choice":
      return "多选题";
    case "true_false":
      return "判断题";
    case "short_answer":
      return "简答题";
    default:
      return "未知";
  }
}
