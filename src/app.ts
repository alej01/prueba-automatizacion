/**
 * Express application composition (DES001, DES003, DES004, DES009).
 *
 * `createApp` wires the whole dependency graph in one place:
 *
 *   InMemoryUserRepository -> UserService -> UserController -> userRoutes
 *   InMemoryBookRepository -> BookService -> BookController -> bookRoutes
 *
 * Middleware order matters and mirrors DES009:
 *   1. `express.json()` parses JSON bodies.
 *   2. `/api/users` and `/api/books` routes (with per-route Zod validation).
 *   3. `notFoundMiddleware` turns unmatched requests into a `NotFoundError`.
 *   4. `errorMiddleware` is registered LAST so it can render every forwarded
 *      error to the uniform API contract.
 *
 * `createApp` is exported as a factory so integration tests can build an app
 * with isolated in-memory repositories. The module-level `app` is the default
 * instance used by `server.ts`.
 */
import express, { Express } from 'express';
import { createBookController } from './controllers/bookController';
import { createUserController } from './controllers/userController';
import { errorMiddleware } from './middleware/errorMiddleware';
import { notFoundMiddleware } from './middleware/notFoundMiddleware';
import { InMemoryBookRepository } from './repositories/inMemoryBookRepository';
import { InMemoryUserRepository } from './repositories/inMemoryUserRepository';
import { createBookRoutes } from './routes/bookRoutes';
import { createUserRoutes } from './routes/userRoutes';
import { BookService } from './services/bookService';
import { UserService } from './services/userService';

/** Creates a fully wired Express application with its own repository instances. */
export const createApp = (): Express => {
  const app = express();

  const userRepository = new InMemoryUserRepository();
  const userService = new UserService(userRepository);
  const userController = createUserController(userService);

  const bookRepository = new InMemoryBookRepository();
  const bookService = new BookService(bookRepository);
  const bookController = createBookController(bookService);

  app.use(express.json());
  app.use('/api/users', createUserRoutes(userController));
  app.use('/api/books', createBookRoutes(bookController));
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
};

/** Default application instance consumed by the HTTP server. */
export const app = createApp();
