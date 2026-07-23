import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "../lib/db";
import type { Question, QuestionBank } from "../types";

export default function Browse() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [favIds, setFavIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!id) return;
    (async () => {
      const b = await db.questionBanks.get(Number(id));
      if (!b) return;
      setBank(b);
      const qs = await db.questions.where({ bankId: b.id }).sortBy("order");
      setQuestions(qs);

      const favs = await db.favorites.where({ bankId: Number(id) }).toArray();
      setFavIds(new Set(favs.map((f) => f.questionId)));
    })();
  }, [id]);

  const toggleFav = async (questionId?: number) => {
    if (!questionId) return;
    const existing = await db.favorites.where({ questionId, bankId: Number(id) }).first();
    if (existing) {
      await db.favorites.delete(existing.id!);
      setFavIds((prev) => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });
    } else {
      await db.favorites.add({ questionId, bankId: Number(id), timestamp: Date.now() });
      setFavIds((prev) => new Set(prev).add(questionId));
    }
  };

  if (!bank || questions.length === 0) {
    return <div className="text-center py-16 text-slate-500">加载中...</div>;
  }

  const q = questions[currentIndex];

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/banks/${id}`)}
          className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            浏览模式 · {bank.name}
          </p>
        </div>
        <span className="text-sm text-slate-500">
          {currentIndex + 1} / {questions.length}
        </span>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-start justify-between gap-2 mb-4">
          <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-md">
            浏览 · {typeLabel(q.type)}
          </span>
          <button
            onClick={() => toggleFav(q.id)}
            className={`p-1.5 rounded-lg transition-colors ${
              favIds.has(q.id!)
                ? "text-pink-500 bg-pink-50 dark:bg-pink-900/20"
                : "text-slate-400 hover:text-pink-500"
            }`}
          >
            <Heart size={18} fill={favIds.has(q.id!) ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="question-content mb-6">
          <p className="text-lg font-medium leading-relaxed">
            {currentIndex + 1}. {q.stem}
          </p>
        </div>

        {q.options.length > 0 && (
          <div className="space-y-2.5 mb-6">
            {q.options.map((opt, i) => {
              const letter = opt.charAt(0);
              const correctLetter = q.answer.replace(/[A-H]/g, "").charAt(0);
              const isCorrect = letter === correctLetter;

              return (
                <div
                  key={i}
                  className={`p-3.5 rounded-lg border flex items-start gap-3 ${
                    isCorrect
                      ? "border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <span
                    className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCorrect
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600"
                    }`}
                  >
                    {letter}
                  </span>
                  <span className="text-sm leading-relaxed pt-0.5">
                    {opt.slice(3)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-1">
            {typeLabel(q.type) === "简答" ? "参考答案" : "答案"}: {q.answer}
          </p>
          {q.explanation && (
            <div className="question-content text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-2">
              {q.explanation}
            </div>
          )}
        </div>

        <div className="flex justify-between mt-6">
          <button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40"
          >
            <ChevronLeft size={16} />
            上一题
          </button>
          <button
            onClick={() =>
              setCurrentIndex(
                Math.min(questions.length - 1, currentIndex + 1)
              )
            }
            disabled={currentIndex >= questions.length - 1}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40"
          >
            下一题
            <ChevronRight size={16} />
          </button>
        </div>
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
