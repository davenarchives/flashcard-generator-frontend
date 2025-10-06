"use client";

import { KeyboardEvent, useEffect, useState } from "react";

import { Flashcard } from "@/lib/flashcards";

type FlashcardItemProps = {
  card: Flashcard;
  onToggleLearned: (id: string) => void;
};

export function FlashcardItem({ card, onToggleLearned }: FlashcardItemProps) {
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
