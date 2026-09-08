import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function TermsOfService() {
  return (
    <div className="min-h-screen" style={{ background: '#0B1121' }}>
      <nav className="flex items-center justify-between px-6 py-4 max-w-4xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <img src="/brand/logo-header.svg" alt="Enlace 468" className="h-8 w-auto object-contain invert hue-rotate-180" />
        </Link>
        <Link to="/" className="text-sm text-gray-400 hover:text-white flex items-center gap-1"><ArrowLeft size={14} /> Inicio</Link>
      </nav>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-display font-bold text-white mb-2">Terminos y Condiciones de Servicio</h1>
        <p className="text-sm text-gray-500 mb-8">Ultima actualizacion: 4 de junio de 2026</p>
        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white">1. Aceptacion de los terminos</h2>
            <p>Al acceder y utilizar la plataforma Enlace 468 (el "Servicio"), operada por Grupo Integral de Acciones Patrimoniales SC (GrupoIntegraccion), usted acepta estos Terminos y Condiciones. Si no esta de acuerdo, no utilice el Servicio.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">2. Descripcion del servicio</h2>
            <p>Enlace 468 es una plataforma de Talent Intelligence que ofrece:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Gestion de vacantes y pipeline de candidatos</li>
              <li>Herramientas de sourcing y screening con inteligencia artificial</li>
              <li>Campanas de captacion de talento en redes sociales</li>
              <li>Reportes ejecutivos y analytics de reclutamiento</li>
              <li>Capacitacion y recursos para reclutadores (Academy)</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">3. Registro y cuentas</h2>
            <p>Para acceder al Servicio, debe crear una cuenta proporcionando informacion veraz y actualizada. Usted es responsable de mantener la confidencialidad de sus credenciales de acceso.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">4. Uso aceptable</h2>
            <p>Usted se compromete a:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Utilizar el Servicio unicamente para fines de reclutamiento y gestion de talento</li>
              <li>No compartir datos de candidatos con terceros no autorizados</li>
              <li>No utilizar el Servicio para discriminar a candidatos por motivos prohibidos por la ley</li>
              <li>Cumplir con la legislacion laboral mexicana aplicable</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">5. Propiedad intelectual</h2>
            <p>Enlace 468, Propulsa AI, TalentFlix y las marcas asociadas son propiedad de Grupo Integral de Acciones Patrimoniales SC. Los algoritmos, interfaces y contenido de la plataforma estan protegidos por derechos de autor.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">6. Planes y pagos</h2>
            <p>Los precios y caracteristicas de cada plan se publican en la plataforma. Los pagos son en pesos mexicanos (MXN) y no incluyen IVA salvo que se indique. Las suscripciones se renuevan automaticamente.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">7. Limitacion de responsabilidad</h2>
            <p>Enlace 468 facilita el proceso de reclutamiento pero no garantiza la contratacion de candidatos. No somos responsables de las decisiones de contratacion tomadas por nuestros clientes ni de la veracidad de la informacion proporcionada por los candidatos.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">8. Cancelacion</h2>
            <p>Puede cancelar su cuenta en cualquier momento desde la configuracion de la plataforma. La cancelacion no genera reembolsos de periodos ya pagados.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">9. Legislacion aplicable</h2>
            <p>Estos terminos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier controversia sera resuelta ante los tribunales competentes de la Ciudad de Mexico.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">10. Contacto</h2>
            <p>Para dudas sobre estos terminos: <a href="mailto:ingrid.escobar@grupointegraccion.com" className="text-primary-light">ingrid.escobar@grupointegraccion.com</a> | Tel: 55.5105.1461</p>
          </section>
        </div>
        <div className="mt-12 pt-6 border-t border-white/10 text-xs text-gray-600">
          <p>Enlace 468 | Propulsa AI | Grupo Integral de Acciones Patrimoniales SC</p>
          <p>Conectando talento, conocimiento y tecnologia.</p>
        </div>
      </div>
    </div>
  )
}
