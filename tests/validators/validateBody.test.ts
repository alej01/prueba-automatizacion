/**
 * Unit tests for the shared `validateBody` middleware (T007, DES005, DES008).
 *
 * They verify the middleware contract in isolation (ESC-V01..ESC-V03): the
 * parsed payload replaces `req.body`, a `ZodError` is translated into a
 * `ValidationError` carrying field level `details`, and non-Zod errors are
 * forwarded untouched. The book schemas are used as the real schemas under
 * test, so the ISBN normalization and the `strict`/partial rules are exercised
 * through the same path the HTTP layer uses.
 */
import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { ValidationError } from '../../src/models/errors';
import { createBookSchema, updateBookSchema } from '../../src/validators/bookValidator';
import { validateBody } from '../../src/validators/validateBody';

/** Runs the middleware against a plain request body and returns the spies. */
const runValidateBody = (
  schema: ZodSchema,
  body: unknown,
): { req: Request; next: jest.MockedFunction<NextFunction> } => {
  const req = { body } as Request;
  const next = jest.fn() as jest.MockedFunction<NextFunction>;

  validateBody(schema)(req, {} as Response, next);

  return { req, next };
};

/** Reads the `ValidationError` forwarded to `next`, if any. */
const getForwardedError = (next: jest.MockedFunction<NextFunction>): unknown =>
  next.mock.calls[0][0];

describe('validateBody', () => {
  describe('successful validation (ESC-V01)', () => {
    it('replaces req.body with the parsed and normalized payload', () => {
      const { req, next } = runValidateBody(createBookSchema, {
        title: '  Refactoring  ',
        author: '  Martin Fowler  ',
        isbn: '978-0-13-235088-4',
      });

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({
        title: 'Refactoring',
        author: 'Martin Fowler',
        isbn: '9780132350884',
      });
    });

    it('normalizes a trailing lowercase x in an ISBN-10 (RN004)', () => {
      const { req } = runValidateBody(createBookSchema, {
        title: 'Refactoring',
        author: 'Martin Fowler',
        isbn: '0-8044-2957-x',
      });

      expect(req.body.isbn).toBe('080442957X');
    });

    it('accepts the optional publishedYear and keeps it in the payload', () => {
      const { req, next } = runValidateBody(createBookSchema, {
        title: 'Refactoring',
        author: 'Martin Fowler',
        isbn: '9780132350884',
        publishedYear: 1999,
      });

      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({
        title: 'Refactoring',
        author: 'Martin Fowler',
        isbn: '9780132350884',
        publishedYear: 1999,
      });
    });

    it('accepts a partial update with a single field (RN009)', () => {
      const { req, next } = runValidateBody(updateBookSchema, { title: 'Clean Code' });

      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({ title: 'Clean Code' });
    });
  });

  describe('validation failures (ESC-V02)', () => {
    it('translates a ZodError into a ValidationError with field details', () => {
      const { next } = runValidateBody(createBookSchema, {
        title: '   ',
        author: 'Martin Fowler',
        isbn: '9780132350884',
      });

      const error = getForwardedError(next);

      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).code).toBe('VALIDATION_ERROR');
      expect((error as ValidationError).statusCode).toBe(400);
      expect((error as ValidationError).details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'title' })]),
      );
    });

    it('reports every invalid field, including the ISBN checksum (RN004)', () => {
      const { next } = runValidateBody(createBookSchema, {
        title: 'Refactoring',
        author: 'Martin Fowler',
        isbn: '9780132350885',
      });

      const details = (getForwardedError(next) as ValidationError).details;

      expect(details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'isbn', message: expect.any(String) }),
        ]),
      );
    });

    it('reports the missing fields for an empty create payload', () => {
      const { next } = runValidateBody(createBookSchema, {});

      const details = (getForwardedError(next) as ValidationError).details;

      expect(details.map((detail) => detail.field)).toEqual(
        expect.arrayContaining(['title', 'author', 'isbn']),
      );
    });

    it('rejects unknown fields and maps them to the body (RN005/DES005)', () => {
      const { next } = runValidateBody(createBookSchema, {
        title: 'Refactoring',
        author: 'Martin Fowler',
        isbn: '9780132350884',
        role: 'admin',
      });

      const details = (getForwardedError(next) as ValidationError).details;

      expect(details).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'body' })]));
    });

    it('rejects an update payload without any field (RN009)', () => {
      const { next } = runValidateBody(updateBookSchema, {});

      const details = (getForwardedError(next) as ValidationError).details;

      expect(details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'body', message: expect.any(String) }),
        ]),
      );
    });

    it('rejects an out-of-range publishedYear (RN005)', () => {
      const { next } = runValidateBody(createBookSchema, {
        title: 'Refactoring',
        author: 'Martin Fowler',
        isbn: '9780132350884',
        publishedYear: 1200,
      });

      const details = (getForwardedError(next) as ValidationError).details;

      expect(details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'publishedYear' })]),
      );
    });
  });

  describe('unexpected errors (ESC-V03)', () => {
    it('forwards a non-Zod error without transforming it', () => {
      const boom = new Error('boom');
      const faultySchema = {
        parse: () => {
          throw boom;
        },
      } as unknown as ZodSchema;

      const { next } = runValidateBody(faultySchema, { any: 'value' });

      expect(next).toHaveBeenCalledWith(boom);
    });
  });
});
