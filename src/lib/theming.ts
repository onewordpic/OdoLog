export type Accent = "mint" | "coral" | "violet" | "sky" | "amber";
export type Gradient = "aurora" | "paper" | "sunrise" | "ocean";

export const ACCENTS: { id: Accent; label: string; light: string; dark: string }[] = [
  { id: "mint", label: "Mint", light: "#10B981", dark: "#A7F3D0" },
  { id: "coral", label: "Coral", light: "#F43F5E", dark: "#FDA4AF" },
  { id: "violet", label: "Violet", light: "#7C3AED", dark: "#C4B5FD" },
  { id: "sky", label: "Sky", light: "#0284C7", dark: "#93C5FD" },
  { id: "amber", label: "Amber", light: "#D97706", dark: "#FCD34D" },
];

export const GRADIENTS: { id: Gradient; label: string; preview: string }[] = [
  { id: "aurora", label: "Aurora", preview: "linear-gradient(135deg,#A7F3D0,#93C5FD)" },
  { id: "paper", label: "Paper", preview: "linear-gradient(135deg,#FBFBF7,#E9E5DC)" },
  { id: "sunrise", label: "Sunrise", preview: "linear-gradient(135deg,#FDA4AF,#FCD34D)" },
  { id: "ocean", label: "Ocean", preview: "linear-gradient(135deg,#93C5FD,#A7F3D0)" },
];

const ACCENT_KEY = "odolog.accent";
const GRADIENT_KEY = "odolog.gradient";

export function getAccent(): Accent {
  if (typeof window === "undefined") return "mint";
  return (localStorage.getItem(ACCENT_KEY) as Accent) || "mint";
}
export function getGradient(): Gradient {
  if (typeof window === "undefined") return "aurora";
  return (localStorage.getItem(GRADIENT_KEY) as Gradient) || "aurora";
}

export function applyAccent(a: Accent) {
  document.documentElement.setAttribute("data-accent", a);
  localStorage.setItem(ACCENT_KEY, a);
}
export function applyGradient(g: Gradient) {
  document.documentElement.setAttribute("data-gradient", g);
  localStorage.setItem(GRADIENT_KEY, g);
}

export function initThemingFromStorage() {
  if (typeof window === "undefined") return;
  document.documentElement.setAttribute("data-accent", getAccent());
  document.documentElement.setAttribute("data-gradient", getGradient());
}
