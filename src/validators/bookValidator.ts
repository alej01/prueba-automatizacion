/**
 * Zod input schemas for book payloads (DES005 / ADR005).
 *
 * All request bodies are validated before reaching the controller (RN002,
 * RN003, RN004, RN005, RN009). Both schemas are `strict()`, so unknown fields
 * are rejected with `400 Bad Request` instead of being silently ignored.
 *
 * ISBN handling (RN004 / ADR005): the raw value is normalized (trimmed,
 * inner spaces and hyphens removed, trailing `x` upper-cased) and then checked
 * against the ISBN-10 (mod 11) or ISBN-13 (mod 10) checksum, so invented ISBNs
 * are rejected. The normalized value replaces `req.body.isbn` through
 * `validateBody`, which is the same canonical form persisted by `BookService`.
 */
import { z } from 'zod';

/** Max book title length (RN002). */
const TITLE_MAX_LENGTH = 200;

/** Max book author length (RN003). */
const AUTHOR_MAX_LENGTH = 150;

/** Earliest accepted publication year (printing press era, RN005). */
const MIN_PUBLISHED_YEAR = 1450;

/** Latest accepted publication year: current year plus one (RN005). */
const MAX_PUBLISHED_YEAR = new Date().getFullYear() + 1;

/**
 * Normalizes an ISBN to its canonical form (RN004 / ADR005): trimmed, without
 * inner spaces or hyphens and with a trailing lowercase `x` upper-cased.
 */
function normalizeIsbn(value: string): string {
  return value.trim().replace(/[\s-]/g, '').replace(/x$/, 'X');
}

/** Validates the ISBN-10 check digit (mod 11, `X` counts as 10). */
function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) {
    return false;
  }

  let sum = 0;
  for (let index = 0; index < isbn.length; index += 1) {
    const character = isbn.charAt(index);
    const digit = character === 'X' ? 10 : Number(character);
    sum += digit * (10 - index);
  }

  return sum % 11 === 0;
}

/** Validates the ISBN-13 check digit (mod 10, alternating weights 1 and 3). */
function isValidIsbn13(isbn: string): boolean {
  if (!/^\d{13}$/.test(isbn)) {
    return false;
  }

  let sum = 0;
  for (let index = 0; index < isbn.length; index += 1) {
    sum += Number(isbn.charAt(index)) * (index % 2 === 0 ? 1 : 3);
  }

  return sum % 10 === 0;
}

/** Returns true when `isbn` is a valid ISBN-10 or ISBN-13 (RN004). */
function isValidIsbn(isbn: string): boolean {
  return isValidIsbn10(isbn) || isValidIsbn13(isbn);
}

const titleSchema = z
  .string()
  .trim()
  .min(1, 'title is required')
  .max(TITLE_MAX_LENGTH, `title must be at most ${TITLE_MAX_LENGTH} characters`);

const authorSchema = z
  .string()
  .trim()
  .min(1, 'author is required')
  .max(AUTHOR_MAX_LENGTH, `author must be at most ${AUTHOR_MAX_LENGTH} characters`);

const isbnSchema = z
  .string()
  .trim()
  .transform((value) => normalizeIsbn(value))
  .refine((value) => value.length > 0, { message: 'isbn is required' })
  .refine((value) => isValidIsbn(value), {
    message: 'isbn must be a valid ISBN-10 or ISBN-13',
  });

const publishedYearSchema = z
  .number({ invalid_type_error: 'publishedYear must be a number' })
  .int('publishedYear must be an integer')
  .min(MIN_PUBLISHED_YEAR, `publishedYear must be at least ${MIN_PUBLISHED_YEAR}`)
  .max(MAX_PUBLISHED_YEAR, `publishedYear must be at most ${MAX_PUBLISHED_YEAR}`);

/** Body accepted by `POST /api/books` (DES005, RN002-RN005). */
export const createBookSchema = z
  .object({
    title: titleSchema,
    author: authorSchema,
    isbn: isbnSchema,
    publishedYear: publishedYearSchema.optional(),
  })
  .strict();

/**
 * Body accepted by `PUT /api/books/:id` (DES005, RN009): a strict partial
 * object that must contain at least one of `title`, `author`, `isbn` or
 * `publishedYear`.
 */
export const updateBookSchema = z
  .object({
    title: titleSchema.optional(),
    author: authorSchema.optional(),
    isbn: isbnSchema.optional(),
    publishedYear: publishedYearSchema.optional(),
  })
  .strict()
  .refine(
    (payload) =>
      payload.title !== undefined ||
      payload.author !== undefined ||
      payload.isbn !== undefined ||
      payload.publishedYear !== undefined,
    {
      message: 'at least one field (title, author, isbn or publishedYear) must be provided',
      path: ['body'],
    },
  );
