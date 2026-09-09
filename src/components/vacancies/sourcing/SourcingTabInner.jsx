import { useState } from 'react'
import { Users } from 'lucide-react'
import FeatureGate from '../../ui/FeatureGate'
import SourcingSearchBar from './SourcingSearchBar'
import AutoSourcingPanel from './AutoSourcingPanel'
import OutreachBoard from './OutreachBoard'
import AutoResultsList from './AutoResultsList'
import SourcingBankList from './SourcingBankList'
import GoogleResultsGrid from './GoogleResultsGrid'
import LocalResultsList from './LocalResultsList'
import SourcingCandidateModal from './SourcingCandidateModal'
import useSourcingSearch from './hooks/useSourcingSearch'
import useSourcingBank from './hooks/useSourcingBank'
import useAutoSourcing from './hooks/useAutoSourcing'
import useOutreachActivity from './hooks/useOutreachActivity'

// Orquestador de la pestaña Sourcing. La lógica vive en los hooks
// (hooks/useSourcingSearch|useSourcingBank|useAutoSourcing|useOutreachActivity)
// y el JSX en los subcomponentes de este directorio; aquí solo se cablean.
//
// Se quedan en el orquestador (y por qué):
// - platform / excludeSector / onlyEntrepreneurs: los comparten búsqueda manual,
//   banco y auto-sourcing — dejarlos en un hook crearía dependencias circulares
//   entre hooks (search necesita excludeSector, auto necesita bankUrls, bank
//   necesita platform/googleResults).
// - selectedCandidate / enrollTarget: los abren varias secciones (resultados
//   locales, banco, modal) y el reset del draft de IA depende de ellos.
export default function SourcingTab({ vacancy, profile, vacancyId, addedIds, setAddedIds, addingId, setAddingId, setActiveTab }) {
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [platform, setPlatform] = useState('linkedin')
  const [excludeSector, setExcludeSector] = useState(true) // excluir aseguradoras/inversiones (Prudential)
  const [onlyEntrepreneurs, setOnlyEntrepreneurs] = useState(false) // solo perfiles con negocio propio (Ingrid)
  const [enrollTarget, setEnrollTarget] = useState(null) // { type:'bank', id, name } → modal de secuencias (Fase 5)

  // Búsqueda manual: widget CSE de Google + paginación + búsqueda local
  const search = useSourcingSearch({ vacancy, vacancyId, profile, platform, excludeSector, setAddedIds, setAddingId })
  // Banco persistente por vacante + descartados globales + importar por URL
  const bank = useSourcingBank({ profile, vacancy, vacancyId, platform, excludeSector, googleResults: search.googleResults, setAddedIds })
  // Sourcing automático server-side + config del sourcing nocturno
  const auto = useAutoSourcing({
    vacancy, vacancyId, platform, excludeSector, onlyEntrepreneurs,
    bankUrls: bank.bankUrls, blockedGlobal: bank.blockedGlobal,
    setBankItems: bank.setBankItems, setSavingAll: bank.setSavingAll, resultToBankRow: bank.resultToBankRow,
  })
  // Actividad Unipile + outreach registrado + drafts IA + envío LinkedIn
  const outreach = useOutreachActivity({ profile, vacancy, vacancyId, selectedCandidate })

  return (
    <FeatureGate action="use_outreach">
    <div className="space-y-4">
      {/* Search bar + sourcing automático (misma card que en el layout original) */}
      <div className="glass rounded-xl p-5">
        <SourcingSearchBar vacancy={vacancy} platform={platform} setPlatform={setPlatform} search={search} />
        <AutoSourcingPanel auto={auto} bank={bank}
          excludeSector={excludeSector} setExcludeSector={setExcludeSector}
          onlyEntrepreneurs={onlyEntrepreneurs} setOnlyEntrepreneurs={setOnlyEntrepreneurs} />
      </div>

      {/* Tablero de outreach — invitaciones enviadas por LinkedIn */}
      <OutreachBoard outreach={outreach} />

      {/* Resultados del sourcing automático — rankeados por match */}
      <AutoResultsList auto={auto} bank={bank} outreach={outreach} />

      {/* Banco de sourcing — persistent per-vacancy bank */}
      <SourcingBankList bank={bank} outreach={outreach} setEnrollTarget={setEnrollTarget} setSelectedCandidate={setSelectedCandidate} />

      {/* Cards de Google + widget CSE (#gcs-box SIEMPRE montado) + empty state */}
      <GoogleResultsGrid search={search} bank={bank} />

      {/* Resultados locales (tabla candidates) */}
      <LocalResultsList search={search} addedIds={addedIds} addingId={addingId} setSelectedCandidate={setSelectedCandidate} />

      <div className="flex justify-end">
        <button onClick={() => setActiveTab('pipeline')} className="flex items-center gap-2 px-4 py-2 bg-primary-light text-white rounded-lg text-sm font-medium hover:bg-primary-light/90">
          Ver pipeline <Users size={14} />
        </button>
      </div>

      {/* Modal del candidato + EnrollModal + ConfirmDialog de envío */}
      <SourcingCandidateModal
        selectedCandidate={selectedCandidate} setSelectedCandidate={setSelectedCandidate}
        addedIds={addedIds} addingId={addingId}
        search={search} bank={bank} outreach={outreach}
        enrollTarget={enrollTarget} setEnrollTarget={setEnrollTarget} profile={profile} />
    </div>
    </FeatureGate>
  )
}
