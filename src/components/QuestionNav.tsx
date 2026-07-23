import { useState } from "react";
import { List, X } from "lucide-react";

const typeLabels: Record<string, string> = {
  single_choice: "单选",
  multiple_choice: "多选",
  true_false: "判断",
  short_answer: "简答",
};

const typeOrder = ["single_choice", "multiple_choice", "true_false", "short_answer"];
const typeColors: Record<string, string> = {
  single_choice: "border-l-blue-400",
  multiple_choice: "border-l-purple-400",
  true_false: "border-l-amber-400",
  short_answer: "border-l-emerald-400",
};

interface QuestionNavProps {
  total: number;
  currentIndex: number;
  answers: Map<number, string>;
  questions: Array<{ id?: number; type?: string }>;
  onJump: (index: number) => void;
}

export default function QuestionNav({
  total,
  currentIndex,
  answers,
  questions,
  onJump,
}: QuestionNavProps) {
  const [open, setOpen] = useState(false);

  if (total <= 1) return null;

  const groups = typeOrder
    .map((type) => {
      const indices: number[] = [];
      questions.forEach((q, i) => {
        if (q.type === type || (!q.type && type === "single_choice")) indices.push(i);
      });
      return { type, indices, label: typeLabels[type] || type };
    })
    .filter((g) => g.indices.length > 0);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed right-4 top-24 z-30 p-2.5 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        title="题目导航"
      >
        <List size={18} />
        <span
          className="absolute -top-1.5 -right-1.5 text-[10px] bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold"
          style={{ width: "18px", height: "18px" }}
        >
          {answers.size}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-t-xl sm:rounded-xl w-full sm:w-auto min-w-[320px] max-w-lg mx-0 sm:mx-4 max-h-[65vh] sm:max-h-[75vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-slate-900 px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between z-10">
              <span className="text-sm font-medium">
                答题卡（{answers.size}/{total}）
              </span>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {groups.map((group) => {
                return (
                  <div key={group.type}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{group.label}</span>
                      <span className="text-[10px] text-slate-400">{group.indices.length}题</span>
                    </div>
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
                      {group.indices.map((idx, gi) => {
                        const q = questions[idx];
                        const answered = answers.has(q.id!);
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              onJump(idx);
                              setOpen(false);
                            }}
                            className={`w-9 h-9 rounded-lg text-xs font-medium flex items-center justify-center transition-colors ${
                              idx === currentIndex
                                ? "ring-2 ring-indigo-500"
                                : ""
                            } ${
                              answered
                                ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {gi + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center gap-4 pt-2 text-xs text-slate-500 border-t border-slate-200 dark:border-slate-700">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-indigo-100 dark:bg-indigo-900/40" /> 已答
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-800" /> 未答
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
