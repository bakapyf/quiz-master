import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Heart, ChevronRight, BookOpen } from "lucide-react";
import { db, notifyDataChanged } from "../lib/db";
import type { Question, QuestionBank } from "../types";

export default function Favorites() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bankId = searchParams.get("bankId");
  const [items, setItems] = useState<
    { question: Question; bank: QuestionBank }[]
  >([]);

  useEffect(() => {
    (async () => {
      let favs = await db.favorites.toArray();
      if (bankId) {
        favs = favs.filter((f) => f.bankId === Number(bankId));
      }

      const banks = await db.questionBanks.toArray();
      const bankMap = new Map(banks.map((b) => [b.id!, b]));

      const result: { question: Question; bank: QuestionBank }[] = [];
      for (const f of favs) {
        const q = await db.questions.get(f.questionId);
        const b = bankMap.get(f.bankId);
        if (q && b) result.push({ question: q, bank: b });
      }

      setItems(result.reverse());
    })();
  }, [bankId]);

  const removeFav = async (questionId: number, bankId: number) => {
    const f = await db.favorites.where({ questionId, bankId }).first();
    if (f) {
      await db.favorites.delete(f.id!);
      notifyDataChanged();
      setItems((prev) => prev.filter((i) => i.question.id !== questionId));
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-16 animate-fade-in">
        <Heart size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
        <h2 className="text-xl font-bold mb-2">还没有收藏</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">
          答题时点击心形图标收藏题目
        </p>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
        >
          返回首页
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-xl font-bold">收藏夹</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {items.length} 道收藏题目
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {items.map(({ question: q, bank: b }) => (
          <div
            key={q.id}
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:border-pink-300 dark:hover:border-pink-700 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-xs rounded">
                    {typeLabel(q.type)}
                  </span>
                  <Link
                    to={`/banks/${q.bankId}`}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {b.name}
                  </Link>
                </div>
                <p className="text-sm leading-relaxed line-clamp-3">{q.stem}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    答案: {q.answer}
                  </span>
                </div>
              </div>
              <button
                onClick={() => removeFav(q.id!, q.bankId)}
                className="p-1.5 text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-lg transition-colors flex-shrink-0"
                title="取消收藏"
              >
                <Heart size={18} fill="currentColor" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function typeLabel(type: string): string {
  switch (type) {
    case "single_choice":
      return "单选";
    case "multiple_choice":
      return "多选";
    case "true_false":
      return "判断";
    case "short_answer":
      return "简答";
    default:
      return "未知";
  }
}
