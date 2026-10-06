# 02 - Requisitos y escenarios

## Metadata

| Campo | Valor |
|---|---|
| Feature | FEAT-0003 |
| Versión | 1.0 |
| Fecha | 2026-10-02 |

### Historial de versiones

| Versión | Fecha | Cambio | Autor |
|---|---|---|---|
| 1.0 | 2026-10-02 | Versión inicial de requisitos, reglas y criterios de aceptación. | prepare_feature |

---

## Reglas de negocio

| ID | Regla |
|---|---|
| RN001 | Una reserva se crea con `userId` y `bookId`; ambos son obligatorios y deben referenciar un usuario y un libro existentes. Si el usuario no existe responde `404 USER_NOT_FOUND`; si el libro no existe responde `404 BOOK_NOT_FOUND`. |
| RN002 | Un libro no puede tener más de una reserva activa simultáneamente. Intentar reservar un libro ya reservado responde `409 BOOK_ALREADY_RESERVED`. |
| RN003 | Un usuario no puede tener dos reservas activas del mismo libro. Intentar reservar el mismo par usuario+libro responde `409 RESERVATION_CONFLICT`. |
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

## Escenarios de testing

### Domain

- ESC-D01: Una `Reservation` creada expone `id`, `userId`, `bookId`, `status`, `createdAt` y `updatedAt`.
- ESC-D02: El estado de una reserva es `ACTIVE` al crearse y `RELEASED` al liberarse (`RN004`, `RN005`).
- ESC-D03: Los códigos de error de reservas (`RESERVATION_NOT_FOUND`, `RESERVATION_CONFLICT`, `BOOK_ALREADY_RESERVED`) coexisten con los de usuarios y libros sin colisión (`RN010`).

### Application / Service

- ESC-S01: `createReservation` genera un `id` UUID v4, fija `status` `ACTIVE` y setea `createdAt`/`updatedAt` (`CA001`, `RN004`).
- ESC-S02: `createReservation` valida que el usuario existe o lanza `NotFoundError` (`CA004`, `RN001`).
- ESC-S03: `createReservation` valida que el libro existe o lanza `BookNotFoundError` (`CA004`, `RN001`).
- ESC-S04: `createReservation` con libro ya reservado lanza `BookAlreadyReservedError` (`CA002`, `RN002`).
- ESC-S05: `createReservation` con par usuario+libro ya activo lanza `ReservationConflictError` (`CA003`, `RN003`).
- ESC-S06: `listReservations` devuelve todas las reservas; con `userId` filtra por usuario (`CA007`, `RN007`).
- ESC-S07: `getReservationById` devuelve la reserva o lanza `ReservationNotFoundError` (`CA007`, `RN006`).
- ESC-S08: `releaseReservation` cambia el estado a `RELEASED` y refresca `updatedAt` (`CA006`, `RN005`).
- ESC-S09: `releaseReservation` sobre una reserva ya liberada lanza `ReservationConflictError` (`CA006`, `RN005`).
- ESC-S10: `releaseReservation` sobre una reserva inexistente lanza `ReservationNotFoundError` (`CA006`, `RN006`).

### Infrastructure / Repository

- ESC-I01: `save` persiste por `id` y `findById` recupera el mismo objeto.
- ESC-I02: `findAll` devuelve un arreglo con las reservas almacenadas (`CA007`).
- ESC-I03: `findActiveByBook` devuelve la reserva activa del libro o `undefined` si no hay (`RN002`).
- ESC-I04: `findActiveByUserAndBook` devuelve la reserva activa del par o `undefined` (`RN003`).
- ESC-I05: Una reserva `RELEASED` no cuenta como activa en `findActiveByBook`/`findActiveByUserAndBook` (`RN005`).
- ESC-I06: El repositorio parte vacío en cada instancia (`RN008`).

### Presentation / Controller

- ESC-P01: `POST /api/reservations` válido → 201 y body de la reserva (`CA001`).
- ESC-P02: `POST /api/reservations` con libro ya reservado → 409 `BOOK_ALREADY_RESERVED` (`CA002`).
- ESC-P03: `POST /api/reservations` duplicado usuario+libro → 409 `RESERVATION_CONFLICT` (`CA003`).
- ESC-P04: `POST /api/reservations` con userId/bookId inexistente → 404 (`CA004`).
- ESC-P05: `POST /api/reservations` inválido (uuid mal formado, campo faltante, campo desconocido) → 400 con details (`CA005`).
- ESC-P06: `GET /api/reservations` global y con `?userId=` → 200 (`CA007`).
- ESC-P07: `GET /api/reservations?userId=` no-uuid → 400; usuario inexistente → 404 (`CA007`, `RN007`).
- ESC-P08: `GET /api/reservations/:id` existente → 200; inexistente → 404 (`CA007`).
- ESC-P09: `DELETE /api/reservations/:id` activa → 200 `RELEASED`; repetida → 409; inexistente → 404 (`CA006`).
- ESC-P10: Toda respuesta de error de reservas respeta el contrato uniforme (`CA008`).
- ESC-P11: Las suites de integración de usuarios y libros siguen en verde (`CA009`, `RN010`).

### Validator / Cross-cutting

- ESC-V01: `reservationValidator` rechaza `userId`/`bookId` ausentes o no UUID y campos desconocidos (`RN009`).
- ESC-V02: `validateBody` traduce un `ZodError` a `ValidationError` con `details[{field,message}]` (`CA005`).
- ESC-V03: El esquema de query de `userId` valida formato UUID (`RN007`).
