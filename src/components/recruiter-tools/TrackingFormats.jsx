import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ClipboardList, Copy, Check, ChevronLeft } from 'lucide-react'

const formats = [
  {
    title: 'Pipeline de Reclutamiento - Checklist por Etapa',
    description: 'Checklist completo con acciones por cada etapa del proceso de seleccion',
    content: `PIPELINE DE RECLUTAMIENTO - CHECKLIST POR ETAPA
================================================

1. INTAKE / LEVANTAMIENTO DE VACANTE
[ ] Reunion con hiring manager completada
[ ] Job description aprobada
[ ] Rango salarial y presupuesto confirmado
[ ] Perfil ideal definido (must-have vs nice-to-have)
[ ] Timeline del proceso acordado
[ ] Canal de comunicacion con hiring manager definido

2. SOURCING / BUSQUEDA
[ ] Publicacion en bolsas de trabajo (OCC, LinkedIn, Indeed)
[ ] Boolean search ejecutada en LinkedIn
[ ] Base de datos interna revisada
[ ] Referidos solicitados al equipo
[ ] Mapeo de empresas target completado
[ ] Minimo 20 candidatos identificados

3. SCREENING / FILTRO INICIAL
[ ] CVs revisados contra requisitos (minimo 10)
[ ] Pre-screening telefonico realizado
[ ] Candidatos descartados notificados
[ ] Shortlist de 5-8 candidatos preparada
[ ] Expedientes armados con notas de screening

4. ENTREVISTAS
[ ] Entrevista por competencias realizada
[ ] Entrevista tecnica coordinada con hiring manager
[ ] Scorecard completado por cada entrevistador
[ ] Referencias laborales solicitadas
[ ] Evaluaciones psicometricas aplicadas

5. PRESENTACION Y OFERTA
[ ] Terna de 3 candidatos presentada a hiring manager
[ ] Feedback de hiring manager documentado
[ ] Oferta economica preparada y aprobada
[ ] Carta oferta enviada al candidato seleccionado
[ ] Negociacion salarial (si aplica) documentada

6. CIERRE
[ ] Oferta aceptada / carta firmada
[ ] Fecha de ingreso confirmada
[ ] Candidatos no seleccionados notificados
[ ] Expediente de contratacion entregado a RRHH
[ ] Reporte de cierre de vacante completado`,
  },
  {
    title: 'Bitacora Diaria del Reclutador',
    description: 'Template para registrar tu actividad diaria y medir tu productividad',
    content: `BITACORA DIARIA DEL RECLUTADOR
================================
Fecha: ___/___/______
Reclutador: _________________

ACTIVIDADES DE SOURCING
-----------------------
Vacante: _________________
Candidatos identificados hoy: ___
Fuentes utilizadas: [ ] LinkedIn [ ] OCC [ ] Referidos [ ] Otro: ___
Boolean strings usadas: _________________
Notas: _________________

CONTACTOS REALIZADOS
--------------------
| # | Candidato | Vacante | Canal | Respuesta |
|---|-----------|---------|-------|-----------|
| 1 | _________ | _______ | _____ | Si/No/Pendiente |
| 2 | _________ | _______ | _____ | Si/No/Pendiente |
| 3 | _________ | _______ | _____ | Si/No/Pendiente |
| 4 | _________ | _______ | _____ | Si/No/Pendiente |
| 5 | _________ | _______ | _____ | Si/No/Pendiente |

ENTREVISTAS DEL DIA
--------------------
| Hora | Candidato | Vacante | Tipo | Resultado |
|------|-----------|---------|------|-----------|
| ____ | _________ | _______ | ____ | _________ |
| ____ | _________ | _______ | ____ | _________ |

METRICAS DEL DIA
-----------------
CVs revisados: ___
Llamadas realizadas: ___
Entrevistas completadas: ___
Candidatos presentados: ___
Ofertas extendidas: ___

PENDIENTES PARA MANANA
-----------------------
1. _________________
2. _________________
3. _________________

NOTAS / OBSERVACIONES
---------------------
_________________`,
  },
  {
    title: 'Reporte Semanal de Vacantes',
    description: 'Formato para reportar estatus de vacantes al final de cada semana',
    content: `REPORTE SEMANAL DE VACANTES
============================
Semana: ___ al ___ de __________ 20__
Reclutador: _________________

RESUMEN GENERAL
---------------
Total vacantes activas: ___
Vacantes nuevas esta semana: ___
Vacantes cerradas esta semana: ___
Candidatos en pipeline total: ___

DETALLE POR VACANTE
-------------------

VACANTE 1: _________________
Cliente/Area: _________________
Dias abierta: ___
Estatus: [ ] Sourcing [ ] Entrevistas [ ] Terna [ ] Oferta [ ] Cerrada
Pipeline: ___ sourced / ___ contactados / ___ en entrevista / ___ presentados
Acciones de la semana: _________________
Riesgos/Blockers: _________________
Plan para siguiente semana: _________________

VACANTE 2: _________________
Cliente/Area: _________________
Dias abierta: ___
Estatus: [ ] Sourcing [ ] Entrevistas [ ] Terna [ ] Oferta [ ] Cerrada
Pipeline: ___ sourced / ___ contactados / ___ en entrevista / ___ presentados
Acciones de la semana: _________________
Riesgos/Blockers: _________________
Plan para siguiente semana: _________________

VACANTE 3: _________________
Cliente/Area: _________________
Dias abierta: ___
Estatus: [ ] Sourcing [ ] Entrevistas [ ] Terna [ ] Oferta [ ] Cerrada
Pipeline: ___ sourced / ___ contactados / ___ en entrevista / ___ presentados
Acciones de la semana: _________________
Riesgos/Blockers: _________________
Plan para siguiente semana: _________________

KPIs DE LA SEMANA
-----------------
Tasa de respuesta de outreach: ___%
Tiempo promedio por etapa: ___ dias
Candidatos descartados: ___ (razon principal: _________)
Satisfaccion del hiring manager: [ ] Alta [ ] Media [ ] Baja`,
  },
  {
    title: 'Formato de Feedback de Candidato',
    description: 'Evaluacion estandarizada para documentar entrevistas con candidatos',
    content: `FORMATO DE FEEDBACK DE CANDIDATO
==================================
Fecha de entrevista: ___/___/______
Entrevistador: _________________

DATOS DEL CANDIDATO
-------------------
Nombre: _________________
Puesto evaluado: _________________
Empresa actual: _________________
Anios de experiencia: ___

EVALUACION POR COMPETENCIA (1-5)
---------------------------------
1 = No cumple | 2 = Parcialmente | 3 = Cumple | 4 = Supera | 5 = Excepcional

Competencia tecnica/funcional:     [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]
Notas: _________________

Liderazgo / Gestion de equipos:    [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]
Notas: _________________

Comunicacion:                      [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]
Notas: _________________

Resolucion de problemas:           [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]
Notas: _________________

Fit cultural:                      [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]
Notas: _________________

SCORE TOTAL: ___ / 25

IMPRESION GENERAL
-----------------
Fortalezas principales:
1. _________________
2. _________________
3. _________________

Areas de mejora / Riesgos:
1. _________________
2. _________________

Expectativa salarial: $___________ MXN (bruto mensual)
Disponibilidad: _________________
Motivacion para el cambio: _________________

DECISION
--------
[ ] Avanza a siguiente etapa
[ ] Rechazado - No cumple perfil tecnico
[ ] Rechazado - No cumple fit cultural
[ ] Rechazado - Expectativas salariales fuera de rango
[ ] En espera / Segunda opinion necesaria

Comentarios adicionales:
_________________

Firma del entrevistador: _________________`,
  },
]

export default function TrackingFormats() {
  const [copiedIdx, setCopiedIdx] = useState(null)

  const handleCopy = async (text, idx) => {
    await navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <Link to="/dashboard/recruiter-tools" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-4">
          <ChevronLeft size={16} /> Recruiter Pro Tools
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-primary/10 flex items-center justify-center">
            <ClipboardList size={20} className="text-emerald-400" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white">Formatos de Seguimiento</h1>
        </div>
        <p className="text-gray-400 mt-1 max-w-2xl">
          Checklists y formatos listos para copiar y usar en tu dia a dia como reclutador. Copia el formato y pegalo en tu herramienta favorita.
        </p>
      </motion.div>

      <div className="space-y-6">
        {formats.map((format, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
            className="glass rounded-xl p-5"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-white mb-1">{format.title}</h3>
                <p className="text-sm text-gray-400">{format.description}</p>
              </div>
              <button
                onClick={() => handleCopy(format.content, idx)}
                className={`flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg transition-colors flex-shrink-0 ml-4 ${
                  copiedIdx === idx
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-primary/10 text-primary-light hover:text-white'
                }`}
              >
                {copiedIdx === idx ? <Check size={14} /> : <Copy size={14} />}
                {copiedIdx === idx ? 'Copiado' : 'Copiar formato'}
              </button>
            </div>
            <div className="bg-black/30 rounded-lg p-4 border border-white/10 max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
              <pre className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap font-mono">
                {format.content}
              </pre>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
