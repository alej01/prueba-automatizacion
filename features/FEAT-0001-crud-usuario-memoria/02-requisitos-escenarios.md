# 02 - Requisitos y escenarios

## Metadata

| Campo | Valor |
|---|---|
| Feature | FEAT-0001 |
| Versión | 1.0 |
| Fecha | 2026-10-01 |

### Historial de versiones

| Versión | Fecha | Cambio | Autor |
|---|---|---|---|
| 1.0 | 2026-10-01 | Versión inicial de requisitos, reglas y criterios de aceptación. | prepare_feature |

---

## Reglas de negocio

| ID | Regla |
|---|---|
| RN001 | El `email` de un usuario es único. La comparación es case-insensitive. Crear o actualizar con un email ya registrado responde `409 Conflict` (excepto cuando el email pertenece al mismo usuario que se actualiza). |
| RN002 | `name` es obligatorio, se normaliza con `trim` y debe tener entre 1 y 100 caracteres. |
| RN003 | `email` es obligatorio, debe tener formato de email válido y un máximo de 254 caracteres. Se normaliza a minúsculas. |
| RN004 | El `id` es un UUID v4 generado por el servidor. Cualquier `id` enviado por el cliente es ignorado y no se persiste. |
| RN005 | La actualización (`PUT`) es parcial sobre `name` y/o `email`; debe incluir al menos un campo válido. Se rechazan campos desconocidos con `400 Bad Request`. |
| RN006 | Una operación sobre un recurso inexistente responde `404 Not Found`. Aplica a `GET /api/users/:id`, `PUT /api/users/:id` y `DELETE /api/users/:id`. |
| RN007 | El almacenamiento es en memoria (`Map`) y es volátil: los datos no persisten entre reinicios del proceso. |
| RN008 | El modelo de usuario no incluye contraseñas ni datos de autenticación. La autenticación y la autorización están fuera del alcance. |

## Criterios de aceptación

### CA001 - Crear usuario

```gherkin
Given una API de usuarios en ejecución
And un payload válido con name "Ada Lovelace" y email "ada@example.com"
When envío POST /api/users con ese payload
Then la respuesta es 201 Created
And el body contiene un id UUID v4, name "Ada Lovelace", email "ada@example.com", createdAt y updatedAt
And el usuario queda disponible para GET /api/users/:id
```

### CA002 - Rechazar email duplicado

```gherkin
Given un usuario existente con email "ada@example.com"
When envío POST /api/users con email "ADA@example.com"
Then la respuesta es 409 Conflict
And el body sigue el contrato de error uniforme con code "EMAIL_ALREADY_EXISTS"
And no se crea un segundo usuario
```

### CA003 - Rechazar payload inválido

```gherkin
Given una API de usuarios en ejecución
When envío POST /api/users con name vacío o con email con formato inválido
Then la respuesta es 400 Bad Request
And el body sigue el contrato de error uniforme con code "VALIDATION_ERROR"
And details describe cada campo inválido
```

### CA004 - Listar usuarios

```gherkin
Given existen dos usuarios registrados
When envío GET /api/users
Then la respuesta es 200 OK
And el body es un arreglo con los dos usuarios
And el arreglo está vacío cuando no hay usuarios registrados
```

### CA005 - Consultar usuario por id

```gherkin
Given un usuario existente con id conocido
When envío GET /api/users/{id}
Then la respuesta es 200 OK con los datos del usuario
When envío GET /api/users/{id-inexistente}
Then la respuesta es 404 Not Found con code "USER_NOT_FOUND"
```

### CA006 - Actualizar usuario

```gherkin
Given un usuario existente
When envío PUT /api/users/{id} con el campo name
Then la respuesta es 200 OK
And el name queda actualizado
And updatedAt es posterior o igual al valor anterior
And el email no cambia
When envío PUT /api/users/{id} con un email ya usado por otro usuario
Then la respuesta es 409 Conflict
When envío PUT /api/users/{id} sin campos válidos
Then la respuesta es 400 Bad Request
When envío PUT /api/users/{id-inexistente} con datos válidos
Then la respuesta es 404 Not Found
```

### CA007 - Eliminar usuario

```gherkin
Given un usuario existente con id conocido
When envío DELETE /api/users/{id}
Then la respuesta es 204 No Content
And un GET posterior del mismo id responde 404 Not Found
When envío DELETE /api/users/{id-inexistente}
Then la respuesta es 404 Not Found con code "USER_NOT_FOUND"
```

### CA008 - Contrato de error uniforme

```gherkin
Given cualquier error de la API (400, 404, 409, 500)
When recibo la respuesta
Then el body tiene la forma { "error": { "code": string, "message": string, "details"?: array } }
And el código HTTP es coherente con el tipo de error
And no se exponen stack traces ni datos sensibles en el body
```

## Escenarios de testing

### Domain

- ESC-D01: Un `User` recién creado expone `id`, `name`, `email`, `createdAt` y `updatedAt`.
- ESC-D02: La normalización de `email` aplica `trim` y minúsculas.
- ESC-D03: Los errores de dominio (`NotFoundError`, `ConflictError`, `ValidationError`) exponen `code` y mensaje.

### Application / Service

- ESC-S01: `createUser` genera un `id` UUID y setea `createdAt`/`updatedAt` (cubre `CA001`).
- ESC-S02: `createUser` con email duplicado lanza `ConflictError` (cubre `CA002`, `RN001`).
- ESC-S03: `listUsers` devuelve todos los usuarios (cubre `CA004`).
- ESC-S04: `getUserById` devuelve el usuario o lanza `NotFoundError` (cubre `CA005`, `RN006`).
- ESC-S05: `updateUser` aplica actualización parcial y actualiza `updatedAt` (cubre `CA006`).
- ESC-S06: `updateUser` permite conservar el propio email y rechaza el de otro usuario (cubre `RN001`).
- ESC-S07: `deleteUser` elimina el usuario o lanza `NotFoundError` (cubre `CA007`).
- ESC-S08: Se ignoran `id`/`createdAt`/`updatedAt` enviados por el cliente (cubre `RN004`).

### Infrastructure / Repository

- ESC-I01: `save` persiste por `id` y `findById` recupera el mismo objeto.
- ESC-I02: `findByEmail` es case-insensitive (cubre `RN001`).
- ESC-I03: `findAll` devuelve un arreglo con los usuarios almacenados (cubre `CA004`).
- ESC-I04: `delete` elimina el registro y `findById` devuelve `undefined` (cubre `CA007`).
- ESC-I05: El repositorio parte vacío en cada instancia (cubre `RN007`).

### Presentation / Controller

- ESC-P01: `POST /api/users` válido → 201 y body del usuario (cubre `CA001`).
- ESC-P02: `POST /api/users` con email duplicado → 409 (cubre `CA002`).
- ESC-P03: `POST /api/users` inválido → 400 con details (cubre `CA003`).
- ESC-P04: `GET /api/users` → 200 con arreglo (cubre `CA004`).
- ESC-P05: `GET /api/users/:id` existente → 200; inexistente → 404 (cubre `CA005`).
- ESC-P06: `PUT /api/users/:id` actualiza, detecta conflicto y valida vacío (cubre `CA006`).
- ESC-P07: `DELETE /api/users/:id` existente → 204; inexistente → 404 (cubre `CA007`).
- ESC-P08: Toda respuesta de error respeta el contrato uniforme (cubre `CA008`).
