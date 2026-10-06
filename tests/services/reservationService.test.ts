/**
 * Unit tests for `ReservationService` (T006, DES008).
 *
 * The three repositories are mocked on purpose: these tests verify the
 * reservation business rules in isolation (RN001-RN008) without depending on
 * `Map` semantics, mirroring `tests/services/bookService.test.ts`. They map to
 * the Application scenarios ESC-S01..ESC-S10 and the acceptance criteria
 * CA001-CA007.
 */
import {
  BookAlreadyReservedError,
  BookNotFoundError,
  NotFoundError,
  ReservationConflictError,
  ReservationNotFoundError,
} from '../../src/models/errors';
import { Reservation } from '../../src/models/reservation';
import { BookRepository } from '../../src/repositories/inMemoryBookRepository';
import { ReservationRepository } from '../../src/repositories/inMemoryReservationRepository';
import { UserRepository } from '../../src/repositories/inMemoryUserRepository';
import { ReservationService } from '../../src/services/reservationService';

/** Matches a canonical UUID v4 (RN004). */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
const BOOK_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_BOOK_ID = '44444444-4444-4444-8444-444444444444';

const buildReservation = (overrides: Partial<Reservation> = {}): Reservation => ({
  id: '55555555-5555-4555-8555-555555555555',
  userId: USER_ID,
  bookId: BOOK_ID,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const createReservationRepositoryMock = (): jest.Mocked<ReservationRepository> => ({
  save: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  findActiveByBook: jest.fn(),
  findActiveByUserAndBook: jest.fn(),
  findByUser: jest.fn(),
});

const createUserRepositoryMock = (): jest.Mocked<UserRepository> => ({
  save: jest.fn(),
  findById: jest.fn(),
  findByEmail: jest.fn(),
  findAll: jest.fn(),
  delete: jest.fn(),
});

const createBookRepositoryMock = (): jest.Mocked<BookRepository> => ({
  save: jest.fn(),
  findById: jest.fn(),
  findByIsbn: jest.fn(),
  findAll: jest.fn(),
  delete: jest.fn(),
});

describe('ReservationService', () => {
  let reservationRepository: jest.Mocked<ReservationRepository>;
  let userRepository: jest.Mocked<UserRepository>;
  let bookRepository: jest.Mocked<BookRepository>;
  let service: ReservationService;

  beforeEach(() => {
    reservationRepository = createReservationRepositoryMock();
    userRepository = createUserRepositoryMock();
    bookRepository = createBookRepositoryMock();

    reservationRepository.save.mockImplementation(async (reservation: Reservation) => reservation);
    reservationRepository.findActiveByBook.mockResolvedValue(undefined);
    reservationRepository.findActiveByUserAndBook.mockResolvedValue(undefined);
    userRepository.findById.mockResolvedValue({
      id: USER_ID,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    bookRepository.findById.mockResolvedValue({
      id: BOOK_ID,
      title: 'Refactoring',
      author: 'Martin Fowler',
      isbn: '9780132350884',
      publishedYear: 1999,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    service = new ReservationService(reservationRepository, userRepository, bookRepository);
  });

  describe('create', () => {
    it('creates an ACTIVE reservation with a server-generated UUID and ISO timestamps (ESC-S01, CA001, RN004)', async () => {
      const created = await service.create({ userId: USER_ID, bookId: BOOK_ID });

      expect(created.id).toMatch(UUID_V4);
      expect(created.userId).toBe(USER_ID);
      expect(created.bookId).toBe(BOOK_ID);
      expect(created.status).toBe('ACTIVE');
      expect(created.createdAt).toMatch(ISO_8601);
      expect(created.updatedAt).toBe(created.createdAt);
      expect(reservationRepository.save).toHaveBeenCalledTimes(1);
      expect(reservationRepository.save).toHaveBeenCalledWith(created);
    });

    it('checks the user exists before anything else (ESC-S02, CA004, RN001)', async () => {
      await service.create({ userId: USER_ID, bookId: BOOK_ID });

      expect(userRepository.findById).toHaveBeenCalledWith(USER_ID);
      expect(bookRepository.findById).toHaveBeenCalledWith(BOOK_ID);
      expect(reservationRepository.findActiveByBook).toHaveBeenCalledWith(BOOK_ID);
      expect(reservationRepository.findActiveByUserAndBook).toHaveBeenCalledWith(USER_ID, BOOK_ID);
    });

    it('throws NotFoundError when the user does not exist (ESC-S02, CA004, RN001)', async () => {
      userRepository.findById.mockResolvedValue(undefined);

      await expect(service.create({ userId: USER_ID, bookId: BOOK_ID })).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(bookRepository.findById).not.toHaveBeenCalled();
      expect(reservationRepository.save).not.toHaveBeenCalled();
    });

    it('throws BookNotFoundError when the book does not exist (ESC-S03, CA004, RN001)', async () => {
      bookRepository.findById.mockResolvedValue(undefined);

      await expect(service.create({ userId: USER_ID, bookId: BOOK_ID })).rejects.toBeInstanceOf(
        BookNotFoundError,
      );
      expect(reservationRepository.save).not.toHaveBeenCalled();
    });

    it('throws BookAlreadyReservedError when the book has an active reservation (ESC-S04, CA002, RN002)', async () => {
      reservationRepository.findActiveByBook.mockResolvedValue(
        buildReservation({ userId: OTHER_USER_ID }),
      );

      await expect(service.create({ userId: USER_ID, bookId: BOOK_ID })).rejects.toBeInstanceOf(
        BookAlreadyReservedError,
      );
      expect(reservationRepository.save).not.toHaveBeenCalled();
    });

    it('throws ReservationConflictError when the user+book pair is already active (ESC-S05, CA003, RN003)', async () => {
      reservationRepository.findActiveByUserAndBook.mockResolvedValue(buildReservation());

      await expect(service.create({ userId: USER_ID, bookId: BOOK_ID })).rejects.toBeInstanceOf(
        ReservationConflictError,
      );
      expect(reservationRepository.save).not.toHaveBeenCalled();
    });

    it('creates independent reservations for distinct books (RN002)', async () => {
      const first = await service.create({ userId: USER_ID, bookId: BOOK_ID });
      const second = await service.create({ userId: USER_ID, bookId: OTHER_BOOK_ID });

      expect(first.id).not.toBe(second.id);
      expect(reservationRepository.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('list', () => {
    it('returns every reservation when no filter is provided (ESC-S06, CA007, RN007)', async () => {
      const reservations = [
        buildReservation(),
        buildReservation({ id: '66666666-6666-4666-8666-666666666666', userId: OTHER_USER_ID }),
      ];
      reservationRepository.findAll.mockResolvedValue(reservations);

      await expect(service.list()).resolves.toEqual(reservations);
      expect(reservationRepository.findAll).toHaveBeenCalledTimes(1);
      expect(userRepository.findById).not.toHaveBeenCalled();
    });

    it('returns an empty array when there are no reservations (ESC-S06, CA007)', async () => {
      reservationRepository.findAll.mockResolvedValue([]);

      await expect(service.list()).resolves.toEqual([]);
    });

    it('filters by userId when the filter is provided (ESC-S06, CA007, RN007)', async () => {
      const reservations = [buildReservation()];
      reservationRepository.findByUser.mockResolvedValue(reservations);

      await expect(service.list(USER_ID)).resolves.toEqual(reservations);
      expect(userRepository.findById).toHaveBeenCalledWith(USER_ID);
      expect(reservationRepository.findByUser).toHaveBeenCalledWith(USER_ID);
      expect(reservationRepository.findAll).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the filtered user does not exist (ESC-S06, CA007, RN007)', async () => {
      userRepository.findById.mockResolvedValue(undefined);

      await expect(service.list(USER_ID)).rejects.toBeInstanceOf(NotFoundError);
      expect(reservationRepository.findByUser).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('returns the reservation when it exists (ESC-S07, CA007, RN006)', async () => {
      const reservation = buildReservation();
      reservationRepository.findById.mockResolvedValue(reservation);

      await expect(service.getById(reservation.id)).resolves.toEqual(reservation);
      expect(reservationRepository.findById).toHaveBeenCalledWith(reservation.id);
    });

    it('throws ReservationNotFoundError when the reservation does not exist (ESC-S07, CA007, RN006)', async () => {
      reservationRepository.findById.mockResolvedValue(undefined);

      await expect(service.getById('missing-id')).rejects.toBeInstanceOf(
        ReservationNotFoundError,
      );
    });
  });

  describe('release', () => {
    it('sets status RELEASED and refreshes updatedAt (ESC-S08, CA006, RN005)', async () => {
      const current = buildReservation();
      reservationRepository.findById.mockResolvedValue(current);

      const released = await service.release(current.id);

      expect(released.status).toBe('RELEASED');
      expect(released.id).toBe(current.id);
      expect(released.userId).toBe(current.userId);
      expect(released.bookId).toBe(current.bookId);
      expect(released.createdAt).toBe(current.createdAt);
      expect(Date.parse(released.updatedAt)).toBeGreaterThanOrEqual(Date.parse(current.updatedAt));
      expect(reservationRepository.save).toHaveBeenCalledWith(released);
    });

    it('throws ReservationConflictError when the reservation is already released (ESC-S09, CA006, RN005)', async () => {
      reservationRepository.findById.mockResolvedValue(
        buildReservation({ status: 'RELEASED' }),
      );

      await expect(service.release('released-id')).rejects.toBeInstanceOf(
        ReservationConflictError,
      );
      expect(reservationRepository.save).not.toHaveBeenCalled();
    });

    it('throws ReservationNotFoundError when the reservation does not exist (ESC-S10, CA006, RN006)', async () => {
      reservationRepository.findById.mockResolvedValue(undefined);

      await expect(service.release('missing-id')).rejects.toBeInstanceOf(
        ReservationNotFoundError,
      );
      expect(reservationRepository.save).not.toHaveBeenCalled();
    });
  });
});
