/**
 * Book application service.
 *
 * `BookService` holds the pure business rules for the book CRUD (DES007) and
 * depends only on the `BookRepository` abstraction. It has no knowledge of HTTP,
 * Express or request/response objects, so the same logic can be reused by any
 * delivery mechanism and unit-tested with a mocked repository (ADR002/ADR004).
 *
 * Business rules applied here:
 * - RN001: ISBN uniqueness, compared over the normalized form; a conflict is
 *   raised unless the ISBN belongs to the very book being updated.
 * - RN002/RN003: `title` and `author` are normalized with `trim` before persist.
 * - RN004: `isbn` is normalized (spaces/hyphens removed, trailing `x` -> `X`)
 *   before it is persisted, so uniqueness is evaluated over that canonical form.
 * - RN005: `publishedYear` defaults to `null` when the client omits it.
 * - RN006: `id`, `createdAt` and `updatedAt` are always server-controlled;
 *   client supplied values are ignored.
 * - RN007: operations on a missing book raise `BookNotFoundError`.
 *
 * Payload shape/format validation (RN002, RN003, RN004) lives in the HTTP
 * validation middleware; this service only enforces business invariants.
 */
import { Book, CreateBookRequest, UpdateBookRequest } from '../models/book';
import { BookNotFoundError, IsbnConflictError } from '../models/errors';
import { BookRepository } from '../repositories/inMemoryBookRepository';
import { generateId } from '../utils/idGenerator';

export class BookService {
  constructor(private readonly bookRepository: BookRepository) {}

  /**
   * Creates a book, rejecting an already registered ISBN (RN001, CA001, CA002).
   */
  async create(request: CreateBookRequest): Promise<Book> {
    const isbn = this.normalizeIsbn(request.isbn);

    const existing = await this.bookRepository.findByIsbn(isbn);
    if (existing) {
      throw new IsbnConflictError();
    }

    const now = new Date().toISOString();
    const book: Book = {
      id: generateId(),
      title: request.title.trim(),
      author: request.author.trim(),
      isbn,
      publishedYear: typeof request.publishedYear === 'number' ? request.publishedYear : null,
      createdAt: now,
      updatedAt: now,
    };

    return this.bookRepository.save(book);
  }

  /** Returns every registered book (CA004). */
  async list(): Promise<Book[]> {
    return this.bookRepository.findAll();
  }

  /** Returns a book by id or raises `BookNotFoundError` (RN007, CA005). */
  async getById(id: string): Promise<Book> {
    const book = await this.bookRepository.findById(id);
    if (!book) {
      throw new BookNotFoundError();
    }
    return book;
  }

  /**
   * Applies a partial update over `title`, `author`, `isbn` and/or
   * `publishedYear` (RN009, CA006).
   *
   * Only the allowed fields are applied, so any client supplied `id`,
   * `createdAt` or `updatedAt` is ignored (RN006). When the ISBN changes, it is
   * checked against every other book, allowing the owner to keep its own ISBN
   * (RN001).
   */
  async update(id: string, request: UpdateBookRequest): Promise<Book> {
    const current = await this.bookRepository.findById(id);
    if (!current) {
      throw new BookNotFoundError();
    }

    const updated: Book = { ...current };

    if (typeof request.title === 'string') {
      updated.title = request.title.trim();
    }

    if (typeof request.author === 'string') {
      updated.author = request.author.trim();
    }

    if (typeof request.isbn === 'string') {
      const isbn = this.normalizeIsbn(request.isbn);
      const owner = await this.bookRepository.findByIsbn(isbn);
      if (owner && owner.id !== id) {
        throw new IsbnConflictError();
      }
      updated.isbn = isbn;
    }

    if (typeof request.publishedYear === 'number') {
      updated.publishedYear = request.publishedYear;
    }

    updated.id = current.id;
    updated.createdAt = current.createdAt;
    updated.updatedAt = new Date().toISOString();

    return this.bookRepository.save(updated);
  }

  /** Deletes a book or raises `BookNotFoundError` (RN007, CA007). */
  async delete(id: string): Promise<void> {
    const deleted = await this.bookRepository.delete(id);
    if (!deleted) {
      throw new BookNotFoundError();
    }
  }

  /**
   * Normalizes an ISBN to its canonical persisted form (RN004, ADR005):
   * surrounds trimmed, inner spaces and hyphens removed and a trailing
   * lowercase `x` converted to `X`.
   */
  private normalizeIsbn(isbn: string): string {
    return isbn.trim().replace(/[\s-]/g, '').replace(/x$/, 'X');
  }
}
