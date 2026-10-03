/**
 * Shared Zod request-body validation middleware (DES005 / ADR003).
 *
 * Extracted from `userValidator` so that every resource can reuse the same
 * validation contract without cross-feature imports. Validation failures are
 * converted into a domain `ValidationError` carrying field level `details` and
 * forwarded with `next(error)`; the centralized `errorMiddleware` is the only
 * place that renders the uniform API error contract (DES004), so this
 * middleware never writes a response itself.
 */
import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { ErrorDetail, ValidationError } from '../models/errors';

/**
 * Express middleware factory that validates `req.body` against `schema`.
 *
 * On success the parsed (and normalized) payload replaces `req.body` so that
 * controllers consume trusted data. On failure a `ValidationError` with the
 * Zod issues translated to `details` is forwarded to `next`.
 */
export const validateBody =
  (schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      next(error instanceof ZodError ? toValidationError(error) : error);
    }
  };

/** Maps a Zod parse failure to the domain validation error (DES004). */
function toValidationError(error: ZodError): ValidationError {
  return new ValidationError('Invalid request payload', toErrorDetails(error));
}

/** Converts Zod issues into stable `{ field, message }` details. */
function toErrorDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : 'body',
    message: issue.message,
  }));
}
