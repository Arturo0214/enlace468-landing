import { useEffect, useState } from 'react'
import { GraduationCap, Users, Mail, Phone, MessageSquare, Download, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const CURSOS = {
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890': 'AI Talent Advisor (Meta)',
  '6b5e2a16-ab33-4b6e-8d93-f0cf5af424c1': 'AI Talent Advisor',
}

export default function CursosList() {
  const [inscripciones, setInscripciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [selectedCurso, setSelectedCurso] = useState('all')

  useEffect(() => { loadInscripciones() }, [])

  async function loadInscripciones() {
    const { data, error } = await supabase.from('inscripciones').select('*').order('created_at', { ascending: false })
    if (!error) setInscripciones(data || [])
    setLoading(false)
  }

  function toggleSort(field) {
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(true) }
  }

  const cursoIds = [...new Set(inscripciones.map(i => i.curso_id).filter(Boolean))]

  const filtered = inscripciones
    .filter(i => {
      const s = search.toLowerCase()
      const matchesSearch = !s || (i.nombre || '').toLowerCase().includes(s) || (i.email || '').toLowerCase().includes(s) || (i.telefono || '').includes(search)
      return matchesSearch && (selectedCurso === 'all' || i.curso_id === selectedCurso)
    })
    .sort((a, b) => { const cmp = String(a[sortField] || '').localeCompare(String(b[sortField] || '')); return sortAsc ? cmp : -cmp })

  function exportCSV() {
    const headers = ['Nombre', 'Email', 'Telefono', 'Curso', 'Mensaje', 'Fecha']
    const rows = filtered.map(i => [i.nombre, i.email, i.telefono, CURSOS[i.curso_id] || i.curso_id || '', (i.mensaje || '').replace(/"/g, '""'), i.created_at ? new Date(i.created_at).toLocaleDateString('es-MX') : ''])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `inscripciones_${new Date().toISOString().split('T')[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Cursos e Inscripciones</h1>
          <p className="text-gray-400 mt-1">{inscripciones.length} inscrito{inscripciones.length !== 1 ? 's' : ''} en total</p>
        </div>
        <button onClick={exportCSV} disabled={filtered.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg hover:opacity-90 text-sm font-medium disabled:opacity-50">
          <Download size={16} /> Exportar CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary"><Users size={20} /></div>
            <div><div className="text-2xl font-bold text-white">{loading ? '-' : inscripciones.length}</div><div className="text-sm text-gray-400">Total inscritos</div></div>
          </div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center text-accent"><GraduationCap size={20} /></div>
            <div><div className="text-2xl font-bold text-white">{loading ? '-' : cursoIds.length}</div><div className="text-sm text-gray-400">Cursos activos</div></div>
          </div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center text-gold"><MessageSquare size={20} /></div>
            <div><div className="text-2xl font-bold text-white">{loading ? '-' : inscripciones.filter(i => i.mensaje).length}</div><div className="text-sm text-gray-400">Con mensaje</div></div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, email o telefono..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none text-white placeholder-gray-500 text-sm" />
        </div>
        <select value={selectedCurso} onChange={e => setSelectedCurso(e.target.value)}
          className="px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 outline-none text-white text-sm">
          <option value="all">Todos los cursos</option>
          {cursoIds.map(id => <option key={id} value={id}>{CURSOS[id] || `Curso ${id.slice(0, 8)}...`}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 glass rounded-xl">
          <GraduationCap size={48} className="mx-auto text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No hay inscripciones</h3>
          <p className="text-gray-400 text-sm">{search ? 'Intenta con otra busqueda' : 'Apareceran cuando alguien se registre en un curso'}</p>
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }} className="bg-white/[0.02]">
                  {[{ f: 'nombre', l: 'Nombre' }, { f: 'email', l: 'Email' }].map(({ f, l }) => (
                    <th key={f} className="text-left px-4 py-3 font-medium text-gray-400 cursor-pointer hover:text-white select-none" onClick={() => toggleSort(f)}>
                      <span className="flex items-center gap-1">{l} {sortField === f && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</span>
                    </th>
                  ))}
                  <th className="text-left px-4 py-3 font-medium text-gray-400">Telefono</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-400">Curso</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-400">Mensaje</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-400 cursor-pointer hover:text-white select-none" onClick={() => toggleSort('created_at')}>
                    <span className="flex items-center gap-1">Fecha {sortField === 'created_at' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(i => (
                  <tr key={i.id} className="hover:bg-white/[0.03] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td className="px-4 py-3 font-medium text-white">{i.nombre}</td>
                    <td className="px-4 py-3">
                      <a href={`mailto:${i.email}`} className="text-accent hover:text-accent-light flex items-center gap-1"><Mail size={13} /> {i.email}</a>
                    </td>
                    <td className="px-4 py-3">
                      {i.telefono && <a href={`https://wa.me/52${i.telefono.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="text-green-400 hover:text-green-300 flex items-center gap-1"><Phone size={13} /> {i.telefono}</a>}
                    </td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary-light font-medium">{CURSOS[i.curso_id] || 'Curso'}</span></td>
                    <td className="px-4 py-3 text-gray-400 max-w-[200px] truncate" title={i.mensaje}>{i.mensaje || '-'}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{i.created_at ? new Date(i.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
