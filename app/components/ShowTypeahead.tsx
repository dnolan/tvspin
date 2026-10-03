import { useId, useMemo, useState } from "react";
import type { Show } from "@/app/hooks/useWatchLog";

type Props = {
  shows: Show[];
  value: string;
  onChange: (value: string) => void;
  /** Fired only when a suggestion is picked, not while typing. */
  onSelect?: (show: Show) => void;
  disabled?: boolean;
};

const MAX_SUGGESTIONS = 8;

export function ShowTypeahead({ shows, value, onChange, onSelect, disabled }: Props) {
  const listId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const query = value.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!query) return [];
    const prefix: Show[] = [];
    const contains: Show[] = [];
    for (const show of shows) {
      if (show.titleLower.startsWith(query)) prefix.push(show);
      else if (show.titleLower.includes(query)) contains.push(show);
    }
    return [...prefix, ...contains].slice(0, MAX_SUGGESTIONS);
  }, [query, shows]);

  const isExactMatch = shows.some((show) => show.titleLower === query);
  const showDropdown = isOpen && query.length > 0 && (matches.length > 0 || !isExactMatch);

  const select = (show: Show) => {
    onChange(show.title);
    onSelect?.(show);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) {
      if (event.key === "ArrowDown") setIsOpen(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (matches.length === 0 ? -1 : (i + 1) % matches.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (matches.length === 0 ? -1 : (i - 1 + matches.length) % matches.length));
    } else if (event.key === "Enter" && activeIndex >= 0 && matches[activeIndex]) {
      event.preventDefault();
      select(matches[activeIndex]);
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        placeholder="Show title"
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
        className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm disabled:opacity-50"
      />
      {showDropdown ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-white/10 bg-background py-1 text-sm shadow-lg"
        >
          {matches.map((show, index) => (
            <li
              key={show.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              // mousedown (not click) so it fires before the input's blur closes the list
              onMouseDown={(event) => {
                event.preventDefault();
                select(show);
              }}
              className={`cursor-pointer px-3 py-1.5 ${
                index === activeIndex ? "bg-white/10" : "hover:bg-white/5"
              }`}
            >
              {show.title}
            </li>
          ))}
          {!isExactMatch ? (
            <li className="px-3 py-1.5 text-xs opacity-60">
              Add &ldquo;{value.trim()}&rdquo; as new show
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
