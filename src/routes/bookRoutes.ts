/**
 * Book HTTP routes (DES003).
 *
 * Maps the five REST endpoints to the thin controller handlers. The router is
 * created by a factory so the controller (and therefore the service and the
 * repository) is supplied by `app.ts`, which owns the dependency composition.
 * This mirrors `createUserRoutes` so both resources expose the same delivery
 * pattern without touching the user layer (RN010).
 *
 * Write endpoints run `validateBody` before the controller, so a request body
 * is validated and normalized before any business logic sees it (DES005).
 * Success codes and error codes follow the contract in DES003.
 */
import { Router } from 'express';
import { BookController } from '../controllers/bookController';
import { createBookSchema, updateBookSchema } from '../validators/bookValidator';
import { validateBody } from '../validators/validateBody';

/** Builds the `/api/books` router bound to the given controller. */
export const createBookRoutes = (controller: BookController): Router => {
  const router = Router();

  router.post('/', validateBody(createBookSchema), controller.create);
  router.get('/', controller.list);
  router.get('/:id', controller.getById);
  router.put('/:id', validateBody(updateBookSchema), controller.update);
  router.delete('/:id', controller.delete);

  return router;
};
