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
 * ISBN_ALREADY_EXISTS (409), RESERVATION_NOT_FOUND (404),
 * RESERVATION_CONFLICT (409), BOOK_ALREADY_RESERVED (409),
 * INTERNAL_ERROR (500).
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'USER_NOT_FOUND'
  | 'EMAIL_ALREADY_EXISTS'
  | 'BOOK_NOT_FOUND'
  | 'ISBN_ALREADY_EXISTS'
  | 'RESERVATION_NOT_FOUND'
  | 'RESERVATION_CONFLICT'
  | 'BOOK_ALREADY_RESERVED'
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

/** Thrown when a referenced reservation does not exist (404 / RN006). */
export class ReservationNotFoundError extends AppError {
  public readonly code: ErrorCode = 'RESERVATION_NOT_FOUND';
  public readonly statusCode = 404;

  constructor(message = 'Reservation not found') {
    super(message);
  }
}

/**
 * Thrown when a reservation cannot be created or released in its current
 * state, e.g. releasing an already released reservation or creating a
 * duplicate active reservation for the same user and book (409 / RN003, RN005).
 */
export class ReservationConflictError extends AppError {
  public readonly code: ErrorCode = 'RESERVATION_CONFLICT';
  public readonly statusCode = 409;

  constructor(message = 'Reservation already exists for this user and book') {
    super(message);
  }
}

/**
 * Thrown when a book already has an active reservation (409 / RN002): only one
 * active reservation per book is allowed at a time.
 */
export class BookAlreadyReservedError extends AppError {
  public readonly code: ErrorCode = 'BOOK_ALREADY_RESERVED';
  public readonly statusCode = 409;

  constructor(message = 'Book already reserved') {
    super(message);
  }
}
