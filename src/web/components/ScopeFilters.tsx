import { useEffect, useState } from "react";
import type {
  Subscription,
  DateRange,
  CostQuery,
} from "../../shared/contracts.js";
export function ScopeFilters({
  subscriptions,
  subscription,
  setSubscription,
  groups,
  group,
  setGroup,
  period,
  setPeriod,
  basis,
  setBasis,
  disabled,
}: {
  subscriptions: Subscription[];
  subscription: string;
  setSubscription: (s: string) => void;
  groups: string[];
  group: string;
  setGroup: (s: string) => void;
  period: DateRange;
  setPeriod: (p: DateRange) => void;
  basis: CostQuery["basis"];
  setBasis: (b: CostQuery["basis"]) => void;
  disabled: boolean;
}) {
  const [search, setSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  useEffect(() => setGroupSearch(""), [subscription]);
  const groupNeedle = groupSearch.replace(/\*/g, "").trim().toLocaleLowerCase();
  const shownGroups = groups.filter(
    (g) =>
      g === group ||
      !groupNeedle ||
      g.toLocaleLowerCase().includes(groupNeedle),
  );
  const needle = search.replace(/\*/g, "").trim().toLocaleLowerCase();
  const shown = subscriptions.filter(
    (s) =>
      s.id === subscription ||
      !needle ||
      s.name.toLocaleLowerCase().includes(needle) ||
      s.id.toLowerCase().includes(needle),
  );
  return (
    <section className="filters" aria-label="Filtros de consulta">
      <label>
        Buscar subscription
        <input
          aria-label="Buscar subscription"
          type="search"
          placeholder="Nome ou ID, ex.: *genuv*"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const first = needle
              ? shown.find((s) => s.id !== subscription) || shown[0]
              : undefined;
            if (first) setSubscription(first.id);
          }}
        />
        <small>
          {shown.length} de {subscriptions.length} subscriptions. Enter
          seleciona o primeiro resultado.
        </small>
      </label>
      <label>
        Subscription
        <select
          disabled={disabled}
          aria-label="Subscription"
          value={subscription}
          onChange={(e) => setSubscription(e.target.value)}
        >
          <option value="">Selecione</option>
          {shown.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Buscar resource group
        <input
          aria-label="Buscar resource group"
          type="search"
          disabled={disabled || !subscription}
          placeholder="Nome ou trecho do RG"
          value={groupSearch}
          onChange={(e) => setGroupSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const first = groupNeedle
              ? shownGroups.find((g) => g !== group) || shownGroups[0]
              : undefined;
            if (first) setGroup(first);
          }}
        />
        <small>
          {shownGroups.length} de {groups.length} grupos. Enter seleciona o
          primeiro resultado.
        </small>
      </label>
      <label>
        Resource group
        <select
          disabled={disabled || !subscription}
          aria-label="Resource group"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
        >
          <option value="">Todos da subscription</option>
          {shownGroups.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </label>
      <label>
        De
        <input
          aria-label="Data inicial"
          type="date"
          value={period.from}
          onChange={(e) => setPeriod({ ...period, from: e.target.value })}
        />
      </label>
      <label>
        Até (exclusivo)
        <input
          aria-label="Data final exclusiva"
          type="date"
          value={period.toExclusive}
          onChange={(e) =>
            setPeriod({ ...period, toExclusive: e.target.value })
          }
        />
      </label>
      <label>
        Base de custo
        <select
          value={basis}
          onChange={(e) => setBasis(e.target.value as CostQuery["basis"])}
        >
          <option value="ActualCost">Real</option>
          <option value="AmortizedCost">Amortizado</option>
        </select>
      </label>
    </section>
  );
}
