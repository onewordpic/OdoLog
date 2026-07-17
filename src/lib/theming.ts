export type Accent =
  | "mint"
  | "coral"
  | "violet"
  | "sky"
  | "amber"
  | "rose"
  | "lime"
  | "teal"
  | "indigo"
  | "fuchsia"
  | "slate";
export type Gradient =
  | "aurora"
  | "paper"
  | "sunrise"
  | "ocean"
  | "midnight"
  | "peach"
  | "forest"
  | "candy"
  | "mono";
export type GlassMode = "solid" | "glass" | "liquid";

export const ACCENTS: { id: Accent; label: string; light: string; dark: string }[] = [
  { id: "mint", label: "Mint", light: "#10B981", dark: "#A7F3D0" },
  { id: "coral", label: "Coral", light: "#F43F5E", dark: "#FDA4AF" },
  { id: "violet", label: "Violet", light: "#7C3AED", dark: "#C4B5FD" },
  { id: "sky", label: "Sky", light: "#0284C7", dark: "#93C5FD" },
  { id: "amber", label: "Amber", light: "#D97706", dark: "#FCD34D" },
  { id: "rose", label: "Rose", light: "#E11D48", dark: "#FDA4AF" },
  { id: "lime", label: "Lime", light: "#65A30D", dark: "#BEF264" },
  { id: "teal", label: "Teal", light: "#0D9488", dark: "#5EEAD4" },
  { id: "indigo", label: "Indigo", light: "#4F46E5", dark: "#A5B4FC" },
  { id: "fuchsia", label: "Fuchsia", light: "#C026D3", dark: "#F0ABFC" },
  { id: "slate", label: "Slate", light: "#475569", dark: "#CBD5E1" },
];

export const GRADIENTS: { id: Gradient; label: string; preview: string }[] = [
  { id: "aurora", label: "Aurora", preview: "linear-gradient(135deg,#A7F3D0,#93C5FD)" },
  { id: "paper", label: "Paper", preview: "linear-gradient(135deg,#FBFBF7,#E9E5DC)" },
  { id: "sunrise", label: "Sunrise", preview: "linear-gradient(135deg,#FDA4AF,#FCD34D)" },
  { id: "ocean", label: "Ocean", preview: "linear-gradient(135deg,#93C5FD,#A7F3D0)" },
  { id: "midnight", label: "Midnight", preview: "linear-gradient(135deg,#818CF8,#475569)" },
  { id: "peach", label: "Peach", preview: "linear-gradient(135deg,#FDA4AF,#FB923C)" },
  { id: "forest", label: "Forest", preview: "linear-gradient(135deg,#2DD4BF,#BEF264)" },
  { id: "candy", label: "Candy", preview: "linear-gradient(135deg,#F0ABFC,#7DD3FC)" },
  { id: "mono", label: "Mono", preview: "linear-gradient(135deg,#E7E5E4,#A8A29E)" },
];

export const GLASS_MODES: { id: GlassMode; label: string; desc: string }[] = [
  { id: "solid", label: "Off", desc: "Solid surfaces, no blur." },
  { id: "glass", label: "Glass", desc: "Frosted Apple-style glass." },
  { id: "liquid", label: "Liquid", desc: "Heavier liquid-glass shine." },
];

const ACCENT_KEY = "odolog.accent";
const GRADIENT_KEY = "odolog.gradient";
const GLASS_KEY = "odolog.glass";

export function getAccent(): Accent {
  if (typeof window === "undefined") return "mint";
  return (localStorage.getItem(ACCENT_KEY) as Accent) || "mint";
}
export function getGradient(): Gradient {
  if (typeof window === "undefined") return "aurora";
  return (localStorage.getItem(GRADIENT_KEY) as Gradient) || "aurora";
}
export function getGlassMode(): GlassMode {
  if (typeof window === "undefined") return "glass";
  return (localStorage.getItem(GLASS_KEY) as GlassMode) || "glass";
}

export function applyAccent(a: Accent) {
  document.documentElement.setAttribute("data-accent", a);
  localStorage.setItem(ACCENT_KEY, a);
}
export function applyGradient(g: Gradient) {
  document.documentElement.setAttribute("data-gradient", g);
  localStorage.setItem(GRADIENT_KEY, g);
}
export function applyGlassMode(g: GlassMode) {
  document.documentElement.setAttribute("data-glass", g);
  localStorage.setItem(GLASS_KEY, g);
}

export function initThemingFromStorage() {
  if (typeof window === "undefined") return;
  document.documentElement.setAttribute("data-accent", getAccent());
  document.documentElement.setAttribute("data-gradient", getGradient());
  document.documentElement.setAttribute("data-glass", getGlassMode());
}
