import { useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
  onGenerate?: () => Promise<void>;
  isGenerating?: boolean;
};

export function CoverUploadModal({ open, onClose, onUpload, onGenerate, isGenerating }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [triggeringGenerate, setTriggeringGenerate] = useState(false);

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setIsSaving(true);
    try {
      await onUpload(file);
      setFile(null);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-surface rounded-3xl p-6 w-[480px] space-y-4 border border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Update Cover Art</h3>
          <button onClick={onClose} className="text-subtle">
            ✕
          </button>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div
            className="border border-dashed border-border rounded-2xl h-64 flex flex-col items-center justify-center gap-3 cursor-pointer bg-background/40"
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <div className="text-2xl">⬆️</div>
            <p className="text-sm text-subtle">Drag & drop or click to upload</p>
            {file && <p className="text-xs break-all px-6">{file.name}</p>}
          </div>
          <div className="flex justify-between gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded-full bg-surface text-sm"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <div className="flex gap-2">
              {onGenerate && (
                <button
                  type="button"
                  className="px-4 py-2 rounded-full bg-surface text-sm disabled:opacity-50"
                  onClick={async () => {
                    if (!onGenerate) return;
                    setTriggeringGenerate(true);
                    try {
                      await onGenerate();
                      onClose();
                    } finally {
                      setTriggeringGenerate(false);
                    }
                  }}
                  disabled={isGenerating || triggeringGenerate}
                >
                  {isGenerating || triggeringGenerate ? "Generating…" : "Generate Cover Art"}
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-2 rounded-full bg-accent text-black text-sm font-semibold disabled:opacity-50"
                disabled={!file || isSaving}
              >
                {isSaving ? "Uploading…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
