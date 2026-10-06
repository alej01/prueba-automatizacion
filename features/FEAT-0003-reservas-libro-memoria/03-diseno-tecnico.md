# 03 - Diseño técnico

## Metadata

| Campo | Valor |
|---|---|
| Feature | FEAT-0003 |
| Versión | 1.0 |
| Fecha | 2026-10-02 |

### Historial de versiones

| Versión | Fecha | Cambio | Autor |
|---|---|---|---|
| 1.0 | 2026-10-02 | Versión inicial del diseño técnico. | prepare_feature |

---

## DES001 - Estructura del proyecto (brownfield)

Se reutiliza la estructura por capas de FEAT-0001/FEAT-0002 (`rules/architecture/node.md`). Los archivos marcados `+` son nuevos y los marcados `~` son modificados de forma aditiva.

```text
src
├── app.ts                                  ~  composición de usuarios + libros + reservas
├── server.ts                                  bootstrap HTTP (sin cambios)
├── controllers
│   ├── userController.ts                      (sin cambios)
│   ├── bookController.ts                      (sin cambios)
│   └── reservationController.ts            +
├── services
│   ├── userService.ts                         (sin cambios)
│   ├── bookService.ts                         (sin cambios)
│   └── reservationService.ts               +
├── repositories
│   ├── inMemoryUserRepository.ts              (sin cambios)
│   ├── inMemoryBookRepository.ts              (sin cambios)
│   └── inMemoryReservationRepository.ts    +
├── models
│   ├── user.ts                                (sin cambios)
│   ├── book.ts                                (sin cambios)
│   ├── reservation.ts                      +
│   └── errors.ts                           ~  + RESERVATION_NOT_FOUND, RESERVATION_CONFLICT, BOOK_ALREADY_RESERVED
├── middleware
│   ├── errorMiddleware.ts                     (sin cambios)
│   └── notFoundMiddleware.ts                  (sin cambios)
├── routes
│   ├── userRoutes.ts                          (sin cambios)
│   ├── bookRoutes.ts                          (sin cambios)
│   └── reservationRoutes.ts                +
├── validators
│   ├── validateBody.ts                        (reutilizado)
│   ├── userValidator.ts                       (sin cambios)
│   ├── bookValidator.ts                       (sin cambios)
│   └── reservationValidator.ts            +
└── utils
    └── idGenerator.ts                         (reutilizado)

tests
├── services/reservationService.test.ts                    +
├── repositories/inMemoryReservationRepository.test.ts      +
└── controllers/reservationController.test.ts               +
```

## DES002 - Modelo de dominio

```typescript
export type ReservationStatus = 'ACTIVE' | 'RELEASED';

export interface Reservation {
  id: string;
  userId: string;
  bookId: string;
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReservationRequest {
  userId: string;
  bookId: string;
}
```

- `id` es UUID v4 generado por el servidor (`RN004`).
- `userId` y `bookId` referencian entidades existentes; se validan como UUID v4 en la entrada (`RN001`, `RN009`).
- `status` comienza en `ACTIVE` y pasa a `RELEASED` al liberar (`RN002`, `RN005`).
- Fechas en ISO 8601 (`RN004`).

## DES003 - Contrato API REST

| Método | Ruta | Request | Éxito | Errores |
|---|---|---|---|---|
| POST | `/api/reservations` | body `{ userId, bookId }` | `201` + `Reservation` | `400`, `404`, `409` |
| GET | `/api/reservations` | query opcional `userId` | `200` + `Reservation[]` | `400`, `404` |
| GET | `/api/reservations/:id` | — | `200` + `Reservation` | `404` |
| DELETE | `/api/reservations/:id` | — | `200` + `Reservation` (`RELEASED`) | `404`, `409` |

`Content-Type: application/json` en todas las respuestas con body. Las rutas de usuarios (`/api/users`) y libros (`/api/books`) permanecen intactas (`RN010`).

Nota: `DELETE` devuelve `200` con la reserva liberada (no `204`), porque el recurso sigue existiendo en estado `RELEASED` (`ADR003`). Esto difiere del `DELETE` de usuarios/libros, que eliminan físicamente y responden `204`; la diferencia es intencional y trazable a `SUP004`.

## DES004 - Contrato de error uniforme (extensión de códigos)

Se conserva el contrato existente:

```json
{
  "error": {
    "code": "RESERVATION_CONFLICT",
    "message": "Reservation already exists for this user and book"
  }
}
```

Catálogo resultante:

| Código | HTTP | Origen |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Compartido (usuarios, libros, reservas) |
| `USER_NOT_FOUND` | 404 | Usuarios (sin cambios) |
| `EMAIL_ALREADY_EXISTS` | 409 | Usuarios (sin cambios) |
| `BOOK_NOT_FOUND` | 404 | Libros (sin cambios) |
| `ISBN_ALREADY_EXISTS` | 409 | Libros (sin cambios) |
| `RESERVATION_NOT_FOUND` | 404 | Reservas (nuevo) |
| `RESERVATION_CONFLICT` | 409 | Reservas (nuevo) |
| `BOOK_ALREADY_RESERVED` | 409 | Reservas (nuevo) |
| `INTERNAL_ERROR` | 500 | Compartido |

`src/models/errors.ts` se amplía: la unión `ErrorCode` incorpora los tres códigos nuevos y se añaden las clases `ReservationNotFoundError` (404), `ReservationConflictError` (409) y `BookAlreadyReservedError` (409) extendiendo `AppError` con `code`/`statusCode`. El `errorMiddleware` no requiere cambios porque ya renderiza cualquier `AppError`.

## DES005 - Estrategia de validación (Zod)

`reservationValidator.ts` define:

- `createReservationSchema`: objeto `strict()` con `userId` y `bookId` obligatorios, cada uno validado como UUID v4 (regex canónico). Rechaza campos desconocidos con `400`.
- `reservationListQuerySchema`: objeto `strict()` con `userId` opcional validado como UUID v4, usado para validar el query param del listado (`RN007`).

Ante fallo, `validateBody` propaga `ValidationError` con `details` (`{field, message}`); el middleware no responde directamente (`ADR004`).

Para el query param se aplica el mismo middleware `validateBody` sobre `req.query` mediante un pequeño adaptador en las rutas de listado, o bien una función de validación dedicada que reutiliza `toValidationError`/`toErrorDetails`; el diseño elegido es reutilizar `validateBody` aplicándolo al objeto `{ ...req.query }` antes del controlador, manteniendo un único punto de traducción de `ZodError`.

## DES006 - Repositorio en memoria de reservas

```typescript
export interface ReservationRepository {
  save(reservation: Reservation): Promise<Reservation>;
  findById(id: string): Promise<Reservation | undefined>;
  findAll(): Promise<Reservation[]>;
  findActiveByBook(bookId: string): Promise<Reservation | undefined>; // status ACTIVE, RN002
  findActiveByUserAndBook(userId: string, bookId: string): Promise<Reservation | undefined>; // RN003
  findByUser(userId: string): Promise<Reservation[]>; // RN007
}
```

`InMemoryReservationRepository` implementa la interfaz con `Map<string, Reservation>`; cada instancia arranca vacía (`RN008`). Los métodos devuelven `Promise` para permitir una futura persistencia real sin cambiar el servicio (coherente con `ADR002`).

Las búsquedas `findActiveByBook`, `findActiveByUserAndBook` y `findByUser` son `O(n)` sobre el conjunto en memoria (aceptable para el alcance); `findById` es `O(1)`.

## DES007 - Servicio y flujo de negocio

`ReservationService` depende de `ReservationRepository`, `UserRepository` y `BookRepository` (sin acoplamiento a Express) y aplica `RN001`–`RN008`:

- `create({ userId, bookId })`: verifica existencia de usuario (`UserRepository.findById` → `NotFoundError`) y de libro (`BookRepository.findById` → `BookNotFoundError`); verifica que el libro no tenga reserva activa (`findActiveByBook` → `BookAlreadyReservedError`, `RN002`); verifica que el par usuario+libro no tenga reserva activa (`findActiveByUserAndBook` → `ReservationConflictError`, `RN003`); genera `id` UUID v4, fija `status` `ACTIVE` y `createdAt`/`updatedAt`.
- `list(userId?)`: sin filtro devuelve `findAll()`; con `userId` valida su existencia (`UserRepository.findById` → `NotFoundError`) y devuelve `findByUser(userId)` (`RN007`).
- `getById(id)`: devuelve la reserva o lanza `ReservationNotFoundError` (`RN006`).
- `release(id)`: recupera la reserva o lanza `ReservationNotFoundError`; si ya está `RELEASED` lanza `ReservationConflictError` (`RN005`); en caso contrario cambia `status` a `RELEASED`, refresca `updatedAt` y persiste.

El controlador delega en el servicio y usa `next(error)`; no contiene lógica de negocio.

## DES008 - Estrategia de pruebas

- Jest + Supertest; archivos en `tests/`.
- Unitarias: `ReservationService` (repositorios mockeados), `InMemoryReservationRepository` (instancia real) y validación de payload/query.
- Integración: `reservationController` montado en una app Express vía `createApp()` con repositorios en memoria reales; cubre los endpoints y el contrato de error.
- Regresión: las suites existentes `tests/controllers/userController.test.ts` y `tests/controllers/bookController.test.ts` se ejecutan sin cambios para verificar `RN010`/`CA009`.
- Cobertura mínima: 80 % statements, 70 % branches, 80 % functions, 80 % lines (`rules/testing/node.md`).

## DES009 - Composición de la aplicación

`createApp()` en `src/app.ts` amplía el grafo existente sin alterar el de usuarios ni libros:

```text
InMemoryUserRepository -> UserService -> UserController -> userRoutes (/api/users)
InMemoryBookRepository -> BookService -> BookController -> bookRoutes (/api/books)
InMemoryReservationRepository + UserRepository + BookRepository -> ReservationService
    -> ReservationController -> reservationRoutes (/api/reservations)
```

`ReservationService` recibe las **mismas instancias** de `InMemoryUserRepository` e `InMemoryBookRepository` que usan los servicios de usuarios y libros, de modo que una reserva ve los usuarios/libros creados por los otros recursos dentro de la misma app.

Orden de middleware preservado: `express.json()` → routers → `notFoundMiddleware` → `errorMiddleware` (último). El `notFoundMiddleware` existente no se modifica.

## Impacto por capa

| Capa | Componentes | Tareas |
|---|---|---|
| Domain | `models/reservation.ts`, `models/errors.ts` | T001 |
| Application | `services/reservationService.ts` | T003 |
| Infrastructure | `repositories/inMemoryReservationRepository.ts` | T002 |
| Presentation | `controllers/reservationController.ts`, `routes/reservationRoutes.ts`, `app.ts` | T004, T005 |
| Cross-cutting | `validators/reservationValidator.ts` | T004 |
| Testing | `tests/services`, `tests/repositories`, `tests/controllers` | T006, T007 |
| Documentación | `README.md` | T008 |

## Contratos y compatibilidad

- API sin versionado en ruta (`/api/reservations`), coherente con `/api/users` y `/api/books`.
- Aditivo: no se renombran ni eliminan símbolos existentes; no se modifica `validateBody` (se reutiliza).
- `DELETE` de reservas es semánticamente distinto al de usuarios/libros (estado `RELEASED` vs eliminación física), documentado en `ADR003`.
- Cambiar a persistencia real solo requiere una nueva implementación de `ReservationRepository`.

## Consideraciones de seguridad y performance

- Validación de entrada en todos los endpoints, incluido el query param (`rules/security/owasp-baseline.md`).
- Sin datos sensibles almacenados ni registrados en logs; el `errorMiddleware` no expone stack traces.
- `findById` en `O(1)`; `findActiveByBook`/`findActiveByUserAndBook`/`findByUser` en `O(n)` sobre el conjunto en memoria (aceptable para el alcance, igual que usuarios y libros).
- Sin secretos hardcodeados; `PORT` por variable de entorno.
