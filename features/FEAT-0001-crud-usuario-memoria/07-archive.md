# 07 - Archive

## Metadata

| Campo | Valor |
|---|---|
| Feature | FEAT-0001 - crud-usuario-memoria |
| Fecha de archivo | 2026-10-01 |
| Estado de verificación | `APPROVED_WITH_OBSERVATIONS` |
| Rama | `feat/n8n-680` |
| Commit | UNCOMMITTED (archivado antes del commit del feature) |

---

## Resumen final del feature

Se entregó una API REST de gestión de usuarios (CRUD) implementada en Node.js 20 + TypeScript strict con Express, con persistencia en memoria (`Map<string, User>`) detrás de una interfaz de repositorio. La API expone 5 endpoints bajo `/api/users`, valida toda entrada con esquemas Zod y responde con un contrato de error uniforme. La suite de pruebas (49 tests, 3 suites) pasa al 100 % con cobertura de statements 99.39 % y branches 93.54 %.

## Problema resuelto

No existía ningún servicio para gestionar usuarios. Se necesitaba un CRUD funcional, sin base de datos, que sirviera como base demostrable y testeable, evitando acoplar la lógica de negocio al medio de almacenamiento y garantizando validación de entrada y errores consistentes.

## Solución implementada

- Modelo de dominio `User` con `id` (UUID v4) y timestamps ISO 8601, sin campos de autenticación.
- Repositorio en memoria `InMemoryUserRepository` tras la interfaz `UserRepository` (métodos `Promise`).
- Servicio `UserService` con las reglas de negocio (unicidad de email case-insensitive, actualización parcial, 404/409).
- Capa HTTP Express: controlador delgado, router `/api/users`, middleware de validación Zod, `notFoundMiddleware` y `errorMiddleware` centralizado.
- Documentación de uso en `README.md`.

## Stack tecnológico utilizado

| Componente | Tecnología | Versión |
|---|---|---|
| Runtime | Node.js | >= 20 (probado en v24.21.0) |
| Lenguaje | TypeScript (strict) | ^5.5.2 |
| Framework HTTP | Express | ^4.19.2 |
| Validación | Zod | ^3.23.8 |
| Identificadores | uuid | ^10.0.0 |
| Testing | Jest + ts-jest + Supertest | ^29.7.0 / ^29.1.5 / ^7.0.0 |
| Lint / formato | ESLint + Prettier | ^8.57.0 / ^3.3.2 |

## Arquitectura aplicada

Arquitectura en capas con dependencias hacia dentro (Presentation → Application → Domain, con Infrastructure detrás de una interfaz):

```text
routes -> controllers -> services -> repositories (interfaz)
                                \-> models (dominio)
```

- Composición única de dependencias en `src/app.ts` (`InMemoryUserRepository -> UserService -> UserController -> userRoutes`).
- Sin lógica de negocio en controladores; sin acoplamiento a HTTP en el servicio.
- Trade-off aceptado: la volatilidad de los datos (se pierden al reiniciar) se compensa con una sustitución futura sencilla del repositorio.

## Archivos modificados

### Domain

| Archivo | Acción | Descripción |
|---|---|---|
| `src/models/user.ts` | Creado | Interfaces `User`, `CreateUserRequest`, `UpdateUserRequest` |
| `src/models/errors.ts` | Creado | `AppError`, `ValidationError`, `NotFoundError`, `ConflictError` |

### Application

| Archivo | Acción | Descripción |
|---|---|---|
| `src/services/userService.ts` | Creado | Reglas de negocio CRUD (RN001-RN007) |

### Infrastructure

| Archivo | Acción | Descripción |
|---|---|---|
| `src/repositories/inMemoryUserRepository.ts` | Creado | Interfaz `UserRepository` + implementación `Map` |
| `src/utils/idGenerator.ts` | Creado | `generateId()` con UUID v4 |

### Presentation

| Archivo | Acción | Descripción |
|---|---|---|
| `src/controllers/userController.ts` | Creado | Handlers delgados del CRUD |
| `src/routes/userRoutes.ts` | Creado | Router `/api/users` |
| `src/middleware/errorMiddleware.ts` | Creado | Contrato de error uniforme |
| `src/middleware/notFoundMiddleware.ts` | Creado | 404 para rutas no encontradas |
| `src/validators/userValidator.ts` | Creado | Esquemas Zod + `validateBody` |
| `src/app.ts` | Creado | Composición de la app Express |
| `src/server.ts` | Creado | Bootstrap HTTP y `PORT` |

### Configuration

| Archivo | Acción | Descripción |
|---|---|---|
| `package.json` | Creado | Dependencias y scripts |
| `tsconfig.json` | Creado | TypeScript strict |
| `jest.config.ts` | Creado | Configuración de Jest + umbrales de cobertura |
| `.eslintrc.json` | Creado | Reglas ESLint |
| `.prettierrc` | Creado | Formato |
| `.gitignore` | Creado | Exclusión de `node_modules`, `dist`, `coverage`, logs |

### Tests y documentación

| Archivo | Acción | Descripción |
|---|---|---|
| `tests/services/userService.test.ts` | Creado | 18 tests unitarios del servicio (ESC-S01..S08) |
| `tests/repositories/inMemoryUserRepository.test.ts` | Creado | 7 tests de repositorio (ESC-I01..I05) |
| `tests/controllers/userController.test.ts` | Creado | 24 tests de integración HTTP (ESC-P01..P08) |
| `README.md` | Creado | Documentación de uso y contratos |
| `features/FEAT-0001-crud-usuario-memoria/**` | Creado | Artefactos SDD v2 del feature |

### Database

No aplica: almacenamiento en memoria (RN007); no hay tablas ni migraciones.

### Docker

No aplica: el alcance no incluye contenerización.

## Endpoints / contratos afectados

| Endpoint | Método | Acción | Descripción |
|---|---|---|---|
| `/api/users` | POST | Creado | Crea usuario; 201 + `User`; 400/409 |
| `/api/users` | GET | Creado | Lista usuarios; 200 + `User[]` |
| `/api/users/:id` | GET | Creado | Obtiene usuario; 200; 404 |
| `/api/users/:id` | PUT | Creado | Actualización parcial; 200; 400/404/409 |
| `/api/users/:id` | DELETE | Creado | Elimina usuario; 204; 404 |

Contrato de error uniforme: `{ "error": { "code", "message", "details"? } }` con `VALIDATION_ERROR` (400), `USER_NOT_FOUND` (404), `EMAIL_ALREADY_EXISTS` (409), `INTERNAL_ERROR` (500).

## Cambios en base de datos

Ninguno. Persistencia volátil en memoria (`Map`); sin esquema, sin migraciones.

## Configuración requerida

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `PORT` | No | `3000` | Puerto HTTP del servidor |

## Pruebas disponibles

| Tipo | Archivos | Tests | Cobertura |
|---|---|---|---|
| Unit — servicio | `tests/services/userService.test.ts` | 18 | stmts 94.11 %, branch 85.71 % (parcial) |
| Unit — repositorio | `tests/repositories/inMemoryUserRepository.test.ts` | 7 | incluido en el parcial anterior |
| Integration — HTTP | `tests/controllers/userController.test.ts` | 24 | stmts 99.39 %, branch 93.54 % |
| **Total** | 3 suites | **49/49 passed** | stmts 99.39 %, branch 93.54 %, funcs 100 %, lines 99.36 % |

## Cómo validar manualmente

```bash
npm install
npm run build          # tsc, debe salir EXIT=0
npm run lint           # eslint, debe salir EXIT=0
npm run test:coverage  # 49/49 tests en verde
npm start              # arranca en http://localhost:3000

curl -i -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada Lovelace","email":"ada@example.com"}'

curl -i http://localhost:3000/api/users
curl -i http://localhost:3000/api/users/<id>
curl -i -X PUT http://localhost:3000/api/users/<id> \
  -H "Content-Type: application/json" -d '{"name":"Ada L."}'
curl -i -X DELETE http://localhost:3000/api/users/<id>
```

## Decisiones de arquitectura finales

| Decisión | Alternativas | Elegida | Razón |
|---|---|---|---|
| ADR001 stack HTTP | JS sin tipos; Fastify | Node 20 + TS strict + Express | Convenciones del workspace; Express con templates disponibles |
| ADR002 persistencia | `Map` en el servicio; SQLite | Interfaz `UserRepository` + `InMemoryUserRepository` | Desacopla negocio del almacenamiento; sustitución futura simple |
| ADR003 validación | Validación manual en controlador | Zod en middleware + errores centralizados | Reglas del workspace y contrato de error consistente |
| ADR004 alcance de seguridad | Password/JWT | Sin autenticación | No solicitado; acota el alcance (API abierta solo apta para demo/desarrollo) |

## Riesgos residuales

- **RIESGO ACEPTABLE** — Datos volátiles: se pierden al reiniciar el proceso (RN007). Mitigación: implementar `UserRepository` persistente cuando se requiera; el contrato ya está preparado.
- **RIESGO ACEPTABLE** — API sin autenticación ni autorización (ADR004). Mitigación: desplegar solo en entornos controlados/demo.
- **RIESGO ACEPTABLE** — JSON malformado responde `500 INTERNAL_ERROR` en lugar de `400 VALIDATION_ERROR` (ver Deuda técnica). No se filtra información al cliente.
- **RIESGO ACEPTABLE** — 1 vulnerabilidad moderada en dependencias de desarrollo (transitivas de ESLint 8); no afecta al runtime.

## Limitaciones conocidas

- El listado `GET /api/users` no incluye paginación (supuesto `SUP007`).
- La actualización parcial sigue `PUT` con semántica parcial (supuesto `SUP006`), no `PATCH`.
- Sin análisis SonarQube (`sonarqube.gate: PENDING`).
- Sin verificación dinámica de seguridad (DAST) ni pruebas de carga.

## Deuda técnica

| Ítem | Razón | Impacto | Prioridad |
|---|---|---|---|
| JSON malformado devuelve 500 en vez de 400 | `express.json()` lanza `SyntaxError` no mapeado a `ValidationError` | Bajo (semántica HTTP incorrecta, sin fuga de datos) | Media |
| `uuid@10` deprecado | Versión fijada en el scaffold | Bajo (funciona) | Baja |
| 1 vulnerabilidad moderada en devDependencies | Transitiva de ESLint 8 | Bajo (solo desarrollo) | Baja |
| 2 líneas y 1 rama sin cubrir (`userController.ts:48`, `errors.ts:44`, `userValidator.ts:78`) | Casos borde | Muy bajo (cobertura global > 99 %) | Baja |
| Templates genéricos para artefactos Node (RFP-003) | No existe template específico en el workspace | Bajo (documentación) | Baja |

## Métricas de calidad

| Métrica | Valor |
|---|---|
| Tests | 49/49 passed (3 suites), 0 failed, 0 skipped |
| Cobertura statements | 99.39 % |
| Cobertura branches | 93.54 % |
| Cobertura funciones | 100 % |
| Cobertura líneas | 99.36 % |
| Build (`tsc`) | EXIT=0 |
| Lint (`eslint`) | EXIT=0 |
| SonarQube | PENDING (no ejecutado) |
| Vulnerabilidades npm | 1 moderada (dev) / 0 en producción |
| Complejidad / bundle size | No aplica (API backend, sin bundle) |

## Información útil para soporte

- **Arranque**: `npm run build && npm start` (o `npm run dev` en desarrollo). Escucha en `PORT` (default 3000).
- **Logs**: los fallos inesperados se emiten como JSON estructurado con `event: "unhandled_error"` y `code: INTERNAL_ERROR`, sin payloads ni datos sensibles.
- **Errores esperados**: `VALIDATION_ERROR` (400), `USER_NOT_FOUND` (404), `EMAIL_ALREADY_EXISTS` (409), `INTERNAL_ERROR` (500).
- **Runbook básico**: si `GET /api/users` devuelve una lista vacía tras haber creado usuarios, comprobar que el proceso no se reinició (almacenamiento volátil). Si todo devuelve 500, revisar que la app no haya arrancado dos instancias sobre el mismo puerto.
- **Queries SQL**: no aplica (sin base de datos).

## Checklist de cierre

- [x] Todos los criterios de aceptación cumplidos (CA001-CA008: PASS)
- [x] Tests pasan (49/49)
- [x] Documentación actualizada (`README.md`, artefactos SDD)
- [x] No hay deuda técnica no documentada (ver sección Deuda técnica)
- [ ] Commit del feature pendiente (siguiente fase: COMMIT)
