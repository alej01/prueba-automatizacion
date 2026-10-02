/**
 * Unit tests for `InMemoryBookRepository` (T007, DES008).
 *
 * These tests use a real repository instance (no mock) so they verify the
 * actual `Map` semantics and the normalized ISBN lookup of RN001/RN004. They
 * map to the Infrastructure scenarios ESC-I01..ESC-I05.
 */
import { Book } from '../../src/models/book';
import { InMemoryBookRepository } from '../../src/repositories/inMemoryBookRepository';

const buildBook = (overrides: Partial<Book> = {}): Book => ({
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Refactoring',
  author: 'Martin Fowler',
  isbn: '9780132350884',
  publishedYear: 1999,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('InMemoryBookRepository', () => {
  let repository: InMemoryBookRepository;

  beforeEach(() => {
    repository = new InMemoryBookRepository();
  });

  it('starts empty for every new instance (ESC-I05, RN008)', async () => {
    await expect(repository.findAll()).resolves.toEqual([]);
    await expect(repository.findById('unknown')).resolves.toBeUndefined();
    await expect(repository.findByIsbn('9780132350884')).resolves.toBeUndefined();

    const other = new InMemoryBookRepository();
    await expect(other.findAll()).resolves.toEqual([]);
  });

  it('persists a book by id and retrieves the same object (ESC-I01)', async () => {
    const book = buildBook();

    await expect(repository.save(book)).resolves.toBe(book);
    await expect(repository.findById(book.id)).resolves.toBe(book);
  });

  it('replaces an existing record when saving the same id', async () => {
    const book = buildBook();
    await repository.save(book);

    const updated = buildBook({ title: 'Refactoring 2nd edition' });
    await repository.save(updated);

    await expect(repository.findById(book.id)).resolves.toEqual(updated);
    await expect(repository.findAll()).resolves.toHaveLength(1);
  });

  it('finds a book by ISBN ignoring hyphens and surrounding spaces (ESC-I02, RN001, RN004)', async () => {
    const book = buildBook({ isbn: '9780132350884' });
    await repository.save(book);

    await expect(repository.findByIsbn('978-0-13-235088-4')).resolves.toBe(book);
    await expect(repository.findByIsbn('  9780132350884  ')).resolves.toBe(book);
  });

  it('normalizes a trailing lowercase x when looking up an ISBN-10 (ESC-I02, RN004)', async () => {
    const book = buildBook({ isbn: '080442957X' });
    await repository.save(book);

    await expect(repository.findByIsbn('0-8044-2957-x')).resolves.toBe(book);
  });

  it('returns undefined when no book matches the ISBN (ESC-I02)', async () => {
    await repository.save(buildBook());

    await expect(repository.findByIsbn('9780134494166')).resolves.toBeUndefined();
  });

  it('returns every stored book (ESC-I03, CA004)', async () => {
    const first = buildBook();
    const second = buildBook({
      id: '22222222-2222-4222-8222-222222222222',
      isbn: '9780134494166',
    });
    await repository.save(first);
    await repository.save(second);

    const all = await repository.findAll();

    expect(all).toHaveLength(2);
    expect(all).toEqual(expect.arrayContaining([first, second]));
  });

  it('deletes a stored book and reports whether it existed (ESC-I04, CA007)', async () => {
    const book = buildBook();
    await repository.save(book);

    await expect(repository.delete(book.id)).resolves.toBe(true);
    await expect(repository.findById(book.id)).resolves.toBeUndefined();
    await expect(repository.delete(book.id)).resolves.toBe(false);
  });
});
