/**
 * Centralized Express error middleware (DES004).
 *
 * This is the single place where errors are rendered to the uniform API error
 * contract (CA008):
 *
 *   { "error": { "code", "message", "details?" } }
 *
 * Domain errors (`AppError` subclasses: `ValidationError`, `NotFoundError`,
 * `ConflictError`) are mapped through their own `code`/`statusCode`.
 * Anything else is treated as an unexpected failure: it is logged with
 * structured output (without request payloads or sensitive data, RN008) and
 * answered as `INTERNAL_ERROR` (500) with no stack trace or internal detail
 * leaked to the client.
 *
 * The middleware must be registered last, after all routes and the not-found
 * handler (WP05 / DES001), because Express only dispatches to it on `next(error)`.
 */
import { NextFunction, Request, Response } from 'express';
import { AppError, ErrorDetail, ValidationError } from '../models/errors';

/** Uniform error payload returned by the API (DES004). */
interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: ErrorDetail[];
  };
}

/** Stable code used for unexpected failures. */
const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR';
const INTERNAL_ERROR_STATUS = 500;

export const errorMiddleware = (
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Delegate to the default handler if a response was already started.
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json(buildErrorBody(error));
    return;
  }

  logUnexpectedError(error);
  res.status(INTERNAL_ERROR_STATUS).json({
    error: {
      code: INTERNAL_ERROR_CODE,
      message: 'Internal server error',
    },
  });
};

/** Maps a known domain error to the uniform contract body. */
function buildErrorBody(error: AppError): ErrorBody {
  const body: ErrorBody = {
    error: {
      code: error.code,
      message: error.message,
    },
  };

  // Only validation errors expose field level details (DES004/DES005).
  if (error instanceof ValidationError && error.details.length > 0) {
    body.error.details = error.details;
  }

  return body;
}

/** Emits structured, non-sensitive information about an unexpected failure. */
function logUnexpectedError(error: unknown): void {
  const isError = error instanceof Error;
  const entry = {
    level: 'error',
    event: 'unhandled_error',
    code: INTERNAL_ERROR_CODE,
    name: isError ? error.name : 'UnknownError',
    message: isError ? error.message : 'Unknown error',
    stack: isError ? error.stack : undefined,
  };

  console.error(JSON.stringify(entry));
}
