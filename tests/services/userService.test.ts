/**
 * Unit tests for `UserService` (T009, DES008).
 *
 * The repository is mocked on purpose: these tests verify the business rules in
 * isolation (RN001, RN004, RN005, RN006) without depending on `Map` semantics.
 * They map to the Application scenarios ESC-S01..ESC-S08.
 */
import { ConflictError, NotFoundError } from '../../src/models/errors';
import { UpdateUserRequest, User } from '../../src/models/user';
import { UserRepository } from '../../src/repositories/inMemoryUserRepository';
import { UserService } from '../../src/services/userService';

/** Matches a canonical UUID v4 (RN004). */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const createRepositoryMock = (): jest.Mocked<UserRepository> => ({
  save: jest.fn(),
  findById: jest.fn(),
  findByEmail: jest.fn(),
  findAll: jest.fn(),
  delete: jest.fn(),
});

describe('UserService', () => {
  let repository: jest.Mocked<UserRepository>;
  let service: UserService;

  beforeEach(() => {
    repository = createRepositoryMock();
    repository.save.mockImplementation(async (user: User) => user);
    service = new UserService(repository);
  });

  describe('create', () => {
    it('creates a user with a server-generated UUID and ISO timestamps (ESC-S01)', async () => {
      repository.findByEmail.mockResolvedValue(undefined);

      const created = await service.create({ name: 'Ada Lovelace', email: 'ada@example.com' });

      expect(created.id).toMatch(UUID_V4);
      expect(created.name).toBe('Ada Lovelace');
      expect(created.email).toBe('ada@example.com');
      expect(created.createdAt).toMatch(ISO_8601);
      expect(created.updatedAt).toBe(created.createdAt);
      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(repository.save).toHaveBeenCalledWith(created);
    });

    it('normalizes email (trim + lowercase) and name trim before persisting (RN001, RN003)', async () => {
      repository.findByEmail.mockResolvedValue(undefined);

      const created = await service.create({
        name: '  Ada Lovelace  ',
        email: '  ADA@Example.COM  ',
      });

      expect(created.name).toBe('Ada Lovelace');
      expect(created.email).toBe('ada@example.com');
      expect(repository.findByEmail).toHaveBeenCalledWith('ada@example.com');
      expect(repository.save.mock.calls[0][0].email).toBe('ada@example.com');
    });

    it('throws ConflictError when the email is already registered (ESC-S02, RN001)', async () => {
      repository.findByEmail.mockResolvedValue(buildUser());

      await expect(
        service.create({ name: 'Ada', email: 'ada@example.com' }),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('detects duplicates case-insensitively (RN001)', async () => {
      repository.findByEmail.mockResolvedValue(buildUser());

      await expect(
        service.create({ name: 'Ada', email: 'ADA@EXAMPLE.COM' }),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(repository.findByEmail).toHaveBeenCalledWith('ada@example.com');
    });

    it('creates independent users for distinct emails', async () => {
      repository.findByEmail.mockResolvedValue(undefined);

      const first = await service.create({ name: 'Ada', email: 'ada@example.com' });
      const second = await service.create({ name: 'Alan', email: 'alan@example.com' });

      expect(first.id).not.toBe(second.id);
      expect(repository.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('list', () => {
    it('returns every user from the repository (ESC-S03)', async () => {
      const users = [buildUser(), buildUser({ id: '22222222-2222-4222-8222-222222222222' })];
      repository.findAll.mockResolvedValue(users);

      await expect(service.list()).resolves.toEqual(users);
      expect(repository.findAll).toHaveBeenCalledTimes(1);
    });

    it('returns an empty array when there are no users (CA004)', async () => {
      repository.findAll.mockResolvedValue([]);

      await expect(service.list()).resolves.toEqual([]);
    });
  });

  describe('getById', () => {
    it('returns the user when it exists (ESC-S04)', async () => {
      const user = buildUser();
      repository.findById.mockResolvedValue(user);

      await expect(service.getById(user.id)).resolves.toEqual(user);
      expect(repository.findById).toHaveBeenCalledWith(user.id);
    });

    it('throws NotFoundError when the user does not exist (ESC-S04, RN006)', async () => {
      repository.findById.mockResolvedValue(undefined);

      await expect(service.getById('missing-id')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('update', () => {
    it('applies a partial update over name and refreshes updatedAt (ESC-S05)', async () => {
      const current = buildUser();
      repository.findById.mockResolvedValue(current);

      const updated = await service.update(current.id, { name: 'Ada King' });

      expect(updated.name).toBe('Ada King');
      expect(updated.email).toBe(current.email);
      expect(updated.id).toBe(current.id);
      expect(updated.createdAt).toBe(current.createdAt);
      expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(Date.parse(current.updatedAt));
      expect(repository.save).toHaveBeenCalledWith(updated);
    });

    it('allows the owner to keep its own email (ESC-S06, RN001)', async () => {
      const current = buildUser();
      repository.findById.mockResolvedValue(current);
      repository.findByEmail.mockResolvedValue(current);

      const updated = await service.update(current.id, { email: 'ada@example.com' });

      expect(updated.email).toBe('ada@example.com');
    });

    it('throws ConflictError when the new email belongs to another user (ESC-S06, RN001)', async () => {
      const current = buildUser();
      repository.findById.mockResolvedValue(current);
      repository.findByEmail.mockResolvedValue(
        buildUser({ id: '22222222-2222-4222-8222-222222222222', email: 'alan@example.com' }),
      );

      await expect(
        service.update(current.id, { email: 'alan@example.com' }),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('normalizes the updated email to lowercase (RN003)', async () => {
      const current = buildUser();
      repository.findById.mockResolvedValue(current);
      repository.findByEmail.mockResolvedValue(undefined);

      const updated = await service.update(current.id, { email: '  NEW@Example.COM ' });

      expect(updated.email).toBe('new@example.com');
    });

    it('ignores client-supplied id/createdAt/updatedAt (ESC-S08, RN004)', async () => {
      const current = buildUser();
      repository.findById.mockResolvedValue(current);
      repository.findByEmail.mockResolvedValue(undefined);

      const updated = await service.update(current.id, {
        name: 'Ada King',
        id: 'attacker-controlled',
        createdAt: '1999-01-01T00:00:00.000Z',
        updatedAt: '1999-01-01T00:00:00.000Z',
      });

      expect(updated.id).toBe(current.id);
      expect(updated.createdAt).toBe(current.createdAt);
      expect(updated.updatedAt).not.toBe('1999-01-01T00:00:00.000Z');
    });

    it('ignores non-string fields without applying them', async () => {
      const current = buildUser();
      repository.findById.mockResolvedValue(current);

      const updated = await service.update(current.id, {
        name: 42,
        email: null,
      } as unknown as UpdateUserRequest);

      expect(updated.name).toBe(current.name);
      expect(updated.email).toBe(current.email);
      expect(repository.findByEmail).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the user does not exist (ESC-S04, RN006)', async () => {
      repository.findById.mockResolvedValue(undefined);

      await expect(service.update('missing-id', { name: 'Ada' })).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes an existing user (ESC-S07)', async () => {
      repository.delete.mockResolvedValue(true);

      await expect(service.delete('existing-id')).resolves.toBeUndefined();
      expect(repository.delete).toHaveBeenCalledWith('existing-id');
    });

    it('throws NotFoundError when the user does not exist (ESC-S07, RN006)', async () => {
      repository.delete.mockResolvedValue(false);

      await expect(service.delete('missing-id')).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
