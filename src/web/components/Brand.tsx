import type { KeyboardEvent, MouseEvent } from "react";

export function Brand({ onEasterEgg }: { onEasterEgg?: () => void }) {
  return (
    <a
      className="brand"
      href="/"
      aria-label="TESSERACT — início. Ctrl e clique para abrir a animação."
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        if (event.ctrlKey) {
          event.preventDefault();
          onEasterEgg?.();
        }
      }}
      onKeyDown={(event: KeyboardEvent<HTMLAnchorElement>) => {
        if (event.ctrlKey && event.key === "Enter") {
          event.preventDefault();
          onEasterEgg?.();
        }
      }}
    >
      <img
        className="brand-mark"
        src="/tesseract-symbol.png"
        alt=""
        width="46"
        height="46"
      />
      <div>
        TESSERACT<small>FINOPS &amp; IA</small>
      </div>
    </a>
  );
}
