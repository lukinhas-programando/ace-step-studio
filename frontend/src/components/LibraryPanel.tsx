import { useEffect, useState } from "react";
import { MoreHorizontal, Pause, Play } from "lucide-react";

import { GenerationResponse } from "../types/generation";
import { getCoverIcon } from "../utils/covers";

type PendingGeneration = {
  tempId: string;
  title: string;
  prompt: string;
  stageLabels: string[];
  stageIndex: number;
  mode: "simple" | "custom";
  instrumental?: boolean;
  model_variant?: "base" | "turbo" | "shift";
  task_type?: string;
  error?: string;
};

type Props = {
  items: GenerationResponse[];
  pendingItems: PendingGeneration[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPlay: (item: GenerationResponse) => void;
  onTogglePlay: (item: GenerationResponse) => void;
  onEdit?: (item: GenerationResponse) => void;
  onReuse: (item: GenerationResponse) => void;
  onDownload: (item: GenerationResponse) => void;
  currentlyPlayingId?: string;
  isPlaying: boolean;
};

export function LibraryPanel({
  items,
  pendingItems,
  selectedId,
  onSelect,
  onDelete,
  onPlay,
  onTogglePlay,
  onEdit,
  onReuse,
  onDownload,
  currentlyPlayingId,
  isPlaying,
}: Props) {
  const total = items.length + pendingItems.length;
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  useEffect(() => {
    if (!menuOpenId) return;
    const handler = () => setMenuOpenId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuOpenId]);

  const renderStageStatus = (pending: PendingGeneration) => {
    const current = pending.stageLabels[Math.min(pending.stageIndex, pending.stageLabels.length - 1)];
    return (
      <div className="flex items-center gap-3 mt-3 text-xs text-subtle">
        <div className="flex items-center gap-2">
          {pending.stageLabels.map((label, index) => {
            const isDone = index < pending.stageIndex;
            const isActive = index === pending.stageIndex;
            const base = "h-2.5 w-2.5 rounded-full";
            const color = isDone ? "bg-green-400" : isActive ? "bg-accent animate-pulse" : "bg-border";
            return <span key={`${pending.tempId}-${label}`} className={`${base} ${color}`} />;
          })}
        </div>
        <span className="truncate">{current || "Preparing"}</span>
      </div>
    );
  };

  const formatMeta = (item: GenerationResponse) => {
    const parts: string[] = [];
    if (item.bpm) parts.push(`${item.bpm} BPM`);
    else parts.push("BPM Auto");
    if (item.key) parts.push(item.key);
    else parts.push("Key Auto");
    if (item.time_signature) parts.push(item.time_signature);
    else parts.push("Time Auto");
    return parts.join(" · ");
  };

  const truncate = (value?: string | null, max = 48) => {
    if (!value) return "Untitled";
    return value.length > max ? `${value.slice(0, max)}…` : value;
  };

  const VariantBadge = ({ variant }: { variant?: string }) => (
    <span className="px-2 py-0.5 rounded-full text-[11px] uppercase bg-white/10 text-white">
      {variant === "base" ? "BASE" : variant === "shift" ? "SHIFT" : "TURBO"}
    </span>
  );

  const TypeBadge = ({ type }: { type?: string }) => (
    <span className="px-2 py-0.5 rounded-full text-[11px] uppercase bg-border/40 text-subtle">
      {(type || "text2music").toUpperCase()}
    </span>
  );

  return (
    <section className="flex-1 overflow-y-auto bg-background">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-subtle">
          <span>Workspace</span>
          <span>{total} songs</span>
        </div>

        {pendingItems.map((pending) => (
          <div
            key={pending.tempId}
            className="rounded-2xl p-3 bg-surface border border-dashed border-border"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold">{truncate(pending.title)}</p>
                <div className="flex items-center gap-2">
                  <VariantBadge variant={pending.model_variant} />
                  <TypeBadge type={pending.task_type || "text2music"} />
                </div>
              </div>
              <button
                className="text-xs text-subtle hover:text-white"
                onClick={() => onDelete(pending.tempId)}
                title="Cancel"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-subtle mt-2 max-h-16 overflow-hidden">{pending.prompt || "Generating idea…"}</p>
            {renderStageStatus(pending)}
            {pending.error && <p className="text-xs text-red-400 mt-2">{pending.error}</p>}
         </div>
        ))}

        {items.map((item) => {
          const Icon = getCoverIcon(item.cover_icon || undefined);
          const isCurrent = currentlyPlayingId === item.id;
          const statusColor =
            item.status === "ready" ? "text-green-400" : item.status === "failed" ? "text-red-400" : "text-subtle";
          const showPause = isCurrent && isPlaying;
          return (
            <div
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`relative group w-full text-left rounded-2xl p-3 bg-surface border border-transparent hover:border-border transition cursor-pointer ${
                selectedId === item.id ? "border-accent" : ""
              }`}
            >
              <div className="flex gap-3">
                <div className="w-24 h-24 rounded-2xl bg-background/50 flex-shrink-0 relative overflow-hidden">
                  {item.cover_image_url ? (
                    <div className="w-full h-full">
                      <img
                        src={item.cover_image_url}
                        alt={item.title || "cover"}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ backgroundColor: item.cover_color || "#333" }}
                    >
                      <Icon className="h-8 w-8 text-black/70" />
                    </div>
                  )}
                  {item.audio_url && (
                    <button
                      className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePlay(item);
                      }}
                    >
                      {showPause ? (
                        <Pause className="h-6 w-6 text-white" />
                      ) : (
                        <Play className="h-6 w-6 text-white" />
                      )}
                    </button>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate">{truncate(item.title || item.prompt)}</p>
                        <VariantBadge variant={item.model_variant} />
                        <TypeBadge type={item.task_type} />
                      </div>
                      <p className="text-[11px] text-subtle mt-1">{formatMeta(item)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="h-8 w-8 rounded-full hover:bg-white/10 flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId((prev) => (prev === item.id ? null : item.id));
                        }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-subtle whitespace-nowrap overflow-hidden text-ellipsis">
                    {item.prompt || "No prompt"}
                  </p>
                </div>
              </div>
              {menuOpenId === item.id && (
                <div
                  className="absolute right-3 top-10 bg-panel/95 border border-border rounded-xl shadow-xl text-sm z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="px-4 py-2 hover:bg-white/10 w-full text-left disabled:text-subtle disabled:opacity-50"
                    onClick={() => {
                      onDownload(item);
                      setMenuOpenId(null);
                    }}
                    disabled={!item.audio_url}
                  >
                    Download
                  </button>
                  {onEdit && (
                    <button
                      className="px-4 py-2 hover:bg-white/10 w-full text-left"
                      onClick={() => {
                        onEdit(item);
                        setMenuOpenId(null);
                      }}
                    >
                      Edit Details
                    </button>
                  )}
                  <button
                    className="px-4 py-2 hover:bg-white/10 w-full text-left"
                    onClick={() => {
                      onReuse(item);
                      setMenuOpenId(null);
                    }}
                  >
                    Reuse Settings
                  </button>
                  <button
                    className="px-4 py-2 hover:bg-white/10 w-full text-left text-red-300"
                    onClick={() => {
                      onDelete(item.id);
                      setMenuOpenId(null);
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
