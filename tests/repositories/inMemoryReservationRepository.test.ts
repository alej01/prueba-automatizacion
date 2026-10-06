/**
 * Unit tests for `InMemoryReservationRepository` (T006, DES008).
 *
 * These tests use a real repository instance (no mock) so they verify the
 * actual `Map` semantics and the "active" lookups of RN002/RN003/RN005,
 * mirroring `tests/repositories/inMemoryBookRepository.test.ts`. They map to
 * the Infrastructure scenarios ESC-I01..ESC-I06.
 */
import { Reservation } from '../../src/models/reservation';
import { InMemoryReservationRepository } from '../../src/repositories/inMemoryReservationRepository';

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

describe('InMemoryReservationRepository', () => {
  let repository: InMemoryReservationRepository;

  beforeEach(() => {
    repository = new InMemoryReservationRepository();
  });

  it('starts empty for every new instance (ESC-I06, RN008)', async () => {
    await expect(repository.findAll()).resolves.toEqual([]);
    await expect(repository.findById('unknown')).resolves.toBeUndefined();
    await expect(repository.findActiveByBook(BOOK_ID)).resolves.toBeUndefined();
    await expect(repository.findActiveByUserAndBook(USER_ID, BOOK_ID)).resolves.toBeUndefined();
    await expect(repository.findByUser(USER_ID)).resolves.toEqual([]);

    const other = new InMemoryReservationRepository();
    await expect(other.findAll()).resolves.toEqual([]);
  });

  it('persists a reservation by id and retrieves the same object (ESC-I01)', async () => {
    const reservation = buildReservation();

    await expect(repository.save(reservation)).resolves.toBe(reservation);
    await expect(repository.findById(reservation.id)).resolves.toBe(reservation);
  });

  it('replaces an existing record when saving the same id', async () => {
    const reservation = buildReservation();
    await repository.save(reservation);

    const released = buildReservation({ status: 'RELEASED' });
    await repository.save(released);

    await expect(repository.findById(reservation.id)).resolves.toEqual(released);
    await expect(repository.findAll()).resolves.toHaveLength(1);
  });

  it('returns every stored reservation regardless of status (ESC-I02, CA007)', async () => {
    const active = buildReservation();
    const released = buildReservation({
      id: '66666666-6666-4666-8666-666666666666',
      bookId: OTHER_BOOK_ID,
      status: 'RELEASED',
    });
    await repository.save(active);
    await repository.save(released);

    const all = await repository.findAll();

    expect(all).toHaveLength(2);
    expect(all).toEqual(expect.arrayContaining([active, released]));
  });

  it('finds the ACTIVE reservation for a book and ignores other books (ESC-I03, RN002)', async () => {
    const reservation = buildReservation();
    await repository.save(reservation);

    await expect(repository.findActiveByBook(BOOK_ID)).resolves.toBe(reservation);
    await expect(repository.findActiveByBook(OTHER_BOOK_ID)).resolves.toBeUndefined();
  });

  it('finds the ACTIVE reservation for a user+book pair (ESC-I04, RN003)', async () => {
    const reservation = buildReservation();
    await repository.save(reservation);

    await expect(repository.findActiveByUserAndBook(USER_ID, BOOK_ID)).resolves.toBe(reservation);
    await expect(
      repository.findActiveByUserAndBook(OTHER_USER_ID, BOOK_ID),
    ).resolves.toBeUndefined();
    await expect(
      repository.findActiveByUserAndBook(USER_ID, OTHER_BOOK_ID),
    ).resolves.toBeUndefined();
  });

  it('does not treat a RELEASED reservation as active, freeing the book and the pair (ESC-I05, RN005)', async () => {
    const released = buildReservation({ status: 'RELEASED' });
    await repository.save(released);

    await expect(repository.findActiveByBook(BOOK_ID)).resolves.toBeUndefined();
    await expect(
      repository.findActiveByUserAndBook(USER_ID, BOOK_ID),
    ).resolves.toBeUndefined();
  });

  it('allows the book to be reserved again by another user after release (ESC-I05, RN002, RN005)', async () => {
    const released = buildReservation({ status: 'RELEASED' });
    await repository.save(released);
    await repository.save(
      buildReservation({
        id: '77777777-7777-4777-8777-777777777777',
        userId: OTHER_USER_ID,
      }),
    );

    const active = await repository.findActiveByBook(BOOK_ID);
    expect(active?.userId).toBe(OTHER_USER_ID);
  });

  it('returns every reservation of a user regardless of status (ESC-I02, RN007)', async () => {
    const active = buildReservation();
    const released = buildReservation({
      id: '88888888-8888-4888-8888-888888888888',
      bookId: OTHER_BOOK_ID,
      status: 'RELEASED',
    });
    const foreign = buildReservation({
      id: '99999999-9999-4999-8999-999999999999',
      userId: OTHER_USER_ID,
      bookId: OTHER_BOOK_ID,
    });
    await repository.save(active);
    await repository.save(released);
    await repository.save(foreign);

    const mine = await repository.findByUser(USER_ID);

    expect(mine).toHaveLength(2);
    expect(mine).toEqual(expect.arrayContaining([active, released]));
  });

  it('returns an empty array when the user has no reservations (RN007)', async () => {
    await repository.save(buildReservation());

    await expect(repository.findByUser(OTHER_USER_ID)).resolves.toEqual([]);
  });
});
