import { describe, expect, it } from "vitest";
import { sanitizeFilename } from "@/lib/filenames";
import { InputError } from "@/services/errors";

describe("sanitizeFilename", () => {
  it("keeps ordinary names untouched", () => {
    expect(sanitizeFilename("source-2.4.1.tar.gz")).toBe("source-2.4.1.tar.gz");
    expect(sanitizeFilename("build script (final).sh")).toBe("build script (final).sh");
  });

  it("strips directory traversal", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\fakepath\\archive.zip")).toBe("archive.zip");
  });

  it("replaces unsafe characters (runs collapse) and caps length", () => {
    expect(sanitizeFilename("we*ird|na?me<>.txt")).toBe("we_ird_na_me_.txt");
    expect(sanitizeFilename(`a${"x".repeat(300)}.txt`).length).toBeLessThanOrEqual(180);
  });

  it("rejects unusable names", () => {
    for (const bad of ["", ".", "..", "/", "///"]) {
      expect(() => sanitizeFilename(bad)).toThrow(InputError);
    }
  });
});
