# 04 - Architecture Decision Records (ADR)

## Metadata

| Campo | Valor |
|---|---|
| Feature | FEAT-0003 |
| Versión | 1.0 |
| Fecha | 2026-10-02 |

### Historial de versiones

| Versión | Fecha | Cambio | Autor |
|---|---|---|---|
| 1.0 | 2026-10-02 | Versión inicial de decisiones arquitectónicas. | prepare_feature |

---

## ADR001 - Reutilizar el stack y la infraestructura existentes sin re-scaffold

### Estado

Aceptada

### Contexto

El repositorio ya cuenta con un proyecto Node.js + TypeScript strict + Express + Zod + Jest/Supertest entregado por FEAT-0001 y ampliado por FEAT-0002. El nuevo requerimiento ("API para reservas") es un incremento, no un proyecto nuevo.

### Decisión

Reutilizar el stack, scripts, configuración de lint/format/test y estructura por capas existentes. No se crea un proyecto nuevo ni se cambian dependencias.

### Alternativas consideradas

- Crear un segundo proyecto independiente: descartado, duplicaría infraestructura y rompería la composición única de la app.
- Migrar de framework o de validador: descartado por no aportar valor al alcance.

### Consecuencias

- Positivas: cero coste de scaffolding; coherencia con las convenciones vigentes.
- Negativas: el feature modifica archivos compartidos (`app.ts`, `models/errors.ts`), lo que exige cuidado para no romper usuarios ni libros (`RN010`).

### Referencias

- SUP002, RN010
- DES001, DES009
- `rules/architecture/node.md`

---

## ADR002 - Reservas como módulo paralelo sobre interfaces de repositorio existentes

### Estado

Aceptada

### Contexto

Reservas relaciona usuarios y libros. Se podría intentar un CRUD genérico reutilizable o incrustar la lógica de reservas dentro de `UserService`/`BookService`. Además, la reserva necesita verificar la existencia de usuario y libro.

### Decisión

Implementar reservas como un módulo paralelo (modelo, repositorio, servicio, controlador, rutas, validador propios), replicando el patrón de usuarios/libros. `ReservationService` depende de `ReservationRepository` **y** de las abstracciones `UserRepository`/`BookRepository` para verificar referencias, sin acceder a sus implementaciones concretas. No se añade ningún campo de reservas a `User` ni a `Book`.

### Alternativas consideradas

- `BaseService`/`BaseRepository<T>` genérico: descartado por introducir complejidad sin necesidad demostrada.
- Incrustar reservas en `UserService` o `BookService`: descartado por violar la separación por capas y mezclar responsabilidades.
- Añadir `reservedBooks` al modelo `User`: descartado por duplicar el estado (fuente de verdad única en reservas) y acoplar los modelos.

### Consecuencias

- Positivas: cada capa queda simple y testeable; bajo riesgo de regresión; `User` y `Book` permanecen inalterados.
- Negativas: duplicación estructural entre módulos; aceptada como deuda consciente.

### Referencias

- SUP010, RN001
- DES001, DES007, DES009
- `rules/architecture/node.md`

---

## ADR003 - Liberar una reserva cambia su estado a RELEASED en lugar de eliminarla

### Estado

Aceptada

### Contexto

El requerimiento pide "liberar reserva". Las opciones son eliminar físicamente el registro (como el `DELETE` de usuarios/libros, que responde `204`) o conservarlo con un estado que indique que ya no está activa.

### Decisión

Modelar `Reservation` con `status` (`ACTIVE` | `RELEASED`). Liberar cambia el estado a `RELEASED`, refresca `updatedAt` y devuelve `200` con la reserva. Una reserva `RELEASED` deja de contar como activa, por lo que el libro vuelve a estar disponible y el par usuario+libro puede volver a reservarse.

### Alternativas consideradas

- Eliminar físicamente la reserva y responder `204`: descartado porque pierde el histórico y hace indistinguible "nunca reservado" de "reservado y liberado", dificultando la consulta de reservas.
- Añadir un endpoint `PATCH` de estado: descartado por exceder las operaciones mínimas solicitadas (reservar, liberar, consultar).

### Consecuencias

- Positivas: histórico completo; consultas más ricas; reintento de reserva sencillo.
- Negativas: el `DELETE` de reservas difiere del de usuarios/libros (`200` + estado vs `204` + eliminación); se documenta explícitamente para evitar confusión.

### Referencias

- SUP004, RN005
- DES002, DES003, DES007

---

## ADR004 - Validación Zod estricta y reutilización de `validateBody`

### Estado

Aceptada

### Contexto

La entrada de reservas es referencial (`userId`, `bookId`) y el listado acepta un query param `userId`. El proyecto ya extrajo `validateBody` a un módulo compartido (`ADR003` de FEAT-0002).

### Decisión

Definir `createReservationSchema` (cuerpo, estricto, `userId`/`bookId` UUID v4) y `reservationListQuerySchema` (query, estricto, `userId` opcional UUID v4) en `reservationValidator.ts`, reutilizando el middleware `validateBody` para traducir `ZodError` a `ValidationError` con `details`. No se duplica el middleware.

### Alternativas consideradas

- Validar manualmente en el controlador: descartado por dispersar la validación y duplicar la traducción de errores.
- Validar solo el formato "no vacío": descartado por permitir referencias con forma inválida; se exige UUID (`SUP008`).

### Consecuencias

- Positivas: un único contrato de validación para todos los recursos; `details` consistentes.
- Negativas: `validateBody` está tipado para `req.body`; el query requiere aplicarlo sobre `{ ...req.query }`, detalle interno sin impacto en el contrato.

### Referencias

- RN007, RN009
- DES005
- ADR003 de FEAT-0002

---

## ADR005 - Sin autenticación ni autorización en reservas

### Estado

Aceptada

### Contexto

Reservar un libro "para un usuario" podría sugerir controlar que el solicitante sea ese usuario. El proyecto no tiene autenticación, decisión ya registrada en FEAT-0001 (`ADR004`).

### Decisión

No implementar autenticación ni autorización. Cualquier cliente puede crear una reserva para cualquier usuario existente y liberarla. La seguridad se limita a la validación de entrada y al contrato de error uniforme.

### Alternativas consideradas

- Introducir API keys o JWT solo para reservas: descartado por inconsistencia con el resto de la API y por exceder el alcance.
- Imponer un header con el `userId` del solicitante: descartado por ser una autenticación débil no solicitada.

### Consecuencias

- Positivas: alcance acotado y coherente con el resto de recursos.
- Negativas: la API queda abierta; aceptable únicamente en demo/desarrollo.

### Referencias

- SUP011
- RN001
- `ADR004` de FEAT-0001
