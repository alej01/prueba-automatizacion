# 02 - Requisitos y escenarios

## Metadata

| Campo | Valor |
|---|---|
| Feature | FEAT-0002 |
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
And el body contiene un id UUID v4, title "Clean Code", author "Robert C. Martin", isbn "9780132350884", publishedYear 2008, createdAt y updatedAt
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
When envío POST /api/books con title vacío
Then la respuesta es 400 Bad Request con code "VALIDATION_ERROR" y details[].field "title"
When envío POST /api/books con isbn de formato o dígito de control inválido
Then la respuesta es 400 Bad Request con details[].field "isbn"
When envío POST /api/books con publishedYear fuera de rango
Then la respuesta es 400 Bad Request con details[].field "publishedYear"
When envío POST /api/books con un campo desconocido
Then la respuesta es 400 Bad Request con code "VALIDATION_ERROR"
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
And el isbn, author y publishedYear no cambian
When envío PUT /api/books/{id} con un ISBN ya usado por otro libro
Then la respuesta es 409 Conflict con code "ISBN_ALREADY_EXISTS"
When envío PUT /api/books/{id} sin campos válidos
Then la respuesta es 400 Bad Request con code "VALIDATION_ERROR"
When envío PUT /api/books/{id-inexistente} con datos válidos
Then la respuesta es 404 Not Found con code "BOOK_NOT_FOUND"
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

### CA008 - Contrato de error uniforme

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

## Escenarios de testing

### Domain

- ESC-D01: Un `Book` creado expone `id`, `title`, `author`, `isbn`, `publishedYear`, `createdAt` y `updatedAt`.
- ESC-D02: La normalización de `isbn` elimina espacios/guiones y pasa `x` a `X` (`RN004`).
- ESC-D03: Los códigos de error de libros (`BOOK_NOT_FOUND`, `ISBN_ALREADY_EXISTS`) coexisten con los de usuarios sin colisión (`RN010`).

### Application / Service

- ESC-S01: `createBook` genera un `id` UUID v4 y setea `createdAt`/`updatedAt` (`CA001`, `RN006`).
- ESC-S02: `createBook` normaliza `title`, `author` e `isbn` antes de persistir (`RN002`, `RN003`, `RN004`).
- ESC-S03: `createBook` con ISBN duplicado lanza `ConflictError` (`CA002`, `RN001`).
- ESC-S04: `createBook` sin `publishedYear` persiste `null` (`RN005`).
- ESC-S05: `listBooks` devuelve todos los libros (`CA004`).
- ESC-S06: `getBookById` devuelve el libro o lanza `NotFoundError` (`CA005`, `RN007`).
- ESC-S07: `updateBook` aplica actualización parcial y actualiza `updatedAt` (`CA006`).
- ESC-S08: `updateBook` permite conservar el propio ISBN y rechaza el de otro libro (`RN001`).
- ESC-S09: `deleteBook` elimina el libro o lanza `NotFoundError` (`CA007`, `RN007`).

### Infrastructure / Repository

- ESC-I01: `save` persiste por `id` y `findById` recupera el mismo objeto.
- ESC-I02: `findByIsbn` compara sobre el ISBN normalizado (`RN001`, `RN004`).
- ESC-I03: `findAll` devuelve un arreglo con los libros almacenados (`CA004`).
- ESC-I04: `delete` elimina el registro y `findById` devuelve `undefined` (`CA007`).
- ESC-I05: El repositorio parte vacío en cada instancia (`RN008`).

### Presentation / Controller

- ESC-P01: `POST /api/books` válido → 201 y body del libro (`CA001`).
- ESC-P02: `POST /api/books` con ISBN duplicado → 409 (`CA002`).
- ESC-P03: `POST /api/books` inválido (title, isbn, publishedYear, campo desconocido) → 400 con details (`CA003`).
- ESC-P04: `GET /api/books` → 200 con arreglo, vacío y con datos (`CA004`).
- ESC-P05: `GET /api/books/:id` existente → 200; inexistente → 404 (`CA005`).
- ESC-P06: `PUT /api/books/:id` actualiza, detecta conflicto y valida vacío (`CA006`).
- ESC-P07: `DELETE /api/books/:id` existente → 204; inexistente → 404 (`CA007`).
- ESC-P08: Toda respuesta de error de libros respeta el contrato uniforme (`CA008`).
- ESC-P09: La suite de integración del CRUD de usuarios sigue en verde (`CA009`, `RN010`).

### Validator / Cross-cutting

- ESC-V01: `validateBody` reemplaza `req.body` por el payload normalizado.
- ESC-V02: `validateBody` traduce un `ZodError` a `ValidationError` con `details[{field,message}]`.
- ESC-V03: `validateBody` propaga errores no-Zod sin transformarlos.
