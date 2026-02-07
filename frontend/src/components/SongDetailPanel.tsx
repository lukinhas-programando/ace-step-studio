import { useState } from "react";
import { Copy, ImageUp } from "lucide-react";

import { GenerationResponse } from "../types/generation";
import { getCoverIcon } from "../utils/covers";

type Props = {
  song: GenerationResponse;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onDownload?: () => void;
  onReuse?: () => void;
  onEdit?: () => void;
};

function formatMeta(item: GenerationResponse) {
  const metas: string[] = [];
  if (item.bpm) metas.push(`${item.bpm} BPM`);
  if (item.key) metas.push(item.key);
  if (item.time_signature) metas.push(item.time_signature);
  if (item.duration_seconds) metas.push(`${item.duration_seconds}s`);
  return metas.join(" • ");
}

export function SongDetailPanel({ song, onClose, onDelete, onDownload, onReuse, onEdit }: Props) {
  const [styleOpen, setStyleOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(true);
  const Icon = getCoverIcon(song.cover_icon || undefined);
  const metadata = (song.metadata || {}) as any;
  const weirdness = metadata?.weirdness ?? metadata?.metas?.weirdness;
  const styleInfluence = metadata?.style_influence ?? metadata?.metas?.style_influence;
  const metaDisplay = [song.status, formatMeta(song)].filter(Boolean).join(" • ") || "—";

  const handleCopy = async (text?: string | null) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
  };

  const Stat = ({ label, value }: { label: string; value?: string | number }) =>
    value === undefined || value === null ? null : (
      <div className="flex flex-col">
        <span className="text-[11px] uppercase tracking-wide text-subtle">{label}</span>
        <span className="text-sm font-medium">{value}</span>
      </div>
    );

  return (
    <aside className="w-96 min-w-96 border-l border-border bg-panel/90 flex flex-col">
      <div className="p-4 flex flex-col gap-4 overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-base font-semibold truncate">{song.title || "Untitled"}</p>
            <p className="text-xs text-subtle capitalize">
              {song.task_type} · {song.mode}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button className="text-xs rounded-full bg-surface px-3 py-1" onClick={onEdit}>
                Edit
              </button>
            )}
            <button className="text-subtle text-xs" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>
        <div className="relative rounded-3xl overflow-hidden aspect-square bg-background/50 group">
          {song.cover_image_url ? (
            <img src={song.cover_image_url} alt={song.title || "cover"} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: song.cover_color || "#333" }}
            >
              <Icon className="h-10 w-10 text-black/50" />
            </div>
          )}
          {onEdit && (
            <button
              className="absolute inset-x-0 bottom-0 bg-black/60 text-xs py-2 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition"
              onClick={onEdit}
            >
              <ImageUp className="h-4 w-4" />
              Change Image
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {onDownload && (
            <button
              className="flex-1 rounded-full bg-surface py-2 text-sm disabled:opacity-50"
              onClick={onDownload}
              disabled={!song.audio_url}
            >
              Download
            </button>
          )}
          {onReuse && (
            <button className="flex-1 rounded-full bg-surface py-2 text-sm" onClick={onReuse}>
              Reuse Settings
            </button>
          )}
        </div>

        <div className="bg-surface/60 rounded-2xl p-3 space-y-2 text-xs text-subtle">
          <div className="flex gap-4">
            <Stat label="Meta" value={metaDisplay} />
          </div>
          <div className="flex gap-6">
            <Stat label="Weirdness" value={weirdness !== undefined ? `${weirdness}%` : undefined} />
            <Stat
              label="Style Influence"
              value={styleInfluence !== undefined ? `${styleInfluence}%` : undefined}
            />
          </div>
        </div>

        <details
          className="bg-surface/60 rounded-2xl p-3 text-sm"
          open={styleOpen}
          onToggle={(e) => setStyleOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer text-xs uppercase tracking-wide text-subtle flex items-center justify-between">
            Style & Prompt
            <button
              type="button"
              className="text-xs text-subtle"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCopy(song.prompt);
              }}
            >
              <Copy className="h-4 w-4" />
            </button>
          </summary>
          <p className="mt-2 text-subtle text-xs whitespace-pre-wrap">{song.prompt || "No prompt"}</p>
        </details>

        {song.lyrics && (
          <details
            className="bg-surface/60 rounded-2xl p-3 text-sm"
            open={lyricsOpen}
            onToggle={(e) => setLyricsOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer text-xs uppercase tracking-wide text-subtle flex items-center justify-between">
              Lyrics
              <button
                type="button"
                className="text-xs text-subtle"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCopy(song.lyrics);
                }}
              >
                <Copy className="h-4 w-4" />
              </button>
            </summary>
            <div className="mt-2 text-xs whitespace-pre-wrap max-h-64 overflow-y-auto">{song.lyrics}</div>
          </details>
        )}

        {onDelete && (
          <button
            className="w-full border border-border rounded-full py-2 text-sm text-red-300 hover:bg-red-400/10"
            onClick={() => {
              if (confirm("Delete this song permanently?")) {
                onDelete(song.id);
              }
            }}
          >
            Delete Song
          </button>
        )}
      </div>
    </aside>
  );
}
