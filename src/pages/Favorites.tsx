import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, BookOpen } from "lucide-react";
import { db } from "../lib/db";
import type { Question, QuestionBank } from "../types";

const typeLabels: Record<string, string> = {
  single_choice: "单选题",
  multiple_choice: "多选题",
  true_false: "判断题",
  short_answer: "简答题",
};
const typeOrder = ["single_choice", "multiple_choice", "true_false", "short_answer"];

export default function Favorites() {
  const navigate = useNavigate();
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [favData, setFavData] = useState<Map<number, Map<string, Question[]>>>(new Map());
  const [total, setTotal] = useState(0);

  const loadFavs = async () => {
    const allBanks = await db.questionBanks.toArray();
    setBanks(allBanks);

    const favs = await db.favorites.toArray();
    const map = new Map<number, Map<string, Question[]>>();
    let t = 0;

    for (const f of favs) {
      const q = await db.questions.get(f.questionId);
      if (!q) continue;
      if (!map.has(q.bankId)) map.set(q.bankId, new Map());
      const byType = map.get(q.bankId)!;
      if (!byType.has(q.type)) byType.set(q.type, []);
      byType.get(q.type)!.push(q);
      t++;
    }
    setTotal(t);
    setFavData(map);
  };

  useEffect(() => { loadFavs(); }, []);

  const removeFav = async (questionId: number, bankId: number) => {
    const f = await db.favorites.where({ questionId, bankId }).first();
    if (f) {
      await db.favorites.delete(f.id!);
      loadFavs();
    }
  };

  if (total === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-16 animate-fade-in">
        <Heart size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
        <h2 className="text-xl font-bold mb-2">还没有收藏</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">答题时点击心形图标收藏题目</p>
        <button onClick={() => navigate("/")} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">返回首页</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/")} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"><ArrowLeft size={20} /></button>
        <div>
          <h2 className="text-xl font-bold">收藏夹</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">共 {total} 题</p>
        </div>
      </div>

      <div className="space-y-6">
        {banks.map((b) => {
          const byType = favData.get(b.id!);
          if (!byType) return null;
          const bankTotal = [...byType.values()].reduce((s, qs) => s + qs.length, 0);

          return (
            <div key={b.id}>
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={16} className="text-indigo-500" />
                <h3 className="font-semibold text-lg">{b.name}</h3>
                <span className="text-xs text-slate-400">{bankTotal} 题</span>
              </div>
              <div className="space-y-3">
                {typeOrder.map((type) => {
                  const qs = byType.get(type);
                  if (!qs || qs.length === 0) return null;
                  return (
                    <div key={type}>
                      <p className="text-xs font-medium text-slate-500 mb-1.5 ml-1">{typeLabels[type]} × {qs.length}</p>
                      <div className="grid gap-2">
                        {qs.map((q) => (
                          <div key={q.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:border-pink-300 dark:hover:border-pink-700 transition-colors">
                            <div className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm leading-relaxed line-clamp-3">{q.stem}</p>
                                <div className="mt-2 flex items-center gap-2">
                                  <span className="text-xs text-slate-500">答案: {q.answer}</span>
                                </div>
                              </div>
                              <button onClick={() => removeFav(q.id!, q.bankId)} className="p-1.5 text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-lg shrink-0" title="取消收藏">
                                <Heart size={16} fill="currentColor" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
