export type LLMTaskRequest = {
  task: "prompt" | "lyrics" | "title" | "image";
  seed_prompt: string;
  instrumental: boolean;
  style_tags: string[];
  language?: string | null;
};
