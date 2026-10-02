/**
 * Integration tests for the user HTTP API (T010, DES008).
 *
 * Each test spins up a fresh Express application through `createApp()`, so the
 * full stack is exercised end-to-end: routes -> Zod validation -> thin
 * controller -> UserService -> InMemoryUserRepository -> error middleware. Per
 * DES008 the integration tests use the real in-memory repository instead of a
 * mocked service, which is what makes the uniform error contract (DES004)
 * verifiable. They map to the Presentation scenarios ESC-P01..ESC-P08.
 */
import express, { Express, Request, Response } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app';
import { errorMiddleware } from '../../src/middleware/errorMiddleware';
import { ValidationError } from '../../src/models/errors';

/** Matches a canonical UUID v4 (RN004). */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ErrorContract {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
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
  payload: { name?: string; email?: string } = {},
): Promise<{ id: string; name: string; email: string; createdAt: string; updatedAt: string }> => {
  const response = await request(app)
    .post('/api/users')
    .send({ name: 'Ada Lovelace', email: 'ada@example.com', ...payload });

  expect(response.status).toBe(201);
  return response.body;
};

describe('User API integration', () => {
  let app: Express;

  beforeEach(() => {
    app = createApp();
  });

  describe('POST /api/users', () => {
    it('creates a user and returns 201 with the resource (ESC-P01, CA001)', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ name: 'Ada Lovelace', email: 'ada@example.com' });

      expect(response.status).toBe(201);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toEqual({
        id: expect.stringMatching(UUID_V4),
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      const fetched = await request(app).get(`/api/users/${response.body.id}`);
      expect(fetched.status).toBe(200);
      expect(fetched.body).toEqual(response.body);
    });

    it('normalizes name trim and email lowercase (RN001, RN003)', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ name: '  Ada Lovelace  ', email: '  ADA@Example.COM  ' });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Ada Lovelace');
      expect(response.body.email).toBe('ada@example.com');
    });

    it('returns 409 with EMAIL_ALREADY_EXISTS for a duplicate email (ESC-P02, CA002)', async () => {
      await registerUser(app);

      const response = await request(app)
        .post('/api/users')
        .send({ name: 'Someone else', email: 'ADA@example.com' });

      expect(response.status).toBe(409);
      expectErrorContract(response.body, 'EMAIL_ALREADY_EXISTS');

      const list = await request(app).get('/api/users');
      expect(list.body).toHaveLength(1);
    });

    it('returns 400 with details for an empty name (ESC-P03, CA003)', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ name: '   ', email: 'ada@example.com' });

      expect(response.status).toBe(400);
      const contract = expectErrorContract(response.body, 'VALIDATION_ERROR');
      expect(contract.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'name' })]),
      );
    });

    it('returns 400 with details for an invalid email (ESC-P03, CA003)', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ name: 'Ada', email: 'not-an-email' });

      expect(response.status).toBe(400);
      const contract = expectErrorContract(response.body, 'VALIDATION_ERROR');
      expect(contract.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
      );
    });

    it('returns 400 for unknown fields (RN005)', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ name: 'Ada', email: 'ada@example.com', role: 'admin' });

      expect(response.status).toBe(400);
      expectErrorContract(response.body, 'VALIDATION_ERROR');
    });
  });

  describe('GET /api/users', () => {
    it('returns 200 with an empty array when there are no users (ESC-P04, CA004)', async () => {
      const response = await request(app).get('/api/users');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('returns 200 with every registered user (ESC-P04, CA004)', async () => {
      await registerUser(app);
      await registerUser(app, { name: 'Alan Turing', email: 'alan@example.com' });

      const response = await request(app).get('/api/users');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body.map((user: { email: string }) => user.email)).toEqual(
        expect.arrayContaining(['ada@example.com', 'alan@example.com']),
      );
    });
  });

  describe('GET /api/users/:id', () => {
    it('returns 200 with the user when it exists (ESC-P05, CA005)', async () => {
      const created = await registerUser(app);

      const response = await request(app).get(`/api/users/${created.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(created);
    });

    it('returns 404 with USER_NOT_FOUND for an unknown id (ESC-P05, CA005)', async () => {
      const response = await request(app).get('/api/users/does-not-exist');

      expect(response.status).toBe(404);
      expectErrorContract(response.body, 'USER_NOT_FOUND');
    });
  });

  describe('PUT /api/users/:id', () => {
    it('updates the name and preserves id/createdAt/email (ESC-P06, CA006)', async () => {
      const created = await registerUser(app);

      const response = await request(app)
        .put(`/api/users/${created.id}`)
        .send({ name: 'Ada King' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Ada King');
      expect(response.body.email).toBe(created.email);
      expect(response.body.id).toBe(created.id);
      expect(response.body.createdAt).toBe(created.createdAt);
      expect(Date.parse(response.body.updatedAt)).toBeGreaterThanOrEqual(Date.parse(created.updatedAt));
    });

    it('updates the email when it is free (ESC-P06)', async () => {
      const created = await registerUser(app);

      const response = await request(app)
        .put(`/api/users/${created.id}`)
        .send({ email: 'ada.king@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('ada.king@example.com');
    });

    it('allows the owner to keep its own email (ESC-P06, RN001)', async () => {
      const created = await registerUser(app);

      const response = await request(app)
        .put(`/api/users/${created.id}`)
        .send({ email: 'ada@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('ada@example.com');
    });

    it('returns 409 when the email belongs to another user (ESC-P06, CA006)', async () => {
      await registerUser(app);
      const second = await registerUser(app, { name: 'Alan', email: 'alan@example.com' });

      const response = await request(app)
        .put(`/api/users/${second.id}`)
        .send({ email: 'ada@example.com' });

      expect(response.status).toBe(409);
      expectErrorContract(response.body, 'EMAIL_ALREADY_EXISTS');
    });

    it('returns 400 when no field is provided (ESC-P06, RN005)', async () => {
      const created = await registerUser(app);

      const response = await request(app).put(`/api/users/${created.id}`).send({});

      expect(response.status).toBe(400);
      expectErrorContract(response.body, 'VALIDATION_ERROR');
    });

    it('returns 400 for unknown fields (ESC-P06, RN005)', async () => {
      const created = await registerUser(app);

      const response = await request(app)
        .put(`/api/users/${created.id}`)
        .send({ role: 'admin' });

      expect(response.status).toBe(400);
      expectErrorContract(response.body, 'VALIDATION_ERROR');
    });

    it('returns 404 for an unknown id (ESC-P06, CA006)', async () => {
      const response = await request(app)
        .put('/api/users/does-not-exist')
        .send({ name: 'Ada' });

      expect(response.status).toBe(404);
      expectErrorContract(response.body, 'USER_NOT_FOUND');
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('returns 204 without body and removes the user (ESC-P07, CA007)', async () => {
      const created = await registerUser(app);

      const response = await request(app).delete(`/api/users/${created.id}`);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
      expect(response.text).toBe('');

      const fetched = await request(app).get(`/api/users/${created.id}`);
      expect(fetched.status).toBe(404);
    });

    it('returns 404 for an unknown id (ESC-P07, CA007)', async () => {
      const response = await request(app).delete('/api/users/does-not-exist');

      expect(response.status).toBe(404);
      expectErrorContract(response.body, 'USER_NOT_FOUND');
    });
  });

  describe('Unmatched routes', () => {
    it('returns 404 with the uniform error contract (ESC-P08, CA008)', async () => {
      const response = await request(app).get('/api/unknown');

      expect(response.status).toBe(404);
      expectErrorContract(response.body, 'USER_NOT_FOUND');
    });
  });

  describe('Unexpected errors (ESC-P08, CA008, RN008)', () => {
    it('maps an uncaught error to 500 INTERNAL_ERROR without leaking details', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const faultyApp = express();
      faultyApp.use(express.json());
      faultyApp.get('/boom', () => {
        throw new Error('kaboom: database credentials leaked');
      });
      faultyApp.use(errorMiddleware);

      const response = await request(faultyApp).get('/boom');

      expect(response.status).toBe(500);
      expectErrorContract(response.body, 'INTERNAL_ERROR');
      expect(response.body.error).not.toHaveProperty('details');
      expect(JSON.stringify(response.body)).not.toContain('kaboom');
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });

    it('handles non-Error thrown values as internal errors', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const faultyApp = express();
      faultyApp.get('/boom', (_req, _res, next) => next('plain failure'));
      faultyApp.use(errorMiddleware);

      const response = await request(faultyApp).get('/boom');

      expect(response.status).toBe(500);
      expectErrorContract(response.body, 'INTERNAL_ERROR');
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });

  describe('errorMiddleware edge cases', () => {
    it('delegates to the default handler when headers were already sent', () => {
      const next = jest.fn();

      errorMiddleware(
        new Error('late failure'),
        {} as Request,
        { headersSent: true } as unknown as Response,
        next,
      );

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('renders a ValidationError without details', () => {
      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });

      errorMiddleware(
        new ValidationError('Invalid request payload'),
        {} as Request,
        { headersSent: false, status } as unknown as Response,
        jest.fn(),
      );

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request payload' },
      });
    });
  });
});
