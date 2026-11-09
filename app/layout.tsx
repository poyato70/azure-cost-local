import type { ReactNode } from "react";
import "../src/web/styles.css";
import "./theme.css";
export const metadata = {
  title: "TESSERACT · Financial Intelligence",
  description: "Centro de inteligência financeira e IA",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
