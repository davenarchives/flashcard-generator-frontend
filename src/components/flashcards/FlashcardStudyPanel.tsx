import {
  Flashcard,
  FlashcardSet,
  formatImportDate,
  getCardCountLabel,
  getSetMonogram,
} from "@/lib/flashcards";
import { FlashcardItem } from "@/components/flashcards/FlashcardItem";

type FlashcardStudyPanelProps = {
  selectedSet: FlashcardSet | null;
  currentCard: Flashcard | null;
  currentCardIndex: number;
  totalCards: number;
  learnedCount: number;
  progressPercent: number;
  isFirstCard: boolean;
  isLastCard: boolean;
  onClearSelected: () => void;
  onToggleLearned: (cardId: string) => void;
  onPrevious: () => void;
  onNext: () => void;
};

export function FlashcardStudyPanel({
  selectedSet,
  currentCard,
  currentCardIndex,
  totalCards,
  learnedCount,
  progressPercent,
  isFirstCard,
  isLastCard,
  onClearSelected,
  onToggleLearned,
  onPrevious,
  onNext,
}: FlashcardStudyPanelProps) {
  return (
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
          onClick={onClearSelected}
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
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progressPercent}%` }} />
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
                <FlashcardItem card={currentCard} onToggleLearned={onToggleLearned} />
              </div>
            ) : null}

            <div className="flex w-full max-w-xl items-center justify-between gap-4">
              <button
                type="button"
                onClick={onPrevious}
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
                onClick={onNext}
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
  );
}
