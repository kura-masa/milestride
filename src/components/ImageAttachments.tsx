"use client";
import { useRef, useState } from "react";

export default function ImageAttachments({
  images,
  nodeId,
  onAdd,
  onRemove,
}: {
  images: string[];
  nodeId: string | null;
  onAdd: (file: File) => Promise<void>;
  onRemove: (url: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await onAdd(file);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async (url: string) => {
    setRemoving(url);
    try {
      await onRemove(url);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url) => (
            <div key={url} className="relative group">
              <button
                type="button"
                onClick={() => setPreview(url)}
                className="block w-20 h-20 rounded-xl overflow-hidden ring-1 ring-[var(--ring-soft)] bg-[var(--bg-panel-soft)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </button>
              <button
                type="button"
                disabled={removing === url}
                onClick={() => handleRemove(url)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow active:bg-red-600 disabled:opacity-50"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!nodeId || uploading}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ring-1 ring-[var(--ring-soft)] bg-[var(--bg-panel-soft)] text-[var(--text-secondary)] active:bg-[var(--bg-elev)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <span className="text-[var(--text-muted)]">アップロード中…</span>
          ) : (
            <>
              <span>🖼</span>
              <span>画像を添付</span>
            </>
          )}
        </button>
        {!nodeId && (
          <span className="text-[10px] text-[var(--text-muted)]">保存後に添付できます</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {preview && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt=""
            className="max-w-full max-h-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
