import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Flashcard,
  FlashcardSet,
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  hydrateStoredSets,
  migrateLegacyCards,
  orderSets,
} from "@/lib/flashcards";

type ClearResult = {
  removedSet: FlashcardSet;
};

type UseFlashcardSetsResult = {
  sets: FlashcardSet[];
  recentSets: FlashcardSet[];
  selectedSet: FlashcardSet | null;
  currentCard: Flashcard | null;
  currentCardIndex: number;
  totalCards: number;
  learnedCount: number;
  progressPercent: number;
  isFirstCard: boolean;
  isLastCard: boolean;
  selectSet: (setId: string) => void;
  addSet: (set: FlashcardSet) => void;
  clearSelectedSet: () => ClearResult | null;
  toggleCardLearned: (cardId: string) => void;
  goToPreviousCard: () => void;
  goToNextCard: () => void;
};

export function useFlashcardSets(): UseFlashcardSetsResult {
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedSets = hydrateStoredSets(window.localStorage.getItem(STORAGE_KEY));
    let nextSets = storedSets;

    if (nextSets.length === 0) {
      const migrated = migrateLegacyCards(window.localStorage.getItem(LEGACY_STORAGE_KEY));
      if (migrated.length > 0) {
        nextSets = orderSets(migrated);
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSets));
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch (storageError) {
          console.error("Failed to persist migrated flashcards", storageError);
        }
      }
    }

    setSets(nextSets);
    setSelectedSetId(nextSets[0]?.id ?? null);
    setInitialLoadComplete(true);
  }, []);

  useEffect(() => {
    if (!initialLoadComplete || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
    } catch (storageError) {
      console.error("Failed to save flashcard sets", storageError);
    }
  }, [sets, initialLoadComplete]);

  useEffect(() => {
    setCurrentCardIndex(0);
  }, [selectedSetId]);

  const selectedSet = useMemo(() => {
    if (sets.length === 0) {
      return null;
    }

    if (!selectedSetId) {
      return sets[0];
    }

    return sets.find((set) => set.id === selectedSetId) ?? sets[0];
  }, [sets, selectedSetId]);

  const totalCards = selectedSet?.cards.length ?? 0;

  useEffect(() => {
    setCurrentCardIndex((prev) => {
      if (totalCards === 0) {
        return 0;
      }

      return Math.min(prev, totalCards - 1);
    });
  }, [totalCards]);

  const learnedCount = useMemo(() => {
    if (!selectedSet) {
      return 0;
    }

    return selectedSet.cards.filter((card) => card.learned).length;
  }, [selectedSet]);

  const progressPercent = totalCards ? Math.round((learnedCount / totalCards) * 100) : 0;

  const currentCard = useMemo(() => {
    if (!selectedSet || totalCards === 0) {
      return null;
    }

    return selectedSet.cards[Math.min(currentCardIndex, totalCards - 1)];
  }, [currentCardIndex, selectedSet, totalCards]);

  const isFirstCard = currentCardIndex <= 0;
  const isLastCard = totalCards === 0 ? true : currentCardIndex >= totalCards - 1;

  const recentSets = useMemo(() => sets.slice(0, 5), [sets]);

  const selectSet = useCallback((setId: string) => {
    setSelectedSetId(setId);
  }, []);

  const addSet = useCallback((set: FlashcardSet) => {
    setSets((prev) => orderSets([set, ...prev]));
    setSelectedSetId(set.id);
    setCurrentCardIndex(0);
  }, []);

  const clearSelectedSet = useCallback((): ClearResult | null => {
    const removedSet = selectedSet;
    if (!removedSet) {
      return null;
    }

    setSets((prev) => {
      const filtered = prev.filter((set) => set.id !== removedSet.id);
      const nextSelected = filtered[0]?.id ?? null;
      setSelectedSetId(nextSelected);
      setCurrentCardIndex(0);
      return filtered;
    });

    return { removedSet };
  }, [selectedSet]);

  const toggleCardLearned = useCallback(
    (cardId: string) => {
      const targetSetId = selectedSet?.id;
      if (!targetSetId) {
        return;
      }

      setSets((prev) =>
        prev.map((set) =>
          set.id === targetSetId
            ? {
                ...set,
                cards: set.cards.map((card) =>
                  card.id === cardId ? { ...card, learned: !card.learned } : card,
                ),
              }
            : set,
        ),
      );
    },
    [selectedSet?.id],
  );

  const goToPreviousCard = useCallback(() => {
    setCurrentCardIndex((prev) => (prev <= 0 ? 0 : prev - 1));
  }, []);

  const goToNextCard = useCallback(() => {
    setCurrentCardIndex((prev) => {
      if (totalCards === 0) {
        return 0;
      }

      return prev >= totalCards - 1 ? totalCards - 1 : prev + 1;
    });
  }, [totalCards]);

  return {
    sets,
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
  };
}
