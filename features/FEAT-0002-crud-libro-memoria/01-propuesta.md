# 01 - Propuesta

## Metadata

| Campo | Valor |
|---|---|
| Feature | FEAT-0002 |
| Nombre | crud-libro-memoria |
| Autor | prepare_feature |
| Fecha creación | 2026-10-01 |
| Estado | SPEC_READY |
| Versión | 1.0 |

### Historial de versiones

| Versión | Fecha | Cambio | Autor |
|---|---|---|---|
| 1.0 | 2026-10-01 | Versión inicial derivada de `/enrich_hu`. | prepare_feature |

---

## Stack tecnológico detectado

| Capa | Tecnología | Evidencia |
|---|---|---|
| Backend | Node.js >=20 + Express 4.x | `package.json` (`express`), `src/app.ts` |
| Lenguaje | TypeScript 5.5 (strict) | `tsconfig.json` (`strict: true` y flags asociados) |
| Persistencia | En memoria (`Map`) | `src/repositories/inMemoryUserRepository.ts`, requerimiento "también" |
| Base de datos | No aplica | Requerimiento: sin base de datos |
| Framework HTTP | Express | `src/app.ts`, `src/routes/userRoutes.ts` |
| Validación | Zod 3.x | `src/validators/userValidator.ts` |
| Testing | Jest + Supertest | `package.json`, `tests/` |
| Lint/Format | ESLint + Prettier | `.eslintrc.json`, `.prettierrc` |
| Build tool | `tsc` | `package.json` script `build` |
| Docker | No incluido en el alcance | No se detecta `Dockerfile` ni `compose*.yml` |
| Java | No aplica | — |

## Tipo de proyecto

- [ ] Greenfield (proyecto nuevo)
- [x] Brownfield (código existente)

El repositorio ya contiene el feature **FEAT-0001 `crud-usuario-memoria`** en estado `DONE`, con un CRUD de usuarios en memoria por capas. Este feature debe **replicar el mismo patrón** para un nuevo recurso `Book`, sin alterar el comportamiento observable del CRUD de usuarios.

### Archivos existentes afectados

| Archivo existente | Cambio previsto | Riesgo de regresión |
|---|---|---|
| `src/app.ts` | Añadir composición y montaje de `/api/books` | Bajo (solo aditivo; se conservan usuarios) |
| `src/models/errors.ts` | Añadir `BOOK_NOT_FOUND`, `ISBN_ALREADY_EXISTS` y sus clases | Bajo (solo aditivo; no se modifican códigos existentes) |
| `src/validators/userValidator.ts` | Re-exportar `validateBody` desde un módulo compartido | Medio (se mitiga con la suite existente de usuarios) |
| `README.md` | Documentar la API de libros | Nulo (documentación) |

### Dependencias que podrían verse afectadas

- `src/routes/userRoutes.ts` importa `validateBody` desde `userValidator`; se preserva la misma ruta de import (re-export) para no romper el contrato interno.
- Suite `tests/controllers/userController.test.ts`: se ejecuta como regresión del CRUD de usuarios.

## Historia de usuario

**Como** desarrollador de servicios backend,
**quiero** exponer un CRUD de libros (`Book`) por HTTP con almacenamiento en memoria y el mismo contrato de errores uniforme del CRUD de usuarios,
**para** disponer de un segundo recurso funcional y verificable, reutilizando la arquitectura por capas ya existente sin duplicar infraestructura ni romper lo ya entregado.

## Descripción funcional

Se añade al servicio HTTP existente un recurso `Book` con operaciones de creación, consulta (individual y listado), actualización parcial y eliminación. Los libros se almacenan en memoria (`Map`) y se pierden al reiniciar el proceso.

Cada libro tiene: `id` (UUID v4 generado por el servidor), `title`, `author`, `isbn` (normalizado y único), `publishedYear` (opcional) y marcas de tiempo `createdAt`/`updatedAt` (ISO 8601).

La entrada se valida con esquemas Zod y los errores se gestionan con el middleware centralizado ya existente, extendiendo el catálogo de códigos con `BOOK_NOT_FOUND` (404) e `ISBN_ALREADY_EXISTS` (409).

## Alcance

- Modelo de dominio `Book` y tipos de request (`CreateBookRequest`, `UpdateBookRequest`).
- Extensión del catálogo de errores de dominio con los códigos de libro.
- Repositorio en memoria `InMemoryBookRepository` detrás de la interfaz `BookRepository`.
- `BookService` con la lógica de negocio del CRUD y las reglas `RN001`–`RN010`.
- Validación de entrada con Zod y normalización/validación de ISBN (`RN004`).
- Extracción del middleware de validación a un módulo compartido reutilizado por usuarios y libros.
- Controlador delgado `bookController` y rutas REST `/api/books`.
- Composición de dependencias de libros en `app.ts`.
- Pruebas unitarias (servicio, repositorio, middleware de validación) e integración (controlador con Supertest).
- Regresión del CRUD de usuarios sobre la suite existente.
- Documentación de la API de libros y del contrato de error en `README.md`.

## Fuera de alcance

- Interfaz de usuario / frontend.
- Persistencia real (base de datos, archivos, cache externo) (`RN008`).
- Campos adicionales del dominio bibliográfico: editorial, género, idioma, stock, portada, descripción, préstamos (`ADR006`).
- Paginación, filtros, ordenamiento y búsqueda avanzada en el listado.
- Autenticación, autorización y cuotas (no existen para usuarios y tampoco se añaden aquí).
- Versionado de API (`/v1`), contenerización Docker y pipelines CI/CD.
- Modificación de artefactos del feature FEAT-0001.

## Reglas de negocio

| ID | Regla |
|---|---|
| RN001 | El `isbn` de un libro es único sobre su forma normalizada (`RN004`). Crear o actualizar con un ISBN ya registrado responde `409 Conflict` (`ISBN_ALREADY_EXISTS`), salvo cuando el ISBN pertenece al mismo libro que se actualiza. |
| RN002 | `title` es obligatorio, se normaliza con `trim` y debe tener entre 1 y 200 caracteres. |
| RN003 | `author` es obligatorio, se normaliza con `trim` y debe tener entre 1 y 150 caracteres. |
| RN004 | `isbn` es obligatorio, se normaliza eliminando espacios y guiones y pasando `x` a `X`, y debe ser un ISBN-10 o ISBN-13 válido (incluido el dígito de control). |
| RN005 | `publishedYear` es opcional: si se envía, debe ser un entero entre 1450 y el año actual + 1; si se omite en la creación, se persiste como `null`. |
| RN006 | El `id` es un UUID v4 generado por el servidor. Cualquier `id` enviado por el cliente es ignorado y no se persiste. |
| RN007 | Una operación sobre un libro inexistente responde `404 Not Found` (`BOOK_NOT_FOUND`). Aplica a `GET /api/books/:id`, `PUT /api/books/:id` y `DELETE /api/books/:id`. |
| RN008 | El almacenamiento de libros es en memoria (`Map`) y es volátil: los datos no persisten entre reinicios del proceso. |
| RN009 | La actualización (`PUT`) es parcial sobre `title`, `author`, `isbn` y/o `publishedYear`; debe incluir al menos un campo válido y rechaza campos desconocidos con `400 Bad Request`. |
| RN010 | La incorporación de libros no altera el comportamiento observable del CRUD de usuarios ni su contrato de error: los códigos y rutas existentes se mantienen. |

## Criterios de aceptación

### CA001 - Crear libro

```gherkin
Given una API con el recurso de libros en ejecución
And un payload válido con title "Clean Code", author "Robert C. Martin", isbn "978-0-13-235088-4" y publishedYear 2008
When envío POST /api/books con ese payload
Then la respuesta es 201 Created
And el body contiene un id UUID v4, title, author, isbn normalizado "9780132350884", publishedYear 2008, createdAt y updatedAt
And el libro queda disponible para GET /api/books/{id}
```

### CA002 - Rechazar ISBN duplicado

```gherkin
Given un libro existente con isbn "9780132350884"
When envío POST /api/books con isbn "978-0-13-235088-4"
Then la respuesta es 409 Conflict
And el body sigue el contrato de error uniforme con code "ISBN_ALREADY_EXISTS"
And no se crea un segundo libro
```

### CA003 - Rechazar payload inválido

```gherkin
Given una API de libros en ejecución
When envío POST /api/books con title vacío, con ISBN de formato inválido o con publishedYear fuera de rango
Then la respuesta es 400 Bad Request
And el body sigue el contrato de error uniforme con code "VALIDATION_ERROR"
And details describe cada campo inválido
And se rechazan campos desconocidos
```

### CA004 - Listar libros

```gherkin
Given existen dos libros registrados
When envío GET /api/books
Then la respuesta es 200 OK
And el body es un arreglo con los dos libros
And el arreglo está vacío cuando no hay libros registrados
```

### CA005 - Consultar libro por id

```gherkin
Given un libro existente con id conocido
When envío GET /api/books/{id}
Then la respuesta es 200 OK con los datos del libro
When envío GET /api/books/{id-inexistente}
Then la respuesta es 404 Not Found con code "BOOK_NOT_FOUND"
```

### CA006 - Actualizar libro

```gherkin
Given un libro existente
When envío PUT /api/books/{id} con el campo title
Then la respuesta es 200 OK
And el title queda actualizado
And updatedAt es posterior o igual al valor anterior
And los demás campos no cambian
When envío PUT /api/books/{id} con un ISBN ya usado por otro libro
Then la respuesta es 409 Conflict con code "ISBN_ALREADY_EXISTS"
When envío PUT /api/books/{id} sin campos válidos
Then la respuesta es 400 Bad Request
When envío PUT /api/books/{id-inexistente} con datos válidos
Then la respuesta es 404 Not Found
```

### CA007 - Eliminar libro

```gherkin
Given un libro existente con id conocido
When envío DELETE /api/books/{id}
Then la respuesta es 204 No Content
And un GET posterior del mismo id responde 404 Not Found
When envío DELETE /api/books/{id-inexistente}
Then la respuesta es 404 Not Found con code "BOOK_NOT_FOUND"
```

### CA008 - Contrato de error uniforme y tipos de ISBN

```gherkin
Given cualquier error del recurso de libros (400, 404, 409, 500)
When recibo la respuesta
Then el body tiene la forma { "error": { "code": string, "message": string, "details"?: array } }
And el código HTTP es coherente con el tipo de error
And no se exponen stack traces ni datos sensibles en el body
```

### CA009 - Compatibilidad con el CRUD de usuarios

```gherkin
Given la API con libros incorporados
When ejecuto la suite existente del CRUD de usuarios
Then todos los tests de usuarios siguen pasando sin cambios
And las rutas /api/users y sus códigos de error permanecen intactos
```

## Impacto por capa

| Capa | Componentes | Nuevo / Modificado |
|---|---|---|
| Domain | `models/book.ts`, `models/errors.ts` | Nuevo / Modificado |
| Application | `services/bookService.ts` | Nuevo |
| Infrastructure | `repositories/inMemoryBookRepository.ts`, `utils/idGenerator.ts` | Nuevo / Reutilizado |
| Presentation | `controllers/bookController.ts`, `routes/bookRoutes.ts`, `app.ts` | Nuevo / Modificado |
| Cross-cutting | `validators/validateBody.ts`, `validators/bookValidator.ts`, `validators/userValidator.ts` | Nuevo / Modificado |
| Tests | `tests/services`, `tests/repositories`, `tests/controllers`, `tests/validators` | Nuevo |
| Docs | `README.md` | Modificado |

## Escenarios de testing

- **Domain:** forma del modelo `Book`, normalización de ISBN, códigos de error de libros.
- **Application:** reglas del `BookService` (creación, duplicado, listado, consulta, actualización parcial, conflicto, eliminación).
- **Infrastructure:** `InMemoryBookRepository` (save/findById/findByIsbn/findAll/delete, instancia vacía).
- **Presentation:** los cinco endpoints, el contrato uniforme de error y la regresión de usuarios.

## Impacto técnico estimado

- **Backend:** 6 archivos nuevos en `src/` y 3 archivos existentes modificados de forma aditiva.
- **Base de datos:** ninguno.
- **Integraciones:** ninguna nueva.
- **Seguridad:** validación de entrada en todos los endpoints; sin datos sensibles; sin secretos.
- **Logs:** se reutiliza el logging estructurado del `errorMiddleware`; no se añaden logs nuevos.
- **Pruebas:** +2 suites unitarias, +1 suite de middleware, +1 suite de integración, reutilización de la suite de usuarios.
- **Documentación:** actualización de `README.md`.
- **Docker:** no aplica.

## Riesgos

| ID | Riesgo | Clasificación |
|---|---|---|
| R001 | Pérdida de libros al reiniciar el proceso (almacenamiento volátil). | RIESGO ACEPTABLE (documentado en `RN008`) |
| R002 | Regresión en usuarios por extraer `validateBody` a un módulo compartido. | RIESGO ACEPTABLE (suite de usuarios existente + `RN010` + `ADR003`) |
| R003 | Ambigüedad en la validación de ISBN (checksum vs solo formato). | RIESGO ACEPTABLE (se resuelve con `SUP004`; ver `PA001`) |
| R004 | ISBN mal normalizado que oculta duplicados. | RIESGO ACEPTABLE (normalización determinista en `RN004` con test dedicado) |
| R005 | Crecimiento del `Map` sin límite en procesos de larga duración. | RIESGO ACEPTABLE (fuera de alcance la retención/limpieza) |

## Supuestos

- SUP001: El requerimiento "Añadir CRUD de libros en memoria también" se refiere a una **API HTTP REST** análoga a `/api/users`, no a un CLI ni a una librería.
- SUP002: Se **reutiliza** el stack y la infraestructura existentes (Express, TypeScript strict, Zod, Jest + Supertest); no se re-scaffoldea el proyecto.
- SUP003: El recurso se expone en la ruta base **`/api/books`**, paralela a `/api/users`.
- SUP004: El `isbn` se valida como **ISBN-10 o ISBN-13 con dígito de control**, y se normaliza quitando espacios/guiones y pasando `x` a `X`.
- SUP005: `publishedYear` es **opcional** y se persiste como `null` cuando no se envía.
- SUP006: La actualización (`PUT`) es **parcial** sobre `title`, `author`, `isbn` y/o `publishedYear`.
- SUP007: El listado `GET /api/books` devuelve un arreglo completo, sin paginación.
- SUP008: La unicidad de ISBN se evalúa contra el ISBN normalizado (equivalencias con/sin guiones son el mismo ISBN).
- SUP009: El contrato de error es el mismo ya existente: `{ "error": { "code", "message", "details"? } }`, ampliando el catálogo con `BOOK_NOT_FOUND` e `ISBN_ALREADY_EXISTS`.
- SUP010: No se crea una abstracción CRUD genérica; el CRUD de libros es un módulo paralelo al de usuarios (`ADR002`).
- SUP011: La cobertura mínima de pruebas es 80 % statements / 70 % branches / 80 % functions / 80 % lines, según `rules/testing/node.md`.

## Preguntas abiertas

- PA001: ¿Es aceptable validar el dígito de control del ISBN en lugar de solo el formato? — **No bloqueante**, se asume `SUP004` (validación completa) y se documenta para revisión humana.
- PA002: ¿`publishedYear` debería ser obligatorio? — **No bloqueante**, se asume `SUP005` (opcional, `null` si falta).
- PA003: ¿Debe generalizarse un CRUD reutilizable en lugar de duplicar el patrón? — **No bloqueante**, se asume `SUP010`/`ADR002` (módulo paralelo, sin generalización prematura).

> No se identifican preguntas bloqueantes. Los supuestos `SUP001`–`SUP011` quedan trazados para validación humana en la revisión del plan.

## Recomendación técnica inicial

1. Extender el modelo de dominio y el catálogo de errores con los tipos de libro.
2. Implementar el repositorio en memoria `BookRepository`/`InMemoryBookRepository`.
3. Implementar `BookService` con las reglas `RN001`–`RN010`.
4. Extraer el middleware `validateBody` a un módulo compartido y añadir los esquemas Zod de libro.
5. Implementar el controlador delgado y las rutas `/api/books`.
6. Componer el grafo de dependencias de libros en `app.ts`.
7. Cubrir con pruebas unitarias (servicio, repositorio, middleware) e integración (Supertest).
8. Documentar la API de libros y validar la regresión de usuarios.

Consideraciones de performance/seguridad: operaciones `O(1)` sobre `Map`; normalización y validación determinista de ISBN; validación de entrada obligatoria; sin datos sensibles ni secretos.
