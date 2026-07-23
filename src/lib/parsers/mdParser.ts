import type { QuestionType } from "../../types";

export interface ParsedQuestion {
  type: QuestionType;
  category: string;
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
}

function detectType(sectionTitle: string): QuestionType {
  const t = sectionTitle.toLowerCase();
  if (t.includes("单选") || t.includes("single") || t.includes("单项"))
    return "single_choice";
  if (t.includes("多选") || t.includes("multiple")) return "multiple_choice";
  if (t.includes("判断") || t.includes("true") || t.includes("正确") || t.includes("错误"))
    return "true_false";
  if (t.includes("简答") || t.includes("short") || t.includes("填空"))
    return "short_answer";
  return "single_choice";
}

function extractAnswer(raw: string): string {
  return raw
    .replace(/\*\*答案[：:]\s*\*\*?/g, "")
    .replace(/\*\*【答案】\s*\*\*?/g, "")
    .replace(/【答案】\s*/g, "")
    .replace(/答案[：:]\s*/g, "")
    .replace(/^[\*\s]+/, "")
    .replace(/[\*\s]+$/, "")
    .replace(/（√）|\(√\)/, "√")
    .replace(/（×）|\(×\)/, "×")
    .trim();
}

function extractExplanation(raw: string): string {
  return raw
    .replace(/\*\*解析[：:]\s*\*\*?/g, "")
    .replace(/\*\*【解析】\s*\*\*?/g, "")
    .replace(/【解析】\s*/g, "")
    .replace(/\*\*参考答案?\*\*/g, "")
    .replace(/解析[：:]\s*/g, "")
    .trim();
}

interface DetailBlock {
  answer: string;
  explanation: string;
}

function extractDetailsBlocks(lines: string[]): DetailBlock[] {
  const blocks: DetailBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === "<details>" || line.startsWith("<details>")) {
      let detailContent = "";
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("</details>")) {
        detailContent += lines[i] + "\n";
        i++;
      }

      // Extract answer: look for 答案：X pattern in various markdown formats
      let answer = "";
      const ansMatch = detailContent.match(/答案[：:]\s*(.+?)(?:\*\*)?\s*$/m);
      if (ansMatch) {
        answer = ansMatch[1].replace(/\*+/g, "").trim();
      }

      // Extract explanation
      let explanation = "";
      const expSection = detailContent.match(/\*\*解析[：:]([\s\S]*?)$/);
      if (expSection) {
        explanation = expSection[1].replace(/\*\*/g, "").trim();
      }

      blocks.push({ answer, explanation });
    }
    i++;
  }

  return blocks;
}

interface QuestionBlock {
  stem: string;
  options: string[];
}

function parseQuestionsWithoutDetails(lines: string[]): QuestionBlock[] {
  const questions: QuestionBlock[] = [];
  let currentStem: string[] = [];
  let currentOptions: string[] = [];
  let inQuestion = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line === "<details>" || line.startsWith("<details>")) {
      while (i < lines.length && !lines[i].trim().startsWith("</details>")) {
        i++;
      }
      continue;
    }

    const questionStart = line.match(
      /^(\*\*)?(\d+)[\.\)、](\*\*)?\s*/
    );

    const optionMatch = line.match(/^([A-H])[\.\)、]\s*(.+)/);

    const isOptionLine =
      line.startsWith("A.") ||
      line.startsWith("A)") ||
      line.startsWith("A、") ||
      (optionMatch && inQuestion);

    if (questionStart && !isOptionLine) {
      if (inQuestion) {
        questions.push({
          stem: currentStem.join("\n").trim(),
          options: [...currentOptions],
        });
      }

      const rest = line.slice(questionStart[0].length).replace(/\*\*/g, "").trim();
      currentStem = [rest];
      currentOptions = [];
      inQuestion = true;
    } else if (optionMatch && inQuestion) {
      currentOptions.push(optionMatch[1] + ". " + optionMatch[2].trim());
    } else if (inQuestion) {
      const inlineAnswer =
        /^\*\*答案[：:]/.test(line) ||
        /^【答案】/.test(line) ||
        /^\*\*【答案】\*\*/.test(line);
      const inlineExplanation =
        /^\*\*解析[：:]/.test(line) ||
        /^【解析】/.test(line) ||
        /^\*\*【解析】\*\*/.test(line);

      if (
        inlineAnswer ||
        inlineExplanation ||
        line.startsWith("#") ||
        line.startsWith("-") ||
        line.startsWith(">") ||
        line.startsWith("|") ||
        line.startsWith("---")
      ) {
        continue;
      }

      if (/^[A-H][\.\)、]/.test(line)) {
        continue;
      }

      currentStem.push(line.replace(/\*\*/g, ""));
    }
  }

  if (inQuestion) {
    questions.push({
      stem: currentStem.join("\n").trim(),
      options: [...currentOptions],
    });
  }

  return questions;
}

interface InlineAnswer {
  answer: string;
  explanation: string;
}

function extractInlineAnswers(lines: string[]): InlineAnswer[] {
  const answers: InlineAnswer[] = [];
  let currentAnswer = "";
  let currentExplanation = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for inline answer patterns
    const ansMatch1 = line.match(/^\*\*答案[：:]\s*([^*]+)/);
    const ansMatch2 = line.match(/^\*\*【答案】\s*\*\*?\s*([^*]+)/);
    const ansMatch3 = line.match(/^【答案】\s*(.+?)\s*$/);

    if (ansMatch1 || ansMatch2 || ansMatch3) {
      const ans = (ansMatch1 || ansMatch2 || ansMatch3)![1].replace(/\*+$/, "").trim();
      if (currentAnswer) {
        answers.push({ answer: currentAnswer, explanation: currentExplanation });
        currentExplanation = "";
      }
      currentAnswer = ans;
      continue;
    }

    // Check for inline answer without ** wrapping
    const ansMatch4 = line.match(/^答案[：:]\s*(.+?)\s*$/);
    if (ansMatch4 && !ansMatch4[1].includes("*")) {
      const ans = extractAnswer(ansMatch4[1]);
      if (currentAnswer) {
        answers.push({ answer: currentAnswer, explanation: currentExplanation });
        currentExplanation = "";
      }
      currentAnswer = ans;
      continue;
    }

    // Check for explanation lines (including 参考答案)
    const expMatch1 = line.match(/^\*\*解析[：:]\s*\*\*?\s*(.+)/);
    const expMatch2 = line.match(/^\*\*【解析】\s*\*\*?\s*(.+)/);
    const expMatch3 = line.match(/^【解析】\s*(.+)/);
    const expMatch4 = line.match(/^\*\*参考答案?\*\*[：:]?\s*(.+)/);
    const expMatch5 = line.match(/^【参考答案】[：:]?\s*(.+)/);

    if (expMatch1 || expMatch2 || expMatch3 || expMatch4 || expMatch5) {
      currentExplanation = (expMatch1 || expMatch2 || expMatch3 || expMatch4 || expMatch5)![1].trim();
      if (currentAnswer) {
        answers.push({ answer: currentAnswer, explanation: currentExplanation });
        currentAnswer = "";
        currentExplanation = "";
      }
      continue;
    }

    // Collect multi-line explanation
    if (currentExplanation && line && !line.startsWith("#") && !line.startsWith("-") && !line.startsWith("*")) {
      currentExplanation += "\n" + line;
    }
  }

  // Flush remaining
  if (currentAnswer || currentExplanation) {
    answers.push({ answer: currentAnswer, explanation: currentExplanation });
  }

  return answers;
}

function hasDetailsTags(lines: string[]): boolean {
  return lines.some((l) => l.trim() === "<details>" || l.trim().startsWith("<details>"));
}
export function parseMarkdown(content: string): ParsedQuestion[] {
  let text = content;
  text = text.replace(/---+/g, "");
  text = text.replace(/<br\s*\/?>/gi, "\n");

  const lines = text.split("\n");

  const sections: {
    title: string;
    startLine: number;
    endLine: number;
    type: QuestionType;
  }[] = [];

  let currentSectionTitle = "默认分类";
  let currentStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const sectionMatch = line.match(
      /^##\s*(?:[一二三四五六七八九十]+[、.]?\s*)?(.+?)(?:（[^）]*）)?$/
    );
    if (sectionMatch) {
      if (i > currentStart) {
        sections.push({
          title: currentSectionTitle,
          startLine: currentStart,
          endLine: i,
          type: detectType(currentSectionTitle),
        });
      }
      currentSectionTitle = sectionMatch[1].trim();
      currentStart = i + 1;
    }
  }

  sections.push({
    title: currentSectionTitle,
    startLine: currentStart,
    endLine: lines.length,
    type: detectType(currentSectionTitle),
  });

  const allQuestions: ParsedQuestion[] = [];

  for (const section of sections) {
    const sectionLines = lines.slice(section.startLine, section.endLine);

    const usesDetails = hasDetailsTags(sectionLines);
    const questionBlocks = parseQuestionsWithoutDetails(sectionLines);

    let answerBlocks: (DetailBlock | InlineAnswer)[];
    if (usesDetails) {
      answerBlocks = extractDetailsBlocks(sectionLines);
    } else {
      answerBlocks = extractInlineAnswers(sectionLines);
    }

    for (let qi = 0; qi < questionBlocks.length; qi++) {
      const qb = questionBlocks[qi];
      const ab = answerBlocks[qi];

      const q: ParsedQuestion = {
        type: section.type,
        category: section.title,
        stem: qb.stem,
        options: qb.options,
        answer: ab?.answer || "",
        explanation: ab?.explanation || "",
      };

      if (q.type === "true_false" && q.options.length === 0) {
        q.options = ["A. 正确（√）", "B. 错误（×）"];
      }

      allQuestions.push(q);
    }
  }

  return allQuestions;
}
