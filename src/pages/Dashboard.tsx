import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Library, FileQuestion, Heart, TrendingUp, BookOpen, RefreshCw } from "lucide-react";
import { db } from "../lib/db";
import type { QuestionBank } from "../types";

export default function Dashboard() {
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [stats, setStats] = useState({
    totalQuestions: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    wrongCount: 0,
    favCount: 0,
  });

  const loadStats = async () => {
    try {
      const allBanks = await db.questionBanks.toArray();
      setBanks(allBanks);

      const allQs = await db.questions.toArray();

      const allRecords = await db.quizRecords.toArray();
      const answeredSet = new Set(allRecords.map((r) => r.questionId));

      const latestByQuestion = new Map<number, boolean>();
      for (const r of allRecords) {
        latestByQuestion.set(r.questionId!, r.isCorrect);
      }
      const correctCount = [...latestByQuestion.values()].filter(Boolean).length;

      const wrongRecords = allRecords.filter((r) => !r.isCorrect);
      const wrongIds = [...new Set(wrongRecords.map((r) => r.questionId))];

      const favs = await db.favorites.toArray();

      setStats({
        totalQuestions: allQs.length,
        totalAnswered: answeredSet.size,
        totalCorrect: correctCount,
        wrongCount: wrongIds.length,
        favCount: favs.length,
      });
    } catch (e) {
      console.error("Dashboard error:", e);
    }
  };

  useEffect(() => {
    loadStats();
    window.addEventListener("quiz-data-changed", loadStats);
    window.addEventListener("storage", (e) => {
      if (e.key === "quiz-data-version") loadStats();
    });
    return () => {
      window.removeEventListener("quiz-data-changed", loadStats);
      window.removeEventListener("storage", loadStats);
    };
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">仪表盘</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            欢迎回来，今天也要好好学习
          </p>
        </div>
        <button
          onClick={loadStats}
          className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-500"
          title="刷新数据"
        >
          <RefreshCw size={18} />
        </button>
        <button
          onClick={() => {
            if (confirm("确定要重置数据库吗？所有题库和记录将被清除。")) {
              indexedDB.deleteDatabase("QuizMasterDB").onsuccess = () => {
                window.location.reload();
              };
            }
          }}
          className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          title="重置数据库"
        >
          重置
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "题库数", value: banks.length, icon: Library, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
          { label: "总题目", value: stats.totalQuestions, icon: BookOpen, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { label: "已答题", value: stats.totalAnswered, icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
          { label: "错题", value: stats.wrongCount, icon: FileQuestion, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
          { label: "收藏", value: stats.favCount, icon: Heart, color: "text-pink-600 dark:text-pink-400", bg: "bg-pink-50 dark:bg-pink-900/20" },
        ].map((item) => (
          <div
            key={item.label}
            className={`${item.bg} rounded-xl p-4 flex flex-col gap-2`}
          >
            <item.icon className={item.color} size={22} />
            <div>
              <p className="text-2xl font-bold">{item.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">我的题库</h3>
          <Link
            to="/banks"
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            查看全部
          </Link>
        </div>
        {banks.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
            <Library size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-500 dark:text-slate-400">还没有题库</p>
            <Link
              to="/banks"
              className="inline-block mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
            >
              导入题库
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {banks.slice(0, 5).map((bank) => (
              <Link
                key={bank.id}
                to={`/banks/${bank.id}`}
                className="block bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{bank.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {bank.questionCount} 题 · {bank.source}
                    </p>
                  </div>
                  <span className="text-slate-400">
                    <TrendingUp size={16} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
