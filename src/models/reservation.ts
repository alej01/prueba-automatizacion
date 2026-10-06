/**
 * Reservation domain model.
 *
 * The `Reservation` entity is the canonical representation of a persisted
 * reservation and is exposed by the REST API. It references an existing user
 * and an existing book by their server-side UUID v4 identifiers (RN001).
 *
 * Lifecycle (RN002 / RN005): a reservation starts as `ACTIVE` and transitions
 * to `RELEASED` when it is released; releasing does not delete the record
 * (ADR003). `id` is a server-side generated UUID v4 (RN004); any client
 * supplied `id` is ignored. Dates are stored and serialized as ISO 8601
 * strings.
 */
export type ReservationStatus = 'ACTIVE' | 'RELEASED';

export interface Reservation {
  id: string;
  userId: string;
  bookId: string;
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload accepted by `POST /api/reservations`.
 * Only `userId` and `bookId` are client-controlled; `id`, `status` and
 * timestamps are set by the server (RN004).
 */
export interface CreateReservationRequest {
  userId: string;
  bookId: string;
}
