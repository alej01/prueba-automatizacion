# 01 - Propuesta

## Metadata

| Campo | Valor |
|---|---|
| Feature | FEAT-0003 |
| Nombre | reservas-libro-memoria |
| Autor | prepare_feature |
| Fecha creación | 2026-10-02 |
| Estado | SPEC_READY |
| Versión | 1.0 |

### Historial de versiones

| Versión | Fecha | Cambio | Autor |
|---|---|---|---|
| 1.0 | 2026-10-02 | Versión inicial derivada de `/enrich_hu`. | prepare_feature |

---

## Stack tecnológico detectado

| Capa | Tecnología | Evidencia |
|---|---|---|
| Backend | Node.js >=20 + Express 4.x | `package.json` (`express`), `src/app.ts` |
| Lenguaje | TypeScript 5.5 (strict) | `tsconfig.json` (`strict: true` y flags asociados) |
| Persistencia | En memoria (`Map`) | `src/repositories/inMemoryUserRepository.ts`, `src/repositories/inMemoryBookRepository.ts` |
| Base de datos | No aplica | Proyecto sin base de datos; almacenamiento volátil |
| Framework HTTP | Express | `src/app.ts`, `src/routes/bookRoutes.ts` |
| Validación | Zod 3.x | `src/validators/bookValidator.ts`, `src/validators/validateBody.ts` |
| Testing | Jest + Supertest | `package.json`, `tests/` |
| Lint/Format | ESLint + Prettier | `.eslintrc.json`, `.prettierrc` |
| Build tool | `tsc` | `package.json` script `build` |
| Docker | No incluido en el alcance | No se detecta `Dockerfile` ni `compose*.yml` |
| Java | No aplica | — |

## Tipo de proyecto

- [ ] Greenfield (proyecto nuevo)
- [x] Brownfield (código existente)

El repositorio contiene dos features completados: **FEAT-0001 `crud-usuario-memoria`** (CRUD `/api/users`) y **FEAT-0002 `crud-libro-memoria`** (CRUD `/api/books`). Este feature añade un nuevo recurso `Reservation` que relaciona usuarios y libros, replicando el patrón por capas existente y sin alterar el comportamiento observable de usuarios ni libros.

### Archivos existentes afectados

| Archivo existente | Cambio previsto | Riesgo de regresión |
|---|---|---|
| `src/app.ts` | Composición y montaje de `/api/reservations` | Bajo (aditivo; conserva usuarios y libros) |
| `src/models/errors.ts` | Añadir `RESERVATION_NOT_FOUND`, `RESERVATION_CONFLICT`, `BOOK_ALREADY_RESERVED` y sus clases | Bajo (aditivo; no se modifican códigos existentes) |
| `README.md` | Documentar la API de reservas | Nulo (documentación) |

### Dependencias que podrían verse afectadas

- `src/services/bookService.ts` / `src/repositories/inMemoryBookRepository.ts`: **no se modifican**; el `ReservationService` los consume solo a través de sus interfaces para verificar la existencia de usuario y libro. La unicidad de reserva se gestiona en el propio repositorio de reservas.
- Suites `tests/controllers/userController.test.ts` y `tests/controllers/bookController.test.ts`: se ejecutan como regresión de usuarios y libros.

## Historia de usuario

**Como** desarrollador de servicios backend,
**quiero** exponer una API de reservas (`Reservation`) por HTTP con almacenamiento en memoria, que permita reservar un libro para un usuario, liberar la reserva y consultar reservas por usuario y de forma global, reutilizando el contrato de errores uniforme y la validación Zod,
**para** modelar la relación usuario–libro sin duplicar infraestructura y sin romper lo ya entregado.

## Descripción funcional

Se añade al servicio HTTP existente un recurso `Reservation` con las operaciones mínimas:

- **Reservar**: `POST /api/reservations` con `{ userId, bookId }` crea una reserva activa si el usuario y el libro existen y ni el libro ni el par usuario+libro están ya reservados.
- **Liberar**: `DELETE /api/reservations/:id` libera (cancela) una reserva existente; la reserva pasa a estado `RELEASED`.
- **Consultar**: `GET /api/reservations` lista todas las reservas y `GET /api/reservations?userId={id}` lista las reservas de un usuario. `GET /api/reservations/:id` consulta una reserva concreta.

Las reservas se almacenan en memoria (`Map`) y se pierden al reiniciar el proceso. Cada reserva tiene `id` (UUID v4 generado por el servidor), `userId`, `bookId`, `status` (`ACTIVE` | `RELEASED`), `createdAt` y `updatedAt` (ISO 8601). La entrada se valida con esquemas Zod estrictos y los errores se gestionan con el middleware centralizado ya existente, extendiendo el catálogo de códigos.

> Nota de coherencia: se mantiene el histórico de reservas con estado `RELEASED` en lugar de eliminar el registro, de modo que una reserva liberada deja de bloquear (`ADR003`). Alternativamente podría eliminarse físicamente; ver supuesto `SUP004`.

## Alcance

- Modelo de dominio `Reservation` con estados `ACTIVE`/`RELEASED` y tipos de request.
- Extensión del catálogo de errores de dominio con `RESERVATION_NOT_FOUND`, `RESERVATION_CONFLICT` y `BOOK_ALREADY_RESERVED`.
- Repositorio en memoria `InMemoryReservationRepository` detrás de la interfaz `ReservationRepository`.
- `ReservationService` con la lógica de reservar, liberar y consultar, validando la existencia de usuario y libro.
- Validación de entrada con Zod (esquemas estrictos) y normalización/validación de UUID en `userId`/`bookId`.
- Controlador delgado `reservationController` y rutas REST `/api/reservations`.
- Composición de dependencias de reservas en `app.ts`.
- Pruebas unitarias (servicio, repositorio) e integración (controlador con Supertest).
- Regresión de los CRUDs de usuarios y libros sobre las suites existentes.
- Documentación de la API de reservas y del contrato de error en `README.md`.

## Fuera de alcance

- Interfaz de usuario / frontend.
- Persistencia real (base de datos, archivos, cache externo) (`RN008`).
- Autenticación y autorización: no se valida que quien reserva sea el usuario autenticado (no existe auth, igual que features previos) (`ADR005`).
- Fechas de vencimiento, expiración automática o renovación de reservas.
- Cola de espera, prioridad o listas de interés cuando el libro ya está reservado.
- Paginación, filtros avanzados u ordenamiento en el listado.
- Notificaciones (email/push) al reservar o liberar.
- Modificación del modelo `User` o `Book` (no se les añade ningún campo de reservas).
- Versionado de API (`/v1`), contenerización Docker y pipelines CI/CD.
- Modificación de artefactos de FEAT-0001 o FEAT-0002.

## Reglas de negocio

| ID | Regla |
|---|---|
| RN001 | Una reserva se crea con `userId` y `bookId`; ambos son obligatorios y deben referenciar un usuario y un libro existentes. Si el usuario no existe responde `404 USER_NOT_FOUND`; si el libro no existe responde `404 BOOK_NOT_FOUND`. |
| RN002 | Un libro no puede tener más de una reserva activa simultáneamente. Intentar reservar un libro ya reservado responde `409 BOOK_ALREADY_RESERVED`. |
| RN003 | Un usuario no puede tener dos reservas activas del mismo libro. Intentar reservar el mismo par usuario+libro responde `409 RESERVATION_CONFLICT`. (Se aplica además de `RN002`; ver `PA001` sobre la precedencia). |
| RN004 | Al crear una reserva, el estado es `ACTIVE`, el `id` es un UUID v4 generado por el servidor y `createdAt`/`updatedAt` se fijan con la hora actual en ISO 8601. |
| RN005 | Liberar una reserva (`DELETE /api/reservations/:id`) cambia su estado a `RELEASED` y refresca `updatedAt`; la reserva deja de contar como activa y el libro vuelve a estar disponible. Una reserva ya liberada responde `409 RESERVATION_CONFLICT`. |
| RN006 | Una operación sobre una reserva inexistente responde `404 RESERVATION_NOT_FOUND`. Aplica a `GET /api/reservations/:id` y `DELETE /api/reservations/:id`. |
| RN007 | `GET /api/reservations` devuelve todas las reservas; con el query param opcional `userId` devuelve solo las de ese usuario. Si `userId` no es un UUID válido responde `400 VALIDATION_ERROR`; si es válido pero el usuario no existe responde `404 USER_NOT_FOUND`. |
| RN008 | El almacenamiento de reservas es en memoria (`Map`) y es volátil: los datos no persisten entre reinicios del proceso. |
| RN009 | La entrada se valida con esquemas Zod estrictos: `userId` y `bookId` son UUID v4 válidos y se rechazan campos desconocidos con `400 VALIDATION_ERROR`. |
| RN010 | La incorporación de reservas no altera el comportamiento observable de los CRUDs de usuarios y libros ni su contrato de error: los códigos y rutas existentes se mantienen. |

## Criterios de aceptación

### CA001 - Reservar un libro para un usuario

```gherkin
Given un usuario existente y un libro existente con ids conocidos
And un payload válido con userId y bookId
When envío POST /api/reservations con ese payload
Then la respuesta es 201 Created
And el body contiene un id UUID v4, userId, bookId, status "ACTIVE", createdAt y updatedAt
And la reserva queda disponible para GET /api/reservations/{id}
```

### CA002 - Rechazar reserva de un libro ya reservado

```gherkin
Given un libro con una reserva activa
When envío POST /api/reservations para el mismo libro con otro usuario
Then la respuesta es 409 Conflict
And el body sigue el contrato de error uniforme con code "BOOK_ALREADY_RESERVED"
And no se crea una segunda reserva activa
```

### CA003 - Rechazar reserva duplicada del mismo usuario y libro

```gherkin
Given un usuario con una reserva activa del libro X
When envío POST /api/reservations con el mismo userId y bookId
Then la respuesta es 409 Conflict
And el body sigue el contrato de error uniforme con code "RESERVATION_CONFLICT"
And no se crea una segunda reserva
```

### CA004 - Rechazar referencias inexistentes

```gherkin
Given una API de reservas en ejecución
When envío POST /api/reservations con un userId inexistente
Then la respuesta es 404 Not Found con code "USER_NOT_FOUND"
When envío POST /api/reservations con un bookId inexistente
Then la respuesta es 404 Not Found con code "BOOK_NOT_FOUND"
```

### CA005 - Rechazar payload inválido

```gherkin
Given una API de reservas en ejecución
When envío POST /api/reservations con userId o bookId ausente o con formato no UUID
Then la respuesta es 400 Bad Request con code "VALIDATION_ERROR"
And details describe cada campo inválido
And se rechazan campos desconocidos
```

### CA006 - Liberar una reserva

```gherkin
Given una reserva activa con id conocido
When envío DELETE /api/reservations/{id}
Then la respuesta es 200 OK
And el body devuelve la reserva con status "RELEASED" y updatedAt refrescado
When envío DELETE /api/reservations/{mismo-id}
Then la respuesta es 409 Conflict con code "RESERVATION_CONFLICT"
When envío DELETE /api/reservations/{id-inexistente}
Then la respuesta es 404 Not Found con code "RESERVATION_NOT_FOUND"
```

### CA007 - Consultar reservas

```gherkin
Given existen reservas registradas
When envío GET /api/reservations
Then la respuesta es 200 OK con un arreglo de todas las reservas
When envío GET /api/reservations?userId={id-de-usuario-existente}
Then la respuesta es 200 OK con solo las reservas de ese usuario
When envío GET /api/reservations/{id-existente}
Then la respuesta es 200 OK con la reserva
When envío GET /api/reservations/{id-inexistente}
Then la respuesta es 404 Not Found con code "RESERVATION_NOT_FOUND"
When envío GET /api/reservations?userId={no-uuid}
Then la respuesta es 400 Bad Request con code "VALIDATION_ERROR"
```

### CA008 - Contrato de error uniforme

```gherkin
Given cualquier error del recurso de reservas (400, 404, 409, 500)
When recibo la respuesta
Then el body tiene la forma { "error": { "code": string, "message": string, "details"?: array } }
And el código HTTP es coherente con el tipo de error
And no se exponen stack traces ni datos sensibles en el body
```

### CA009 - Compatibilidad con los CRUDs de usuarios y libros

```gherkin
Given la API con reservas incorporadas
When ejecuto las suites existentes de usuarios y libros
Then todos los tests existentes siguen pasando sin cambios
And las rutas /api/users y /api/books y sus códigos de error permanecen intactos
```

## Impacto por capa

| Capa | Componentes | Nuevo / Modificado |
|---|---|---|
| Domain | `models/reservation.ts`, `models/errors.ts` | Nuevo / Modificado |
| Application | `services/reservationService.ts` | Nuevo |
| Infrastructure | `repositories/inMemoryReservationRepository.ts`, `utils/idGenerator.ts` | Nuevo / Reutilizado |
| Presentation | `controllers/reservationController.ts`, `routes/reservationRoutes.ts`, `app.ts` | Nuevo / Modificado |
| Cross-cutting | `validators/reservationValidator.ts`, `validators/validateBody.ts` | Nuevo / Reutilizado |
| Tests | `tests/services`, `tests/repositories`, `tests/controllers` | Nuevo |
| Docs | `README.md` | Modificado |

## Escenarios de testing

- **Domain:** forma del modelo `Reservation`, estados `ACTIVE`/`RELEASED`, códigos de error de reservas.
- **Application:** reglas del `ReservationService` (creación, libro ya reservado, duplicado usuario+libro, referencias inexistentes, liberación, consultas).
- **Infrastructure:** `InMemoryReservationRepository` (save/findById/findAll/findActiveByBook/findActiveByUserAndBook, instancia vacía).
- **Presentation:** endpoints de reservas, query `userId`, contrato uniforme de error y regresión de usuarios/libros.

## Impacto técnico estimado

- **Backend:** 5 archivos nuevos en `src/` y 2 archivos existentes modificados de forma aditiva (`app.ts`, `models/errors.ts`).
- **Base de datos:** ninguno.
- **Integraciones:** ninguna nueva.
- **Seguridad:** validación de entrada en todos los endpoints; sin datos sensibles; sin secretos.
- **Logs:** se reutiliza el logging estructurado del `errorMiddleware`; no se añaden logs nuevos.
- **Pruebas:** +1 suite unitaria de servicio, +1 suite unitaria de repositorio, +1 suite de integración, reutilización de las suites de usuarios y libros.
- **Documentación:** actualización de `README.md`.
- **Docker:** no aplica.

## Riesgos

| ID | Riesgo | Clasificación |
|---|---|---|
| R001 | Pérdida de reservas al reiniciar el proceso (almacenamiento volátil). | RIESGO ACEPTABLE (documentado en `RN008`) |
| R002 | Regresión en usuarios o libros por añadir rutas en `app.ts`. | RIESGO ACEPTABLE (solo aditivo + suites de regresión) |
| R003 | Ambigüedad entre reserva activa por libro vs por usuario+libro. | RIESGO ACEPTABLE (se resuelve con `RN002`/`RN003` y `SUP003`; ver `PA001`) |
| R004 | Diferencia entre liberar (estado `RELEASED`) y eliminar la reserva. | RIESGO ACEPTABLE (se resuelve con `ADR003`; ver `PA002`) |
| R005 | Crecimiento del `Map` sin límite en procesos de larga duración. | RIESGO ACEPTABLE (fuera de alcance la retención/limpieza) |

## Supuestos

- SUP001: El requerimiento se refiere a una **API HTTP REST** análoga a `/api/users` y `/api/books`, no a un CLI ni a una librería.
- SUP002: Se **reutiliza** el stack y la infraestructura existentes (Express, TypeScript strict, Zod, Jest + Supertest); no se re-scaffoldea el proyecto.
- SUP003: El recurso se expone en la ruta base **`/api/reservations`**, paralela a las existentes.
- SUP004: Liberar una reserva **cambia su estado a `RELEASED`** (no la elimina físicamente), conservando el histórico y refrescando `updatedAt`.
- SUP005: Un **libro no puede tener dos reservas activas** simultáneamente (`RN002`).
- SUP006: Un **usuario no puede reservar dos veces el mismo libro** de forma activa (`RN003`).
- SUP007: `GET /api/reservations` devuelve todas las reservas y acepta un query param opcional `userId` para filtrar; sin paginación.
- SUP008: `userId` y `bookId` son UUID v4 generados por los CRUDs existentes; se validan como UUID en la entrada.
- SUP009: El contrato de error es el mismo ya existente: `{ "error": { "code", "message", "details"? } }`, ampliando el catálogo con `RESERVATION_NOT_FOUND`, `RESERVATION_CONFLICT` y `BOOK_ALREADY_RESERVED`.
- SUP010: No se crea una abstracción CRUD genérica; reservas es un módulo paralelo (`ADR002`), coherente con `FEAT-0002`.
- SUP011: No hay autenticación: cualquier cliente puede reservar para cualquier usuario existente (coherente con `ADR004` de `FEAT-0001`).
- SUP012: La cobertura mínima de pruebas es 80 % statements / 70 % branches / 80 % functions / 80 % lines, según `rules/testing/node.md`.

## Preguntas abiertas

- PA001: ¿Debe prevalecer `BOOK_ALREADY_RESERVED` sobre `RESERVATION_CONFLICT` cuando un mismo usuario intenta reservar dos veces el mismo libro? — **No bloqueante**, se asume `SUP005`/`SUP006` con `RN002`/`RN003`: primero se evalúa la reserva del libro (`BOOK_ALREADY_RESERVED`) y luego el duplicado usuario+libro (`RESERVATION_CONFLICT`); el usuario recibirá `BOOK_ALREADY_RESERVED` en ese caso concreto.
- PA002: ¿Es aceptable conservar la reserva liberada con estado `RELEASED` en lugar de eliminarla? — **No bloqueante**, se asume `SUP004`/`ADR003` (histórico con estado).
- PA003: ¿Debe el listado global ocultar las reservas `RELEASED` por defecto? — **No bloqueante**, se asume `SUP007`: el listado devuelve todas las reservas con su estado; el filtrado por estado queda fuera de alcance.
- PA004: ¿Se requiere validar que el `userId` del reservante sea el usuario autenticado? — **No bloqueante**, se asume `SUP011` (sin autenticación, fuera de alcance).

> No se identifican preguntas bloqueantes. Los supuestos `SUP001`–`SUP012` quedan trazados para validación humana en la revisión del plan.

## Recomendación técnica inicial

1. Extender el modelo de dominio y el catálogo de errores con los tipos de reserva.
2. Implementar el repositorio en memoria `ReservationRepository`/`InMemoryReservationRepository`.
3. Implementar `ReservationService` con las reglas `RN001`–`RN010`, consumiendo `UserRepository` y `BookRepository` para verificar referencias.
4. Añadir los esquemas Zod de reserva (UUID estricto) reutilizando `validateBody`.
5. Implementar el controlador delgado y las rutas `/api/reservations`.
6. Componer el grafo de dependencias de reservas en `app.ts`.
7. Cubrir con pruebas unitarias (servicio, repositorio) e integración (Supertest).
8. Documentar la API de reservas y validar la regresión de usuarios y libros.

Consideraciones de performance/seguridad: operaciones `O(1)` sobre `Map` para `findById`; búsquedas `O(n)` para reservas por libro/usuario (aceptable para el alcance); validación de entrada obligatoria; sin datos sensibles ni secretos.
