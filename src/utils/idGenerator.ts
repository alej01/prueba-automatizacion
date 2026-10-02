/**
 * Identifier generation utility.
 *
 * User identifiers are server-side generated UUID v4 values (RN004). Any `id`
 * supplied by a client is ignored and never persisted. Keeping generation in a
 * dedicated module lets the service depend on a narrow contract instead of the
 * `uuid` library directly, which simplifies future substitution and testing.
 */
import { v4 as uuidv4 } from 'uuid';

/** Generates a new UUID v4 identifier. */
export function generateId(): string {
  return uuidv4();
}
