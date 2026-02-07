import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import { GenerationResponse } from "../types/generation";
import { getCoverIcon } from "../utils/covers";

type Props = {
  song?: GenerationResponse;
  open: boolean;
  onClose: () => void;
  onSave: (payload: { title: string; prompt: string; lyrics: string }) => Promise<void>;
  onRegenerateCover: () => Promise<void>;
  onOpenUpload: () => void;
  onDeleteCover: () => Promise<void>;
  coverGenerating: boolean;
};

export function SongEditModal({
  song,
  open,
  onClose,
  onSave,
  onRegenerateCover,
  onOpenUpload,
  onDeleteCover,
  coverGenerating,
}: Props) {
  const [title, setTitle] = useState(song?.title || "");
  const [prompt, setPrompt] = useState(song?.prompt || "");
  const [lyrics, setLyrics] = useState(song?.lyrics || "");
  const [isSaving, setIsSaving] = useState(false);
  const Icon = getCoverIcon(song?.cover_icon || undefined);

  useEffect(() => {
    setTitle(song?.title || "");
    setPrompt(song?.prompt || "");
    setLyrics(song?.lyrics || "");
  }, [song]);

  if (!open || !song) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await onSave({ title, prompt, lyrics });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-surface rounded-3xl p-6 w-[760px] space-y-4 border border-border relative">
        <button onClick={onClose} className="text-subtle absolute top-4 right-4">
          ✕
        </button>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex gap-6 items-start">
            <div className="w-60 space-y-3">
              <div>
                <p className="text-lg font-semibold">Edit Song</p>
                <p className="text-xs text-subtle">Tweak details, lyrics, and cover art</p>
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
                {song.cover_image_url && (
                  <button
                    type="button"
                    className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    title="Remove cover"
                    onClick={onDeleteCover}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                {coverGenerating && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="h-10 w-10 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  </div>
                )}
              </div>
              <button
                type="button"
                className="w-full rounded-full bg-accent/90 text-black py-2 text-sm font-semibold disabled:opacity-50"
                onClick={onRegenerateCover}
                disabled={coverGenerating}
              >
                {coverGenerating ? "Generating…" : "Generate Cover Art"}
              </button>
              <button
                type="button"
                className="w-full rounded-full bg-surface py-2 text-sm"
                onClick={onOpenUpload}
                disabled={coverGenerating}
              >
                Update Cover Art
              </button>
            </div>
            <div className="flex-1 space-y-4">
              <label className="space-y-2 text-sm">
                <span className="text-subtle text-xs uppercase tracking-wide">Title</span>
                <input
                  className="w-full rounded-2xl bg-background border border-border p-3"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-subtle text-xs uppercase tracking-wide">Song Description</span>
                <textarea
                  className="w-full rounded-2xl bg-background border border-border p-3"
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the vibe, genre, instrumentation..."
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-subtle text-xs uppercase tracking-wide">Lyrics</span>
                <textarea
                  className="w-full rounded-2xl bg-background border border-border p-3"
                  rows={6}
                  value={lyrics || ""}
                  onChange={(e) => setLyrics(e.target.value)}
                  placeholder="Edit the displayed lyrics"
                />
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="px-4 py-2 rounded-full bg-surface text-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-full bg-accent text-black text-sm font-semibold disabled:opacity-50"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
