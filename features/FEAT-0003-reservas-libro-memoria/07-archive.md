# 07 - Archive

## Metadata

| Campo | Valor |
|---|---|
| Feature | FEAT-0003 - reservas-libro-memoria |
| Fecha de cierre | 2026-10-02 |
| Commit base verificado | 4763fa1 |
| Estado | ARCHIVED |
| Autor | workflow (archive) |

---

## Resumen final del feature

Se incorporó un tercer recurso REST, `/api/reservations`, que permite reservar un libro para un
usuario, liberar la reserva y consultar reservas (global, por usuario y por id). La API reutiliza el
patrón por capas, el contrato de error uniforme y la validación Zod de los features previos, sin
alterar los CRUDs de usuarios (`/api/users`) ni de libros (`/api/books`).

## Problema resuelto

El sistema gestionaba usuarios y libros de forma aislada, sin forma de expresar que un usuario tiene
un libro reservado. Se necesitaba modelar la relación usuario-libro con las operaciones mínimas de
reservar, liberar y consultar.

## Solución implementada

- Nuevo módulo paralelo `Reservation` (modelo, repositorio en memoria, servicio, validador,
  controlador y rutas), replicando el patrón de usuarios y libros (ADR002).
- Reglas de negocio: referencias existentes (RN001), una reserva activa por libro (RN002), sin
  duplicado activo usuario+libro (RN003), UUID v4 y `ACTIVE` al crear (RN004), liberación a
  `RELEASED` que refresca `updatedAt` (RN005), errores de inexistencia (RN006), filtro por `userId`
  (RN007), almacenamiento volátil en memoria (RN008).
- Extensión aditiva del catálogo de errores con `RESERVATION_NOT_FOUND` (404),
  `RESERVATION_CONFLICT` (409) y `BOOK_ALREADY_RESERVED` (409).

## Stack tecnológico utilizado

| Componente | Tecnología | Versión |
|---|---|---|
| Runtime | Node.js | >= 20 |
| Lenguaje | TypeScript (strict) | 5.5 |
| Framework HTTP | Express | 4.x |
| Validación | Zod | 3.x |
| Pruebas | Jest + Supertest | 29.x / 7.x |
| Calidad | ESLint + Prettier | 8.x / 3.x |

Sin nuevas dependencias: el feature es puramente aditivo sobre el stack existente (ADR001).

## Arquitectura aplicada

Arquitectura por capas con dependencias dirigidas hacia el dominio:

```text
InMemoryReservationRepository + UserRepository + BookRepository
    -> ReservationService -> ReservationController -> reservationRoutes (/api/reservations)
```

`ReservationService` recibe las **mismas instancias** de `InMemoryUserRepository` e
`InMemoryBookRepository` usadas por los servicios de usuarios y libros (DES009), de modo que las
reservas ven los usuarios/libros creados por los otros recursos dentro de la misma app.

Trade-offs aceptados:
- Duplicación estructural entre módulos (modelo/repositorio/servicio/rutas propios) a cambio de
  simplicidad, bajo acoplamiento y testabilidad (ADR002).
- `DELETE` de reservas responde `200` + `RELEASED` en lugar de eliminación física `204`, para
  conservar histórico y distinguir "nunca reservado" de "reservado y liberado" (ADR003).

## Archivos modificados

### Domain

| Archivo | Acción | Descripción |
|---|---|---|
| `src/models/reservation.ts` | Creado | `ReservationStatus`, `Reservation`, `CreateReservationRequest`. |
| `src/models/errors.ts` | Modificado (aditivo) | Unión `ErrorCode` + clases `ReservationNotFoundError`, `ReservationConflictError`, `BookAlreadyReservedError`. |

### Application

| Archivo | Acción | Descripción |
|---|---|---|
| `src/services/reservationService.ts` | Creado | `create`, `list`, `getById`, `release` (RN001–RN008), sin HTTP. |

### Infrastructure

| Archivo | Acción | Descripción |
|---|---|---|
| `src/repositories/inMemoryReservationRepository.ts` | Creado | Interfaz + `InMemoryReservationRepository` (Map); búsquedas activas ignoran `RELEASED`. |

### Presentation

| Archivo | Acción | Descripción |
|---|---|---|
| `src/validators/reservationValidator.ts` | Creado | Esquemas Zod estrictos UUID v4 + adaptador `validateQuery`. |
| `src/controllers/reservationController.ts` | Creado | Controlador delgado con `next(error)`. |
| `src/routes/reservationRoutes.ts` | Creado | Rutas `/api/reservations` con validación. |
| `src/app.ts` | Modificado (aditivo) | Composición del módulo reservas con repositorios compartidos. |

### Testing

| Archivo | Acción | Descripción |
|---|---|---|
| `tests/services/reservationService.test.ts` | Creado | Unitarias del servicio (mocks). |
| `tests/repositories/inMemoryReservationRepository.test.ts` | Creado | Unitarias del repositorio (instancia real). |
| `tests/controllers/reservationController.test.ts` | Creado | Integración Supertest + regresión. |

### Documentación

| Archivo | Acción | Descripción |
|---|---|---|
| `README.md` | Modificado (aditivo) | Endpoints, modelo, reglas de unicidad, errores y nota ADR003. |

### Base de datos / Docker / Configuración

No aplica: almacenamiento en memoria, sin migraciones, sin cambios de configuración ni contenedores.

## Endpoints / contratos afectados

| Endpoint | Método | Acción | Descripción |
|---|---|---|---|
| `/api/reservations` | POST | Nuevo | Crea reserva (`201`). Errores `400`, `404`, `409`. |
| `/api/reservations` | GET | Nuevo | Lista reservas; filtro opcional `?userId` (`200`). Errores `400`, `404`. |
| `/api/reservations/:id` | GET | Nuevo | Consulta reserva (`200`) o `404`. |
| `/api/reservations/:id` | DELETE | Nuevo | Libera reserva (`200` + `RELEASED`). Errores `404`, `409`. |
| `/api/users`, `/api/books` | — | Sin cambios | Contrato y códigos preservados (RN010/CA009). |

Modelo `Reservation`: `{ id, userId, bookId, status: ACTIVE|RELEASED, createdAt, updatedAt }`.

## Cambios en base de datos

No aplica (almacenamiento en memoria, `Map`, volátil entre reinicios según RN008).

## Configuración requerida

Sin cambios. `PORT` sigue leyéndose de variable de entorno (por defecto `3000`).

## Pruebas disponibles

- **Unitarias:** `ReservationService` con repositorios mockeados; `InMemoryReservationRepository`
  con instancia real; validación de payload/query.
- **Integración:** `reservationController` montado vía `createApp()` con Supertest (endpoints,
  contrato de error, filtro `userId`).
- **Regresión:** suites existentes de usuarios y libros sin cambios.

Resultado (desde `06-verification.yml`): **164/164 tests**, 10 suites, 0 fallos.
Cobertura: **99.52% statements / 98.73% branches / 100% functions / 99.51% lines**.

## Cómo validar manualmente

```bash
npm ci
npx tsc --noEmit            # compilación strict
npx jest --coverage         # suite + cobertura
npm run lint                # eslint
npm run dev                 # servidor en :3000

# Flujo end-to-end (con userId/bookId reales)
curl -X POST http://localhost:3000/api/users -H "Content-Type: application/json" \
  -d '{"name":"Ada","email":"ada@example.com"}'
curl -X POST http://localhost:3000/api/books -H "Content-Type: application/json" \
  -d '{"title":"Clean Code","author":"Robert C. Martin","isbn":"9780132350884"}'
curl -X POST http://localhost:3000/api/reservations -H "Content-Type: application/json" \
  -d '{"userId":"<uuid>","bookId":"<uuid>"}'
curl "http://localhost:3000/api/reservations?userId=<uuid>"
curl -X DELETE "http://localhost:3000/api/reservations/<reservation-uuid>"
```

## Decisiones de arquitectura finales

| Decisión | Alternativas | Elegida | Razón |
|---|---|---|---|
| Módulo paralelo de reservas | CRUD genérico; incrustar en User/Book | Módulo propio (ADR002) | Separación por capas, sin acoplar modelos. |
| Liberar = `RELEASED` | Eliminación física `204` | Estado `RELEASED` (ADR003) | Conserva histórico y permite consulta. |
| Validación Zod estricta | Validación manual | Zod + `validateBody` (ADR004) | Contrato único y `details` consistentes. |
| Sin autenticación | JWT/API keys | Sin auth (ADR005) | Coherente con el resto y fuera de alcance. |
| Reservas en memoria | Persistencia real | `Map` (RN008) | Alcance demo; interfaz lista para reemplazo. |

## Riesgos residuales

- **V001 (OBSERVACIÓN):** en `ReservationService.create` prevalece RN002 (`BOOK_ALREADY_RESERVED`)
  sobre RN003 (`RESERVATION_CONFLICT`) cuando el libro ya está reservado; el caso puro de RN003 se
  prueba aislado. Aceptable según CA002/CA003.
- **V002 (RIESGO ACEPTABLE):** `DELETE` de reservas responde `200` + `RELEASED`, distinto del `204`
  de usuarios/libros (ADR003). Documentado y testeado.
- **V003 (RIESGO ACEPTABLE):** datos volátiles entre reinicios del proceso (RN008).
- **Concurrencia (latente, no fatal):** la comprobación de unicidad en `create` es
  lectura-luego-escritura no atómica; en un escenario con peticiones concurrentes reales dos reservas
  podrían pasar la validación antes de persistir. En el modelo actual de un solo hilo y almacenamiento
  síncrono en memoria la ventana está cerrada en la práctica. Mismo patrón que la unicidad de
  usuarios/libros (PREEXISTENTE).

## Limitaciones conocidas

- Sin autenticación/autorización (ADR005); API abierta, aceptable solo en demo/desarrollo.
- Sin expiración de reservas, cola de espera, notificaciones, paginación ni filtros avanzados.
- `GET /api/reservations` devuelve reservas `ACTIVE` y `RELEASED` (no oculta liberadas).

## Deuda técnica

| Ítem | Razón | Impacto | Prioridad |
|---|---|---|---|
| Duplicación estructural del módulo | Repetición del patrón de usuarios/libros (ADR002) | Bajo | Baja |
| Unicidad no atómica | Almacenamiento síncrono en memoria sin transacciones | Bajo (demo) | Media si se migra a persistencia real |
| Búsquedas activas `O(n)` | Barrido del `Map` | Bajo para el alcance | Baja |

## Métricas de calidad

| Métrica | Valor |
|---|---|
| Tests | 164 passed / 164 total (0 fallos) |
| Cobertura statements | 99.52% |
| Cobertura branches | 98.73% |
| Cobertura functions | 100% |
| Cobertura lines | 99.51% |
| Lint | PASSED |
| Compilación (`tsc --noEmit`) | PASSED |
| SonarQube | No configurado (no aplicable) |

## Información útil para soporte

- Códigos de error esperados: `VALIDATION_ERROR` (400), `USER_NOT_FOUND`/`BOOK_NOT_FOUND`/
  `RESERVATION_NOT_FOUND` (404), `RESERVATION_CONFLICT`/`BOOK_ALREADY_RESERVED` (409),
  `INTERNAL_ERROR` (500).
- Todos los errores siguen `{ error: { code, message, details? } }`; nunca se exponen stack traces.
- Un `409 BOOK_ALREADY_RESERVED` significa que el libro tiene otra reserva activa; liberar esa
  reserva lo deja disponible.
- Un `400 VALIDATION_ERROR` en el listado indica `userId` con formato no UUID; un `404 USER_NOT_FOUND`
  indica UUID válido pero usuario inexistente.
- Reiniciar el proceso borra todas las reservas (y usuarios/libros); comportamiento esperado.

## Checklist de cierre

- [x] Todos los criterios de aceptación cumplidos (CA001–CA009: PASS)
- [x] Tests pasan (164/164)
- [x] Documentación actualizada (README + artefactos del feature)
- [x] No hay deuda técnica no documentada
