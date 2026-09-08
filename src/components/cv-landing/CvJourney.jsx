import { motion } from 'framer-motion'
import {
  CreditCard, Upload, Sparkles, Download, ArrowRight, Check, Lock,
  FileText, FileType2, Clock,
} from 'lucide-react'
import LinkedinIcon from './LinkedinIcon'
import { PRICE, CHECKOUT_URL } from './constants'

/* ════════ Visual mockups (se animan al entrar en viewport) ════════ */

function PayVisual() {
  return (
    <div className="relative w-full max-w-xs mx-auto rounded-2xl bg-white border border-slate-200 shadow-[0_18px_44px_-18px_rgba(7,27,73,0.25)] p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pago</span>
        <Lock size={14} className="text-[#00897F]" />
      </div>
      <motion.div
        initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }}
        transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
        className="w-16 h-16 mx-auto rounded-full bg-[#E6F6F4] flex items-center justify-center mb-3"
      >
        <motion.div
          initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 260, delay: 0.45 }}
          className="w-11 h-11 rounded-full bg-[#00A99D] flex items-center justify-center"
        >
          <Check size={24} className="text-white" strokeWidth={3} />
        </motion.div>
      </motion.div>
      <p className="text-center font-display font-bold text-[#071B49] text-lg">Pago aprobado</p>
      <p className="text-center text-slate-500 text-sm mb-4">{PRICE} MXN · pago único</p>
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#00897F] bg-[#F2FAF9] rounded-lg py-2">
        <Check size={12} /> Sin crear cuenta antes
      </div>
    </div>
  )
}

function UploadVisual() {
  return (
    <div className="relative w-full max-w-xs mx-auto rounded-2xl bg-white border border-slate-200 shadow-[0_18px_44px_-18px_rgba(7,27,73,0.25)] p-5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tu CV actual</span>
      <div className="mt-3 rounded-xl border-2 border-dashed border-[#00A99D]/40 bg-[#F2FAF9] p-5 flex flex-col items-center">
        <motion.div
          initial={{ y: 24, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 180, delay: 0.2 }}
          className="w-full flex items-center gap-3 rounded-lg bg-white border border-slate-200 p-2.5 mb-3 shadow-sm"
        >
          <div className="w-9 h-9 rounded-lg bg-[#071B49] flex items-center justify-center">
            <FileText size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-[#071B49] truncate">mi_cv.pdf</p>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
              <motion.div
                initial={{ width: '0%' }} whileInView={{ width: '100%' }} viewport={{ once: true }}
                transition={{ duration: 1.1, delay: 0.5, ease: 'easeOut' }}
                className="h-full bg-[#00A99D] rounded-full"
              />
            </div>
          </div>
        </motion.div>
        <motion.span
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          transition={{ delay: 1.5 }}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#00897F]"
        >
          <Check size={12} /> CV cargado
        </motion.span>
      </div>
      <p className="text-center text-[11px] text-slate-400 mt-3">PDF · DOC · DOCX</p>
    </div>
  )
}

const optKeywords = ['Liderazgo', 'SQL', 'KPIs', 'Negociación', 'Power BI']

function OptimizeVisual() {
  return (
    <div className="relative w-full max-w-xs mx-auto rounded-2xl bg-white border border-slate-200 shadow-[0_18px_44px_-18px_rgba(7,27,73,0.25)] p-5 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#00897F]">
          <Sparkles size={12} /> Optimizando con IA
        </span>
        {/* mini ATS ring */}
        <div className="relative w-10 h-10">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="16" fill="none" stroke="#E2E8F0" strokeWidth="4" />
            <motion.circle
              cx="20" cy="20" r="16" fill="none" stroke="#00A99D" strokeWidth="4" strokeLinecap="round"
              strokeDasharray="100" initial={{ strokeDashoffset: 100 }}
              whileInView={{ strokeDashoffset: 8 }} viewport={{ once: true }}
              transition={{ duration: 1.4, delay: 0.4, ease: 'easeOut' }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-[#071B49]">92%</span>
        </div>
      </div>

      {/* CV mock with scanning line */}
      <div className="relative rounded-xl bg-slate-50 border border-slate-200 p-3 h-28 overflow-hidden">
        {[88, 70, 94, 60, 80, 50].map((w, i) => (
          <div key={i} className="h-1.5 rounded-full bg-slate-200 mb-1.5" style={{ width: `${w}%` }} />
        ))}
        <motion.div
          className="absolute left-0 right-0 h-8 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, transparent, rgba(0,169,157,0.25), transparent)' }}
          animate={{ y: [-32, 112] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute left-0 right-0 h-0.5 bg-[#00A99D]"
          animate={{ y: [-4, 112] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* keywords popping */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {optKeywords.map((k, i) => (
          <motion.span
            key={k}
            initial={{ opacity: 0, scale: 0.7 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
            transition={{ delay: 0.6 + i * 0.18 }}
            className="text-[10px] px-2 py-0.5 rounded-full bg-[#071B49]/[0.06] text-[#1E3A6B] border border-[#071B49]/10 font-medium"
          >
            + {k}
          </motion.span>
        ))}
      </div>
    </div>
  )
}

const deliverables = [
  { icon: FileText, label: 'CV optimizado', file: '.pdf · .docx', color: '#071B49' },
  { icon: LinkedinIcon, label: 'Kit de LinkedIn', file: '.pdf', color: '#0A66C2' },
  { icon: FileType2, label: 'Diagnóstico', file: '.pdf', color: '#00A99D' },
]

function DeliverVisual() {
  return (
    <div className="relative w-full max-w-xs mx-auto space-y-2.5">
      {deliverables.map((d, i) => (
        <motion.div
          key={d.label}
          initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 160, delay: 0.15 + i * 0.18 }}
          className="flex items-center gap-3 rounded-2xl bg-white border border-slate-200 shadow-[0_12px_30px_-16px_rgba(7,27,73,0.3)] p-3.5"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: d.color }}>
            <d.icon size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-[#071B49] truncate">{d.label}</p>
            <p className="text-[11px] text-slate-400 font-mono">{d.file}</p>
          </div>
          <motion.div
            initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }}
            transition={{ type: 'spring', delay: 0.5 + i * 0.18 }}
            className="w-8 h-8 rounded-lg bg-[#E6F6F4] flex items-center justify-center flex-shrink-0"
          >
            <Download size={15} className="text-[#00897F]" />
          </motion.div>
        </motion.div>
      ))}
    </div>
  )
}

/* ════════ Beats data ════════ */
const beats = [
  { n: 1, icon: CreditCard, time: '1 min', title: 'Realiza tu pago seguro', desc: 'Pagas $499 MXN una sola vez. Sin crear cuenta, sin suscripciones, sin letras chiquitas.', Visual: PayVisual },
  { n: 2, icon: Upload, time: '5 min', title: 'Sube tu CV y tu objetivo', desc: 'Llenas un formulario corto y nos dices a qué puesto aspiras. Nosotros nos encargamos del resto.', Visual: UploadVisual },
  { n: 3, icon: Sparkles, time: 'Magia', title: 'La IA optimiza tu marca', desc: 'Reescribimos tu CV para pasar los filtros ATS y creamos tus textos de LinkedIn — siempre con tu información real.', Visual: OptimizeVisual },
  { n: 4, icon: Download, time: 'Listo', title: 'Recibe tu marca lista', desc: 'Descargas tu CV, tu kit de LinkedIn y tu diagnóstico desde tu enlace privado. Listos para usar hoy.', Visual: DeliverVisual },
]

/* ════════ Section ════════ */
export default function CvJourney() {
  return (
    <section id="como-funciona" className="relative py-20 sm:py-28 overflow-hidden" style={{ background: '#FFFFFF' }}>
      {/* soft brand glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] rounded-full blur-[160px] bg-[#00A99D]/[0.06] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-16 sm:mb-20"
        >
          <span className="text-[13px] font-bold uppercase tracking-widest text-[#00897F]">Así de simple</span>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-[#071B49] mt-3 mb-4">
            De tu CV actual a tu{' '}
            <span className="text-[#00A99D]">mejor versión</span>
          </h2>
          <p className="text-slate-600 text-base">Mira cómo se transforma tu marca, paso a paso.</p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* center vertical line (desktop) */}
          <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-2 bottom-2 w-0.5 bg-gradient-to-b from-[#00A99D]/0 via-[#00A99D]/30 to-[#00A99D]/0" />

          <div className="space-y-12 md:space-y-20">
            {beats.map((b, i) => {
              const flip = i % 2 === 1
              return (
                <div key={b.n} className="relative md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-8">
                  {/* TEXT */}
                  <motion.div
                    initial={{ opacity: 0, x: flip ? 40 : -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.5 }}
                    className={`${flip ? 'md:order-3 md:text-left md:pl-4' : 'md:order-1 md:text-right md:pr-4'}`}
                  >
                    <div className={`inline-flex items-center gap-2 mb-3 ${flip ? '' : 'md:flex-row-reverse'}`}>
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#00897F] bg-[#E6F6F4] px-2.5 py-1 rounded-full">
                        <Clock size={11} /> {b.time}
                      </span>
                      <span className="text-[12px] font-bold text-slate-500">Paso {b.n}</span>
                    </div>
                    <h3 className="font-display font-bold text-xl sm:text-2xl text-[#071B49] mb-2">{b.title}</h3>
                    <p className="text-slate-600 text-[15px] leading-relaxed max-w-sm md:inline-block">{b.desc}</p>
                  </motion.div>

                  {/* NODE */}
                  <div className="md:order-2 relative z-10 flex md:block items-center gap-3 my-4 md:my-0">
                    <motion.div
                      initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }}
                      transition={{ type: 'spring', stiffness: 200 }}
                      className="w-14 h-14 rounded-2xl bg-[#071B49] flex items-center justify-center shadow-lg shadow-[#071B49]/20 ring-4 ring-white"
                    >
                      <b.icon size={22} className="text-[#7FD9D1]" />
                    </motion.div>
                  </div>

                  {/* VISUAL */}
                  <motion.div
                    initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className={`${flip ? 'md:order-1' : 'md:order-3'}`}
                  >
                    <b.Visual />
                  </motion.div>
                </div>
              )
            })}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mt-16"
        >
          <a
            href={CHECKOUT_URL}
            className="group inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-[#00A99D] text-white font-bold text-lg shadow-xl shadow-[#00A99D]/30 hover:bg-[#00897F] hover:-translate-y-0.5 transition-all"
          >
            Quiero empezar ahora · {PRICE}
            <ArrowRight size={19} className="group-hover:translate-x-1 transition-transform" />
          </a>
          <p className="text-[13px] text-slate-400 mt-3">Tu nueva marca, lista para conseguir entrevistas.</p>
        </motion.div>
      </div>
    </section>
  )
}
