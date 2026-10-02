/**
 * User application service.
 *
 * `UserService` holds the pure business rules for the user CRUD (DES007) and
 * depends only on the `UserRepository` abstraction. It has no knowledge of HTTP,
 * Express or request/response objects, so the same logic can be reused by any
 * delivery mechanism and unit-tested with a mocked repository (ADR002/ADR003).
 *
 * Business rules applied here:
 * - RN001: email uniqueness, compared case-insensitively; a conflict is raised
 *   unless the email belongs to the very user being updated.
 * - RN004: `id`, `createdAt` and `updatedAt` are always server-controlled;
 *   client supplied values are ignored.
 * - RN006: operations on a missing user raise `NotFoundError`.
 *
 * Payload shape/format validation (RN002, RN003, RN005) lives in the HTTP
 * validation middleware; this service only enforces business invariants.
 */
import { ConflictError, NotFoundError } from '../models/errors';
import { CreateUserRequest, UpdateUserRequest, User } from '../models/user';
import { UserRepository } from '../repositories/inMemoryUserRepository';
import { generateId } from '../utils/idGenerator';

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Creates a user, rejecting an already registered email (RN001, CA001, CA002).
   */
  async create(request: CreateUserRequest): Promise<User> {
    const email = this.normalizeEmail(request.email);

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new ConflictError();
    }

    const now = new Date().toISOString();
    const user: User = {
      id: generateId(),
      name: request.name.trim(),
      email,
      createdAt: now,
      updatedAt: now,
    };

    return this.userRepository.save(user);
  }

  /** Returns every registered user (CA004). */
  async list(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  /** Returns a user by id or raises `NotFoundError` (RN006, CA005). */
  async getById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError();
    }
    return user;
  }

  /**
   * Applies a partial update over `name` and/or `email` (RN005, CA006).
   *
   * Only the allowed fields are applied, so any client supplied `id`,
   * `createdAt` or `updatedAt` is ignored (RN004). When the email changes, it is
   * checked against every other user, allowing the owner to keep its own email
   * (RN001).
   */
  async update(id: string, request: UpdateUserRequest): Promise<User> {
    const current = await this.userRepository.findById(id);
    if (!current) {
      throw new NotFoundError();
    }

    const updated: User = { ...current };

    if (typeof request.name === 'string') {
      updated.name = request.name.trim();
    }

    if (typeof request.email === 'string') {
      const email = this.normalizeEmail(request.email);
      const owner = await this.userRepository.findByEmail(email);
      if (owner && owner.id !== id) {
        throw new ConflictError();
      }
      updated.email = email;
    }

    updated.id = current.id;
    updated.createdAt = current.createdAt;
    updated.updatedAt = new Date().toISOString();

    return this.userRepository.save(updated);
  }

  /** Deletes a user or raises `NotFoundError` (RN006, CA007). */
  async delete(id: string): Promise<void> {
    const deleted = await this.userRepository.delete(id);
    if (!deleted) {
      throw new NotFoundError();
    }
  }

  /** Normalizes an email to its canonical lowercase form (RN001, RN003). */
  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
