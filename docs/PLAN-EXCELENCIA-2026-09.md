# Plan Maestro — enlace468: Auditoría + Automatización CRM + Excelencia de Diseño
**Fecha:** 2026-09-07 (v2, reordenado por prioridades de Arturo) · **Repo:** `~/Desktop/Claude-Code/Propulsa/enlace468-app` · **Deploy:** siempre `netlify deploy --build --prod` (CLI, nunca desde GitHub) · **Push:** solo cuando Arturo lo pida

**Decisiones tomadas (2026-09-07):**
- ❌ Sin Serper de paga → todo el sourcing con motores gratuitos + proxy Decodo actual (aceptado: algunos días saldrán 15-25 en vez de 30).
- ❌ Sin Apollo → higiene de base con el scraper propio (enrichProfile + proxy).
- ✅ Nombres de etapas del embudo **configurables desde la UI** (Flavio/Kari los editan).

---

## 1. Diagnóstico (auditoría con 3 agentes exploradores + 2 arquitectos)

### 🔴 Hallazgo crítico en producción (arreglar primero)
Las Netlify Functions **no tienen `SUPABASE_URL` en el entorno de runtime** (`meta-lead-webhook.mjs:8` lee `VITE_SUPABASE_URL || SUPABASE_URL` = `undefined` en functions; los `.env` de Vite solo alimentan el build del frontend). Consecuencia probable: **el webhook de leads de Meta Ads y el de Stripe están rotos en prod**. Fix: `netlify env:set SUPABASE_URL <url>`.

### "A veces me aparecen mal los candidatos"
El sourcing scrapea SERPs (Bing RSS → Brave → DDG/Google vía proxy Decodo) y ya tiene 7 capas de filtros. Causas restantes:
1. El **score se pierde al guardar**: `resultToBankRow()` (SourcingTab.jsx:404) no lo persiste — `sourcing_bank` no tiene columna `score`. El banco mezcla buenos y malos sin ranking.
2. Filtros agresivos descartan buenos perfiles (umbral fantasma fijo <50 conexiones, penalización -12 por rol sin sinónimos configurables).
3. Enriquecimiento solo cubre TOP 6 por límite de 26s de Netlify.
4. Links muertos = caché stale de SERPs — no eliminable, pero sí marcable con la re-verificación (Fase 4).

### "No puedo mostrar todos los perfiles de LinkedIn"
Límite estructural (LinkedIn sin API de búsqueda; SERPs indexan una fracción). Margen real sin gastar: **Unipile ya está vivo en prod** y subutilizado (se pollea manual, no persiste, no mueve stages); la extensión Chrome ya manda señales de respuesta que nadie consume; corridas escalonadas con queries barajadas acumulan más netos que una corrida única.

### CRM: ~65% automatizado, cimientos puestos, motores apagados
- ✅ Pipeline kanban, stage_history con trigger (1,775 transiciones históricas), meta-lead-webhook, drafts IA, envío LinkedIn 1-clic.
- ❌ **Cero cron jobs**; detección de no-respuesta solo pinta badge; emails de rechazo vía `mailto:`; sin notificaciones.
- 🔴 Drift de esquema: `candidate_interactions` e `interview_notes` usadas en código pero sin migración; CHECK de `stage` no incluye `screening`.

### Diseño: promedio 4.2/10
cv-landing 9/10 (no tocar) · vacancies (CRM diario de Kari/Ingrid) 2/10: SourcingTab 1,324 líneas, VacancyPipeline 1,303, 6 estilos de botón, 318 inline styles, `window.alert`, light mode con 165 líneas de hacks, paleta del dashboard no es la de marca (navy #071B49 + turquesa #00A99D). 48 rutas todas vivas. 0 tests.

---

## 2. Plan por fases (reordenado por prioridades de negocio)

> Regla transversal: cada fase termina con build + lint + verificación Puppeteer + deploy a **draft URL** para validación del equipo antes de `--prod`. Commits atómicos, sin push hasta que Arturo lo pida.

### FASE 0 — Fundación y fixes críticos (½–1 sesión) 🔴 prerequisito de todo
1. `netlify env:set SUPABASE_URL` (+ `RESEND_API_KEY` cuando Arturo cree la cuenta Resend — free 3k emails/mes; necesaria desde Fase 1 para el digest).
2. Auditar esquema real en prod (`information_schema.columns`) y aplicar **migración de reconciliación**: versionar `candidate_interactions` + `interview_notes` (con `source`, `external_id`), corregir CHECK de stage, columnas `score`/`score_details` en `sourcing_bank`.
3. `netlify/functions/lib/`: `supabase.mjs`, `unipile.mjs`, `resend.mjs`, `draft.mjs` (extraídos sin cambiar comportamiento).
4. Persistir score en `resultToBankRow()` → banco rankeado.
5. Instalar skill `npx skills add supabase/agent-skills`.
- **Verificar:** invoke de meta-lead-webhook escribe en Supabase; smoke de /api/linkedin-activity.

### FASE 1 — P1: "30 RAPs cada mañana" sin búsqueda booleana (1–2 sesiones) ⭐
Objetivo: Kari abre la plataforma a las 7am y ya están los candidatos del día, rankeados.
1. **`cron-auto-source.mjs` con corridas escalonadas nocturnas** (p. ej. 4:00, 5:00 y 6:00 CDMX, L-V): cada corrida usa `buildQueries` con variantes barajadas (ya existente — corridas sucesivas traen perfiles nuevos), procesa vacantes con `auto_source_enabled=true` (LIMIT 2/tick por el límite de 26s), dedupe contra el banco, upsert a `sourcing_bank` **con score persistido**. Tres corridas espaciadas evitan los 429 de motores gratuitos y acumulan volumen sin Serper.
2. **Digest matutino 7:00am**: email Resend a Kari/Ingrid + notificación en app — "Los N de hoy" ordenados por score, con nombre/puesto/score/link. Si un día salen <30, el digest lo dice explícitamente (sin caps silenciosos).
3. **Vista "Candidatos de hoy"** en el dashboard/SourcingTab: los netos nuevos de las últimas 24h, rankeados, con acciones promover/descartar en 1 clic.
4. Toggle `auto_source_enabled` + umbral por vacante en la UI de vacante (columnas de la migración C).
- **Verificar:** activar en la vacante RAP real; 3 mañanas seguidas comparar digest vs lo que Kari encontraría a mano; medir consumo del proxy Decodo (3 corridas/día × vacantes — avisar a Arturo el gasto de tráfico estimado antes de escalar a más vacantes).
- **Riesgo:** volumen variable sin Serper — se mide 1 semana y con datos reales Arturo decide si contrata (~$50/mes se activa solo con poner la key en plan de paga).

### FASE 2 — P4: Embudo con nombres del journey + cero extranjeros (1–2 sesiones)
**Nombres configurables:**
1. Migración: `organizations.stage_labels jsonb` (map stage interno → etiqueta visible) con defaults en español: Prospectado → Contactado → Filtro inicial → Entrevista → Evaluado → Presentado → Oferta → **Clave**.
2. Pantalla de configuración (Settings) donde Flavio/Kari editan las etiquetas; hook `useStageLabels()` aplicado en VacancyPipeline, PipelineKanban, ExecutiveReport, badges y digest.
**Extranjeros — triple candado + purga:**
3. Auditar por dónde se cuelan hoy (candidatos existentes en banco/pipeline con señales extranjeras: subdominio no-mx, ubicación en texto): query de diagnóstico → lista.
4. Candado en **promoción** y en **render** (no solo en insert): `isForeignProfile()` ya existe en sourcingScore.js — aplicarlo también al promover del banco y como badge/filtro en pipeline para lo ya existente.
5. **Purga auditada**: vista "Marcados como extranjeros" para revisión de Kari (aprobar descarte masivo) — nunca borrado silencioso; los aprobados → `descartado` con razón `foreign`.
- **Verificar:** correr el diagnóstico antes/después; confirmar con Flavio que el embudo muestra sus nombres.

### FASE 3 — P3: Reportes de avance + pronóstico de clave (1–2 sesiones)
Sobre `stage_history` (1,775 transiciones + trigger vivo):
1. Vistas SQL: `v_funnel` (por vacante: llegaron/están/rechazados por etapa, conversión etapa→etapa, días promedio en etapa) y `v_weekly_flow` (movimientos por semana).
2. **Módulo de pronóstico** en ExecutiveReport: con la composición actual del pipeline × conversiones históricas × velocidad (días/etapa) → "**ETA de próxima clave: ~X semanas**" + "para 1 clave/mes necesitas ~Y prospectados/semana" + semáforo de ritmo actual vs necesario. Benchmark real disponible: 363 sourced → 42 entrevista → 1 oferta (FINANCE CONSULTANT).
3. Reporte con nombres del journey (Fase 2) + export/descarga como el ExecutiveReport actual.
- **Verificar:** validar el pronóstico contra la vacante histórica cerrada (backtest: ¿el modelo hubiera predicho la fecha real de la clave?).

### FASE 4 — P2: Higiene de base con scraper propio (1–2 sesiones)
1. Migración: `last_verified_at`, `verify_status` (`activo` / `cambio_empleo` / `desactualizado` / `link_muerto` / `fantasma`) en `sourcing_bank` y `candidates`.
2. **`cron-verify-profiles.mjs`** (madrugada, lotes pequeños ~15/día para cuidar tráfico del proxy): re-busca `site:linkedin.com/in/<slug>` (lógica `enrichProfile` existente), compara headline/empleador vs guardado → actualiza status. Sin resultado en 2 intentos espaciados → `link_muerto`.
3. UI: badges de frescura en banco y pipeline, filtro "solo verificados", sección **"Por depurar"** para que Kari apruebe limpieza masiva (mismo patrón de purga auditada de Fase 2).
4. Prioridad de verificación: pipeline activo primero, luego banco por score descendente.
- **Verificar:** correr sobre 20 perfiles conocidos (mezclar vivos y muertos conocidos) y revisar precisión con Kari antes de escalar.
- **Nota:** sin Apollo no hay email verificado ni "última actividad" exacta — el proxy detecta cambio de empleo, muerte del link y fantasmas, que cubre el caso "4 años sin actualizar" en su mayoría. Si un día reactivan Apollo, el gancho queda listo (`verify_source`).

### FASE 5 — Motor de secuencias multi-touch (3–4 sesiones)
Réplica del patrón Gem/Lever sobre **Netlify Scheduled Functions**: `outreach_sequences` + `sequence_steps` (día 0 connect → día 3 follow-up → día 7 email; `ai_generate` por paso) + `sequence_enrollments` + `scheduled_messages` (outbox auditable) + **trigger `pause_on_reply`** (extensión Chrome, sync Unipile y Resend convergen en `candidate_interactions`). `cron-sequence-runner.mjs` (ticks idempotentes LIMIT 10, jitter 0-90 min, lock optimista) + `cron-activity-sync.mjs` (persiste invitaciones/chats Unipile, hoy polleados a mano). **Anti-ban duro:** ≤15 invites/día (arrancar en 5), ≤80/semana, horario laboral, kill-switch, un solo punto de envío. UI: `SequenceBuilder.jsx` + "Inscribir en secuencia". Auto-enroll de los auto-promovidos de Fase 1 (encender solo tras validar calidad con Karina).

### FASE 6 — SLAs, notificaciones y refactor del CRM UI (2–3 sesiones)
`sla_rules` + `cron-sla-check.mjs` + `NotificationBell.jsx` + digest. Librería `ui/` completa (Button, Card, Field/Input, Table, Modal con focus trap, Badge, Tabs, Toast —reemplaza `window.alert`—, EmptyState, Spinner) + re-mapeo de tokens a navy/turquesa en `tailwind.config.js` (re-branding en 1 archivo; cv-landing aislado por `.tmv`) + partición de SourcingTab → `sourcing/` (9 subcomponentes + 4 hooks) y VacancyPipeline+PipelineKanban → `pipeline/` (stages.js desduplicado, usePipeline). Cuidado: widget CSE de Google debe permanecer montado en el DOM.

### FASE 7 — Pulido final (1–2 sesiones)
`evaluate-candidate.mjs` server-side; recordatorios de entrevista (`reminder_sent` ya existe); email de rechazo vía Resend (fuera `mailto:`); dashboard home sin inline styles; migración de módulos secundarios a tokens; eliminar bloque de hacks light-mode (con screenshots de ambos temas); barrido a11y (alt, aria-label, focus ring). Opcional futuro con OK de costo: WhatsApp vía n8n, Serper, Apollo.

---

## 3. Herramientas: skills, plugins/MCP y orquestación de agentes

### Skills del harness (se usan, no se descargan)
| Skill | Uso |
|---|---|
| `frontend-design` | Fases 2/6/7: librería `ui/`, vista "Candidatos de hoy", pantalla de config de etapas |
| `code-review` | Cierre de cada fase (nivel high en Fase 5 por riesgo anti-ban/doble-envío) |
| `verify` / `run` | Verificación funcional tras cada refactor |
| `simplify` | Pasada tras particiones de mega-componentes |

### Skills externas
- `npx skills add supabase/agent-skills` (Fase 0) — guía oficial para las migraciones/RLS nuevas.

### Plugins / MCP
- **Supabase MCP**: el proyecto enlace468 no está en esta cuenta MCP → migraciones vía `supabase db push --linked` / SQL editor (como stage_history), o Arturo agrega el proyecto al MCP.
- **Puppeteer** (ya usado en el repo): `scripts/visual-check.mjs` — screenshots de rutas clave en ambos temas y viewports 375/1440px por fase; `/tu-marca-vende` como guardrail.
- **n8n MCP**: solo para WhatsApp futuro. **Figma MCP**: opcional para documentar el design system.

### Orquestación de agentes
- Diagnóstico (hecho): 3 Explore en paralelo + 2 Plan.
- Implementación: subagentes `general-purpose` en paralelo para piezas independientes (ej. Fase 6: un agente por subcomponente, con worktrees); el hilo principal integra, corre Puppeteer y deploya a draft.
- Verificación adversarial en Fases 1 y 5: agentes independientes intentando refutar ("¿puede duplicar candidatos el cron?", "¿se puede saltar la cuota?", "¿la purga puede borrar un mexicano válido?").
- `code-review` por fase antes de cada deploy a prod.

---

## 4. Reglas de seguridad (no negociables)
1. **Anti-ban LinkedIn**: cuotas duras, jitter, horario laboral, kill-switch, un solo punto de envío.
2. **No quemar créditos**: cualquier gasto (Serper, Apollo, WhatsApp API, tráfico proxy extra) se avisa con costo y se pide OK. El cron diario consume tráfico Decodo — se reporta el gasto semanal.
3. **Deploy**: draft URL → validación equipo → `--prod`. Los schedules solo se activan con deploy a prod (verificar en dashboard Netlify).
4. **Git**: commits atómicos locales; push solo cuando Arturo lo pida.
5. **Esquema**: nada de SQL a mano sin migración espejo en `supabase/migrations/`.
6. **Purgas**: siempre auditadas con revisión humana (Kari), nunca borrado silencioso.

## 5. Estimación y dependencias
**11–15 sesiones de agente** (~35–45 h IA). Las 4 prioridades de Arturo (Fases 0–4) = **5–8 sesiones**; el resto (secuencias, SLAs, refactor UI) = 6–7 más.
**Dependencias de Arturo:** cuenta Resend + API key (Fase 1, digest matutino), URL/keys de Supabase para migraciones (Fase 0), validación de calidad con Kari en Fases 1/2/4.
