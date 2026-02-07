import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { GenerationCreate } from "../types/generation";
import { LLMTaskRequest } from "../types/llm";

const modeOptions = [
  { label: "Simple", value: "simple" },
  { label: "Custom", value: "custom" },
];

const keyOptions = [
  "Auto",
  "C Major",
  "G Major",
  "D Major",
  "A Major",
  "E Major",
  "B Major",
  "F# Major",
  "C# Major",
  "F Major",
  "Bb Major",
  "Eb Major",
  "Ab Major",
  "Db Major",
  "Gb Major",
  "Cb Major",
  "A minor",
  "E minor",
  "B minor",
  "F# minor",
  "C# minor",
  "G# minor",
  "D# minor",
  "A# minor",
];

const timeSignatureOptions = ["Auto", "2/4", "3/4", "4/4", "6/8"];

const defaultValues: GenerationCreate = {
  task_type: "text2music",
  mode: "simple",
  model_variant: "turbo",
  title: "",
  inputs: {
    prompt: "",
    lyrics: "",
    instrumental: false,
    bpm: undefined,
    duration_seconds: undefined,
    key: "Auto",
    time_signature: "Auto",
  },
  metadata: {},
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const mapWeirdness = (value: number) => {
  const t = 0.6 + (value / 100) * 0.6; // 0.6 - 1.2
  const topP = 0.8 + (value / 100) * 0.15; // 0.8 - 0.95
  const topK = Math.round(20 + (value / 100) * 130); // 20 - 150
  return {
    lm_temperature: Number(t.toFixed(2)),
    lm_top_p: Number(topP.toFixed(2)),
    lm_top_k: topK,
  };
};

const mapStyleInfluence = (value: number) => {
  const cfg = 3 + (value / 100) * 9; // 3 - 12
  return Number(cfg.toFixed(2));
};

type Props = {
  onSubmit: (payload: GenerationCreate) => Promise<void>;
  onLLMTask: (payload: LLMTaskRequest) => Promise<string>;
  isSubmitting: boolean;
  modelAvailability: Record<"base" | "turbo" | "shift", boolean>;
  defaultVariant: "base" | "turbo" | "shift";
  prefillData?: any;
  onPrefillUsed?: () => void;
};

const variantLabels: Record<"base" | "turbo" | "shift", string> = {
  base: "BASE",
  turbo: "TURBO",
  shift: "SHIFT",
};

export function CreatePanel({
  onSubmit,
  onLLMTask,
  isSubmitting,
  modelAvailability,
  defaultVariant,
  prefillData,
  onPrefillUsed,
}: Props) {
  const persistedMode = (typeof window !== "undefined" && window.localStorage.getItem("ace_mode")) || "simple";
  const [mode, setMode] = useState<"simple" | "custom">((persistedMode as "simple" | "custom") || "simple");
  const { register, handleSubmit, watch, setValue, reset } = useForm<GenerationCreate>({
    defaultValues: { ...defaultValues, mode, model_variant: defaultVariant },
  });
  const [metadataOpen, setMetadataOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("ace_metadata_open") === "true";
  });
  const [toneOpen, setToneOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("ace_tone_open") === "true";
  });
  const instrumental = watch("inputs.instrumental");
  const [llmLoading, setLlmLoading] = useState(false);
  const [weirdness, setWeirdness] = useState(40);
  const [styleInfluence, setStyleInfluence] = useState(70);
  const [selectedVariant, setSelectedVariant] = useState<"base" | "turbo" | "shift">(defaultVariant);
  const availableVariantOptions = (["base", "turbo", "shift"] as const).filter((variant) => modelAvailability[variant]);

  useEffect(() => {
    setSelectedVariant(defaultVariant);
    setValue("model_variant", defaultVariant, { shouldDirty: true });
  }, [defaultVariant, setValue]);

  useEffect(() => {
    if (!modelAvailability[selectedVariant]) {
      const fallback = availableVariantOptions[0];
      if (fallback) {
        setSelectedVariant(fallback);
        setValue("model_variant", fallback, { shouldDirty: true });
      }
    }
  }, [availableVariantOptions, modelAvailability, selectedVariant, setValue]);

  const handleVariantChange = (variant: "base" | "turbo" | "shift") => {
    setSelectedVariant(variant);
    setValue("model_variant", variant, { shouldDirty: true });
  };

  useEffect(() => {
    if (!prefillData) return;
    const nextMode = (prefillData.mode as "simple" | "custom") || "custom";
    setMode(nextMode);
    reset({
      ...defaultValues,
      ...prefillData,
      mode: nextMode,
      inputs: { ...defaultValues.inputs, ...(prefillData.inputs || {}) },
      metadata: { ...(prefillData.metadata || {}) },
    });
    if (prefillData.model_variant) {
      const variant = prefillData.model_variant as "base" | "turbo" | "shift";
      setSelectedVariant(variant);
      setValue("model_variant", variant, { shouldDirty: true });
    }
    if (prefillData.weirdness !== undefined) setWeirdness(prefillData.weirdness);
    if (prefillData.styleInfluence !== undefined) setStyleInfluence(prefillData.styleInfluence);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("ace_mode", nextMode);
    }
    onPrefillUsed?.();
  }, [prefillData, onPrefillUsed, reset, setValue]);

  const triggerLLM = async (task: "prompt" | "lyrics", seedOverride?: string) => {
    const seed = seedOverride ?? (task === "prompt" ? watch("inputs.prompt") : watch("inputs.lyrics"));
    if (!seed) return;
    setLlmLoading(true);
    try {
      const result = await onLLMTask({
        task,
        seed_prompt: seed,
        instrumental: !!instrumental,
        style_tags: [],
      });
      if (task === "prompt") {
        setValue("inputs.prompt", result, { shouldDirty: true });
      } else {
        setValue("inputs.lyrics", result, { shouldDirty: true });
      }
    } finally {
      setLlmLoading(false);
    }
  };

  const buildPayload = async (values: GenerationCreate) => {
    let prompt = values.inputs.prompt || "";
    let lyrics = values.inputs.lyrics || "";
    const descriptionSeed = values.inputs.prompt || "Describe a song";
    const isInstrumental = !!values.inputs.instrumental;
    let title = values.title || "";

    if (values.mode === "simple") {
      if (descriptionSeed) {
        prompt = await onLLMTask({
          task: "prompt",
          seed_prompt: descriptionSeed,
          instrumental: isInstrumental,
          style_tags: [],
        });
      }
      lyrics = isInstrumental
        ? "[Instrumental]"
        : await onLLMTask({
            task: "lyrics",
            seed_prompt: descriptionSeed,
            instrumental: false,
            style_tags: [],
          });
      const titleSeed = `Generate a short, catchy song title for this concept: ${prompt}`;
      const generatedTitle = await onLLMTask({
        task: "prompt",
        seed_prompt: titleSeed,
        instrumental: isInstrumental,
        style_tags: [],
      });
      title = generatedTitle.split("\n")[0].replace(/["']/g, "").trim();
    } else {
      if (isInstrumental) {
        lyrics = "[Instrumental]";
      }
      title = title.trim();
    }

    const weirdnessParams = mapWeirdness(weirdness);
    const guidanceScale = mapStyleInfluence(styleInfluence);

    return {
      ...values,
      task_type: "text2music",
      title: title || undefined,
      metadata: {
        ...(values.metadata || {}),
        weirdness,
        style_influence: styleInfluence,
        guidance_scale: guidanceScale,
        ...weirdnessParams,
      },
      inputs: {
        ...values.inputs,
        prompt,
        lyrics,
        key: values.inputs.key === "Auto" ? undefined : values.inputs.key,
        time_signature: values.inputs.time_signature === "Auto" ? undefined : values.inputs.time_signature,
      },
    } satisfies GenerationCreate;
  };

  const onGenerate = handleSubmit(async (values) => {
    const metadata = {
      ...(values.metadata || {}),
      weirdness,
      style_influence: styleInfluence,
      ...mapWeirdness(weirdness),
      guidance_scale: mapStyleInfluence(styleInfluence),
    };
    await onSubmit({
      ...values,
      metadata,
    });
  });

  return (
    <aside className="w-96 min-w-96 bg-panel/80 border-r border-border flex flex-col">
      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {modeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setMode(opt.value as "simple" | "custom");
                  setValue("mode", opt.value as any);
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem("ace_mode", opt.value);
                  }
                }}
                className={`px-3 py-1 rounded-full text-sm ${mode === opt.value ? "bg-white text-black" : "bg-surface"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-subtle">Model</span>
            {availableVariantOptions.length > 0 ? (
              <select
                className="rounded-full bg-surface border border-border px-3 py-1 text-xs"
                value={selectedVariant}
                onChange={(e) => handleVariantChange(e.target.value as "base" | "turbo" | "shift")}
              >
                {availableVariantOptions.map((variant) => (
                  <option key={variant} value={variant}>
                    {variantLabels[variant]}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-subtle">No models ready</span>
            )}
          </div>
        </div>

        <form className="space-y-4" onSubmit={onGenerate}>
          {mode === "simple" ? (
            <>
              <div>
                <label className="text-sm text-subtle">Song Description</label>
                <textarea
                  {...register("inputs.prompt" as const)}
                  rows={4}
                  className="w-full bg-surface border border-border rounded-2xl mt-2 p-3 text-sm"
                  placeholder="Make a rock song about rocks"
                />
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <section>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-subtle">Title</label>
                </div>
                <input
                  {...register("title")}
                  className="w-full bg-surface border border-border rounded-2xl mt-2 p-2 text-sm"
                  placeholder="Enter a song title"
                />
              </section>
              <section>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-subtle">Style / Caption</label>
                  <button type="button" className="text-xs" disabled={llmLoading} onClick={() => triggerLLM("prompt")}>
                    ✨ Expand
                  </button>
                </div>
                <textarea
                  {...register("inputs.prompt" as const)}
                  rows={3}
                  className="w-full bg-surface border border-border rounded-2xl mt-2 p-3 text-sm"
                  placeholder="Describe the arrangement, genre, instruments"
                />
              </section>
              <section>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-subtle">Lyrics</label>
                  <button type="button" className="text-xs" disabled={llmLoading} onClick={() => triggerLLM("lyrics")}>
                    ✨ Generate
                  </button>
                </div>
                <textarea
                  {...register("inputs.lyrics" as const)}
                  rows={5}
                  className="w-full bg-surface border border-border rounded-2xl mt-2 p-3 text-sm"
                  placeholder="Write lyrics or a short prompt, then click generate"
                />
              </section>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-subtle">
            <input type="checkbox" {...register("inputs.instrumental" as const)} /> Instrumental
          </label>

          {mode === "custom" && (
            <>
              <details
                className="bg-surface/40 rounded-2xl p-3"
                open={metadataOpen}
                onToggle={(e) => {
                  const open = (e.target as HTMLDetailsElement).open;
                  setMetadataOpen(open);
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem("ace_metadata_open", String(open));
                  }
                }}
              >
                <summary className="cursor-pointer text-xs uppercase tracking-wide text-subtle mb-2">Metadata</summary>
                <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                  <label className="space-y-1">
                    <span className="text-xs text-subtle">BPM</span>
                    <input
                      type="number"
                      {...register("inputs.bpm" as const, { valueAsNumber: true })}
                      className="w-full bg-surface border border-border rounded-xl p-2"
                      placeholder="Auto"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-subtle">Duration (s)</span>
                    <input
                      type="number"
                      {...register("inputs.duration_seconds" as const, { valueAsNumber: true })}
                      className="w-full bg-surface border border-border rounded-xl p-2"
                      placeholder="Auto"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-subtle">Key</span>
                    <select {...register("inputs.key" as const)} className="w-full bg-surface border border-border rounded-xl p-2">
                      {keyOptions.map((key) => (
                        <option key={key} value={key}>
                          {key}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-subtle">Time Signature</span>
                    <select
                      {...register("inputs.time_signature" as const)}
                      className="w-full bg-surface border border-border rounded-xl p-2"
                    >
                      {timeSignatureOptions.map((sig) => (
                        <option key={sig} value={sig}>
                          {sig}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </details>
              <details
                className="bg-surface/40 rounded-2xl p-3"
                open={toneOpen}
                onToggle={(e) => {
                  const open = (e.target as HTMLDetailsElement).open;
                  setToneOpen(open);
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem("ace_tone_open", String(open));
                  }
                }}
              >
                <summary className="cursor-pointer text-xs uppercase tracking-wide text-subtle mb-2">Tone Controls</summary>
                <div className="space-y-3 mt-2">
                  <div>
                    <div className="flex justify-between text-xs text-subtle">
                      <span>Weirdness</span>
                      <span>{weirdness}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={weirdness}
                      onChange={(e) => setWeirdness(clamp(Number(e.target.value), 0, 100))}
                      className="w-full"
                    />
                    <p className="text-[11px] text-subtle mt-1">Controls LM temperature / top-k / top-p. Higher = wilder ideas.</p>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-subtle">
                      <span>Style Influence</span>
                      <span>{styleInfluence}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={styleInfluence}
                      onChange={(e) => setStyleInfluence(clamp(Number(e.target.value), 0, 100))}
                      className="w-full"
                    />
                    <p className="text-[11px] text-subtle mt-1">Maps to ACE CFG guidance. Higher = closer to the caption.</p>
                  </div>
                </div>
              </details>
            </>
          )}

          <button
            type="submit"
            disabled={isSubmitting || availableVariantOptions.length === 0}
            className="w-full bg-accent text-black rounded-full py-3 text-sm font-semibold disabled:opacity-50"
          >
            {availableVariantOptions.length === 0 ? "No Models Ready" : isSubmitting ? "Generating…" : "Create"}
          </button>
        </form>
      </div>
    </aside>
  );
}
