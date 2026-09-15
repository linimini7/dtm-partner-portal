"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * A drop-zone + file picker for one image. Native file inputs can't be
 * pre-filled with an existing value, so this shows the server-rendered
 * current image (imageSrc) until the user picks a local file, at which
 * point it swaps to an object-URL preview of that pending choice — either
 * way the box always reflects what will actually be saved.
 *
 * `compact` + `autoSubmit` power the brand-logo tiles: small, no visible
 * submit button, and the surrounding <form> submits itself the instant a
 * file is chosen or removed (each tile is its own single-field form) so a
 * partner filling this in never has to find a separate save button.
 */
export default function ImageDropField({
  name,
  removeFieldName,
  hasExistingImage,
  imageSrc,
  compact = false,
  autoSubmit = false,
  label,
}: {
  name: string;
  removeFieldName: string;
  hasExistingImage: boolean;
  imageSrc: string;
  compact?: boolean;
  autoSubmit?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const removeInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const { pending } = useFormStatus();
  const [justSaved, setJustSaved] = useState(false);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) {
      setJustSaved(true);
      const timeout = setTimeout(() => setJustSaved(false), 1500);
      return () => clearTimeout(timeout);
    }
    wasPending.current = pending;
  }, [pending]);

  const hasImage = (hasExistingImage && !removed) || !!preview;

  function setFile(file: File | null) {
    if (!file) return;
    if (inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      inputRef.current.files = dt.files;
    }
    setPreview(URL.createObjectURL(file));
    setRemoved(false);
    if (removeInputRef.current) removeInputRef.current.value = "";
    if (autoSubmit) inputRef.current?.form?.requestSubmit();
  }

  function handleRemove() {
    setRemoved(true);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
    if (removeInputRef.current) removeInputRef.current.value = "on";
    if (autoSubmit) inputRef.current?.form?.requestSubmit();
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      name={name}
      accept="image/*"
      className="hidden"
      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
    />
  );
  const removeInput = (
    <input ref={removeInputRef} type="hidden" name={removeFieldName} defaultValue="" />
  );

  if (compact) {
    return (
      <div className="flex flex-col gap-1">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            setFile(e.dataTransfer.files?.[0] ?? null);
          }}
          onClick={() => inputRef.current?.click()}
          className="relative flex h-24 items-center justify-center overflow-hidden rounded-[8px] border border-dashed cursor-pointer"
          style={{
            borderColor: dragOver ? "var(--accent)" : "var(--dtm-hairline-2)",
            background: dragOver ? "rgb(212 54 122 / 6%)" : "var(--dtm-ink-2)",
          }}
        >
          {hasImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview ?? imageSrc} alt="" className="max-h-full max-w-full object-contain" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
                className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full text-xs"
                style={{ background: "var(--dtm-ink)", color: "var(--fg-3)" }}
                aria-label="Remove logo"
              >
                ✕
              </button>
            </>
          ) : (
            <span className="px-2 text-center text-[11px] text-fg-5">Drop logo</span>
          )}
        </div>
        <div className="text-center text-[10px] text-fg-5">
          {pending ? "Saving…" : justSaved ? "Saved ✓" : label}
        </div>
        {fileInput}
        {removeInput}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          setFile(e.dataTransfer.files?.[0] ?? null);
        }}
        onClick={() => inputRef.current?.click()}
        className="flex h-52 items-center justify-center overflow-hidden rounded-[10px] border border-dashed cursor-pointer"
        style={{
          borderColor: dragOver ? "var(--accent)" : "var(--dtm-hairline-2)",
          background: dragOver ? "rgb(212 54 122 / 6%)" : "var(--dtm-ink-2)",
        }}
      >
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview ?? imageSrc} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="px-4 text-center text-sm text-fg-5">
            Drop an image here, or click to choose one
          </span>
        )}
      </div>

      {fileInput}
      {removeInput}

      <div className="flex gap-2">
        {hasImage ? (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-[8px] border border-dtm-hairline px-3 py-1.5 text-sm text-fg-2"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="rounded-[8px] border border-dtm-hairline px-3 py-1.5 text-sm text-fg-2"
            >
              Remove
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-[8px] border border-dtm-hairline px-3 py-1.5 text-sm text-fg-2"
          >
            Choose file
          </button>
        )}
      </div>
    </div>
  );
}
