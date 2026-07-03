// Mirrors the presets the backend accepts. The public script-to-video workflow
// requires `script` + `visualStyle`; this app hard-codes an AI image style on the
// backend. Export varies `quality`. Those are the knobs we expose in the UI.

export const ASPECT_RATIO_PRESETS = [
  { id: "landscape", label: "Landscape · 16:9" },
  { id: "portrait", label: "Portrait · 9:16" },
  { id: "square", label: "Square · 1:1" },
] as const;

export const QUALITY_PRESETS = [
  { id: "STANDARD", label: "Standard · fastest" },
  { id: "HIGH", label: "High · 1080p" },
  { id: "FULL_HIGH", label: "Full HD" },
  { id: "ULTRA_HIGH", label: "Ultra · 4K" },
] as const;
