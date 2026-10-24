import { InputError } from "../services/errors";

// Pure filename hygiene for deposit uploads: strips directories (traversal),
// blanks unusable names, caps length. Unit-tested in tests/unit/.
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[^\w.\-()[\] ]+/g, "_").slice(0, 180);
  if (!clean || clean === "." || clean === "..") {
    throw new InputError("Filename is not usable.");
  }
  return clean;
}
