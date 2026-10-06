/**
 * In-memory reservation persistence.
 *
 * `ReservationRepository` is the storage abstraction consumed by the
 * application service, so business logic never depends on how reservations are
 * stored (ADR002). `InMemoryReservationRepository` is the volatile
 * `Map<string, Reservation>` implementation required by the current scope
 * (RN008): data does not survive a process restart.
 *
 * Every method returns a `Promise` so a future persistent implementation can be
 * swapped in without changing the service contract (ADR002).
 *
 * "Active" lookups (`findActiveByBook`, `findActiveByUserAndBook`) ignore
 * `RELEASED` reservations: releasing a reservation frees the book and allows the
 * same user+book pair to be reserved again (RN002, RN003, RN005).
 */
import { Reservation } from '../models/reservation';

/** Storage-agnostic contract for reservation persistence. */
export interface ReservationRepository {
  /** Persists a reservation, creating it or replacing the existing record by `id`. */
  save(reservation: Reservation): Promise<Reservation>;
  /** Returns the reservation with the given identifier, or `undefined`. */
  findById(id: string): Promise<Reservation | undefined>;
  /** Returns every persisted reservation, regardless of status. */
  findAll(): Promise<Reservation[]>;
  /** Returns the `ACTIVE` reservation for the book, or `undefined` (RN002). */
  findActiveByBook(bookId: string): Promise<Reservation | undefined>;
  /** Returns the `ACTIVE` reservation for the user+book pair, or `undefined` (RN003). */
  findActiveByUserAndBook(
    userId: string,
    bookId: string,
  ): Promise<Reservation | undefined>;
  /** Returns every reservation of the user, regardless of status (RN007). */
  findByUser(userId: string): Promise<Reservation[]>;
}

/**
 * Volatile, `Map`-backed implementation of {@link ReservationRepository}.
 *
 * Each instance starts empty, which makes state lifetime explicit and keeps
 * tests isolated (RN008).
 */
export class InMemoryReservationRepository implements ReservationRepository {
  private readonly reservations = new Map<string, Reservation>();

  async save(reservation: Reservation): Promise<Reservation> {
    this.reservations.set(reservation.id, reservation);
    return reservation;
  }

  async findById(id: string): Promise<Reservation | undefined> {
    return this.reservations.get(id);
  }

  async findAll(): Promise<Reservation[]> {
    return Array.from(this.reservations.values());
  }

  async findActiveByBook(bookId: string): Promise<Reservation | undefined> {
    for (const reservation of this.reservations.values()) {
      if (reservation.bookId === bookId && reservation.status === 'ACTIVE') {
        return reservation;
      }
    }
    return undefined;
  }

  async findActiveByUserAndBook(
    userId: string,
    bookId: string,
  ): Promise<Reservation | undefined> {
    for (const reservation of this.reservations.values()) {
      if (
        reservation.userId === userId &&
        reservation.bookId === bookId &&
        reservation.status === 'ACTIVE'
      ) {
        return reservation;
      }
    }
    return undefined;
  }

  async findByUser(userId: string): Promise<Reservation[]> {
    return Array.from(this.reservations.values()).filter(
      (reservation) => reservation.userId === userId,
    );
  }
}
