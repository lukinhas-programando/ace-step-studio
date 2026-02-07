import { useEffect, useState } from "react";
import { MoreHorizontal, Pause, Play } from "lucide-react";

import { GenerationResponse } from "../types/generation";
import { getCoverIcon } from "../utils/covers";

type Props = {
  song?: GenerationResponse;
  isPlaying: boolean;
  onPlayPause: () => void;
  progress: { current: number; duration: number };
  onSeek: (value: number) => void;
  onDownload?: () => void;
  onReuse?: () => void;
  onDelete?: () => void;
};

const formatTime = (seconds: number) => {
  if (!isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

export function PlaybackBar({
  song,
  isPlaying,
  onPlayPause,
  progress,
  onSeek,
  onDownload,
  onReuse,
  onDelete,
}: Props) {
  const hasAudio = Boolean(song?.audio_url);
  const Icon = getCoverIcon(song?.cover_icon || undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const handle = () => setMenuOpen(false);
    document.addEventListener("click", handle);
    return () => document.removeEventListener("click", handle);
  }, [menuOpen]);

  return (
    <footer className="h-24 border-t border-border bg-background flex items-center px-6 gap-6">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-background/40 flex-shrink-0">
          {song?.cover_image_url ? (
            <img src={song.cover_image_url} alt={song.title || "cover"} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: song?.cover_color || "#333" }}
            >
              <Icon className="h-6 w-6 text-black/60" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{song?.title || "Ready"}</p>
          <p className="text-xs text-subtle truncate">
            {song ? (song.audio_url ? "Tap play to listen" : "Audio processing…") : "Queue music to begin"}
          </p>
        </div>
      </div>
      <div className="flex flex-col flex-[2]">
        <div className="flex justify-center gap-3 mb-2">
          <button
            className={`h-12 w-12 rounded-full flex items-center justify-center font-semibold ${
              hasAudio ? "bg-accent text-black" : "bg-surface text-subtle cursor-not-allowed"
            }`}
            onClick={onPlayPause}
            disabled={!hasAudio}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-subtle">
          <span>{formatTime(progress.current)}</span>
          <input
            type="range"
            min={0}
            max={progress.duration || 1}
            value={Math.min(progress.current, progress.duration || 1)}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="flex-1 accent-accent"
            disabled={!hasAudio}
          />
          <span>{formatTime(progress.duration || 0)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 relative">
        <button
          className="h-10 w-10 rounded-full hover:bg-white/10 flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((prev) => !prev);
          }}
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-12 bg-panel border border-border rounded-xl shadow-xl text-sm z-20"
            onClick={(e) => e.stopPropagation()}
          >
            {onDownload && (
              <button
                className="px-4 py-2 hover:bg-white/10 w-full text-left disabled:opacity-50 disabled:text-subtle"
                onClick={() => {
                  onDownload();
                  setMenuOpen(false);
                }}
                disabled={!song?.audio_url}
              >
                Download
              </button>
            )}
            {onReuse && (
              <button
                className="px-4 py-2 hover:bg-white/10 w-full text-left"
                onClick={() => {
                  onReuse();
                  setMenuOpen(false);
                }}
              >
                Reuse Settings
              </button>
            )}
            {onDelete && (
              <button
                className="px-4 py-2 hover:bg-white/10 w-full text-left text-red-300"
                onClick={() => {
                  if (song && confirm("Delete this song permanently?")) {
                    onDelete();
                  }
                  setMenuOpen(false);
                }}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </footer>
  );
}
