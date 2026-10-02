/**
 * In-memory book persistence.
 *
 * `BookRepository` is the storage abstraction consumed by the application
 * service, so business logic never depends on how books are stored (ADR004).
 * `InMemoryBookRepository` is the volatile `Map<string, Book>` implementation
 * required by the current scope (RN008): data does not survive a process
 * restart.
 *
 * Every method returns a `Promise` so a future persistent implementation can be
 * swapped in without changing the service contract (ADR004).
 */
import { Book } from '../models/book';

/**
 * Normalizes an ISBN the same way it is persisted: surrounds trimmed, inner
 * spaces and hyphens removed and a trailing lowercase `x` converted to `X`
 * (RN004 / ADR005). Uniqueness is evaluated over this canonical form (RN001).
 */
function normalizeIsbn(isbn: string): string {
  return isbn.trim().replace(/[\s-]/g, '').replace(/x$/, 'X');
}

/** Storage-agnostic contract for book persistence. */
export interface BookRepository {
  /** Persists a book, creating it or replacing the existing record by `id`. */
  save(book: Book): Promise<Book>;
  /** Returns the book with the given identifier, or `undefined`. */
  findById(id: string): Promise<Book | undefined>;
  /** Returns the book matching the ISBN, comparing normalized ISBN (RN001). */
  findByIsbn(isbn: string): Promise<Book | undefined>;
  /** Returns every persisted book. */
  findAll(): Promise<Book[]>;
  /** Removes the book with the given identifier; `true` when it existed. */
  delete(id: string): Promise<boolean>;
}

/**
 * Volatile, `Map`-backed implementation of {@link BookRepository}.
 *
 * Each instance starts empty, which makes state lifetime explicit and keeps
 * tests isolated (RN008).
 */
export class InMemoryBookRepository implements BookRepository {
  private readonly books = new Map<string, Book>();

  async save(book: Book): Promise<Book> {
    this.books.set(book.id, book);
    return book;
  }

  async findById(id: string): Promise<Book | undefined> {
    return this.books.get(id);
  }

  async findByIsbn(isbn: string): Promise<Book | undefined> {
    const normalized = normalizeIsbn(isbn);
    for (const book of this.books.values()) {
      if (book.isbn === normalized) {
        return book;
      }
    }
    return undefined;
  }

  async findAll(): Promise<Book[]> {
    return Array.from(this.books.values());
  }

  async delete(id: string): Promise<boolean> {
    return this.books.delete(id);
  }
}
