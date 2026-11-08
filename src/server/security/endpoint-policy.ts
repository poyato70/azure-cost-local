import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { Agent, fetch as fetchHttp } from "undici";
import { AppError } from "../errors.js";
const privateIPs = new BlockList();
for (const [a, n] of [
  ["10.0.0.0", 8],
  ["127.0.0.0", 8],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["169.254.0.0", 16],
  ["0.0.0.0", 8],
  ["100.64.0.0", 10],
  ["224.0.0.0", 4],
] as const)
  privateIPs.addSubnet(a, n, "ipv4");
for (const [a, n] of [
  ["::1", 128],
  ["::", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const)
  privateIPs.addSubnet(a, n, "ipv6");
const mappedIPs = new BlockList();
mappedIPs.addSubnet("::ffff:0:0", 96, "ipv6");
export function isPrivateAddress(ip: string) {
  if (!isIP(ip)) return true;
  if (isIP(ip) === 6 && mappedIPs.check(ip, "ipv6")) return true;
  return isIP(ip) === 4
    ? privateIPs.check(ip, "ipv4")
    : privateIPs.check(ip, "ipv6");
}
export async function validateEndpoint(
  value: string,
  allowPrivate = false,
  resolver: (
    host: string,
    options: { all: true; verbatim: true },
  ) => Promise<{ address: string; family: number }[]> = lookup,
  allowHttp = false,
) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError("invalid_endpoint", "Endereço inválido.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (
    url.username ||
    url.password ||
    url.hash ||
    /github\.com$/i.test(host) ||
    !["https:", "http:"].includes(url.protocol)
  )
    throw new AppError(
      "invalid_endpoint",
      "Use um endpoint MCP/modelo, sem credenciais embutidas.",
    );
  if (
    url.protocol === "http:" &&
    !allowHttp &&
    !(allowPrivate && ["localhost", "127.0.0.1", "::1"].includes(host))
  )
    throw new AppError(
      "invalid_endpoint",
      "HTTP somente é permitido em loopback explicitamente autorizado.",
    );
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await resolver(host, { all: true, verbatim: true });
  if (
    !addresses.length ||
    addresses.some(
      (a) =>
        a.address.startsWith("169.254.") ||
        a.address.toLowerCase().startsWith("::ffff:") ||
        (!allowPrivate && isPrivateAddress(a.address)),
    )
  )
    throw new AppError(
      "invalid_endpoint",
      "O destino resolve para uma rede não autorizada.",
    );
  return { url, addresses };
}
export async function fetchBound(
  endpoint: string,
  init: RequestInit = {},
  allowPrivate = false,
  allowHttp = false,
) {
  const { url, addresses } = await validateEndpoint(
    endpoint,
    allowPrivate,
    undefined,
    allowHttp,
  );
  const agent = new Agent({
    connect: {
      lookup: ((_host: any, options: any, callback: any) =>
        options.all
          ? callback(null, addresses)
          : callback(null, addresses[0].address, addresses[0].family)) as any,
    },
  });
  try {
    const response = await fetchHttp(url, {
      ...init,
      redirect: "manual",
      dispatcher: agent,
      signal: AbortSignal.any([
        init.signal || new AbortController().signal,
        AbortSignal.timeout(120000),
      ]),
    } as any);
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw new AppError(
        "invalid_endpoint",
        "Redirecionamento de endpoint recusado para proteger a credencial.",
      );
    }
    if (!response.body) {
      void agent.close();
      return new Response(null, {
        status: response.status,
        headers: response.headers as any,
      });
    }
    const reader = response.body.getReader();
    let size = 0;
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const r = await reader.read();
          if (r.done) {
            controller.close();
            void agent.close();
            return;
          }
          size += r.value.length;
          if (size > 2097152) {
            await reader.cancel();
            controller.error(
              new AppError(
                "upstream",
                "Resposta excedeu o limite de 2 MB.",
                502,
              ),
            );
            void agent.close();
            return;
          }
          controller.enqueue(r.value);
        } catch (e) {
          controller.error(e);
          void agent.close();
        }
      },
      async cancel() {
        await reader.cancel();
        void agent.close();
      },
    });
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as any,
    });
  } catch (e) {
    void agent.close();
    throw e;
  }
}
