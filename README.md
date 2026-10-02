# CRUD de Usuarios en Memoria

API REST para la gestion de usuarios con almacenamiento **en memoria**, construida con
Node.js, TypeScript (strict), Express y Zod.

El proyecto es un CRUD sencillo: crear, listar, consultar, actualizar y eliminar usuarios.
Los datos viven unicamente en memoria, por lo que se pierden al reiniciar el proceso.

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

Con el servidor en marcha, la base de la API es `http://localhost:3000/api/users`.

## Pruebas

```bash
npm test                 # suite completa
npm run test:coverage    # suite + cobertura
```

La cobertura minima configurada es 80 % statements, 70 % branches, 80 % functions y
80 % lines.

## Endpoints

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
| `INTERNAL_ERROR` | `500` | Fallo no controlado; no expone stack trace ni detalles internos. |

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

## Fuera de alcance

La autenticacion y la gestion de contrasenas quedan **explicitamente fuera de alcance**:

- El modelo `User` no incluye `password` ni datos de autenticacion.
- No existen endpoints de login, registro con credenciales, tokens (JWT) ni control de
  acceso por roles.
- La API queda abierta, lo cual es aceptable unicamente en contexto de demo/desarrollo.

Esta decision esta registrada en el ADR004 del feature `FEAT-0001-crud-usuario-memoria`.

## Arquitectura

Separacion por capas, con dependencias dirigidas hacia el dominio:

```text
src/
├── app.ts                     # composicion de Express (json parser, rutas, middlewares)
├── server.ts                  # bootstrap HTTP y lectura de PORT
├── controllers/userController.ts   # capa HTTP delgada (sin logica de negocio)
├── services/userService.ts         # reglas de negocio (sin dependencia de HTTP)
├── repositories/                   # UserRepository + InMemoryUserRepository (Map)
├── models/                         # User y clases de error de dominio
├── middleware/                     # errorMiddleware y notFoundMiddleware
├── routes/userRoutes.ts            # definicion de los cinco endpoints
├── validators/userValidator.ts     # esquemas Zod y validateBody
└── utils/idGenerator.ts            # generacion de UUID v4
```

El almacenamiento esta detras de la interfaz `UserRepository`. Sustituir la
persistencia en memoria por una real solo requiere una nueva implementacion de esa
interfaz, sin tocar el servicio.
