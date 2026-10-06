# Plan - FEAT-0003

| Campo | Valor |
|---|---|
| Feature | FEAT-0003 - reservas-libro-memoria |
| Tipo | Brownfield - API REST Node.js + TypeScript strict + Express + Zod |
| Fecha | 2026-10-02 |

## Objetivo

Añadir una API de reservas (`/api/reservations`) que permita reservar un libro para un usuario, liberar la reserva y consultar reservas (global, por usuario y por id), reutilizando el patrón por capas, el contrato de error uniforme y la validación Zod de los features previos, sin alterar los CRUDs de usuarios ni de libros.

## Alcance

### Incluye

- Modelo de dominio `Reservation` con estados `ACTIVE`/`RELEASED` y `CreateReservationRequest`.
- Extensión aditiva del catálogo de errores con `RESERVATION_NOT_FOUND` (404), `RESERVATION_CONFLICT` (409) y `BOOK_ALREADY_RESERVED` (409).
- Repositorio en memoria `ReservationRepository` / `InMemoryReservationRepository`.
- `ReservationService` con reservar, liberar y consultar, verificando la existencia de usuario y libro.
- Validación Zod estricta (UUID v4) reutilizando `validateBody`, incluido el query `userId`.
- Controlador delgado, rutas `/api/reservations` y composición en `app.ts`.
- Pruebas unitarias (servicio, repositorio) e integración (Supertest), y regresión de usuarios/libros.
- Documentación de la API de reservas en `README.md`.

### No incluye

- Frontend, persistencia real, autenticación/autorización, expiración de reservas, cola de espera, notificaciones, paginación/filtros avanzados.
- Modificación de los modelos `User` o `Book` ni de los artefactos de FEAT-0001/FEAT-0002.
- Versionado de API, Docker y CI/CD.

## Contrato

| Método | Ruta | Request | Éxito | Errores |
|---|---|---|---|---|
| POST | `/api/reservations` | body `{ userId, bookId }` | `201` + `Reservation` | `400`, `404`, `409` |
| GET | `/api/reservations` | query opcional `userId` | `200` + `Reservation[]` | `400`, `404` |
| GET | `/api/reservations/:id` | — | `200` + `Reservation` | `404` |
| DELETE | `/api/reservations/:id` | — | `200` + `Reservation` (`RELEASED`) | `404`, `409` |

Modelo `Reservation`: `{ id, userId, bookId, status: ACTIVE|RELEASED, createdAt, updatedAt }`.

Contrato de error uniforme (sin cambios): `{ error: { code, message, details? } }`.

## Tareas

| ID | Nombre | Capa | Estado |
|---|---|---|---|
| T001 | Add Reservation domain model and reservation error types | domain | PENDING |
| T002 | Implement in-memory reservation repository | repository | PENDING |
| T003 | Implement ReservationService with reservation business rules | service | PENDING |
| T004 | Add Zod reservation schemas and thin reservation controller | validator | PENDING |
| T005 | Add reservation routes and wire them into the Express app | routes | PENDING |
| T006 | Add ReservationService and reservation repository unit tests | test | PENDING |
| T007 | Add reservation controller integration tests with Supertest | test | PENDING |
| T008 | Document the reservations API and update the README | docs | PENDING |

## Work Packages

Pendiente de `@plan_packages`. Agrupación prevista (referencial):

- WP01 - Dominio y errores de reserva: T001.
- WP02 - Repositorio en memoria: T002.
- WP03 - Servicio de reservas: T003.
- WP04 - Validación y presentación HTTP: T004, T005.
- WP05 - Pruebas: T006, T007.
- WP06 - Documentación: T008.

## Riesgos

| ID | Riesgo | Clasificación |
|---|---|---|
| R001 | Reservas volátiles al reiniciar el proceso (almacenamiento en memoria). | RIESGO ACEPTABLE (RN008) |
| R002 | Ambigüedad de precedencia `BOOK_ALREADY_RESERVED` vs `RESERVATION_CONFLICT`. | RIESGO ACEPTABLE (PA001) |
| R003 | `DELETE` de reservas responde `200` + `RELEASED` en vez de `204`. | RIESGO ACEPTABLE (ADR003) |
| R004 | Regresión en usuarios/libros al añadir rutas en `app.ts`. | RIESGO ACEPTABLE (solo aditivo + CA009) |

## Preguntas abiertas

- PA001: ¿Debe prevalecer `BOOK_ALREADY_RESERVED` sobre `RESERVATION_CONFLICT`? — No bloqueante; asumido por RN002/RN003.
- PA002: ¿Es aceptable conservar la reserva liberada (`RELEASED`)? — No bloqueante; asumido por SUP004/ADR003.
- PA003: ¿El listado global debe ocultar reservas liberadas? — No bloqueante; se listan todas con su estado (SUP007).
- PA004: ¿Se requiere validar identidad del reservante? — No bloqueante; sin auth (SUP011/ADR005).

## Estado de preparación

- YAML validado: PASS (`feature.manifest.yml`, `05-tasks.yml`, referencias cruzadas).
- Revisión de plan: APROBADO_CON_OBSERVACIONES (3 observaciones no bloqueantes, sin refinamiento requerido).
- Siguiente paso: `@plan_packages`.
