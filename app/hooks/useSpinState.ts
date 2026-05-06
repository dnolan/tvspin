import { useEffect, useMemo, useRef, useState } from "react";
import { User, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, googleProvider, hasFirebaseConfig } from "@/lib/firebase";

export type SpinResult = {
  name: string;
  spunAt: string;
  round: number;
};

type PersistedSpinState = {
  history: SpinResult[];
  remaining: string[];
};

export type SaveState = "idle" | "saving" | "saved" | "error";

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const code = "code" in error ? String(error.code) : null;
    const message = "message" in error ? String(error.message) : "Unknown Firebase error";
    return code ? `${code}: ${message}` : message;
  }
  return String(error);
}

export function useSpinState(names: string[]) {
  const firestoreDocId = process.env.NEXT_PUBLIC_TV_SPIN_DOC_ID || "default";

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!hasFirebaseConfig || !auth);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const spinDocRef = useMemo(() => {
    if (!db || !authUser) return null;
    return doc(db, "users", authUser.uid, "tvspin", firestoreDocId);
  }, [authUser, firestoreDocId]);

  const [isLoaded, setIsLoaded] = useState(false);
  const [remaining, setRemaining] = useState<string[]>([]);
  const [history, setHistory] = useState<SpinResult[]>([]);
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [latestWinner, setLatestWinner] = useState<string | null>(null);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const hasUserMutated = useRef(false);
  const spinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nameToCount = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const name of names) countMap.set(name, 0);
    for (const result of history) {
      countMap.set(result.name, (countMap.get(result.name) ?? 0) + 1);
    }
    return countMap;
  }, [history, names]);

  const hasSpunToday = useMemo(() => {
    const today = new Date().toDateString();
    return history.some((entry) => new Date(entry.spunAt).toDateString() === today);
  }, [history]);

  useEffect(() => {
    if (!hasFirebaseConfig) {
      setAuthReady(true);
      return;
    }
    if (!auth) {
      setAuthError("Firebase auth could not initialize.");
      setAuthReady(true);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (user) setAuthError(null);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authReady) return;

    if (!authUser) {
      setHistory([]);
      setRemaining([...names]);
      setLatestWinner(null);
      setSaveState("idle");
      setIsLoaded(true);
      return;
    }

    if (!spinDocRef) {
      setHistory([]);
      setRemaining([...names]);
      setLatestWinner(null);
      setFirebaseError(
        hasFirebaseConfig ? "Firebase is configured but Firestore could not initialize." : null,
      );
      setIsLoaded(true);
      return;
    }

    const loadState = async () => {
      try {
        const snapshot = await getDoc(spinDocRef);
        const persisted = snapshot.exists()
          ? (snapshot.data() as Partial<PersistedSpinState>)
          : null;

        const parsedHistory = Array.isArray(persisted?.history)
          ? persisted.history.filter(
              (entry): entry is SpinResult =>
                typeof entry?.name === "string" &&
                typeof entry?.spunAt === "string" &&
                typeof entry?.round === "number",
            )
          : [];

        const parsedRemaining = Array.isArray(persisted?.remaining)
          ? persisted.remaining.filter((name): name is string => typeof name === "string")
          : [];

        const nameSet = new Set(names);
        const validRemaining = parsedRemaining.filter((name) => nameSet.has(name));

        setHistory(parsedHistory);
        setRemaining(validRemaining.length > 0 ? validRemaining : [...names]);
        setLatestWinner(
          parsedHistory.length > 0 ? parsedHistory[parsedHistory.length - 1].name : null,
        );
        setFirebaseError(null);
      } catch {
        setFirebaseError("Unable to load spin state from Firestore.");
        setHistory([]);
        setRemaining([...names]);
        setLatestWinner(null);
      } finally {
        setIsLoaded(true);
      }
    };

    void loadState();
  }, [authReady, authUser, names, spinDocRef]);

  useEffect(() => {
    if (!isLoaded || !spinDocRef || !authUser || !hasUserMutated.current) return;

    const persistState = async () => {
      try {
        setSaveState("saving");
        await setDoc(
          spinDocRef,
          { history, remaining, updatedAt: new Date().toISOString() },
          { merge: true },
        );
        setSaveState("saved");
        setFirebaseError(null);
      } catch (error) {
        setFirebaseError(`Unable to save spin state. ${getErrorMessage(error)}`);
        setSaveState("error");
      }
    };

    void persistState();
  }, [authUser, history, isLoaded, remaining, spinDocRef]);

  useEffect(() => {
    return () => {
      if (spinTimerRef.current !== null) clearTimeout(spinTimerRef.current);
    };
  }, []);

  const signIn = async () => {
    if (!auth || !googleProvider) {
      setAuthError("Firebase auth is not available.");
      return;
    }
    try {
      setIsAuthBusy(true);
      setAuthError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setAuthError(`Sign-in failed. ${getErrorMessage(error)}`);
    } finally {
      setIsAuthBusy(false);
    }
  };

  const signOutUser = async () => {
    if (!auth) return;
    try {
      setIsAuthBusy(true);
      await signOut(auth);
    } catch (error) {
      setAuthError(`Sign-out failed. ${getErrorMessage(error)}`);
    } finally {
      setIsAuthBusy(false);
    }
  };

  const segmentAngle = names.length > 0 ? 360 / names.length : 360;

  const spin = (confirmedToday: boolean) => {
    if (isSpinning || names.length === 0) return;
    if (!authUser) {
      setAuthError("Sign in to spin and save results.");
      return;
    }
    if (hasSpunToday && !confirmedToday) return;

    const currentPool = remaining.length > 0 ? remaining : [...names];
    const randomIndex = Math.floor(Math.random() * currentPool.length);
    const winner = currentPool[randomIndex];
    const winnerIndex = names.indexOf(winner);
    if (winnerIndex < 0) return;

    const nextRemaining = currentPool.filter((name) => name !== winner);
    const round = Math.floor(history.length / Math.max(names.length, 1)) + 1;
    const nextHistory = [...history, { name: winner, spunAt: new Date().toISOString(), round }];

    const desiredModulo = (360 - (winnerIndex * segmentAngle + segmentAngle / 2)) % 360;
    const currentModulo = ((rotation % 360) + 360) % 360;
    const delta = (desiredModulo - currentModulo + 360) % 360;
    const fullTurns = (5 + Math.floor(Math.random() * 3)) * 360;

    hasUserMutated.current = true;
    setIsSpinning(true);
    setRotation((current) => current + fullTurns + delta);
    setHistory(nextHistory);
    setRemaining(nextRemaining);

    if (spinTimerRef.current !== null) clearTimeout(spinTimerRef.current);
    spinTimerRef.current = setTimeout(() => {
      setLatestWinner(winner);
      setIsSpinning(false);
      spinTimerRef.current = null;
    }, 2400);
  };

  const resetHistory = () => {
    hasUserMutated.current = true;
    setHistory([]);
    setRemaining([...names]);
    setLatestWinner(null);
    setIsSpinning(false);
    if (spinTimerRef.current !== null) {
      clearTimeout(spinTimerRef.current);
      spinTimerRef.current = null;
    }
  };

  const resetCurrentRound = () => {
    const currentRound = history.length > 0 ? history[history.length - 1].round : null;
    const nextHistory =
      currentRound === null ? history : history.filter((entry) => entry.round !== currentRound);

    hasUserMutated.current = true;
    setHistory(nextHistory);
    setRemaining([...names]);
    setLatestWinner(nextHistory.length > 0 ? nextHistory[nextHistory.length - 1].name : null);
    setIsSpinning(false);
  };

  return {
    authUser,
    authReady,
    isAuthBusy,
    authError,
    isLoaded,
    remaining,
    history,
    rotation,
    isSpinning,
    latestWinner,
    firebaseError,
    saveState,
    nameToCount,
    hasSpunToday,
    segmentAngle,
    signIn,
    signOutUser,
    spin,
    resetHistory,
    resetCurrentRound,
  };
}
