"use client";

import { ChangeEvent, DragEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
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

type FlashcardSet = {
  id: string;
  name: string;
  importedAt: string;
  cards: Flashcard[];
};

const STORAGE_KEY = "flashcard-app:sets";
const LEGACY_STORAGE_KEY = "flashcard-app:cards";

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

function buildFlashcardsFromParsed(parsed: ParsedFlashcard[]): Flashcard[] {
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

function hydrateStoredSets(value: string | null): FlashcardSet[] {
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

function migrateLegacyCards(value: string | null): FlashcardSet[] {
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

function orderSets(sets: FlashcardSet[]): FlashcardSet[] {
  return [...sets].sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
}

function formatImportDate(value: string): string {
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

function getSetMonogram(name: string): string {
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

function getCardCountLabel(count: number): string {
  return count === 1 ? "1 card" : `${count} cards`;
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
        <div className="flashcard-face front bg-slate-100 p-6 shadow-lg">
          <div className="flex h-full flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Question
              </p>
              <p className="mt-3 whitespace-pre-line text-base font-medium text-slate-900">
                {card.question}
              </p>
            </div>
            <p className="mt-6 text-xs text-slate-400">Click to reveal the answer</p>
          </div>
        </div>
        <div className="flashcard-face back bg-blue-600 p-6 text-white shadow-lg">
          <div className="flex h-full flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
                Answer
              </p>
              <p className="mt-3 whitespace-pre-line text-base font-medium">
                {card.answer}
              </p>
            </div>
            <p className="mt-6 text-xs text-blue-100">Click to go back</p>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleLearned(card.id);
        }}
        className={`w-full rounded-xl px-4 py-2 text-sm font-semibold transition ${
          card.learned
            ? "bg-emerald-500 text-white shadow-md hover:bg-emerald-600"
            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
        }`}
      >
        {card.learned ? "Marked as Learned" : "Mark as Learned"}
      </button>
    </div>
  );
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedSet = useMemo(() => {
    if (flashcardSets.length === 0) {
      return null;
    }

    if (!selectedSetId) {
      return flashcardSets[0];
    }

    return flashcardSets.find((set) => set.id === selectedSetId) ?? flashcardSets[0];
  }, [flashcardSets, selectedSetId]);

  const totalCards = selectedSet?.cards.length ?? 0;
  const learnedCount = selectedSet ? selectedSet.cards.filter((card) => card.learned).length : 0;
  const progressPercent = totalCards ? Math.round((learnedCount / totalCards) * 100) : 0;
  const currentCard =
    totalCards > 0 ? selectedSet!.cards[Math.min(currentCardIndex, totalCards - 1)] : null;
  const isFirstCard = currentCardIndex <= 0;
  const isLastCard = totalCards === 0 ? true : currentCardIndex >= totalCards - 1;
  const recentSets = flashcardSets.slice(0, 5);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedSets = hydrateStoredSets(window.localStorage.getItem(STORAGE_KEY));
    let sets = storedSets;

    if (sets.length === 0) {
      const migrated = migrateLegacyCards(window.localStorage.getItem(LEGACY_STORAGE_KEY));
      if (migrated.length > 0) {
        sets = orderSets(migrated);
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch (storageError) {
          console.error("Failed to persist migrated flashcards", storageError);
        }
      }
    }

    setFlashcardSets(sets);
    setSelectedSetId(sets[0]?.id ?? null);
    setInitialLoadComplete(true);
  }, []);

  useEffect(() => {
    if (!initialLoadComplete || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(flashcardSets));
    } catch (storageError) {
      console.error("Failed to save flashcard sets", storageError);
    }
  }, [flashcardSets, initialLoadComplete]);

  useEffect(() => {
    setCurrentCardIndex(0);
  }, [selectedSetId]);

  useEffect(() => {
    setCurrentCardIndex((prev) => {
      if (totalCards === 0) {
        return 0;
      }

      return Math.min(prev, totalCards - 1);
    });
  }, [totalCards]);

  const applySelectedFile = (selected: File | null) => {
    setStatusMessage("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (!selected) {
      setFile(null);
      setError("");
      return;
    }

    const isPdf = selected.type === "application/pdf" || /\.pdf$/i.test(selected.name);
    const isText = selected.type === "text/plain" || /\.txt$/i.test(selected.name);

    if (!isPdf && !isText) {
      setError("Please choose a PDF or TXT file.");
      setFile(null);
      return;
    }

    setError("");
    setFile(selected);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleDropzoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleBrowseClick();
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const droppedFiles = event.dataTransfer?.files;
    if (!droppedFiles || droppedFiles.length === 0) {
      return;
    }

    applySelectedFile(droppedFiles[0]);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    applySelectedFile(event.target.files?.[0] ?? null);
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
      const res = await axios.post("https://flashcard-generator-backend-bgym.onrender.com/summarize", formData, {
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

      const newCards = buildFlashcardsFromParsed(parsedCards);
      if (newCards.length === 0) {
        setError("No new flashcards were generated from this file.");
        return;
      }

      const newSetId = createId();
      const newSet: FlashcardSet = {
        id: newSetId,
        name: file.name,
        importedAt: new Date().toISOString(),
        cards: newCards,
      };

      setFlashcardSets((prev) => orderSets([newSet, ...prev]));
      setSelectedSetId(newSetId);
      setCurrentCardIndex(0);
      setStatusMessage(`Added ${newCards.length} flashcards from "${file.name}".`);
    } catch (err) {
      console.error(err);
      setError("Failed to connect to backend. Make sure FastAPI is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLearned = (id: string) => {
    if (!selectedSet) {
      return;
    }

    setFlashcardSets((prev) =>
      prev.map((set) => {
        if (set.id !== selectedSet.id) {
          return set;
        }

        return {
          ...set,
          cards: set.cards.map((card) => (card.id === id ? { ...card, learned: !card.learned } : card)),
        };
      }),
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
    if (!selectedSet) {
      return;
    }

    const removedName = selectedSet.name;
    let nextSelected: string | null = null;

    setFlashcardSets((prev) => {
      const filtered = prev.filter((set) => set.id !== selectedSet.id);
      nextSelected = filtered[0]?.id ?? null;
      return filtered;
    });

    setSelectedSetId(nextSelected);
    setCurrentCardIndex(0);
    setStatusMessage(`Cleared flashcards from "${removedName}".`);
    setError("");
  };

  const handleSelectSet = (setId: string) => {
    setSelectedSetId(setId);
    setCurrentCardIndex(0);
    setStatusMessage("");
    setError("");
  };

  return (
    <main className="min-h-screen px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12">
        <header className="flex flex-col gap-2 text-center sm:flex-row sm:items-end sm:justify-between sm:text-left">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              PDFLASHGEN
            </h1>
            <p className="mt-1 max-w-xl text-sm text-slate-600 sm:text-base">
              Import course PDFs and turn them into interactive flashcards you can study and track.
            </p>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
            a PDF to flashcards generator
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)]">
          <section className="rounded-3xl bg-white/90 p-6 shadow-xl backdrop-blur">
            <h2 className="text-2xl font-semibold text-slate-900">Import PDF</h2>
            <p className="mt-2 text-sm text-slate-500">
              Upload a PDF to generate flashcards instantly.
            </p>

            <div className="mt-6 space-y-4">
              <div
                role="button"
                tabIndex={0}
                onClick={handleBrowseClick}
                onKeyDown={handleDropzoneKeyDown}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                aria-label="Upload a PDF"
                className={`group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
                  isDragging
                    ? "border-blue-500 bg-blue-50/80 text-blue-700 shadow-inner"
                    : "border-slate-300 bg-white/70 text-slate-500 hover:border-blue-400 hover:bg-blue-50/60"
                }`}
              >
                <span className="text-sm font-semibold">Drag & drop your PDF</span>
                <span className="text-xs text-slate-400">or click to browse</span>
                {file ? (
                  <span className="mt-3 w-full truncate text-sm text-slate-600" title={file.name}>
                    Selected: {file.name}
                  </span>
                ) : (
                  <span className="mt-3 text-xs text-slate-400">Supports PDF and TXT files</span>
                )}
              </div>

              <input
                ref={fileInputRef}
                id="file-upload"
                type="file"
                accept=".pdf,.txt"
                onChange={handleFileChange}
                className="sr-only"
              />

              <button
                type="button"
                onClick={handleUpload}
                disabled={loading}
                className={`w-full rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${
                  loading ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {loading ? "Generating..." : "Generate Flashcards"}
              </button>

              {error && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 shadow-sm">
                  {error}
                </p>
              )}

              {statusMessage && (
                <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-600 shadow-sm">
                  {statusMessage}
                </p>
              )}
            </div>

            <div className="mt-8 border-t border-slate-200 pt-6">
              <h3 className="text-base font-semibold text-slate-900">Recent Imports</h3>
              <div className="mt-4 space-y-3">
                {recentSets.length > 0 ? (
                  recentSets.map((set) => {
                    const isActive = selectedSet?.id === set.id;
                    return (
                      <button
                        key={set.id}
                        type="button"
                        onClick={() => handleSelectSet(set.id)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                          isActive
                            ? "border-blue-500 bg-blue-50 text-slate-900 shadow-sm"
                            : "border-slate-200 bg-white/80 text-slate-600 hover:border-blue-300 hover:bg-blue-50/60"
                        }`}
                        title={set.name}
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{set.name}</p>
                          <p className="text-xs text-slate-400">{formatImportDate(set.importedAt)}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                          {getCardCountLabel(set.cards.length)}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-center text-sm text-slate-500">
                    No imports yet. Upload a PDF to get started.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-6 rounded-3xl bg-white/95 p-6 shadow-2xl backdrop-blur">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500 text-sm font-bold uppercase tracking-wide text-white">
                  {selectedSet ? getSetMonogram(selectedSet.name) : "PDF"}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Active Import</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">
                    {selectedSet ? selectedSet.name : "Select a PDF"}
                  </p>
                  {selectedSet ? (
                    <p className="text-xs text-slate-400">
                      Imported {formatImportDate(selectedSet.importedAt)} - {getCardCountLabel(selectedSet.cards.length)}
                    </p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={handleClearFlashcards}
                disabled={!selectedSet}
                className={`self-start rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  !selectedSet
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
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {selectedSet ? (
              totalCards > 0 ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="flex w-full max-w-xl items-center justify-between text-sm text-slate-500">
                    <span>
                      Card {currentCardIndex + 1} of {totalCards}
                    </span>
                    {currentCard?.learned ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                        Learned
                      </span>
                    ) : null}
                  </div>

                  {currentCard ? (
                    <div className="w-full max-w-xl">
                      <FlashcardItem card={currentCard} onToggleLearned={handleToggleLearned} />
                    </div>
                  ) : null}

                  <div className="flex w-full max-w-xl items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={handlePreviousCard}
                      disabled={isFirstCard}
                      className={`flex-1 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
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
                      className={`flex-1 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
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
                <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
                  <p>This PDF does not have any flashcards yet.</p>
                  <p className="mt-2 text-xs text-slate-400">Generate cards by uploading the file again.</p>
                </div>
              )
            ) : (
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
                <p>Select a recent import on the left to view its flashcards.</p>
                <p className="mt-2 text-xs text-slate-400">New uploads will appear here automatically.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
