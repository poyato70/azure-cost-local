import { it, expect } from "vitest";
import { kustoRows } from "../../src/server/hubs/results.js";
it("rejects exceptions and partial status even if primary rows exist", () => {
  const Tables = [
    {
      TableName: "PrimaryResult",
      Columns: [{ ColumnName: "Value" }],
      Rows: [["1"]],
    },
  ];
  expect(() =>
    kustoRows({ Tables, Exceptions: ["partial failure"] }),
  ).toThrow();
});
