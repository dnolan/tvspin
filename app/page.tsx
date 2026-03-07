"use client";

import { useEffect, useMemo, useState } from "react";

type SpinResult = {
  name: string;
  spunAt: string;
  round: number;
};

const HISTORY_KEY = "tvspin.history";
const REMAINING_KEY = "tvspin.remaining";

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
    return `hsl(${hue} 75% 52%)`;
  });
}

export default function Home() {
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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const savedHistory = window.localStorage.getItem(HISTORY_KEY);
      const parsedHistory = savedHistory
        ? (JSON.parse(savedHistory) as SpinResult[])
        : [];

      const savedRemaining = window.localStorage.getItem(REMAINING_KEY);
      const parsedRemaining = savedRemaining
        ? (JSON.parse(savedRemaining) as string[])
        : [];

      const nameSet = new Set(names);
      const validRemaining = parsedRemaining.filter((name) => nameSet.has(name));

      setHistory(
        parsedHistory.filter((entry) =>
          typeof entry?.name === "string" &&
          typeof entry?.spunAt === "string" &&
          typeof entry?.round === "number",
        ),
      );
      setRemaining(validRemaining.length > 0 ? validRemaining : [...names]);
      setLatestWinner(
        parsedHistory.length > 0 ? parsedHistory[parsedHistory.length - 1].name : null,
      );
    } catch {
      setHistory([]);
      setRemaining([...names]);
      setLatestWinner(null);
    } finally {
      setIsLoaded(true);
    }
  }, [names]);

  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(REMAINING_KEY, JSON.stringify(remaining));
  }, [remaining, isLoaded]);

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

  const spin = () => {
    if (isSpinning || names.length === 0) {
      return;
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
    setHistory([]);
    setRemaining([...names]);
    setLatestWinner(null);
    setRotation(0);
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
          <section className="grid w-full gap-8 lg:grid-cols-[360px_1fr] lg:items-start">
            <div className="mx-auto flex w-full max-w-[360px] flex-col items-center gap-4">
              <div className="relative h-[320px] w-[320px]">
                <div className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 border-l-[12px] border-r-[12px] border-t-[22px] border-l-transparent border-r-transparent border-t-red-500" />

                <div
                  className="absolute inset-0 rounded-full border-8 border-white/20 transition-transform duration-[2400ms] ease-out"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    background: wheelBackground,
                  }}
                />

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
