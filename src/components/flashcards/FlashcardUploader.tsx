"use client";

import { ChangeEvent, DragEvent, KeyboardEvent, ReactNode, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { byPrefixAndName } from "@/lib/fontawesome";

type FlashcardUploaderProps = {
  loading: boolean;
  error: string;
  statusMessage: string;
  onGenerate: (file: File) => Promise<void> | void;
  onError: (message: string) => void;
  onResetFeedback: () => void;
  children?: ReactNode;
};

export function FlashcardUploader({
  loading,
  error,
  statusMessage,
  onGenerate,
  onError,
  onResetFeedback,
  children,
}: FlashcardUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applySelectedFile = (selected: File | null) => {
    onResetFeedback();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (!selected) {
      setFile(null);
      return;
    }

    const isPdf = selected.type === "application/pdf" || /\.pdf$/i.test(selected.name);
    const isText = selected.type === "text/plain" || /\.txt$/i.test(selected.name);

    if (!isPdf && !isText) {
      setFile(null);
      onError("Please choose a PDF or TXT file.");
      return;
    }

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

  const handleGenerateClick = async () => {
    if (!file) {
      onError("Please select a file first.");
      return;
    }

    await onGenerate(file);
  };

  return (
    <section className="rounded-3xl bg-white/90 p-6 shadow-xl backdrop-blur">
      <h2 className="text-2xl font-semibold text-slate-900">Import PDF</h2>
      <p className="mt-2 text-sm text-slate-500">Upload a PDF to generate flashcards instantly.</p>

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
          <FontAwesomeIcon
            icon={byPrefixAndName.fal["cloud-arrow-up"]}
            className="text-3xl text-blue-500"
          />
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
          onClick={handleGenerateClick}
          disabled={loading}
          className={`w-full rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${
            loading ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Generating..." : "Generate Flashcards"}
        </button>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 shadow-sm">{error}</p>
        )}

        {statusMessage && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-600 shadow-sm">
            {statusMessage}
          </p>
        )}
      </div>

      {children}
    </section>
  );
}
