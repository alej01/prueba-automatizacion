# 03 - Diseño técnico

## Metadata

| Campo | Valor |
|---|---|
| Feature | FEAT-0002 |
| Versión | 1.0 |
| Fecha | 2026-10-01 |

### Historial de versiones

| Versión | Fecha | Cambio | Autor |
|---|---|---|---|
| 1.0 | 2026-10-01 | Versión inicial del diseño técnico. | prepare_feature |

---

## DES001 - Estructura del proyecto (brownfield)

Se reutiliza la estructura por capas de FEAT-0001 (`rules/architecture/node.md`). Los archivos marcados `+` son nuevos y los marcados `~` son modificados de forma aditiva.

```text
src
├── app.ts                              ~  composición de usuarios + libros
├── server.ts                              bootstrap HTTP (sin cambios)
├── controllers
│   ├── userController.ts                  (sin cambios)
│   └── bookController.ts               +
├── services
│   ├── userService.ts                     (sin cambios)
│   └── bookService.ts                  +
├── repositories
│   ├── inMemoryUserRepository.ts          (sin cambios)
│   └── inMemoryBookRepository.ts       +
├── models
│   ├── user.ts                            (sin cambios)
│   ├── book.ts                         +
│   └── errors.ts                       ~  + BOOK_NOT_FOUND, ISBN_ALREADY_EXISTS
├── middleware
│   ├── errorMiddleware.ts                 (sin cambios)
│   └── notFoundMiddleware.ts              (sin cambios)
├── routes
│   ├── userRoutes.ts                      (sin cambios)
│   └── bookRoutes.ts                   +
├── validators
│   ├── validateBody.ts                 +  middleware compartido
│   ├── userValidator.ts                ~  re-exporta validateBody
│   └── bookValidator.ts                +
└── utils
    └── idGenerator.ts                     (reutilizado)

tests
├── services/bookService.test.ts                 +
├── repositories/inMemoryBookRepository.test.ts  +
├── validators/validateBody.test.ts              +
└── controllers/bookController.test.ts           +
```

## DES002 - Modelo de dominio

```typescript
export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;              // normalizado (sin guiones/espacios), único
  publishedYear: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookRequest {
  title: string;
  author: string;
  isbn: string;
  publishedYear?: number;
}

export type UpdateBookRequest = Partial<CreateBookRequest> & { [key: string]: unknown };
```

- `id` es UUID v4 generado por el servidor (`RN006`).
- `isbn` se persiste normalizado; la unicidad se evalúa sobre esa forma (`RN001`, `RN004`).
- `publishedYear` se persiste como `null` si no se envía (`RN005`).
- Fechas en ISO 8601.

## DES003 - Contrato API REST

| Método | Ruta | Request body | Éxito | Errores |
|---|---|---|---|---|
| POST | `/api/books` | `{ title, author, isbn, publishedYear? }` | `201` + `Book` | `400`, `409` |
| GET | `/api/books` | — | `200` + `Book[]` | — |
| GET | `/api/books/:id` | — | `200` + `Book` | `404` |
| PUT | `/api/books/:id` | `{ title?, author?, isbn?, publishedYear? }` | `200` + `Book` | `400`, `404`, `409` |
| DELETE | `/api/books/:id` | — | `204` sin body | `404` |

`Content-Type: application/json` en todas las respuestas con body. Las rutas de usuarios (`/api/users`) permanecen intactas (`RN010`).

## DES004 - Contrato de error uniforme (extensión de códigos)

Se conserva el contrato existente:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "details": [{ "field": "isbn", "message": "isbn must be a valid ISBN-10 or ISBN-13" }]
  }
}
```

Catálogo resultante:

| Código | HTTP | Origen |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Compartido (usuarios y libros) |
| `USER_NOT_FOUND` | 404 | Usuarios (sin cambios) |
| `EMAIL_ALREADY_EXISTS` | 409 | Usuarios (sin cambios) |
| `BOOK_NOT_FOUND` | 404 | Libros (nuevo) |
| `ISBN_ALREADY_EXISTS` | 409 | Libros (nuevo) |
| `INTERNAL_ERROR` | 500 | Compartido |

`src/models/errors.ts` se amplía: la unión `ErrorCode` incorpora los dos códigos nuevos y se añaden las clases `BookNotFoundError` y `IsbnConflictError` extendiendo `AppError` con `code`/`statusCode`. El `errorMiddleware` no requiere cambios porque ya renderiza cualquier `AppError`.

## DES005 - Estrategia de validación (Zod) y middleware compartido

- Se extrae el middleware `validateBody(schema)` (y sus helpers `toValidationError`/`toErrorDetails`) desde `userValidator.ts` a `src/validators/validateBody.ts` para evitar duplicación.
- `userValidator.ts` conserva sus esquemas y **re-exporta** `validateBody` para no romper `userRoutes.ts`.
- `bookValidator.ts` define:
  - `createBookSchema`: objeto `strict()` con `title` (trim, 1–200), `author` (trim, 1–150), `isbn` (normalizado + refine de checksum) y `publishedYear` opcional (entero 1450–año actual+1).
  - `updateBookSchema`: objeto `strict()` parcial con al menos un campo de `title`/`author`/`isbn`/`publishedYear`.
- Normalización de ISBN (`RN004`): `trim()`, eliminar espacios y guiones, convertir `x` final a `X`; luego validar ISBN-10 (9 dígitos + dígito/X, checksum mod 11) o ISBN-13 (13 dígitos, checksum mod 10).
- Ante fallo, `validateBody` propaga `ValidationError` con `details` (`{field, message}`); el middleware no responde directamente.

## DES006 - Repositorio en memoria de libros

```typescript
export interface BookRepository {
  save(book: Book): Promise<Book>;
  findById(id: string): Promise<Book | undefined>;
  findByIsbn(isbn: string): Promise<Book | undefined>; // compara ISBN normalizado (RN001)
  findAll(): Promise<Book[]>;
  delete(id: string): Promise<boolean>;
}
```

`InMemoryBookRepository` implementa la interfaz con `Map<string, Book>`; cada instancia arranca vacía (`RN008`). Los métodos devuelven `Promise` para permitir una futura persistencia real sin cambiar el servicio (coherente con `ADR004`).

## DES007 - Servicio y flujo de negocio

`BookService` depende únicamente de `BookRepository` (sin acoplamiento a Express) y aplica `RN001`–`RN008`:

- `create`: normaliza `title`/`author`/`isbn`, valida duplicado por ISBN, genera `id` UUID, setea `publishedYear` (o `null`) y `createdAt`/`updatedAt`.
- `list`: devuelve `findAll()`.
- `getById`: devuelve el libro o lanza `BookNotFoundError`.
- `update`: valida existencia, valida conflicto de ISBN excluyendo el propio `id`, aplica solo los campos permitidos y actualiza `updatedAt`.
- `delete`: elimina o lanza `BookNotFoundError`.

El controlador delega en el servicio y usa `next(error)`; no contiene lógica de negocio.

## DES008 - Estrategia de pruebas

- Jest + Supertest; archivos en `tests/`.
- Unitarias: `BookService` (repositorio mockeado), `InMemoryBookRepository` (instancia real) y `validateBody` (entrada normalizada y traducción de `ZodError`).
- Integración: `bookController` montado en una app Express vía `createApp()` con el repositorio en memoria real; cubre los cinco endpoints y el contrato de error.
- Regresión: la suite existente `tests/controllers/userController.test.ts` se ejecuta sin cambios para verificar `RN010`/`CA009`.
- Cobertura mínima: 80 % statements, 70 % branches, 80 % functions, 80 % lines (`rules/testing/node.md`).

## DES009 - Composición de la aplicación

`createApp()` en `src/app.ts` amplía el grafo existente sin alterar el de usuarios:

```text
InMemoryUserRepository -> UserService -> UserController -> userRoutes (/api/users)
InMemoryBookRepository -> BookService -> BookController -> bookRoutes (/api/books)
```

Orden de middleware preservado: `express.json()` → routers → `notFoundMiddleware` → `errorMiddleware` (último). El `notFoundMiddleware` existente sigue devolviendo el error genérico de ruta no encontrada, por lo que no se modifica.

## Impacto por capa

| Capa | Componentes | Tareas |
|---|---|---|
| Domain | `models/book.ts`, `models/errors.ts` | T001 |
| Application | `services/bookService.ts` | T003 |
| Infrastructure | `repositories/inMemoryBookRepository.ts` | T002 |
| Presentation | `controllers/bookController.ts`, `routes/bookRoutes.ts`, `app.ts` | T005, T006 |
| Cross-cutting | `validators/validateBody.ts`, `validators/bookValidator.ts`, `validators/userValidator.ts` | T004 |
| Testing | `tests/services`, `tests/repositories`, `tests/validators`, `tests/controllers` | T007, T008 |
| Documentación | `README.md` | T009 |

## Contratos y compatibilidad

- API sin versionado en ruta (`/api/books`), coherente con `/api/users`.
- Aditivo: no se renombran ni eliminan símbolos existentes; `validateBody` se re-exporta desde `userValidator`.
- Cambiar a persistencia real solo requiere una nueva implementación de `BookRepository`.

## Consideraciones de seguridad y performance

- Validación de entrada en todos los endpoints (`rules/security/owasp-baseline.md`).
- Sin datos sensibles almacenados ni registrados en logs; el `errorMiddleware` no expone stack traces.
- `findById`/`delete` en `O(1)`; `findByIsbn` en `O(n)` sobre el conjunto en memoria (aceptable para el alcance, igual que usuarios).
- Sin secretos hardcodeados; `PORT` por variable de entorno.
