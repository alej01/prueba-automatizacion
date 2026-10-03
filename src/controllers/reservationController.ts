/**
 * Reservation HTTP controller (DES003, DES007).
 *
 * The controller is intentionally thin: it only maps HTTP request/response
 * objects to `ReservationService` calls. No business rule lives here, and every
 * failure is forwarded with `next(error)` so the centralized `errorMiddleware`
 * remains the single place that renders the uniform API error contract
 * (ADR002 / ADR004).
 *
 * The `ReservationService` is injected through `createReservationController`,
 * keeping the dependency direction inward (presentation -> application ->
 * domain) and letting `app.ts` own the concrete composition of dependencies.
 * This mirrors `createUserController`/`createBookController` so all resources
 * follow the same delivery pattern without touching the user or book layer
 * (RN010).
 *
 * Success codes follow DES003: `POST` -> 201, list/get/release -> 200. Unlike
 * the user/book `DELETE`, releasing a reservation returns the `RELEASED`
 * resource with 200 instead of 204 (ADR003).
 */
import { NextFunction, Request, Response } from 'express';
import { CreateReservationRequest } from '../models/reservation';
import { ReservationService } from '../services/reservationService';

/** HTTP handlers exposed by the reservation controller. */
export interface ReservationController {
  create(req: Request, res: Response, next: NextFunction): Promise<void>;
  list(req: Request, res: Response, next: NextFunction): Promise<void>;
  getById(req: Request, res: Response, next: NextFunction): Promise<void>;
  release(req: Request, res: Response, next: NextFunction): Promise<void>;
}

/**
 * Builds the reservation controller bound to the given service instance.
 *
 * `req.body` and `req.query` are already validated and normalized by
 * `validateBody`/`validateQuery`, so the handlers can safely forward them to
 * the service without duplicating checks.
 */
export const createReservationController = (
  reservationService: ReservationService,
): ReservationController => ({
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reservation = await reservationService.create(
        req.body as CreateReservationRequest,
      );
      res.status(201).json(reservation);
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.query.userId as string | undefined;
      const reservations = await reservationService.list(userId);
      res.status(200).json(reservations);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reservation = await reservationService.getById(req.params.id);
      res.status(200).json(reservation);
    } catch (error) {
      next(error);
    }
  },

  async release(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reservation = await reservationService.release(req.params.id);
      res.status(200).json(reservation);
    } catch (error) {
      next(error);
    }
  },
});
