import {
  Activity,
  AudioWaveform,
  Guitar,
  KeyboardMusic,
  MicVocal,
  Music,
  Music2,
  Music4,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  guitar: Guitar,
  music: Music,
  activity: Activity,
  "keyboard-music": KeyboardMusic,
  "audio-waveform": AudioWaveform,
  "music-2": Music2,
  "music-4": Music4,
  "mic-vocal": MicVocal,
};

export function getCoverIcon(name?: string): LucideIcon {
  if (!name) return Music;
  return ICON_MAP[name] || Music;
}
