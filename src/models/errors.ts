/**
 * Domain error types.
 *
 * Every error carries a stable, machine-readable `code` and an HTTP
 * `statusCode`. The centralized error middleware maps these classes to the
 * uniform API error contract (DES004):
 *
 * { error: { code, message, details? } }
 *
 * Codes: VALIDATION_ERROR (400), USER_NOT_FOUND (404),
 * EMAIL_ALREADY_EXISTS (409), BOOK_NOT_FOUND (404),
 * ISBN_ALREADY_EXISTS (409), INTERNAL_ERROR (500).
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'USER_NOT_FOUND'
  | 'EMAIL_ALREADY_EXISTS'
  | 'BOOK_NOT_FOUND'
  | 'ISBN_ALREADY_EXISTS'
  | 'INTERNAL_ERROR';

/** Field level detail attached to a validation error. */
export interface ErrorDetail {
  field: string;
  message: string;
}

/** Base class for all expected (mapped) application errors. */
export abstract class AppError extends Error {
  public abstract readonly code: ErrorCode;
  public abstract readonly statusCode: number;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when the request payload does not satisfy the input schema (400). */
export class ValidationError extends AppError {
  public readonly code: ErrorCode = 'VALIDATION_ERROR';
  public readonly statusCode = 400;
  public readonly details: ErrorDetail[];

  constructor(message = 'Invalid request payload', details: ErrorDetail[] = []) {
    super(message);
    this.details = details;
  }
}

/** Thrown when a referenced user does not exist (404). */
export class NotFoundError extends AppError {
  public readonly code: ErrorCode = 'USER_NOT_FOUND';
  public readonly statusCode = 404;

  constructor(message = 'User not found') {
    super(message);
  }
}

/** Thrown when an email is already registered by another user (409). */
export class ConflictError extends AppError {
  public readonly code: ErrorCode = 'EMAIL_ALREADY_EXISTS';
  public readonly statusCode = 409;

  constructor(message = 'Email already exists') {
    super(message);
  }
}

/** Thrown when a referenced book does not exist (404). */
export class BookNotFoundError extends AppError {
  public readonly code: ErrorCode = 'BOOK_NOT_FOUND';
  public readonly statusCode = 404;

  constructor(message = 'Book not found') {
    super(message);
  }
}

/** Thrown when an ISBN is already registered by another book (409). */
export class IsbnConflictError extends AppError {
  public readonly code: ErrorCode = 'ISBN_ALREADY_EXISTS';
  public readonly statusCode = 409;

  constructor(message = 'ISBN already exists') {
    super(message);
  }
}
