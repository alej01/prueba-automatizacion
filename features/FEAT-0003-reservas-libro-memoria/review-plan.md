# Revisión del plan - FEAT-0003

## Estado

APROBADO_CON_OBSERVACIONES

## Resumen ejecutivo

El feature `FEAT-0003-reservas-libro-memoria` está listo para paquetizar. El plan es coherente con el requerimiento ("reservar libro, liberar reserva, consultar reservas"), reutiliza el patrón por capas y el contrato de error uniforme de FEAT-0001/FEAT-0002, y no rompe los CRUDs existentes. La validación estructural de YAML pasa sin errores. Las observaciones emitidas no bloquean la implementación y no requieren refinamiento automático.

## Validación estructural

Comando ejecutado:

```powershell
python "$env:USERPROFILE\.config\opencode\scripts\validate_sdd_artifacts.py" "features/FEAT-0003-reservas-libro-memoria/"
```

Resultado:

```text
PASS feature.manifest.yml
PASS 05-tasks.yml
PASS referencias cruzadas
```

Sin errores de schema ni de referencias cruzadas. No se detectan referencias huérfanas: todas las tareas apuntan a `CA001`–`CA009`, `RN001`–`RN010`, `DES001`–`DES009` y `ADR001`–`ADR005`, todos presentes en los Markdown.

## Coherencia funcional

- La historia de usuario, la descripción funcional y el alcance cubren las tres operaciones mínimas (reservar, liberar, consultar) y añaden la consulta individual y el filtro por usuario, sin inventar negocio fuera del requerimiento.
- Las reglas `RN001`–`RN010` son verificables y trazables a los criterios `CA001`–`CA009`.
- La unicidad de reserva (`RN002` libro único, `RN003` par usuario+libro) queda documentada con su precedencia en `PA001`, aceptada como no bloqueante.
- El estado `RELEASED` en lugar de eliminación física queda justificado en `ADR003` y en `SUP004`.
- `CA009` garantiza explícitamente la no-regresión de usuarios y libros.

## Coherencia técnica

- La estructura `DES001` es coherente con `src/` real y es aditiva.
- `DES009` inyecta las **mismas** instancias de `InMemoryUserRepository`/`InMemoryBookRepository` en el `ReservationService`, evitando el error clásico de no ver usuarios/libros creados por los otros recursos. Correcto.
- La extensión de códigos (`DES004`) es aditiva y no colisiona con los existentes (`RN010`).
- El `DELETE` con `200` + `RELEASED` difiere del `204` de usuarios/libros; está documentado y es intencional (`ADR003`).
- La reutilización de `validateBody` para el query param se describe con un adaptador acotado; no rompe el contrato.
- Seguridad: sin auth es coherente con `ADR004` de FEAT-0001; validación de entrada en todos los endpoints; sin secretos ni datos sensibles.

## Revisión de tareas

- IDs `T001`–`T008` únicos y consecutivos.
- Cada tarea tiene `name`, `status`, `layer`, `artifact_type`, `template`, `objective`, `requirements`, `design`, `decisions`, `expected_output.files`, `validation.command` y `validation.done_when`.
- Tareas de prueba asociadas a las capas de servicio/repositorio (`T006`) y presentación (`T007`).
- Estados `PENDING` coherentes con la etapa `REVIEW_PLAN` del manifest.
- El manifest declara `progress.tasks.total = 8` y `requirements.total = 19` (10 RN + 9 CA) coincidiendo con los Markdown y el YAML.

## Riesgos detectados

| ID | Riesgo | Clasificación |
|---|---|---|
| R001 | Volatilidad de las reservas al reiniciar. | RIESGO ACEPTABLE (documentado, `RN008`) |
| R002 | Ambigüedad de precedencia `BOOK_ALREADY_RESERVED` vs `RESERVATION_CONFLICT`. | RIESGO ACEPTABLE (resuelto en `PA001`) |
| R003 | Diferencia de `DELETE` (200 `RELEASED` vs 204). | RIESGO ACEPTABLE (documentado, `ADR003`) |

## Hallazgos estructurados

```text
ID: RFP-001
Clasificación: OBSERVACION
Severidad: OBSERVACIÓN
Archivo: 05-tasks.yml
Referencia: T004
Problema: T004 agrupa un artefacto de validator y otro de controller en una sola tarea, mezclando dos capas en el mismo work item.
Corrección esperada: aceptable como observación; FEAT-0002 usa agrupaciones equivalentes (p. ej. T004 validador + extracción de middleware). Opcionalmente, al paquetizar se puede dividir en T004 (validator) y una tarea de controller. No requiere refinamiento.
```

```text
ID: RFP-002
Clasificación: OBSERVACION
Severidad: OBSERVACIÓN
Archivo: 05-tasks.yml
Referencia: T005
Problema: T005 agrupa las rutas y la composición en app.ts.
Corrección esperada: aceptable como observación; replica el precedente de FEAT-0002 T006, que agrupa bookRoutes y app.ts. No requiere refinamiento.
```

```text
ID: RFP-003
Clasificación: OBSERVACION
Severidad: OBSERVACIÓN
Archivo: 03-diseno-tecnico.md
Referencia: DES005
Problema: El mecanismo exacto para validar el query param con validateBody (adaptador sobre req.query) queda a nivel descriptivo.
Corrección esperada: la implementación puede resolverlo reutilizando toValidationError/toErrorDetails o validando { ...req.query }; el contrato de error resultante ya está especificado en RN007/CA007. No requiere refinamiento.
```

## Preguntas abiertas críticas

Ninguna. `PA001`–`PA004` están clasificadas como no bloqueantes con supuestos explícitos (`SUP003`, `SUP004`, `SUP007`, `SUP011`).

## Cambios requeridos

Ninguno obligatorio.

## Recomendación final

@plan_packages
