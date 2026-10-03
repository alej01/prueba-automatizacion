# 07 - Archive

| Campo | Valor |
|---|---|
| Feature | FEAT-0002 - crud-libro-memoria |
| Fecha de cierre | 2026-10-01 |
| Estado | CERRADO (pendiente de commit) |
| Verificación | APPROVED_WITH_OBSERVATIONS |
| Code review | APPROVED_WITH_OBSERVATIONS |

## Resumen final del feature

Se incorporó un CRUD completo de Libros en memoria (`/api/books`) al proyecto existente,
replicando la arquitectura por capas y el contrato de error uniforme del CRUD de usuarios.
El recurso expone crear, listar, consultar, actualizar y eliminar libros, con ISBN
normalizado y validado por dígito de control, unicidad de ISBN, `publishedYear` opcional y
timestamps gestionados por el servidor. La suite completa pasa 115/115 tests con cobertura
de statements 99.34 %, y el CRUD de usuarios permanece intacto.

## Problema resuelto

El proyecto solo ofrecía gestión de usuarios. Se necesitaba añadir la gestión de libros en
memoria sin romper ni duplicar la arquitectura existente, manteniendo el mismo estilo de
validación, manejo de errores y pruebas.

## Solución implementada

- Nuevo dominio `Book` y códigos de error `BOOK_NOT_FOUND` (404) e `ISBN_ALREADY_EXISTS` (409).
- Persistencia en memoria `InMemoryBookRepository` detrás de la interfaz `BookRepository`.
- `BookService` con reglas de negocio (unicidad de ISBN, actualización parcial, timestamps).
- Esquemas Zod `createBookSchema`/`updateBookSchema` con normalización y checksum de ISBN-10/13.
- Middleware `validateBody` extraído a módulo compartido y reutilizado por usuarios y libros.
- `bookController` delgado + `bookRoutes` montadas en `/api/books` dentro de `createApp`.
- README ampliado con endpoints, modelo, reglas de ISBN y catálogo de errores.

## Stack tecnológico utilizado

| Componente | Tecnología | Versión |
|---|---|---|
| Runtime | Node.js | >= 20 |
| Lenguaje | TypeScript (strict) | 5.5 |
| Framework HTTP | Express | 4.19 |
| Validación | Zod | 3.23 |
| IDs | uuid | 10.0 |
| Tests | Jest + Supertest | 29.7 / 7.0 |
| Calidad | ESLint + Prettier | 8.57 / 3.3 |

## Arquitectura aplicada

Arquitectura por capas con dependencias dirigidas hacia el dominio
(presentation -> application -> domain, infrastructure detrás de interfaces):

```text
InMemoryBookRepository -> BookService -> BookController -> bookRoutes (/api/books)
```

Trade-offs aceptados:
- Persistencia volátil en memoria (`Map`): los datos no sobreviven a reinicios (RN008), aceptable
  para el alcance demo/desarrollo.
- Sin autenticación: consistente con FEAT-0001 (fuera de alcance, ADR).
- `validateBody` compartido en lugar de duplicarlo por recurso (ADR003).

## Archivos modificados

| Archivo | Acción | Descripción |
|---|---|---|
| src/models/book.ts | Creado | Interfaces Book / CreateBookRequest / UpdateBookRequest |
| src/models/errors.ts | Modificado | Códigos y clases de error de libros (sin tocar usuarios) |
| src/repositories/inMemoryBookRepository.ts | Creado | BookRepository + implementación Map |
| src/services/bookService.ts | Creado | Reglas de negocio del CRUD de libros |
| src/validators/validateBody.ts | Creado | Middleware de validación compartido |
| src/validators/userValidator.ts | Modificado | Re-exporta validateBody (imports de usuario intactos) |
| src/validators/bookValidator.ts | Creado | Esquemas Zod de libros + checksum ISBN |
| src/controllers/bookController.ts | Creado | Controlador HTTP delgado |
| src/routes/bookRoutes.ts | Creado | Router de los cinco endpoints |
| src/app.ts | Modificado | Composición del grafo y montaje /api/books |
| README.md | Modificado | Documentación de libros y errores ampliados |
| tests/services/bookService.test.ts | Creado | Tests unitarios del servicio |
| tests/repositories/inMemoryBookRepository.test.ts | Creado | Tests del repositorio |
| tests/validators/validateBody.test.ts | Creado | Tests del middleware y esquemas |
| tests/controllers/bookController.test.ts | Creado | Tests de integración de endpoints + regresión usuarios |

## Endpoints / contratos afectados

| Endpoint | Método | Acción | Descripción |
|---|---|---|---|
| /api/books | POST | Nuevo | Crea un libro (201); 400/409 |
| /api/books | GET | Nuevo | Lista libros (200) |
| /api/books/:id | GET | Nuevo | Consulta libro (200); 404 BOOK_NOT_FOUND |
| /api/books/:id | PUT | Nuevo | Actualiza parcialmente (200); 400/404/409 |
| /api/books/:id | DELETE | Nuevo | Elimina libro (204); 404 BOOK_NOT_FOUND |
| /api/users/* | * | Sin cambios | Contrato y comportamiento preservados (RN010) |

Contrato de error uniforme: `{ error: { code, message, details? } }`, sin stack traces.

## Cambios en base de datos

No aplica: almacenamiento en memoria (`Map`), sin base de datos ni migraciones.

## Configuración requerida

- Variable de entorno `PORT` (opcional, por defecto 3000). Sin secretos.
- Sin nuevas dependencias: se reutilizan express, zod, uuid y el toolchain existente.

## Pruebas disponibles

- Unitarias: `tests/services/bookService.test.ts`, `tests/repositories/inMemoryBookRepository.test.ts`,
  `tests/validators/validateBody.test.ts`.
- Integración: `tests/controllers/bookController.test.ts` (Supertest sobre `createApp()`).
- Regresión: `tests/controllers/userController.test.ts` (21 tests, sin cambios).
- Total: 115/115 PASSED. Cobertura: statements 99.34 %, branches 98.3 %, functions 100 %, lines 99.31 %.

## Cómo validar manualmente

```bash
npm install
npm run build
npm test
npm run lint
npm run dev            # servidor en http://localhost:3000

# Crear un libro
curl -X POST http://localhost:3000/api/books -H "Content-Type: application/json" \
  -d '{"title":"Clean Code","author":"Robert C. Martin","isbn":"978-0-13-235088-4","publishedYear":2008}'

# Listar / consultar / actualizar / eliminar
curl http://localhost:3000/api/books
curl http://localhost:3000/api/books/<id>
curl -X PUT http://localhost:3000/api/books/<id> -H "Content-Type: application/json" -d '{"title":"Clean Code 2e"}'
curl -X DELETE http://localhost:3000/api/books/<id>
```

## Decisiones de arquitectura finales

| Decisión | Alternativas | Elegida | Razón |
|---|---|---|---|
| Persistencia | BD real | Map en memoria | Alcance demo, sin infraestructura |
| Validación | Manual por endpoint | Zod + validateBody compartido | Consistencia y reutilización (ADR003) |
| ISBN | Solo formato | Normalización + checksum ISBN-10/13 | Evita duplicados e ISBN inventados (ADR005) |
| Errores | Respuestas ad-hoc | Contrato uniforme con errorMiddleware | Coherencia con usuarios (ADR001) |
| Público `publishedYear` | Obligatorio | Opcional, `null` por defecto | Refleja libros sin año conocido (RN005) |

## Riesgos residuales

- RIESGO ACEPTABLE: comprobación de unicidad de ISBN no atómica (check-then-save) — en Node
  monohilo el interleaving es improbable y es el mismo patrón preexistente del CRUD de usuarios.
- RIESGO ACEPTABLE: sin autenticación/autorización (fuera de alcance, igual que FEAT-0001).
- RIESGO ACEPTABLE: datos volátiles en memoria.

## Limitaciones conocidas

- Los datos se pierden al reiniciar el proceso.
- No hay paginación ni filtros en `GET /api/books`.
- `publishedYear` se calcula con el año actual en tiempo de carga del módulo.

## Deuda técnica

| Ítem | Razón | Impacto | Prioridad |
|---|---|---|---|
| `normalizeIsbn` duplicado en 3 módulos | Evitar acoplamiento entre capas | Riesgo de deriva si cambia la regla | Baja |
| `format:check` falla por CRLF en 16 ficheros preexistentes | Formato histórico del repo | Ruido en CI | Baja |
| SonarQube no integrado | No disponible en el entorno | Sin análisis estático automático | Baja |

## Métricas de calidad

- Build (`tsc`): EXIT=0.
- Tests: 115/115 PASSED (0 fallos).
- Cobertura: 99.34 % statements / 98.3 % branches / 100 % functions / 99.31 % lines.
- ESLint: EXIT=0. SonarQube: PENDING (no disponible).

## Información útil para soporte

- Errores esperados: `VALIDATION_ERROR` (400), `BOOK_NOT_FOUND` (404), `ISBN_ALREADY_EXISTS` (409),
  `INTERNAL_ERROR` (500). No se exponen stack traces.
- Normalización de ISBN: se eliminan espacios y guiones y la `x` final pasa a `X`; la unicidad se
  evalúa sobre la forma normalizada (`978-0-13-235088-4` y `9780132350884` colisionan).
- Runbook: `npm run build && npm start` (producción) o `npm run dev` (desarrollo).

## Checklist de cierre

- [x] Todos los criterios de aceptación cumplidos (CA001-CA009 PASS)
- [x] Tests pasan (115/115)
- [x] Documentación actualizada (README)
- [x] No hay deuda técnica no documentada
