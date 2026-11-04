import { useState } from "react";
export function schemaDefaults(schema: any): any {
  if (schema?.default !== undefined) return schema.default;
  if (schema?.type === "object" || schema?.properties) {
    const values: Record<string, unknown> = {};
    for (const [k, s] of Object.entries(schema.properties || {}) as [
      string,
      any,
    ][]) {
      if (s.default !== undefined) values[k] = s.default;
      else if (
        (schema.required || []).includes(k) &&
        (s.type === "object" || s.properties)
      )
        values[k] = schemaDefaults(s) || {};
    }
    return values;
  }
  return undefined;
}
export function resolveSchema(raw: any, root: any) {
  if (raw?.$ref?.startsWith("#/"))
    return (
      raw.$ref
        .slice(2)
        .split("/")
        .reduce(
          (v: any, k: string) => v?.[k.replace(/~1/g, "/").replace(/~0/g, "~")],
          root,
        ) || raw
    );
  const options = raw?.anyOf || raw?.oneOf;
  return options ? options.find((s: any) => s.type !== "null") || raw : raw;
}
export function SchemaInputs({
  schema,
  value,
  onChange,
  root = schema,
  path = "",
  depth = 0,
}: {
  schema: any;
  value: any;
  onChange: (v: any) => void;
  root?: any;
  path?: string;
  depth?: number;
}) {
  const s = resolveSchema(schema, root);
  if (depth > 6) return <p>Schema profundo: use o JSON avançado.</p>;
  return (
    <>
      {Object.entries(s.properties || {}).map(([key, raw]: any) => {
        const field = resolveSchema(raw, root),
          name = path ? path + "." + key : key,
          required = (s.required || []).includes(key),
          val = value?.[key];
        const set = (v: any) => {
          const next = { ...value };
          if (v === undefined) delete next[key];
          else
            Object.defineProperty(next, key, {
              value: v,
              enumerable: true,
              writable: true,
              configurable: true,
            });
          onChange(next);
        };
        if (field.type === "object" || field.properties)
          return (
            <fieldset key={key}>
              <legend>
                {name}
                {required ? " *" : ""}
              </legend>
              <small>{field.description}</small>
              <SchemaInputs
                schema={field}
                root={root}
                value={val || {}}
                onChange={set}
                path={name}
                depth={depth + 1}
              />
            </fieldset>
          );
        return (
          <label key={key}>
            {field.title || name}
            {required ? " *" : ""}
            {Array.isArray(field.enum) ? (
              <select
                aria-label={name}
                required={required}
                value={val === undefined ? "" : String(val)}
                onChange={(e) =>
                  set(
                    e.target.value === ""
                      ? undefined
                      : field.enum.find(
                          (v: any) => String(v) === e.target.value,
                        ),
                  )
                }
              >
                <option value="">Selecione</option>
                {field.enum.map((v: any) => (
                  <option key={String(v)} value={String(v)}>
                    {String(v)}
                  </option>
                ))}
              </select>
            ) : field.type === "boolean" ? (
              <select
                aria-label={name}
                value={val === undefined ? "" : String(val)}
                required={required}
                onChange={(e) =>
                  set(
                    e.target.value === ""
                      ? undefined
                      : e.target.value === "true",
                  )
                }
              >
                <option value="">Não informar</option>
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </select>
            ) : field.type === "array" ? (
              <JsonField
                name={name}
                value={val}
                required={required}
                onChange={set}
              />
            ) : (
              <input
                aria-label={name}
                required={required}
                type={
                  ["number", "integer"].includes(field.type) ? "number" : "text"
                }
                step={field.type === "integer" ? 1 : "any"}
                min={field.minimum}
                max={field.maximum}
                value={val ?? ""}
                onChange={(e) =>
                  set(
                    e.target.value === ""
                      ? undefined
                      : ["number", "integer"].includes(field.type)
                        ? Number(e.target.value)
                        : e.target.value,
                  )
                }
              />
            )}
            <small>
              {field.description ||
                "Parâmetro definido pelo schema desta tool."}
            </small>
          </label>
        );
      })}
    </>
  );
}
function JsonField({ name, value, required, onChange }: any) {
  const [text, setText] = useState(JSON.stringify(value ?? []));
  return (
    <textarea
      aria-label={name}
      required={required}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        try {
          onChange(JSON.parse(e.target.value));
          e.target.setCustomValidity("");
        } catch {
          e.target.setCustomValidity("Informe JSON válido para este campo.");
        }
      }}
    />
  );
}
