/**
 * Zod input schemas for user payloads (DES005).
 *
 * All request bodies are validated before reaching a controller (RN002, RN003,
 * RN005 / owasp-baseline "Input Validation"). The schemas are `strict()`, so
 * unknown fields are rejected instead of silently ignored.
 *
 * The `validateBody` middleware lives in the shared `validateBody` module
 * (ADR003) and is re-exported here to keep `userRoutes.ts` imports stable.
 */
import { z } from 'zod';

export { validateBody } from './validateBody';

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
