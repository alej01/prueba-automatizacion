/**
 * Reservation HTTP routes (DES003).
 *
 * Maps the four reservation endpoints to the thin controller handlers. The
 * router is created by a factory so the controller (and therefore the service
 * and the repositories) is supplied by `app.ts`, which owns the dependency
 * composition. This mirrors `createUserRoutes`/`createBookRoutes` so all
 * resources expose the same delivery pattern without touching the user or book
 * layer (RN010).
 *
 * Write endpoints run `validateBody` before the controller, and the list
 * endpoint runs `validateQuery` over `req.query` so the optional `userId` filter
 * is validated as a UUID v4 before any business logic sees it (DES005, RN007).
 * Success codes and error codes follow the contract in DES003.
 */
import { Router } from 'express';
import { ReservationController } from '../controllers/reservationController';
import {
  createReservationSchema,
  reservationListQuerySchema,
  validateQuery,
} from '../validators/reservationValidator';
import { validateBody } from '../validators/validateBody';

/** Builds the `/api/reservations` router bound to the given controller. */
export const createReservationRoutes = (controller: ReservationController): Router => {
  const router = Router();

  router.post('/', validateBody(createReservationSchema), controller.create);
  router.get('/', validateQuery(reservationListQuerySchema), controller.list);
  router.get('/:id', controller.getById);
  router.delete('/:id', controller.release);

  return router;
};
