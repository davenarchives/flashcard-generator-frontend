import { FlashcardSet, formatImportDate, getCardCountLabel } from "@/lib/flashcards";

type FlashcardImportsListProps = {
  sets: FlashcardSet[];
  selectedSet: FlashcardSet | null;
  onSelectSet: (setId: string) => void;
};

export function FlashcardImportsList({ sets, selectedSet, onSelectSet }: FlashcardImportsListProps) {
  if (sets.length === 0) {
    return (
      <div className="mt-8 border-t border-slate-200 pt-6">
        <h3 className="text-base font-semibold text-slate-900">Recent Imports</h3>
        <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-center text-sm text-slate-500">
          No imports yet. Upload a PDF to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 border-t border-slate-200 pt-6">
      <h3 className="text-base font-semibold text-slate-900">Recent Imports</h3>
      <div className="mt-4 space-y-3">
        {sets.map((set) => {
          const isActive = selectedSet?.id === set.id;
          return (
            <button
              key={set.id}
              type="button"
              onClick={() => onSelectSet(set.id)}
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
        })}
      </div>
    </div>
  );
}
