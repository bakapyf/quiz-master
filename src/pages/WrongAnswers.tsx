import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Heart, Shuffle, RefreshCw } from "lucide-react";
import { db, notifyDataChanged } from "../lib/db";
import type { Question, QuestionBank } from "../types";

export default function WrongAnswers() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bankId = searchParams.get("bankId");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [banks, setBanks] = useState<Map<number, QuestionBank>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [favIds, setFavIds] = useState<Set<number>>(new Set());
  const [shuffled, setShuffled] = useState(false);

  const loadWrongQuestions = async () => {
    const bid = bankId ? Number(bankId) : undefined;
    const wrongIds = await db.getWrongQuestionIds(bid);

    const allQuestions: Question[] = [];
    for (const qid of wrongIds) {
      const q = await db.questions.get(qid);
      if (q) allQuestions.push(q);
    }

    const allBanks = await db.questionBanks.toArray();
    const bankMap = new Map<number, QuestionBank>();
    for (const b of allBanks) bankMap.set(b.id!, b);

    const favs = await db.favorites.toArray();
    startQuiz(allQuestions, bankMap, new Set(favs.map((f) => f.questionId)));
  };

  const startQuiz = (
    qs: Question[],
    bm: Map<number, QuestionBank>,
    fids: Set<number>
  ) => {
    if (shuffled) {
      for (let i = qs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [qs[i], qs[j]] = [qs[j], qs[i]];
      }
    }
    setQuestions(qs);
    setBanks(bm);
    setFavIds(fids);
    setCurrentIndex(0);
    setSelectedAnswer("");
    setShowResult(false);
  };

  useEffect(() => {
    loadWrongQuestions();
  }, [bankId]);

  const handleAnswer = () => {
    if (!selectedAnswer) return;
    setShowResult(true);
  };

  const handleNext = async () => {
    const q = questions[currentIndex];
    if (!q) return;

    let isCorrect = false;
    if (q.type === "multiple_choice") {
      const correctSet = new Set(
        q.answer.replace(/[A-H]/g, "").split("").filter(Boolean)
      );
      const userSet = new Set(
        selectedAnswer.replace(/[A-H]/g, "").split("").filter(Boolean)
      );
      isCorrect =
        correctSet.size === userSet.size &&
        [...correctSet].every((c) => userSet.has(c));
    } else if (q.type !== "short_answer") {
      const correct = q.answer.replace(/[A-H]\./, "").trim();
      const user = selectedAnswer.replace(/[A-H]\./, "").trim();
      isCorrect = user.toLowerCase() === correct.toLowerCase();
    }

    await db.quizRecords.add({
      questionId: q.id!,
      bankId: q.bankId,
      userAnswer: selectedAnswer,
      isCorrect,
      timestamp: Date.now(),
      mode: "sequential",
    });

    notifyDataChanged();

    if (isCorrect) {
      // Remove from wrong list locally
      setQuestions((prev) => prev.filter((_, i) => i !== currentIndex));
      setCurrentIndex((prev) => Math.min(prev, questions.length - 2));
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
    setSelectedAnswer("");
    setShowResult(false);
  };

  const toggleFav = async (questionId?: number) => {
    if (!questionId) return;
    const q = questions[currentIndex];
    const existing = await db.favorites.where({ questionId, bankId: q.bankId }).first();
    if (existing) {
      await db.favorites.delete(existing.id!);
      setFavIds((prev) => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });
    } else {
      await db.favorites.add({ questionId, bankId: q.bankId, timestamp: Date.now() });
      setFavIds((prev) => new Set(prev).add(questionId));
    }
  };

  if (questions.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-16 animate-fade-in">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-xl font-bold mb-2">没有错题</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">
          继续保持，你很棒！
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

  const q = questions[currentIndex];
  if (!q) return null;

  const isMultiChoice = q.type === "multiple_choice";

  const handleMultiToggle = (opt: string) => {
    const letter = opt.charAt(0);
    setSelectedAnswer((prev) => {
      if (prev.includes(letter)) return prev.replace(letter, "");
      return (prev + letter).split("").sort().join("");
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold">错题本</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {questions.length} 道错题 · {bankId ? banks.get(Number(bankId))?.name : "全部题库"}
          </p>
        </div>
        <button
          onClick={async () => {
            const qs = [...questions];
            for (let i = qs.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [qs[i], qs[j]] = [qs[j], qs[i]];
            }
            setQuestions(qs);
            setCurrentIndex(0);
            setSelectedAnswer("");
            setShowResult(false);
            setShuffled(true);
          }}
          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
          title="随机打乱"
        >
          <Shuffle size={18} />
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium rounded-md">
              错题重做
            </span>
            <span className="text-sm text-slate-500">
              {currentIndex + 1} / {questions.length}
            </span>
            <span className="text-xs text-slate-400">
              ({banks.get(q.bankId)?.name || "未知"})
            </span>
          </div>
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

        <div className="space-y-2.5">
          {q.options.map((opt, i) => {
            const letter = opt.charAt(0);
            const isSelected = isMultiChoice
              ? selectedAnswer.includes(letter)
              : selectedAnswer === letter;

            let optionClass =
              "border-slate-200 dark:border-slate-700 hover:border-indigo-300";
            if (showResult && !isMultiChoice) {
              const correctLetter = q.answer.replace(/[^A-H]/g, "").charAt(0);
              if (letter === correctLetter)
                optionClass = "border-emerald-300 bg-emerald-50";
              else if (isSelected)
                optionClass = "border-red-300 bg-red-50";
            } else if (isSelected) {
              optionClass = "border-indigo-300 bg-indigo-50";
            }

            return (
              <button
                key={i}
                disabled={showResult}
                onClick={() =>
                  isMultiChoice ? handleMultiToggle(opt) : setSelectedAnswer(letter)
                }
                className={`w-full text-left p-3.5 rounded-lg border transition-colors flex items-start gap-3 ${optionClass}`}
              >
                <span
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    isSelected
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600"
                  }`}
                >
                  {letter}
                </span>
                <span className="text-sm leading-relaxed pt-0.5">{opt.slice(3)}</span>
              </button>
            );
          })}
        </div>

        {showResult && (
          <div className="mt-5 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg animate-slide-up">
            <p className="text-sm font-medium mb-1">
              答案: <span className="text-emerald-600">{q.answer}</span>
            </p>
            {q.explanation && (
              <div className="question-content text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {q.explanation}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          {!showResult ? (
            <button
              onClick={handleAnswer}
              disabled={!selectedAnswer}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              确认答案
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              下一题
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
