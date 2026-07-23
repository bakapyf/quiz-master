import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Check, X, Zap } from "lucide-react";
import QuestionNav from "../components/QuestionNav";
import { db, notifyDataChanged } from "../lib/db";
import { useQuiz } from "../hooks/useQuiz";
import type { QuestionBank } from "../types";

export default function Quiz() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = (searchParams.get("mode") as "sequential" | "random") || "sequential";

  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [favIds, setFavIds] = useState<Set<number>>(new Set());
  const [quickMode, setQuickMode] = useState(() => localStorage.getItem("quiz-quick-mode") === "1");

  const quiz = useQuiz(Number(id), { mode, bankId: Number(id) });

  useEffect(() => {
    if (!id) return;
    (async () => {
      const b = await db.questionBanks.get(Number(id));
      setBank(b ?? null);
    })();
  }, [id]);

  useEffect(() => {
    setSelectedAnswer("");
    setShowResult(false);
  }, [quiz.state.currentIndex]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const favs = await db.favorites.where({ bankId: Number(id) }).toArray();
      setFavIds(new Set(favs.map((f) => f.questionId)));
    })();
  }, [id, quiz.state.currentIndex]);

  const toggleQuickMode = () => {
    const next = !quickMode;
    setQuickMode(next);
    localStorage.setItem("quiz-quick-mode", next ? "1" : "0");
  };

  const handleAnswer = async (answer?: string) => {
    const ans = answer ?? selectedAnswer;
    if (!ans) return;

    if (quickMode && !quiz.currentQuestion?.type.includes("multiple") && !quiz.currentQuestion?.type.includes("short")) {
      // In quick mode, submit immediately
      await quiz.answerQuestion(ans);
      if (quiz.isLastQuestion) {
        navigate(`/banks/${id}`);
      } else {
        setSelectedAnswer("");
        setShowResult(false);
        quiz.goToQuestion(quiz.state.currentIndex + 1);
      }
    } else {
      setShowResult(true);
    }
  };

  const handleNext = async () => {
    await quiz.answerQuestion(selectedAnswer);
    if (quiz.isLastQuestion) {
      navigate(`/banks/${id}`);
    }
  };

  const getDotColor = (q: any, idx: number) => {
    if (idx === quiz.state.currentIndex) return "bg-indigo-600 dark:bg-indigo-400";
    const ans = quiz.state.answers.get(q.id!);
    if (!ans) return "bg-slate-300 dark:bg-slate-600";
    // Check if answer is correct
    const isMulti = q.type === "multiple_choice";
    if (isMulti) {
      const correctSet = new Set(q.answer.replace(/[^A-H]/g, "").split("").filter(Boolean));
      const userSet = new Set(ans.replace(/[^A-H]/g, "").split("").filter(Boolean));
      return correctSet.size === userSet.size && [...correctSet].every((c) => userSet.has(c as string))
        ? "bg-emerald-500" : "bg-red-500";
    }
    return ans.replace(/[A-H]\./, "").trim().toLowerCase() === q.answer.replace(/[A-H]\./, "").trim().toLowerCase()
      ? "bg-emerald-500" : "bg-red-500";
  };

  const wrongCount = [...quiz.state.answers.entries()].filter(([qid, ans]) => {
    const q = quiz.state.questions.find((qq) => qq.id === qid);
    if (!q) return false;
    const isMulti = q.type === "multiple_choice";
    if (isMulti) {
      const correctSet = new Set(q.answer.replace(/[^A-H]/g, "").split("").filter(Boolean));
      const userSet = new Set(ans.replace(/[^A-H]/g, "").split("").filter(Boolean));
      return !(correctSet.size === userSet.size && [...correctSet].every((c) => userSet.has(c as string)));
    }
    return ans.replace(/[A-H]\./, "").trim().toLowerCase() !== q.answer.replace(/[A-H]\./, "").trim().toLowerCase();
  }).length;

  const isMultiChoice = quiz.currentQuestion?.type === "multiple_choice";
  const isShortAnswer = quiz.currentQuestion?.type === "short_answer";
  const canInstant = !isMultiChoice && !isShortAnswer;

  const handleOptionClick = (letter: string) => {
    if (isMultiChoice) {
      setSelectedAnswer((prev) => {
        const next = prev.includes(letter) ? prev.replace(letter, "") : (prev + letter).split("").sort().join("");
        return next;
      });
    } else {
      setSelectedAnswer(letter);
      if (quickMode) handleAnswer(letter);
    }
  };

  const toggleFav = async (questionId?: number) => {
    if (!questionId) return;
    await quiz.toggleFavorite(questionId);
    const exists = await db.favorites.where({ questionId, bankId: Number(id) }).first();
    setFavIds((prev) => {
      const next = new Set(prev);
      exists ? next.add(questionId) : next.delete(questionId);
      return next;
    });
  };

  if (quiz.loading || !bank) {
    return <div className="text-center py-16 text-slate-500">加载中...</div>;
  }

  if (quiz.state.questions.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 dark:text-slate-400">该题库没有题目</p>
        <button onClick={() => navigate(`/banks/${id}`)} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors">返回题库</button>
      </div>
    );
  }

  const q = quiz.currentQuestion;

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/banks/${id}`)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {mode === "sequential" ? "顺序答题" : "随机答题"} · {bank.name}
          </p>
          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-1">
            <div className="h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full transition-all duration-300" style={{ width: `${((quiz.state.currentIndex + 1) / quiz.state.questions.length) * 100}%` }} />
          </div>
        </div>
        <span className="text-sm text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">{quiz.state.currentIndex + 1} / {quiz.state.questions.length}</span>
        <button
          onClick={toggleQuickMode}
          className={`p-2 rounded-lg transition-colors ${quickMode ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
          title={quickMode ? "即时模式：点击即出答案" : "确认模式：需点确认按钮"}
        >
          <Zap size={18} fill={quickMode ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium rounded-md">{typeLabel(q.type)}</span>
            {quickMode && canInstant && <Zap size={14} className="text-amber-500" />}
          </div>
          <button onClick={() => toggleFav(q.id)} className={`p-1.5 rounded-lg transition-colors ${favIds.has(q.id!) ? "text-pink-500 bg-pink-50 dark:bg-pink-900/20" : "text-slate-400 hover:text-pink-500"}`}>
            <Heart size={18} fill={favIds.has(q.id!) ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="question-content mb-6">
          <p className="text-lg font-medium leading-relaxed">{quiz.state.currentIndex + 1}. {q.stem}</p>
        </div>

        <div className="space-y-2.5">
          {q.options.map((opt, i) => {
            const letter = opt.charAt(0);
            const isSelected = isMultiChoice ? selectedAnswer.includes(letter) : selectedAnswer === letter;

            let optionClass = "border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600";
            if (showResult && !isMultiChoice) {
              const correctLetter = q.answer.replace(/[^A-H]/g, "").charAt(0);
              if (letter === correctLetter) optionClass = "border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20";
              else if (isSelected) optionClass = "border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20";
            } else if (isSelected) {
              optionClass = "border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20";
            }

            return (
              <button key={i} disabled={showResult} onClick={() => handleOptionClick(letter)} className={`w-full text-left p-3.5 rounded-lg border transition-colors flex items-start gap-3 ${optionClass}`}>
                <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>{letter}</span>
                <span className="text-sm leading-relaxed pt-0.5">{opt.slice(3)}</span>
                {showResult && !isMultiChoice && letter === q.answer.replace(/[^A-H]/g, "").charAt(0) && <Check size={16} className="ml-auto pt-0.5 text-emerald-500" />}
                {showResult && !isMultiChoice && isSelected && letter !== q.answer.replace(/[^A-H]/g, "").charAt(0) && <X size={16} className="ml-auto pt-0.5 text-red-500" />}
              </button>
            );
          })}

          {isShortAnswer && (
            <textarea disabled={showResult} value={selectedAnswer} onChange={(e) => setSelectedAnswer(e.target.value)} placeholder="输入你的答案..." rows={3} className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm resize-none focus:outline-none focus:border-indigo-300 dark:focus:border-indigo-600" />
          )}
        </div>

        {showResult && (
          <div className="mt-5 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg animate-slide-up">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs rounded">{typeLabel(q.type)}</span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">答案: {q.answer}</span>
            </div>
            {q.explanation && <div className="question-content text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{q.explanation}</div>}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          {!showResult ? (
            <button onClick={() => handleAnswer()} disabled={!selectedAnswer || (isMultiChoice && quickMode)} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {quickMode && canInstant ? "跳过" : "确认答案"}
            </button>
          ) : (
            <button onClick={handleNext} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
              {quiz.isLastQuestion ? "完成答题" : "下一题"}
            </button>
          )}
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          <div className="flex justify-center gap-2 flex-wrap">
            {quiz.state.questions.map((_, idx) => (
              <div key={idx} className={`w-2.5 h-2.5 rounded-full shrink-0 ${getDotColor(quiz.state.questions[idx], idx)}`} />
            ))}
          </div>
          {wrongCount > 0 && (
            <span className="text-xs text-red-500 font-medium whitespace-nowrap">
              错 {wrongCount} 题
            </span>
          )}
        </div>
      </div>

      <QuestionNav
        total={quiz.state.questions.length}
        currentIndex={quiz.state.currentIndex}
        answers={quiz.state.answers}
        questions={quiz.state.questions}
        onJump={(idx) => quiz.goToQuestion(idx)}
      />
    </div>
  );
}

function typeLabel(type: string): string {
  switch (type) {
    case "single_choice": return "单选";
    case "multiple_choice": return "多选";
    case "true_false": return "判断";
    case "short_answer": return "简答";
    default: return "未知";
  }
}
