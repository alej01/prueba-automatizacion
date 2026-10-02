/**
 * Unit tests for `BookService` (T007, DES008).
 *
 * The repository is mocked on purpose: these tests verify the business rules in
 * isolation (RN001, RN002, RN003, RN004, RN005, RN006, RN007) without depending
 * on `Map` semantics. They map to the Application scenarios ESC-S01..ESC-S09.
 */
import { Book, UpdateBookRequest } from '../../src/models/book';
import { BookNotFoundError, IsbnConflictError } from '../../src/models/errors';
import { BookRepository } from '../../src/repositories/inMemoryBookRepository';
import { BookService } from '../../src/services/bookService';

/** Matches a canonical UUID v4 (RN006). */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

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

const createRepositoryMock = (): jest.Mocked<BookRepository> => ({
  save: jest.fn(),
  findById: jest.fn(),
  findByIsbn: jest.fn(),
  findAll: jest.fn(),
  delete: jest.fn(),
});

describe('BookService', () => {
  let repository: jest.Mocked<BookRepository>;
  let service: BookService;

  beforeEach(() => {
    repository = createRepositoryMock();
    repository.save.mockImplementation(async (book: Book) => book);
    service = new BookService(repository);
  });

  describe('create', () => {
    it('creates a book with a server-generated UUID and ISO timestamps (ESC-S01, RN006)', async () => {
      repository.findByIsbn.mockResolvedValue(undefined);

      const created = await service.create({
        title: 'Refactoring',
        author: 'Martin Fowler',
        isbn: '9780132350884',
      });

      expect(created.id).toMatch(UUID_V4);
      expect(created.title).toBe('Refactoring');
      expect(created.author).toBe('Martin Fowler');
      expect(created.isbn).toBe('9780132350884');
      expect(created.createdAt).toMatch(ISO_8601);
      expect(created.updatedAt).toBe(created.createdAt);
      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(repository.save).toHaveBeenCalledWith(created);
    });

    it('normalizes title, author and isbn before persisting (ESC-S02, RN002-RN004)', async () => {
      repository.findByIsbn.mockResolvedValue(undefined);

      const created = await service.create({
        title: '  Refactoring  ',
        author: '  Martin Fowler  ',
        isbn: ' 978-0-13-235088-4 ',
      });

      expect(created.title).toBe('Refactoring');
      expect(created.author).toBe('Martin Fowler');
      expect(created.isbn).toBe('9780132350884');
      expect(repository.findByIsbn).toHaveBeenCalledWith('9780132350884');
      expect(repository.save.mock.calls[0][0].isbn).toBe('9780132350884');
    });

    it('stores null when publishedYear is omitted (ESC-S04, RN005)', async () => {
      repository.findByIsbn.mockResolvedValue(undefined);

      const created = await service.create({
        title: 'Refactoring',
        author: 'Martin Fowler',
        isbn: '9780132350884',
      });

      expect(created.publishedYear).toBeNull();
    });

    it('stores the provided publishedYear', async () => {
      repository.findByIsbn.mockResolvedValue(undefined);

      const created = await service.create({
        title: 'Refactoring',
        author: 'Martin Fowler',
        isbn: '9780132350884',
        publishedYear: 1999,
      });

      expect(created.publishedYear).toBe(1999);
    });

    it('throws IsbnConflictError when the ISBN is already registered (ESC-S03, RN001)', async () => {
      repository.findByIsbn.mockResolvedValue(buildBook());

      await expect(
        service.create({ title: 'Clean Code', author: 'Robert C. Martin', isbn: '9780132350884' }),
      ).rejects.toBeInstanceOf(IsbnConflictError);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('detects duplicates regardless of the ISBN formatting (RN001, RN004)', async () => {
      repository.findByIsbn.mockResolvedValue(buildBook());

      await expect(
        service.create({
          title: 'Clean Code',
          author: 'Robert C. Martin',
          isbn: '978-0-13-235088-4',
        }),
      ).rejects.toBeInstanceOf(IsbnConflictError);
      expect(repository.findByIsbn).toHaveBeenCalledWith('9780132350884');
    });

    it('creates independent books for distinct ISBNs', async () => {
      repository.findByIsbn.mockResolvedValue(undefined);

      const first = await service.create({
        title: 'Refactoring',
        author: 'Martin Fowler',
        isbn: '9780132350884',
      });
      const second = await service.create({
        title: 'Clean Code',
        author: 'Robert C. Martin',
        isbn: '9780134494166',
      });

      expect(first).not.toBe(second);
      expect(repository.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('list', () => {
    it('returns every book from the repository (ESC-S05, CA004)', async () => {
      const books = [buildBook(), buildBook({ id: '22222222-2222-4222-8222-222222222222' })];
      repository.findAll.mockResolvedValue(books);

      await expect(service.list()).resolves.toEqual(books);
      expect(repository.findAll).toHaveBeenCalledTimes(1);
    });

    it('returns an empty array when there are no books (ESC-S05, CA004)', async () => {
      repository.findAll.mockResolvedValue([]);

      await expect(service.list()).resolves.toEqual([]);
    });
  });

  describe('getById', () => {
    it('returns the book when it exists (ESC-S06, CA005)', async () => {
      const book = buildBook();
      repository.findById.mockResolvedValue(book);

      await expect(service.getById(book.id)).resolves.toEqual(book);
      expect(repository.findById).toHaveBeenCalledWith(book.id);
    });

    it('throws BookNotFoundError when the book does not exist (ESC-S06, RN007)', async () => {
      repository.findById.mockResolvedValue(undefined);

      await expect(service.getById('missing-id')).rejects.toBeInstanceOf(BookNotFoundError);
    });
  });

  describe('update', () => {
    it('applies a partial update over title and refreshes updatedAt (ESC-S07, CA006)', async () => {
      const current = buildBook();
      repository.findById.mockResolvedValue(current);

      const updated = await service.update(current.id, { title: 'Refactoring 2nd edition' });

      expect(updated.title).toBe('Refactoring 2nd edition');
      expect(updated.author).toBe(current.author);
      expect(updated.isbn).toBe(current.isbn);
      expect(updated.publishedYear).toBe(current.publishedYear);
      expect(updated.id).toBe(current.id);
      expect(updated.createdAt).toBe(current.createdAt);
      expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(Date.parse(current.updatedAt));
      expect(repository.save).toHaveBeenCalledWith(updated);
    });

    it('trims the updated title and author (RN002, RN003)', async () => {
      const current = buildBook();
      repository.findById.mockResolvedValue(current);

      const updated = await service.update(current.id, {
        title: '  Clean Code  ',
        author: '  Robert C. Martin  ',
      });

      expect(updated.title).toBe('Clean Code');
      expect(updated.author).toBe('Robert C. Martin');
    });

    it('applies a new publishedYear', async () => {
      const current = buildBook();
      repository.findById.mockResolvedValue(current);

      const updated = await service.update(current.id, { publishedYear: 2008 });

      expect(updated.publishedYear).toBe(2008);
    });

    it('allows the owner to keep its own ISBN (ESC-S08, RN001)', async () => {
      const current = buildBook();
      repository.findById.mockResolvedValue(current);
      repository.findByIsbn.mockResolvedValue(current);

      const updated = await service.update(current.id, { isbn: '9780132350884' });

      expect(updated.isbn).toBe('9780132350884');
    });

    it('normalizes the updated ISBN before persisting (RN004)', async () => {
      const current = buildBook();
      repository.findById.mockResolvedValue(current);
      repository.findByIsbn.mockResolvedValue(undefined);

      const updated = await service.update(current.id, { isbn: '0-8044-2957-x' });

      expect(updated.isbn).toBe('080442957X');
      expect(repository.findByIsbn).toHaveBeenCalledWith('080442957X');
    });

    it('throws IsbnConflictError when the new ISBN belongs to another book (ESC-S08, RN001)', async () => {
      const current = buildBook();
      repository.findById.mockResolvedValue(current);
      repository.findByIsbn.mockResolvedValue(
        buildBook({ id: '22222222-2222-4222-8222-222222222222', isbn: '9780134494166' }),
      );

      await expect(service.update(current.id, { isbn: '9780134494166' })).rejects.toBeInstanceOf(
        IsbnConflictError,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('ignores client-supplied id/createdAt/updatedAt (RN006)', async () => {
      const current = buildBook();
      repository.findById.mockResolvedValue(current);

      const updated = await service.update(current.id, {
        title: 'Clean Code',
        id: 'attacker-controlled',
        createdAt: '1999-01-01T00:00:00.000Z',
        updatedAt: '1999-01-01T00:00:00.000Z',
      } as UpdateBookRequest);

      expect(updated.id).toBe(current.id);
      expect(updated.createdAt).toBe(current.createdAt);
      expect(updated.updatedAt).not.toBe('1999-01-01T00:00:00.000Z');
    });

    it('ignores non-applicable field types without applying them', async () => {
      const current = buildBook();
      repository.findById.mockResolvedValue(current);

      const updated = await service.update(current.id, {
        title: 42,
        author: null,
        publishedYear: '1999',
      } as unknown as UpdateBookRequest);

      expect(updated.title).toBe(current.title);
      expect(updated.author).toBe(current.author);
      expect(updated.publishedYear).toBe(current.publishedYear);
      expect(repository.findByIsbn).not.toHaveBeenCalled();
    });

    it('throws BookNotFoundError when the book does not exist (ESC-S06, RN007)', async () => {
      repository.findById.mockResolvedValue(undefined);

      await expect(service.update('missing-id', { title: 'Clean Code' })).rejects.toBeInstanceOf(
        BookNotFoundError,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes an existing book (ESC-S09, CA007)', async () => {
      repository.delete.mockResolvedValue(true);

      await expect(service.delete('existing-id')).resolves.toBeUndefined();
      expect(repository.delete).toHaveBeenCalledWith('existing-id');
    });

    it('throws BookNotFoundError when the book does not exist (ESC-S09, RN007)', async () => {
      repository.delete.mockResolvedValue(false);

      await expect(service.delete('missing-id')).rejects.toBeInstanceOf(BookNotFoundError);
    });
  });
});
