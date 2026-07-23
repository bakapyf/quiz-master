import type { ParsedQuestion } from "./mdParser";

export function parseJSON(content: string): ParsedQuestion[] {
  const data = JSON.parse(content);
  const questions: ParsedQuestion[] = [];
  const items = Array.isArray(data) ? data : data.questions || [];

  for (const item of items) {
    questions.push({
      type: item.type || "single_choice",
      category: item.category || "默认分类",
      stem: item.stem || item.question || "",
      options: Array.isArray(item.options) ? item.options : [],
      answer: String(item.answer || "").trim(),
      explanation: item.explanation || item.analysis || "",
    });
  }

  return questions;
}
