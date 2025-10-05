"use client";

import { useState } from "react";
import axios from "axios";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [flashcards, setFlashcards] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setFlashcards("");
      setError("");
    }
  };

  // Send file to FastAPI
  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    setLoading(true);
    setError("");
    setFlashcards("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post("http://127.0.0.1:8000/summarize", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.error) {
        setError(res.data.error);
      } else {
        setFlashcards(res.data.flashcards);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to connect to backend. Make sure FastAPI is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-50">
      <h1 className="text-4xl font-bold mb-6 text-gray-800">
        📚 AI Flashcard Generator
      </h1>

      <div className="bg-white p-6 rounded-xl shadow-md w-full max-w-md">
        <input
          type="file"
          accept=".pdf,.txt"
          onChange={handleFileChange}
          className="w-full mb-4 border border-gray-300 rounded-lg p-2"
        />

        <button
          onClick={handleUpload}
          disabled={loading}
          className={`w-full py-2 rounded-lg text-white font-medium ${
            loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Generating..." : "Generate Flashcards"}
        </button>

        {error && (
          <p className="text-red-600 mt-3 text-sm text-center">{error}</p>
        )}
      </div>

      {flashcards && (
        <div className="mt-8 bg-white p-6 rounded-xl shadow w-full max-w-2xl whitespace-pre-wrap">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">
            🧠 Generated Flashcards
          </h2>
          <pre className="text-gray-700">{flashcards}</pre>
        </div>
      )}
    </main>
  );
}
