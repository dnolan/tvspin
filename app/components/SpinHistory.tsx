import type { SpinResult } from "@/app/hooks/useSpinState";

type Props = {
  history: SpinResult[];
  onLogWatch?: (entry: SpinResult) => void;
};

export function SpinHistory({ history, onLogWatch }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-sm uppercase tracking-wide opacity-70">Spin history</p>
      {history.length === 0 ? (
        <p className="mt-3 text-sm opacity-70">No spins yet.</p>
      ) : (
        <ul className="mt-3 max-h-64 space-y-2 overflow-auto pr-2 text-sm">
          {[...history].reverse().map((entry, index) => (
            <li
              key={`${entry.spunAt}-${index}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2"
            >
              <span>
                Round {entry.round}: {entry.name} · {new Date(entry.spunAt).toLocaleString()}
              </span>
              {onLogWatch ? (
                <button
                  type="button"
                  onClick={() => onLogWatch(entry)}
                  className="shrink-0 rounded-full border border-white/20 px-3 py-1 text-xs font-semibold"
                >
                  + Watch
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
