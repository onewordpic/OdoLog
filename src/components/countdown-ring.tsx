import { useMemo } from "react";

interface CountdownRingProps {
  daysLeft: number;
  size?: number;
  stroke?: number;
}

export function CountdownRing({ daysLeft, size = 48, stroke = 4 }: CountdownRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const { fraction, color } = useMemo(() => {
    const totalDays = 365;
    const clamped = Math.max(0, Math.min(totalDays, daysLeft));
    const frac = clamped / totalDays;
    let col = "#22c55e"; // green
    if (daysLeft <= 30) col = "#f59e0b"; // amber
    if (daysLeft < 0) col = "#ef4444"; // red
    return { fraction: frac, color: col };
  }, [daysLeft]);

  const offset = circumference * (1 - fraction);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          className="text-foreground/10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums">
        {daysLeft < 0 ? `+${Math.abs(daysLeft)}` : daysLeft}
      </span>
    </div>
  );
}
