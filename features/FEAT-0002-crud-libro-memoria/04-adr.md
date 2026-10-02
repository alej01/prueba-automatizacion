# 04 - Architecture Decision Records (ADR)

## Metadata

| Campo | Valor |
|---|---|
| Feature | FEAT-0002 |
| Versión | 1.0 |
| Fecha | 2026-10-01 |

### Historial de versiones

| Versión | Fecha | Cambio | Autor |
|---|---|---|---|
| 1.0 | 2026-10-01 | Versión inicial de decisiones arquitectónicas. | prepare_feature |

---

## ADR001 - Reutilizar el stack y la infraestructura existentes sin re-scaffold

### Estado

Aceptada

### Contexto

El repositorio ya cuenta con un proyecto Node.js + TypeScript strict + Express + Zod + Jest/Supertest entregado por FEAT-0001. El nuevo requerimiento ("añadir CRUD de libros en memoria también") es un incremento, no un proyecto nuevo.

### Decisión

Reutilizar el stack, scripts, configuración de lint/format/test y estructura por capas existentes. No se crea un proyecto nuevo ni se cambian dependencias.

### Alternativas consideradas

- Crear un segundo proyecto independiente: descartado, duplicaría infraestructura y rompería la composición única de la app.
- Migrar de framework o de validador: descartado por no aportar valor al alcance.

### Consecuencias

- Positivas: cero coste de scaffolding; coherencia con las convenciones vigentes.
- Negativas: el feature modifica archivos compartidos (`app.ts`, `models/errors.ts`, `userValidator.ts`), lo que exige cuidado para no romper usuarios (`RN010`).

### Referencias

- SUP002, RN010
- DES001, DES009
- `rules/architecture/node.md`

---

## ADR002 - CRUD de libros como módulo paralelo, sin generalización prematura

### Estado

Aceptada

### Contexto

Usuarios y libros son entidades distintas con reglas propias (unicidad por `email` vs por `isbn`). Se podría intentar un CRUD genérico reutilizable.

### Decisión

Implementar el CRUD de libros como un módulo paralelo (modelo, repositorio, servicio, controlador, rutas, validador propios), replicando el patrón de usuarios en lugar de extraer una abstracción genérica.

### Alternativas consideradas

- `BaseService`/`BaseRepository<T>` genérico: descartado por introducir complejidad (tipos genéricos, hooks de unicidad) sin necesidad demostrada con solo dos recursos.
- Extender `UserService` para manejar ambos recursos: descartado por violar la separación por capas y responsabilidades.

### Consecuencias

- Positivas: cada capa queda simple y testeable; bajo riesgo de regresión en usuarios.
- Negativas: existe duplicación estructural entre módulos; aceptada como deuda consciente y revisable si aparecen más recursos.

### Referencias

- SUP010
- DES001, DES007
- `rules/architecture/node.md`

---

## ADR003 - Extraer `validateBody` a un módulo compartido

### Estado

Aceptada

### Contexto

El middleware `validateBody` y la traducción de `ZodError` a `ValidationError` viven hoy en `userValidator.ts`. Reutilizarlos desde libros mediante una importación cruzada acoplaría dos features; duplicarlos generaría dos contratos de validación divergentes.

### Decisión

Extraer `validateBody`, `toValidationError` y `toErrorDetails` a `src/validators/validateBody.ts`. `userValidator.ts` conserva sus esquemas y **re-exporta** `validateBody` para mantener estable el import de `userRoutes.ts`.

### Alternativas consideradas

- Importar `validateBody` desde `userValidator` en `bookValidator`: descartado por acoplamiento entre features.
- Duplicar el middleware en `bookValidator`: descartado por riesgo de divergencia del contrato de error.

### Consecuencias

- Positivas: un único middleware de validación para ambos recursos; sin cambios en las rutas de usuarios.
- Negativas: se modifica un archivo compartido; mitigado por la suite de usuarios existente (`RN010`, `CA009`) y por tests unitarios dedicados de `validateBody`.

### Referencias

- RN010
- DES005
- `rules/architecture/node.md`

---

## ADR004 - Persistencia de libros en memoria detrás de una interfaz de repositorio

### Estado

Aceptada

### Contexto

El requerimiento exige almacenamiento "en memoria" y el proyecto ya estableció el patrón repositorio-en-memoria para usuarios.

### Decisión

Definir la interfaz `BookRepository` y proveer `InMemoryBookRepository` basada en `Map<string, Book>`. Los métodos devuelven `Promise` para permitir una implementación persistente futura sin cambiar el servicio.

### Alternativas consideradas

- Usar directamente un `Map` en el `BookService`: descartado por acoplar negocio y almacenamiento.
- Reutilizar `InMemoryUserRepository`: descartado, representa otra entidad.

### Consecuencias

- Positivas: separación de responsabilidades, testeabilidad, sustitución futura sencilla.
- Negativas: los libros se pierden al reiniciar (`RN008`), aceptado por alcance.

### Referencias

- RN008
- DES006, DES007
- ADR002

---

## ADR005 - Identidad y validación de ISBN

### Estado

Aceptada

### Contexto

Un ISBN puede escribirse con o sin guiones y en formato ISBN-10 o ISBN-13. La unicidad debe ser estable y la entrada debe validarse, pero el requerimiento no detalla el algoritmo.

### Decisión

Normalizar el ISBN antes de validar y persistir: eliminar espacios y guiones y convertir `x` a `X`. Exigir que sea un ISBN-10 válido (checksum mod 11) o un ISBN-13 válido (checksum mod 10). La unicidad (`RN001`) se evalúa sobre el ISBN normalizado.

### Alternativas consideradas

- Validar solo el formato sin dígito de control: descartado por permitir ISBN inventados; se documenta como `PA001` por si el negocio prefiere relajarlo.
- No normalizar y comparar cadenas exactas: descartado por generar duplicados falsos ("978-0-13-235088-4" vs "9780132350884").

### Consecuencias

- Positivas: identidad determinista y datos de entrada confiables.
- Negativas: se rechazan ISBN con dígito de control inválido; aceptado como comportamiento deseado (`SUP004`).

### Referencias

- RN001, RN004
- DES002, DES005

---

## ADR006 - Excluir campos bibliográficos adicionales del alcance

### Estado

Aceptada

### Contexto

El modelo solicitado se limita a `id`, `title`, `author`, `isbn`, `publishedYear` y marcas de tiempo. Podrían añadirse editorial, género, idioma, stock o disponibilidad.

### Decisión

Mantener el modelo mínimo solicitado. Cualquier campo adicional queda fuera de alcance y requeriría un Change Request.

### Alternativas consideradas

- Añadir editorial/género/stock: descartado por exceder el requerimiento e introducir reglas no solicitadas.

### Consecuencias

- Positivas: alcance acotado, verificable y sin decisiones de negocio inventadas.
- Negativas: el modelo es deliberadamente reducido; ampliable en el futuro.

### Referencias

- DES002
- RN002, RN003, RN004, RN005
