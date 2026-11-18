import { useEffect, useRef } from "react";
import { X } from "lucide-react";

type Point4 = [number, number, number, number];

function project(point: Point4, time: number, width: number, height: number) {
  const [x, y, z, w] = point;
  const ax = time * 0.26;
  const ay = time * 0.19;
  const x1 = x * Math.cos(ax) - w * Math.sin(ax);
  const w1 = x * Math.sin(ax) + w * Math.cos(ax);
  const y1 = y * Math.cos(ay) - w1 * Math.sin(ay);
  const w2 = y * Math.sin(ay) + w1 * Math.cos(ay);
  const perspective = 2.8 / (3.8 - w2);
  const scale = Math.min(width, height) * 0.2;
  return [width / 2 + x1 * perspective * scale, height / 2 + y1 * perspective * scale, z * perspective] as const;
}

export function TesseractOpening({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let animation = 0;
    const vertices: Point4[] = [];
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) for (const w of [-1, 1]) vertices.push([x, y, z, w]);
    const edges: [number, number][] = [];
    vertices.forEach((left, i) => vertices.slice(i + 1).forEach((right, j) => {
      if (left.filter((value, axis) => value !== right[axis]).length === 1) edges.push([i, i + j + 1]);
    }));
    const draw = (time: number) => {
      if (!canvas || !context) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const seconds = reduced ? 0.8 : time / 1000;
      const points = vertices.map((point) => project(point, seconds, width, height));
      const opacity = reduced ? 1 : Math.min(1, time / 900);
      context.lineWidth = 1.4;
      context.lineCap = "round";
      edges.forEach(([from, to]) => {
        const a = points[from], b = points[to];
        context.strokeStyle = `rgba(39,208,221,${(0.28 + (a[2] + b[2] + 4) * 0.07) * opacity})`;
        context.beginPath(); context.moveTo(a[0], a[1]); context.lineTo(b[0], b[1]); context.stroke();
      });
      points.forEach(([x, y, depth]) => {
        context.fillStyle = `rgba(129,244,249,${(0.45 + (depth + 2) * 0.12) * opacity})`;
        context.beginPath(); context.arc(x, y, Math.max(1.5, 2 + depth), 0, Math.PI * 2); context.fill();
      });
      if (!reduced) animation = window.requestAnimationFrame(draw);
    };
    const resize = () => { if (reduced) draw(800); };
    if (reduced) draw(800); else animation = window.requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(animation);
      if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
      previousFocus.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="opening-overlay" role="dialog" aria-modal="true" aria-labelledby="opening-title">
      <canvas className="opening-canvas" ref={canvasRef} aria-hidden="true" />
      <div className="opening-copy">
        <span className="opening-mark" aria-hidden="true">T</span>
        <h2 id="opening-title">TESSERACT <span>2</span></h2>
        <p>Um espaço para conectar possibilidades.</p>
      </div>
      <button className="opening-close" type="button" onClick={onClose} ref={closeRef} aria-label="Fechar animação">
        <X size={18} /> Fechar <kbd>Esc</kbd>
      </button>
    </div>
  );
}
