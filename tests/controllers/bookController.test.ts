/**
 * Integration tests for the book HTTP API (T008, DES008).
 *
 * Each test spins up a fresh Express application through `createApp()`, so the
 * full stack is exercised end-to-end: routes -> Zod validation -> thin
 * controller -> BookService -> InMemoryBookRepository -> error middleware. Per
 * DES008 the integration tests use the real in-memory repository instead of a
 * mocked service, which is what makes the uniform error contract (DES004)
 * verifiable. They map to the Presentation scenarios ESC-P01..ESC-P09.
 */
import { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app';

/** Matches a canonical UUID v4 (RN006). */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ErrorContract {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

/** Shapes accepted by the helper that registers a book. */
interface BookPayload {
  title?: string;
  author?: string;
  isbn?: string;
  publishedYear?: number;
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

/** Registers a book and returns the created resource. */
const registerBook = async (
  app: Express,
  payload: BookPayload = {},
): Promise<{
  id: string;
  title: string;
  author: string;
  isbn: string;
  publishedYear: number | null;
  createdAt: string;
  updatedAt: string;
}> => {
  const response = await request(app)
    .post('/api/books')
    .send({
      title: 'Refactoring',
      author: 'Martin Fowler',
      isbn: '9780132350884',
      ...payload,
    });

  expect(response.status).toBe(201);
  return response.body;
};

describe('Book API integration', () => {
  let app: Express;

  beforeEach(() => {
    app = createApp();
  });

  describe('POST /api/books', () => {
    it('creates a book and returns 201 with the resource (ESC-P01, CA001)', async () => {
      const response = await request(app).post('/api/books').send({
        title: 'Refactoring',
        author: 'Martin Fowler',
        isbn: '9780132350884',
      });

      expect(response.status).toBe(201);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toEqual({
        id: expect.stringMatching(UUID_V4),
        title: 'Refactoring',
        author: 'Martin Fowler',
        isbn: '9780132350884',
        publishedYear: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      const fetched = await request(app).get(`/api/books/${response.body.id}`);
      expect(fetched.status).toBe(200);
      expect(fetched.body).toEqual(response.body);
    });

    it('normalizes title, author and isbn (RN002-RN004)', async () => {
      const response = await request(app).post('/api/books').send({
        title: '  Refactoring  ',
        author: '  Martin Fowler  ',
        isbn: ' 978-0-13-235088-4 ',
      });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Refactoring');
      expect(response.body.author).toBe('Martin Fowler');
      expect(response.body.isbn).toBe('9780132350884');
    });

    it('stores the provided publishedYear (RN005)', async () => {
      const created = await registerBook(app, { publishedYear: 1999 });

      expect(created.publishedYear).toBe(1999);
    });

    it('returns 409 with ISBN_ALREADY_EXISTS for a duplicate ISBN (ESC-P02, CA002)', async () => {
      await registerBook(app);

      const response = await request(app).post('/api/books').send({
        title: 'Clean Code',
        author: 'Robert C. Martin',
        isbn: '978-0-13-235088-4',
      });

      expect(response.status).toBe(409);
      expectErrorContract(response.body, 'ISBN_ALREADY_EXISTS');

      const list = await request(app).get('/api/books');
      expect(list.body).toHaveLength(1);
    });

    it('returns 400 with details for an empty title (ESC-P03, CA003)', async () => {
      const response = await request(app).post('/api/books').send({
        title: '   ',
        author: 'Martin Fowler',
        isbn: '9780132350884',
      });

      expect(response.status).toBe(400);
      const contract = expectErrorContract(response.body, 'VALIDATION_ERROR');
      expect(contract.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'title' })]),
      );
    });

    it('returns 400 with details for an invalid ISBN checksum (ESC-P03, RN004)', async () => {
      const response = await request(app).post('/api/books').send({
        title: 'Refactoring',
        author: 'Martin Fowler',
        isbn: '9780132350885',
      });

      expect(response.status).toBe(400);
      const contract = expectErrorContract(response.body, 'VALIDATION_ERROR');
      expect(contract.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'isbn' })]),
      );
    });

    it('returns 400 with details for an out-of-range publishedYear (ESC-P03, RN005)', async () => {
      const response = await request(app).post('/api/books').send({
        title: 'Refactoring',
        author: 'Martin Fowler',
        isbn: '9780132350884',
        publishedYear: 1200,
      });

      expect(response.status).toBe(400);
      const contract = expectErrorContract(response.body, 'VALIDATION_ERROR');
      expect(contract.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'publishedYear' })]),
      );
    });

    it('returns 400 for unknown fields (DES005)', async () => {
      const response = await request(app).post('/api/books').send({
        title: 'Refactoring',
        author: 'Martin Fowler',
        isbn: '9780132350884',
        stock: 10,
      });

      expect(response.status).toBe(400);
      expectErrorContract(response.body, 'VALIDATION_ERROR');
    });

    it('returns 400 when required fields are missing (ESC-P03)', async () => {
      const response = await request(app).post('/api/books').send({});

      expect(response.status).toBe(400);
      const contract = expectErrorContract(response.body, 'VALIDATION_ERROR');
      expect(contract.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'title' }),
          expect.objectContaining({ field: 'author' }),
          expect.objectContaining({ field: 'isbn' }),
        ]),
      );
    });
  });

  describe('GET /api/books', () => {
    it('returns 200 with an empty array when there are no books (ESC-P04, CA004)', async () => {
      const response = await request(app).get('/api/books');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('returns 200 with every registered book (ESC-P04, CA004)', async () => {
      await registerBook(app);
      await registerBook(app, {
        title: 'Clean Code',
        author: 'Robert C. Martin',
        isbn: '9780134494166',
      });

      const response = await request(app).get('/api/books');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body.map((book: { isbn: string }) => book.isbn)).toEqual(
        expect.arrayContaining(['9780132350884', '9780134494166']),
      );
    });
  });

  describe('GET /api/books/:id', () => {
    it('returns 200 with the book when it exists (ESC-P05, CA005)', async () => {
      const created = await registerBook(app);

      const response = await request(app).get(`/api/books/${created.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(created);
    });

    it('returns 404 with BOOK_NOT_FOUND for an unknown id (ESC-P05, CA005)', async () => {
      const response = await request(app).get('/api/books/does-not-exist');

      expect(response.status).toBe(404);
      expectErrorContract(response.body, 'BOOK_NOT_FOUND');
    });
  });

  describe('PUT /api/books/:id', () => {
    it('updates the title and preserves id/createdAt/author/isbn (ESC-P06, CA006)', async () => {
      const created = await registerBook(app);

      const response = await request(app)
        .put(`/api/books/${created.id}`)
        .send({ title: 'Refactoring 2nd edition' });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Refactoring 2nd edition');
      expect(response.body.author).toBe(created.author);
      expect(response.body.isbn).toBe(created.isbn);
      expect(response.body.id).toBe(created.id);
      expect(response.body.createdAt).toBe(created.createdAt);
      expect(Date.parse(response.body.updatedAt)).toBeGreaterThanOrEqual(
        Date.parse(created.updatedAt),
      );
    });

    it('updates the isbn and publishedYear when they are free (ESC-P06)', async () => {
      const created = await registerBook(app);

      const response = await request(app)
        .put(`/api/books/${created.id}`)
        .send({ isbn: '9780134494166', publishedYear: 2008 });

      expect(response.status).toBe(200);
      expect(response.body.isbn).toBe('9780134494166');
      expect(response.body.publishedYear).toBe(2008);
    });

    it('allows the owner to keep its own isbn (ESC-P06, RN001)', async () => {
      const created = await registerBook(app);

      const response = await request(app)
        .put(`/api/books/${created.id}`)
        .send({ isbn: '9780132350884' });

      expect(response.status).toBe(200);
      expect(response.body.isbn).toBe('9780132350884');
    });

    it('returns 409 when the isbn belongs to another book (ESC-P06, CA006, RN001)', async () => {
      await registerBook(app);
      const second = await registerBook(app, {
        title: 'Clean Code',
        author: 'Robert C. Martin',
        isbn: '9780134494166',
      });

      const response = await request(app)
        .put(`/api/books/${second.id}`)
        .send({ isbn: '9780132350884' });

      expect(response.status).toBe(409);
      expectErrorContract(response.body, 'ISBN_ALREADY_EXISTS');
    });

    it('returns 400 when no field is provided (ESC-P06, RN009)', async () => {
      const created = await registerBook(app);

      const response = await request(app).put(`/api/books/${created.id}`).send({});

      expect(response.status).toBe(400);
      expectErrorContract(response.body, 'VALIDATION_ERROR');
    });

    it('returns 400 for unknown fields (ESC-P06, DES005)', async () => {
      const created = await registerBook(app);

      const response = await request(app).put(`/api/books/${created.id}`).send({ stock: 10 });

      expect(response.status).toBe(400);
      expectErrorContract(response.body, 'VALIDATION_ERROR');
    });

    it('returns 400 for an invalid isbn (ESC-P06)', async () => {
      const created = await registerBook(app);

      const response = await request(app)
        .put(`/api/books/${created.id}`)
        .send({ isbn: 'not-an-isbn' });

      expect(response.status).toBe(400);
      expectErrorContract(response.body, 'VALIDATION_ERROR');
    });

    it('returns 404 for an unknown id (ESC-P06, CA006)', async () => {
      const response = await request(app)
        .put('/api/books/does-not-exist')
        .send({ title: 'Refactoring' });

      expect(response.status).toBe(404);
      expectErrorContract(response.body, 'BOOK_NOT_FOUND');
    });
  });

  describe('DELETE /api/books/:id', () => {
    it('returns 204 without body and removes the book (ESC-P07, CA007)', async () => {
      const created = await registerBook(app);

      const response = await request(app).delete(`/api/books/${created.id}`);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
      expect(response.text).toBe('');

      const fetched = await request(app).get(`/api/books/${created.id}`);
      expect(fetched.status).toBe(404);
    });

    it('returns 404 for an unknown id (ESC-P07, CA007)', async () => {
      const response = await request(app).delete('/api/books/does-not-exist');

      expect(response.status).toBe(404);
      expectErrorContract(response.body, 'BOOK_NOT_FOUND');
    });
  });

  describe('Unmatched routes (ESC-P08, CA008)', () => {
    it('returns 404 with the uniform error contract', async () => {
      const response = await request(app).get('/api/books/1/extra');

      expect(response.status).toBe(404);
      expectErrorContract(response.body, 'USER_NOT_FOUND');
    });
  });

  describe('User CRUD regression (ESC-P09, CA009, RN010)', () => {
    it('keeps the user API working through the same app', async () => {
      const createdResponse = await request(app)
        .post('/api/users')
        .send({ name: 'Ada Lovelace', email: 'ada@example.com' });

      expect(createdResponse.status).toBe(201);
      expect(createdResponse.body.email).toBe('ada@example.com');

      const duplicate = await request(app)
        .post('/api/users')
        .send({ name: 'Someone else', email: 'ADA@example.com' });

      expect(duplicate.status).toBe(409);
      expectErrorContract(duplicate.body, 'EMAIL_ALREADY_EXISTS');

      const fetched = await request(app).get(`/api/users/${createdResponse.body.id}`);
      expect(fetched.status).toBe(200);
      expect(fetched.body).toEqual(createdResponse.body);

      const list = await request(app).get('/api/users');
      expect(list.status).toBe(200);
      expect(list.body).toHaveLength(1);
    });
  });
});
