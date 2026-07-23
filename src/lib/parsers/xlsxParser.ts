import type { ParsedQuestion } from "./mdParser";
import type { QuestionType } from "../../types";

function normalizeType(raw: string): QuestionType {
  const t = raw.trim().toLowerCase();
  if (t.includes("多选")) return "multiple_choice";
  if (t.includes("判断")) return "true_false";
  if (t.includes("简答") || t.includes("填空")) return "short_answer";
  return "single_choice";
}

function colIdx(arr: string[], ...names: string[]): number {
  return arr.findIndex((n) =>
    names.some((name) => n.toLowerCase().includes(name.toLowerCase()))
  );
}

export function parseXlsx(data: any[][]): ParsedQuestion[] {
  if (!data || data.length < 2) return [];

  const header = data[0].map((h) => String(h || "").toLowerCase());
  const typeIdx = colIdx(header, "type", "题型", "类型");
  const catIdx = colIdx(header, "category", "分类", "类别");
  const stemIdx = colIdx(header, "stem", "question", "题目", "题干");
  const optAIdx = colIdx(header, "a", "选项a", "选项A");
  const optBIdx = colIdx(header, "b", "选项b", "选项B");
  const optCIdx = colIdx(header, "c", "选项c", "选项C");
  const optDIdx = colIdx(header, "d", "选项d", "选项D");
  const ansIdx = colIdx(header, "answer", "答案");
  const expIdx = colIdx(header, "explanation", "解析", "analysis");

  const questions: ParsedQuestion[] = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i].map((cell) => String(cell || ""));
    if (row.every((c) => !c.trim())) continue;

    const q: ParsedQuestion = {
      type: typeIdx >= 0 ? normalizeType(row[typeIdx]) : "single_choice",
      category: catIdx >= 0 ? row[catIdx] || "默认分类" : "默认分类",
      stem: stemIdx >= 0 ? row[stemIdx] : row[0] || "",
      options: [],
      answer: ansIdx >= 0 ? row[ansIdx] || "" : (row.length > 1 ? row[row.length - 2] || "" : ""),
      explanation: expIdx >= 0 ? row[expIdx] || "" : (row.length > 0 ? row[row.length - 1] || "" : ""),
    };

    const optIndices = [optAIdx, optBIdx, optCIdx, optDIdx].filter(
      (idx) => idx >= 0
    );
    if (optIndices.length > 0) {
      for (let j = 0; j < optIndices.length; j++) {
        const val = row[optIndices[j]];
        if (val) {
          q.options.push(String.fromCharCode(65 + j) + ". " + val);
        }
      }
    }

    if (
      q.type === "single_choice" &&
      q.options.length > 0 &&
      q.answer.length > 1 &&
      !q.answer.match(/^[A-Da-d]$/)
    ) {
      q.type = "multiple_choice";
    }

    questions.push(q);
  }

  return questions;
}
