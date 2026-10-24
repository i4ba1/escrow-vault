// Domain error taxonomy shared by services, route handlers, actions and the
// GraphQL layer. Each error carries an HTTP status and a GraphQL code so both
// transports map it without leaking internals (500s are sanitized by callers).
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Sign in required.") {
    super(message, 401, "UNAUTHENTICATED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient role for this operation.") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found.") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Operation conflicts with current state.") {
    super(message, 409, "CONFLICT");
  }
}

export class InputError extends AppError {
  constructor(message = "Invalid input.") {
    super(message, 400, "BAD_USER_INPUT");
  }
}
