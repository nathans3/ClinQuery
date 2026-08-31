import { describe, expect, it } from "vitest";
import { mapPool } from "@/lib/async-pool";

describe("mapPool", () => {
  it("runs every item without exceeding concurrency", async () => {
    const seen: number[] = [];
    let inFlight = 0;
    let maxInFlight = 0;

    await mapPool([1, 2, 3, 4], 2, async (item) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      seen.push(item);
      await Promise.resolve();
      inFlight -= 1;
    });

    expect(seen.sort()).toEqual([1, 2, 3, 4]);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });
});
