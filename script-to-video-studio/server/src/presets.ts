// The public script-to-video workflow currently accepts only `script` and an
// optional `aspectRatio`; export accepts a `quality` tier. We expose those as a
// few friendly presets — the full surface an indie dev can drive from the
// public API today.

export const ASPECT_RATIO_PRESETS = [
  { id: "landscape", label: "Landscape · 16:9", width: 16, height: 9 },
  { id: "portrait", label: "Portrait · 9:16", width: 9, height: 16 },
  { id: "square", label: "Square · 1:1", width: 1, height: 1 },
] as const;

export type AspectRatioPresetId = (typeof ASPECT_RATIO_PRESETS)[number]["id"];

// These ids are the exact `ExportProjectQuality` enum values the API expects.
export const QUALITY_PRESETS = [
  { id: "STANDARD", label: "Standard · fastest" },
  { id: "HIGH", label: "High · 1080p" },
  { id: "FULL_HIGH", label: "Full HD" },
  { id: "ULTRA_HIGH", label: "Ultra · 4K" },
] as const;

export type QualityPresetId = (typeof QUALITY_PRESETS)[number]["id"];

export function resolveAspectRatio(id: string): { width: number; height: number } {
  const preset = ASPECT_RATIO_PRESETS.find((option) => option.id === id) ?? ASPECT_RATIO_PRESETS[0];
  return { width: preset.width, height: preset.height };
}

export function resolveAspectRatioPreset(id: string): (typeof ASPECT_RATIO_PRESETS)[number] {
  return ASPECT_RATIO_PRESETS.find((option) => option.id === id) ?? ASPECT_RATIO_PRESETS[0];
}

export function resolveQuality(id: string): QualityPresetId {
  const preset = QUALITY_PRESETS.find((option) => option.id === id);
  return preset?.id ?? "HIGH";
}

export function resolveQualityPreset(id: QualityPresetId): (typeof QUALITY_PRESETS)[number] {
  return QUALITY_PRESETS.find((option) => option.id === id) ?? QUALITY_PRESETS[1];
}
