import { useEffect, useState } from "react";
import type { PublicAccessProfile } from "../../shared/connections.js";
import { manageRequest } from "../api.js";
const initial = {
  name: "",
  tenantId: "",
  clientId: "",
  preferredMode: "user",
  secretExpiresAt: "",
};
export function Accesses({
  profiles,
  onChanged,
  onConnect,
  connectionFeedback,
}: {
  connectionFeedback?: {
    id: string;
    kind: "pending" | "success" | "error";
    message: string;
  };
  profiles: PublicAccessProfile[];
  onChanged: () => void;
  onConnect: (id: string, mode: "user" | "application") => void;
}) {
  const [form, setForm] = useState<any>(initial),
    [action, setAction] = useState("keep"),
    [secret, setSecret] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [testFeedback, setTestFeedback] = useState<{
      id: string;
      kind: "pending" | "success" | "error";
      message: string;
    }>();
  useEffect(() => {
    setTestFeedback(undefined);
  }, [connectionFeedback]);
  const field = (name: string, value: string) =>
    setForm((f: any) => ({ ...f, [name]: value }));
  async function save() {
    setBusy(true);
    setNotice("");
    try {
      await manageRequest(
        "/accesses" + (form.id ? "/" + form.id : ""),
        form.id ? "PATCH" : "POST",
        {
          ...form,
          secretAction:
            action === "replace"
              ? { kind: "replace", value: secret }
              : { kind: action },
        },
      );
      setForm(initial);
      setSecret("");
      setAction("keep");
      onChanged();
      setNotice("Acesso salvo. Conecte para verificar permissões.");
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function run(fn: () => Promise<any>) {
    setBusy(true);
    try {
      const result = await fn();
      setNotice(result?.message || "Operação concluída.");
      onChanged();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function testSecret(id: string) {
    setBusy(true);
    setNotice("");
    setTestFeedback({ id, kind: "pending", message: "Testando Secret…" });
    try {
      const r = await manageRequest("/accesses/" + id + "/test", "POST", {});
      setTestFeedback({
        id,
        kind: "success",
        message:
          r.message ||
          "Secret aceito. Permissões de dados serão verificadas na consulta.",
      });
      onChanged();
    } catch (e) {
      setTestFeedback({ id, kind: "error", message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-head">
        <div>
          <h2>Acessos salvos</h2>
          <p>Identidades de usuário e aplicação, protegidas neste Windows.</p>
        </div>
        <button
          onClick={() => {
            setForm(initial);
            setSecret("");
            setAction("keep");
          }}
        >
          Novo acesso
        </button>
      </div>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <div className="settings-layout">
        <form
          className="settings-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h3>{form.id ? "Editar acesso" : "Cadastrar acesso"}</h3>
          <label>
            Nome
            <input
              required
              value={form.name}
              onChange={(e) => field("name", e.target.value)}
            />
          </label>
          <label>
            Tenant ID
            <input
              required
              value={form.tenantId}
              onChange={(e) => field("tenantId", e.target.value)}
            />
          </label>
          <label>
            Application (Client) ID
            <input
              required
              value={form.clientId}
              onChange={(e) => field("clientId", e.target.value)}
            />
          </label>
          <label>
            Modo preferido
            <select
              value={form.preferredMode}
              onChange={(e) => field("preferredMode", e.target.value)}
            >
              <option value="user">Usuário — login Microsoft</option>
              <option value="application">Aplicação — Client Secret</option>
            </select>
          </label>
          <label>
            Secret Value
            <select
              aria-label="Secret Value"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="keep">
                {form.id ? "Manter segredo existente" : "Não cadastrar agora"}
              </option>
              <option value="replace">Cadastrar / substituir</option>
              <option value="remove">Remover segredo</option>
            </select>
          </label>
          {action === "replace" && (
            <label>
              Valor do Secret (não é Secret ID)
              <input
                type="password"
                autoComplete="new-password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                required
              />
            </label>
          )}
          <label>
            Expiração informada (opcional)
            <input
              type="date"
              value={form.secretExpiresAt || ""}
              onChange={(e) => field("secretExpiresAt", e.target.value)}
            />
          </label>
          <small>
            O valor nunca é devolvido pela API. Segredos são protegidos pelo
            Windows fora do OneDrive.
          </small>
          <button className="primary" disabled={busy}>
            Salvar acesso
          </button>
        </form>
        <div>
          {profiles.length === 0 && (
            <p className="notice">
              Nenhum acesso salvo. O login existente continua disponível.
            </p>
          )}
          {profiles.map((p) => (
            <article className="config-card" key={p.id}>
              <h3>{p.name}</h3>
              <p>
                {p.preferredMode === "application" ? "Aplicação" : "Usuário"} ·{" "}
                {p.secretConfigured ? "Secret configurado" : "Sem Secret"} · v
                {p.configurationVersion}
              </p>
              <small>
                Tenant: {p.tenantId}
                <br />
                Client: {p.clientId}
              </small>
              <div className="actions">
                <button disabled={busy} onClick={() => onConnect(p.id, "user")}>
                  Conectar usuário
                </button>
                <button
                  disabled={
                    busy ||
                    connectionFeedback?.kind === "pending" ||
                    !p.secretConfigured
                  }
                  onClick={() => onConnect(p.id, "application")}
                >
                  Conectar aplicação
                </button>
                <button
                  onClick={() => {
                    const { secretConfigured, ...fields } = p;
                    setForm({
                      ...fields,
                      expectedVersion: p.configurationVersion,
                      configurationVersion: undefined,
                      credentialVersion: undefined,
                    });
                    setSecret("");
                    setAction("keep");
                  }}
                >
                  Editar
                </button>
                <button
                  disabled={busy || !p.secretConfigured}
                  onClick={() => void testSecret(p.id)}
                >
                  Testar Secret
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(() => manageRequest("/accesses/" + p.id, "DELETE"))
                  }
                >
                  Excluir
                </button>
              </div>
              {testFeedback?.id === p.id && (
                <p
                  className={"access-feedback " + testFeedback.kind}
                  role={testFeedback.kind === "error" ? "alert" : "status"}
                >
                  {testFeedback.message}
                </p>
              )}
              {connectionFeedback?.id === p.id && testFeedback?.id !== p.id && (
                <p
                  className={"access-feedback " + connectionFeedback.kind}
                  role={
                    connectionFeedback.kind === "error" ? "alert" : "status"
                  }
                >
                  {connectionFeedback.message}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
