# CRUD de Usuarios y Libros y Reservas en Memoria

API REST para la gestion de usuarios, libros y reservas con almacenamiento
**en memoria**, construida con Node.js, TypeScript (strict), Express y Zod.

El proyecto expone dos CRUDs sencillos: crear, listar, consultar, actualizar y
eliminar usuarios (`/api/users`) y libros (`/api/books`); ademas, un recurso de
reservas (`/api/reservations`) para reservar un libro a un usuario y liberarlo.
Los datos viven unicamente en memoria, por lo que se pierden al reiniciar el
proceso.

## Stack y requisitos

| Elemento | Version / detalle |
|---|---|
| Node.js | >= 20 (probado con v24) |
| TypeScript | 5.5 (modo `strict`) |
| Express | 4.x |
| Zod | 3.x (validacion de payloads) |
| Jest + Supertest | pruebas unitarias e integracion |
| ESLint + Prettier | calidad y formato |

## Instalacion

```bash
npm install
```

Instala dependencias de produccion y desarrollo.

## Scripts disponibles

| Comando | Descripcion |
|---|---|
| `npm run build` | Compila TypeScript a `dist/` con `tsc`. |
| `npm start` | Ejecuta el servidor compilado (`node dist/server.js`). |
| `npm run dev` | Servidor en modo desarrollo con recarga (`ts-node-dev`). |
| `npm test` | Ejecuta la suite de pruebas con Jest. |
| `npm run test:coverage` | Pruebas con reporte de cobertura. |
| `npm run lint` | Analisis estatico con ESLint. |
| `npm run lint:fix` | ESLint con correccion automatica. |
| `npm run format` | Formatea el codigo con Prettier. |
| `npm run format:check` | Verifica el formato sin modificar archivos. |

## Ejecucion

En desarrollo (recarga automatica):

```bash
npm run dev
```

En modo compilado:

```bash
npm run build
npm start
```

El servidor escucha en el puerto indicado por la variable de entorno `PORT` y usa
`3000` por defecto (sin secretos hardcodeados).

```bash
# Windows PowerShell
$env:PORT = "4000"; npm start

# Linux / macOS
PORT=4000 npm start
```

Con el servidor en marcha, las bases de la API son
`http://localhost:3000/api/users`, `http://localhost:3000/api/books` y
`http://localhost:3000/api/reservations`.

## Pruebas

```bash
npm test                 # suite completa
npm run test:coverage    # suite + cobertura
```

La cobertura minima configurada es 80 % statements, 70 % branches, 80 % functions y
80 % lines.

## Endpoints de usuarios

Base path: `/api/users`. Todas las respuestas con cuerpo usan
`Content-Type: application/json`.

| Metodo | Ruta | Body | Exito | Errores |
|---|---|---|---|---|
| `POST` | `/api/users` | `{ "name", "email" }` | `201` + `User` | `400`, `409` |
| `GET` | `/api/users` | — | `200` + `User[]` | — |
| `GET` | `/api/users/:id` | — | `200` + `User` | `404` |
| `PUT` | `/api/users/:id` | `{ "name"?, "email"? }` | `200` + `User` | `400`, `404`, `409` |
| `DELETE` | `/api/users/:id` | — | `204` sin body | `404` |

Modelo `User`:

```json
{
  "id": "3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "createdAt": "2026-10-01T20:00:00.000Z",
  "updatedAt": "2026-10-01T20:00:00.000Z"
}
```

Reglas aplicables a los payloads:

- `name`: string obligatorio, 1-100 caracteres, se aplica `trim`.
- `email`: obligatorio en la creacion, formato valido, maximo 254 caracteres y se
  normaliza a minusculas. No se admiten emails duplicados (la comparacion es
  case-insensitive).
- `PUT` requiere al menos `name` o `email`; enviar ambos es valido.
- Los esquemas son estrictos: los campos desconocidos se rechazan con `400`.

## Ejemplos de request / response

### Crear un usuario

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada Lovelace","email":"Ada@Example.COM"}'
```

`201 Created`:

```json
{
  "id": "3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "createdAt": "2026-10-01T20:00:00.000Z",
  "updatedAt": "2026-10-01T20:00:00.000Z"
}
```

El `id` lo genera el servidor (UUID v4) y el email se devuelve ya normalizado a
minusculas.

### Listar usuarios

```bash
curl http://localhost:3000/api/users
```

`200 OK`:

```json
[
  {
    "id": "3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "createdAt": "2026-10-01T20:00:00.000Z",
    "updatedAt": "2026-10-01T20:00:00.000Z"
  }
]
```

### Consultar un usuario

```bash
curl http://localhost:3000/api/users/3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d
```

`200 OK` con el objeto `User`. Si el id no existe, `404` con `USER_NOT_FOUND`.

### Actualizar un usuario

Actualizacion parcial; solo se aplican los campos enviados:

```bash
curl -X PUT http://localhost:3000/api/users/3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada Byron"}'
```

`200 OK`:

```json
{
  "id": "3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  "name": "Ada Byron",
  "email": "ada@example.com",
  "createdAt": "2026-10-01T20:00:00.000Z",
  "updatedAt": "2026-10-01T20:05:00.000Z"
}
```

`updatedAt` se actualiza; `id` y `createdAt` se preservan.

### Eliminar un usuario

```bash
curl -X DELETE http://localhost:3000/api/users/3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d
```

`204 No Content` sin body. Si el id no existe, `404` con `USER_NOT_FOUND`.

## Endpoints de libros

Base path: `/api/books`. Todas las respuestas con cuerpo usan
`Content-Type: application/json`.

| Metodo | Ruta | Body | Exito | Errores |
|---|---|---|---|---|
| `POST` | `/api/books` | `{ "title", "author", "isbn", "publishedYear"? }` | `201` + `Book` | `400`, `409` |
| `GET` | `/api/books` | — | `200` + `Book[]` | — |
| `GET` | `/api/books/:id` | — | `200` + `Book` | `404` |
| `PUT` | `/api/books/:id` | `{ "title"?, "author"?, "isbn"?, "publishedYear"? }` | `200` + `Book` | `400`, `404`, `409` |
| `DELETE` | `/api/books/:id` | — | `204` sin body | `404` |

Modelo `Book`:

```json
{
  "id": "9c8b7a65-4321-4f0e-9d8c-7b6a5f4e3d2c",
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "isbn": "9780132350884",
  "publishedYear": 2008,
  "createdAt": "2026-10-01T20:00:00.000Z",
  "updatedAt": "2026-10-01T20:00:00.000Z"
}
```

Reglas aplicables a los payloads:

- `title`: string obligatorio, 1-200 caracteres, se aplica `trim`.
- `author`: string obligatorio, 1-150 caracteres, se aplica `trim`.
- `isbn`: obligatorio, se normaliza y se valida (ver mas abajo). Identifica al
  libro de forma unica: no se admiten ISBN duplicados.
- `publishedYear`: entero opcional entre `1450` y el ano actual + 1. Si se omite,
  se persiste como `null`.
- `id`, `createdAt` y `updatedAt` los gestiona el servidor; cualquier valor
  enviado por el cliente para estos campos se ignora o se rechaza.
- El `id` lo genera el servidor (UUID v4).
- `PUT` es una actualizacion parcial: requiere al menos uno de
  `title`/`author`/`isbn`/`publishedYear`. Enviar el mismo `isbn` que ya tiene el
  libro es valido; solo se rechaza si el ISBN pertenece a otro libro.
- Los esquemas son estrictos: los campos desconocidos se rechazan con `400`.

### Validacion y normalizacion de ISBN

El ISBN se normaliza antes de validarlo y persistirlo:

1. Se aplica `trim` y se eliminan los espacios y guiones internos.
2. Una `x` minuscula final se convierte a `X` (para ISBN-10).

Sobre esa forma canonica se exige un ISBN-10 valido (digito de control mod 11,
con `X` = 10) **o** un ISBN-13 valido (digito de control mod 10, pesos alternos
1/3). Un ISBN con formato correcto pero digito de control invalido se rechaza con
`400 VALIDATION_ERROR` (decision `ADR005`).

La unicidad se evalua sobre el ISBN ya normalizado, por lo que
`"978-0-13-235088-4"` y `"9780132350884"` se consideran el mismo valor y el
segundo intento de alta responde `409 ISBN_ALREADY_EXISTS`.

### Ejemplos de request / response

#### Crear un libro

```bash
curl -X POST http://localhost:3000/api/books \
  -H "Content-Type: application/json" \
  -d '{"title":"Clean Code","author":"Robert C. Martin","isbn":"978-0-13-235088-4"}'
```

`201 Created`:

```json
{
  "id": "9c8b7a65-4321-4f0e-9d8c-7b6a5f4e3d2c",
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "isbn": "9780132350884",
  "publishedYear": null,
  "createdAt": "2026-10-01T20:00:00.000Z",
  "updatedAt": "2026-10-01T20:00:00.000Z"
}
```

El `isbn` se devuelve ya normalizado (sin guiones) y `publishedYear` es `null`
porque no se envio.

#### Listar libros

```bash
curl http://localhost:3000/api/books
```

`200 OK` con un array `Book[]`.

#### Consultar un libro

```bash
curl http://localhost:3000/api/books/9c8b7a65-4321-4f0e-9d8c-7b6a5f4e3d2c
```

`200 OK` con el objeto `Book`. Si el id no existe, `404` con `BOOK_NOT_FOUND`.

#### Actualizar un libro

Actualizacion parcial; solo se aplican los campos enviados:

```bash
curl -X PUT http://localhost:3000/api/books/9c8b7a65-4321-4f0e-9d8c-7b6a5f4e3d2c \
  -H "Content-Type: application/json" \
  -d '{"publishedYear":2008}'
```

`200 OK`:

```json
{
  "id": "9c8b7a65-4321-4f0e-9d8c-7b6a5f4e3d2c",
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "isbn": "9780132350884",
  "publishedYear": 2008,
  "createdAt": "2026-10-01T20:00:00.000Z",
  "updatedAt": "2026-10-01T20:05:00.000Z"
}
```

`updatedAt` se actualiza; `id` y `createdAt` se preservan.

#### Eliminar un libro

```bash
curl -X DELETE http://localhost:3000/api/books/9c8b7a65-4321-4f0e-9d8c-7b6a5f4e3d2c
```

`204 No Content` sin body. Si el id no existe, `404` con `BOOK_NOT_FOUND`.

## Endpoints de reservas

Base path: `/api/reservations`. Todas las respuestas con cuerpo usan
`Content-Type: application/json`.

| Metodo | Ruta | Body / Query | Exito | Errores |
|---|---|---|---|---|
| `POST` | `/api/reservations` | `{ "userId", "bookId" }` | `201` + `Reservation` | `400`, `404`, `409` |
| `GET` | `/api/reservations` | query opcional `userId` | `200` + `Reservation[]` | `400`, `404` |
| `GET` | `/api/reservations/:id` | — | `200` + `Reservation` | `404` |
| `DELETE` | `/api/reservations/:id` | — | `200` + `Reservation` (`RELEASED`) | `404`, `409` |

Modelo `Reservation`:

```json
{
  "id": "b7a6c5d4-3e2f-4a1b-9c8d-7e6f5a4b3c2d",
  "userId": "3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  "bookId": "9c8b7a65-4321-4f0e-9d8c-7b6a5f4e3d2c",
  "status": "ACTIVE",
  "createdAt": "2026-10-02T20:00:00.000Z",
  "updatedAt": "2026-10-02T20:00:00.000Z"
}
```

El campo `status` es `ACTIVE` o `RELEASED`:

- `ACTIVE`: la reserva esta vigente; el libro esta reservado para ese usuario.
- `RELEASED`: la reserva fue liberada; deja de contar como activa, por lo que el
  libro vuelve a estar disponible y el mismo par usuario+libro puede volver a
  reservarse.

Reglas aplicables a los payloads:

- `userId` y `bookId`: obligatorios, cada uno validado como UUID v4.
- El `userId` debe corresponder a un usuario existente (`404 USER_NOT_FOUND`) y
  el `bookId` a un libro existente (`404 BOOK_NOT_FOUND`).
- Los esquemas son estrictos: los campos desconocidos se rechazan con `400`.
- El filtro `userId` del listado es opcional; si se envia, debe ser un UUID v4
  (`400 VALIDATION_ERROR` en caso contrario) y el usuario debe existir
  (`404 USER_NOT_FOUND`).

Reglas de unicidad:

- Un libro no puede tener dos reservas activas. Si el libro ya tiene una reserva
  `ACTIVE`, un nuevo alta responde `409 BOOK_ALREADY_RESERVED`.
- Un par usuario+libro no puede tener una reserva activa duplicada. Si ese par ya
  tiene una reserva `ACTIVE`, el alta responde `409 RESERVATION_CONFLICT`.
  (Cuando se intenta reservar un libro ya reservado por el mismo usuario, la
  comprobacion de libro ya reservado tiene precedencia y la respuesta es
  `BOOK_ALREADY_RESERVED`.)
- Una reserva liberada (`RELEASED`) no bloquea ni el libro ni el par usuario+libro.

### Ejemplos de request / response

#### Crear una reserva

```bash
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{"userId":"3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d","bookId":"9c8b7a65-4321-4f0e-9d8c-7b6a5f4e3d2c"}'
```

`201 Created`:

```json
{
  "id": "b7a6c5d4-3e2f-4a1b-9c8d-7e6f5a4b3c2d",
  "userId": "3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  "bookId": "9c8b7a65-4321-4f0e-9d8c-7b6a5f4e3d2c",
  "status": "ACTIVE",
  "createdAt": "2026-10-02T20:00:00.000Z",
  "updatedAt": "2026-10-02T20:00:00.000Z"
}
```

El `id` lo genera el servidor (UUID v4) y la reserva comienza en estado `ACTIVE`.

#### Listar reservas

```bash
curl http://localhost:3000/api/reservations
```

`200 OK` con un array `Reservation[]` con todas las reservas (activas y liberadas).

Para filtrar por usuario:

```bash
curl "http://localhost:3000/api/reservations?userId=3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
```

`200 OK` con las reservas de ese usuario (de cualquier estado). Si el `userId` no
es un UUID valido, `400 VALIDATION_ERROR`; si no existe, `404 USER_NOT_FOUND`.

#### Consultar una reserva

```bash
curl http://localhost:3000/api/reservations/b7a6c5d4-3e2f-4a1b-9c8d-7e6f5a4b3c2d
```

`200 OK` con el objeto `Reservation`. Si el id no existe, `404` con
`RESERVATION_NOT_FOUND`.

#### Liberar una reserva

```bash
curl -X DELETE http://localhost:3000/api/reservations/b7a6c5d4-3e2f-4a1b-9c8d-7e6f5a4b3c2d
```

`200 OK` con la reserva en estado `RELEASED` y `updatedAt` refrescado:

```json
{
  "id": "b7a6c5d4-3e2f-4a1b-9c8d-7e6f5a4b3c2d",
  "userId": "3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  "bookId": "9c8b7a65-4321-4f0e-9d8c-7b6a5f4e3d2c",
  "status": "RELEASED",
  "createdAt": "2026-10-02T20:00:00.000Z",
  "updatedAt": "2026-10-02T20:05:00.000Z"
}
```

Si el id no existe, `404` con `RESERVATION_NOT_FOUND`. Si la reserva ya estaba
`RELEASED`, responde `409` con `RESERVATION_CONFLICT`.

> **Nota:** a diferencia de `DELETE` en usuarios y libros (que eliminan fisicamente
> y responden `204`), `DELETE` en reservas **no elimina** el registro: lo pasa a
> `RELEASED` y responde `200` con la reserva. Es una diferencia intencional
> (decision `ADR003`): el recurso sigue existiendo y su historico se preserva.

## Contrato de error uniforme

Todos los errores comparten la misma forma:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "details": [{ "field": "email", "message": "email must be a valid email address" }]
  }
}
```

`details` solo aparece en errores de validacion. Codigos y estados:

| Code | HTTP | Causa |
|---|---|---|
| `VALIDATION_ERROR` | `400` | Payload invalido, campo desconocido o `PUT` sin campos. |
| `USER_NOT_FOUND` | `404` | El id no existe o la ruta no esta registrada. |
| `EMAIL_ALREADY_EXISTS` | `409` | El email ya pertenece a otro usuario. |
| `BOOK_NOT_FOUND` | `404` | El id de libro no existe. |
| `ISBN_ALREADY_EXISTS` | `409` | El ISBN ya pertenece a otro libro (comparado en forma normalizada). |
| `RESERVATION_NOT_FOUND` | `404` | El id de reserva no existe. |
| `RESERVATION_CONFLICT` | `409` | El par usuario+libro ya tiene una reserva activa, o la reserva a liberar ya estaba `RELEASED`. |
| `BOOK_ALREADY_RESERVED` | `409` | El libro ya tiene otra reserva activa. |
| `INTERNAL_ERROR` | `500` | Fallo no controlado; no expone stack trace ni detalles internos. |

`VALIDATION_ERROR` se comparte entre usuarios, libros y reservas: en libros tambien
cubre ISBN invalido (digito de control incorrecto) y `publishedYear` fuera de rango;
en reservas cubre UUIDs mal formados en el body o en el filtro `userId` del listado.
`USER_NOT_FOUND` lo emite tambien la ruta no encontrada (middleware `notFound`).

Ejemplos:

`400 Bad Request` (validacion):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "details": [{ "field": "email", "message": "email must be a valid email address" }]
  }
}
```

`409 Conflict` (email duplicado):

```json
{
  "error": {
    "code": "EMAIL_ALREADY_EXISTS",
    "message": "Email already exists"
  }
}
```

`404 Not Found`:

```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User not found"
  }
}
```

`400 Bad Request` (ISBN invalido al crear un libro):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "details": [
      { "field": "isbn", "message": "isbn must be a valid ISBN-10 or ISBN-13" }
    ]
  }
}
```

`404 Not Found` (libro inexistente):

```json
{
  "error": {
    "code": "BOOK_NOT_FOUND",
    "message": "Book not found"
  }
}
```

`409 Conflict` (ISBN duplicado):

```json
{
  "error": {
    "code": "ISBN_ALREADY_EXISTS",
    "message": "ISBN already exists"
  }
}
```

`409 Conflict` (libro ya reservado):

```json
{
  "error": {
    "code": "BOOK_ALREADY_RESERVED",
    "message": "Book already reserved"
  }
}
```

`409 Conflict` (reserva duplicada para el mismo par usuario+libro):

```json
{
  "error": {
    "code": "RESERVATION_CONFLICT",
    "message": "Reservation already exists for this user and book"
  }
}
```

`404 Not Found` (reserva inexistente):

```json
{
  "error": {
    "code": "RESERVATION_NOT_FOUND",
    "message": "Reservation not found"
  }
}
```

## Fuera de alcance

La autenticacion y la gestion de contrasenas quedan **explicitamente fuera de alcance**:

- El modelo `User` no incluye `password` ni datos de autenticacion.
- No existen endpoints de login, registro con credenciales, tokens (JWT) ni control de
  acceso por roles.
- La API queda abierta, lo cual es aceptable unicamente en contexto de demo/desarrollo.

Esta decision esta registrada en el ADR004 del feature `FEAT-0001-crud-usuario-memoria`.

Para los libros aplica la misma exclusion (sin autenticacion) y su modelo se limita
a `id`, `title`, `author`, `isbn`, `publishedYear` y marcas de tiempo; los campos
bibliograficos adicionales (editorial, genero, stock, etc.) quedan fuera de alcance
segun el ADR006 del feature `FEAT-0002-crud-libro-memoria`.

Para las reservas tambien aplica la misma exclusion (sin autenticacion ni
autorizacion): cualquier cliente puede reservar un libro para cualquier usuario
existente y liberarla. Esta decision esta registrada en el ADR005 del feature
`FEAT-0003-reservas-libro-memoria`.

## Arquitectura

Separacion por capas, con dependencias dirigidas hacia el dominio:

```text
src/
├── app.ts                     # composicion de Express (json parser, rutas, middlewares)
├── server.ts                  # bootstrap HTTP y lectura de PORT
├── controllers/
│   ├── userController.ts      # capa HTTP delgada de usuarios
│   ├── bookController.ts      # capa HTTP delgada de libros
│   └── reservationController.ts # capa HTTP delgada de reservas
├── services/
│   ├── userService.ts         # reglas de negocio de usuarios (sin HTTP)
│   ├── bookService.ts         # reglas de negocio de libros (sin HTTP)
│   └── reservationService.ts  # reglas de negocio de reservas (sin HTTP)
├── repositories/              # UserRepository/InMemoryUserRepository,
│                              # BookRepository/InMemoryBookRepository y
│                              # ReservationRepository/InMemoryReservationRepository (Map)
├── models/                    # User, Book, Reservation (ACTIVE|RELEASED) y clases de error de dominio
├── middleware/                # errorMiddleware y notFoundMiddleware
├── routes/
│   ├── userRoutes.ts          # cinco endpoints de usuarios
│   ├── bookRoutes.ts          # cinco endpoints de libros
│   └── reservationRoutes.ts   # cuatro endpoints de reservas
├── validators/
│   ├── validateBody.ts        # middleware compartido de validacion
│   ├── userValidator.ts       # esquemas Zod de usuarios
│   ├── bookValidator.ts       # esquemas Zod de libros (ISBN)
│   └── reservationValidator.ts # esquemas Zod de reservas (UUID v4)
└── utils/idGenerator.ts       # generacion de UUID v4
```

El almacenamiento esta detras de las interfaces `UserRepository`,
`BookRepository` y `ReservationRepository`. Sustituir la persistencia en memoria
por una real solo requiere una nueva implementacion de cada interfaz, sin tocar
los servicios. `ReservationService` depende de `ReservationRepository` y tambien
de las abstracciones `UserRepository`/`BookRepository` para verificar la
existencia de usuario y libro, sin acoplarse a sus implementaciones concretas.
