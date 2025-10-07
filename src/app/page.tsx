"use client";

import { useState } from "react";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import {
  FlashcardSet,
  buildFlashcardsFromParsed,
  createId,
  parseFlashcards,
} from "@/lib/flashcards";
import { byPrefixAndName } from "@/lib/fontawesome";
import { useFlashcardSets } from "@/hooks/useFlashcardSets";
import { FlashcardImportsList } from "@/components/flashcards/FlashcardImportsList";
import { FlashcardStudyPanel } from "@/components/flashcards/FlashcardStudyPanel";
import { FlashcardUploader } from "@/components/flashcards/FlashcardUploader";

const API_ENDPOINT = "https://flashcard-generator-backend-bgym.onrender.com/summarize";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const {
    recentSets,
    selectedSet,
    currentCard,
    currentCardIndex,
    totalCards,
    learnedCount,
    progressPercent,
    isFirstCard,
    isLastCard,
    selectSet,
    addSet,
    clearSelectedSet,
    toggleCardLearned,
    goToPreviousCard,
    goToNextCard,
  } = useFlashcardSets();

  const handleResetFeedback = () => {
    setError("");
    setStatusMessage("");
  };

  const handleGenerate = async (file: File) => {
    setLoading(true);
    setError("");
    setStatusMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(API_ENDPOINT, formData, {
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

      const newSet: FlashcardSet = {
        id: createId(),
        name: file.name,
        importedAt: new Date().toISOString(),
        cards: newCards,
      };

      addSet(newSet);
      setStatusMessage(`Added ${newCards.length} flashcards from "${file.name}".`);
    } catch (err) {
      console.error(err);
      setError("Failed to connect to backend. Make sure FastAPI is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearSelected = () => {
    const result = clearSelectedSet();
    if (!result) {
      return;
    }

    setStatusMessage(`Cleared flashcards from "${result.removedSet.name}".`);
    setError("");
  };

  const handleSelectSet = (setId: string) => {
    selectSet(setId);
    setStatusMessage("");
    setError("");
  };

  return (
    <main className="min-h-screen px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12">
        <header className="flex flex-col gap-2 text-center sm:flex-row sm:items-end sm:justify-between sm:text-left">
          <div>
            <h1 className="flex items-center gap-3 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              <FontAwesomeIcon icon={byPrefixAndName.fas["bolt-lightning"]} />
              <span>
                <span className="text-[#FA0F00]">PDF</span>LASHGEN
              </span>
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
          <div>
            <FlashcardUploader
              loading={loading}
              error={error}
              statusMessage={statusMessage}
              onGenerate={handleGenerate}
              onError={setError}
              onResetFeedback={handleResetFeedback}
            >
              <FlashcardImportsList sets={recentSets} selectedSet={selectedSet} onSelectSet={handleSelectSet} />
            </FlashcardUploader>
          </div>

          <FlashcardStudyPanel
            selectedSet={selectedSet}
            currentCard={currentCard}
            currentCardIndex={currentCardIndex}
            totalCards={totalCards}
            learnedCount={learnedCount}
            progressPercent={progressPercent}
            isFirstCard={isFirstCard}
            isLastCard={isLastCard}
            onClearSelected={handleClearSelected}
            onToggleLearned={toggleCardLearned}
            onPrevious={goToPreviousCard}
            onNext={goToNextCard}
          />
        </div>
      </div>
    </main>
  );
}
