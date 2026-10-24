import { describe, expect, it } from "vitest";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  InputError,
  NotFoundError,
  UnauthorizedError,
} from "@/services/errors";

describe("domain error taxonomy", () => {
  it("maps each error to its HTTP status and transport code", () => {
    expect(new UnauthorizedError()).toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
    expect(new ForbiddenError()).toMatchObject({ status: 403, code: "FORBIDDEN" });
    expect(new NotFoundError()).toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect(new ConflictError()).toMatchObject({ status: 409, code: "CONFLICT" });
    expect(new InputError()).toMatchObject({ status: 400, code: "BAD_USER_INPUT" });
  });

  it("every error is an AppError with a human-readable message", () => {
    for (const error of [
      new UnauthorizedError(),
      new ForbiddenError("custom reason"),
      new NotFoundError(),
      new ConflictError(),
      new InputError(),
    ]) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message.length).toBeGreaterThan(0);
    }
    expect(new ForbiddenError("custom reason").message).toBe("custom reason");
  });
});
