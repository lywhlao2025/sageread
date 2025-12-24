import { describe, expect, it } from "vitest";

import type { BookConfig, BookSearchConfig, ViewSettings } from "@/types/book";
import { deserializeConfig, serializeConfig } from "../serializer";

describe("serializer utilities", () => {
  it("serializes only config differences", () => {
    const globalViewSettings = {
      zoomLevel: 1,
      lineHeight: 1.2,
    } as ViewSettings;
    const defaultSearchConfig = {
      scope: "book",
      matchCase: false,
      matchWholeWords: false,
      matchDiacritics: false,
    } as BookSearchConfig;

    const config = {
      updatedAt: 1,
      viewSettings: {
        zoomLevel: 1,
        lineHeight: 1.2,
      },
      searchConfig: {
        scope: "book",
        matchCase: true,
        matchWholeWords: false,
        matchDiacritics: false,
      },
    } as BookConfig;

    const serialized = serializeConfig(config, globalViewSettings, defaultSearchConfig);
    const parsed = JSON.parse(serialized) as BookConfig;

    expect(parsed.viewSettings).toEqual({});
    expect(parsed.searchConfig).toEqual({ matchCase: true });
  });

  it("deserializes config with defaults and updatedAt", () => {
    const globalViewSettings = {
      zoomLevel: 1,
    } as ViewSettings;
    const defaultSearchConfig = {
      scope: "book",
      matchCase: false,
      matchWholeWords: false,
      matchDiacritics: false,
    } as BookSearchConfig;

    const serialized = JSON.stringify({
      viewSettings: { zoomLevel: 2 },
      searchConfig: { matchCase: true },
    });

    const config = deserializeConfig(serialized, globalViewSettings, defaultSearchConfig);
    expect(config.viewSettings).toEqual({ zoomLevel: 2 });
    expect(config.searchConfig).toEqual({
      scope: "book",
      matchCase: true,
      matchWholeWords: false,
      matchDiacritics: false,
    });
    expect(typeof config.updatedAt).toBe("number");
  });
});
