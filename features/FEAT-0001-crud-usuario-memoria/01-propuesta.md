# 01 - Propuesta

## Metadata

| Campo | Valor |
|---|---|
| Feature | FEAT-0001 |
| Nombre | crud-usuario-memoria |
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
| Backend | Node.js 20 + Express | `convenciones.md` (Node.js: Express o Fastify) |
| Lenguaje | TypeScript (strict) | `convenciones.md` (Setup Node: TypeScript strict mode) |
| Persistencia | En memoria (`Map`) | Requerimiento: "en memoria" |
| Base de datos | No aplica | Requerimiento: sin base de datos |
| Framework HTTP | Express | `convenciones.md` (Express o Fastify) |
| Validación | Zod | `rules/architecture/node.md` |
| Testing | Jest + Supertest | `convenciones.md` y `rules/testing/node.md` |
| Lint/Format | ESLint + Prettier | `convenciones.md` |
| Build tool | `tsc` (TypeScript Compiler) | Stack Node/TS estándar del workspace |
| Docker | No incluido en el alcance inicial | No se detecta `Dockerfile` ni `compose*.yml` |
| Java | No aplica | — |

## Tipo de proyecto

- [x] Greenfield (proyecto nuevo)
- [ ] Brownfield (código existente)

El repositorio solo contiene `.git` y `run.log`; no existe código de aplicación, `package.json` ni scaffolding previo. No hay archivos existentes afectados ni riesgos de regresión sobre código productivo.

## Historia de usuario

**Como** desarrollador de servicios backend,
**quiero** exponer un CRUD de usuarios por HTTP con almacenamiento en memoria,
**para** disponer de un servicio de gestión de usuarios funcional y sin dependencia de base de datos, que sirva como base verificable para demos y pruebas de integración.

## Descripción funcional

Se debe crear un servicio HTTP en Node.js + TypeScript que administre usuarios en memoria. El servicio expone operaciones de creación, consulta (individual y listado), actualización y eliminación de usuarios. Los usuarios se almacenan en una estructura en memoria (`Map`) y se pierden al reiniciar el proceso.

Cada usuario tiene: `id` (UUID v4 generado por el servidor), `name`, `email`, `createdAt` y `updatedAt`. La entrada se valida con esquemas Zod y los errores se gestionan de forma centralizada con un contrato uniforme.

## Alcance

- Proyecto Node.js + TypeScript strict con Express.
- Estructura por capas: `controllers`, `services`, `repositories`, `models`, `middleware`, `routes`, `validators`, `utils`.
- Modelo de usuario y tipos de request/response.
- Repositorio en memoria basado en `Map` con interfaz explícita.
- Servicio con la lógica de negocio del CRUD y las reglas `RN001`–`RN008`.
- Validación de entrada con Zod (`RN002`, `RN003`, `RN005`).
- Controlador delgado y rutas REST.
- Middleware centralizado de errores con contrato uniforme (`CA008`).
- Pruebas unitarias (servicio, repositorio) y de integración (controlador con Supertest).
- Documentación de la API y de cómo ejecutar el proyecto.

## Fuera de alcance

- Autenticación, autorización, sesiones, JWT o roles (`RN008`, `ADR004`).
- Gestión y almacenamiento de contraseñas.
- Persistencia real (base de datos, archivos, cache externo) (`RN007`, `ADR002`).
- Interfaz de usuario / frontend.
- Contenerización Docker y pipelines CI/CD.
- Paginación, filtros y búsqueda avanzada en el listado.
- Despliegue en entornos productivos.

## Supuestos

- SUP001: El requerimiento "crud en node de usuario en memoria" se refiere a una **API HTTP REST**, no a un CLI ni a una librería.
- SUP002: El framework HTTP es **Express**, primera opción listada en `convenciones.md`.
- SUP003: El lenguaje es **TypeScript en modo strict**, según `convenciones.md` para Node.js.
- SUP004: Los campos del usuario son `name` y `email`; no se incluyen `password` ni datos de autenticación.
- SUP005: El `id` es un **UUID v4** generado por el servidor.
- SUP006: La actualización (`PUT`) es **parcial** sobre `name` y/o `email`.
- SUP007: El listado `GET /api/users` devuelve un arreglo completo, sin paginación.
- SUP008: El formato de error es uniforme: `{ "error": { "code", "message", "details?" } }`.
- SUP009: La cobertura mínima de pruebas es 80 % statements / 70 % branches, según `rules/testing/node.md`.
- SUP010: El puerto por defecto es `3000` y se puede sobrescribir con la variable de entorno `PORT`.

## Riesgos

| ID | Riesgo | Clasificación |
|---|---|---|
| R001 | Pérdida de datos al reiniciar el proceso (almacenamiento volátil). | RIESGO ACEPTABLE (documentado en `RN007`) |
| R002 | Ausencia de autenticación: la API queda abierta. | RIESGO ACEPTABLE (alcance explícitamente excluido en `RN008`/`ADR004`) |
| R003 | Condiciones de carrera en el `Map` bajo concurrencia alta. | RIESGO ACEPTABLE (uso single-process, sin persistencia) |
| R004 | Sin scaffolding previo: el feature debe crear la base del proyecto. | RIESGO ACEPTABLE (incluido en la tarea `T001`) |
| R005 | Crecimiento del `Map` sin límite en procesos de larga duración. | RIESGO ACEPTABLE (fuera de alcance la retención/limpieza) |

## Preguntas abiertas

- PA001: ¿Se requiere paginación en el listado? — **No bloqueante**, se asume `SUP007` (sin paginación) para el alcance inicial.
- PA002: ¿El endpoint de actualización debe ser `PUT` o `PATCH`? — **No bloqueante**, se asume `SUP006` (`PUT` con actualización parcial).

> No se identifican preguntas bloqueantes. Los supuestos `SUP001`–`SUP010` quedan trazados para validación humana en la revisión del plan.

## Recomendación técnica inicial

1. Crear el scaffolding base (TypeScript strict, scripts de build/test/lint, Jest).
2. Modelar dominio y tipos (`User`, `UserRequest`, errores).
3. Implementar el repositorio en memoria detrás de una interfaz.
4. Implementar el servicio con las reglas de negocio.
5. Añadir validadores Zod y el middleware de errores.
6. Exponer controlador y rutas.
7. Cubrir con pruebas unitarias e integración (Jest + Supertest).
8. Documentar el contrato API y su ejecución.

Consideraciones de performance/seguridad: operaciones `O(1)` sobre `Map`; validación de entrada obligatoria; sin datos sensibles almacenados; logging estructurado sin exponer secretos.
