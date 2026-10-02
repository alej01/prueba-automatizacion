# 04 - Architecture Decision Records (ADR)

## Metadata

| Campo | Valor |
|---|---|
| Feature | FEAT-0001 |
| Versión | 1.0 |
| Fecha | 2026-10-01 |

### Historial de versiones

| Versión | Fecha | Cambio | Autor |
|---|---|---|---|
| 1.0 | 2026-10-01 | Versión inicial de decisiones arquitectónicas. | prepare_feature |

---

## ADR001 - Node.js + TypeScript strict + Express como stack HTTP

### Estado

Aceptada

### Contexto

El requerimiento pide un CRUD "en node". No existe código previo. `convenciones.md` define para Node.js: TypeScript strict, Express o Fastify, ESLint + Prettier, Jest + Supertest.

### Decisión

Implementar una API HTTP con Node.js 20, TypeScript en modo strict y Express como framework HTTP. Build con `tsc`. Lint con ESLint + Prettier.

### Alternativas consideradas

- JavaScript sin tipos: descartado por perder seguridad de tipos y contradecir las convenciones.
- Fastify: válido según convenciones, pero Express es la primera opción listada y cuenta con ejemplos de template en `templates/node/`.

### Consecuencias

- Positivas: tipado fuerte, alineación con convenciones y templates del workspace.
- Negativas: requiere paso de compilación (`tsc`) antes de ejecutar en producción.

### Referencias

- `convenciones.md` (Node.js)
- `rules/architecture/node.md`
- DES001, DES003

---

## ADR002 - Persistencia en memoria detrás de una interfaz de repositorio

### Estado

Aceptada

### Contexto

El requerimiento exige almacenamiento "en memoria" (sin base de datos). Se debe evitar acoplar la lógica de negocio a la estructura de almacenamiento.

### Decisión

Definir la interfaz `UserRepository` y proveer `InMemoryUserRepository` basada en `Map<string, User>`. Los métodos devuelven `Promise` para permitir una futura implementación persistente sin cambiar el servicio.

### Alternativas consideradas

- Uso directo de un `Map` en el servicio: descartado por acoplar negocio y almacenamiento y dificultar las pruebas.
- Base de datos embebida (SQLite): descartado, excede el alcance explícito del requerimiento.

### Consecuencias

- Positivas: separación de responsabilidades, testeabilidad, sustitución futura sencilla.
- Negativas: los datos se pierden al reiniciar (`RN007`), aceptado por alcance.

### Referencias

- RN007
- DES006, DES007

---

## ADR003 - Validación de entrada con Zod en middleware y errores centralizados

### Estado

Aceptada

### Contexto

`rules/architecture/node.md` exige validación con esquemas Zod en middleware y manejo de errores centralizado con `next(error)`. `rules/security/owasp-baseline.md` exige validación en todos los endpoints.

### Decisión

Validar `req.body` con esquemas Zod en middleware (`createUserSchema`, `updateUserSchema`) y centralizar la traducción de errores al contrato uniforme en `errorMiddleware`. Los errores de dominio se modelan como clases con `code`.

### Alternativas consideradas

- Validación manual dentro del controlador: descartada por duplicación y acoplamiento a HTTP.
- Librería de validación distinta de Zod: descartada por contradecir las convenciones.

### Consecuencias

- Positivas: validación declarativa, respuestas de error consistentes (`CA008`, `CA003`).
- Negativas: añade una dependencia (`zod`) y un middleware adicional.

### Referencias

- RN002, RN003, RN005
- DES004, DES005

---

## ADR004 - Excluir autenticación y gestión de contraseñas del alcance

### Estado

Aceptada

### Contexto

El requerimiento no menciona autenticación ni credenciales. Incorporarlas añadiría decisiones de seguridad (hashing, tokens, autorización) no solicitadas y bloquearían el alcance mínimo.

### Decisión

El modelo `User` no contiene `password` ni datos de autenticación. No se implementan endpoints de login, tokens ni control de acceso. Se documenta explícitamente como fuera de alcance.

### Alternativas consideradas

- Incluir `password` con hash: descartado por no estar solicitado y por requerir decisiones de seguridad adicionales.
- Autenticación JWT: descartada por exceder el alcance.

### Consecuencias

- Positivas: alcance acotado y entregable sin decisiones pendientes de seguridad.
- Negativas: la API queda abierta; aceptable solo en contexto de demo/desarrollo (`R002`).

### Referencias

- RN008
- `rules/security/owasp-baseline.md`
