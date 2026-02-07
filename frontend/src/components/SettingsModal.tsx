import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  downloadCheckpointModel,
  listCheckpointModels,
  listLLMModels,
  updateConfig,
} from "../lib/api";
import { AppConfig } from "../types/config";

interface SettingsModalProps {
  config?: AppConfig;
  open: boolean;
  onClose: () => void;
}

type SettingsForm = {
  lm_enabled: boolean;
  lm_checkpoint: string;
  lm_backend: string;
  lm_device: string;
  lm_offload_to_cpu: boolean;
  openai_enabled: boolean;
  openai_endpoint: string;
  openai_api_key: string;
  openai_model: string;
  openai_prompt_system_prompt: string;
  openai_lyrics_system_prompt: string;
  openai_title_system_prompt: string;
  thinking_simple_mode: boolean;
  thinking_custom_mode: boolean;
  use_cot_caption: boolean;
  use_cot_language: boolean;
  use_cot_metas: boolean;
  allow_lm_batch: boolean;
  default_model_variant: "base" | "turbo" | "shift";
  base_inference_steps: number;
  turbo_inference_steps: number;
  shift_inference_steps: number;
  use_adg: boolean;
  cfg_interval_start: number;
  cfg_interval_end: number;
  infer_method: "ode" | "sde";
  image_generation_provider: "none" | "fal" | "comfy" | "a1111";
  image_prompt_system_prompt: string;
  fal_api_key: string;
  comfy_base_url: string;
  comfy_workflow_json: string;
  a1111_base_url: string;
};

const defaultForm: SettingsForm = {
  lm_enabled: false,
  lm_checkpoint: "",
  lm_backend: "pt",
  lm_device: "auto",
  lm_offload_to_cpu: false,
  openai_enabled: false,
  openai_endpoint: "",
  openai_api_key: "",
  openai_model: "gpt-4o-mini",
  openai_prompt_system_prompt:
    "You are a music creative director writing a concise but vivid one-paragraph 'song description' for an AI music model. Expand the user's short idea into a single paragraph (3-5 sentences) that covers genre, mood, instrumentation, vocal character, and arrangement arc. Keep it under 120 words, write in plain English, and avoid bullet lists, rhyme schemes, or lyric formatting. Mention only elements relevant to the prompt. Never invent non-English words unless the user explicitly requests another language. Return ONLY the song concept in plain text-no markup, formatting, commentary, or special characters.",
  openai_lyrics_system_prompt:
    "You are a professional songwriter. Given a song description, write polished English lyrics in a standard pop structure (Verse/Chorus/Bridge etc.). Use clear section labels in square brackets (e.g. [Chorus]). You can also add a brief one- or two-word style for each section (e.g. [Chorus - building]). Keep total length under ~200 words, and stay on topic. If the user requests instrumental, reply exactly with [Instrumental]. Otherwise, make sure the lyrics tell a coherent story, rhyme lightly, and never mix languages unless asked. Avoid nonsense syllables unless the prompt demands scatting. Do NOT apply any additional markup to the text-no additional formatting. It must follow the structure exactly.\n\n## EXAMPLE\n\n[Verse 1]\nFound him by the back porch door\nTwo odd socks and a crooked smile\nSaid he'd sworn off masters\nBeen walking free awhile\nDust on his ears, but his eyes shone clear\nLike \"boy, you're doing fine right here\"\n\n[Chorus - low dynamics]\nDobby's boots on the floor by my bed\nLittle hat hanging off my old post instead\nHe folds my shirts, but he won't call me boss\nSays, \"friends don't measure love in what they've lost\"\nHe's patched-up, proud, and a little bit loud\nDobby's boots on the floor, and I'm damn glad now\n\n[Verse 2]\nHe stares at my timecard clock\nSays, \"chains don't always look like chains\"\nHelps Ma with the evening chores\nSings low through the window rain\nTells me, \"boy, don't break yourself in two\nFreedom's something you can choose\"\n\nReturn ONLY the song lyrics in plain text-no markup, formatting, commentary, or special characters other than section tags. ",
  openai_title_system_prompt:
    "You are a professional songwriter. Given a song description, write a creative but relevant English title for the song concept. The song title should match the vibe and intent of the song concept provided, and should be no more than 6 words long-though any length (even a single word if it works) six words or under is acceptable. Return ONLY the song lyrics in plain text-no markup, formatting, commentary, or special characters other than section tags. ",
  thinking_simple_mode: true,
  thinking_custom_mode: false,
  use_cot_caption: true,
  use_cot_language: true,
  use_cot_metas: true,
  allow_lm_batch: true,
  default_model_variant: "turbo",
  base_inference_steps: 32,
  turbo_inference_steps: 8,
  shift_inference_steps: 8,
  use_adg: false,
  cfg_interval_start: 0,
  cfg_interval_end: 1,
  infer_method: "ode",
  image_generation_provider: "none",
  image_prompt_system_prompt:
    "You are a professional photographer. Given a song description, write a prompt for an AI image generator to become the cover image for the song concept. The prompt should match the vibe and intent of the song concept provided.\n\nFollow these guidelines:\n1. Stock photo feel. Unassuming in the sense that it's not distracting, but interesting in the sense that it's aesthetically pleasing. \n2. \n\nExamples:\nA serene landscape photograph of a quiet mountain valley at dawn, snow-dusted peaks rising in the distance, a still alpine lake reflecting the mountains. Pine trees line the shoreline. Soft morning mist, cool color palette. Natural light, gentle shadows, wide-angle shot, high dynamic range, atmospheric, peaceful mood\n\nA fine art architectural photograph of a striking modern statue in a quiet city park, abstract bronze form with sharp geometric lines, mounted on a stone pedestal. Surrounded by manicured grass and tall trees, distant city buildings softly blurred. Overcast daylight, diffused light, subtle shadows. Calm, contemplative mood, wide-angle composition, muted colors, high detail, cinematic tone\n\nA vintage roadside photography shot of an old rundown desert gas station storefront along Route 66, cracked concrete forecourt, faded hand-painted signage, rusted pumps, sun-bleached wood and peeling paint. Empty highway stretching behind it. Harsh midday desert light, deep shadows. Nostalgic, lonely mood, wide-angle lens, film grain, faded colors\n\nReturn ONLY the image prompt in plain text-no markup, formatting, commentary, or special characters other than section tags. ",
  fal_api_key: "",
  comfy_base_url: "http://127.0.0.1:8188",
  comfy_workflow_json: "",
  a1111_base_url: "http://127.0.0.1:7860",
};

export function SettingsModal({ config, open, onClose }: SettingsModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SettingsForm>(defaultForm);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const { data: checkpointModels = [] } = useQuery({
    queryKey: ["models"],
    queryFn: listCheckpointModels,
    enabled: open,
    refetchInterval: 5000,
  });
  const checkpointMap = useMemo(() => {
    const map: Record<string, any> = {};
    checkpointModels.forEach((model: any) => {
      map[model.id] = model;
    });
    return map;
  }, [checkpointModels]);
  const [activeDownload, setActiveDownload] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      onClose();
    },
  });
  const downloadMutation = useMutation({
    mutationFn: (id: string) => downloadCheckpointModel(id),
    onSettled: () => {
      setActiveDownload(null);
      queryClient.invalidateQueries({ queryKey: ["models"] });
    },
  });

  useEffect(() => {
    if (config) {
      setForm({
        lm_enabled: config.lm_enabled,
        lm_checkpoint: config.lm_checkpoint,
        lm_backend: config.lm_backend,
        lm_device: config.lm_device,
        lm_offload_to_cpu: config.lm_offload_to_cpu,
        openai_enabled: config.openai_enabled,
        openai_endpoint: config.openai_endpoint || "",
        openai_api_key: config.openai_api_key || "",
        openai_model: config.openai_model,
        openai_prompt_system_prompt: config.openai_prompt_system_prompt,
        openai_lyrics_system_prompt: config.openai_lyrics_system_prompt,
        openai_title_system_prompt: config.openai_title_system_prompt,
        thinking_simple_mode: config.thinking_simple_mode,
        thinking_custom_mode: config.thinking_custom_mode,
        use_cot_caption: config.use_cot_caption,
        use_cot_language: config.use_cot_language,
        use_cot_metas: config.use_cot_metas,
        allow_lm_batch: config.allow_lm_batch,
        default_model_variant: (config.default_model_variant as "base" | "turbo" | "shift") || "turbo",
        base_inference_steps: config.base_inference_steps,
        turbo_inference_steps: config.turbo_inference_steps,
        shift_inference_steps: config.shift_inference_steps,
        use_adg: config.adg_supported ? config.use_adg : false,
        cfg_interval_start: config.cfg_interval_start,
        cfg_interval_end: config.cfg_interval_end,
        infer_method: (config.infer_method as "ode" | "sde") || "ode",
        image_generation_provider:
          (config.image_generation_provider as SettingsForm["image_generation_provider"]) || "none",
        image_prompt_system_prompt: config.image_prompt_system_prompt,
        fal_api_key: config.fal_api_key || "",
        comfy_base_url: config.comfy_base_url || "http://127.0.0.1:8188",
        comfy_workflow_json: config.comfy_workflow_json || "",
        a1111_base_url: config.a1111_base_url || "http://127.0.0.1:7860",
      });
    }
  }, [config]);

  if (!open || !config) return null;

  const handleChange = (name: keyof SettingsForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleNumberChange = (name: keyof SettingsForm, value: number) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };
  const adgDisabled = !config.adg_supported;
  const adgTooltip = config.adg_unavailable_reason || "Adaptive Dual Guidance is unavailable on this device.";

  const getCheckpointStatus = (id: string) => {
    if (activeDownload === id) return "downloading";
    return checkpointMap[id]?.status || "missing";
  };

  const handleCheckpointDownload = (id: string) => {
    setActiveDownload(id);
    downloadMutation.mutate(id);
  };

  const renderModelPills = (ids: string[]) => (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => {
        const status = getCheckpointStatus(id);
        const spec = checkpointMap[id];
        const label = spec?.display_name || id;
        const isAvailable = status === "available";
        const isDownloading = status === "downloading";
        const dotElement =
          status === "downloading" ? (
            <span className="h-2.5 w-2.5 rounded-full border border-border border-t-transparent animate-spin" />
          ) : (
            <span className={`h-2.5 w-2.5 rounded-full ${isAvailable ? "bg-green-400" : "bg-red-400"}`} />
          );
        return (
          <button
            key={id}
            type="button"
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
              isAvailable ? "bg-surface text-white" : "bg-surface/70 text-subtle"
            } ${isAvailable ? "cursor-default" : "hover:bg-surface"}`}
            disabled={isAvailable || isDownloading}
            onClick={() => handleCheckpointDownload(id)}
            title={
              isAvailable
                ? "Model ready"
                : isDownloading
                  ? "Downloading..."
                  : "Missing. Click to download."
            }
          >
            {dotElement}
            {label}
          </button>
        );
      })}
    </div>
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    mutation.mutate({
      ...form,
      openai_endpoint: form.openai_endpoint || null,
      openai_api_key: form.openai_api_key || null,
      fal_api_key: form.fal_api_key || null,
      comfy_base_url: form.comfy_base_url || null,
      a1111_base_url: form.a1111_base_url || null,
    });
  };

  const refreshModels = async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const models = await listLLMModels({
        endpoint: form.openai_endpoint || undefined,
        api_key: form.openai_api_key || undefined,
      });
      setModelOptions(models);
      if (models.length && !models.includes(form.openai_model)) {
        setForm((prev) => ({ ...prev, openai_model: models[0] }));
      }
    } catch (err: any) {
      setModelsError(err?.response?.data?.detail || err?.message || "Failed to load models");
    } finally {
      setModelsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-surface rounded-3xl p-6 w-[560px] space-y-4 border border-border max-h-[85vh]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Settings</h3>
          <button onClick={onClose} className="text-subtle">
            ✕
          </button>
        </div>
        <p className="text-xs text-subtle">
          Server: {config.host}:{config.port}
        </p>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="space-y-4 overflow-y-auto pr-2 max-h-[65vh]">
            <details className="bg-background/40 rounded-2xl overflow-hidden group" open>
              <summary className="cursor-pointer flex items-center gap-2 px-4 py-3 text-xs uppercase tracking-wide text-subtle [&::-webkit-details-marker]:hidden">
                <span className="transition-transform duration-200 group-open:rotate-90">▸</span>
                Music Model Settings
              </summary>
              <div className="px-4 pb-4 space-y-3 text-sm">
                <div>
                  <p className="text-xs text-subtle mb-1">DiT Checkpoints</p>
                  {renderModelPills(["dit-base", "dit-turbo", "dit-shift"])}
                </div>
                <label className="space-y-1">
                  <span className="text-xs text-subtle">Default Model Variant</span>
                  <select
                    className="w-full rounded-lg bg-background border border-border p-2"
                    value={form.default_model_variant}
                    onChange={(e) =>
                      handleChange("default_model_variant", e.target.value as SettingsForm["default_model_variant"])
                    }
                  >
                    <option value="base">BASE</option>
                    <option value="turbo">TURBO</option>
                    <option value="shift">SHIFT</option>
                  </select>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <label className="space-y-1">
                    <span className="text-xs text-subtle">Base Steps</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      className="w-full rounded-lg bg-background border border-border p-2"
                      value={form.base_inference_steps}
                      onChange={(e) => handleNumberChange("base_inference_steps", Number(e.target.value))}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-subtle">Turbo Steps</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      className="w-full rounded-lg bg-background border border-border p-2"
                      value={form.turbo_inference_steps}
                      onChange={(e) => handleNumberChange("turbo_inference_steps", Number(e.target.value))}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-subtle">Shift Steps</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      className="w-full rounded-lg bg-background border border-border p-2"
                      value={form.shift_inference_steps}
                      onChange={(e) => handleNumberChange("shift_inference_steps", Number(e.target.value))}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.use_adg}
                      disabled={adgDisabled}
                      title={adgDisabled ? adgTooltip : undefined}
                      onChange={(e) => handleChange("use_adg", e.target.checked)}
                    />
                    <span className={`text-xs ${adgDisabled ? "text-subtle/60" : "text-subtle"}`} title={adgDisabled ? adgTooltip : undefined}>
                      Use Adaptive Dual Guidance
                    </span>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-subtle">Inference Method</span>
                    <select
                      className="w-full rounded-lg bg-background border border-border p-2"
                      value={form.infer_method}
                      onChange={(e) => handleChange("infer_method", e.target.value as "ode" | "sde")}
                    >
                      <option value="ode">ODE (Fast)</option>
                      <option value="sde">SDE (Stochastic)</option>
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-xs text-subtle">CFG Interval Start</span>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      className="w-full rounded-lg bg-background border border-border p-2"
                      value={form.cfg_interval_start}
                      onChange={(e) => handleNumberChange("cfg_interval_start", Number(e.target.value))}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-subtle">CFG Interval End</span>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      className="w-full rounded-lg bg-background border border-border p-2"
                      value={form.cfg_interval_end}
                      onChange={(e) => handleNumberChange("cfg_interval_end", Number(e.target.value))}
                    />
                  </label>
                </div>
            </div>
          </details>

          <details className="bg-background/40 rounded-2xl overflow-hidden group">
            <summary className="cursor-pointer flex items-center gap-2 px-4 py-3 text-xs uppercase tracking-wide text-subtle [&::-webkit-details-marker]:hidden">
              <span className="transition-transform duration-200 group-open:rotate-90">▸</span>
              Image Generation Settings
            </summary>
            <div className="px-4 pb-4 space-y-3 text-sm">
              <label className="space-y-1">
                <span className="text-xs text-subtle">Provider</span>
                <select
                  className="w-full rounded-lg bg-background border border-border p-2"
                  value={form.image_generation_provider}
                  onChange={(e) =>
                    handleChange("image_generation_provider", e.target.value as SettingsForm["image_generation_provider"])
                  }
                >
                  <option value="none">None</option>
                  <option value="fal">Fal (Flux 2 Klein)</option>
                  <option value="comfy">ComfyUI</option>
                  <option value="a1111">Automatic1111</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-subtle">Image Prompt System Message</span>
                <textarea
                  className="w-full rounded-lg bg-background border border-border p-2"
                  rows={2}
                  value={form.image_prompt_system_prompt}
                  onChange={(e) => handleChange("image_prompt_system_prompt", e.target.value)}
                />
              </label>
              {form.image_generation_provider === "fal" && (
                <label className="space-y-1">
                  <span className="text-xs text-subtle">Fal API Key</span>
                  <input
                    type="password"
                    className="w-full rounded-lg bg-background border border-border p-2"
                    value={form.fal_api_key}
                    onChange={(e) => handleChange("fal_api_key", e.target.value)}
                    placeholder="Key ..."
                  />
                  <p className="text-[11px] text-subtle">
                    Uses fal-ai/flux-2/klein/9b/base at 1056x1584 PNG output.
                  </p>
                </label>
              )}
              {form.image_generation_provider === "comfy" && (
                <>
                  <label className="space-y-1">
                    <span className="text-xs text-subtle">ComfyUI URL</span>
                    <input
                      className="w-full rounded-lg bg-background border border-border p-2"
                      value={form.comfy_base_url}
                      onChange={(e) => handleChange("comfy_base_url", e.target.value)}
                      placeholder="http://localhost:8188"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-subtle">Workflow JSON</span>
                    <textarea
                      className="w-full rounded-lg bg-background border border-border p-2 font-mono text-[11px]"
                      rows={5}
                      value={form.comfy_workflow_json}
                      onChange={(e) => handleChange("comfy_workflow_json", e.target.value)}
                      placeholder='Paste JSON with "%prompt%" placeholder'
                    />
                  </label>
                </>
              )}
              {form.image_generation_provider === "a1111" && (
                <label className="space-y-1">
                  <span className="text-xs text-subtle">Automatic1111 URL</span>
                  <input
                    className="w-full rounded-lg bg-background border border-border p-2"
                    value={form.a1111_base_url}
                    onChange={(e) => handleChange("a1111_base_url", e.target.value)}
                    placeholder="http://127.0.0.1:7860"
                  />
                  <p className="text-[11px] text-subtle">
                    Sends prompts to /sdapi/v1/txt2img with square 1056×1056 output.
                  </p>
                </label>
              )}
            </div>
          </details>

          <details className="bg-background/40 rounded-2xl overflow-hidden group">
            <summary className="cursor-pointer flex items-center gap-2 px-4 py-3 text-xs uppercase tracking-wide text-subtle [&::-webkit-details-marker]:hidden">
              <span className="transition-transform duration-200 group-open:rotate-90">▸</span>
              LM Model Settings
            </summary>
              <div className="px-4 pb-4 space-y-3 text-sm">
                <div>
                  <p className="text-xs text-subtle mb-1">5Hz LM Checkpoints</p>
                  {renderModelPills(["lm-0.6b", "lm-1.7b", "lm-4b"])}
                </div>
                <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.lm_enabled}
                  onChange={(e) => handleChange("lm_enabled", e.target.checked)}
                />
                Enable ACE 5Hz LM for prompt expansion
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs text-subtle">Checkpoint</span>
                  <input
                    className="w-full rounded-lg bg-background border border-border p-2"
                    value={form.lm_checkpoint}
                    onChange={(e) => handleChange("lm_checkpoint", e.target.value)}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-subtle">Backend</span>
                  <select
                    className="w-full rounded-lg bg-background border border-border p-2"
                    value={form.lm_backend}
                    onChange={(e) => handleChange("lm_backend", e.target.value)}
                  >
                    <option value="pt">PyTorch</option>
                    <option value="vllm">vLLM</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-subtle">Device</span>
                  <input
                    className="w-full rounded-lg bg-background border border-border p-2"
                    value={form.lm_device}
                    onChange={(e) => handleChange("lm_device", e.target.value)}
                  />
                </label>
                <label className="space-y-1 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.lm_offload_to_cpu}
                    onChange={(e) => handleChange("lm_offload_to_cpu", e.target.checked)}
                  />
                  <span className="text-xs text-subtle">Offload LM to CPU when idle</span>
                </label>
              </div>
            </div>
          </details>

            <details className="bg-background/40 rounded-2xl overflow-hidden group">
              <summary className="cursor-pointer flex items-center gap-2 px-4 py-3 text-xs uppercase tracking-wide text-subtle [&::-webkit-details-marker]:hidden">
                <span className="transition-transform duration-200 group-open:rotate-90">▸</span>
                External LLM Settings
              </summary>
              <div className="px-4 pb-4 space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.openai_enabled}
                  onChange={(e) => handleChange("openai_enabled", e.target.checked)}
                />
                Enable external endpoint
              </label>
              <label className="space-y-1">
                <span className="text-xs text-subtle">Endpoint URL</span>
                <input
                  className="w-full rounded-lg bg-background border border-border p-2"
                  value={form.openai_endpoint}
                  onChange={(e) => handleChange("openai_endpoint", e.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-subtle">API Key</span>
                <input
                  className="w-full rounded-lg bg-background border border-border p-2"
                  type="password"
                  value={form.openai_api_key}
                  onChange={(e) => handleChange("openai_api_key", e.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-subtle flex items-center gap-2">
                  Model
                  <button
                    type="button"
                    className="text-xs text-subtle hover:text-white"
                    onClick={refreshModels}
                    title="Refresh available models"
                    disabled={modelsLoading}
                  >
                    {modelsLoading ? "…" : "⟳"}
                  </button>
                </span>
                {modelOptions.length > 0 ? (
                  <select
                    className="w-full rounded-lg bg-background border border-border p-2"
                    value={form.openai_model}
                    onChange={(e) => handleChange("openai_model", e.target.value)}
                  >
                    {modelOptions.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="w-full rounded-lg bg-background border border-border p-2"
                    value={form.openai_model}
                    onChange={(e) => handleChange("openai_model", e.target.value)}
                  />
                )}
                {modelsError && <p className="text-[11px] text-red-400">{modelsError}</p>}
              </label>
              <label className="space-y-1">
                <span className="text-xs text-subtle">Prompt System Message</span>
                <textarea
                  className="w-full rounded-lg bg-background border border-border p-2"
                  rows={2}
                  value={form.openai_prompt_system_prompt}
                  onChange={(e) => handleChange("openai_prompt_system_prompt", e.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-subtle">Lyrics System Message</span>
                <textarea
                  className="w-full rounded-lg bg-background border border-border p-2"
                  rows={2}
                  value={form.openai_lyrics_system_prompt}
                  onChange={(e) => handleChange("openai_lyrics_system_prompt", e.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-subtle">Title System Message</span>
                <textarea
                  className="w-full rounded-lg bg-background border border-border p-2"
                  rows={2}
                  value={form.openai_title_system_prompt}
                  onChange={(e) => handleChange("openai_title_system_prompt", e.target.value)}
                />
              </label>
            </div>
          </details>

          <details className="bg-background/40 rounded-2xl overflow-hidden group">
            <summary className="cursor-pointer flex items-center gap-2 px-4 py-3 text-xs uppercase tracking-wide text-subtle [&::-webkit-details-marker]:hidden">
              <span className="transition-transform duration-200 group-open:rotate-90">▸</span>
              LM Behavior
            </summary>
            <div className="px-4 pb-4 space-y-2 text-sm">
              <p className="text-xs text-subtle">
                Control how the ACE 5Hz LM participates when preparing prompts and guiding generations.
              </p>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.thinking_simple_mode}
                  onChange={(e) => handleChange("thinking_simple_mode", e.target.checked)}
                />
                Enable thinking mode for Simple requests
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.thinking_custom_mode}
                  onChange={(e) => handleChange("thinking_custom_mode", e.target.checked)}
                />
                Enable thinking mode for Custom requests
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.use_cot_caption}
                  onChange={(e) => handleChange("use_cot_caption", e.target.checked)}
                />
                Use Chain-of-Thought to refine captions
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.use_cot_language}
                  onChange={(e) => handleChange("use_cot_language", e.target.checked)}
                />
                Use Chain-of-Thought to refine lyrics
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.use_cot_metas}
                  onChange={(e) => handleChange("use_cot_metas", e.target.checked)}
                />
                Auto-fill BPM / key / duration metadata
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.allow_lm_batch}
                  onChange={(e) => handleChange("allow_lm_batch", e.target.checked)}
                />
                Allow LM batching for faster multi-seed runs
              </label>
            </div>
          </details>
        </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded-full bg-surface text-sm"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-full bg-accent text-black text-sm font-semibold disabled:opacity-50"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
