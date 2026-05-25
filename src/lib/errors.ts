export type ErrorCode =
  | "unauthenticated"
  | "unauthorized"
  | "validation_failed"
  | "not_found"
  | "conflict"
  | "stale_data"
  | "stock_unavailable"
  | "insufficient_stock"
  | "price_changed"
  | "payment_provider_error"
  | "shipping_provider_error"
  | "rate_limited"
  | "feature_disabled"
  | "force_override_required"
  | "all_products_blocked"
  | "mfa_required"
  | "internal_error";

type AppErrorOptions = Readonly<{
  code: ErrorCode;
  message: string;
  cause?: unknown;
  statusCode?: number;
}>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode?: number;
  readonly isOperational = true;

  constructor({ code, message, cause, statusCode }: AppErrorOptions) {
    super(message, { cause });
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class ValidationError extends AppError {
  constructor(options: Partial<AppErrorOptions> & Pick<AppErrorOptions, "message">) {
    super({
      code: options.code ?? "validation_failed",
      message: options.message,
      cause: options.cause,
      statusCode: options.statusCode ?? 400,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(options: Partial<AppErrorOptions> & Pick<AppErrorOptions, "message">) {
    super({
      code: options.code ?? "not_found",
      message: options.message,
      cause: options.cause,
      statusCode: options.statusCode ?? 404,
    });
  }
}

export class AuthorizationError extends AppError {
  constructor(options: Partial<AppErrorOptions> & Pick<AppErrorOptions, "message">) {
    super({
      code: options.code ?? "unauthorized",
      message: options.message,
      cause: options.cause,
      statusCode: options.statusCode ?? 403,
    });
  }
}

export class PaymentError extends AppError {
  constructor(options: Partial<AppErrorOptions> & Pick<AppErrorOptions, "message">) {
    super({
      code: options.code ?? "payment_provider_error",
      message: options.message,
      cause: options.cause,
      statusCode: options.statusCode,
    });
  }
}

export class IntegrationError extends AppError {
  constructor(options: Partial<AppErrorOptions> & Pick<AppErrorOptions, "message">) {
    super({
      code: options.code ?? "shipping_provider_error",
      message: options.message,
      cause: options.cause,
      statusCode: options.statusCode,
    });
  }
}

export class NotImplementedError extends AppError {
  constructor(message: string) {
    super({
      code: "internal_error",
      message,
      statusCode: 501,
    });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
