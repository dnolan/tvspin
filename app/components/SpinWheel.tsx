import { useMemo } from "react";

type Props = {
  names: string[];
  rotation: number;
};

function getPalette(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const hue = Math.round((index * 360) / Math.max(count, 1));
    const saturation = index % 2 === 0 ? 78 : 70;
    const lightness = index % 2 === 0 ? 54 : 46;
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  });
}

export function SpinWheel({ names, rotation }: Props) {
  const segmentAngle = names.length > 0 ? 360 / names.length : 360;
  const colors = useMemo(() => getPalette(names.length), [names.length]);

  const wheelBackground = useMemo(() => {
    if (names.length === 0) return "#1f2937";
    const stops = names
      .map((_, index) => {
        const start = index * segmentAngle;
        const end = start + segmentAngle;
        return `${colors[index]} ${start}deg ${end}deg`;
      })
      .join(", ");
    return `conic-gradient(from -90deg, ${stops})`;
  }, [colors, names, segmentAngle]);

  const dividerAngles = useMemo(
    () => names.map((_, index) => index * segmentAngle),
    [names, segmentAngle],
  );

  const wheelLabels = useMemo(() => {
    if (names.length === 0) return [];
    const radiusPercent = names.length > 10 ? 34 : 37;
    return names.map((name, index) => {
      const midpoint = -90 + index * segmentAngle + segmentAngle / 2;
      const radians = (midpoint * Math.PI) / 180;
      return {
        name,
        x: 50 + Math.cos(radians) * radiusPercent,
        y: 50 + Math.sin(radians) * radiusPercent,
      };
    });
  }, [names, segmentAngle]);

  return (
    <div className="relative h-[320px] w-[320px]">
      {/* pointer */}
      <div className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 border-l-[12px] border-r-[12px] border-t-[22px] border-l-transparent border-r-transparent border-t-red-500" />

      {/* spinning disc */}
      <div
        className="absolute inset-0 overflow-hidden rounded-full transition-transform duration-[2400ms] ease-out"
        style={{
          transform: `rotate(${rotation}deg)`,
          background: wheelBackground,
          backfaceVisibility: "hidden",
          willChange: "transform",
        }}
      >
        {dividerAngles.map((angle) => (
          <span
            key={`divider-${angle}`}
            className="absolute left-1/2 top-1/2 h-1/2 w-[2px] bg-white/90 shadow-[0_0_2px_rgba(0,0,0,0.35)]"
            style={{
              transform: `translate(-50%, -100%) rotate(${angle}deg)`,
              transformOrigin: "center bottom",
            }}
          />
        ))}

        {/* Labels counter-rotate with matching easing so text stays upright during spin */}
        {wheelLabels.map((label) => (
          <span
            key={label.name}
            className="absolute rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-semibold text-white shadow"
            style={{
              left: `${label.x}%`,
              top: `${label.y}%`,
              transform: `translate(-50%, -50%) rotate(${-rotation}deg)`,
              transition: "transform 2400ms ease-out",
            }}
          >
            {label.name}
          </span>
        ))}
      </div>

      {/* rim */}
      <div className="pointer-events-none absolute inset-0 rounded-full border-8 border-white/20 shadow-[0_0_0_2px_rgba(0,0,0,0.35)_inset]" />

      {/* centre hub */}
      <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/25 bg-black/50" />
    </div>
  );
}
