import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Check, X, ChevronLeft, ChevronRight } from "lucide-react";
import QuestionNav from "../components/QuestionNav";
import { db } from "../lib/db";
import { useQuiz } from "../hooks/useQuiz";
import type { Question, QuestionBank } from "../types";

export default function Quiz() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = (searchParams.get("mode") as "sequential" | "random") || "sequential";

  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [favIds, setFavIds] = useState<Set<number>>(new Set());
  const [touchedQuestions, setTouchedQuestions] = useState<Set<number>>(
    new Set()
  );

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
    setTouchedQuestions((prev) => {
      const next = new Set(prev);
      if (quiz.currentQuestion?.id) next.add(quiz.currentQuestion.id);
      return next;
    });
  }, [quiz.state.currentIndex]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const favs = await db.favorites.where({ bankId: Number(id) }).toArray();
      setFavIds(new Set(favs.map((f) => f.questionId)));
    })();
  }, [id, quiz.state.currentIndex]);

  const handleAnswer = () => {
    if (!selectedAnswer) return;
    setShowResult(true);
  };

  const handleNext = async () => {
    await quiz.answerQuestion(selectedAnswer);
    if (quiz.isLastQuestion) {
      quiz.answerQuestion(selectedAnswer);
      navigate(`/banks/${id}`);
    }
  };

  const isMultiChoice = quiz.currentQuestion?.type === "multiple_choice";

  const handleMultiToggle = (option: string) => {
    const letter = option.charAt(0);
    if (isMultiChoice) {
      setSelectedAnswer((prev) => {
        if (prev.includes(letter)) {
          return prev.replace(letter, "");
        }
        return (prev + letter).split("").sort().join("");
      });
    }
  };

  const handleSingleSelect = (option: string) => {
    const letter = option.charAt(0);
    setSelectedAnswer(letter);
  };

  const checkMultiAnswer = (
    userAnswer: string,
    optionLetter: string
  ): "correct" | "wrong" | "missed" | null => {
    if (!quiz.currentQuestion) return null;
    const correctAns = quiz.currentQuestion.answer
      .replace(/[A-H]\.\s*/g, "")
      .replace(/[^A-H]/g, "");
    const correctLetters = new Set(correctAns.split("").filter(Boolean));
    const userLetters = new Set(userAnswer.split("").filter(Boolean));

    if (userLetters.has(optionLetter) && !correctLetters.has(optionLetter)) {
      return "wrong";
    }
    if (correctLetters.has(optionLetter) && !userLetters.has(optionLetter)) {
      return "missed";
    }
    if (correctLetters.has(optionLetter) && userLetters.has(optionLetter)) {
      return "correct";
    }
    return null;
  };

  const toggleFav = async (questionId?: number) => {
    if (!questionId) return;
    await quiz.toggleFavorite(questionId);
    const exists = await db.favorites.where({ questionId, bankId: Number(id) }).first();
    setFavIds((prev) => {
      const next = new Set(prev);
      if (exists) {
        next.add(questionId);
      } else {
        next.delete(questionId);
      }
      return next;
    });
  };

  if (quiz.loading || !bank) {
    return (
      <div className="text-center py-16 text-slate-500">加载中...</div>
    );
  }

  if (quiz.state.questions.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 dark:text-slate-400">该题库没有题目</p>
        <button
          onClick={() => navigate(`/banks/${id}`)}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
        >
          返回题库
        </button>
      </div>
    );
  }

  const q = quiz.currentQuestion;

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
            {mode === "sequential" ? "顺序答题" : "随机答题"} · {bank.name}
          </p>
          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-1">
            <div
              className="h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full transition-all duration-300"
              style={{
                width: `${
                  ((quiz.state.currentIndex + 1) /
                    quiz.state.questions.length) *
                  100
                }%`,
              }}
            />
          </div>
        </div>
        <span className="text-sm text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
          {quiz.state.currentIndex + 1} / {quiz.state.questions.length}
        </span>
      </div>

      {/* Question Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-start justify-between gap-2 mb-4">
          <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium rounded-md">
            {typeLabel(q.type)}
          </span>
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
            {quiz.state.currentIndex + 1}. {q.stem}
          </p>
        </div>

        {/* Options */}
        <div className="space-y-2.5">
          {q.options.map((opt, i) => {
            const letter = opt.charAt(0);
            const isSelected = isMultiChoice
              ? selectedAnswer.includes(letter)
              : selectedAnswer === letter;
            const multiStatus = showResult
              ? checkMultiAnswer(selectedAnswer, letter)
              : null;

            let optionClass =
              "border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600";
            if (showResult && !isMultiChoice) {
              const correctLetter = q.answer.replace(/[^A-H]/g, "").charAt(0);
              if (letter === correctLetter) {
                optionClass =
                  "border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20";
              } else if (isSelected && letter !== correctLetter) {
                optionClass =
                  "border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20";
              }
            } else if (showResult && isMultiChoice) {
              if (multiStatus === "correct")
                optionClass =
                  "border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20";
              else if (multiStatus === "wrong")
                optionClass =
                  "border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20";
              else if (multiStatus === "missed")
                optionClass =
                  "border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20";
            } else if (isSelected) {
              optionClass =
                "border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20";
            }

            return (
              <button
                key={i}
                disabled={showResult}
                onClick={() =>
                  isMultiChoice
                    ? handleMultiToggle(opt)
                    : handleSingleSelect(opt)
                }
                className={`w-full text-left p-3.5 rounded-lg border transition-colors flex items-start gap-3 ${optionClass}`}
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
                {showResult && isMultiChoice && multiStatus && (
                  <span className="ml-auto pt-0.5">
                    {multiStatus === "correct" && (
                      <Check size={16} className="text-emerald-500" />
                    )}
                    {multiStatus === "wrong" && (
                      <X size={16} className="text-red-500" />
                    )}
                    {multiStatus === "missed" && (
                      <span className="text-xs text-amber-500">漏选</span>
                    )}
                  </span>
                )}
                {showResult && !isMultiChoice && letter === q.answer.replace(/[^A-H]/g, "").charAt(0) && (
                  <Check size={16} className="ml-auto pt-0.5 text-emerald-500" />
                )}
                {showResult && !isMultiChoice && isSelected && letter !== q.answer.replace(/[^A-H]/g, "").charAt(0) && (
                  <X size={16} className="ml-auto pt-0.5 text-red-500" />
                )}
              </button>
            );
          })}

          {q.type === "short_answer" && (
            <textarea
              disabled={showResult}
              value={selectedAnswer}
              onChange={(e) => setSelectedAnswer(e.target.value)}
              placeholder="输入你的答案..."
              rows={3}
              className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm resize-none focus:outline-none focus:border-indigo-300 dark:focus:border-indigo-600"
            />
          )}
        </div>

        {/* Result */}
        {showResult && (
          <div className="mt-5 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg animate-slide-up">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs rounded">
                {typeLabel(q.type)}
              </span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                答案: {q.answer}
              </span>
            </div>
            {q.explanation && (
              <div className="question-content text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {q.explanation}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-6 flex gap-3">
          {!showResult ? (
            <button
              onClick={handleAnswer}
              disabled={!selectedAnswer}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              确认答案
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              {quiz.isLastQuestion ? "完成答题" : "下一题"}
            </button>
          )}
        </div>

        <div className="mt-4 flex justify-center gap-2">
          {quiz.state.questions.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                if (showResult) {
                  quiz.answerQuestion(selectedAnswer);
                  setShowResult(false);
                }
                quiz.goToQuestion(idx);
              }}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                idx === quiz.state.currentIndex
                  ? "bg-indigo-600 dark:bg-indigo-400"
                  : touchedQuestions.has(quiz.state.questions[idx].id!)
                  ? "bg-indigo-300 dark:bg-indigo-600"
                  : "bg-slate-300 dark:bg-slate-600"
              }`}
            />
          ))}
        </div>
      </div>
      <QuestionNav
        total={quiz.state.questions.length}
        currentIndex={quiz.state.currentIndex}
        answers={quiz.state.answers}
        questions={quiz.state.questions}
        onJump={(idx) => {
          if (showResult) {
            quiz.answerQuestion(selectedAnswer);
            setShowResult(false);
          }
          quiz.goToQuestion(idx);
        }}
      />
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
