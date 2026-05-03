"use client";

import { useMemo, useState } from "react";
import { hasFirebaseConfig } from "@/lib/firebase";
import { AllotmentTracker } from "@/app/components/AllotmentTracker";
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

  const handleResetHistory = () => {
    const shouldReset = window.confirm(
      "This will clear all spin history and restart everything. Continue?",
    );
    if (shouldReset) resetHistory();
  };

  const handleResetCurrentRound = () => {
    const shouldReset = window.confirm(
      "This will reset only the current round pool. History will be kept. Continue?",
    );
    if (shouldReset) resetCurrentRound();
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center gap-8 px-6 py-10">
      <h1 className="text-center text-3xl font-bold tracking-tight">TV Spin Picker</h1>

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
                  disabled={isSpinning || !authUser || !authReady}
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
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm uppercase tracking-wide opacity-70">Current TV Chooser</p>
                <p className="mt-2 text-3xl font-bold">
                  {isSpinning ? "Spinning..." : latestWinner ?? "Press spin"}
                </p>
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

              <SpinHistory history={history} />

              <AllotmentTracker names={names} nameToCount={nameToCount} />

              {hasFirebaseConfig ? (
                <section className="w-full rounded-xl border border-white/15 bg-black/20 p-4">
                  {!authReady ? (
                    <p className="text-sm opacity-80">Checking sign-in status...</p>
                  ) : authUser ? (
                    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                      <p className="text-sm">
                        Signed in as{" "}
                        <span className="font-semibold">
                          {authUser.email ?? authUser.displayName ?? "Firebase user"}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={signOutUser}
                        disabled={isAuthBusy}
                        className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isAuthBusy ? "Working..." : "Sign Out"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                      <p className="text-sm opacity-80">
                        Sign in with Google to spin and sync your own history.
                      </p>
                      <button
                        type="button"
                        onClick={signIn}
                        disabled={isAuthBusy}
                        className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isAuthBusy ? "Signing in..." : "Sign In"}
                      </button>
                    </div>
                  )}
                </section>
              ) : null}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
