import Dexie, { Table } from "dexie";
import type {
  Question,
  QuestionBank,
  QuizRecord,
  ExamSession,
  Favorite,
} from "../types";

export function notifyDataChanged() {
  if (typeof window !== "undefined") {
    const v = parseInt(localStorage.getItem("quiz-data-version") || "0") + 1;
    localStorage.setItem("quiz-data-version", String(v));
    window.dispatchEvent(new CustomEvent("quiz-data-changed"));
  }
}

class QuizDatabase extends Dexie {
  questionBanks!: Table<QuestionBank, number>;
  questions!: Table<Question, number>;
  quizRecords!: Table<QuizRecord, number>;
  examSessions!: Table<ExamSession, number>;
  favorites!: Table<Favorite, number>;

  constructor() {
    super("QuizMasterDB");
    this.version(1).stores({
      questionBanks: "++id, name, createdAt",
      questions: "++id, bankId, type, order",
      quizRecords: "++id, questionId, bankId, timestamp, mode",
      examSessions: "++id, bankId, startedAt",
      favorites: "++id, questionId, bankId",
    });
  }

  async getWrongQuestionIds(bankId?: number): Promise<number[]> {
    let records: QuizRecord[];
    if (bankId) {
      records = await this.quizRecords.where({ bankId }).toArray();
    } else {
      records = await this.quizRecords.toArray();
    }
    const wrongRecords = records.filter((r) => !r.isCorrect);
    const uniqueIds = [...new Set(wrongRecords.map((r) => r.questionId))];
    return uniqueIds;
  }

  async getBankProgress(bankId: number): Promise<{
    totalAnswered: number;
    correctCount: number;
  }> {
    const records = await this.quizRecords.where({ bankId }).toArray();
    const distinctQuestionIds = new Set(records.map((r) => r.questionId));
    const latestByQuestion = new Map<number, boolean>();
    for (const r of records) {
      latestByQuestion.set(r.questionId!, r.isCorrect);
    }
    const correctCount = [...latestByQuestion.values()].filter(Boolean).length;
    return {
      totalAnswered: distinctQuestionIds.size,
      correctCount,
    };
  }
}

export const db = new QuizDatabase();
