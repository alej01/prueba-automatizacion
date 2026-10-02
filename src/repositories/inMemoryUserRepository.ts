/**
 * In-memory user persistence.
 *
 * `UserRepository` is the storage abstraction consumed by the application
 * service, so business logic never depends on how users are stored (ADR002).
 * `InMemoryUserRepository` is the volatile `Map<string, User>` implementation
 * required by the current scope (RN007): data does not survive a process
 * restart.
 *
 * Every method returns a `Promise` so a future persistent implementation can be
 * swapped in without changing the service contract (ADR002).
 */
import { User } from '../models/user';

/** Storage-agnostic contract for user persistence. */
export interface UserRepository {
  /** Persists a user, creating it or replacing the existing record by `id`. */
  save(user: User): Promise<User>;
  /** Returns the user with the given identifier, or `undefined`. */
  findById(id: string): Promise<User | undefined>;
  /** Returns the user matching the email, comparing case-insensitively (RN001). */
  findByEmail(email: string): Promise<User | undefined>;
  /** Returns every persisted user. */
  findAll(): Promise<User[]>;
  /** Removes the user with the given identifier; `true` when it existed. */
  delete(id: string): Promise<boolean>;
}

/**
 * Volatile, `Map`-backed implementation of {@link UserRepository}.
 *
 * Each instance starts empty, which makes state lifetime explicit and keeps
 * tests isolated (RN007).
 */
export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  async save(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }

  async findById(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const normalized = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === normalized) {
        return user;
      }
    }
    return undefined;
  }

  async findAll(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async delete(id: string): Promise<boolean> {
    return this.users.delete(id);
  }
}
