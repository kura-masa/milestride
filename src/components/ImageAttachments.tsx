"use client";
import { useRef, useState } from "react";
import { useLongPress } from "@/lib/useLongPress";
import ConfirmDialog from "./ConfirmDialog";

function ImageThumb({
  url,
  onTap,
  onLongPress,
  selected,
  onDeleteTap,
}: {
  url: string;
  onTap: () => void;
  onLongPress: () => void;
  selected: boolean;
  onDeleteTap: () => void;
}) {
  const lp = useLongPress({ onTap, onLongPress });
  return (
    <div className="relative">
      <button
        type="button"
        {...lp}
        className={`block w-20 h-20 rounded-xl overflow-hidden ring-2 bg-[var(--bg-panel-soft)] transition ${
          selected ? "ring-red-400 scale-95" : "ring-[var(--ring-soft)]"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="w-full h-full object-cover" />
        {selected && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white text-xs font-bold">長押し中</span>
          </div>
        )}
      </button>
      {selected && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDeleteTap(); }}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-lg active:bg-red-600"
        >
          🗑
        </button>
      )}
    </div>
  );
}

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
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [confirmUrl, setConfirmUrl] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
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

  const handleConfirmRemove = async () => {
    if (!confirmUrl) return;
    setRemoving(true);
    try {
      await onRemove(confirmUrl);
    } finally {
      setRemoving(false);
      setConfirmUrl(null);
      setSelectedUrl(null);
    }
  };

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          onPointerDown={(e) => {
            // Tap outside any thumb → deselect
            if ((e.target as HTMLElement).closest("[data-thumb]") === null) {
              setSelectedUrl(null);
            }
          }}
        >
          {images.map((url) => (
            <div key={url} data-thumb="1">
              <ImageThumb
                url={url}
                selected={selectedUrl === url}
                onTap={() => {
                  if (selectedUrl === url) {
                    setSelectedUrl(null);
                  } else if (selectedUrl) {
                    setSelectedUrl(null);
                  } else {
                    setPreview(url);
                  }
                }}
                onLongPress={() => setSelectedUrl(url)}
                onDeleteTap={() => {
                  setConfirmUrl(url);
                  setSelectedUrl(null);
                }}
              />
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

      <ConfirmDialog
        open={!!confirmUrl}
        title="画像を削除しますか？"
        confirmLabel={removing ? "削除中…" : "削除する"}
        cancelLabel="削除しない"
        onConfirm={handleConfirmRemove}
        onCancel={() => setConfirmUrl(null)}
      />
    </div>
  );
}
