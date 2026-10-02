/**
 * Express application composition (DES001, DES003, DES004).
 *
 * `createApp` wires the whole dependency graph in one place:
 *
 *   InMemoryUserRepository -> UserService -> UserController -> userRoutes
 *
 * Middleware order matters and mirrors DES001:
 *   1. `express.json()` parses JSON bodies.
 *   2. `/api/users` routes (with per-route Zod validation).
 *   3. `notFoundMiddleware` turns unmatched requests into a `NotFoundError`.
 *   4. `errorMiddleware` is registered LAST so it can render every forwarded
 *      error to the uniform API contract.
 *
 * `createApp` is exported as a factory so integration tests can build an app
 * with an isolated in-memory repository. The module-level `app` is the default
 * instance used by `server.ts`.
 */
import express, { Express } from 'express';
import { createUserController } from './controllers/userController';
import { errorMiddleware } from './middleware/errorMiddleware';
import { notFoundMiddleware } from './middleware/notFoundMiddleware';
import { InMemoryUserRepository } from './repositories/inMemoryUserRepository';
import { createUserRoutes } from './routes/userRoutes';
import { UserService } from './services/userService';

/** Creates a fully wired Express application with its own repository instance. */
export const createApp = (): Express => {
  const app = express();

  const userRepository = new InMemoryUserRepository();
  const userService = new UserService(userRepository);
  const userController = createUserController(userService);

  app.use(express.json());
  app.use('/api/users', createUserRoutes(userController));
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
};

/** Default application instance consumed by the HTTP server. */
export const app = createApp();
