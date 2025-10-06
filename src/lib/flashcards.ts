export type Flashcard = {
  id: string;
  question: string;
  answer: string;
  learned: boolean;
};

export type ParsedFlashcard = {
  question: string;
  answer: string;
};

export type FlashcardSet = {
  id: string;
  name: string;
  importedAt: string;
  cards: Flashcard[];
};

export const STORAGE_KEY = "flashcard-app:sets";
export const LEGACY_STORAGE_KEY = "flashcard-app:cards";

export function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 11);
}

export function canonicalKey(question: string, answer: string): string {
  return `${question.trim().toLowerCase()}::${answer.trim().toLowerCase()}`;
}

export function parseFlashcards(raw: string): ParsedFlashcard[] {
  if (!raw) {
    return [];
  }

  const sanitized = raw
    .replace(/\r\n?/g, "\n")
    .replace(/^\s*\d+\.\s*/gm, "")
    .trim();

  const lines = sanitized.split("\n");
  const cards: ParsedFlashcard[] = [];

  let currentQuestion: string | null = null;
  let currentAnswer: string[] = [];
  let answerStarted = false;

  const commitCard = () => {
    if (!currentQuestion || currentAnswer.length === 0) {
      return;
    }

    const question = currentQuestion.trim();
    const answer = currentAnswer.join("\n").trim();

    if (question && answer) {
      cards.push({ question, answer });
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const questionMatch = trimmed.match(/^(?:Q|Question)\s*:\s*(.+)$/i);
    const answerMatch = trimmed.match(/^(?:A|Answer)\s*:\s*(.*)$/i);

    if (questionMatch) {
      commitCard();
      currentQuestion = questionMatch[1];
      currentAnswer = [];
      answerStarted = false;
      continue;
    }

    if (answerMatch && currentQuestion) {
      currentAnswer = [answerMatch[1]];
      answerStarted = true;
      continue;
    }

    if (answerStarted) {
      currentAnswer.push(trimmed);
    }
  }

  commitCard();

  return cards;
}

export function buildFlashcardsFromParsed(parsed: ParsedFlashcard[]): Flashcard[] {
  const seen = new Set<string>();
  const cards: Flashcard[] = [];

  for (const item of parsed) {
    const question = item.question.trim();
    const answer = item.answer.trim();

    if (!question || !answer) {
      continue;
    }

    const key = canonicalKey(question, answer);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    cards.push({
      id: createId(),
      question,
      answer,
      learned: false,
    });
  }

  return cards;
}

export function hydrateStoredSets(value: string | null): FlashcardSet[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const hydrated = parsed
      .map((item: unknown) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const raw = item as Partial<FlashcardSet> & { cards?: unknown };
        const rawCards = Array.isArray(raw.cards) ? raw.cards : [];

        const cards = rawCards
          .filter((card: unknown): card is Partial<Flashcard> => !!card && typeof card === "object")
          .map((card) => ({
            id: typeof card.id === "string" ? card.id : createId(),
            question: (card.question ?? "").toString().trim(),
            answer: (card.answer ?? "").toString().trim(),
            learned: Boolean(card.learned),
          }))
          .filter((card) => card.question && card.answer);

        if (cards.length === 0) {
          return null;
        }

        const importedAt =
          typeof raw.importedAt === "string" && !Number.isNaN(Date.parse(raw.importedAt))
            ? raw.importedAt
            : new Date().toISOString();

        const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Imported PDF";

        return {
          id: typeof raw.id === "string" ? raw.id : createId(),
          name,
          importedAt,
          cards,
        } satisfies FlashcardSet;
      })
      .filter((set): set is FlashcardSet => !!set);

    return orderSets(hydrated);
  } catch (error) {
    console.error("Failed to parse stored flashcard sets", error);
    return [];
  }
}

export function migrateLegacyCards(value: string | null): FlashcardSet[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const cards = parsed
      .filter((item: unknown): item is Partial<Flashcard> => !!item && typeof item === "object")
      .map((item) => ({
        id: typeof item.id === "string" ? item.id : createId(),
        question: (item.question ?? "").toString().trim(),
        answer: (item.answer ?? "").toString().trim(),
        learned: Boolean(item.learned),
      }))
      .filter((card) => card.question && card.answer);

    if (cards.length === 0) {
      return [];
    }

    return [
      {
        id: createId(),
        name: "Imported Flashcards",
        importedAt: new Date().toISOString(),
        cards,
      },
    ];
  } catch (error) {
    console.error("Failed to migrate legacy flashcards", error);
    return [];
  }
}

export function orderSets(sets: FlashcardSet[]): FlashcardSet[] {
  return [...sets].sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
}

export function formatImportDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getSetMonogram(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "PDF";
  }

  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }

  return (tokens[0][0] + tokens[1][0]).toUpperCase();
}

export function getCardCountLabel(count: number): string {
  return count === 1 ? "1 card" : `${count} cards`;
}
