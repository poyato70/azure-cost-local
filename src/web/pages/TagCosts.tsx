import { useMemo, useState } from "react";
import type { CostQuery } from "../../shared/contracts.js";
import { Costs } from "./Costs.js";
export function TagCosts({ query }: { query?: CostQuery }) {
  const [name, setName] = useState(""),
    [value, setValue] = useState(""),
    [active, setActive] = useState<CostQuery>();
  const effective = useMemo(
    () =>
      query && active
        ? {
            ...active,
            scope: query.scope,
            period: query.period,
            basis: query.basis,
          }
        : undefined,
    [active, query],
  );
  return (
    <>
      <h2>Custos por tag da cobrança</h2>
      <p>
        Consulta Azure Cost Management. O filtro usa tags registradas nos dados
        de cobrança; não equivale ao inventário atual. Tags de RG/subscription
        não são automaticamente herdadas. Nem todo custo possui tag ou
        ResourceId.
      </p>
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          if (query)
            setActive({
              ...query,
              groupBy: "ResourceId",
              tagFilter: { name: name.trim(), values: [value] },
            });
        }}
      >
        <label>
          Chave da tag
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Valor da tag
          <input
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <button disabled={!query}>Aplicar filtro de cobrança</button>
      </form>
      {active && (
        <Costs
          key={JSON.stringify(active)}
          query={effective}
          connected={!!query}
        />
      )}
      <p className="notice">
        Inventário atual e cruzamento entre fontes não foram executados nesta
        consulta. Resultado não deve ser interpretado como inventário de
        recursos atuais.
      </p>
    </>
  );
}
