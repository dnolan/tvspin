"use client";

import { useMemo, useState } from "react";
import { hasFirebaseConfig } from "@/lib/firebase";
import { AllotmentTracker } from "@/app/components/AllotmentTracker";
import { AuthHeader } from "@/app/components/AuthHeader";
import { SpinHistory } from "@/app/components/SpinHistory";
import { SpinWheel } from "@/app/components/SpinWheel";
import { useSpinState } from "@/app/hooks/useSpinState";

function parseNames(raw: string | undefined): string[] {
  if (!raw) return [];
  const uniqueNames = new Set(
    raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );
  return [...uniqueNames];
}

export default function Home() {
  const names = useMemo(() => parseNames(process.env.NEXT_PUBLIC_TV_NAMES), []);
  const [pendingSpinConfirm, setPendingSpinConfirm] = useState(false);
  const [pendingReset, setPendingReset] = useState<"history" | "round" | null>(null);

  const {
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
    signIn,
    signOutUser,
    spin,
    resetHistory,
    resetCurrentRound,
  } = useSpinState(names);

  const handleSpin = () => {
    if (hasSpunToday && !pendingSpinConfirm) {
      setPendingSpinConfirm(true);
      return;
    }
    setPendingSpinConfirm(false);
    spin(true);
  };

  const handleResetHistory = () => setPendingReset("history");
  const handleResetCurrentRound = () => setPendingReset("round");

  const confirmReset = () => {
    if (pendingReset === "history") resetHistory();
    else if (pendingReset === "round") resetCurrentRound();
    setPendingReset(null);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center gap-8 px-6 py-10">
      {hasFirebaseConfig ? (
        <AuthHeader
          authReady={authReady}
          authUser={authUser}
          isAuthBusy={isAuthBusy}
          onSignIn={signIn}
          onSignOut={signOutUser}
        />
      ) : (
        <h1 className="text-center text-3xl font-bold tracking-tight">TV Spin Picker</h1>
      )}

      {names.length === 0 ? (
        <section className="w-full max-w-2xl rounded-xl border border-white/10 bg-black/20 p-6 text-center">
          <p className="text-lg font-semibold">No names configured.</p>
          <p className="mt-2 text-sm opacity-80">
            Set <code>NEXT_PUBLIC_TV_NAMES</code> in <code>.env.local</code> using a
            comma-separated list, then restart the dev server.
          </p>
        </section>
      ) : (
        <>
          {!hasFirebaseConfig ? (
            <section className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center text-sm">
              Configure <code>NEXT_PUBLIC_FIREBASE_*</code> env vars to persist spins in Firestore.
              Until then, data will only last for this page session.
            </section>
          ) : null}

          {authError ? (
            <section className="w-full rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm">
              {authError}
            </section>
          ) : null}

          {firebaseError ? (
            <section className="w-full rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm">
              {firebaseError}
            </section>
          ) : null}

          <section className="grid w-full gap-8 lg:grid-cols-[360px_1fr] lg:items-start">
            <div className="mx-auto flex w-full max-w-[360px] flex-col items-center gap-4">
              <SpinWheel names={names} rotation={rotation} />

              {pendingSpinConfirm ? (
                <div className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center text-sm">
                  <p className="mb-3">A spin has already been recorded today. Continue?</p>
                  <div className="flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => { setPendingSpinConfirm(false); spin(true); }}
                      className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background"
                    >
                      Yes, spin
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingSpinConfirm(false)}
                      className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSpin}
                  disabled={isSpinning || !authUser || !authReady || !isLoaded}
                  className="rounded-full bg-foreground px-8 py-3 font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSpinning ? "Spinning..." : "Spin"}
                </button>
              )}

              <button
                type="button"
                onClick={handleResetHistory}
                disabled={!authUser}
                title={!authUser ? "Sign in to reset" : undefined}
                className="rounded-full border border-white/20 px-6 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reset History
              </button>

              <button
                type="button"
                onClick={handleResetCurrentRound}
                disabled={!authUser}
                title={!authUser ? "Sign in to reset" : undefined}
                className="rounded-full border border-white/20 px-6 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reset Current Round
              </button>

              {!authUser && authReady ? (
                <p className="text-center text-xs opacity-50">Sign in to use reset buttons</p>
              ) : null}

              {pendingReset ? (
                <div className="w-full rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center text-sm">
                  <p className="mb-3">
                    {pendingReset === "history"
                      ? "Clear all spin history and restart?"
                      : "Reset current round pool? History will be kept."}
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={confirmReset}
                      className="rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-white"
                    >
                      Yes, reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingReset(null)}
                      className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm uppercase tracking-wide opacity-70">Current TV Chooser</p>
                {authUser && !isLoaded ? (
                  <div className="mt-2 h-9 w-40 animate-pulse rounded-lg bg-white/5" />
                ) : (
                  <p className="mt-2 text-3xl font-bold">
                    {isSpinning ? "Spinning..." : latestWinner ?? "Press spin"}
                  </p>
                )}
                <p className="mt-2 text-sm opacity-75">
                  Remaining this round: {remaining.length === 0 ? names.length : remaining.length}
                </p>
                {hasFirebaseConfig ? (
                  <p className="mt-1 text-xs opacity-70">
                    Sync:{" "}
                    {saveState === "saved"
                      ? "Saved"
                      : saveState === "saving"
                        ? "Saving..."
                        : saveState === "error"
                          ? "Error"
                          : "Idle"}
                  </p>
                ) : null}
              </div>

              {authUser && !isLoaded ? (
                <>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm uppercase tracking-wide opacity-70">Spin history</p>
                    <div className="mt-3 space-y-2">
                      {[1, 2, 3].map((n) => (
                        <div
                          key={n}
                          className="h-9 animate-pulse rounded-lg border border-white/10 bg-white/5"
                        />
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm uppercase tracking-wide opacity-70">
                      Equal allotment tracker
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {names.map((name) => (
                        <div
                          key={name}
                          className="h-10 animate-pulse rounded-lg border border-white/10 bg-white/5"
                        />
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <SpinHistory history={history} />
                  <AllotmentTracker names={names} nameToCount={nameToCount} />
                </>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
