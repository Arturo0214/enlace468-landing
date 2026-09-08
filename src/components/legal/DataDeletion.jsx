import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function DataDeletion() {
  return (
    <div className="min-h-screen" style={{ background: '#0B1121' }}>
      <nav className="flex items-center justify-between px-6 py-4 max-w-4xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <img src="/brand/logo-header.svg" alt="Enlace 468" className="h-8 w-auto object-contain invert hue-rotate-180" />
        </Link>
        <Link to="/" className="text-sm text-gray-400 hover:text-white flex items-center gap-1"><ArrowLeft size={14} /> Inicio</Link>
      </nav>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-display font-bold text-white mb-2">Eliminacion de Datos de Usuario</h1>
        <p className="text-sm text-gray-500 mb-8">Ultima actualizacion: 4 de junio de 2026</p>
        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white">Solicitud de eliminacion de datos</h2>
            <p>En cumplimiento con la Ley Federal de Proteccion de Datos Personales en Posesion de los Particulares (LFPDPPP) y las politicas de Meta (Facebook/Instagram), usted tiene derecho a solicitar la eliminacion completa de sus datos personales de nuestra plataforma.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Como solicitar la eliminacion</h2>
            <p>Envie un correo electronico a <a href="mailto:ingrid.escobar@grupointegraccion.com" className="text-primary-light">ingrid.escobar@grupointegraccion.com</a> con el asunto <strong>"Solicitud de eliminacion de datos"</strong> incluyendo:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Nombre completo</li>
              <li>Correo electronico registrado</li>
              <li>Descripcion de los datos que desea eliminar</li>
              <li>Copia de identificacion oficial (para verificar su identidad)</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Datos que se eliminaran</h2>
            <p>Al procesar su solicitud, eliminaremos de forma permanente:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Informacion de perfil (nombre, correo, telefono, ubicacion)</li>
              <li>Informacion profesional y CV</li>
              <li>Historial de aplicaciones a vacantes</li>
              <li>Datos recopilados a traves de formularios de Facebook/Instagram</li>
              <li>Registros de comunicaciones</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Plazo de respuesta</h2>
            <p>Su solicitud sera procesada en un plazo maximo de <strong>15 dias habiles</strong> a partir de la recepcion del correo. Recibira una confirmacion por correo electronico una vez que sus datos hayan sido eliminados.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Contacto</h2>
            <p>Grupo Integral de Acciones Patrimoniales SC (GrupoIntegraccion)</p>
            <p>Correo: <a href="mailto:ingrid.escobar@grupointegraccion.com" className="text-primary-light">ingrid.escobar@grupointegraccion.com</a></p>
            <p>Telefono: 55.5105.1461</p>
          </section>
        </div>
        <div className="mt-12 pt-6 border-t border-white/10 text-xs text-gray-600">
          <p>Enlace 468 | Propulsa AI | Grupo Integral de Acciones Patrimoniales SC</p>
        </div>
      </div>
    </div>
  )
}
