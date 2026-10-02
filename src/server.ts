/**
 * HTTP server bootstrap (DES001).
 *
 * Reads `PORT` from the environment (no hardcoded secret, ADR004 / security
 * baseline) and starts listening with the wired Express application. Falls back
 * to 3000 for local development.
 */
import { app } from './app';

/** Fallback port used when `PORT` is not defined in the environment. */
const DEFAULT_PORT = 3000;

const port = Number(process.env.PORT ?? DEFAULT_PORT);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
