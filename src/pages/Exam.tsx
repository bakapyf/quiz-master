import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Heart, Trophy, RotateCcw, Settings2 } from "lucide-react";
import QuestionNav from "../components/QuestionNav";
import { db, notifyDataChanged } from "../lib/db";
import type { Question, QuestionBank } from "../types";

const typeNames: Record<string, string> = { single_choice: "单选题", multiple_choice: "多选题", true_false: "判断题", short_answer: "简答题" };
const typeOrder = ["single_choice", "multiple_choice", "true_false", "short_answer"];

export default function Exam() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<number, string>>(new Map());
  const [isFinished, setIsFinished] = useState(false);
  const [score, setScore] = useState<{ total: number; correct: number; score: number; duration: number } | null>(null);
  const [favIds, setFavIds] = useState<Set<number>>(new Set());
  const [configuring, setConfiguring] = useState(true);
  const [config, setConfig] = useState<{ timeLimit: number; types: Record<string, boolean>; counts: Record<string, string> }>({
    timeLimit: 30,
    types: {},
    counts: {},
  });
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);

  // Load bank data
  useEffect(() => {
    if (!id) return;
    (async () => {
      const b = await db.questionBanks.get(Number(id));
      if (!b) return;
      setBank(b);
      const qs = await db.questions.where({ bankId: b.id }).sortBy("order");
      setAllQuestions(qs);
      // Default: all types selected
      const types: Record<string, boolean> = {};
      const counts: Record<string, string> = {};
      for (const t of typeOrder) {
        const count = qs.filter((q) => q.type === t).length;
        types[t] = count > 0;
        counts[t] = "";
      }
      setConfig((c) => ({ ...c, types, counts }));
      setConfiguring(true);
      const favs = await db.favorites.where({ bankId: b.id }).toArray();
      setFavIds(new Set(favs.map((f) => f.questionId)));
    })();
  }, [id]);

  // Timer
  useEffect(() => {
    if (configuring || isFinished) return;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [configuring, isFinished, startTime]);

  // Auto-submit on timeout
  useEffect(() => {
    if (configuring || isFinished || questions.length === 0) return;
    if (elapsed >= config.timeLimit * 60) finishExam();
  }, [elapsed, config.timeLimit, configuring, isFinished, questions.length]);

  const toggleFav = async (questionId?: number) => {
    if (!questionId) return;
    const existing = await db.favorites.where({ questionId, bankId: Number(id) }).first();
    if (existing) { await db.favorites.delete(existing.id!); setFavIds((p) => { const n = new Set(p); n.delete(questionId); return n; }); }
    else { await db.favorites.add({ questionId, bankId: Number(id), timestamp: Date.now() }); setFavIds((p) => new Set(p).add(questionId)); }
  };

  const startExam = () => {
    const selected: Question[] = [];
    for (const t of typeOrder) {
      if (!config.types[t]) continue;
      const typeQs = allQuestions.filter((q) => q.type === t);
      const count = parseInt(config.counts[t]) || typeQs.length;
      const shuffled = [...typeQs].sort(() => Math.random() - 0.5);
      selected.push(...shuffled.slice(0, Math.min(count, shuffled.length)));
    }
    setQuestions(selected);
    setCurrentIndex(0);
    setAnswers(new Map());
    setConfiguring(false);
  };

  const finishExam = useCallback(async () => {
    if (isFinished) return;
    setIsFinished(true);
    let correct = 0;
    for (const q of questions) {
      const userAnswer = answers.get(q.id!) || "";
      let isCorrect = false;
      if (q.type === "multiple_choice") {
        const correctSet = new Set(q.answer.replace(/[^A-H]/g, "").split("").filter(Boolean));
        const userSet = new Set(userAnswer.replace(/[^A-H]/g, "").split("").filter(Boolean));
        isCorrect = correctSet.size === userSet.size && [...correctSet].every((c) => userSet.has(c));
      } else if (q.type !== "short_answer") {
        isCorrect = userAnswer.replace(/[A-H]\./, "").trim().toLowerCase() === q.answer.replace(/[A-H]\./, "").trim().toLowerCase();
      }
      await db.quizRecords.add({ questionId: q.id!, bankId: Number(id), userAnswer, isCorrect: q.type === "short_answer" ? true : isCorrect, timestamp: Date.now(), mode: "exam" });
      if (isCorrect || q.type === "short_answer") correct++;
    }
    const duration = Math.floor((Date.now() - startTime) / 1000);
    const sc = Math.round((correct / questions.length) * 100);
    await db.examSessions.add({ bankId: Number(id), bankName: bank?.name || "", mode: "exam", totalQuestions: questions.length, correctAnswers: correct, score: sc, duration, startedAt: startTime, completedAt: Date.now() });
    notifyDataChanged();
    setScore({ total: questions.length, correct, score: sc, duration });
  }, [questions, answers, id, bank, startTime, isFinished]);

  const saveAnswer = (questionId: number, userAnswer: string) => setAnswers((p) => new Map(p).set(questionId, userAnswer));

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  if (!bank) return <div className="text-center py-16 text-slate-500">加载中...</div>;

  // Config screen
  if (configuring) {
    const typeCounts: Record<string, number> = {};
    for (const t of typeOrder) typeCounts[t] = allQuestions.filter((q) => q.type === t).length;
    const hasQuestions = Object.values(typeCounts).some((c) => c > 0);

    return (
      <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/banks/${id}`)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"><ArrowLeft size={20} /></button>
          <h2 className="text-xl font-bold">模拟考试设置</h2>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">考试时间</label>
            <div className="flex items-center gap-2 mt-1">
              <input type="number" value={config.timeLimit} onChange={(e) => setConfig({ ...config, timeLimit: Math.max(1, parseInt(e.target.value) || 30) })}
                className="w-20 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-center focus:outline-none focus:border-indigo-300" />
              <span className="text-sm text-slate-500">分钟</span>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">题目类型</p>
            <div className="space-y-2">
              {typeOrder.map((t) => (
                <div key={t} className="flex items-center gap-3">
                  <input type="checkbox" checked={config.types[t]} disabled={typeCounts[t] === 0}
                    onChange={() => setConfig({ ...config, types: { ...config.types, [t]: !config.types[t] } })}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm flex-1">{typeNames[t]}（{typeCounts[t]}题）</span>
                  {config.types[t] && typeCounts[t] > 0 && (
                    <input type="number" value={config.counts[t]} placeholder="全部"
                      onChange={(e) => setConfig({ ...config, counts: { ...config.counts, [t]: e.target.value } })}
                      className="w-16 px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-center focus:outline-none focus:border-indigo-300" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <button onClick={startExam} disabled={!hasQuestions || !Object.values(config.types).some(Boolean)}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            开始考试
          </button>
        </div>
      </div>
    );
  }

  // Score screen
  if (score) {
    return (
      <div className="max-w-md mx-auto animate-slide-up">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <Trophy size={48} className="mx-auto text-amber-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">考试完成</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">{bank.name}</p>
          <div className="text-5xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">{score.score}<span className="text-2xl">分</span></div>
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3"><p className="text-lg font-bold">{score.total}</p><p className="text-xs text-slate-500">总题数</p></div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3"><p className="text-lg font-bold text-emerald-600">{score.correct}</p><p className="text-xs text-slate-500">正确</p></div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3"><p className="text-lg font-bold">{formatTime(score.duration)}</p><p className="text-xs text-slate-500">用时</p></div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => navigate(`/banks/${id}`)} className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">返回题库</button>
            <button onClick={() => { setConfiguring(true); setIsFinished(false); setScore(null); setElapsed(0); }} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"><RotateCcw size={14} />重新考试</button>
          </div>
        </div>
      </div>
    );
  }

  // Exam screen
  if (questions.length === 0) return <div className="text-center py-16 text-slate-500">没有匹配的题目</div>;
  const q = questions[currentIndex];
  const remaining = config.timeLimit * 60 - elapsed;
  const isUrgent = remaining < 300;

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={finishExam} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <p className="text-sm text-slate-500 dark:text-slate-400">模拟考试 · {bank.name}</p>
          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-1">
            <div className="h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full transition-all" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${isUrgent ? "bg-red-50 dark:bg-red-900/20 text-red-600" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"}`}>
          <Clock size={14} /> {formatTime(remaining)}
        </div>
        <button onClick={finishExam} className="px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">交卷</button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-md">考试</span>
            <span className="text-sm text-slate-500">{currentIndex + 1} / {questions.length}</span>
            <span className="text-xs text-slate-400">{typeNames[q.type]}</span>
          </div>
          <button onClick={() => toggleFav(q.id)} className={`p-1.5 rounded-lg ${favIds.has(q.id!) ? "text-pink-500" : "text-slate-400 hover:text-pink-500"}`}>
            <Heart size={18} fill={favIds.has(q.id!) ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="question-content mb-6">
          <p className="text-lg font-medium leading-relaxed">{currentIndex + 1}. {q.stem}</p>
        </div>

        <div className="space-y-2.5">
          {q.options.map((opt, i) => {
            const letter = opt.charAt(0);
            const isSelected = answers.get(q.id!)?.includes(letter);
            const isMulti = q.type === "multiple_choice";
            return (
              <button key={i} onClick={() => {
                if (isMulti) {
                  const prev = answers.get(q.id!) || "";
                  saveAnswer(q.id!, prev.includes(letter) ? prev.replace(letter, "") : (prev + letter).split("").sort().join(""));
                } else {
                  saveAnswer(q.id!, letter);
                }
              }} className={`w-full text-left p-3.5 rounded-lg border transition-colors flex items-start gap-3 ${isSelected ? "border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20" : "border-slate-200 dark:border-slate-700 hover:border-indigo-300"}`}>
                <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600"}`}>{letter}</span>
                <span className="text-sm leading-relaxed pt-0.5">{opt.slice(3)}</span>
              </button>
            );
          })}
          {q.type === "short_answer" && (
            <textarea value={answers.get(q.id!) || ""} onChange={(e) => saveAnswer(q.id!, e.target.value)} placeholder="输入答案..." rows={3} className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm resize-none focus:outline-none focus:border-indigo-300" />
          )}
        </div>

        <div className="flex justify-between mt-6">
          <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-40">上一题</button>
          {currentIndex < questions.length - 1 ? (
            <button onClick={() => setCurrentIndex(currentIndex + 1)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">下一题</button>
          ) : (
            <button onClick={finishExam} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">交卷</button>
          )}
        </div>
      </div>

      <QuestionNav total={questions.length} currentIndex={currentIndex} answers={answers} questions={questions} onJump={setCurrentIndex} />
    </div>
  );
}
