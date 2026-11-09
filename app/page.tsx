"use client";
import dynamic from "next/dynamic";
const Workspace = dynamic(() => import("../src/web/Workspace.js"), {
  ssr: false,
  loading: () => (
    <div className="boot-orbit">TESSERACT · Iniciando inteligência local…</div>
  ),
});
export default function Page() {
  return <Workspace />;
}
