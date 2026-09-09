# CONTEXTO — Copiloto + Pipeline expandido (Ingrid) + Ruteo de candidatos
**Fecha:** 2026-09-09 · **Repo:** `~/Desktop/Claude-Code/Propulsa/enlace468-app` · **Para:** construir el copiloto de la plataforma de atracción y el sistema de disposición/monetización de candidatos.

Este documento es el **contexto de referencia** que pidió Arturo para poder construir un copiloto dentro de la plataforma. Reúne 3 piezas que se conectan: (1) el pipeline expandido de Ingrid, (2) el copiloto que dice quién está atorado, (3) el esquema de ruteo para candidatos que no son aptos para FC pero sí para otro producto/rol.

---

## 0. Estado actual (base sobre la que se construye)

- **Stages internos** (BD, `vacancy_candidates.stage`, no cambian): `sourced → contacted → screening → interviewing → evaluated → presented → shortlist → offer → hired / rejected`.
- **Etiquetas visibles** configurables por org en `organizations.settings.stage_labels` (`src/lib/stageLabels.js`). Flavio ya puso las del journey: Sourcing, Contactado, Respondió Msj, Agendado, EI Efectiva, EO Efectiva, EC Efectiva, Documentos, Clave T, Rechazado.
- **`stage_history`** (con trigger) registra cada transición → base del pronóstico y del copiloto.
- **SLAs** (`sla_rules` + `cron-sla-check` + `notifications` + campana) ya detectan candidatos atorados por tiempo en etapa → **el 80% del motor del copiloto ya existe**.
- **`candidate_interactions`** (timeline por candidato) + **secuencias de outreach** (Fase 5) + **cosecha de correo** al conectar.
- **Tu Marca Vende** ya existe como producto/landing (`/tu-marca-vende`, CV+LinkedIn $499) — es el primer destino de ruteo obvio para un no-apto-FC.

---

## 1. Pipeline expandido de Ingrid (diagrama 21 pasos)

El diagrama de Ingrid es más granular que los 9 stages actuales. **No hay que romper los stages internos** — se modela como **sub-etapas + campos de control** dentro de las fases existentes, más 2 stages nuevos para documentación e inducción.

### Mapeo del flujo de Ingrid → modelo de datos

| # | Paso de Ingrid | Fuente | Stage interno | Campo/subestado nuevo |
|---|---|---|---|---|
| 1 | Registro de conexiones globales | LinkedIn | sourced | (banco) |
| 2 | Mensaje de conexión | LinkedIn | contacted | `contact_status` (ya existe) |
| 3 | Conversación inicial (24-48h) | LinkedIn | contacted | `conversation_at` |
| 4 | Invitación a entrevista | CRM | contacted→screening | `interview_invited_at` |
| 5 | Entrevista inicial | CRM | screening | `initial_interview_at` (efectiva sí/no) |
| 6 | Envío de psicométrico | Plataforma | interviewing | `psychometric_sent_at` |
| 7 | Resultado psicométrico | Plataforma | interviewing | `psychometric_result` (apto/no/pendiente) |
| 8 | Entrevista de orientación | CRM | interviewing | `orientation_at` |
| 9 | Proyecto 100 / Q10 | CRM | evaluated | `project100_status` |
| 10 | Entrevista de carrera | CRM | evaluated | `career_interview_at` |
| 11 | Aceptación del candidato | CRM | presented→offer | `accepted_at` |
| 12 | Solicitud de documentos | Correo | **documentation** (nuevo) | `docs_requested_at` |
| 13 | Confirmación de recibido | Correo | documentation | `docs_confirmed_at` |
| 14 | Upload de documentos | Plataforma | documentation | `docs_uploaded` (jsonb) |
| 15 | Validación legal y resguardo | Plataforma | documentation | `legal_validated_at` |
| 16 | Pago de examen CNSF | Correo | documentation | `cnsf_paid_at` |
| 17 | Upload de comprobante | Plataforma | documentation | `cnsf_receipt_url` |
| 18 | Fecha de examen CNSF | Plataforma | documentation | `cnsf_exam_date` |
| 19 | Inducción 90 días | Plataforma | **onboarding** (nuevo) / hired | `induction_start_at` |
| 20 | Semana 1 crítica | Plataforma | onboarding | `week1_checkpoint` |
| 21 | Seguimiento de avances | Plataforma | onboarding | (seguimiento continuo) |

**Decisión de modelo:** agregar 2 stages (`documentation`, `onboarding`) al CHECK de `stage`, y una tabla **`candidate_pipeline_detail`** (1:1 con `vacancy_candidates`) con todos los campos de control de arriba — así el kanban sigue simple pero cada candidato tiene su ficha operativa completa (los "puntos de control A-H" y "campos obligatorios" del diagrama). Alternativa más ligera: un solo `vacancy_candidates.pipeline_detail jsonb`. **Recomendado: tabla dedicada** (permite índices para el copiloto y las alertas por campo).

### Puntos de control (A-H) → alertas del copiloto
- A: Captura diaria de conexiones (LinkedIn) — KPI diario.
- B: Estatus del mensaje y conversación — `contact_status`.
- C: Agendamiento y no-show — `interview_invited_at` vs `initial_interview_at`.
- D: Psicométrico enviado/contestado — `psychometric_sent_at`/`result`.
- E: Apto / No apto / Pendiente — **ver sección 3 (disposición)**.
- F: Documentos solicitados y recibidos — `docs_requested_at`/`confirmed`.
- G: Pago y comprobante del examen — `cnsf_paid_at`/`receipt`.
- H: Fecha comprometida del examen CNSF — `cnsf_exam_date`.

### Alertas operativas (del diagrama) → reglas del copiloto
1. **Candidato sin avance > 5 días** → ya lo hace `cron-sla-check` (generalizar a "días sin cambio de stage/sin interacción").
2. **Psicométrico pendiente** → `psychometric_sent_at` sin `result` > N días.
3. **Documentos incompletos** → en `documentation` con `docs_uploaded` incompleto.
4. **Pago de examen no confirmado en semana 1** → `accepted_at` + 7d sin `cnsf_paid_at`.
5. **Fecha CNSF no definida** → en `documentation` sin `cnsf_exam_date`.

### KPIs del diagrama (embudo sept-2026)
Del segundo diagrama, metas y conversiones REALES a modelar en el dashboard:
- **Meta mes: 5 FC** = 3 digital + 2 referidos.
- Embudo digital por 1 FC: **90-120 conexiones → 41 entrevistas iniciales (34-46%) → 13 orientación (31.7%) → 1 FC (7.7% de orientación)**.
- Total digital para 3 FC: 270-360 conexiones → 123 iniciales → 39 orientación → 3 FC.
- Canal referidos: 2 FC (embudo aún sin medir con la misma profundidad).
- RAP/digital: 1 incorporación meta (medir conversiones reales).
- **Variable crítica: disciplina diaria de conexiones enviadas.** El copiloto debe vigilar el ritmo diario vs la meta (¿cuántas conexiones/día para 3 FC este mes?).

Esto conecta con el **pronóstico de clave** ya construido (`funnelForecast.js`): ahora con las conversiones reales del diagrama como benchmark inicial hasta que `stage_history` acumule las propias.

---

## 2. Copiloto de la plataforma — "¿Quién está atorado?"

**Qué es:** un panel/asistente permanente (barra lateral o widget en el dashboard y en cada vacante) que responde en lenguaje natural + lista accionable: *"¿En qué debo enfocarme hoy?"* y *"¿Quién está atorado y qué hago?"*.

**Fuentes de datos (todas ya existen o se agregan en §1):**
- `stage_history` → tiempo en cada etapa por candidato.
- `sla_rules` → umbral por etapa (ya configurable).
- `candidate_interactions` → última interacción, sin respuesta.
- `candidate_pipeline_detail` (§1) → psicométrico pendiente, docs incompletos, CNSF sin fecha.
- `notifications` → ya acumula los `sla_breach`.

**Qué muestra el copiloto (secciones):**
1. **Atorados por etapa** — "Sofía Herrera lleva 112d en Sourcing", "Fernando lleva 8d en Orientación sin avance". Ordenado por severidad (días sobre el SLA). Cada uno con **acción sugerida** ("mándale seguimiento", "agenda orientación", "sube docs").
2. **Pendientes operativos** — las 5 alertas del diagrama (psicométrico, docs, pago CNSF, fecha CNSF).
3. **Ritmo del mes vs meta** — conexiones enviadas hoy/semana vs las necesarias para las 5 FC (del embudo). Semáforo.
4. **Resumen en lenguaje natural** (opcional, con IA Haiku ya integrada) — "Hoy tienes 4 candidatos atorados, 2 psicométricos vencidos y vas 30% abajo del ritmo de conexiones para la meta de septiembre."

**Implementación técnica:**
- **Motor de reglas determinista** (`src/lib/copilot.js`, puro y testeable): recibe candidatos + detail + SLA + interactions → devuelve lista priorizada de "focos" con tipo, severidad, mensaje y acción sugerida. **Sin IA para las reglas** (barato, confiable, auditable).
- **Capa IA opcional** (`netlify/functions/copilot-summary.mjs`, Haiku): toma la salida determinista y redacta el resumen en español. Graceful: sin API key, muestra la lista sin el párrafo.
- **UI**: `src/components/copilot/CopilotPanel.jsx` — widget colapsable en el dashboard (y versión por vacante). Reusa `NotificationBell`/SLA que ya existen; el copiloto es la vista "accionable y priorizada" de esas señales + los pendientes operativos nuevos.
- **Sin cron nuevo**: el copiloto lee en vivo al abrir (o cada X min). Las alertas ya se persisten vía `cron-sla-check`.

---

## 3. Ruteo / disposición de candidatos (la idea de Arturo)

**Problema que resuelve:** hoy un candidato es apto (avanza) o `rejected` (muere). Pero un no-apto-para-FC puede ser **oro para otro producto**: venderle **Tu Marca Vende** (CV+LinkedIn $499), ofrecerle **otro rol** (vendedor de otra cosa), o **otro producto** del ecosistema. El rechazo deja de ser un callejón sin salida y se vuelve una **decisión de monetización/ruteo**.

### Modelo: campo `disposition` en el candidato

Nuevo campo `vacancy_candidates.disposition` (o en `candidate_pipeline_detail`), con valores:

| disposition | Significado | Acción/monetización |
|---|---|---|
| `fc_track` | Apto para Finance Consultant | sigue el pipeline normal |
| `tu_marca_vende` | No-FC pero le sirve/vendemos CV+LinkedIn $499 | → funnel Tu Marca Vende (link de pago) |
| `otro_rol` | No-FC pero es buen vendedor para otra vacante/rol | → re-asignar a otra vacante o pool comercial |
| `otro_producto` | No-FC pero cliente potencial de otro producto del ecosistema | → oferta cruzada (Academy, curso, etc.) |
| `nurture` | No ahora, revisitar después | → secuencia de nurture largo plazo |
| `descartado` | Fuera total (extranjero, seguros, basura) | → basura, no recontactar |

Campos de apoyo: `disposition_reason` (por qué), `disposition_at`, `disposition_by`, `routed_to` (vacante/producto destino).

### Cómo se decide (el "esquema de candidatos")
- En la **Entrevista inicial / psicométrico / orientación** (pasos 5-8 de Ingrid), el reclutador marca la disposición.
- El punto de control **E (Apto/No apto/Pendiente)** del diagrama se convierte en este selector, pero con más salidas que solo "no apto".
- **Sugerencia automática** (opcional, IA/reglas): con los datos del perfil, el copiloto propone la disposición ("perfil comercial fuerte pero sin apetito financiero → sugerir otro_rol" / "buscando mejorar su marca → Tu Marca Vende").

### Flujo de Tu Marca Vende como destino
Cuando `disposition='tu_marca_vende'`: el candidato entra al funnel existente de `/tu-marca-vende` (diagnóstico → link de pago). Se registra la oferta en `candidate_interactions` y, si compra, se atribuye. **Esto convierte al pipeline de reclutamiento en un canal de ventas B2C** — cada no-apto es un lead cálido para el producto de $499.

### Impacto en reportes
- El embudo deja de "perder" a los no-aptos: se ve cuántos se **rutearon** a cada destino y cuánto **ingreso** generó el pipeline por Tu Marca Vende / otros productos.
- Nueva métrica: **valor del pipeline más allá de FC** (recuperación de rechazados).

---

## 4. Plan de implementación por fases

### Fase A — Modelo de datos (fundación)
1. Migración: 2 stages nuevos (`documentation`, `onboarding`) en el CHECK; tabla `candidate_pipeline_detail` (campos de control §1); campos `disposition`/`disposition_reason`/`routed_to` en `vacancy_candidates`; reglas SLA default para los stages nuevos; tipos de alerta nuevos.
2. Etiquetas del journey extendidas (stage_labels para documentation/onboarding).

### Fase B — Copiloto
3. `src/lib/copilot.js` (motor de reglas puro) + tests.
4. `CopilotPanel.jsx` (dashboard + por vacante) leyendo SLA/interactions/detail.
5. `copilot-summary.mjs` (resumen IA Haiku, opcional).

### Fase C — Ruteo/disposición
6. Selector de disposición en el modal del candidato (paso E) con las 6 salidas.
7. Destino Tu Marca Vende: enganche al funnel existente + registro/atribución.
8. Vista "Ruteados" en reportes + métrica de recuperación.

### Fase D — Pipeline operativo de Ingrid
9. Ficha operativa del candidato (psicométrico, docs, CNSF, inducción) en el modal del pipeline.
10. Las 5 alertas operativas + KPIs diarios de conexiones vs meta del mes.

### Verificación
- Tests puros del motor del copiloto y del ruteo.
- QA Puppeteer del panel del copiloto y del selector de disposición (dark/light, móvil/desktop).
- Deploy draft → prod.

---

## 5. Notas / decisiones abiertas para Arturo
- ¿`candidate_pipeline_detail` como tabla dedicada (recomendado, mejor para alertas/índices) o `jsonb` en vacancy_candidates (más simple)?
- ¿El copiloto vive en el dashboard home, en una pestaña propia, o como widget flotante en toda la plataforma?
- Tu Marca Vende como destino: ¿link de pago manual (como hoy en Tesipedia) o checkout automático?
- ¿La sugerencia automática de disposición usa IA (Haiku) o solo reglas? (empezar con reglas, IA después).
