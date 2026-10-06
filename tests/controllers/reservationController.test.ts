/**
 * Integration tests for the reservation HTTP API (T007, DES008).
 *
 * Each test spins up a fresh Express application through `createApp()`, so the
 * full stack is exercised end-to-end: routes -> Zod validation -> thin
 * controller -> ReservationService -> InMemoryReservationRepository ->
 * error middleware. Per DES008 the integration tests use the real in-memory
 * repositories instead of a mocked service, which is what makes the uniform
 * error contract (DES004/CA008) verifiable. They map to the Presentation
 * scenarios ESC-P01..ESC-P11 and the acceptance criteria CA001-CA009.
 */
import { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app';

/** Matches a canonical UUID v4 (RN004). */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MISSING_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

interface ErrorContract {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

interface ReservationPayload {
  id: string;
  userId: string;
  bookId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface UserResource {
  id: string;
  name: string;
  email: string;
}

interface BookResource {
  id: string;
  isbn: string;
}

/** Asserts the uniform error contract shape and the absence of stack traces. */
const expectErrorContract = (body: unknown, code: string): ErrorContract => {
  const contract = body as ErrorContract;
  expect(contract).toEqual({
    error: expect.objectContaining({ code, message: expect.any(String) }),
  });
  expect(contract.error).not.toHaveProperty('stack');
  return contract;
};

/** Registers a user and returns the created resource. */
const registerUser = async (
  app: Express,
  overrides: { name?: string; email?: string } = {},
): Promise<UserResource> => {
  const response = await request(app)
    .post('/api/users')
    .send({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      ...overrides,
    });

  expect(response.status).toBe(201);
  return response.body as UserResource;
};

/** Registers a book and returns the created resource. */
const registerBook = async (
  app: Express,
  overrides: { title?: string; author?: string; isbn?: string } = {},
): Promise<BookResource> => {
  const response = await request(app)
    .post('/api/books')
    .send({
      title: 'Refactoring',
      author: 'Martin Fowler',
      isbn: '9780132350884',
      ...overrides,
    });

  expect(response.status).toBe(201);
  return response.body as BookResource;
};

/** Creates a reservation through the API and returns the created resource. */
const reserve = async (
  app: Express,
  userId: string,
  bookId: string,
): Promise<ReservationPayload> => {
  const response = await request(app).post('/api/reservations').send({ userId, bookId });

  expect(response.status).toBe(201);
  return response.body as ReservationPayload;
};

describe('Reservation API integration', () => {
  let app: Express;

  beforeEach(() => {
    app = createApp();
  });

  describe('POST /api/reservations', () => {
    it('creates an ACTIVE reservation and returns 201 with the resource (ESC-P01, CA001)', async () => {
      const user = await registerUser(app);
      const book = await registerBook(app);

      const response = await request(app)
        .post('/api/reservations')
        .send({ userId: user.id, bookId: book.id });

      expect(response.status).toBe(201);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toEqual({
        id: expect.stringMatching(UUID_V4),
        userId: user.id,
        bookId: book.id,
        status: 'ACTIVE',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(response.body.createdAt).toBe(response.body.updatedAt);

      const fetched = await request(app).get(`/api/reservations/${response.body.id}`);
      expect(fetched.status).toBe(200);
      expect(fetched.body).toEqual(response.body);
    });

    it('returns 409 BOOK_ALREADY_RESERVED when the book is already reserved (ESC-P02, CA002, RN002)', async () => {
      const first = await registerUser(app);
      const second = await registerUser(app, {
        name: 'Alan Turing',
        email: 'alan@example.com',
      });
      const book = await registerBook(app);
      await reserve(app, first.id, book.id);

      const response = await request(app)
        .post('/api/reservations')
        .send({ userId: second.id, bookId: book.id });

      expect(response.status).toBe(409);
      expectErrorContract(response.body, 'BOOK_ALREADY_RESERVED');

      const list = await request(app).get('/api/reservations');
      expect(list.body).toHaveLength(1);
    });

    it('rejects a duplicate user+book pair with 409 (ESC-P03, CA003, RN002/RN003)', async () => {
      const user = await registerUser(app);
      const book = await registerBook(app);
      await reserve(app, user.id, book.id);

      const response = await request(app)
        .post('/api/reservations')
        .send({ userId: user.id, bookId: book.id });

      // The pair is already active, so the book is already reserved too.
      // `ReservationService.create` evaluates the book-level rule (RN002)
      // before the pair-level rule (RN003), so BOOK_ALREADY_RESERVED
      // takes precedence; the pair rule is unit-tested in isolation where
      // `findActiveByBook` is empty (ESC-S05).
      expect(response.status).toBe(409);
      expectErrorContract(response.body, 'BOOK_ALREADY_RESERVED');

      const list = await request(app).get('/api/reservations');
      expect(list.body).toHaveLength(1);
    });

    it('returns 404 USER_NOT_FOUND when the user does not exist (ESC-P04, CA004, RN001)', async () => {
      const book = await registerBook(app);

      const response = await request(app)
        .post('/api/reservations')
        .send({ userId: MISSING_ID, bookId: book.id });

      expect(response.status).toBe(404);
      expectErrorContract(response.body, 'USER_NOT_FOUND');
    });

    it('returns 404 BOOK_NOT_FOUND when the book does not exist (ESC-P04, CA004, RN001)', async () => {
      const user = await registerUser(app);

      const response = await request(app)
        .post('/api/reservations')
        .send({ userId: user.id, bookId: MISSING_ID });

      expect(response.status).toBe(404);
      expectErrorContract(response.body, 'BOOK_NOT_FOUND');
    });

    it('returns 400 with details for a malformed userId (ESC-P05, CA005, RN009)', async () => {
      const book = await registerBook(app);

      const response = await request(app)
        .post('/api/reservations')
        .send({ userId: 'not-a-uuid', bookId: book.id });

      expect(response.status).toBe(400);
      const contract = expectErrorContract(response.body, 'VALIDATION_ERROR');
      expect(contract.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'userId' })]),
      );
    });

    it('returns 400 with details when required fields are missing (ESC-P05, CA005)', async () => {
      const response = await request(app).post('/api/reservations').send({});

      expect(response.status).toBe(400);
      const contract = expectErrorContract(response.body, 'VALIDATION_ERROR');
      expect(contract.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'userId' }),
          expect.objectContaining({ field: 'bookId' }),
        ]),
      );
    });

    it('returns 400 for unknown fields (ESC-P05, CA005, DES005)', async () => {
      const user = await registerUser(app);
      const book = await registerBook(app);

      const response = await request(app)
        .post('/api/reservations')
        .send({ userId: user.id, bookId: book.id, status: 'ACTIVE' });

      expect(response.status).toBe(400);
      expectErrorContract(response.body, 'VALIDATION_ERROR');
    });
  });

  describe('GET /api/reservations', () => {
    it('returns 200 with an empty array when there are no reservations (ESC-P06, CA007)', async () => {
      const response = await request(app).get('/api/reservations');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('returns 200 with every reservation (ESC-P06, CA007)', async () => {
      const first = await registerUser(app);
      const second = await registerUser(app, {
        name: 'Alan Turing',
        email: 'alan@example.com',
      });
      const firstBook = await registerBook(app);
      const secondBook = await registerBook(app, {
        title: 'Clean Code',
        author: 'Robert C. Martin',
        isbn: '9780134494166',
      });
      await reserve(app, first.id, firstBook.id);
      await reserve(app, second.id, secondBook.id);

      const response = await request(app).get('/api/reservations');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body.map((reservation: ReservationPayload) => reservation.userId)).toEqual(
        expect.arrayContaining([first.id, second.id]),
      );
    });

    it('filters by userId when the query param is provided (ESC-P06, CA007, RN007)', async () => {
      const first = await registerUser(app);
      const second = await registerUser(app, {
        name: 'Alan Turing',
        email: 'alan@example.com',
      });
      const firstBook = await registerBook(app);
      const secondBook = await registerBook(app, {
        title: 'Clean Code',
        author: 'Robert C. Martin',
        isbn: '9780134494166',
      });
      const firstReservation = await reserve(app, first.id, firstBook.id);
      await reserve(app, second.id, secondBook.id);

      const response = await request(app).get(`/api/reservations?userId=${first.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(firstReservation.id);
      expect(response.body[0].userId).toBe(first.id);
    });

    it('returns 400 for a non-UUID userId filter (ESC-P07, CA007, RN007, RN009)', async () => {
      const response = await request(app).get('/api/reservations?userId=not-a-uuid');

      expect(response.status).toBe(400);
      const contract = expectErrorContract(response.body, 'VALIDATION_ERROR');
      expect(contract.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'userId' })]),
      );
    });

    it('returns 404 USER_NOT_FOUND for a valid but unknown userId filter (ESC-P07, CA007, RN007)', async () => {
      const response = await request(app).get(`/api/reservations?userId=${MISSING_ID}`);

      expect(response.status).toBe(404);
      expectErrorContract(response.body, 'USER_NOT_FOUND');
    });
  });

  describe('GET /api/reservations/:id', () => {
    it('returns 200 with the reservation when it exists (ESC-P08, CA007)', async () => {
      const user = await registerUser(app);
      const book = await registerBook(app);
      const created = await reserve(app, user.id, book.id);

      const response = await request(app).get(`/api/reservations/${created.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(created);
    });

    it('returns 404 RESERVATION_NOT_FOUND for an unknown id (ESC-P08, CA007, RN006)', async () => {
      const response = await request(app).get(`/api/reservations/${MISSING_ID}`);

      expect(response.status).toBe(404);
      expectErrorContract(response.body, 'RESERVATION_NOT_FOUND');
    });
  });

  describe('DELETE /api/reservations/:id', () => {
    it('releases an active reservation and returns 200 with RELEASED (ESC-P09, CA006, RN005)', async () => {
      const user = await registerUser(app);
      const book = await registerBook(app);
      const created = await reserve(app, user.id, book.id);

      const response = await request(app).delete(`/api/reservations/${created.id}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(created.id);
      expect(response.body.status).toBe('RELEASED');
      expect(Date.parse(response.body.updatedAt)).toBeGreaterThanOrEqual(
        Date.parse(created.updatedAt),
      );

      const fetched = await request(app).get(`/api/reservations/${created.id}`);
      expect(fetched.status).toBe(200);
      expect(fetched.body.status).toBe('RELEASED');
    });

    it('frees the book so it can be reserved again after release (ESC-P09, RN005)', async () => {
      const first = await registerUser(app);
      const second = await registerUser(app, {
        name: 'Alan Turing',
        email: 'alan@example.com',
      });
      const book = await registerBook(app);
      const created = await reserve(app, first.id, book.id);

      await request(app).delete(`/api/reservations/${created.id}`).expect(200);

      const response = await request(app)
        .post('/api/reservations')
        .send({ userId: second.id, bookId: book.id });

      expect(response.status).toBe(201);
      expect(response.body.userId).toBe(second.id);
    });

    it('returns 409 RESERVATION_CONFLICT when releasing twice (ESC-P09, CA006, RN005)', async () => {
      const user = await registerUser(app);
      const book = await registerBook(app);
      const created = await reserve(app, user.id, book.id);
      await request(app).delete(`/api/reservations/${created.id}`).expect(200);

      const response = await request(app).delete(`/api/reservations/${created.id}`);

      expect(response.status).toBe(409);
      expectErrorContract(response.body, 'RESERVATION_CONFLICT');
    });

    it('returns 404 RESERVATION_NOT_FOUND for an unknown id (ESC-P09, CA006, RN006)', async () => {
      const response = await request(app).delete(`/api/reservations/${MISSING_ID}`);

      expect(response.status).toBe(404);
      expectErrorContract(response.body, 'RESERVATION_NOT_FOUND');
    });
  });

  describe('Uniform error contract (ESC-P10, CA008)', () => {
    it('uses the { error: { code, message } } shape without stack traces', async () => {
      const response = await request(app).post('/api/reservations').send({});

      expect(response.status).toBe(400);
      const contract = expectErrorContract(response.body, 'VALIDATION_ERROR');
      expect(Object.keys(contract)).toEqual(['error']);
      expect(contract.error).toEqual(
        expect.objectContaining({
          code: expect.any(String),
          message: expect.any(String),
        }),
      );
    });

    it('keeps the error middleware registered last for unmatched reservation routes', async () => {
      const response = await request(app).get(`/api/reservations/${MISSING_ID}/extra`);

      expect(response.status).toBe(404);
      expectErrorContract(response.body, 'USER_NOT_FOUND');
    });
  });

  describe('User and book regression (ESC-P11, CA009, RN010)', () => {
    it('keeps the user CRUD working through the same app', async () => {
      const created = await registerUser(app);
      expect(created.email).toBe('ada@example.com');

      const duplicate = await request(app)
        .post('/api/users')
        .send({ name: 'Someone else', email: 'ADA@example.com' });
      expect(duplicate.status).toBe(409);
      expectErrorContract(duplicate.body, 'EMAIL_ALREADY_EXISTS');

      const fetched = await request(app).get(`/api/users/${created.id}`);
      expect(fetched.status).toBe(200);
      expect(fetched.body).toEqual(created);

      const list = await request(app).get('/api/users');
      expect(list.status).toBe(200);
      expect(list.body).toHaveLength(1);
    });

    it('keeps the book CRUD working through the same app', async () => {
      const created = await registerBook(app);
      expect(created.isbn).toBe('9780132350884');

      const duplicate = await request(app).post('/api/books').send({
        title: 'Clean Code',
        author: 'Robert C. Martin',
        isbn: '978-0-13-235088-4',
      });
      expect(duplicate.status).toBe(409);
      expectErrorContract(duplicate.body, 'ISBN_ALREADY_EXISTS');

      const fetched = await request(app).get(`/api/books/${created.id}`);
      expect(fetched.status).toBe(200);
      expect(fetched.body).toEqual(created);

      const deleted = await request(app).delete(`/api/books/${created.id}`);
      expect(deleted.status).toBe(204);

      const list = await request(app).get('/api/books');
      expect(list.status).toBe(200);
      expect(list.body).toEqual([]);
    });
  });
});
