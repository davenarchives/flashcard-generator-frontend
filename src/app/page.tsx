"use client";

import { ChangeEvent, KeyboardEvent, useEffect, useState } from "react";
import axios from "axios";

type Flashcard = {
  id: string;
  question: string;
  answer: string;
  learned: boolean;
};

type ParsedFlashcard = {
  question: string;
  answer: string;
};

const STORAGE_KEY = "flashcard-app:cards";

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 11);
}

function canonicalKey(question: string, answer: string): string {
  return `${question.trim().toLowerCase()}::${answer.trim().toLowerCase()}`;
}

function parseFlashcards(raw: string): ParsedFlashcard[] {
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

function mergeFlashcards(
  existing: Flashcard[],
  incoming: ParsedFlashcard[],
): { cards: Flashcard[]; addedCount: number } {
  if (incoming.length === 0) {
    return { cards: existing, addedCount: 0 };
  }

  const seen = new Set(existing.map((card) => canonicalKey(card.question, card.answer)));
  const additions: Flashcard[] = [];

  for (const card of incoming) {
    const key = canonicalKey(card.question, card.answer);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    additions.push({
      id: createId(),
      question: card.question.trim(),
      answer: card.answer.trim(),
      learned: false,
    });
  }

  return { cards: [...existing, ...additions], addedCount: additions.length };
}

type FlashcardItemProps = {
  card: Flashcard;
  onToggleLearned: (id: string) => void;
};

function FlashcardItem({ card, onToggleLearned }: FlashcardItemProps) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    setFlipped(false);
  }, [card.id]);

  const handleFlip = () => {
    setFlipped((prev) => !prev);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleFlip();
    }
  };

  return (
    <div className={`flashcard ${card.learned ? "flashcard-learned" : ""}`}>
      <div
        className={`flashcard-inner ${flipped ? "is-flipped" : ""}`}
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        onClick={handleFlip}
        onKeyDown={handleKeyDown}
      >
        <div className="flashcard-face front bg-white p-4 shadow-lg">
          <div className="flex h-full flex-col justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Question
              </p>
              <p className="mt-2 text-base font-medium text-slate-900 whitespace-pre-line">
                {card.question}
              </p>
            </div>
            <p className="mt-4 text-xs text-slate-400">Click to reveal the answer</p>
          </div>
        </div>
        <div className="flashcard-face back bg-blue-600 p-4 text-white shadow-lg">
          <div className="flex h-full flex-col justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-100">
                Answer
              </p>
              <p className="mt-2 text-base font-medium whitespace-pre-line">
                {card.answer}
              </p>
            </div>
            <p className="mt-4 text-xs text-blue-100">Click to go back</p>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleLearned(card.id);
        }}
        className={`w-full rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
          card.learned
            ? "border-emerald-500 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
        }`}
      >
        {card.learned ? "Learned" : "Mark as Learned"}
      </button>
    </div>
  );
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  const totalCards = flashcards.length;
  const learnedCount = flashcards.filter((card) => card.learned).length;
  const progressPercent = totalCards ? Math.round((learnedCount / totalCards) * 100) : 0;
  const currentCard = totalCards > 0 ? flashcards[Math.min(currentCardIndex, totalCards - 1)] : null;
  const isFirstCard = currentCardIndex <= 0;
  const isLastCard = totalCards === 0 ? true : currentCardIndex >= totalCards - 1;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setInitialLoadComplete(true);
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const hydrated: Flashcard[] = parsed
          .filter(
            (item: unknown): item is Partial<Flashcard> =>
              !!item &&
              typeof item === "object" &&
              typeof (item as Partial<Flashcard>).question === "string" &&
              typeof (item as Partial<Flashcard>).answer === "string",
          )
          .map((item) => ({
            id: typeof item.id === "string" ? item.id : createId(),
            question: (item.question ?? "").toString().trim(),
            answer: (item.answer ?? "").toString().trim(),
            learned: Boolean(item.learned),
          }));

        setFlashcards(hydrated);
        setCurrentCardIndex(0);
      }
    } catch (storageError) {
      console.error("Failed to load flashcards from storage", storageError);
    } finally {
      setInitialLoadComplete(true);
    }
  }, []);

  useEffect(() => {
    if (!initialLoadComplete || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(flashcards));
    } catch (storageError) {
      console.error("Failed to save flashcards", storageError);
    }
  }, [flashcards, initialLoadComplete]);

  useEffect(() => {
    setCurrentCardIndex((prev) => {
      if (totalCards === 0) {
        return 0;
      }

      return Math.min(prev, totalCards - 1);
    });
  }, [totalCards]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setError("");
    setStatusMessage("");
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    setLoading(true);
    setError("");
    setStatusMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post("http://127.0.0.1:8000/summarize", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.error) {
        setError(res.data.error);
        return;
      }

      const aiOutput = typeof res.data?.flashcards === "string" ? res.data.flashcards : "";
      if (!aiOutput.trim()) {
        setError("The AI response did not contain any flashcards.");
        return;
      }

      const parsedCards = parseFlashcards(aiOutput);
      if (parsedCards.length === 0) {
        setError("Could not parse any Q/A pairs from the AI response.");
        return;
      }

      let addedCount = 0;
      setFlashcards((prev) => {
        const result = mergeFlashcards(prev, parsedCards);
        addedCount = result.addedCount;

        setCurrentCardIndex((prevIndex) => {
          if (result.cards.length === 0) {
            return 0;
          }

          if (result.addedCount > 0) {
            return Math.max(result.cards.length - result.addedCount, 0);
          }

          return Math.min(prevIndex, result.cards.length - 1);
        });

        return result.cards;
      });
      if (addedCount > 0) {
        setStatusMessage(`Added ${addedCount} new flashcards.`);
      } else {
        setStatusMessage("No new flashcards were added (duplicates skipped).");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to connect to backend. Make sure FastAPI is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLearned = (id: string) => {
    setFlashcards((prev) =>
      prev.map((card) =>
        card.id === id ? { ...card, learned: !card.learned } : card,
      ),
    );
  };


  const handlePreviousCard = () => {
    setCurrentCardIndex((prev) => (prev <= 0 ? 0 : prev - 1));
  };

  const handleNextCard = () => {
    setCurrentCardIndex((prev) => {
      if (totalCards === 0) {
        return 0;
      }

      return prev >= totalCards - 1 ? totalCards - 1 : prev + 1;
    });
  };
  const handleClearFlashcards = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    setFlashcards([]);
    setCurrentCardIndex(0);
    setStatusMessage("Cleared all saved flashcards.");
    setError("");
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto w-full max-w-6xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-900">Flashcard Generator</h1>
          <p className="mt-3 text-base text-slate-600">
            Upload your study materials and turn AI-generated Q/A pairs into interactive flashcards you can keep.
          </p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="rounded-2xl bg-white p-6 shadow-md">
            <h2 className="text-2xl font-semibold text-slate-900">Generate Flashcards</h2>
            <p className="mt-2 text-sm text-slate-500">
              Upload a PDF or TXT file and let the backend create question/answer pairs for you.
            </p>

            <div className="mt-6 space-y-4">
              <input
                type="file"
                accept=".pdf,.txt"
                onChange={handleFileChange}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
              />

              {file && (
                <p className="truncate text-sm text-slate-500" title={file.name}>
                  Selected: {file.name}
                </p>
              )}

              <button
                onClick={handleUpload}
                disabled={loading}
                className={`w-full rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
                  loading
                    ? "bg-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {loading ? "Generating..." : "Generate Flashcards"}
              </button>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </p>
              )}

              {statusMessage && (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">
                  {statusMessage}
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-md">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">Saved Flashcards</h2>
                  <p className="text-sm text-slate-500">
                    Click a card to flip it. Track your progress as you learn.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearFlashcards}
                  disabled={totalCards === 0}
                  className={`inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                    totalCards === 0
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Clear All
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>
                    Learned: {learnedCount} / {totalCards}
                  </span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {totalCards > 0 ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="flex w-full max-w-xl items-center justify-between text-sm text-slate-500">
                    <span>
                      Card {currentCardIndex + 1} of {totalCards}
                    </span>
                    {currentCard?.learned ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-600">Learned</span>
                    ) : null}
                  </div>

                  {currentCard ? (
                    <div className="w-full max-w-xl">
                      <FlashcardItem
                        key={currentCard.id}
                        card={currentCard}
                        onToggleLearned={handleToggleLearned}
                      />
                    </div>
                  ) : null}

                  <div className="flex w-full max-w-xl items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={handlePreviousCard}
                      disabled={isFirstCard}
                      className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                        isFirstCard
                          ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={handleNextCard}
                      disabled={isLastCard}
                      className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                        isLastCard
                          ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
                  <p>Your flashcards will appear here once they have been generated.</p>
                  <p className="mt-2 text-xs text-slate-400">They stay saved on this device for next time.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

