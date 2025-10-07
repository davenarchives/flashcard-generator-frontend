import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import {
  Flashcard,
  FlashcardSet,
  formatImportDate,
  getCardCountLabel,
  getSetMonogram,
} from "@/lib/flashcards";
import { byPrefixAndName } from "@/lib/fontawesome";
import { FlashcardItem } from "@/components/flashcards/FlashcardItem";

const PDF_PAGE_WIDTH = 595.28;
const PDF_PAGE_HEIGHT = 841.89;
const PDF_MARGIN_X = 56;
const PDF_MARGIN_TOP = 72;
const PDF_MARGIN_BOTTOM = 72;
const PDF_FONT_SIZE = 12;
const PDF_LINE_HEIGHT = 18;
const PDF_MAX_LINE_CHARS = 90;

function sanitizeTextValue(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 32 && code <= 126) {
        return char;
      }
      return "?";
    })
    .join("")
    .trim();
}

function breakWordIntoSegments(word: string, maxChars: number): string[] {
  if (word.length <= maxChars) {
    return [word];
  }

  const segments: string[] = [];
  for (let index = 0; index < word.length; index += maxChars) {
    segments.push(word.slice(index, index + maxChars));
  }
  return segments;
}

function segmentSanitizedText(sanitized: string, maxChars: number): string[] {
  if (!sanitized) {
    return [];
  }

  const lines: string[] = [];
  let current = "";
  const words = sanitized.split(" ");

  for (const word of words) {
    if (!word) {
      continue;
    }

    if (!current.length) {
      if (word.length <= maxChars) {
        current = word;
      } else {
        const segments = breakWordIntoSegments(word, maxChars);
        lines.push(...segments.slice(0, -1));
        const lastSegment = segments[segments.length - 1] ?? "";
        if (lastSegment.length === maxChars) {
          lines.push(lastSegment);
          current = "";
        } else {
          current = lastSegment;
        }
      }
      continue;
    }

    if (current.length + 1 + word.length <= maxChars) {
      current = `${current} ${word}`;
      continue;
    }

    lines.push(current);
    current = "";

    if (word.length <= maxChars) {
      current = word;
      continue;
    }

    const segments = breakWordIntoSegments(word, maxChars);
    lines.push(...segments.slice(0, -1));
    const lastSegment = segments[segments.length - 1] ?? "";
    if (lastSegment.length === maxChars) {
      lines.push(lastSegment);
    } else {
      current = lastSegment;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function wrapLongLine(value: string, maxChars = PDF_MAX_LINE_CHARS): string[] {
  const sanitized = sanitizeTextValue(value);
  if (!sanitized) {
    return [""];
  }
  return segmentSanitizedText(sanitized, maxChars);
}

function wrapWithPrefix(value: string, prefix: string, maxChars = PDF_MAX_LINE_CHARS): string[] {
  const sanitized = sanitizeTextValue(value);
  const available = Math.max(1, maxChars - prefix.length);

  if (!sanitized) {
    return [prefix.trimEnd()];
  }

  const segments = segmentSanitizedText(sanitized, available);
  const indent = " ".repeat(prefix.length);

  return segments.map((segment, index) => (index === 0 ? `${prefix}${segment}` : `${indent}${segment}`));
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function toSafeFileName(value: string): string {
  const sanitized = sanitizeTextValue(value)
    .replace(/[^A-Za-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized || "flashcards";
}

// Build a lightweight PDF so learners can export questions and answers without extra dependencies.
function createFlashcardsPdfBlob(set: FlashcardSet): Blob | null {
  if (typeof TextEncoder === "undefined" || set.cards.length === 0) {
    return null;
  }

  const encoder = new TextEncoder();
  const headerTitle = `Flashcards for ${sanitizeTextValue(set.name || "Imported Set")}`;
  const generatedLine = `Generated ${sanitizeTextValue(new Date().toLocaleString())}`;

  const lines: string[] = [
    ...wrapLongLine(headerTitle),
    ...wrapLongLine(generatedLine),
    "",
  ];

  set.cards.forEach((card, index) => {
    lines.push(...wrapLongLine(`Card ${index + 1}`));
    lines.push(...wrapWithPrefix(card.question, "Q: "));
    lines.push(...wrapWithPrefix(card.answer, "A: "));

    if (index < set.cards.length - 1) {
      lines.push("");
    }
  });

  const contentLines = lines.length > 0 ? lines : ["Flashcard export"];
  const maxLinesPerPage = Math.max(
    1,
    Math.floor((PDF_PAGE_HEIGHT - PDF_MARGIN_TOP - PDF_MARGIN_BOTTOM) / PDF_LINE_HEIGHT),
  );

  const pages: string[][] = [];
  let currentPage: string[] = [];

  for (const line of contentLines) {
    if (currentPage.length >= maxLinesPerPage) {
      pages.push(currentPage);
      currentPage = [];
    }
    currentPage.push(line);
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  if (pages.length === 0) {
    pages.push(["Flashcard export"]);
  }

  const pageCount = pages.length;
  const fontObject = {
    id: 3,
    content: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n",
  };

  const pageObjects: Array<{ id: number; content: string }> = [];
  const contentObjects: Array<{ id: number; content: string }> = [];

  pages.forEach((pageLines, index) => {
    const pageId = 4 + index;
    const contentId = 4 + pageCount + index;

    const streamParts = [
      "BT",
      `/F1 ${PDF_FONT_SIZE} Tf`,
      `${PDF_LINE_HEIGHT} TL`,
      `1 0 0 1 ${PDF_MARGIN_X} ${PDF_PAGE_HEIGHT - PDF_MARGIN_TOP} Tm`,
    ];

    pageLines.forEach((line, lineIndex) => {
      streamParts.push(`(${escapePdfText(line)}) Tj`);
      if (lineIndex !== pageLines.length - 1) {
        streamParts.push("T*");
      }
    });

    streamParts.push("ET");

    const streamBody = `${streamParts.join("\n")}\n`;
    const streamBytes = encoder.encode(streamBody);
    const content = `<< /Length ${streamBytes.length} >>\nstream\n${streamBody}endstream\n`;

    contentObjects.push({
      id: contentId,
      content,
    });

    const pageContent = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>\n`;

    pageObjects.push({
      id: pageId,
      content: pageContent,
    });
  });

  const kidsRefs = pageObjects.map((obj) => `${obj.id} 0 R`).join(" ");

  const catalogObject = {
    id: 1,
    content: "<< /Type /Catalog /Pages 2 0 R >>\n",
  };

  const pagesObject = {
    id: 2,
    content: `<< /Type /Pages /Count ${pageCount} /Kids [${kidsRefs}] >>\n`,
  };

  const allObjects = [catalogObject, pagesObject, fontObject, ...pageObjects, ...contentObjects].sort(
    (a, b) => a.id - b.id,
  );

  let pdf = "%PDF-1.4\n";
  const offsets: Array<{ id: number; offset: number }> = [];

  allObjects.forEach((object) => {
    offsets.push({ id: object.id, offset: pdf.length });
    pdf += `${object.id} 0 obj\n${object.content}endobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${allObjects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  offsets.forEach((entry) => {
    pdf += `${String(entry.offset).padStart(10, "0")} 00000 n \n`;
  });

  pdf += `trailer\n<< /Size ${allObjects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const pdfBytes = encoder.encode(pdf);
  return new Blob([pdfBytes], { type: "application/pdf" });
}

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
  const canDownload = Boolean(selectedSet && selectedSet.cards.length > 0);

  const handleClearClick = () => {
    if (!selectedSet) {
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to clear all flashcards from "${selectedSet.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    onClearSelected();
  };

  const handleDownloadClick = () => {
    if (!selectedSet || selectedSet.cards.length === 0) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const pdfBlob = createFlashcardsPdfBlob(selectedSet);
    if (!pdfBlob) {
      return;
    }

    const baseName = selectedSet.name.replace(/\.[^/.]+$/, "");
    const safeName = toSafeFileName(baseName || selectedSet.name);
    const blobUrl = window.URL.createObjectURL(pdfBlob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${safeName}-flashcards.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  };

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
        <div className="flex items-center gap-2 self-start">
          <button
            type="button"
            onClick={handleDownloadClick}
            disabled={!canDownload}
            className={`flex h-11 w-11 items-center justify-center rounded-full border text-base transition ${
              !canDownload
                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
            }`}
            aria-label="Download Flashcards"
            title="Download Flashcards"
          >
            <FontAwesomeIcon icon={byPrefixAndName.fas["download"]} />
          </button>
          <button
            type="button"
            onClick={handleClearClick}
            disabled={!selectedSet}
            className={`flex h-11 w-11 items-center justify-center rounded-full border text-base transition ${
              !selectedSet
                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
            }`}
            aria-label="Clear All"
            title="Clear All"
          >
            <FontAwesomeIcon icon={byPrefixAndName.fal.trash} />
          </button>
        </div>
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
