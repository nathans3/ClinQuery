import { describe, expect, it } from "vitest";
import { cleanMarkdown } from "@/lib/ocr/normalize";

describe("cleanMarkdown", () => {
  it("collapses image references", () => {
    expect(cleanMarkdown("See ![logo](logo.png) here")).toBe("See [image] here");
    expect(cleanMarkdown('See <img src="x.png" alt="x"> here')).toBe(
      "See [image] here",
    );
  });

  it("converts an HTML table to a pipe table", () => {
    const input = `
<table style="width:100%">
  <tr><th style="color:red">Name</th><th>Amount</th></tr>
  <tr><td>Principal</td><td>1200</td></tr>
</table>
`;
    const output = cleanMarkdown(input);

    expect(output).toContain("| Name | Amount |");
    expect(output).toContain("| --- | --- |");
    expect(output).toContain("| Principal | 1200 |");
    expect(output).not.toContain("style=");
  });

  it("collapses extra blank lines", () => {
    expect(cleanMarkdown("One\n\n\n\nTwo")).toBe("One\n\nTwo");
  });
});
