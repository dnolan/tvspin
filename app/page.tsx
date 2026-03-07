"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, hasFirebaseConfig } from "@/lib/firebase";

type SpinResult = {
  name: string;
  spunAt: string;
  round: number;
};

type PersistedSpinState = {
  history: SpinResult[];
  remaining: string[];
};

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const code = "code" in error ? String(error.code) : null;
    const message = "message" in error ? String(error.message) : "Unknown Firebase error";
    return code ? `${code}: ${message}` : message;
  }

  return String(error);
}

function parseNames(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  const uniqueNames = new Set(
    raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );

  return [...uniqueNames];
}

function getPalette(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const hue = Math.round((index * 360) / Math.max(count, 1));
    const saturation = index % 2 === 0 ? 78 : 70;
    const lightness = index % 2 === 0 ? 54 : 46;
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  });
}

export default function Home() {
  const firestoreDocId = process.env.NEXT_PUBLIC_TV_SPIN_DOC_ID || "default";
  const spinDocRef = useMemo(() => {
    if (!db) {
      return null;
    }

    return doc(db, "tvspin", firestoreDocId);
  }, [firestoreDocId]);
  const names = useMemo(
    () => parseNames(process.env.NEXT_PUBLIC_TV_NAMES),
    [],
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const [remaining, setRemaining] = useState<string[]>([]);
  const [history, setHistory] = useState<SpinResult[]>([]);
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [latestWinner, setLatestWinner] = useState<string | null>(null);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const nameToCount = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const name of names) {
      countMap.set(name, 0);
    }

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
    if (!spinDocRef) {
      setHistory([]);
      setRemaining([...names]);
      setLatestWinner(null);
      setFirebaseError(hasFirebaseConfig ? "Firebase is configured but Firestore could not initialize." : null);
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
  }, [names, spinDocRef]);

  useEffect(() => {
    if (!isLoaded || !spinDocRef) {
      return;
    }

    const persistState = async () => {
      try {
        setSaveState("saving");
        await setDoc(
          spinDocRef,
          {
            history,
            remaining,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
        setSaveState("saved");
        setFirebaseError(null);
      } catch (error) {
        const message = getErrorMessage(error);
        setFirebaseError(`Unable to save spin state. ${message}`);
        setSaveState("error");
        // Keep the UI interactive while still surfacing the failure.
      }
    };

    void persistState();
  }, [history, isLoaded, remaining, spinDocRef]);

  const segmentAngle = names.length > 0 ? 360 / names.length : 360;
  const colors = useMemo(() => getPalette(names.length), [names.length]);
  const wheelBackground = useMemo(() => {
    if (names.length === 0) {
      return "#1f2937";
    }

    const stops = names
      .map((_, index) => {
        const start = index * segmentAngle;
        const end = start + segmentAngle;
        return `${colors[index]} ${start}deg ${end}deg`;
      })
      .join(", ");

    return `conic-gradient(from -90deg, ${stops})`;
  }, [colors, names, segmentAngle]);

  const dividerAngles = useMemo(
    () => names.map((_, index) => index * segmentAngle),
    [names, segmentAngle],
  );

  const wheelLabels = useMemo(() => {
    if (names.length === 0) {
      return [];
    }

    const radiusPercent = names.length > 10 ? 34 : 37;

    return names.map((name, index) => {
      const midpoint = -90 + index * segmentAngle + segmentAngle / 2;
      const radians = (midpoint * Math.PI) / 180;
      const x = 50 + Math.cos(radians) * radiusPercent;
      const y = 50 + Math.sin(radians) * radiusPercent;
      return {
        name,
        x,
        y,
      };
    });
  }, [names, segmentAngle]);

  const spin = () => {
    if (isSpinning || names.length === 0) {
      return;
    }

    if (hasSpunToday) {
      const shouldContinue = window.confirm(
        "A spin has already been recorded today. Do you want to continue?",
      );

      if (!shouldContinue) {
        return;
      }
    }

    const currentPool = remaining.length > 0 ? remaining : [...names];
    const randomIndex = Math.floor(Math.random() * currentPool.length);
    const winner = currentPool[randomIndex];
    const winnerIndex = names.indexOf(winner);

    if (winnerIndex < 0) {
      return;
    }

    const nextRemaining = currentPool.filter((name) => name !== winner);
    const round = Math.floor(history.length / Math.max(names.length, 1)) + 1;
    const nextHistory = [
      ...history,
      {
        name: winner,
        spunAt: new Date().toISOString(),
        round,
      },
    ];

    const desiredModulo = (360 - (winnerIndex * segmentAngle + segmentAngle / 2)) % 360;
    const currentModulo = ((rotation % 360) + 360) % 360;
    const delta = (desiredModulo - currentModulo + 360) % 360;
    const fullTurns = (5 + Math.floor(Math.random() * 3)) * 360;

    setIsSpinning(true);
    setLatestWinner(winner);
    setRotation((current) => current + fullTurns + delta);
    setHistory(nextHistory);
    setRemaining(nextRemaining);

    window.setTimeout(() => {
      setIsSpinning(false);
    }, 2400);
  };

  const resetHistory = () => {
    const shouldReset = window.confirm(
      "This will clear all spin history and restart everything. Continue?",
    );

    if (!shouldReset) {
      return;
    }

    setHistory([]);
    setRemaining([...names]);
    setLatestWinner(null);
    setIsSpinning(false);
  };

  const resetCurrentRound = () => {
    const shouldResetRound = window.confirm(
      "This will reset only the current round pool. History will be kept. Continue?",
    );

    if (!shouldResetRound) {
      return;
    }

    const currentRound = history.length > 0 ? history[history.length - 1].round : null;
    const nextHistory =
      currentRound === null
        ? history
        : history.filter((entry) => entry.round !== currentRound);

    setHistory(nextHistory);
    setRemaining([...names]);
    setLatestWinner(nextHistory.length > 0 ? nextHistory[nextHistory.length - 1].name : null);
    setIsSpinning(false);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center gap-8 px-6 py-10">
      <h1 className="text-center text-3xl font-bold tracking-tight">TV Spin Picker</h1>

      {names.length === 0 ? (
        <section className="w-full max-w-2xl rounded-xl border border-white/10 bg-black/20 p-6 text-center">
          <p className="text-lg font-semibold">No names configured.</p>
          <p className="mt-2 text-sm opacity-80">
            Set <code>NEXT_PUBLIC_TV_NAMES</code> in <code>.env.local</code> using
            a comma-separated list, then restart the dev server.
          </p>
        </section>
      ) : (
        <>
          {!hasFirebaseConfig ? (
            <section className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center text-sm">
              Configure <code>NEXT_PUBLIC_FIREBASE_*</code> env vars to persist spins in
              Firestore. Until then, data will only last for this page session.
            </section>
          ) : null}

          {firebaseError ? (
            <section className="w-full rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm">
              {firebaseError}
            </section>
          ) : null}

          <section className="grid w-full gap-8 lg:grid-cols-[360px_1fr] lg:items-start">
            <div className="mx-auto flex w-full max-w-[360px] flex-col items-center gap-4">
              <div className="relative h-[320px] w-[320px]">
                <div className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 border-l-[12px] border-r-[12px] border-t-[22px] border-l-transparent border-r-transparent border-t-red-500" />

                <div
                  className="absolute inset-0 overflow-hidden rounded-full transition-transform duration-[2400ms] ease-out"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    background: wheelBackground,
                    backfaceVisibility: "hidden",
                    willChange: "transform",
                  }}
                >
                  {dividerAngles.map((angle) => (
                    <span
                      key={`divider-${angle}`}
                      className="absolute left-1/2 top-1/2 h-1/2 w-[2px] bg-white/90 shadow-[0_0_2px_rgba(0,0,0,0.35)]"
                      style={{
                        transform: `translate(-50%, -100%) rotate(${angle}deg)`,
                        transformOrigin: "center bottom",
                      }}
                    />
                  ))}

                  {wheelLabels.map((label) => (
                    <span
                      key={label.name}
                      className="absolute rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-semibold text-white shadow"
                      style={{
                        left: `${label.x}%`,
                        top: `${label.y}%`,
                        transform: `translate(-50%, -50%) rotate(${-rotation}deg)`,
                      }}
                    >
                      {label.name}
                    </span>
                  ))}
                </div>

                <div className="pointer-events-none absolute inset-0 rounded-full border-8 border-white/20 shadow-[0_0_0_2px_rgba(0,0,0,0.35)_inset]" />

                <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/25 bg-black/50" />
              </div>

              <button
                type="button"
                onClick={spin}
                disabled={isSpinning}
                className="rounded-full bg-foreground px-8 py-3 font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSpinning ? "Spinning..." : "Spin"}
              </button>

              <button
                type="button"
                onClick={resetHistory}
                className="rounded-full border border-white/20 px-6 py-2 text-sm font-semibold"
              >
                Reset History
              </button>

              <button
                type="button"
                onClick={resetCurrentRound}
                className="rounded-full border border-white/20 px-6 py-2 text-sm font-semibold"
              >
                Reset Current Round
              </button>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm uppercase tracking-wide opacity-70">Next TV choice</p>
                <p className="mt-2 text-3xl font-bold">
                  {latestWinner ?? "Press spin"}
                </p>
                <p className="mt-2 text-sm opacity-75">
                  Remaining this round: {remaining.length === 0 ? names.length : remaining.length}
                </p>
                {hasFirebaseConfig ? (
                  <p className="mt-1 text-xs opacity-70">
                    Sync status: {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving..." : saveState === "error" ? "Error" : "Idle"}
                  </p>
                ) : null}
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm uppercase tracking-wide opacity-70">Equal allotment tracker</p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {names.map((name) => (
                    <li
                      key={name}
                      className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2"
                    >
                      <span>{name}</span>
                      <span className="text-sm opacity-80">{nameToCount.get(name) ?? 0} picks</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm uppercase tracking-wide opacity-70">Spin history</p>
                {history.length === 0 ? (
                  <p className="mt-3 text-sm opacity-70">No spins yet.</p>
                ) : (
                  <ul className="mt-3 max-h-64 space-y-2 overflow-auto pr-2 text-sm">
                    {[...history].reverse().map((entry, index) => (
                      <li
                        key={`${entry.spunAt}-${index}`}
                        className="rounded-lg border border-white/10 px-3 py-2"
                      >
                        Round {entry.round}: {entry.name} · {new Date(entry.spunAt).toLocaleString()}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
