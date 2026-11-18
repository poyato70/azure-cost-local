import { useEffect, useRef } from "react";
import { X } from "lucide-react";

type OpeningMessage = { type?: string };

export function TesseractOpening({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (
        event.key === "Tab" &&
        event.shiftKey &&
        document.activeElement === closeRef.current
      ) {
        event.preventDefault();
        frameRef.current?.contentWindow?.postMessage(
          { type: "tesseract-opening:focus-last" },
          window.location.origin,
        );
      }
    };
    const onMessage = (event: MessageEvent<OpeningMessage>) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frameRef.current?.contentWindow
      ) return;
      if (event.data?.type === "tesseract-opening:close") onClose();
      if (event.data?.type === "tesseract-opening:focus-close")
        closeRef.current?.focus();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("message", onMessage);
      previousFocus.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="opening-overlay" role="dialog" aria-modal="true" aria-label="Abertura animada do Tesseract">
      <button
        className="opening-close"
        type="button"
        onClick={onClose}
        ref={closeRef}
        aria-label="Fechar animação"
      >
        <X size={18} aria-hidden="true" /> Fechar <kbd>Esc</kbd>
      </button>
      <iframe
        ref={frameRef}
        className="opening-frame"
        src="/tesseract-abertura.html"
        title="Animação original de abertura do Tesseract; o som está desligado inicialmente."
      />
    </div>
  );
}
