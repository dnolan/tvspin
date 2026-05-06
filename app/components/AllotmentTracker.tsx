type Props = {
  names: string[];
  nameToCount: Map<string, number>;
};

export function AllotmentTracker({ names, nameToCount }: Props) {
  return (
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
  );
}
