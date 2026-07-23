import fs from "fs";

const inputFile = process.argv[2];
if (!inputFile) {
  console.log("Usage: node scripts/convert-md.mjs <input.md>");
  process.exit(1);
}

const content = fs.readFileSync(inputFile, "utf-8");
const lines = content.split("\n");
const output = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();

  // Section header
  const sectionMatch = line.match(
    /^##\s*[一二三四五六七八九十]+[、.]?\s*(.+?)(?:（[^）]*）)?$/
  );
  if (sectionMatch) {
    output.push(`## ${sectionMatch[1].trim()}`);
    continue;
  }

  // Question start: **N. stem**
  const qMatch = line.match(/^\*\*(\d+)\.\s*(.+?)\*\*$/);
  if (qMatch) {
    output.push(`\n${qMatch[1]}. ${qMatch[2]}`);
    continue;
  }

  // Multi-line question start
  const qMatch2 = line.match(/^\*\*(\d+)\.(.+)$/);
  if (qMatch2) {
    const stem = qMatch2[2].replace(/\*\*/g, "").trim();
    output.push(`\n${qMatch2[1]}. ${stem}`);
    continue;
  }

  // Options
  const optMatch = line.match(/^([A-H])[\.\)、]\s*(.+)/);
  if (optMatch) {
    output.push(`   ${optMatch[1]}. ${optMatch[2].trim()}`);
    continue;
  }

  // Details block - extract answer and explanation
  if (line === "<details>") {
    let detailContent = "";
    i++;
    while (i < lines.length && !lines[i].trim().startsWith("</details>")) {
      detailContent += lines[i] + "\n";
      i++;
    }

    const ansMatch = detailContent.match(/答案[：:]\s*(.+?)(?:\*\*|$)/m);
    const expMatch = detailContent.match(/解析[：:]\s*([\s\S]+?)$/);

    if (ansMatch) {
      const ans = ansMatch[1].trim().replace(/\*+$/, "").trim();
      output.push(`   **答案：${ans}**`);
    }
    if (expMatch) {
      const exp = expMatch[1].trim().replace(/\*\*/g, "");
      output.push(`   **解析：** ${exp}`);
    }
    continue;
  }

  // Metadata lines to skip
  if (
    line.startsWith(">") ||
    line.startsWith("---") ||
    line.startsWith("**考") ||
    line.startsWith("**答") ||
    line.startsWith("**解")
  ) {
    continue;
  }
}

const outputPath = inputFile.replace(/\.md$/, "_converted.md");
fs.writeFileSync(outputPath, output.join("\n"), "utf-8");
console.log("Converted:", outputPath);
console.log("Please import the _converted.md file instead.");
