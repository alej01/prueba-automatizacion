/**
 * Unit tests for `InMemoryUserRepository` (T009, DES008).
 *
 * These tests use a real repository instance (no mock) so they verify the actual
 * `Map` semantics and the case-insensitive email lookup of RN001/RN007. They map
 * to the Infrastructure scenarios ESC-I01..ESC-I05.
 */
import { User } from '../../src/models/user';
import { InMemoryUserRepository } from '../../src/repositories/inMemoryUserRepository';

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('InMemoryUserRepository', () => {
  let repository: InMemoryUserRepository;

  beforeEach(() => {
    repository = new InMemoryUserRepository();
  });

  it('starts empty for every new instance (ESC-I05, RN007)', async () => {
    await expect(repository.findAll()).resolves.toEqual([]);
    await expect(repository.findById('unknown')).resolves.toBeUndefined();
    await expect(repository.findByEmail('unknown@example.com')).resolves.toBeUndefined();

    const other = new InMemoryUserRepository();
    await expect(other.findAll()).resolves.toEqual([]);
  });

  it('persists a user by id and retrieves the same object (ESC-I01)', async () => {
    const user = buildUser();

    await expect(repository.save(user)).resolves.toBe(user);
    await expect(repository.findById(user.id)).resolves.toBe(user);
  });

  it('replaces an existing record when saving the same id', async () => {
    const user = buildUser();
    await repository.save(user);

    const updated = buildUser({ name: 'Ada King' });
    await repository.save(updated);

    await expect(repository.findById(user.id)).resolves.toEqual(updated);
    await expect(repository.findAll()).resolves.toHaveLength(1);
  });

  it('finds a user by email ignoring case and surrounding spaces (ESC-I02, RN001)', async () => {
    const user = buildUser({ email: 'ada@example.com' });
    await repository.save(user);

    await expect(repository.findByEmail('ADA@EXAMPLE.COM')).resolves.toBe(user);
    await expect(repository.findByEmail('  Ada@Example.com  ')).resolves.toBe(user);
  });

  it('returns undefined when no user matches the email (ESC-I02)', async () => {
    await repository.save(buildUser());

    await expect(repository.findByEmail('nobody@example.com')).resolves.toBeUndefined();
  });

  it('returns every stored user (ESC-I03)', async () => {
    const first = buildUser();
    const second = buildUser({ id: '22222222-2222-4222-8222-222222222222', email: 'alan@example.com' });
    await repository.save(first);
    await repository.save(second);

    const all = await repository.findAll();

    expect(all).toHaveLength(2);
    expect(all).toEqual(expect.arrayContaining([first, second]));
  });

  it('deletes a stored user and reports whether it existed (ESC-I04)', async () => {
    const user = buildUser();
    await repository.save(user);

    await expect(repository.delete(user.id)).resolves.toBe(true);
    await expect(repository.findById(user.id)).resolves.toBeUndefined();
    await expect(repository.delete(user.id)).resolves.toBe(false);
  });
});
