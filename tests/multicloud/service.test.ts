import { it, expect } from "vitest";
import { cloudQuerySchema } from "../../src/shared/multicloud.js";
import {
  queryAws,
  normalizeGcp,
  normalizeOpenCost,
  consolidateCloudResults,
  gcpSql,
} from "../../src/server/multicloud/service.js";
it("rejects malformed AWS responses instead of reporting an empty cost result", async () => {
  const q: any = {
    provider: "aws",
    profile: "default",
    from: "2026-09-01",
    toExclusive: "2026-11-01",
  };
  await expect(
    queryAws(q, new AbortController().signal, async () => ({})),
  ).rejects.toThrow("Resposta AWS incompleta");
});
it("sanitizes reflected credentials and retains distinct OpenCost endpoint paths", () => {
  const token = "synthetic-sensitive-token";
  const q: any = {
    from: "2026-09-01",
    toExclusive: "2026-11-01",
    currency: "USD",
    endpoint: "https://monitor.example/cluster-a",
  };
  const r = normalizeOpenCost(
    {
      code: 200,
      data: [{ [token]: { name: `Bearer ${token}`, totalCost: 1 } }],
      nested: { access_token: token, message: token },
    },
    q,
    [token],
  );
  expect(JSON.stringify(r)).not.toContain(token);
  expect(r.scope).toBe("https://monitor.example/cluster-a");
});
it("preserves totals above twenty digits without rounding cents", () => {
  const q: any = {
    from: "2026-09-01",
    toExclusive: "2026-11-01",
    table: "finops-project.billing.export",
  };
  const r = normalizeGcp(
    [
      {
        date: q.from,
        service: "A",
        currency: "USD",
        amount: "12345678901234567890.01",
      },
      { date: q.from, service: "B", currency: "USD", amount: "0.01" },
    ],
    q,
  );
  expect(r.totals[0].amount).toBe("12345678901234567890.02");
});
it("paginates AWS and preserves exact decimal costs and units", async () => {
  let calls = 0;
  const q: any = {
    provider: "aws",
    profile: "finops",
    from: "2026-09-01",
    toExclusive: "2026-11-01",
  };
  const result = await queryAws(
    q,
    new AbortController().signal,
    async (input) => {
      expect(input.TimePeriod).toEqual({ Start: q.from, End: q.toExclusive });
      calls++;
      return {
        NextPageToken: calls === 1 ? "next" : undefined,
        ResultsByTime: [
          {
            TimePeriod: { Start: "2026-09-01" },
            Estimated: true,
            Groups: [
              {
                Keys: ["EC2"],
                Metrics: { UnblendedCost: { Amount: "0.1", Unit: "USD" } },
              },
            ],
          },
        ],
      };
    },
  );
  expect(calls).toBe(2);
  expect(result.totals).toEqual([{ currency: "USD", amount: "0.2" }]);
  expect(result.warnings.length).toBeGreaterThan(0);
});
it("rejects SQL injection, invalid days and unconfirmed billed queries", () => {
  expect(
    cloudQuerySchema.safeParse({
      provider: "gcp",
      projectId: "finops-project",
      table: "x.y`; DROP TABLE z",
      from: "2026-02-30",
      toExclusive: "2026-03-05",
    }).success,
  ).toBe(false);
  expect(() => gcpSql("bad`table")).toThrow();
  expect(gcpSql("finops-project.billing.export")).toContain("@from");
  expect(gcpSql("finops-project.billing.export")).toContain("credits");
});
it("preserves GCP net costs and keeps allocation and different bases out of consolidated billing", () => {
  const q: any = {
    from: "2026-09-01",
    toExclusive: "2026-11-01",
    table: "finops-project.billing.export",
  };
  const gcp = normalizeGcp(
    [
      {
        date: "2026-09-01",
        service: "Compute",
        currency: "BRL",
        amount: "90.5",
      },
    ],
    q,
  );
  expect(gcp.totals[0].amount).toBe("90.5");
  const k = normalizeOpenCost(
    { code: 200, data: [{ ns: { name: "ns", totalCost: 20 } }] },
    { ...q, currency: "BRL", endpoint: "http://localhost:9003" },
  );
  const groups = consolidateCloudResults([gcp, k]);
  expect(groups.find((g) => g.layer === "billing")?.amount).toBe("90.5");
  expect(groups.find((g) => g.layer === "allocation")?.amount).toBe("20");
  const other = { ...gcp, basis: "UnblendedCost" };
  expect(consolidateCloudResults([gcp, other])).toHaveLength(2);
});
it("treats OpenCost operation errors and nonfinite values as failure", () => {
  expect(() =>
    normalizeOpenCost({ code: 500, message: "nope", data: [] }, {} as any),
  ).toThrow();
  expect(() =>
    normalizeOpenCost(
      { code: 200, data: [{ ns: { totalCost: null } }] },
      {} as any,
    ),
  ).toThrow();
});
