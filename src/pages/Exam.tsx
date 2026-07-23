import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Heart,
  Check,
  X,
  Trophy,
  RotateCcw,
} from "lucide-react";
import { db, notifyDataChanged } from "../lib/db";
import type { Question, QuestionBank } from "../types";

export default function Exam() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<number, string>>(new Map());
  const [showResult, setShowResult] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [timeLimit, setTimeLimit] = useState(30); // minutes
  const [examScore, setExamScore] = useState<{
    total: number;
    correct: number;
    score: number;
    duration: number;
  } | null>(null);
  const [favIds, setFavIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!id) return;
    (async () => {
      const b = await db.questionBanks.get(Number(id));
      if (!b) return;
      setBank(b);

      let qs = await db.questions.where({ bankId: b.id }).sortBy("order");
      for (let i = qs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [qs[i], qs[j]] = [qs[j], qs[i]];
      }
      setQuestions(qs);

      const savedLimit = localStorage.getItem(`exam_time_${id}`);
      if (savedLimit) setTimeLimit(Number(savedLimit));

      const favs = await db.favorites.where({ bankId: Number(id) }).toArray();
      setFavIds(new Set(favs.map((f) => f.questionId)));
    })();
  }, [id]);

  useEffect(() => {
    if (isFinished) return;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [isFinished, startTime]);

  useEffect(() => {
    if (elapsed >= timeLimit * 60 && !isFinished) {
      finishExam();
    }
  }, [elapsed, timeLimit]);

  const finishExam = useCallback(async () => {
    setIsFinished(true);

    let correct = 0;
    for (const q of questions) {
      const userAnswer = answers.get(q.id!) || "";
      let isCorrect = false;

      if (q.type === "multiple_choice") {
        const correctSet = new Set(
          q.answer.replace(/[A-H]/g, "").split("").filter(Boolean)
        );
        const userSet = new Set(
          userAnswer.replace(/[A-H]/g, "").split("").filter(Boolean)
        );
        isCorrect =
          correctSet.size === userSet.size &&
          [...correctSet].every((c) => userSet.has(c));
      } else if (q.type !== "short_answer") {
        const correct = q.answer.replace(/[A-H]\./, "").trim();
        const user = userAnswer.replace(/[A-H]\./, "").trim();
        isCorrect = user.toLowerCase() === correct.toLowerCase();
      }

      await db.quizRecords.add({
        questionId: q.id!,
        bankId: Number(id),
        userAnswer,
        isCorrect: q.type === "short_answer" ? true : isCorrect,
        timestamp: Date.now(),
        mode: "exam",
      });

      if (isCorrect || q.type === "short_answer") correct++;
    }

    const duration = Math.floor((Date.now() - startTime) / 1000);
    const score = Math.round((correct / questions.length) * 100);

    await db.examSessions.add({
      bankId: Number(id),
      bankName: bank?.name || "",
      mode: "exam",
      totalQuestions: questions.length,
      correctAnswers: correct,
      score,
      duration,
      startedAt: startTime,
      completedAt: Date.now(),
    });

    notifyDataChanged();

    setExamScore({
      total: questions.length,
      correct,
      score,
      duration,
    });
  }, [questions, answers, id, bank, startTime]);

  const saveAnswer = async (questionId: number, userAnswer: string) => {
    setAnswers((prev) => new Map(prev).set(questionId, userAnswer));
  };

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

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (!bank || questions.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">加载中...</div>
    );
  }

  if (examScore) {
    return (
      <div className="max-w-md mx-auto animate-slide-up">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <Trophy size={48} className="mx-auto text-amber-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">考试完成</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            {bank.name}
          </p>

          <div className="text-5xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
            {examScore.score}
            <span className="text-2xl">分</span>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <p className="text-lg font-bold">{examScore.total}</p>
              <p className="text-xs text-slate-500">总题数</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
              <p className="text-lg font-bold text-emerald-600">
                {examScore.correct}
              </p>
              <p className="text-xs text-slate-500">正确</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <p className="text-lg font-bold">
                {formatTime(examScore.duration)}
              </p>
              <p className="text-xs text-slate-500">用时</p>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => navigate(`/banks/${id}`)}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              返回题库
            </button>
            <button
              onClick={() => {
                setExamScore(null);
                setCurrentIndex(0);
                setAnswers(new Map());
                setIsFinished(false);
                setElapsed(0);
                const qs = [...questions];
                for (let i = qs.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [qs[i], qs[j]] = [qs[j], qs[i]];
                }
                setQuestions(qs);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <RotateCcw size={14} />
              重新考试
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[currentIndex];
  const remaining = timeLimit * 60 - elapsed;
  const isUrgent = remaining < 300;

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/banks/${id}`)}
          className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            模拟考试 · {bank.name}
          </p>
        </div>
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
            isUrgent
              ? "bg-red-50 dark:bg-red-900/20 text-red-600"
              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          }`}
        >
          <Clock size={14} />
          {formatTime(remaining)}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={finishExam}
          className="ml-auto px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        >
          提前交卷
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-md">
              考试
            </span>
            <span className="text-sm text-slate-500">
              {currentIndex + 1} / {questions.length}
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
            <Heart
              size={18}
              fill={favIds.has(q.id!) ? "currentColor" : "none"}
            />
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
            const isSelected = answers.get(q.id!)?.includes(letter);
            const isMultiChoice = q.type === "multiple_choice";

            return (
              <button
                key={i}
                onClick={() => {
                  if (isMultiChoice) {
                    const prev = answers.get(q.id!) || "";
                    const next = prev.includes(letter)
                      ? prev.replace(letter, "")
                      : (prev + letter).split("").sort().join("");
                    saveAnswer(q.id!, next);
                  } else {
                    saveAnswer(q.id!, letter);
                  }
                }}
                className={`w-full text-left p-3.5 rounded-lg border transition-colors flex items-start gap-3 ${
                  isSelected
                    ? "border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20"
                    : "border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600"
                }`}
              >
                <span
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    isSelected
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {letter}
                </span>
                <span className="text-sm leading-relaxed pt-0.5">
                  {opt.slice(3)}
                </span>
              </button>
            );
          })}

          {q.type === "short_answer" && (
            <textarea
              value={answers.get(q.id!) || ""}
              onChange={(e) => saveAnswer(q.id!, e.target.value)}
              placeholder="输入你的答案..."
              rows={3}
              className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm resize-none focus:outline-none focus:border-indigo-300 dark:focus:border-indigo-600"
            />
          )}
        </div>

        <div className="flex justify-between mt-6">
          <button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40"
          >
            上一题
          </button>
          {currentIndex < questions.length - 1 ? (
            <button
              onClick={() => setCurrentIndex(currentIndex + 1)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              下一题
            </button>
          ) : (
            <button
              onClick={finishExam}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              交卷
            </button>
          )}
        </div>

        <div className="mt-4 flex justify-center gap-2 flex-wrap">
          {questions.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                idx === currentIndex
                  ? "bg-indigo-600 dark:bg-indigo-400"
                  : answers.has(questions[idx].id!)
                  ? "bg-indigo-300 dark:bg-indigo-600"
                  : "bg-slate-300 dark:bg-slate-600"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
