type Props = {
  value: number | undefined;
  disabled?: boolean;
  onChange: (value: number | null) => void;
};

export function StarRating({ value, disabled, onChange }: Props) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value !== undefined && n <= value;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-label={`Rate ${n} of 5`}
            aria-pressed={value === n}
            onClick={() => onChange(value === n ? null : n)}
            className={`text-lg leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              filled ? "text-amber-400" : "text-white/30 hover:text-amber-200"
            }`}
          >
            {filled ? "★" : "☆"}
          </button>
        );
      })}
    </div>
  );
}
