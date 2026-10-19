"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { downloadBlob } from "@/lib/download";
import { copyText, shareImage, shareTargets, type ShareOutcome } from "@/lib/share";

/*
 * Sharing an image. On phones the system share sheet takes the PNG straight into Instagram,
 * WhatsApp or X (`useImageShare` tries that first). Everywhere else this small menu opens next to
 * the button: save the image, copy the link, open WhatsApp or X with the message, and a note on
 * how stories work on Instagram, which has no web intent.
 */

export interface ShareableImage {
  blob: Blob;
  filename: string;
}

export interface ShareRequest {
  /** Renders the PNG on demand, so nothing is rasterised until someone asks. */
  render: () => Promise<Blob>;
  filename: string;
  title: string;
  /** The message without the link; the link is appended where it must travel inside the text. */
  text: string;
  url: string;
}

export type ShareStatus = "idle" | "rendering" | "shared" | "copied" | "failed";

/** Drives one share button: render the PNG, try the share sheet, else open the menu. */
export function useImageShare() {
  const [status, setStatus] = useState<ShareStatus>("idle");
  const [menu, setMenu] = useState<(ShareableImage & Omit<ShareRequest, "render" | "filename">) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((s: ShareStatus) => {
    setStatus(s);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 2600);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const start = useCallback(
    async (req: ShareRequest, mode: "sheet" | "menu" = "sheet") => {
      setStatus("rendering");
      let blob: Blob;
      try {
        blob = await req.render();
      } catch {
        flash("failed");
        return;
      }
      let outcome: ShareOutcome = "menu";
      if (mode === "sheet") outcome = await shareImage({ blob, filename: req.filename, title: req.title, text: req.text, url: req.url });
      if (outcome === "shared") flash("shared");
      else if (outcome === "aborted") setStatus("idle");
      else {
        setStatus("idle");
        setMenu({ blob, filename: req.filename, title: req.title, text: req.text, url: req.url });
      }
    },
    [flash],
  );

  const close = useCallback(() => setMenu(null), []);
  return { status, menu, start, close, flash };
}

interface MenuProps {
  image: ShareableImage;
  title: string;
  text: string;
  url: string;
  onClose: () => void;
  onCopied?: () => void;
  /** Which edge of the anchor the menu hangs from. */
  align?: "start" | "end";
}

const ICON = "size-4 shrink-0";

/** The fallback menu, as a small popover under the button that opened it. */
export default function ShareMenu({ image, title, text, url, onClose, onCopied, align = "end" }: MenuProps) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const targets = shareTargets(text, url);
  const message = `${text} ${url}`;

  // A preview of the image people are about to send, so the menu is not a leap of faith.
  const preview = useMemo(() => URL.createObjectURL(image.blob), [image.blob]);
  useEffect(() => () => URL.revokeObjectURL(preview), [preview]);

  // Escape and clicks outside close it; focus lands on the first action.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    ref.current?.querySelector<HTMLElement>("button, a")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  const copy = () => {
    const ok = copyText(message);
    setCopied(ok);
    if (ok) onCopied?.();
    setTimeout(() => setCopied(false), 2000);
  };

  const item = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-zinc-100 hover:bg-ink-3 focus-visible:bg-ink-3 focus-visible:outline-none";

  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={`${id}-t`}
      className={`absolute z-30 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-ink-2 p-2 shadow-2xl shadow-black/60 ${align === "end" ? "right-0" : "left-0"}`}
    >
      <div className="flex items-center gap-3 px-1.5 pt-1 pb-2">
        <div className="h-14 w-14 shrink-0 rounded-md overflow-hidden bg-zinc-800 grid place-items-center">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="max-h-full max-w-full object-contain" />
          ) : null}
        </div>
        <div className="min-w-0">
          <p id={`${id}-t`} className="display text-lg font-bold leading-tight">
            Share {title}
          </p>
          <p className="text-[11px] text-muted leading-snug">The picture carries a code back to this page.</p>
        </div>
      </div>
      <div className="border-t border-line pt-1.5 space-y-0.5">
        <button type="button" className={item} onClick={() => downloadBlob(image.blob, image.filename)}>
          <svg className={ICON} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M8 2v8m0 0 3-3m-3 3L5 7M3 12.5h10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Download image
        </button>
        <button type="button" className={item} onClick={copy}>
          <svg className={ICON} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M6.5 9.5a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2L7.4 4.4M9.5 6.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l1.1-1.1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {copied ? "Copied" : "Copy link and message"}
        </button>
        <a className={item} href={targets.whatsapp} target="_blank" rel="noopener noreferrer">
          <svg className={ICON} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M3.2 13.2 4 10.5A5.5 5.5 0 1 1 6 12.4l-2.8.8Z" strokeLinejoin="round" />
            <path d="M6.2 6.1c.2 1.6 1.7 3.1 3.3 3.3l.8-.8 1.2.6c-.2 1-1 1.4-1.8 1.2A5.4 5.4 0 0 1 5.6 6.3c-.1-.8.3-1.5 1.2-1.7l.6 1.2-.7.7Z" strokeLinejoin="round" />
          </svg>
          WhatsApp
        </a>
        <a className={item} href={targets.x} target="_blank" rel="noopener noreferrer">
          <svg className={ICON} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M3 3h3.2l6.8 10H9.8L3 3Zm.5 10 4.3-4.6M12.5 3 8.6 7.2" strokeLinejoin="round" />
          </svg>
          Post on X
        </a>
      </div>
      <p className="border-t border-line mt-1.5 px-2.5 pt-2 pb-1 text-[11px] text-muted leading-snug">Instagram: save the image, then post it to your story. On a phone, this button opens the share sheet instead.</p>
    </div>
  );
}
