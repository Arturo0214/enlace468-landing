# CONTEXTO DE FILTRADO DE CANDIDATOS — enlace468
**Origen:** notas de descarte de Karina (QA tester, "Lista de descartes plataforma sep 2026") + criterios acumulados en la operación · **Vive en código:** `src/lib/sourcingScore.js`, `src/lib/excludedCompanies.js`, `netlify/functions/cron-auto-source.mjs` (gate), `src/lib/promote.js` (guard) · **Última actualización:** 2026-09-14

Este documento es la **fuente de verdad legible** de por qué un candidato entra o sale del filtro. Cada regla aquí está implementada en el gate automático (sourcing nocturno + verificación) y/o se aplica en la revisión 1x1. Cuando Kari/Ingrid quieran ajustar el criterio, se edita aquí y en el código correspondiente.

---

## 1. Perfil objetivo (a quién SÍ queremos)
Vacantes activas: **Finance Consultant** y **Consultor Inmobiliario Financiero (Célula Cero Hipoteca)**. Rol COMERCIAL de venta consultiva donde cada consultor **genera su propio negocio con autonomía** (mentalidad de dueño / cartera propia).

**Señales BUENAS (rol comercial/ventas):** asesor, asesor financiero/patrimonial, ejecutivo comercial, ejecutivo de ventas, ejecutivo de cuenta, key account, gerente comercial/de ventas, promotor, broker hipotecario/inmobiliario, desarrollo de negocio, cartera de clientes, prospección, B2B, vendedor. **Plus emprendedor** (convierte mejor, [[modo emprendedores]]): fundador, co-fundador, dueño de negocio, socio fundador, independiente con cartera propia.

**Reconvertibles:** vendedores de otros rubros (automotriz, farma, telecom, inmobiliario, B2B) con experiencia de venta/relación con cliente → aptos, la célula los reconvierte.

---

## 2. Motivos de descarte (de las notas de Karina, categorizados)
Kari descartó 38 perfiles en su barrido; sus motivos se agruparon en estas reglas, ahora automáticas:

| # | Motivo de Karina | Regla en el sistema | Dónde |
|---|---|---|---|
| 1 | **"Perfil especializado"** (13×): Analista, Backoffice, Contabilidad y Análisis, PLD/Prevención de Lavado, auditoría, "sin experiencia comercial" | Título con señal técnica/analítica sin señal comercial → descartado (`checkRoleFit='specialized'`) | `sourcingScore.js` `SPECIALIZED_ROLE_SIGNALS` |
| 2 | **"Está en otro país"** (14×): EUA, Chile, Canadá, Colombia, Melbourne | Subdominio no-mx (`cl.`/`pe.`…) o país en ubicación/empresa → descartado. **El nombre de la persona NO cuenta** (Israel/Kenia/Milán son nombres MX, no países) | `sourcingScore.js` `isForeignProfile`/`detectForeignLocation` |
| 3 | **"Perfil inactivo"** (6×): sin foto, sin contactos, sin actualizaciones 4+ años | <50 conexiones = fantasma; verificación detecta link muerto/desactualizado | gate + `cron-verify-profiles` |
| 4 | **"Jubilado"** / veterano independiente 20+ años | Trayectoria muy larga / jubilado → no se reconvierte a la célula → descartado en 1x1 | criterio 1x1 |
| 5 | **"Con invitación a conectar previa"** sin aceptar | `contact_status` ya registrado → no re-contactar | `sourcing_bank.contact_status` |
| 6 | **"Ya lo descarté ~3 veces"** (dedupe roto) | URL normalizada (http/www/mx/%encoding → misma clave) → no re-entra | `normalizeLinkedInUrl` |

**Vetos de sector (no contratable):**
- **Aseguradoras/inversiones** (GNP, SMNYL, AXA, MetLife, Mapfre, Inbursa, casas de bolsa, afores…).
- **SEGUROS/FIANZAS/AFORE — veto total** (Arturo, sep-2026): agentes de seguros, fianzas, previsional, ahorro para el retiro, CNSF, cédula — aunque sean comerciales y mexicanos. `excludedCompanies.js` "Veto seguros/fianzas".

---

## 3. Umbrales operativos (de la revisión 1x1)
Estos son los cortes que se aplicaron revisando ~250 candidatos uno por uno:
- **Score ≤ 50 = descarte** (perfil sin fuerza/datos). 51-99 con señal MX clara = apto. (Motivo #1 de descarte real: "score bajo", 19 casos.)
- **Sin datos juzgables** (nombre de marca/empresa, snippet vacío tipo "1 mil millones de miembros") = descarte.
- **Sin señal de México confirmada** → cuarentena `geo_desconocida` (invisible en el banco) hasta que la verificación dirigida confirme por empresa/ubicación. Se rescata por **empresa mexicana conocida** (bancos MX, SOFOMes, grupos MX, "S.A. de C.V.", universidad MX) o se descarta si resulta extranjero.

---

## 4. Flujo del gate (automático, cada noche)
```
Sourcing → gate de 3 niveles:
  nombre de rol/marca (no persona)        → BASURA (no entra)
  extranjero (subdominio o país en ubic.) → FUERA
  sector vetado (seguros/aseguradora/…)   → FUERA
  rol especializado (analista/PLD/…)      → FUERA
  con señal MX                            → VISIBLE en el banco
  sin señal MX                            → CUARENTENA (geo_desconocida)
Verificación nocturna dirigida:
  cuarentena → rescata (MX) o descarta (extranjero/especializado)
Limpieza del banco (7 días): re-aplica todas las reglas a lo guardado
```
Todo descarte deja **nota con la razón** en el candidato (100% de cobertura), visible en la plataforma para Kari.

---

## 5. Falsos positivos conocidos (y cómo se manejan)
- **Nombres = países/ciudades** (Israel, Kenia, Milán, Roma, León, Sofía, Orlando, Virginia, China, Colombia como apellido…): el filtro **elimina el nombre antes de buscar países** → ya no bloquean. El país real solo cuenta si está en ubicación/empresa. (Reporte Karina sep-2026.)
- **"New Mexico"** contiene "mexico" → nunca se filtra (edge conocido, aceptado).
- Si aun así se cuela un falso positivo, Kari lo marca en **Depuración** (`/dashboard/cleanup`).

---

## 6. Cómo ajustar el criterio
- **Agregar/quitar un rol especializado:** `SPECIALIZED_ROLE_SIGNALS` en `sourcingScore.js`.
- **Vetar/permitir una empresa o sector:** `EXCLUDED_COMPANIES` en `excludedCompanies.js`.
- **Nombre que da falso positivo de país:** ya no debería pasar (se strip-ea el nombre); si es una ciudad rara, quitar el token de `FOREIGN_SIGNALS`.
- **Subir/bajar el umbral de score:** hoy 50 en la revisión 1x1; el slider del sourcing usa 40 por default.
- **Empresa mexicana no reconocida** (rescate de cuarentena): agregarla a la lista de anclas MX del criterio 1x1.

Relacionado: [[project_enlace468_auto_sourcing]], [[project_enlace468_arquitectura]].
