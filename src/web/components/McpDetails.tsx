import { describeMcp } from "../../shared/mcp-info.js";
export function McpDetails({ profile }: { profile: any }) {
  return (
    <dl className="mcp-details">
      {describeMcp(profile).map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function McpIdentity({
  profile,
  accesses,
  activeAccessId,
  principalKind,
  onConnect,
  loginPending = false,
}: {
  profile: any;
  accesses: any[];
  activeAccessId?: string;
  principalKind?: string;
  onConnect?: (profile: any) => void;
  loginPending?: boolean;
}) {
  if (["custom", "kubernetes"].includes(profile.preset))
    return (
      <p className="fine">
        Esta conexão usa a autenticação do endpoint MCP; não depende de
        identidade Azure.
      </p>
    );
  const access = accesses.find((a) => a.id === profile.accessId);
  const ready =
    !!access &&
    activeAccessId === access.id &&
    (profile.authMode === "application"
      ? principalKind === "application"
      : principalKind === "user");
  return (
    <div className="identity-context">
      <strong>Identidade Azure: {access?.name || "nenhuma selecionada"}</strong>
      <p className="fine">
        É o cadastro em Acessos que contém Tenant ID, Client ID e, no modo
        aplicação, a credencial protegida. Conectar esta identidade não testa as
        tools do MCP.
      </p>
      <p>
        {ready
          ? "Identidade conectada nesta sessão."
          : "Conecte a identidade selecionada antes de testar este MCP."}
      </p>
      {ready &&
        access &&
        profile.transport === "http" &&
        profile.authMode === "delegated" && (
          <button
            disabled={loginPending}
            aria-busy={loginPending}
            onClick={() => onConnect?.(profile)}
          >
            {loginPending ? "Aguardando autorização…" : "Autorizar recurso MCP"}
          </button>
        )}
      {!ready && access && (
        <button
          disabled={loginPending}
          aria-busy={loginPending}
          onClick={() => onConnect?.(profile)}
        >
          {loginPending ? "Aguardando login…" : `Conectar identidade ${access.name}`}
        </button>
      )}
    </div>
  );
}
