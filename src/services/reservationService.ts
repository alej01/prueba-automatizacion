/**
 * Reservation application service.
 *
 * `ReservationService` holds the pure business rules for reservations (DES007)
 * and depends only on the `ReservationRepository`, `UserRepository` and
 * `BookRepository` abstractions. It has no knowledge of HTTP, Express or
 * request/response objects, so the same logic can be reused by any delivery
 * mechanism and unit-tested with mocked repositories (ADR002).
 *
 * Business rules applied here:
 * - RN001: `userId` and `bookId` must reference an existing user and book;
 *   a missing user raises `NotFoundError` and a missing book raises
 *   `BookNotFoundError`.
 * - RN002: a book cannot have more than one active reservation; a book that is
 *   already reserved raises `BookAlreadyReservedError`.
 * - RN003: a user cannot hold two active reservations of the same book; an
 *   already active user+book pair raises `ReservationConflictError`.
 * - RN004: `id` is a server-generated UUID v4, `status` starts as `ACTIVE` and
 *   `createdAt`/`updatedAt` are set to the current ISO 8601 time.
 * - RN005: releasing changes `status` to `RELEASED` and refreshes `updatedAt`;
 *   releasing an already released reservation raises
 *   `ReservationConflictError`.
 * - RN006: operations on a missing reservation raise
 *   `ReservationNotFoundError`.
 * - RN007: listing returns every reservation, or only those of a user when a
 *   `userId` filter is provided; a missing user raises `NotFoundError`.
 *
 * Payload shape/format validation (RN009) lives in the HTTP validation
 * middleware; this service only enforces business invariants.
 */
import {
  BookAlreadyReservedError,
  BookNotFoundError,
  NotFoundError,
  ReservationConflictError,
  ReservationNotFoundError,
} from '../models/errors';
import { CreateReservationRequest, Reservation } from '../models/reservation';
import { BookRepository } from '../repositories/inMemoryBookRepository';
import { ReservationRepository } from '../repositories/inMemoryReservationRepository';
import { UserRepository } from '../repositories/inMemoryUserRepository';
import { generateId } from '../utils/idGenerator';

export class ReservationService {
  constructor(
    private readonly reservationRepository: ReservationRepository,
    private readonly userRepository: UserRepository,
    private readonly bookRepository: BookRepository,
  ) {}

  /**
   * Creates a reservation after validating its references and uniqueness rules
   * (RN001-RN004, CA001-CA004).
   */
  async create(request: CreateReservationRequest): Promise<Reservation> {
    const user = await this.userRepository.findById(request.userId);
    if (!user) {
      throw new NotFoundError();
    }

    const book = await this.bookRepository.findById(request.bookId);
    if (!book) {
      throw new BookNotFoundError();
    }

    const activeByBook = await this.reservationRepository.findActiveByBook(request.bookId);
    if (activeByBook) {
      throw new BookAlreadyReservedError();
    }

    const activeByUserAndBook = await this.reservationRepository.findActiveByUserAndBook(
      request.userId,
      request.bookId,
    );
    if (activeByUserAndBook) {
      throw new ReservationConflictError();
    }

    const now = new Date().toISOString();
    const reservation: Reservation = {
      id: generateId(),
      userId: request.userId,
      bookId: request.bookId,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    return this.reservationRepository.save(reservation);
  }

  /**
   * Returns every reservation, or only those of the given user when a
   * `userId` filter is provided (RN007, CA007).
   */
  async list(userId?: string): Promise<Reservation[]> {
    if (userId === undefined) {
      return this.reservationRepository.findAll();
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError();
    }

    return this.reservationRepository.findByUser(userId);
  }

  /** Returns a reservation by id or raises `ReservationNotFoundError` (RN006, CA007). */
  async getById(id: string): Promise<Reservation> {
    const reservation = await this.reservationRepository.findById(id);
    if (!reservation) {
      throw new ReservationNotFoundError();
    }
    return reservation;
  }

  /**
   * Releases a reservation, setting its status to `RELEASED` and refreshing
   * `updatedAt` (RN005, CA006). An already released reservation raises
   * `ReservationConflictError` and a missing one raises
   * `ReservationNotFoundError` (RN006).
   */
  async release(id: string): Promise<Reservation> {
    const reservation = await this.reservationRepository.findById(id);
    if (!reservation) {
      throw new ReservationNotFoundError();
    }

    if (reservation.status === 'RELEASED') {
      throw new ReservationConflictError();
    }

    const released: Reservation = {
      ...reservation,
      status: 'RELEASED',
      updatedAt: new Date().toISOString(),
    };

    return this.reservationRepository.save(released);
  }
}
