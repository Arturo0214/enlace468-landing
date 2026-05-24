import { useState } from 'react'
import { Search, Upload, Globe, Database, ExternalLink, Plus, FileSpreadsheet, UserPlus, Loader2, CheckCircle, User, Briefcase, MapPin, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

const searchTemplates = [
  { label: 'Consultor Financiero CDMX', query: '"consultor financiero" OR "asesor financiero" "CDMX"' },
  { label: 'Director Comercial Seguros', query: '"director comercial" "seguros" OR "aseguradora" México' },
  { label: 'Wealth Management', query: '"wealth management" OR "banca privada" México' },
  { label: 'Socio Director Finanzas', query: '"socio director" OR "managing partner" "finanzas" México' },
  { label: 'Gerente Regional Seguros', query: '"gerente regional" "seguros" OR "financiero" México' },
  { label: 'Educación Financiera', query: '"educación financiera" OR "capacitación financiera" México' },
  { label: 'Ventas B2B México', query: '"ventas" OR "sales" "B2B" OR "enterprise" "CDMX" OR "México"' },
  { label: 'Headhunter RRHH', query: '"headhunter" OR "talent acquisition" OR "reclutamiento" México' },
]

const inputClass = "w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none text-white placeholder-gray-500 text-sm"

export default function CandidateSourcing() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [addedIds, setAddedIds] = useState(new Set())
  const [addingId, setAddingId] = useState(null)

  // CSV state
  const [csvData, setCsvData] = useState([])
  const [csvHeaders, setCsvHeaders] = useState([])
  const [csvMapping, setCsvMapping] = useState({})
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  async function handleSearch(searchQuery) {
    const q = searchQuery || query
    if (!q.trim()) return
    setSearching(true)
    setSearchError(null)
    setResults([])
    setAddedIds(new Set())

    try {
      // Always use the serverless function (works in both dev via netlify dev proxy and production)
      const res = await fetch(`/api/search-candidates?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResults(data.results || [])
      if (data.results?.length === 0) {
        setSearchError('No se encontraron perfiles. Intenta con otros terminos.')
      }
    } catch (err) {
      setSearchError('Error en la busqueda: ' + err.message)
    } finally {
      setSearching(false)
    }
  }

  async function addToBank(candidate) {
    const key = candidate.linkedin_url || candidate.full_name
    setAddingId(key)
    try {
      await supabase.from('candidates').insert({
        organization_id: profile.organization_id,
        full_name: candidate.full_name,
        current_title: candidate.current_title || null,
        current_company: candidate.current_company || null,
        linkedin_url: candidate.linkedin_url || null,
        source: 'xray',
        tags: ['xray-search', 'sourced'],
        notes: candidate.snippet || null,
      })
      setAddedIds(prev => new Set([...prev, key]))
    } catch (err) {
      console.error(err)
    } finally {
      setAddingId(null)
    }
  }

  async function addAllToBank() {
    setAddingId('all')
    let count = 0
    for (const c of results) {
      const key = c.linkedin_url || c.full_name
      if (addedIds.has(key) || c._existing_id) continue
      try {
        await supabase.from('candidates').insert({
          organization_id: profile.organization_id,
          full_name: c.full_name,
          current_title: c.current_title || null,
          current_company: c.current_company || null,
          linkedin_url: c.linkedin_url || null,
          source: 'xray',
          tags: ['xray-search', 'sourced'],
          notes: c.snippet || null,
        })
        setAddedIds(prev => new Set([...prev, key]))
        count++
      } catch(e) {}
    }
    setAddingId(null)
    alert(`${count} candidatos agregados al banco`)
  }

  // CSV handlers
  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target.result
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) return
      const delimiter = lines[0].includes('\t') ? '\t' : ','
      const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''))
      const rows = lines.slice(1).map(line => {
        const vals = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''))
        const obj = {}
        headers.forEach((h, i) => obj[h] = vals[i] || '')
        return obj
      })
      setCsvHeaders(headers)
      setCsvData(rows)
      const mapping = {}
      const fieldMap = { full_name: ['nombre','name','full_name','candidato'], email: ['email','correo','mail'], phone: ['telefono','phone','celular'], current_title: ['puesto','title','cargo'], current_company: ['empresa','company'], linkedin_url: ['linkedin','url'], location: ['ubicacion','location','ciudad'] }
      for (const [field, aliases] of Object.entries(fieldMap)) {
        const match = headers.find(h => aliases.includes(h.toLowerCase()))
        if (match) mapping[field] = match
      }
      setCsvMapping(mapping)
    }
    reader.readAsText(file)
  }

  async function importCandidates() {
    if (!csvData.length) return
    setImporting(true)
    let imported = 0, skipped = 0
    for (const row of csvData) {
      const name = row[csvMapping.full_name] || ''
      if (!name.trim()) { skipped++; continue }
      const { error } = await supabase.from('candidates').insert({
        organization_id: profile.organization_id, full_name: name.trim(),
        email: (row[csvMapping.email] || '').trim() || null, phone: (row[csvMapping.phone] || '').trim() || null,
        current_title: (row[csvMapping.current_title] || '').trim() || null, current_company: (row[csvMapping.current_company] || '').trim() || null,
        linkedin_url: (row[csvMapping.linkedin_url] || '').trim() || null, location: (row[csvMapping.location] || '').trim() || null,
        source: 'csv_import', tags: ['importado'],
      })
      if (error) skipped++; else imported++
    }
    setImportResult({ imported, skipped })
    setImporting(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Sourcing de Candidatos</h1>
          <p className="text-gray-400 mt-1">Busca perfiles de LinkedIn y agregalos al banco directo</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {[
          { id: 'search', label: 'Buscar LinkedIn', icon: Globe },
          { id: 'csv', label: 'Importar CSV', icon: FileSpreadsheet },
          { id: 'tips', label: 'Otras fuentes', icon: Database },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              activeTab === id ? 'border-primary text-primary-light' : 'border-transparent text-gray-400 hover:text-white'
            }`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {/* SEARCH TAB */}
      {activeTab === 'search' && (
        <div className="space-y-6">
          {/* Search bar */}
          <div className="glass-strong rounded-2xl p-6">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder='Ej: "consultor financiero" "CDMX" seguros'
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none text-white placeholder-gray-500"
                />
              </div>
              <button
                onClick={() => handleSearch()}
                disabled={searching || !query.trim()}
                className="px-6 py-3 bg-gradient-to-r from-primary to-accent text-white rounded-xl hover:opacity-90 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {searching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                Buscar
              </button>
            </div>

            {/* Quick templates */}
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">Busquedas rapidas:</p>
              <div className="flex flex-wrap gap-2">
                {searchTemplates.map(t => (
                  <button
                    key={t.label}
                    onClick={() => { setQuery(t.query); handleSearch(t.query) }}
                    className="text-xs px-3 py-1.5 rounded-full glass text-gray-300 hover:text-white hover:border-primary/30 transition-all"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Error */}
          {searchError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{searchError}</div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-300">
                  <span className="font-semibold text-white">{results.length}</span> perfiles encontrados
                </p>
                <button
                  onClick={addAllToBank}
                  disabled={addingId === 'all'}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg hover:opacity-90 text-sm font-medium disabled:opacity-50"
                >
                  {addingId === 'all' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Agregar todos al banco
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {results.map((candidate, i) => {
                  const key = candidate.linkedin_url || candidate.full_name
                  const isAdded = addedIds.has(key) || candidate._existing_id
                  const isAdding = addingId === key

                  return (
                    <div key={i} className={`glass rounded-xl p-4 transition-all ${isAdded ? 'border-green-500/30 opacity-70' : 'hover:border-primary/20'}`}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-gray-300 flex-shrink-0">
                          <User size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-white truncate">{candidate.full_name}</h3>
                          {candidate.current_title && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 truncate">
                              <Briefcase size={10} /> {candidate.current_title}
                            </p>
                          )}
                          {candidate.current_company && (
                            <p className="text-xs text-gray-500 truncate">{candidate.current_company}</p>
                          )}
                        </div>
                      </div>

                      {candidate.snippet && (
                        <p className="text-xs text-gray-400 mt-2 line-clamp-2">{candidate.snippet}</p>
                      )}

                      <div className="flex items-center gap-2 mt-3">
                        {candidate.linkedin_url && (
                          <a
                            href={candidate.linkedin_url}
                            target="_blank"
                            rel="noopener"
                            className="flex items-center gap-1 text-xs text-accent hover:text-accent-light transition-colors"
                          >
                            <ExternalLink size={12} /> LinkedIn
                          </a>
                        )}
                        <div className="flex-1" />
                        {isAdded ? (
                          <span className="flex items-center gap-1 text-xs text-green-400">
                            <CheckCircle size={14} /> {candidate._existing_id ? 'Ya en banco' : 'Agregado'}
                          </span>
                        ) : (
                          <button
                            onClick={() => addToBank(candidate)}
                            disabled={isAdding}
                            className="flex items-center gap-1 px-3 py-1.5 bg-primary/20 text-primary-light rounded-lg text-xs font-medium hover:bg-primary/30 transition-colors disabled:opacity-50"
                          >
                            {isAdding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                            Agregar
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Loading state */}
          {searching && (
            <div className="text-center py-12">
              <Loader2 size={32} className="animate-spin mx-auto text-primary mb-3" />
              <p className="text-gray-400 text-sm">Buscando perfiles en LinkedIn...</p>
            </div>
          )}

          {/* Empty state */}
          {!searching && results.length === 0 && !searchError && (
            <div className="text-center py-12 glass rounded-xl">
              <Globe size={48} className="mx-auto text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Busca candidatos en LinkedIn</h3>
              <p className="text-gray-400 text-sm max-w-md mx-auto">
                Escribe un puesto, industria o ubicacion y te mostramos perfiles de LinkedIn que puedes agregar directo a tu banco de candidatos.
              </p>
            </div>
          )}
        </div>
      )}

      {/* CSV TAB */}
      {activeTab === 'csv' && (
        <div className="glass-strong rounded-2xl p-6">
          <h2 className="font-display font-semibold text-white mb-1">Importar desde CSV/Excel</h2>
          <p className="text-sm text-gray-400 mb-6">Sube un archivo exportado de OCC, LinkedIn, Apollo o tu Excel.</p>

          <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-primary/30 transition-colors">
            <Upload size={32} className="mx-auto text-gray-500 mb-3" />
            <p className="text-sm text-gray-300 mb-2">Arrastra o selecciona tu archivo</p>
            <p className="text-xs text-gray-500 mb-4">CSV, TSV o TXT</p>
            <input type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload} className="hidden" id="csv-upload" />
            <label htmlFor="csv-upload" className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-primary-light text-white rounded-lg text-sm font-medium cursor-pointer">
              <Upload size={16} /> Seleccionar
            </label>
          </div>

          {csvData.length > 0 && (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-white font-medium">{csvData.length} filas, {csvHeaders.length} columnas</p>
              <div className="bg-white/[0.02] rounded-lg p-4 border border-white/5">
                <p className="text-xs text-gray-500 mb-3">Mapea columnas:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['full_name','email','phone','current_title','current_company','linkedin_url','location'].map(field => (
                    <div key={field}>
                      <label className="text-xs text-gray-400 mb-1 block">{field === 'full_name' ? 'Nombre *' : field}</label>
                      <select value={csvMapping[field] || ''} onChange={e => setCsvMapping(p => ({ ...p, [field]: e.target.value }))}
                        className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white text-xs outline-none">
                        <option value="">--</option>
                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={importCandidates} disabled={importing || !csvMapping.full_name}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {importing ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {importing ? 'Importando...' : `Importar ${csvData.length} candidatos`}
              </button>
              {importResult && <p className="text-sm text-green-400">{importResult.imported} importados, {importResult.skipped} omitidos</p>}
            </div>
          )}
        </div>
      )}

      {/* TIPS TAB */}
      {activeTab === 'tips' && (
        <div className="space-y-4">
          {[
            { name: 'Apollo.io', desc: '50 creditos gratis/mes. Busca candidatos con email verificado.', badge: 'Gratis', color: 'bg-green-500/20 text-green-400', url: 'https://app.apollo.io' },
            { name: 'Waalaxy', desc: '80 invitaciones gratis/mes. Automatiza outreach en LinkedIn.', badge: 'Gratis', color: 'bg-green-500/20 text-green-400', url: 'https://www.waalaxy.com' },
            { name: 'LinkedIn Export', desc: 'Descarga tu red de contactos como CSV desde Configuracion.', badge: 'Gratis', color: 'bg-green-500/20 text-green-400', url: 'https://www.linkedin.com/mypreferences/d/download-my-data' },
            { name: 'Snov.io', desc: 'Encuentra emails de candidatos a partir de nombre y empresa.', badge: '50 gratis/mes', color: 'bg-green-500/20 text-green-400', url: 'https://snov.io' },
            { name: 'OCC Mundial', desc: 'Publica vacantes y recibe CVs. Exporta a CSV.', badge: '$990/mes', color: 'bg-gold/20 text-gold', url: 'https://www.occ.com.mx/empresas' },
            { name: 'PhantomBuster', desc: 'Extrae datos de LinkedIn: perfiles, busquedas, grupos.', badge: '$69/mes', color: 'bg-primary/20 text-primary-light', url: 'https://phantombuster.com' },
          ].map(s => (
            <a key={s.name} href={s.url} target="_blank" rel="noopener" className="block glass rounded-xl p-5 hover:border-primary/20 transition-all group">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white group-hover:text-primary-light">{s.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.badge}</span>
                  </div>
                  <p className="text-sm text-gray-400">{s.desc}</p>
                </div>
                <ExternalLink size={16} className="text-gray-500 group-hover:text-primary flex-shrink-0 ml-3" />
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
