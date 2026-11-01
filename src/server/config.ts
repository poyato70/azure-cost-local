export type Config = {
  port: number;
  tenantId: string;
  clientId: string;
  origin: string;
};
export function readConfig(): Config {
  const port = Number(process.env.PORT || 4317);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("PORT inválida");
  return {
    port,
    tenantId: process.env.AZURE_TENANT_ID || "",
    clientId: process.env.AZURE_CLIENT_ID || "",
    origin: `http://localhost:${port}`,
  };
}
