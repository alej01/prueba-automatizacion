/**
 * User domain model.
 *
 * The `User` entity is the canonical representation of a persisted user and is
 * exposed by the REST API. Authentication data (password, tokens, roles) is
 * intentionally out of scope (RN008 / ADR004): there are no auth fields here.
 *
 * Dates are stored and serialized as ISO 8601 strings. `id` is a server-side
 * generated UUID v4 (RN004); any client supplied `id` is ignored.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload accepted by `POST /api/users`.
 * Only `name` and `email` are client-controlled.
 */
export interface CreateUserRequest {
  name: string;
  email: string;
}

/**
 * Payload accepted by `PUT /api/users/:id`.
 * Partial update over `name` and/or `email`; the index signature keeps the
 * type open so that Zod can reject unknown fields explicitly (RN005).
 */
export type UpdateUserRequest = Partial<CreateUserRequest> & { [key: string]: unknown };
