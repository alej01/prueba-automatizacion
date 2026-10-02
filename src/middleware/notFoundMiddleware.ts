/**
 * Not-found middleware (DES004).
 *
 * Placed after every route and before `errorMiddleware`, it turns any request
 * that matched no route into a domain `NotFoundError` and forwards it with
 * `next(error)`. Keeping the translation here preserves a single rendering
 * point for the uniform API error contract and avoids duplicating it in the
 * error middleware.
 *
 * The message is intentionally generic: it does not echo the requested method
 * or path, so untrusted input is never reflected back to the client.
 */
import { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '../models/errors';

export const notFoundMiddleware = (_req: Request, _res: Response, next: NextFunction): void => {
  next(new NotFoundError('Route not found'));
};
