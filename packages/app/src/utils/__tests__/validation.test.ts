import { describe, expect, it } from "vitest";

import {
  validateAndNormalizeDate,
  validateAndNormalizeLanguage,
  validateAndNormalizeSubjects,
  validateISBN,
} from "../validation";

describe("validation utilities", () => {
  it("validates and normalizes dates", () => {
    const yearOnly = validateAndNormalizeDate("2020");
    expect(yearOnly.isValid).toBe(true);
    expect(yearOnly.value).toMatch(/^2020-01-01T/);

    const yearMonth = validateAndNormalizeDate("2020-12");
    expect(yearMonth.isValid).toBe(true);
    expect(yearMonth.value).toMatch(/^2020-12-01T/);

    const full = validateAndNormalizeDate("2020-12-31");
    expect(full.isValid).toBe(true);
    expect(full.value).toMatch(/^2020-12-31T/);
  });

  it("rejects invalid dates", () => {
    expect(validateAndNormalizeDate("20-12-31").isValid).toBe(false);
    expect(validateAndNormalizeDate("2020-13").isValid).toBe(false);
    expect(validateAndNormalizeDate("2020-12-32").isValid).toBe(false);

    const futureYear = new Date().getFullYear() + 11;
    expect(validateAndNormalizeDate(String(futureYear)).isValid).toBe(false);
  });

  it("validates and normalizes language codes", () => {
    expect(validateAndNormalizeLanguage("")).toEqual({ isValid: true, value: "unknown" });

    const normalized = validateAndNormalizeLanguage("EN-us");
    expect(normalized.isValid).toBe(true);
    expect(normalized.value).toBe("en-us");

    expect(validateAndNormalizeLanguage("english").isValid).toBe(false);
    expect(validateAndNormalizeLanguage("zz").isValid).toBe(false);
  });

  it("validates ISBN-10 and ISBN-13", () => {
    const isbn10 = validateISBN("0-306-40615-2");
    expect(isbn10.isValid).toBe(true);
    expect(isbn10.value).toBe("0306406152");

    const isbn13 = validateISBN("978-0-306-40615-7");
    expect(isbn13.isValid).toBe(true);
    expect(isbn13.value).toBe("9780306406157");

    const invalid = validateISBN("1234567890");
    expect(invalid.isValid).toBe(false);
  });

  it("validates subject lists", () => {
    expect(validateAndNormalizeSubjects("")).toEqual({ isValid: true, value: [] });

    const ok = validateAndNormalizeSubjects("fiction, sci-fi");
    expect(ok.isValid).toBe(true);
    expect(ok.value).toEqual(["fiction", "sci-fi"]);

    const tooMany = Array.from({ length: 21 }, (_, i) => `s${i}`).join(",");
    expect(validateAndNormalizeSubjects(tooMany).isValid).toBe(false);

    const tooLong = validateAndNormalizeSubjects("a".repeat(101));
    expect(tooLong.isValid).toBe(false);
  });
});
