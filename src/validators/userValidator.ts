/**
 * Zod input schemas and validation middleware for user payloads (DES005).
 *
 * All request bodies are validated before reaching a controller (RN002, RN003,
 * RN005 / owasp-baseline "Input Validation"). The schemas are `strict()`, so
 * unknown fields are rejected instead of silently ignored.
 *
 * Validation failures are converted into a domain `ValidationError` carrying
 * field level `details` and forwarded with `next(error)`. The centralized
 * `errorMiddleware` is the single place that renders the uniform API error
 * contract (DES004), so this middleware never writes a response itself.
 */
import { NextFunction, Request, Response } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { ErrorDetail, ValidationError } from '../models/errors';

/** Max email length accepted by the API (RFC 5321 local+domain limit). */
const EMAIL_MAX_LENGTH = 254;

/** Max user name length. */
const NAME_MAX_LENGTH = 100;

/** Canonical email field: trimmed, format-checked and lowercased (RN001). */
const emailSchema = z
  .string()
  .trim()
  .min(1, 'email is required')
  .max(EMAIL_MAX_LENGTH, `email must be at most ${EMAIL_MAX_LENGTH} characters`)
  .email('email must be a valid email address')
  .transform((value) => value.toLowerCase());

/** Body accepted by `POST /api/users` (DES005). */
export const createUserSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'name is required')
      .max(NAME_MAX_LENGTH, `name must be at most ${NAME_MAX_LENGTH} characters`),
    email: emailSchema,
  })
  .strict();

/**
 * Body accepted by `PUT /api/users/:id` (DES005): a strict partial object that
 * must contain at least one of `name` or `email` (RN005).
 */
export const updateUserSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'name is required')
      .max(NAME_MAX_LENGTH, `name must be at most ${NAME_MAX_LENGTH} characters`)
      .optional(),
    email: emailSchema.optional(),
  })
  .strict()
  .refine((payload) => payload.name !== undefined || payload.email !== undefined, {
    message: 'at least one field (name or email) must be provided',
    path: ['body'],
  });

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
