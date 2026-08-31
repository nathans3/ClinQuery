import { describe, expect, it } from "vitest";
import { hashFileBytes } from "@/lib/hash";

describe("hashFileBytes", () => {
  it("returns the same hash for the same bytes", () => {
    const bytes = Buffer.from("same document contents");

    expect(hashFileBytes(bytes)).toBe(hashFileBytes(bytes));
  });

  it("changes when the file contents change", () => {
    expect(hashFileBytes(Buffer.from("doc a"))).not.toBe(
      hashFileBytes(Buffer.from("doc b")),
    );
  });
});
