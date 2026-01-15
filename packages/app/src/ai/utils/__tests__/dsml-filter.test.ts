import { describe, expect, it } from "vitest";
import { createDsmlFilter } from "../dsml-filter";

describe("createDsmlFilter", () => {
  it("passes through plain text", () => {
    const filter = createDsmlFilter();
    expect(filter.filter("hello")).toBe("");
    expect(filter.flush()).toBe("hello");
  });

  it("removes DSML lines and keeps surrounding text", () => {
    const filter = createDsmlFilter();
    const input = [
      "Start\n",
      "<| DSML | function_calls>\n",
      "<| DSML | invoke name=\"ragSearch\">\n",
      "Middle\n",
      "</| DSML | invoke>\n",
      "</| DSML | function_calls>\n",
      "End\n",
    ];
    const output = input.map((chunk) => filter.filter(chunk)).join("") + filter.flush();
    expect(output).toBe("Start\nEnd\n");
  });

  it("handles markers split across chunks on the same line", () => {
    const filter = createDsmlFilter();
    const output =
      filter.filter("Hello <| DS") +
      filter.filter("ML | function_calls>\n") +
      filter.filter("Secret\n") +
      filter.filter("</| DSML | function_calls>") +
      filter.flush();
    expect(output).toBe("Hello ");
  });
});
