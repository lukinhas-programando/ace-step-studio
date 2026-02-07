export type GenerationInputs = {
  prompt?: string;
  lyrics?: string;
  instrumental?: boolean;
  bpm?: number | null;
  duration_seconds?: number | null;
  key?: string | null;
  time_signature?: string | null;
};

export type GenerationCreate = {
  title?: string;
  task_type: "text2music" | "cover" | "repaint";
  mode: "simple" | "custom";
  model_variant: "base" | "turbo" | "shift";
  cover_color?: string | null;
  cover_icon?: string | null;
  cover_strength?: number | null;
  inputs: GenerationInputs;
  metadata?: Record<string, unknown>;
};

export type GenerationResponse = {
  id: string;
  title?: string;
  task_type: "text2music" | "cover" | "repaint";
  mode: "simple" | "custom";
  model_variant: "base" | "turbo";
  status: string;
  prompt?: string | null;
  lyrics?: string | null;
  metadata?: Record<string, unknown>;
  instrumental: boolean;
  cover_strength?: number | null;
  duration_seconds?: number | null;
  bpm?: number | null;
  key?: string | null;
  time_signature?: string | null;
  output_audio_path?: string | null;
  audio_url?: string | null;
  cover_color?: string | null;
  cover_icon?: string | null;
  cover_image_url?: string | null;
  created_at: string;
  updated_at: string;
};
