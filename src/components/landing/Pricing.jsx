import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Building2, Users, GraduationCap, UserCheck, Briefcase, ShoppingCart, Plus, CheckCheck } from 'lucide-react'
import { useCart } from '../../lib/cartContext'
import CartDrawer from '../cart/CartDrawer'

const productLines = [
  {
    id: 'enterprise',
    label: 'Enterprise',
    icon: Building2,
    description: 'Para empresas que desean operar reclutamiento con IA',
    tiers: [
      {
        name: 'Enterprise Starter',
        price: '$14,900',
        unit: 'MXN/mes',
        setup: '+ $25,000 setup',
        idealPara: 'PyME o empresa con 1 a 3 vacantes al mes',
        features: [
          'Plataforma base con configuración inicial',
          '1 usuario administrador',
          'Hasta 3 vacantes activas',
          'Screening automático de candidatos',
          'Pipeline de reclutamiento',
          'Plantillas prediseñadas',
          'Reporte básico mensual',
        ],
        recommended: false,
      },
      {
        name: 'Enterprise Growth',
        price: '$29,900',
        unit: 'MXN/mes',
        setup: '+ $45,000 setup',
        idealPara: 'Empresa con flujo constante de talento',
        features: [
          'Todo lo de Starter incluido',
          'Hasta 8 vacantes activas',
          'Banco de candidatos persistente',
          'Prompts personalizados de IA',
          'Reportes ejecutivos avanzados',
          'Sesión mensual con Ingrid/Propulsa',
        ],
        recommended: true,
      },
      {
        name: 'Enterprise Partner',
        price: '$59,000',
        unit: 'MXN/mes',
        setup: '+ $75,000 setup',
        idealPara: 'Área formal de RH o varias unidades de negocio',
        features: [
          'Todo Growth incluido',
          'Vacantes ampliadas e ilimitadas',
          'Configuración por perfiles de puesto',
          'Tableros ejecutivos personalizados',
          'Acompañamiento estratégico mensual',
          'Calibración mensual con Ingrid/Propulsa',
          'Soporte prioritario dedicado',
        ],
        recommended: false,
      },
    ],
  },
  {
    id: 'talent-desk',
    label: 'Talent Desk',
    icon: Briefcase,
    description: 'Producto ancla \u2014 la empresa compra candidatos accionables para una vacante específica',
    tiers: [
      {
        name: 'Talent Desk Light',
        price: '$4,900',
        unit: 'MXN por vacante',
        setup: null,
        idealPara: 'Empresa que quiere validar el servicio',
        features: [
          '10 candidatos mapeados',
          'Búsqueda inicial de talento',
          'Ficha resumida por candidato',
          'Recomendación básica',
        ],
        recommended: false,
      },
      {
        name: 'Talent Desk Pro',
        price: '$9,900',
        unit: 'MXN por vacante',
        setup: null,
        idealPara: 'Empresa con vacante activa y necesidad real',
        features: [
          '15 candidatos mapeados',
          'Ranking por match de compatibilidad',
          'Comentarios cualitativos por perfil',
          'Mensajes de outreach sugeridos',
          'Reporte ejecutivo de vacante',
        ],
        recommended: true,
      },
      {
        name: 'Talent Desk Premium',
        price: '$24,900',
        unit: 'MXN por vacante',
        setup: null,
        idealPara: 'Empresa que quiere acompañamiento mayor',
        features: [
          'Short list curada de candidatos',
          'Contacto inicial con candidatos',
          'Validación básica de interés',
          'Agenda sugerida de entrevistas',
          'Reporte ejecutivo final detallado',
        ],
        recommended: false,
      },
    ],
  },
  {
    id: 'recruiter-pro',
    label: 'Recruiter Pro',
    icon: UserCheck,
    description: 'Herramienta para reclutadores \u2014 convertir al reclutador en un operador más productivo',
    tiers: [
      {
        name: 'Recruiter Basic',
        price: '$499',
        unit: 'MXN/mes',
        setup: null,
        idealPara: 'Reclutador junior o usuario individual',
        features: [
          'Prompts de reclutamiento con IA',
          'Plantillas de comunicación',
          'Guías de búsqueda de talento',
          'Formatos de seguimiento',
        ],
        recommended: false,
      },
      {
        name: 'Recruiter Pro',
        price: '$899',
        unit: 'MXN/mes',
        setup: null,
        idealPara: 'Reclutador activo con vacantes recurrentes',
        features: [
          'Herramientas avanzadas de búsqueda',
          'Screening asistido por IA',
          'Templates de outreach personalizados',
          'Pipeline básico de candidatos',
          'Banco individual de talento',
        ],
        recommended: true,
      },
      {
        name: 'Recruiter Elite',
        price: '$1,499',
        unit: 'MXN/mes',
        setup: null,
        idealPara: 'Reclutador senior o freelance',
        features: [
          'Todo Pro incluido',
          'Reportes mensuales de productividad',
          'Mejores prácticas actualizadas',
          'Sesiones grupales mensuales',
          'Recursos y templates avanzados',
        ],
        recommended: false,
      },
      {
        name: 'Recruiter + Acompañamiento',
        price: '$2,900',
        unit: 'MXN/mes',
        setup: null,
        idealPara: 'Reclutador que quiere elevar productividad',
        features: [
          'Todo Elite incluido',
          'Sesión mensual de calibración 1:1',
          'Revisión de vacantes personalizada',
          'Prompts personalizados por industria',
          'Seguimiento y feedback continuo',
        ],
        recommended: false,
      },
    ],
  },
  {
    id: 'academy',
    label: 'Academy',
    icon: GraduationCap,
    description: 'Membresía de comunidad, educación continua y upsell',
    tiers: [
      {
        name: 'Academy Free',
        price: '$0',
        unit: 'MXN',
        setup: null,
        idealPara: 'Captura de leads y exploración del ecosistema',
        features: [
          'Acceso limitado a recursos',
          'Newsletter semanal',
          'Clase abierta o material de muestra',
        ],
        recommended: false,
      },
      {
        name: 'Academy Founder',
        price: '$299',
        unit: 'MXN/mes',
        setup: null,
        idealPara: 'Asistentes del taller Apprifac',
        features: [
          'Prompts básicos de reclutamiento',
          'Plantillas descargables',
          'Mini guías de implementación',
          'Acceso a comunidad privada',
          'Recursos descargables exclusivos',
        ],
        recommended: true,
      },
      {
        name: 'Academy Plus',
        price: '$499',
        unit: 'MXN/mes',
        setup: null,
        idealPara: 'Reclutador que aprende de forma continua',
        features: [
          'Todo Founder incluido',
          'Biblioteca extendida de contenido',
          'Casos prácticos reales',
          'Clases grabadas on-demand',
          'Nuevos prompts mensuales',
        ],
        recommended: false,
      },
      {
        name: 'Academy Pro',
        price: '$799',
        unit: 'MXN/mes',
        setup: null,
        idealPara: 'Consultor o reclutador que quiere profesionalizarse',
        features: [
          'Todo Plus incluido',
          'Sesiones mensuales en vivo',
          'Playbooks ejecutivos',
          'Formatos ejecutivos descargables',
          'Guías especializadas por industria',
        ],
        recommended: false,
      },
    ],
  },
  {
    id: 'tu-marca-vende',
    label: 'Tu Marca Vende',
    icon: Users,
    description: 'Para candidatos \u2014 mejorar CV, LinkedIn, pitch y posicionamiento profesional',
    tiers: [
      {
        name: 'Diagnóstico OpenToWork',
        price: '$399',
        unit: 'MXN (one-time)',
        setup: null,
        idealPara: 'Persona que quiere saber qué mejorar',
        features: [
          'Diagnóstico rápido de LinkedIn/CV',
          'Score básico de perfil profesional',
          'Recomendaciones iniciales personalizadas',
        ],
        recommended: false,
      },
      {
        name: 'Perfil Profesional IA',
        price: '$1,499',
        unit: 'MXN (one-time)',
        setup: null,
        idealPara: 'Candidato que necesita mejorar su presentación profesional',
        features: [
          'Optimización completa de CV',
          'Headline profesional optimizado',
          'Sección "Acerca de mí" reescrita',
          'Palabras clave estratégicas',
          'Pitch profesional personalizado',
        ],
        recommended: true,
      },
      {
        name: 'Tu Marca Vende Pro',
        price: '$2,900',
        unit: 'MXN (one-time)',
        setup: null,
        idealPara: 'Profesional que busca mejores oportunidades',
        features: [
          'Todo Perfil IA incluido',
          'Simulación de entrevista con IA',
          'Narrativa profesional completa',
          'Estrategia de visibilidad digital',
          'Perfil listo para marketplace',
        ],
        recommended: false,
      },
      {
        name: 'Acompañamiento 30 días',
        price: '$5,900',
        unit: 'MXN (one-time)',
        setup: null,
        idealPara: 'Persona en transición laboral o búsqueda activa',
        features: [
          'Todo Pro incluido',
          'Seguimiento semanal personalizado',
          'Ajustes continuos de perfil',
          'Preparación de entrevistas reales',
          'Estrategia de aplicaciones activa',
        ],
        recommended: false,
      },
    ],
  },
]

function parsePrice(priceStr) {
  const cleaned = priceStr.replace(/[^0-9]/g, '')
  return parseInt(cleaned, 10) || 0
}

function parseSetupFee(setupStr) {
  if (!setupStr) return 0
  const cleaned = setupStr.replace(/[^0-9]/g, '')
  return parseInt(cleaned, 10) || 0
}

function tierToPlan(tier, product) {
  const tierIndex = product.tiers.indexOf(tier)
  return {
    id: `${product.id}-${tierIndex}`,
    name: tier.name,
    product_line: product.id,
    product_line_label: product.label,
    price_mxn: parsePrice(tier.price),
    billing_cycle: tier.unit,
    setup_fee_mxn: parseSetupFee(tier.setup),
  }
}

export default function Pricing() {
  const [activeTab, setActiveTab] = useState('enterprise')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { addItem, itemCount, items } = useCart()

  const activeProduct = productLines.find((p) => p.id === activeTab)

  function handleAddToCart(tier, product) {
    const plan = tierToPlan(tier, product)
    addItem(plan)
  }

  function isInCart(tier, product) {
    const tierIndex = product.tiers.indexOf(tier)
    const planId = `${product.id}-${tierIndex}`
    return items.some((item) => item.plan.id === planId)
  }

  return (
    <section id="precios" className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-white mb-4">
            Arquitectura de{' '}
            <span className="gradient-text">Precios</span>
          </h2>
          <p className="text-gray-400 max-w-3xl mx-auto text-lg">
            Talent Intelligence Marketplace | 5 líneas de producto diseñadas para cada perfil
          </p>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-12"
        >
          {productLines.map((product) => {
            const Icon = product.icon
            const isActive = activeTab === product.id
            return (
              <button
                key={product.id}
                onClick={() => setActiveTab(product.id)}
                className={`flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl text-sm sm:text-base font-medium transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/20'
                    : 'glass text-gray-400 hover:text-white hover:border-white/10'
                }`}
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">{product.label}</span>
                <span className="sm:hidden">{product.label.split(' ')[0]}</span>
              </button>
            )
          })}
        </motion.div>

        {/* Product description */}
        <AnimatePresence mode="wait">
          <motion.p
            key={activeProduct.id + '-desc'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="text-center text-gray-400 text-sm sm:text-base mb-10 max-w-2xl mx-auto"
          >
            {activeProduct.description}
          </motion.p>
        </AnimatePresence>

        {/* Pricing cards */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeProduct.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className={`grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 ${
              activeProduct.tiers.length >= 4
                ? 'lg:grid-cols-4'
                : activeProduct.tiers.length === 3
                ? 'lg:grid-cols-3'
                : 'max-w-4xl mx-auto'
            }`}
          >
            {activeProduct.tiers.map((tier, i) => (
              <div
                key={tier.name}
                className={`relative glass rounded-2xl p-8 transition-all duration-300 hover:scale-[1.02] ${
                  tier.recommended
                    ? 'border-accent/40 border-2 shadow-lg shadow-accent/10'
                    : 'border border-white/5'
                }`}
              >
                {/* Recommended badge */}
                {tier.recommended && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-accent to-accent-light text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg shadow-accent/20">
                      Recomendado
                    </span>
                  </div>
                )}

                {/* Tier name */}
                <h3 className="font-display font-bold text-xl text-white mb-2 mt-1">
                  {tier.name}
                </h3>

                {/* Price */}
                <div className="mb-1">
                  <span className={`font-display font-bold text-3xl sm:text-4xl ${
                    tier.recommended ? 'gradient-text' : 'text-white'
                  }`}>
                    {tier.price}
                  </span>
                  <span className="text-gray-400 text-sm ml-2">{tier.unit}</span>
                </div>

                {/* Setup fee */}
                {tier.setup && (
                  <p className="text-gray-500 text-sm mb-4">{tier.setup}</p>
                )}
                {!tier.setup && <div className="mb-4" />}

                {/* Ideal para */}
                <div className="glass rounded-xl p-3 mb-6">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-medium">
                    Ideal para
                  </p>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {tier.idealPara}
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        tier.recommended
                          ? 'bg-accent/15 text-accent'
                          : 'bg-primary/15 text-primary-light'
                      }`}>
                        <Check className="w-3 h-3" />
                      </div>
                      <span className="text-gray-300 text-sm leading-relaxed">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="mt-8 space-y-2">
                  {(() => {
                    const inCart = isInCart(tier, activeProduct)
                    return (
                      <button
                        onClick={() => handleAddToCart(tier, activeProduct)}
                        disabled={inCart}
                        className={`flex items-center justify-center gap-2 w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-300 ${
                          inCart
                            ? 'bg-accent/10 border border-accent/30 text-accent cursor-default'
                            : tier.recommended
                            ? 'bg-gradient-to-r from-accent to-accent-light text-white hover:shadow-lg hover:shadow-accent/20 hover:-translate-y-0.5'
                            : 'border border-white/10 text-gray-300 hover:border-primary/40 hover:text-white hover:bg-primary/5'
                        }`}
                      >
                        {inCart ? (
                          <>
                            <CheckCheck className="w-4 h-4" />
                            En el carrito
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            Agregar al carrito
                          </>
                        )}
                      </button>
                    )
                  })()}
                </div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Bottom note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center text-gray-500 text-sm mt-12 max-w-xl mx-auto"
        >
          Todos los precios en MXN antes de IVA. Cada línea de producto cuenta con tiers adicionales.{' '}
          <a href="#contacto" className="text-accent hover:text-accent-light transition-colors underline underline-offset-2">
            Contáctanos
          </a>{' '}
          para una propuesta personalizada.
        </motion.p>
      </div>

      {/* Floating cart button */}
      <AnimatePresence>
        {itemCount > 0 && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setDrawerOpen(true)}
            className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/30 flex items-center justify-center"
          >
            <ShoppingCart className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shadow">
              {itemCount}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Cart drawer */}
      <CartDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </section>
  )
}
