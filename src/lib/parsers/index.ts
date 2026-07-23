import { parseMarkdown, type ParsedQuestion } from "./mdParser";
import { parseJSON } from "./jsonParser";
import { parseCSV } from "./csvParser";
import { parseXlsx } from "./xlsxParser";
import * as XLSX from "xlsx";
import type { Question, QuestionType } from "../../types";

export type { ParsedQuestion } from "./mdParser";

export function parseFile(
  content: string | ArrayBuffer,
  fileName: string
): ParsedQuestion[] {
  const name = fileName.toLowerCase();
  const ext = name.split(".").pop() || "";

  if (ext === "md" || ext === "markdown") {
    return parseMarkdown(content as string);
  }

  if (ext === "json") {
    return parseJSON(content as string);
  }

  if (ext === "csv") {
    return parseCSV(content as string);
  }

  if (ext === "xlsx" || ext === "xls") {
    const workbook = XLSX.read(content, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, {
      header: 1,
    }) as any[][];
    return parseXlsx(data);
  }

  return [];
}

export function parsedToQuestions(
  parsed: ParsedQuestion[],
  bankId: number
): Omit<Question, "id">[] {
  const now = Date.now();
  return parsed
    .filter((q) => q.stem.trim())
    .map((q, index) => {
      let type: QuestionType = q.type;

      if (type === "true_false" && q.options.length === 0) {
        q.options = ["正确（√）", "错误（×）"];
      }

      if (
        type === "short_answer" ||
        (q.options.length === 0 &&
          type === "single_choice")
      ) {
        type = "short_answer";
      }

      if (
        type === "true_false" &&
        q.answer.match(/^[√✓]/)
      ) {
        q.answer = "正确";
      } else if (
        type === "true_false" &&
        q.answer.match(/^[×✗]/)
      ) {
        q.answer = "错误";
      }

      return {
        bankId,
        type,
        category: q.category || "默认分类",
        stem: q.stem,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        order: index,
        createdAt: now,
      };
    });
}
