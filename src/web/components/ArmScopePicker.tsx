import { useEffect, useState } from "react";
import type { Subscription } from "../../shared/contracts.js";
import { api } from "../api.js";

export function ArmScopePicker({
  authenticated,
  identity,
  scope,
  onChange,
}: {
  authenticated: boolean;
  identity: string;
  scope: string;
  onChange: (value: string) => void;
}) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>();
  const [subscriptionError, setSubscriptionError] = useState("");
  const [groupResult, setGroupResult] = useState<{
    subscriptionId: string;
    groups: string[];
    error?: string;
  }>();
  const [, scopeId = "", scopeGroup = ""] =
    /^\/subscriptions\/([^/]+)(?:\/resourceGroups\/([^/]+))?$/i.exec(scope) ??
    [];
  const subscriptionId =
    subscriptions?.find(
      (item) => item.id.toLowerCase() === scopeId.toLowerCase(),
    )?.id ?? "";

  useEffect(() => {
    if (!authenticated) return;
    const controller = new AbortController();
    void api.subscriptions(controller.signal).then(
      (items) => {
        if (!controller.signal.aborted) setSubscriptions(items);
      },
      (error: Error) => {
        if (!controller.signal.aborted) setSubscriptionError(error.message);
      },
    );
    return () => controller.abort();
  }, [authenticated]);

  useEffect(() => {
    if (!subscriptionId) return;
    const controller = new AbortController();
    void api.groups(subscriptionId, controller.signal).then(
      (groups) => {
        if (!controller.signal.aborted)
          setGroupResult({ subscriptionId, groups });
      },
      (error: Error) => {
        if (!controller.signal.aborted)
          setGroupResult({ subscriptionId, groups: [], error: error.message });
      },
    );
    return () => controller.abort();
  }, [subscriptionId]);

  const currentGroups =
    groupResult?.subscriptionId === subscriptionId ? groupResult : undefined;
  const groups = currentGroups?.groups ?? [];
  const selectedGroup = groups.find(
    (name) => name.toLowerCase() === scopeGroup.toLowerCase(),
  );

  return (
    <fieldset>
      <legend>Recursos autorizados</legend>
      <p className="fine">
        {authenticated
          ? `Inventário Azure consultado com ${identity}.`
          : "Conecte um acesso Azure em Acessos para carregar o inventário."}{" "}
        O ARM MCP executa as consultas com o usuário delegado.
      </p>
      {authenticated && !subscriptions && !subscriptionError && (
        <p role="status">Carregando assinaturas…</p>
      )}
      {subscriptionError && (
        <p role="alert">Falha ao listar assinaturas. {subscriptionError}</p>
      )}
      {subscriptions?.length === 0 && (
        <p>Nenhuma assinatura visível para o acesso ativo.</p>
      )}
      <label>
        Assinatura
        <select
          value={subscriptionId}
          disabled={!subscriptions?.length}
          onChange={(event) => {
            setGroupResult(undefined);
            const id = event.target.value;
            onChange(id ? `/subscriptions/${id}` : "");
          }}
        >
          <option value="">Selecione uma assinatura</option>
          {subscriptions?.map(({ id, name }) => (
            <option key={id} value={id}>
              {name} ({id})
            </option>
          ))}
        </select>
      </label>
      {subscriptionId && (
        <label>
          Grupo de recursos (opcional)
          <select
            value={selectedGroup ?? scopeGroup}
            onChange={(event) => {
              const group = event.target.value;
              onChange(
                `/subscriptions/${subscriptionId}${group ? `/resourceGroups/${group}` : ""}`,
              );
            }}
          >
            <option value="">Assinatura inteira</option>
            {scopeGroup && !selectedGroup && (
              <option value={scopeGroup}>
                {scopeGroup} (escopo salvo ou manual)
              </option>
            )}
            {groups.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}
      {subscriptionId && !currentGroups && (
        <p role="status">Carregando grupos de recursos…</p>
      )}
      {currentGroups?.error && (
        <p role="alert">
          Falha ao listar grupos de recursos. {currentGroups.error}
        </p>
      )}
      <label>
        Escopo ARM
        <input
          required
          value={scope}
          placeholder="/subscriptions/ID/resourceGroups/NOME"
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </fieldset>
  );
}
