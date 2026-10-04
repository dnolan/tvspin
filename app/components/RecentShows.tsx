import { useMemo } from "react";
import type { WatchEntry } from "@/app/hooks/useWatchLog";

type Props = {
  watches: WatchEntry[];
};

type ShowSummary = {
  key: string;
  title: string;
  count: number;
  last: WatchEntry;
  average: number | null;
};

const MAX_SHOWS = 10;

function formatShortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function formatEpisode(entry: WatchEntry): string | null {
  if (entry.season === undefined && entry.episode === undefined) return null;
  return `${entry.season !== undefined ? `S${entry.season}` : ""}${
    entry.episode !== undefined ? `E${entry.episode}` : ""
  }`;
}

/** Shows from the recent watch log, most-watched first, then most recently watched. */
export function RecentShows({ watches }: Props) {
  const summaries = useMemo(() => {
    const byShow = new Map<string, { entries: WatchEntry[] }>();
    // watches arrive newest first, so entries[0] is the latest watch of each show
    for (const entry of watches) {
      const key = entry.showId || entry.showTitle.toLowerCase();
      const group = byShow.get(key) ?? { entries: [] };
      group.entries.push(entry);
      byShow.set(key, group);
    }

    const result: ShowSummary[] = [...byShow.entries()].map(([key, { entries }]) => {
      const scores = entries.flatMap((e) => Object.values(e.ratings));
      return {
        key,
        title: entries[0].showTitle,
        count: entries.length,
        last: entries[0],
        average: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
      };
    });

    return result
      .sort(
        (a, b) =>
          b.count - a.count ||
          b.last.date.localeCompare(a.last.date) ||
          b.last.createdAt.localeCompare(a.last.createdAt),
      )
      .slice(0, MAX_SHOWS);
  }, [watches]);

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-sm uppercase tracking-wide opacity-70">Recent shows</p>
      {summaries.length === 0 ? (
        <p className="mt-3 text-sm opacity-70">Nothing watched yet.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {summaries.map((show) => {
            const episode = formatEpisode(show.last);
            return (
              <li
                key={show.key}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{show.title}</p>
                  <p className="text-xs opacity-60">
                    Last {episode ? `${episode} · ` : ""}
                    {formatShortDate(show.last.date)}
                    {show.average !== null ? ` · ★ ${show.average.toFixed(1)}` : ""}
                  </p>
                </div>
                {show.count > 1 ? (
                  <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold">
                    {show.count} watches
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
