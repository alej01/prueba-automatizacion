# 03 - Diseño técnico

## Metadata

| Campo | Valor |
|---|---|
| Feature | FEAT-0001 |
| Versión | 1.0 |
| Fecha | 2026-10-01 |

### Historial de versiones

| Versión | Fecha | Cambio | Autor |
|---|---|---|---|
| 1.0 | 2026-10-01 | Versión inicial del diseño técnico. | prepare_feature |

---

## DES001 - Estructura del proyecto

Proyecto Node.js + TypeScript (strict) con Express, siguiendo `rules/architecture/node.md`.

```text
.
├── package.json
├── tsconfig.json
├── jest.config.ts
├── .eslintrc.json
├── .prettierrc
├── README.md
├── src
│   ├── app.ts                     # configuración de Express (middlewares y rutas)
│   ├── server.ts                  # bootstrap HTTP y lectura de PORT
│   ├── controllers
│   │   └── userController.ts
│   ├── services
│   │   └── userService.ts
│   ├── repositories
│   │   └── inMemoryUserRepository.ts
│   ├── models
│   │   ├── user.ts
│   │   └── errors.ts
│   ├── middleware
│   │   ├── errorMiddleware.ts
│   │   └── notFoundMiddleware.ts
│   ├── routes
│   │   └── userRoutes.ts
│   ├── validators
│   │   └── userValidator.ts
│   └── utils
│       └── idGenerator.ts
└── tests
    ├── services/userService.test.ts
    ├── repositories/inMemoryUserRepository.test.ts
    └── controllers/userController.test.ts
```

## DES002 - Modelo de dominio

```typescript
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
}

export type UpdateUserRequest = Partial<CreateUserRequest> & { [key: string]: unknown };
```

- `id` es UUID v4 generado por el servidor (`RN004`).
- Fechas en ISO 8601.
- Sin campos de autenticación (`RN008`).

## DES003 - Contrato API REST

| Método | Ruta | Request body | Éxito | Errores |
|---|---|---|---|---|
| POST | `/api/users` | `{ name, email }` | `201` + `User` | `400`, `409` |
| GET | `/api/users` | — | `200` + `User[]` | — |
| GET | `/api/users/:id` | — | `200` + `User` | `404` |
| PUT | `/api/users/:id` | `{ name?, email? }` | `200` + `User` | `400`, `404`, `409` |
| DELETE | `/api/users/:id` | — | `204` sin body | `404` |

`Content-Type: application/json` en todas las respuestas con body.

## DES004 - Contrato de error uniforme

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "details": [{ "field": "email", "message": "Invalid email" }]
  }
}
```

Códigos: `VALIDATION_ERROR` (400), `USER_NOT_FOUND` (404), `EMAIL_ALREADY_EXISTS` (409), `INTERNAL_ERROR` (500).

Errores de dominio (`ValidationError`, `NotFoundError`, `ConflictError`) en `src/models/errors.ts`. El `errorMiddleware` traduce cualquier error al contrato; los no controlados se registran con logging estructurado y devuelven `INTERNAL_ERROR` sin stack trace (`CA008`).

## DES005 - Estrategia de validación

- Esquemas Zod en `src/validators/userValidator.ts`:
  - `createUserSchema`: `name` string 1–100 con `trim`; `email` email válido, máx 254, transformado a minúsculas.
  - `updateUserSchema`: objeto parcial con al menos un campo (`name` y/o `email`) y `strict()` para rechazar campos desconocidos.
- Middleware `validateBody(schema)` ejecuta `schema.parse(req.body)` y, ante error, propaga `ValidationError` con `details` (`RN002`, `RN003`, `RN005`).
- El middleware de validación no contiene lógica de negocio.

## DES006 - Repositorio en memoria

```typescript
export interface UserRepository {
  save(user: User): Promise<User>;
  findById(id: string): Promise<User | undefined>;
  findByEmail(email: string): Promise<User | undefined>;
  findAll(): Promise<User[]>;
  delete(id: string): Promise<boolean>;
}
```

`InMemoryUserRepository` implementa la interfaz con un `Map<string, User>`. `findByEmail` normaliza a minúsculas (`RN001`). Los métodos devuelven `Promise` para que la sustitución futura por persistencia real no rompa el contrato (`ADR002`).

## DES007 - Servicio y flujo de negocio

`UserService` depende únicamente de `UserRepository` (sin acoplamiento a Express) y aplica `RN001`–`RN007`:

- `create`: valida duplicado por email, genera `id` UUID, setea `createdAt`/`updatedAt`.
- `list`: devuelve `findAll()`.
- `getById`: devuelve el usuario o lanza `NotFoundError`.
- `update`: valida existencia, valida conflicto de email excluyendo el propio `id`, aplica solo los campos permitidos y actualiza `updatedAt`.
- `delete`: elimina o lanza `NotFoundError`.

Los controladores delegan en el servicio y usan `next(error)`; no contienen lógica de negocio (`rules/architecture/node.md`).

## DES008 - Estrategia de pruebas

- Jest + Supertest; archivos co-located en `tests/`.
- Unitarias: servicio (repositorio mockeado) y repositorio (instancia real en memoria).
- Integración: controlador montado en una app Express con Supertest.
- Cobertura mínima: 80 % statements, 70 % branches, 80 % functions, 80 % lines (`rules/testing/node.md`).
- Los tests de presentación mockean el servicio; los tests de integración usan el repositorio en memoria real.

## Impacto por capa

| Capa | Componentes | Tareas |
|---|---|---|
| Domain | `models/user.ts`, `models/errors.ts` | T002 |
| Application | `services/userService.ts` | T004 |
| Infrastructure | `repositories/inMemoryUserRepository.ts`, `utils/idGenerator.ts` | T003 |
| Presentation | `controllers`, `routes`, `middleware`, `app.ts`, `server.ts` | T006, T007, T008 |
| Cross-cutting | validación Zod, configuración, pruebas, documentación | T001, T005, T009, T010, T011 |

## Contratos y compatibilidad

- API sin versionado en ruta (`/api/users`); el alcance inicial no requiere `/v1`.
- Cambiar a persistencia real solo requiere una nueva implementación de `UserRepository`.
- Sin consumidores externos conocidos: proyecto greenfield.

## Consideraciones de seguridad y performance

- Validación de entrada en todos los endpoints (`rules/security/owasp-baseline.md`).
- Sin datos sensibles almacenados ni registrados en logs (`RN008`).
- Operaciones `findById`/`delete` en `O(1)`; `findByEmail` en `O(n)` sobre el conjunto en memoria (aceptable para el alcance).
- Sin secretos hardcodeados; `PORT` por variable de entorno.
