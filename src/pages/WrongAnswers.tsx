import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Shuffle, Zap, Check, X, Trash2 } from "lucide-react";
import QuestionNav from "../components/QuestionNav";
import { db, notifyDataChanged } from "../lib/db";
import type { Question, QuestionBank } from "../types";

export default function WrongAnswers() {
  const navigate = useNavigate();
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [wrongMap, setWrongMap] = useState<Map<number, Question[]>>(new Map());
  const [selectedBankId, setSelectedBankId] = useState<number | "all">("all");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [favIds, setFavIds] = useState<Set<number>>(new Set());
  const [quizMode, setQuizMode] = useState(false);
  const [quickMode, setQuickMode] = useState(() => localStorage.getItem("quiz-quick-mode") === "1");

  const loadWrongQuestions = async () => {
    const allBanks = await db.questionBanks.toArray();
    setBanks(allBanks);

    const map = new Map<number, Question[]>();
    for (const b of allBanks) {
      const wrongIds = await db.getWrongQuestionIds(b.id!);
      const qs: Question[] = [];
      for (const qid of wrongIds) {
        const q = await db.questions.get(qid);
        if (q) qs.push(q);
      }
      if (qs.length > 0) map.set(b.id!, qs);
    }

    setWrongMap(map);
    const favs = await db.favorites.toArray();
    setFavIds(new Set(favs.map((f) => f.questionId)));
    setQuizMode(false);
  };

  useEffect(() => { loadWrongQuestions(); }, []);

  const enterQuiz = async (bankId: number | "all") => {
    let qs: Question[] = [];
    if (bankId === "all") {
      qs = [...wrongMap.values()].flat();
    } else {
      qs = wrongMap.get(bankId) || [];
    }
    if (qs.length === 0) return;
    setQuestions(qs);
    setSelectedBankId(bankId);
    setCurrentIndex(0);
    setSelectedAnswer("");
    setShowResult(false);
    setQuizMode(true);
  };

  const submitAndAdvance = async (answer?: string) => {
    const q = questions[currentIndex];
    if (!q) return;
    const ans = answer ?? selectedAnswer;
    if (!ans) return;
    let isCorrect = false;
    if (q.type === "multiple_choice") {
      const cs = new Set(q.answer.replace(/[^A-H]/g, "").split("").filter(Boolean));
      const us = new Set(ans.replace(/[^A-H]/g, "").split("").filter(Boolean));
      isCorrect = cs.size === us.size && [...cs].every((c) => us.has(c as string));
    } else if (q.type !== "short_answer") {
      isCorrect = ans.replace(/[A-H]\.\s*/g, "").trim().toLowerCase() === q.answer.replace(/[A-H]\.\s*/g, "").trim().toLowerCase();
    }
    await db.quizRecords.add({ questionId: q.id!, bankId: q.bankId, userAnswer: ans, isCorrect, timestamp: Date.now(), mode: "sequential" });
    notifyDataChanged();

    if (isCorrect) {
      setQuestions((p) => p.filter((_, i) => i !== currentIndex));
    }
    setSelectedAnswer("");
    setShowResult(false);
    if (!isCorrect) setCurrentIndex((p) => Math.min(p + 1, questions.length - 1));
  };

  const removeFromWrong = async (questionId: number) => {
    const records = await db.quizRecords.where({ questionId }).toArray();
    const wrongRecords = records.filter((r) => !r.isCorrect);
    for (const r of wrongRecords) await db.quizRecords.delete(r.id!);
    notifyDataChanged();
    setQuestions((p) => p.filter((_, i) => i !== currentIndex));
  };

  const handleOptionClick = (letter: string) => {
    const q = questions[currentIndex];
    if (!q) return;
    if (q.type === "multiple_choice") {
      const next = selectedAnswer.includes(letter) ? selectedAnswer.replace(letter, "") : (selectedAnswer + letter).split("").sort().join("");
      setSelectedAnswer(next);
      if (!showResult && next) setShowResult(true);
    } else {
      setSelectedAnswer(letter);
      if (quickMode) { submitAndAdvance(letter); } else { setShowResult(true); }
    }
  };

  const toggleFav = async (questionId?: number) => {
    if (!questionId) return;
    const q = questions[currentIndex];
    const existing = await db.favorites.where({ questionId, bankId: q.bankId }).first();
    if (existing) { await db.favorites.delete(existing.id!); setFavIds((p) => { const n = new Set(p); n.delete(questionId); return n; }); }
    else { await db.favorites.add({ questionId, bankId: q.bankId, timestamp: Date.now() }); setFavIds((p) => new Set(p).add(questionId)); }
  };

  const totalWrong = [...wrongMap.values()].reduce((s, qs) => s + qs.length, 0);

  if (totalWrong === 0 && !quizMode) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 animate-fade-in">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-xl font-bold mb-2">没有错题</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">继续保持！</p>
        <button onClick={() => navigate("/")} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">返回首页</button>
      </div>
    );
  }

  // Quiz mode
  if (quizMode) {
    if (questions.length === 0) {
      return (
        <div className="max-w-lg mx-auto text-center py-16">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-xl font-bold mb-2">错题已清</h2>
          <p className="text-slate-500 mb-4">所有错题都已答对</p>
          <button onClick={() => { setQuizMode(false); loadWrongQuestions(); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">返回</button>
        </div>
      );
    }

    const q = questions[currentIndex];
    if (!q) return null;
    const isMulti = q.type === "multiple_choice";
    const isShort = q.type === "short_answer";

    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <button onClick={() => { setQuizMode(false); loadWrongQuestions(); }} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"><ArrowLeft size={20} /></button>
          <div className="flex-1">
            <p className="text-sm text-slate-500">错题本 · {selectedBankId === "all" ? "全部题库" : banks.find((b) => b.id === selectedBankId)?.name}</p>
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-1"><div className="h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full transition-all" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} /></div>
          </div>
          <span className="text-sm text-slate-500">{currentIndex + 1}/{questions.length}</span>
          <button onClick={() => { const n = !quickMode; setQuickMode(n); localStorage.setItem("quiz-quick-mode", n ? "1" : "0"); }} className={`p-2 rounded-lg ${quickMode ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}><Zap size={18} fill={quickMode ? "currentColor" : "none"} /></button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-start justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium rounded-md">错题</span>
              <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium rounded-md">{typeLabel(q.type)}</span>
              <span className="text-sm text-slate-500">{currentIndex + 1} / {questions.length}</span>
              <span className="text-xs text-slate-400">({banks.find((b) => b.id === q.bankId)?.name})</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => removeFromWrong(q.id!)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg" title="移出错题本"><Trash2 size={16} /></button>
              <button onClick={() => toggleFav(q.id)} className={`p-1.5 rounded-lg ${favIds.has(q.id!) ? "text-pink-500" : "text-slate-400 hover:text-pink-500"}`}><Heart size={18} fill={favIds.has(q.id!) ? "currentColor" : "none"} /></button>
            </div>
          </div>

          <div className="question-content mb-6"><p className="text-lg font-medium leading-relaxed">{currentIndex + 1}. {q.stem}</p></div>

          <div className="space-y-2.5">
            {q.options.map((opt, i) => {
              const letter = opt.charAt(0);
              const isSelected = isMulti ? selectedAnswer.includes(letter) : selectedAnswer === letter;
              let oc = "border-slate-200 dark:border-slate-700 hover:border-indigo-300";
              if (showResult && !isMulti) {
                const cl = q.answer.replace(/[^A-H]/g, "").charAt(0);
                if (letter === cl) oc = "border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20";
                else if (isSelected) oc = "border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20";
              } else if (isSelected) oc = "border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30";
              return (
                <button key={i} disabled={showResult && !isMulti} onClick={() => handleOptionClick(letter)} className={`w-full text-left p-3.5 rounded-lg border transition-colors flex items-start gap-3 ${oc}`}>
                  <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600"}`}>{letter}</span>
                  <span className="text-sm leading-relaxed pt-0.5">{opt.slice(3)}</span>
                  {showResult && !isMulti && letter === q.answer.replace(/[^A-H]/g, "").charAt(0) && <Check size={16} className="ml-auto pt-0.5 text-emerald-500" />}
                  {showResult && !isMulti && isSelected && letter !== q.answer.replace(/[^A-H]/g, "").charAt(0) && <X size={16} className="ml-auto pt-0.5 text-red-500" />}
                </button>
              );
            })}
            {isShort && <textarea disabled={showResult} value={selectedAnswer} onChange={(e) => setSelectedAnswer(e.target.value)} placeholder="输入答案..." rows={3} className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm resize-none focus:outline-none focus:border-indigo-300" />}
          </div>

          {showResult && (
            <div className="mt-5 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg animate-slide-up">
              <p className="text-sm font-medium mb-1">答案: <span className="text-emerald-600">{q.answer}</span></p>
              {q.explanation && <div className="question-content text-sm text-slate-600 dark:text-slate-400">{q.explanation}</div>}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            {isMulti && !showResult && <button onClick={() => { if (selectedAnswer) setShowResult(true); }} disabled={!selectedAnswer} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">提交答案</button>}
            {isShort && !showResult && <button onClick={() => { if (selectedAnswer) setShowResult(true); }} disabled={!selectedAnswer} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">提交答案</button>}
            {showResult && <button onClick={() => submitAndAdvance()} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">下一题</button>}
          </div>
        </div>

        <QuestionNav total={questions.length} currentIndex={currentIndex} answers={new Map()} questions={questions} onJump={setCurrentIndex} />
      </div>
    );
  }

  // Bank list view
  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/")} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"><ArrowLeft size={20} /></button>
        <h2 className="text-xl font-bold">错题本</h2>
        <span className="text-sm text-slate-500">共 {totalWrong} 题</span>
      </div>

      <div className="grid gap-3">
        <button onClick={() => enterQuiz("all")} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-700 transition-colors">
          <span className="font-medium">全部题库</span>
          <span className="text-sm text-red-500 font-bold">{totalWrong} 题</span>
        </button>
        {banks.map((b) => {
          const count = wrongMap.get(b.id!)?.length || 0;
          if (count === 0) return null;
          return (
            <button key={b.id} onClick={() => enterQuiz(b.id!)} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-700 transition-colors">
              <span className="font-medium">{b.name}</span>
              <span className="text-sm text-red-500 font-bold">{count} 题</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const typeLabels: Record<string, string> = {
  single_choice: "单选",
  multiple_choice: "多选",
  true_false: "判断",
  short_answer: "简答",
};

function typeLabel(type: string): string {
  return typeLabels[type] || "未知";
}
