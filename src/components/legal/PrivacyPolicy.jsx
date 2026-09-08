import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen" style={{ background: '#0B1121' }}>
      <nav className="flex items-center justify-between px-6 py-4 max-w-4xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <img src="/brand/logo-header.svg" alt="Enlace 468" className="h-8 w-auto object-contain invert hue-rotate-180" />
        </Link>
        <Link to="/" className="text-sm text-gray-400 hover:text-white flex items-center gap-1"><ArrowLeft size={14} /> Inicio</Link>
      </nav>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-display font-bold text-white mb-2">Aviso de Privacidad</h1>
        <p className="text-sm text-gray-500 mb-8">Ultima actualizacion: 4 de junio de 2026</p>
        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white">1. Responsable del tratamiento</h2>
            <p><strong>Enlace 468</strong>, operado por Grupo Integral de Acciones Patrimoniales SC (GrupoIntegraccion), con domicilio en Ciudad de Mexico, Mexico, es responsable del tratamiento de sus datos personales conforme a la Ley Federal de Proteccion de Datos Personales en Posesion de los Particulares (LFPDPPP).</p>
            <p>Correo de contacto: <a href="mailto:ingrid.escobar@grupointegraccion.com" className="text-primary-light">ingrid.escobar@grupointegraccion.com</a></p>
            <p>Telefono: 55.5105.1461</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">2. Datos personales recabados</h2>
            <p>Recabamos los siguientes datos personales para las finalidades descritas en este aviso:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Nombre completo</li>
              <li>Correo electronico</li>
              <li>Numero de telefono</li>
              <li>Ubicacion (ciudad/estado)</li>
              <li>Informacion profesional (puesto actual, empresa, experiencia)</li>
              <li>Curriculum Vitae</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">3. Finalidades del tratamiento</h2>
            <p>Sus datos personales seran utilizados para:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Finalidades primarias:</strong> Procesos de reclutamiento y seleccion de personal, evaluacion de perfiles, contacto con candidatos, seguimiento de pipeline de talento, generacion de reportes ejecutivos.</li>
              <li><strong>Finalidades secundarias:</strong> Envio de comunicaciones sobre oportunidades laborales, invitaciones a eventos de capacitacion, mejora de nuestros servicios de Talent Intelligence.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">4. Transferencia de datos</h2>
            <p>Sus datos podran ser compartidos con las empresas clientes que publican vacantes a traves de nuestra plataforma, exclusivamente para fines de reclutamiento. No vendemos ni compartimos datos personales con terceros para fines de marketing.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">5. Derechos ARCO</h2>
            <p>Usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse al tratamiento de sus datos personales (derechos ARCO). Para ejercer estos derechos, envie su solicitud a <a href="mailto:ingrid.escobar@grupointegraccion.com" className="text-primary-light">ingrid.escobar@grupointegraccion.com</a> con su nombre completo, descripcion del derecho que desea ejercer y copia de identificacion oficial.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">6. Uso de cookies y tecnologias</h2>
            <p>Nuestro sitio web utiliza cookies y tecnologias similares para mejorar la experiencia del usuario, analizar trafico y personalizar contenido. Al continuar navegando, acepta el uso de estas tecnologias.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">7. Campanas publicitarias</h2>
            <p>Cuando usted proporciona sus datos a traves de formularios en plataformas de terceros (Facebook, Instagram, LinkedIn), dichos datos son procesados conforme a este aviso de privacidad y las politicas de la plataforma correspondiente.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">8. Modificaciones</h2>
            <p>Nos reservamos el derecho de modificar este aviso de privacidad. Cualquier cambio sera publicado en esta pagina.</p>
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
