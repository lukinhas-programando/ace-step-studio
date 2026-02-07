import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createGeneration,
  deleteCover,
  deleteGeneration,
  listCheckpointModels,
  regenerateCover,
  runLLMTask,
  updateGeneration,
  uploadCover,
} from "./lib/api";
import { Settings as SettingsIcon } from "lucide-react";
import { useConfig } from "./hooks/useConfig";
import { useHistory } from "./hooks/useHistory";
import { CreatePanel } from "./components/CreatePanel";
import { LibraryPanel } from "./components/LibraryPanel";
import { SongDetailPanel } from "./components/SongDetailPanel";
import { PlaybackBar } from "./components/PlaybackBar";
import { SettingsModal } from "./components/SettingsModal";
import { SongEditModal } from "./components/SongEditModal";
import { CoverUploadModal } from "./components/CoverUploadModal";
import { GenerationCreate, GenerationResponse } from "./types/generation";
import { LLMTaskRequest } from "./types/llm";

type PendingGeneration = {
  tempId: string;
  title: string;
  prompt: string;
  stageLabels: string[];
  stageIndex: number;
  instrumental: boolean;
  mode: "simple" | "custom";
  model_variant: "base" | "turbo" | "shift";
  task_type: "text2music" | "cover" | "repaint";
  serverId?: string;
  error?: string;
};

const truncateTitle = (title: string, maxWords = 6, maxChars = 60) => {
  const trimmed = title.trim().replace(/\s+/g, " ");
  const words = trimmed.split(" ").slice(0, maxWords).join(" ");
  return words.length > maxChars ? `${words.slice(0, maxChars)}…` : words || "Untitled";
};

const sanitizeTitle = (title?: string | null) => {
  if (!title) return "Untitled";
  const cleaned = title.replace(/[^A-Za-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  return cleaned || "Untitled";
};

const ENGLISH_LYRICS_INSTRUCTION =
  "Write lyrics in English unless another language is explicitly requested. Keep verses and choruses labeled.";

export default function App() {
  const queryClient = useQueryClient();
  const { data: config } = useConfig();
  const { data: history } = useHistory();
  const { data: modelInventory } = useQuery({
    queryKey: ["models"],
    queryFn: listCheckpointModels,
    refetchInterval: 5000,
  });
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoPlayRequested, setAutoPlayRequested] = useState(false);
  const [pendingGenerations, setPendingGenerations] = useState<PendingGeneration[]>([]);
  const [flowRunning, setFlowRunning] = useState(false);
  const [prefillData, setPrefillData] = useState<any>(null);
  const [editSong, setEditSong] = useState<GenerationResponse | null>(null);
  const [uploadSong, setUploadSong] = useState<GenerationResponse | null>(null);
  const [progress, setProgress] = useState({ current: 0, duration: 0 });
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [coverGenerationState, setCoverGenerationState] = useState<{ id: string; previousUrl: string | null } | null>(
    null,
  );
  const ditAvailability = useMemo(
    () => ({
      base: !!modelInventory?.some((model: any) => model.id === "dit-base" && model.status === "available"),
      turbo: !!modelInventory?.some((model: any) => model.id === "dit-turbo" && model.status === "available"),
      shift: !!modelInventory?.some((model: any) => model.id === "dit-shift" && model.status === "available"),
    }),
    [modelInventory],
  );
  const defaultVariant = useMemo(() => {
    const desired = (config?.default_model_variant as "base" | "turbo" | "shift") || "turbo";
    if (ditAvailability[desired]) return desired;
    const fallback = (["turbo", "shift", "base"] as const).find((variant) => ditAvailability[variant]);
    return fallback || desired;
  }, [config?.default_model_variant, ditAvailability]);

  const createMutation = useMutation({
    mutationFn: (payload: GenerationCreate) => createGeneration(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["history"] });
    },
  });

  const llmMutation = useMutation({
    mutationFn: runLLMTask,
  });

  const selectedSong = history?.find((item: GenerationResponse) => item.id === selectedId);
  const selectedAudioUrl = selectedSong?.audio_url || null;

  useEffect(() => {
    if (!history) return;
    setPendingGenerations((prev) =>
      prev.filter((pending) => {
        if (!pending.serverId) return true;
        const match = history.find((item: GenerationResponse) => item.id === pending.serverId);
        if (!match) return true;
        return !["ready", "failed"].includes(match.status);
      }),
    );

    if (editSong) {
      const refreshed = history.find((item: GenerationResponse) => item.id === editSong.id);
      if (refreshed && refreshed.updated_at !== editSong.updated_at) {
        setEditSong(refreshed);
      }
    }
    if (uploadSong) {
      const refreshed = history.find((item: GenerationResponse) => item.id === uploadSong.id);
      if (refreshed && refreshed.updated_at !== uploadSong.updated_at) {
        setUploadSong(refreshed);
      }
    }
  }, [history]);

  useEffect(() => {
    if (!coverGenerationState || !history) return;
    const match = history.find((item: GenerationResponse) => item.id === coverGenerationState.id);
    if (!match) return;
    const currentUrl = match.cover_image_url || null;
    if (currentUrl && currentUrl !== coverGenerationState.previousUrl) {
      setCoverGenerationState(null);
    }
  }, [history, coverGenerationState]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleEnded = () => {
      setIsPlaying(false);
      setPlayingId(null);
    };
    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handleTimeUpdate = () =>
      setProgress({ current: audio.currentTime, duration: audio.duration || progress.duration });
    const handleLoaded = () => setProgress({ current: 0, duration: audio.duration || 0 });
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoaded);
    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoaded);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (selectedAudioUrl) {
      audio.src = selectedAudioUrl;
      audio.load();
      if (autoPlayRequested) {
        audio
          .play()
          .then(() => setAutoPlayRequested(false))
          .catch((err) => {
            console.error("Audio play failed", err);
            setAutoPlayRequested(false);
          });
      }
    } else {
      audio.removeAttribute("src");
    }
    setIsPlaying(false);
  }, [selectedAudioUrl]);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || !selectedAudioUrl) {
      return;
    }
    if (audio.paused) {
      audio.play().catch((err) => console.error("Audio play failed", err));
    } else {
      audio.pause();
    }
  };

  const requestLLM = async (payload: LLMTaskRequest) => {
    const response = await llmMutation.mutateAsync(payload);
    return response.output;
  };

  const addPending = (pending: PendingGeneration) => {
    setPendingGenerations((prev) => [...prev, pending]);
  };

  const updatePending = (tempId: string, data: Partial<PendingGeneration>) => {
    setPendingGenerations((prev) => prev.map((item) => (item.tempId === tempId ? { ...item, ...data } : item)));
  };

  const advanceStage = (tempId: string) => {
    setPendingGenerations((prev) =>
      prev.map((item) => {
        if (item.tempId !== tempId) return item;
        const nextIndex = Math.min(item.stageLabels.length - 1, item.stageIndex + 1);
        return { ...item, stageIndex: nextIndex };
      }),
    );
  };

  const handleCreate = async (formValues: GenerationCreate) => {
    const isInstrumental = !!formValues.inputs.instrumental;
    const stageLabels = isInstrumental
      ? ["Shaping idea", "Composing track", "Mixing audio"]
      : ["Shaping idea", "Writing lyrics", "Composing track", "Mixing audio"];
    const tempId = `temp-${Date.now()}`;
    addPending({
      tempId,
      title: truncateTitle(sanitizeTitle(formValues.title || formValues.inputs.prompt || "Untitled")),
      prompt: formValues.inputs.prompt || "",
      stageLabels,
      stageIndex: 0,
      instrumental: isInstrumental,
      mode: formValues.mode,
      model_variant: formValues.model_variant,
      task_type: formValues.task_type,
    });
    setFlowRunning(true);

    try {
      let prompt = formValues.inputs.prompt || "";
      let lyrics = formValues.inputs.lyrics || "";
      let title = formValues.title?.trim() || "";

      if (formValues.mode === "simple") {
        const descriptionSeed = prompt || "Describe a song idea in one sentence.";
        const expandedPrompt = await requestLLM({
          task: "prompt",
          seed_prompt: descriptionSeed,
          instrumental: isInstrumental,
          style_tags: [],
        });
        prompt = expandedPrompt;
        updatePending(tempId, { prompt });
        advanceStage(tempId);

        if (!isInstrumental) {
          const lyricSeed = `${expandedPrompt}\n${ENGLISH_LYRICS_INSTRUCTION}`;
          lyrics = await requestLLM({
            task: "lyrics",
            seed_prompt: lyricSeed,
            instrumental: false,
            style_tags: [],
          });
          advanceStage(tempId);
        } else {
          lyrics = "[Instrumental]";
        }

        const titleSeed = `Generate a short, catchy song title (max 6 words) for this concept: ${expandedPrompt}`;
        const generatedTitle = await requestLLM({
          task: "title",
          seed_prompt: titleSeed,
          instrumental: isInstrumental,
          style_tags: [],
        });
        title = sanitizeTitle(generatedTitle);
        updatePending(tempId, { title: truncateTitle(title) });
      } else {
        prompt = prompt.trim();
        lyrics = isInstrumental ? "[Instrumental]" : lyrics;
        title = sanitizeTitle(title || prompt || "Untitled");
        updatePending(tempId, { title: truncateTitle(title), prompt });
      }

      let imagePrompt = prompt;
      if (config?.image_generation_provider && config.image_generation_provider !== "none") {
        try {
          const generatedImagePrompt = await requestLLM({
            task: "image",
            seed_prompt: prompt,
            instrumental: isInstrumental,
            style_tags: [],
          });
          if (generatedImagePrompt) {
            imagePrompt = generatedImagePrompt;
          }
        } catch (error) {
          console.warn("Image prompt generation failed", error);
        }
      }

      const metadata = {
        ...(formValues.metadata || {}),
        image_prompt: imagePrompt,
      };

      advanceStage(tempId); // composing track

      const payload: GenerationCreate = {
        ...formValues,
        title,
        metadata,
        inputs: {
          ...formValues.inputs,
          prompt,
          lyrics,
          key: formValues.inputs.key === "Auto" ? undefined : formValues.inputs.key,
          time_signature: formValues.inputs.time_signature === "Auto" ? undefined : formValues.inputs.time_signature,
        },
      };

      const response = await createMutation.mutateAsync(payload);
      advanceStage(tempId); // mixing audio
      updatePending(tempId, { serverId: response.id });
      queryClient.invalidateQueries({ queryKey: ["history"] });
    } catch (error) {
      console.error("Generation flow failed", error);
      updatePending(tempId, { error: "Generation failed. Try again." });
    } finally {
      setFlowRunning(false);
    }
  };

  const handlePlay = (song: GenerationResponse) => {
    setSelectedId(song.id);
    if (song.audio_url) {
      setAutoPlayRequested(true);
      setPlayingId(song.id);
    }
  };

  const handleCardTogglePlay = (song: GenerationResponse) => {
    if (playingId === song.id) {
      handlePlayPause();
    } else {
      handlePlay(song);
    }
  };

  const handleDelete = async (id: string) => {
    const pending = pendingGenerations.find((p) => p.tempId === id);
    if (pending) {
      setPendingGenerations((prev) => prev.filter((item) => item.tempId !== id));
      return;
    }
    await deleteGeneration(id);
    if (selectedId === id) {
      setSelectedId(undefined);
    }
     if (playingId === id) {
       setPlayingId(null);
       setIsPlaying(false);
     }
    queryClient.invalidateQueries({ queryKey: ["history"] });
  };

  const filteredHistory =
    history?.filter(
      (item: GenerationResponse) => !pendingGenerations.some((pending) => pending.serverId === item.id),
    ) || [];

  const sanitizeFileName = (title: string, fallback: string) => {
    const cleaned = title.replace(/[^A-Za-z0-9 _-]/g, "").trim();
    return (cleaned || fallback).slice(0, 60);
  };

  const handleDownload = async (song: GenerationResponse) => {
    if (!song.audio_url) return;
    const response = await fetch(song.audio_url);
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeFileName(song.title || "song", song.id)}.wav`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const buildPrefillFromSong = (song: GenerationResponse) => {
    const metadata = song.metadata || {};
    return {
      mode: "custom",
      title: song.title || "",
      model_variant: song.model_variant,
      inputs: {
        prompt: song.prompt || "",
        lyrics: song.lyrics || "",
        instrumental: song.instrumental,
        bpm: song.bpm || undefined,
        duration_seconds: song.duration_seconds || undefined,
        key: song.key || undefined,
        time_signature: song.time_signature || undefined,
      },
      metadata,
      weirdness: (metadata as any)?.weirdness ?? 40,
      styleInfluence: (metadata as any)?.style_influence ?? 70,
    };
  };

  const handleReuse = (song: GenerationResponse) => {
    setPrefillData(buildPrefillFromSong(song));
  };

  const handleSeek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setProgress((prev) => ({ ...prev, current: value }));
  };

  const handleSaveSongDetails = async (songId: string, details: { title: string; prompt: string; lyrics: string }) => {
    const payload: any = {};
    if (details.title !== undefined) payload.title = sanitizeTitle(details.title);
    if (details.prompt !== undefined) payload.prompt = details.prompt;
    if (details.lyrics !== undefined) payload.lyrics = details.lyrics;
    if (Object.keys(payload).length === 0) return;
    await updateGeneration(songId, payload);
    queryClient.invalidateQueries({ queryKey: ["history"] });
  };

  const handleUploadCover = async (songId: string, file: File) => {
    await uploadCover(songId, file);
    queryClient.invalidateQueries({ queryKey: ["history"] });
  };

  const handleDeleteCover = async (songId: string) => {
    await deleteCover(songId);
    queryClient.invalidateQueries({ queryKey: ["history"] });
  };

  const handleRegenerateCover = async (songId: string) => {
    const current = history?.find((item: GenerationResponse) => item.id === songId);
    setCoverGenerationState({ id: songId, previousUrl: current?.cover_image_url || null });
    try {
      await regenerateCover(songId);
      queryClient.invalidateQueries({ queryKey: ["history"] });
    } catch (error) {
      setCoverGenerationState(null);
      console.error("Cover regeneration failed", error);
      alert("Cover regeneration failed. Please check your image generation settings and try again.");
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background text-white">
      <header className="h-14 border-b border-border flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-accent" />
          <div>
            <p className="text-sm font-semibold">{config?.app_name || "ACE-Step Studio"}</p>
            <p className="text-xs text-subtle">Local-only ACE-Step workspace • Secure on your machine</p>
          </div>
        </div>
        <button onClick={() => setSettingsOpen(true)} className="text-subtle hover:text-white">
          <SettingsIcon className="h-5 w-5" />
        </button>
      </header>
      <main className="flex flex-1 overflow-hidden">
        <CreatePanel
          onSubmit={handleCreate}
          onLLMTask={async (payload) => {
            if (payload.task === "lyrics" && !payload.seed_prompt.includes(ENGLISH_LYRICS_INSTRUCTION)) {
              payload.seed_prompt = `${payload.seed_prompt}\n${ENGLISH_LYRICS_INSTRUCTION}`;
            }
            const response = await llmMutation.mutateAsync(payload);
            return response.output;
          }}
          isSubmitting={flowRunning || createMutation.isPending}
          modelAvailability={ditAvailability}
          defaultVariant={defaultVariant}
          prefillData={prefillData}
          onPrefillUsed={() => setPrefillData(null)}
        />
        <LibraryPanel
          items={filteredHistory}
          pendingItems={pendingGenerations}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDelete={handleDelete}
          onPlay={handlePlay}
          onTogglePlay={handleCardTogglePlay}
          onEdit={(song) => setEditSong(song)}
          onReuse={handleReuse}
          onDownload={handleDownload}
          currentlyPlayingId={playingId || undefined}
          isPlaying={isPlaying}
        />
        {selectedSong && (
          <SongDetailPanel
            song={selectedSong}
            onClose={() => setSelectedId(undefined)}
            onDelete={handleDelete}
            onDownload={() => handleDownload(selectedSong)}
            onReuse={() => handleReuse(selectedSong)}
            onEdit={() => setEditSong(selectedSong)}
          />
        )}
      </main>
      <PlaybackBar
        song={selectedSong}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        progress={progress}
        onSeek={handleSeek}
        onDownload={selectedSong ? () => handleDownload(selectedSong) : undefined}
        onReuse={selectedSong ? () => handleReuse(selectedSong) : undefined}
        onDelete={selectedSong ? () => handleDelete(selectedSong.id) : undefined}
      />
      <audio ref={audioRef} className="hidden" />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} config={config} />
      <SongEditModal
        song={editSong || undefined}
        open={!!editSong}
        onClose={() => setEditSong(null)}
        onSave={async (details) => {
          if (editSong) {
            await handleSaveSongDetails(editSong.id, details);
          }
          setEditSong(null);
        }}
        onRegenerateCover={async () => {
          if (editSong) {
            await handleRegenerateCover(editSong.id);
          }
        }}
        onOpenUpload={() => {
          if (editSong) setUploadSong(editSong);
        }}
        onDeleteCover={async () => {
          if (editSong) {
            await handleDeleteCover(editSong.id);
          }
        }}
        coverGenerating={!!editSong && coverGenerationState?.id === editSong.id}
      />
      <CoverUploadModal
        open={!!uploadSong}
        onClose={() => setUploadSong(null)}
        onUpload={async (file) => {
          if (uploadSong) {
            await handleUploadCover(uploadSong.id, file);
            queryClient.invalidateQueries({ queryKey: ["history"] });
          }
        }}
        onGenerate={
          uploadSong
            ? async () => {
                await handleRegenerateCover(uploadSong.id);
              }
            : undefined
        }
        isGenerating={uploadSong ? coverGenerationState?.id === uploadSong.id : false}
      />
    </div>
  );
}
