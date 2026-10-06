/**
 * Zod input schemas for reservation payloads and query parameters
 * (DES005 / ADR004).
 *
 * All reservation input is validated before reaching the controller (RN001,
 * RN007, RN009). Both schemas are `strict()`, so unknown fields are rejected
 * with `400 Bad Request` instead of being silently ignored.
 *
 * `userId` and `bookId` are validated as canonical UUID v4 values, because they
 * reference existing entities created by this API (RN001). The list query
 * accepts an optional `userId` UUID v4 filter (RN007).
 *
 * The shared `validateBody` middleware is reused as the single translation
 * point from `ZodError` to the domain `ValidationError` (ADR004); this module
 * does not duplicate that middleware. For the query string, `validateQuery`
 * adapts the same middleware so the parsed filter replaces `req.query` before
 * the controller runs.
 */
import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from './validateBody';

/** Canonical UUID v4 format (version nibble `4`, variant nibble `8`-`b`). */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Identifiers reference server-generated UUID v4 entities (RN001, RN009). */
const uuidV4Schema = z
  .string({ invalid_type_error: 'must be a string' })
  .regex(UUID_V4_REGEX, 'must be a valid UUID v4');

/** Body accepted by `POST /api/reservations` (DES005, RN001, RN009). */
export const createReservationSchema = z
  .object({
    userId: uuidV4Schema,
    bookId: uuidV4Schema,
  })
  .strict();

/** Query accepted by `GET /api/reservations` (DES005, RN007, RN009). */
export const reservationListQuerySchema = z
  .object({
    userId: uuidV4Schema.optional(),
  })
  .strict();

/**
 * Express middleware factory that validates `req.query` against `schema`.
 *
 * `validateBody` is typed for `req.body`, so it cannot be applied to the query
 * string directly. This adapter runs the same `validateBody` middleware over a
 * shallow copy of `req.query` and, on success, assigns the parsed filter back
 * to `req.query`; on failure the middleware already forwards the translated
 * `ValidationError` (ADR004), so the adapter simply stops the chain.
 */
export const validateQuery =
  (schema: z.ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const queryRequest = { body: { ...req.query } } as Request;

    validateBody(schema)(queryRequest, _res, (error?: unknown) => {
      if (error) {
        next(error);
        return;
      }

      req.query = queryRequest.body as Request['query'];
      next();
    });
  };
