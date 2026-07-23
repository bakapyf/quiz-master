import fs from "fs";

const content = fs.readFileSync("第一次培训.md", "utf-8");
const lines = content.split("\n");

const sections = [];
let currentSection = "";
let currentStart = 0;

for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^##\s+(.+)$/);
  if (m) {
    if (currentSection) sections.push({ name: currentSection, start: currentStart, end: i });
    currentSection = m[1];
    currentStart = i;
  }
}
sections.push({ name: currentSection, start: currentStart, end: lines.length });

// Parse questions per section
const result = [];
const toMulti = [];

for (const sec of sections) {
  if (sec.name.startsWith("##")) continue;
  const secName = sec.name.replace(/^[一二三四五六七八九十]+[、.]?\s*/, "").trim();
  const secLines = lines.slice(sec.start, sec.end);
  const qs = [];
  let current = null;

  for (const line of secLines) {
    if (line.match(/^\d+\.\s/)) {
      if (current) qs.push(current);
      current = { stem: line.replace(/^\d+\.\s*/, ""), options: [], answer: "", explanation: "" };
    } else if (current) {
      const optMatch = line.match(/^\s{3}([A-H])\.\s(.+)/);
      const ansMatch = line.match(/^\s{3}\*\*答案[：:](.+)\*\*/);
      const expMatch = line.match(/^\s{3}\*\*解析[：:](.+)/);
      if (optMatch) current.options.push(`${optMatch[1]}. ${optMatch[2]}`);
      else if (ansMatch) current.answer = ansMatch[1].trim();
      else if (expMatch) current.explanation = expMatch[1].trim();
    }
  }
  if (current) qs.push(current);

  const kept = [];
  for (const q of qs) {
    if (!q.answer) continue; // remove empty answer
    // Check if answer has comma (multiple choice in single-choice section)
    if (secName.includes("单选") && q.answer.includes(",")) {
      toMulti.push(q);
      continue;
    }
    kept.push(q);
  }

  // Rebuild section
  result.push(`## ${sec.name}`);
  result.push("");
  if (kept.length > 0) {
    kept.forEach((q, i) => {
      result.push(`${i + 1}. ${q.stem}`);
      for (const opt of q.options) result.push(`   ${opt}`);
      result.push(`   **答案：${q.answer}**`);
      if (q.explanation) result.push(`   **解析：** ${q.explanation}`);
      result.push("");
    });
  }
}

// Add moved multi-choice questions
if (toMulti.length > 0) {
  // Find or create 多选题 section
  const multiIdx = result.findIndex((l) => l.includes("多选题"));
  if (multiIdx === -1) {
    result.push("## 二、多选题");
    result.push("");
  }
  // Get existing multi count
  let multiCount = 0;
  for (const l of result) {
    const m = l.match(/^(\d+)\.\s/);
    if (m) multiCount = Math.max(multiCount, parseInt(m[1]));
  }
  toMulti.forEach((q, i) => {
    result.push(`${multiCount + i + 1}. ${q.stem}`);
    for (const opt of q.options) result.push(`   ${opt}`);
    result.push(`   **答案：${q.answer}**`);
    if (q.explanation) result.push(`   **解析：** ${q.explanation}`);
    result.push("");
  });
}

fs.writeFileSync("第一次培训.md", result.join("\n"), "utf-8");
console.log("Done. Removed empty answers, fixed multi-choice questions.");
