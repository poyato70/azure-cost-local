import type { ResultMeta } from "../../shared/contracts.js";
export function StatusPanel({ meta }: { meta: ResultMeta }) {
  return (
    <div className="source">
      <span className={"status-dot " + meta.status} />
      <span>
        {meta.status === "complete"
          ? "Consulta concluída"
          : meta.status === "partial"
            ? "Resultado parcial"
            : "Indisponível"}{" "}
        · {meta.source} · {new Date(meta.fetchedAt).toLocaleString("pt-BR")}
      </span>
      {meta.warnings.map((w, i) => (
        <p key={i}>{w}</p>
      ))}
    </div>
  );
}
export function Empty({
  title = "Nenhum dado financeiro carregado",
  text = "Escolha seu escopo e consulte o Azure para começar.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">↗</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
