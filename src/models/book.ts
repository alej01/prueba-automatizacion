/**
 * Book domain model.
 *
 * The `Book` entity is the canonical representation of a persisted book and is
 * exposed by the REST API. The model is intentionally minimal (ADR006):
 * `id`, `title`, `author`, `isbn`, `publishedYear` and timestamps only.
 *
 * `id` is a server-side generated UUID v4 (RN006); any client supplied `id` is
 * ignored. `isbn` is persisted in normalized form (no spaces or hyphens and a
 * trailing lowercase `x` converted to `X`) and uniqueness is evaluated over
 * that normalized value (RN001 / RN004 / ADR005).
 *
 * `publishedYear` is stored as `null` when the client does not provide it
 * (RN005). Dates are stored and serialized as ISO 8601 strings.
 */
export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  publishedYear: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload accepted by `POST /api/books`.
 * Only the bibliographic fields are client-controlled; `id`, `publishedYear`
 * default and timestamps are set by the server.
 */
export interface CreateBookRequest {
  title: string;
  author: string;
  isbn: string;
  publishedYear?: number;
}

/**
 * Payload accepted by `PUT /api/books/:id`.
 * Partial update over `title`, `author`, `isbn` and/or `publishedYear`; the
 * index signature keeps the type open so that Zod can reject unknown fields
 * explicitly (RN002 / DES005).
 */
export type UpdateBookRequest = Partial<CreateBookRequest> & { [key: string]: unknown };
