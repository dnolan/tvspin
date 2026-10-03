import { useState } from "react";
import type { SpinResult } from "@/app/hooks/useSpinState";
import type { Show, WatchEntry, WatchInput } from "@/app/hooks/useWatchLog";
import { ShowTypeahead } from "@/app/components/ShowTypeahead";
import { StarRating } from "@/app/components/StarRating";
import { toDateKey } from "@/lib/dates";

/** A request to open the form. `key` changes on every open so the form remounts with fresh values. */
export type WatchDraft = { key: number; date: string; chooser?: string; entryId?: string };

type Props = {
  names: string[];
  history: SpinResult[];
  watches: WatchEntry[];
  shows: Show[];
  canEdit: boolean;
  draft: WatchDraft | null;
  onOpenDraft: (draft: Omit<WatchDraft, "key">) => void;
  onCloseDraft: () => void;
  onSave: (input: WatchInput, entryId?: string) => Promise<boolean>;
  onRate: (entryId: string, name: string, value: number | null) => void;
  onDelete: (entryId: string) => void;
};

type FormState = {
  date: string;
  showTitle: string;
  season: string;
  episode: string;
  chooser: string;
};

function spinWinnerFor(history: SpinResult[], date: string): string {
  for (let i = history.length - 1; i >= 0; i--) {
    if (toDateKey(new Date(history[i].spunAt)) === date) return history[i].name;
  }
  return "";
}

function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatEpisode(entry: WatchEntry): string | null {
  if (entry.season === undefined && entry.episode === undefined) return null;
  return `${entry.season !== undefined ? `S${entry.season}` : ""}${
    entry.episode !== undefined ? `E${entry.episode}` : ""
  }`;
}

type EpisodeSuggestion = { season: string; episode: string; from: WatchEntry };

/** Same season, next episode, based on the most recent watch of this show up to `date`. */
function suggestNextEpisode(
  watches: WatchEntry[],
  showTitle: string,
  date: string,
  excludeId?: string,
): EpisodeSuggestion | null {
  const title = showTitle.trim().toLowerCase();
  if (!title) return null;
  // watches arrive newest first (and latest-added first within a day)
  const last = watches.find(
    (w) => w.id !== excludeId && w.date <= date && w.showTitle.toLowerCase() === title,
  );
  if (!last || (last.season === undefined && last.episode === undefined)) return null;
  return {
    season: last.season?.toString() ?? "",
    episode: last.episode !== undefined ? String(last.episode + 1) : "",
    from: last,
  };
}

function parsePositiveInt(raw: string): number | undefined {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

type WatchFormProps = {
  initial: FormState;
  names: string[];
  shows: Show[];
  canEdit: boolean;
  isEditing: boolean;
  chooserForDate: (date: string) => string;
  suggestEpisode: (showTitle: string, date: string) => EpisodeSuggestion | null;
  onSave: (input: WatchInput) => Promise<boolean>;
  onClose: () => void;
};

function WatchForm({
  initial,
  names,
  shows,
  canEdit,
  isEditing,
  chooserForDate,
  suggestEpisode,
  onSave,
  onClose,
}: WatchFormProps) {
  const [form, setForm] = useState<FormState>(initial);
  const [isSaving, setIsSaving] = useState(false);
  // Set while season/episode hold an auto-fill, so changing show can replace it;
  // cleared as soon as either field is edited by hand.
  const [autoFilledFrom, setAutoFilledFrom] = useState<WatchEntry | null>(null);

  // Typing never auto-fills; it only drops a previous auto-fill that no longer applies.
  const handleShowChange = (showTitle: string) => {
    if (autoFilledFrom !== null) {
      setForm({ ...form, showTitle, season: "", episode: "" });
      setAutoFilledFrom(null);
    } else {
      setForm({ ...form, showTitle });
    }
  };

  // Picking a suggestion auto-fills, unless season/episode were entered by hand.
  const handleShowSelect = (show: Show) => {
    const canAutoFill = autoFilledFrom !== null || (!form.season && !form.episode);
    if (!canAutoFill) {
      setForm({ ...form, showTitle: show.title });
      return;
    }
    const suggestion = suggestEpisode(show.title, form.date);
    setForm({
      ...form,
      showTitle: show.title,
      season: suggestion?.season ?? "",
      episode: suggestion?.episode ?? "",
    });
    setAutoFilledFrom(suggestion?.from ?? null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    const ok = await onSave({
      date: form.date,
      showTitle: form.showTitle,
      season: parsePositiveInt(form.season),
      episode: parsePositiveInt(form.episode),
      chooser: form.chooser || undefined,
    });
    setIsSaving(false);
    if (ok) onClose();
  };

  const inputClass =
    "rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm disabled:opacity-50";

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid gap-2 sm:grid-cols-2">
      <input
        type="date"
        required
        value={form.date}
        max={toDateKey(new Date())}
        disabled={!canEdit}
        onChange={(event) => {
          const date = event.target.value;
          if (!date) return;
          // Follow the new day's spin winner unless the chooser was changed by hand.
          const chooserIsDefault = !isEditing && form.chooser === chooserForDate(form.date);
          setForm({ ...form, date, chooser: chooserIsDefault ? chooserForDate(date) : form.chooser });
        }}
        aria-label="Date watched"
        className={inputClass}
      />
      <select
        value={form.chooser}
        disabled={!canEdit}
        onChange={(event) => setForm({ ...form, chooser: event.target.value })}
        aria-label="Picked by"
        className={inputClass}
      >
        <option value="" className="bg-background text-foreground">
          Picked by —
        </option>
        {names.map((name) => (
          <option key={name} value={name} className="bg-background text-foreground">
            Picked by {name}
          </option>
        ))}
      </select>
      <div className="sm:col-span-2">
        <ShowTypeahead
          shows={shows}
          value={form.showTitle}
          disabled={!canEdit}
          onChange={handleShowChange}
          onSelect={handleShowSelect}
        />
      </div>
      <input
        type="number"
        min={1}
        placeholder="Season (optional)"
        value={form.season}
        disabled={!canEdit}
        onChange={(event) => {
          setForm({ ...form, season: event.target.value });
          setAutoFilledFrom(null);
        }}
        className={inputClass}
      />
      <input
        type="number"
        min={1}
        placeholder="Episode (optional)"
        value={form.episode}
        disabled={!canEdit}
        onChange={(event) => {
          setForm({ ...form, episode: event.target.value });
          setAutoFilledFrom(null);
        }}
        className={inputClass}
      />
      {autoFilledFrom ? (
        <p className="text-xs opacity-60 sm:col-span-2">
          Continuing from {formatEpisode(autoFilledFrom)} on {formatDate(autoFilledFrom.date)}
        </p>
      ) : null}
      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={!canEdit || isSaving || !form.showTitle.trim()}
          className="flex-1 rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Saving..." : isEditing ? "Update" : "Save"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function WatchLog({
  names,
  history,
  watches,
  shows,
  canEdit,
  draft,
  onOpenDraft,
  onCloseDraft,
  onSave,
  onRate,
  onDelete,
}: Props) {
  const editingEntry = draft?.entryId ? watches.find((w) => w.id === draft.entryId) : undefined;

  const initialForm = (d: WatchDraft): FormState =>
    editingEntry
      ? {
          date: editingEntry.date,
          showTitle: editingEntry.showTitle,
          season: editingEntry.season?.toString() ?? "",
          episode: editingEntry.episode?.toString() ?? "",
          chooser: editingEntry.chooser ?? "",
        }
      : {
          date: d.date,
          showTitle: "",
          season: "",
          episode: "",
          chooser: d.chooser ?? spinWinnerFor(history, d.date),
        };

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm uppercase tracking-wide opacity-70">Watch log</p>
        {canEdit && !draft ? (
          <button
            type="button"
            onClick={() => onOpenDraft({ date: toDateKey(new Date()) })}
            className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold"
          >
            + Add
          </button>
        ) : null}
      </div>

      {draft ? (
        <WatchForm
          key={draft.key}
          initial={initialForm(draft)}
          names={names}
          shows={shows}
          canEdit={canEdit}
          isEditing={editingEntry !== undefined}
          chooserForDate={(date) => spinWinnerFor(history, date)}
          suggestEpisode={(showTitle, date) =>
            suggestNextEpisode(watches, showTitle, date, editingEntry?.id)
          }
          onSave={(input) => onSave(input, editingEntry?.id)}
          onClose={onCloseDraft}
        />
      ) : null}

      {watches.length === 0 ? (
        <p className="mt-4 text-sm opacity-70">Nothing logged yet.</p>
      ) : (
        <ul className="mt-4 max-h-[32rem] space-y-3 overflow-auto pr-2 text-sm">
          {watches.map((entry) => {
            const scores = Object.values(entry.ratings);
            const average =
              scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
            const episode = formatEpisode(entry);
            return (
              <li key={entry.id} className="rounded-lg border border-white/10 px-3 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-xs opacity-60">{formatDate(entry.date)}</p>
                    <p className="font-semibold">
                      {entry.showTitle}
                      {episode ? <span className="ml-2 opacity-70">{episode}</span> : null}
                    </p>
                    {entry.chooser ? (
                      <p className="text-xs opacity-60">picked by {entry.chooser}</p>
                    ) : null}
                  </div>
                  <span className="text-sm opacity-80">
                    {average !== null ? `★ ${average.toFixed(1)}` : "Unrated"}
                  </span>
                </div>

                <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                  {names.map((name) => (
                    <li key={name} className="flex items-center justify-between gap-2">
                      <span className="opacity-80">{name}</span>
                      <StarRating
                        value={entry.ratings[name]}
                        disabled={!canEdit}
                        onChange={(value) => onRate(entry.id, name, value)}
                      />
                    </li>
                  ))}
                </ul>

                {canEdit ? (
                  pendingDelete === entry.id ? (
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span>Delete this entry?</span>
                      <button
                        type="button"
                        onClick={() => {
                          onDelete(entry.id);
                          setPendingDelete(null);
                        }}
                        className="rounded-full bg-red-500 px-3 py-1 font-semibold text-white"
                      >
                        Yes, delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(null)}
                        className="rounded-full border border-white/20 px-3 py-1 font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => onOpenDraft({ date: entry.date, entryId: entry.id })}
                        className="rounded-full border border-white/20 px-3 py-1 font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(entry.id)}
                        className="rounded-full border border-white/20 px-3 py-1 font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
