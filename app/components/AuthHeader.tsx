import type { User } from "firebase/auth";

type Props = {
  authReady: boolean;
  authUser: User | null;
  isAuthBusy: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
};

export function AuthHeader({ authReady, authUser, isAuthBusy, onSignIn, onSignOut }: Props) {
  return (
    <header className="flex w-full items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <span className="text-sm font-semibold tracking-tight opacity-80">TV Spin Picker</span>

      {!authReady ? (
        <span className="text-xs opacity-50">Checking sign-in…</span>
      ) : authUser ? (
        <div className="flex items-center gap-3">
          <span className="text-sm opacity-70">
            {authUser.email ?? authUser.displayName ?? "Signed in"}
          </span>
          <button
            type="button"
            onClick={onSignOut}
            disabled={isAuthBusy}
            className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAuthBusy ? "…" : "Sign Out"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onSignIn}
          disabled={isAuthBusy}
          className="rounded-full bg-foreground px-4 py-1.5 text-xs font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isAuthBusy ? "Signing in…" : "Sign In with Google"}
        </button>
      )}
    </header>
  );
}
