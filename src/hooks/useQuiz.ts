import { useState, useCallback, useEffect } from "react";
import type { Question, QuizConfig } from "../types";
import { db, notifyDataChanged } from "../lib/db";

export interface QuizState {
  questions: Question[];
  currentIndex: number;
  answers: Map<number, string>;
  isFinished: boolean;
  mode: QuizConfig["mode"];
  startTime: number;
}

export function useQuiz(bankId: number, config: QuizConfig) {
  const [state, setState] = useState<QuizState>({
    questions: [],
    currentIndex: 0,
    answers: new Map(),
    isFinished: false,
    mode: config.mode,
    startTime: Date.now(),
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      let questions = await db.questions
        .where({ bankId })
        .sortBy("order");

      if (config.mode === "random") {
        for (let i = questions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [questions[i], questions[j]] = [questions[j], questions[i]];
        }
      }

      if (config.questionCount && config.questionCount < questions.length) {
        questions = questions.slice(0, config.questionCount);
      }

      setState((s) => ({ ...s, questions }));
      setLoading(false);
    })();
  }, [bankId, config.mode, config.questionCount]);

  const currentQuestion = state.questions[state.currentIndex];
  const isLastQuestion = state.currentIndex >= state.questions.length - 1;

  const answerQuestion = useCallback(
    async (userAnswer: string) => {
      if (!currentQuestion) return;

      const newAnswers = new Map(state.answers);
      newAnswers.set(currentQuestion.id!, userAnswer);

      let isCorrect = false;
      if (currentQuestion.type === "multiple_choice") {
        const correctSet = new Set(
          currentQuestion.answer
            .replace(/[A-H]/g, "")
            .split("")
            .filter((s) => s.trim())
            .map((s) => s.trim().toUpperCase())
        );
        const userSet = new Set(
          userAnswer
            .replace(/[A-H]/g, "")
            .split("")
            .filter((s) => s.trim())
            .map((s) => s.trim().toUpperCase())
        );
        isCorrect =
          correctSet.size === userSet.size &&
          [...correctSet].every((c) => userSet.has(c));
      } else if (currentQuestion.type === "short_answer") {
        isCorrect = true;
      } else {
        const correct = currentQuestion.answer.replace(/[A-H]\./, "").trim();
        const user = userAnswer.replace(/[A-H]\./, "").trim();
        isCorrect = user.toLowerCase() === correct.toLowerCase();
      }

      await db.quizRecords.add({
        questionId: currentQuestion.id!,
        bankId,
        userAnswer,
        isCorrect,
        timestamp: Date.now(),
        mode: config.mode,
      });

      notifyDataChanged();

      if (isLastQuestion) {
        setState((s) => ({ ...s, answers: newAnswers, isFinished: true }));
      } else {
        setState((s) => ({
          ...s,
          answers: newAnswers,
          currentIndex: s.currentIndex + 1,
        }));
      }
    },
    [currentQuestion, state.answers, state.currentIndex, isLastQuestion, bankId, config.mode]
  );

  const goToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < state.questions.length) {
      setState((s) => ({ ...s, currentIndex: index }));
    }
  }, [state.questions.length]);

  const toggleFavorite = useCallback(
    async (questionId: number) => {
      const existing = await db.favorites
        .where({ questionId, bankId })
        .first();
      if (existing) {
        await db.favorites.delete(existing.id!);
      } else {
        await db.favorites.add({
          questionId,
          bankId,
          timestamp: Date.now(),
        });
      }
    },
    [bankId]
  );

  const isFavorite = useCallback(
    async (questionId: number): Promise<boolean> => {
      const f = await db.favorites.where({ questionId, bankId }).first();
      return !!f;
    },
    [bankId]
  );

  const getScore = useCallback(async (): Promise<{
    total: number;
    correct: number;
    score: number;
  }> => {
    const records = await db.quizRecords
      .where({ bankId, mode: state.mode })
      .toArray();
    const recent = new Map<number, boolean>();
    for (const r of records) {
      recent.set(r.questionId!, r.isCorrect);
    }
    const correct = [...recent.values()].filter(Boolean).length;
    return {
      total: state.questions.length,
      correct,
      score: Math.round((correct / state.questions.length) * 100),
    };
  }, [bankId, state.mode, state.questions.length]);

  return {
    state,
    loading,
    currentQuestion,
    isLastQuestion,
    answerQuestion,
    goToQuestion,
    toggleFavorite,
    isFavorite,
    getScore,
  };
}
