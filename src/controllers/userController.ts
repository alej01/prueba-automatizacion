/**
 * User HTTP controller (DES003, DES007).
 *
 * The controller is intentionally thin: it only maps HTTP request/response
 * objects to `UserService` calls. No business rule lives here, and every
 * failure is forwarded with `next(error)` so the centralized `errorMiddleware`
 * remains the single place that renders the uniform API error contract
 * (ADR001 / ADR003).
 *
 * The `UserService` is injected through `createUserController`, keeping the
 * dependency direction inward (presentation -> application -> domain) and
 * letting `app.ts` own the concrete composition of dependencies.
 */
import { NextFunction, Request, Response } from 'express';
import { CreateUserRequest, UpdateUserRequest } from '../models/user';
import { UserService } from '../services/userService';

/** HTTP handlers exposed by the user controller. */
export interface UserController {
  create(req: Request, res: Response, next: NextFunction): Promise<void>;
  list(req: Request, res: Response, next: NextFunction): Promise<void>;
  getById(req: Request, res: Response, next: NextFunction): Promise<void>;
  update(req: Request, res: Response, next: NextFunction): Promise<void>;
  delete(req: Request, res: Response, next: NextFunction): Promise<void>;
}

/**
 * Builds the user controller bound to the given service instance.
 *
 * `req.body` is already validated and normalized by `validateBody`, so the
 * handlers can safely forward it to the service without duplicating checks.
 */
export const createUserController = (userService: UserService): UserController => ({
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.create(req.body as CreateUserRequest);
      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  },

  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await userService.list();
      res.status(200).json(users);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.getById(req.params.id);
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.update(req.params.id, req.body as UpdateUserRequest);
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await userService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
});
