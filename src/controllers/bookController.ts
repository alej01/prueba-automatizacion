/**
 * Book HTTP controller (DES003, DES007).
 *
 * The controller is intentionally thin: it only maps HTTP request/response
 * objects to `BookService` calls. No business rule lives here, and every
 * failure is forwarded with `next(error)` so the centralized `errorMiddleware`
 * remains the single place that renders the uniform API error contract
 * (ADR001 / ADR002).
 *
 * The `BookService` is injected through `createBookController`, keeping the
 * dependency direction inward (presentation -> application -> domain) and
 * letting `app.ts` own the concrete composition of dependencies. This mirrors
 * the existing `createUserController` so both resources follow the same
 * delivery pattern without touching the user layer (RN010).
 */
import { NextFunction, Request, Response } from 'express';
import { CreateBookRequest, UpdateBookRequest } from '../models/book';
import { BookService } from '../services/bookService';

/** HTTP handlers exposed by the book controller. */
export interface BookController {
  create(req: Request, res: Response, next: NextFunction): Promise<void>;
  list(req: Request, res: Response, next: NextFunction): Promise<void>;
  getById(req: Request, res: Response, next: NextFunction): Promise<void>;
  update(req: Request, res: Response, next: NextFunction): Promise<void>;
  delete(req: Request, res: Response, next: NextFunction): Promise<void>;
}

/**
 * Builds the book controller bound to the given service instance.
 *
 * `req.body` is already validated and normalized by `validateBody`, so the
 * handlers can safely forward it to the service without duplicating checks.
 */
export const createBookController = (bookService: BookService): BookController => ({
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const book = await bookService.create(req.body as CreateBookRequest);
      res.status(201).json(book);
    } catch (error) {
      next(error);
    }
  },

  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const books = await bookService.list();
      res.status(200).json(books);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const book = await bookService.getById(req.params.id);
      res.status(200).json(book);
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const book = await bookService.update(req.params.id, req.body as UpdateBookRequest);
      res.status(200).json(book);
    } catch (error) {
      next(error);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await bookService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
});
