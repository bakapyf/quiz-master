import { parseMarkdown } from "../src/lib/parsers/mdParser.js";
import fs from "fs";

const files = [
  "输电线路基础知识竞赛题库_第一次培训.md",
  "deepseek_markdown_20260722_3f6cef.md",
  "Qwen_markdown_20260722_rrxdsf7f9.md",
];

const seen = new Map();
const all = [];

for (const f of files) {
  const content = fs.readFileSync(f, "utf-8");
  for (const q of parseMarkdown(content)) {
    const key = q.stem.replace(/[（\s）]/g, "").substring(0, 25);
    if (!seen.has(key)) {
      seen.set(key, true);
      all.push(q);
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
  const qs = all.filter((q) => q.type === type);
  if (qs.length === 0) continue;
  output += `## ${typeNames[type]}\n\n`;
  qs.forEach((q, i) => {
    output += `${i + 1}. ${q.stem.replace(/\n/g, " ")}\n`;
    for (const opt of q.options) output += `   ${opt}\n`;
    output += `   **答案：${q.answer}**\n`;
    if (q.explanation) output += `   **解析：** ${q.explanation.replace(/\n/g, " ")}\n`;
    output += "\n";
  });
}

fs.writeFileSync("第一次培训.md", output, "utf-8");
const total = all.length;
console.log(`${total} 题`);
for (const type of typeOrder) {
  const n = all.filter((q) => q.type === type).length;
  if (n > 0) console.log(`  ${typeNames[type]}: ${n}`);
}
