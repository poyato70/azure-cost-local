import { it, expect, vi, beforeEach } from "vitest";
const m = vi.hoisted(() => ({
  createQueryJob: vi.fn(),
  getQueryResults: vi.fn(),
  cancel: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("@google-cloud/bigquery", () => ({
  BigQuery: class {
    createQueryJob = m.createQueryJob;
  },
}));
vi.mock("../../src/server/security/endpoint-policy.js", () => ({
  fetchBound: m.fetch,
}));
import { queryCloud } from "../../src/server/multicloud/service.js";
const q = {
  provider: "gcp" as const,
  projectId: "finops-project",
  table: "finops-project.billing.export",
  from: "2026-09-01",
  toExclusive: "2026-11-01",
  confirmQueryCost: true as const,
  maximumBytesBilled: 1000000,
  location: "EU",
};
beforeEach(() => {
  vi.resetAllMocks();
  m.cancel.mockResolvedValue([]);
  m.createQueryJob.mockResolvedValue([
    { getQueryResults: m.getQueryResults, cancel: m.cancel },
  ]);
});
it("passes dates as parameters and enforces the explicit BigQuery billing cap and location", async () => {
  m.getQueryResults.mockResolvedValue([[]]);
  await queryCloud(q, new AbortController().signal);
  expect(m.createQueryJob).toHaveBeenCalledWith(
    expect.objectContaining({
      params: { from: q.from, to: q.toExclusive },
      maximumBytesBilled: "1000000",
      location: "EU",
      useLegacySql: false,
    }),
  );
});
it("cancels the remote BigQuery job and rejects late data after local abort", async () => {
  let release!: (x: any) => void, started!: () => void;
  const reached = new Promise<void>((r) => {
    started = r;
  });
  m.getQueryResults.mockImplementation(() => {
    started();
    return new Promise((r) => {
      release = r;
    });
  });
  const c = new AbortController();
  const task = queryCloud(q, c.signal);
  await reached;
  c.abort();
  release([[]]);
  await expect(task).rejects.toBeDefined();
  expect(m.cancel).toHaveBeenCalledOnce();
});
it("uses protected OpenCost token only in authorization and sanitizes reflected content", async () => {
  const secret = "synthetic-value";
  m.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        code: 200,
        data: [{ ns: { name: secret, totalCost: 2 } }],
        nested: { message: secret },
      }),
    ),
  );
  const read = vi.fn(async () => secret);
  const result = await queryCloud(
    {
      provider: "kubernetes",
      from: q.from,
      toExclusive: q.toExclusive,
      currency: "USD",
      endpoint: "http://localhost:9003/cluster-a",
      allowPrivateNetwork: true,
      secretRef: "11111111-1111-4111-8111-111111111111",
    },
    new AbortController().signal,
    read,
  );
  expect(m.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/cluster-a/allocation?"),
    expect.objectContaining({ headers: { Authorization: "Bearer " + secret } }),
    true,
  );
  expect(JSON.stringify(result)).not.toContain(secret);
});
it("does not forward raw provider errors containing credentials", async () => {
  m.createQueryJob.mockRejectedValue(new Error("Bearer synthetic-token"));
  await expect(
    queryCloud(q, new AbortController().signal),
  ).rejects.not.toHaveProperty(
    "message",
    expect.stringContaining("synthetic-token"),
  );
});
