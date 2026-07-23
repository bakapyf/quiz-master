import fs from "fs";
import { parseMarkdown } from "../src/lib/parsers/mdParser";

const files = [
  "输电线路基础知识竞赛题库_第一次培训.md",
  "deepseek_markdown_20260722_3f6cef.md",
  "Qwen_markdown_20260722_rrxdsf7f9.md",
];

const seen = new Set();
const allQuestions = [];

for (const f of files) {
  const content = fs.readFileSync(f, "utf-8");
  const questions = parseMarkdown(content);
  for (const q of questions) {
    const key = q.stem.replace(/[（\s）]/g, "").substring(0, 30);
    if (!seen.has(key)) {
      seen.add(key);
      allQuestions.push(q);
    }
  }
}

const typeOrder = ["single_choice", "multiple_choice", "true_false", "short_answer"];
const typeNames = {
  single_choice: "单选题",
  multiple_choice: "多选题",
  true_false: "判断题",
  short_answer: "简答题",
};

let output = "# 第一次培训\n\n";

for (const type of typeOrder) {
  const qs = allQuestions.filter((q) => q.type === type);
  if (qs.length === 0) continue;
  const count = qs.length;
  output += `## \u4e00${"、"}${typeNames[type]}（共${count}题）\n\n`;
  qs.forEach((q, i) => {
    const stem = q.stem.replace(/\n/g, " ");
    output += `${i + 1}. ${stem}\n`;
    for (const opt of q.options) {
      output += `   ${opt}\n`;
    }
    output += `   **\u7b54\u6848\uff1a${q.answer}**\n`;
    if (q.explanation) {
      output += `   **\u89e3\u6790\uff1a** ${q.explanation.replace(/\n/g, " ")}\n`;
    }
    output += "\n";
  });
}

output += "---\n> \u7531 Quiz Master \u81ea\u52a8\u5408\u5e76\u751f\u6210\n";

const outPath = "第一次培训.md";
fs.writeFileSync(outPath, output, "utf-8");
console.log("合并完成:", allQuestions.length, "题 ->", outPath);
for (const type of typeOrder) {
  const count = allQuestions.filter((q) => q.type === type).length;
  if (count > 0) console.log("  ", typeNames[type] + ":", count);
}
