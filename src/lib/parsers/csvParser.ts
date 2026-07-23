import type { ParsedQuestion } from "./mdParser";
import type { QuestionType } from "../../types";

function normalizeType(raw: string): QuestionType {
  const t = raw.trim().toLowerCase();
  if (t.includes("多选")) return "multiple_choice";
  if (t.includes("判断")) return "true_false";
  if (t.includes("简答") || t.includes("填空")) return "short_answer";
  return "single_choice";
}

export function parseCSV(content: string): ParsedQuestion[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase();
  const hasType = header.includes("type") || header.includes("题型");
  const hasCategory = header.includes("category") || header.includes("分类");
  const hasOptions = header.includes("option") || header.includes("选项");
  const hasExplanation =
    header.includes("explanation") || header.includes("解析");

  const questions: ParsedQuestion[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 3) continue;

    const q: ParsedQuestion = {
      type: hasType ? normalizeType(cols[hasCategory ? 1 : 0]) : "single_choice",
      category: hasCategory ? cols[hasType ? 1 : 0] || "默认分类" : "默认分类",
      stem: cols[hasType ? (hasCategory ? 2 : 1) : 0] || "",
      options: [],
      answer: "",
      explanation: "",
    };

    let optIdx = 0;
    if (hasOptions) {
      const optStart = hasType && hasCategory ? 2 : hasType || hasCategory ? 1 : 0;
      const optCount = Math.min(4, cols.length - optStart - 2);
      for (let j = 0; j < optCount; j++) {
        if (cols[optStart + j]) {
          q.options.push(String.fromCharCode(65 + j) + ". " + cols[optStart + j]);
        }
      }
      optIdx = optStart + 4;
    } else {
      optIdx = hasType && hasCategory ? 4 : hasType || hasCategory ? 3 : 2;
    }

    q.answer = cols[optIdx] || cols[cols.length - 2] || "";
    q.explanation = cols[optIdx + 1] || cols[cols.length - 1] || "";

    if (
      q.type === "single_choice" &&
      q.options.length > 0 &&
      q.answer.length > 1
    ) {
      q.type = "multiple_choice";
    }

    questions.push(q);
  }

  return questions;
}
