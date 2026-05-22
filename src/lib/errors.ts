type AppErrorOptions = Readonly<{
  code: string;
  message: string;
  cause?: unknown;
  statusCode?: number;
}>;

export class AppError extends Error {
  readonly code: string;
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
      code: options.code ?? "validation_error",
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
      code: options.code ?? "authorization_error",
      message: options.message,
      cause: options.cause,
      statusCode: options.statusCode ?? 403,
    });
  }
}

export class PaymentError extends AppError {
  constructor(options: Partial<AppErrorOptions> & Pick<AppErrorOptions, "message">) {
    super({
      code: options.code ?? "payment_error",
      message: options.message,
      cause: options.cause,
      statusCode: options.statusCode,
    });
  }
}

export class IntegrationError extends AppError {
  constructor(options: Partial<AppErrorOptions> & Pick<AppErrorOptions, "message">) {
    super({
      code: options.code ?? "integration_error",
      message: options.message,
      cause: options.cause,
      statusCode: options.statusCode,
    });
  }
}

export class NotImplementedError extends AppError {
  constructor(message: string) {
    super({
      code: "not_implemented",
      message,
      statusCode: 501,
    });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
