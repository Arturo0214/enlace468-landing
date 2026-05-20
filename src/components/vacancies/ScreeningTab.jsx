import { useState, useRef } from 'react'
import { FileText, Play, CheckCircle, ChevronDown, ChevronUp, ArrowRight, Loader2, BarChart3, Target, Briefcase, Upload, X, File, FlaskConical } from 'lucide-react'
import { screenCandidate, DUMMY_CVS } from '../../lib/screeningEngine'
import * as pdfjsLib from 'pdfjs-dist'

// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

// Extract text from a PDF file
async function extractPDFText(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map(item => item.str).join(' ') + '\n'
  }
  return text
}

export default function ScreeningTab({ vacancy, vacancyId }) {
  const [cvFiles, setCvFiles] = useState([]) // { name, fileName, cv (text), file? }
  const [results, setResults] = useState([])
  const [running, setRunning] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [expandedId, setExpandedId] = useState(null)
  const [moved, setMoved] = useState(new Set())
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const jobDescription = `${vacancy.title || ''} ${vacancy.description || ''} ${vacancy.challenges || ''} ${vacancy.team_info || ''}`
  const competencies = vacancy.competencies || []

  // Handle file upload
  async function handleFiles(files) {
    const pdfs = Array.from(files).filter(f => f.type === 'application/pdf')
    if (!pdfs.length) return
    setExtracting(true)

    const newCvs = []
    for (const file of pdfs) {
      try {
        const text = await extractPDFText(file)
        const name = file.name.replace('.pdf', '').replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        newCvs.push({ name, fileName: file.name, cv: text })
      } catch (e) {
        console.error(`Error extracting ${file.name}:`, e)
      }
    }

    setCvFiles(prev => [...prev, ...newCvs])
    setExtracting(false)
  }

  function removeCv(index) {
    setCvFiles(prev => prev.filter((_, i) => i !== index))
  }

  function loadDummyCvs() {
    setCvFiles(DUMMY_CVS.map(d => ({ name: d.name, fileName: 'demo.pdf', cv: d.cv })))
  }

  // Run screening
  async function runScreening() {
    if (!cvFiles.length) return
    setRunning(true)
    setResults([])
    setProgress(0)

    const all = []
    for (let i = 0; i < cvFiles.length; i++) {
      const cv = cvFiles[i]
      await new Promise(r => setTimeout(r, 200))
      const analysis = screenCandidate(jobDescription, competencies, cv.cv)
      all.push({ ...cv, ...analysis })
      setProgress(Math.round(((i + 1) / cvFiles.length) * 100))
      setResults([...all].sort((a, b) => b.score - a.score))
    }

    setRunning(false)
  }

  function moveToInterview(candidate) {
    setMoved(prev => new Set([...prev, candidate.name]))
  }

  function scoreColor(score) {
    if (score >= 70) return 'text-emerald-400'
    if (score >= 45) return 'text-amber-400'
    return 'text-red-400'
  }

  function scoreBg(score) {
    if (score >= 70) return 'bg-emerald-400'
    if (score >= 45) return 'bg-amber-400'
    return 'bg-red-400'
  }

  function scoreLabel(score) {
    if (score >= 70) return 'Recomendado'
    if (score >= 45) return 'Revisar'
    return 'No cumple'
  }

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Screening de CVs</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">Sube los PDFs de los candidatos para evaluarlos contra esta vacante</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadDummyCvs}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[11px] text-gray-400 hover:text-white hover:bg-white/[0.08] transition-all">
              <FlaskConical size={12} /> Demo
            </button>
            <button onClick={runScreening} disabled={running || !cvFiles.length}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-primary-light text-white rounded-lg hover:opacity-90 text-sm font-medium disabled:opacity-40">
              {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {running ? 'Analizando...' : `Evaluar ${cvFiles.length > 0 ? `(${cvFiles.length})` : ''}`}
            </button>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            dragOver ? 'border-primary-light/50 bg-primary-light/5' : 'border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02]'
          }`}>
          <input ref={fileInputRef} type="file" accept=".pdf" multiple onChange={e => handleFiles(e.target.files)} className="hidden" />
          {extracting ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 size={18} className="animate-spin text-primary-light" />
              <span className="text-sm text-gray-400">Extrayendo texto de PDFs...</span>
            </div>
          ) : (
            <>
              <Upload size={24} className="mx-auto text-gray-600 mb-2" />
              <p className="text-sm text-gray-400">Arrastra PDFs aqui o haz clic para seleccionar</p>
              <p className="text-[11px] text-gray-600 mt-1">Se acepta PDF. El texto se extrae localmente, nada se sube a ningun servidor.</p>
            </>
          )}
        </div>

        {/* Uploaded files list */}
        {cvFiles.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider">{cvFiles.length} CV{cvFiles.length !== 1 ? 's' : ''} cargados</p>
            <div className="flex flex-wrap gap-1.5">
              {cvFiles.map((cv, i) => (
                <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-white/[0.03] rounded-lg border border-white/[0.06] group">
                  <File size={11} className="text-gray-500" />
                  <span className="text-[11px] text-gray-300 max-w-[150px] truncate">{cv.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); removeCv(i) }}
                    className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress bar */}
        {running && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-gray-400">Analizando {Math.ceil(progress / (100 / cvFiles.length))}/{cvFiles.length}</span>
              <span className="text-[11px] text-primary-light font-medium">{progress}%</span>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-primary-light rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Job description pills */}
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Evaluando contra</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[11px] px-2 py-0.5 rounded bg-primary-light/10 text-primary-light">{vacancy.title}</span>
            {competencies.slice(0, 4).map(c => (
              <span key={c.name} className="text-[11px] px-2 py-0.5 rounded bg-white/[0.04] text-gray-400">{c.name}</span>
            ))}
            {competencies.length > 4 && <span className="text-[11px] text-gray-500">+{competencies.length - 4}</span>}
          </div>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-gray-400"><span className="font-semibold text-white">{results.length}</span> candidatos evaluados</p>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-emerald-400">● Recomendado (70+)</span>
              <span className="text-amber-400">● Revisar (45-69)</span>
              <span className="text-red-400">● No cumple (&lt;45)</span>
            </div>
          </div>

          {results.map((r, i) => {
            const isExpanded = expandedId === r.name
            const isMoved = moved.has(r.name)
            return (
              <div key={r.name} className={`glass rounded-xl overflow-hidden transition-all ${isMoved ? 'opacity-50' : ''}`}>
                {/* Summary row */}
                <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.02]"
                  onClick={() => setExpandedId(isExpanded ? null : r.name)}>
                  <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0">
                    {i + 1}
                  </div>

                  <div className="relative w-11 h-11 flex-shrink-0">
                    <svg className="w-11 h-11 -rotate-90" viewBox="0 0 36 36">
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none" className={scoreBg(r.score).replace('bg-', 'stroke-')} strokeWidth="3"
                        strokeDasharray={`${r.score}, 100`} strokeLinecap="round" />
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${scoreColor(r.score)}`}>
                      {r.score}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white truncate">{r.name}</h3>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        r.score >= 70 ? 'bg-emerald-400/15 text-emerald-400' :
                        r.score >= 45 ? 'bg-amber-400/15 text-amber-400' :
                        'bg-red-400/15 text-red-400'
                      }`}>{scoreLabel(r.score)}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{r.summary}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!isMoved && r.score >= 45 && (
                      <button onClick={e => { e.stopPropagation(); moveToInterview(r) }}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-primary-light/10 text-primary-light rounded-lg text-[11px] font-medium hover:bg-primary-light/20 transition-all">
                        Entrevista <ArrowRight size={10} />
                      </button>
                    )}
                    {isMoved && <span className="text-[11px] text-emerald-400"><CheckCircle size={14} /></span>}
                    {isExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="grid grid-cols-3 gap-3 pt-3">
                      <div className="bg-white/[0.02] rounded-lg p-3 text-center">
                        <Target size={14} className="mx-auto text-blue-400 mb-1" />
                        <p className="text-lg font-bold text-white">{r.semanticScore}%</p>
                        <p className="text-[10px] text-gray-500">Relevancia</p>
                      </div>
                      <div className="bg-white/[0.02] rounded-lg p-3 text-center">
                        <BarChart3 size={14} className="mx-auto text-purple-400 mb-1" />
                        <p className="text-lg font-bold text-white">{r.skillScore}%</p>
                        <p className="text-[10px] text-gray-500">Skills</p>
                      </div>
                      <div className="bg-white/[0.02] rounded-lg p-3 text-center">
                        <Briefcase size={14} className="mx-auto text-amber-400 mb-1" />
                        <p className="text-lg font-bold text-white">{r.compScore}%</p>
                        <p className="text-[10px] text-gray-500">Competencias</p>
                      </div>
                    </div>

                    {r.experienceYears && (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Briefcase size={12} /> {r.experienceYears} años de experiencia detectados
                      </div>
                    )}

                    {r.matchedSkills.length > 0 && (
                      <div>
                        <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Skills que coinciden</p>
                        <div className="flex flex-wrap gap-1">
                          {r.matchedSkills.map(s => (
                            <span key={s} className="text-[10px] px-2 py-0.5 rounded bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {r.missingSkills.length > 0 && (
                      <div>
                        <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Skills faltantes</p>
                        <div className="flex flex-wrap gap-1">
                          {r.missingSkills.map(s => (
                            <span key={s} className="text-[10px] px-2 py-0.5 rounded bg-red-400/10 text-red-400 border border-red-400/20">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {r.compMatches.length > 0 && (
                      <div>
                        <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Competencias encontradas</p>
                        <div className="flex flex-wrap gap-1">
                          {r.compMatches.map(s => (
                            <span key={s} className="text-[10px] px-2 py-0.5 rounded bg-purple-400/10 text-purple-400 border border-purple-400/20">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {!running && results.length === 0 && cvFiles.length === 0 && (
        <div className="glass rounded-xl py-12 text-center">
          <Upload size={32} className="mx-auto text-gray-700 mb-3" />
          <p className="text-sm text-gray-500">Sube CVs en PDF para evaluarlos contra esta vacante</p>
          <p className="text-xs text-gray-600 mt-1">O usa el boton "Demo" para probar con CVs de ejemplo</p>
        </div>
      )}
    </div>
  )
}
