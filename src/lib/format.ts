// Shared display formatters (INR, distance, dates) — keeps number formatting
// identical across the dashboard, garage, reports and vehicle pages.

export function formatINR(n: number, opts?: { decimals?: number }): string {
  const d = opts?.decimals ?? 0;
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })}`;
}

export function formatKm(n: number): string {
  return `${Math.round(n).toLocaleString("en-IN")} km`;
}

export function formatDate(s: string): string {
  const d = new Date(s.length === 10 ? s + "T00:00:00" : s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
