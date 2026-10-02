/**
 * User HTTP routes (DES003).
 *
 * Maps the five REST endpoints to the thin controller handlers. The router is
 * created by a factory so the controller (and therefore the service and the
 * repository) is supplied by `app.ts`, which owns the dependency composition.
 *
 * Write endpoints run `validateBody` before the controller, so a request body
 * is validated and normalized before any business logic sees it (DES005).
 */
import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { createUserSchema, updateUserSchema, validateBody } from '../validators/userValidator';

/** Builds the `/api/users` router bound to the given controller. */
export const createUserRoutes = (controller: UserController): Router => {
  const router = Router();

  router.post('/', validateBody(createUserSchema), controller.create);
  router.get('/', controller.list);
  router.get('/:id', controller.getById);
  router.put('/:id', validateBody(updateUserSchema), controller.update);
  router.delete('/:id', controller.delete);

  return router;
};
