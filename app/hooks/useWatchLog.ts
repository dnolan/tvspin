import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  FieldPath,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getErrorMessage } from "@/lib/errors";

export type Show = {
  id: string;
  title: string;
  titleLower: string;
};

export type WatchEntry = {
  id: string;
  date: string;
  showId: string;
  showTitle: string;
  season?: number;
  episode?: number;
  chooser?: string;
  ratings: Record<string, number>;
  createdAt: string;
};

export type WatchInput = {
  date: string;
  showTitle: string;
  season?: number;
  episode?: number;
  chooser?: string;
};

function parseWatch(id: string, data: Record<string, unknown>): WatchEntry | null {
  if (typeof data.showId !== "string" || typeof data.showTitle !== "string") return null;
  // Entries from before multiple-per-day used the date as their doc ID.
  const date = typeof data.date === "string" ? data.date : id;
  const ratings: Record<string, number> = {};
  if (data.ratings && typeof data.ratings === "object") {
    for (const [name, value] of Object.entries(data.ratings as Record<string, unknown>)) {
      if (typeof value === "number" && value >= 1 && value <= 5) ratings[name] = value;
    }
  }
  return {
    id,
    date,
    showId: data.showId,
    showTitle: data.showTitle,
    season: typeof data.season === "number" ? data.season : undefined,
    episode: typeof data.episode === "number" ? data.episode : undefined,
    chooser: typeof data.chooser === "string" ? data.chooser : undefined,
    ratings,
    createdAt:
      typeof data.createdAt === "string"
        ? data.createdAt
        : typeof data.updatedAt === "string"
          ? data.updatedAt
          : "",
  };
}

/** Newest date first; within a day, most recently added first. */
function compareWatches(a: WatchEntry, b: WatchEntry): number {
  return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
}

// Snapshot results are tagged with the subscription they came from, so switching user/game
// (or signing out) reads as empty/not-loaded without resetting state inside the effect.
type Tagged<T> = { key: string; items: T[] };

export function useWatchLog(authUser: User | null, gameId: string) {
  const subscriptionKey = db && authUser ? `${authUser.uid}|${gameId}` : null;
  const [watchesState, setWatchesState] = useState<Tagged<WatchEntry> | null>(null);
  const [showsState, setShowsState] = useState<Tagged<Show> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const watches = watchesState?.key === subscriptionKey ? watchesState.items : [];
  const shows = showsState?.key === subscriptionKey ? showsState.items : [];
  const isLoaded =
    subscriptionKey === null ||
    (watchesState?.key === subscriptionKey && showsState?.key === subscriptionKey);

  useEffect(() => {
    if (!db || !subscriptionKey) return;
    const key = subscriptionKey;

    const watchesQuery = query(
      collection(db, "tvspin", gameId, "watches"),
      orderBy("date", "desc"),
      limit(60),
    );
    const unsubWatches = onSnapshot(
      watchesQuery,
      (snapshot) => {
        setWatchesState({
          key,
          items: snapshot.docs
            .map((d) => parseWatch(d.id, d.data()))
            .filter((entry): entry is WatchEntry => entry !== null)
            .sort(compareWatches),
        });
      },
      (err) => {
        setError(`Unable to load watch log. ${getErrorMessage(err)}`);
        setWatchesState({ key, items: [] });
      },
    );

    const unsubShows = onSnapshot(
      collection(db, "tvspin", gameId, "shows"),
      (snapshot) => {
        setShowsState({
          key,
          items: snapshot.docs
            .map((d) => {
              const data = d.data();
              return typeof data.title === "string"
                ? { id: d.id, title: data.title, titleLower: data.title.toLowerCase() }
                : null;
            })
            .filter((show): show is Show => show !== null)
            .sort((a, b) => a.title.localeCompare(b.title)),
        });
      },
      (err) => {
        setError(`Unable to load shows. ${getErrorMessage(err)}`);
        setShowsState({ key, items: [] });
      },
    );

    return () => {
      unsubWatches();
      unsubShows();
    };
  }, [subscriptionKey, gameId]);

  /** Creates a new entry, or updates `entryId` when given (ratings are left untouched). */
  const saveWatch = async (input: WatchInput, entryId?: string): Promise<boolean> => {
    if (!db || !authUser) return false;
    const title = input.showTitle.trim();
    if (!title || !input.date) return false;

    try {
      const existing = shows.find((show) => show.titleLower === title.toLowerCase());
      let showId = existing?.id;
      let showTitle = existing?.title ?? title;
      if (!showId) {
        const created = await addDoc(collection(db, "tvspin", gameId, "shows"), {
          title,
          titleLower: title.toLowerCase(),
          createdAt: new Date().toISOString(),
        });
        showId = created.id;
        showTitle = title;
      }

      const now = new Date().toISOString();
      const updatedBy = authUser.email ?? authUser.uid;
      if (entryId) {
        await setDoc(
          doc(db, "tvspin", gameId, "watches", entryId),
          {
            date: input.date,
            showId,
            showTitle,
            season: input.season ?? deleteField(),
            episode: input.episode ?? deleteField(),
            chooser: input.chooser || deleteField(),
            updatedAt: now,
            updatedBy,
          },
          { merge: true },
        );
      } else {
        await addDoc(collection(db, "tvspin", gameId, "watches"), {
          date: input.date,
          showId,
          showTitle,
          ...(input.season !== undefined ? { season: input.season } : {}),
          ...(input.episode !== undefined ? { episode: input.episode } : {}),
          ...(input.chooser ? { chooser: input.chooser } : {}),
          ratings: {},
          createdAt: now,
          updatedAt: now,
          updatedBy,
        });
      }
      setError(null);
      return true;
    } catch (err) {
      setError(`Unable to save watch entry. ${getErrorMessage(err)}`);
      return false;
    }
  };

  const setRating = async (entryId: string, name: string, value: number | null) => {
    if (!db || !authUser) return;
    try {
      // FieldPath (not a dotted string) so names containing "." are safe.
      await updateDoc(
        doc(db, "tvspin", gameId, "watches", entryId),
        new FieldPath("ratings", name),
        value ?? deleteField(),
        "updatedAt",
        new Date().toISOString(),
        "updatedBy",
        authUser.email ?? authUser.uid,
      );
      setError(null);
    } catch (err) {
      setError(`Unable to save rating. ${getErrorMessage(err)}`);
    }
  };

  const deleteWatch = async (entryId: string) => {
    if (!db || !authUser) return;
    try {
      await deleteDoc(doc(db, "tvspin", gameId, "watches", entryId));
      setError(null);
    } catch (err) {
      setError(`Unable to delete watch entry. ${getErrorMessage(err)}`);
    }
  };

  return {
    watches,
    shows,
    isLoaded,
    error,
    saveWatch,
    setRating,
    deleteWatch,
  };
}
