// Hook que resuelve las etiquetas de etapa de la org del usuario.
// Fuente: organizations.settings.stage_labels — normalmente ya viene en el
// join de auth (profiles → organizations(*)), así que casi nunca hay fetch;
// si falta, se consulta UNA vez y queda en cache module-level (stageLabels.js).
// Fallback silencioso a DEFAULT_STAGE_LABELS ante cualquier error.
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import {
  getStageLabel,
  mergeStageLabels,
  getCachedStageLabels,
  setCachedStageLabels,
  subscribeStageLabels,
} from './stageLabels'

let inflight = null
let inflightOrgId = null

export function useStageLabels() {
  const { profile } = useAuth()
  const orgId = profile?.organization_id || null

  // El cache module-level es un external store: un solo estado compartido por
  // todos los componentes montados; Settings lo actualiza al guardar.
  const custom = useSyncExternalStore(
    subscribeStageLabels,
    () => getCachedStageLabels(orgId),
  )

  useEffect(() => {
    if (!orgId || getCachedStageLabels(orgId)) return

    // El perfil ya trae la org completa (auth hace select '*, organizations(*)').
    if (profile?.organizations && 'settings' in profile.organizations) {
      setCachedStageLabels(orgId, profile.organizations.settings?.stage_labels || {})
      return
    }

    // Último recurso: un solo fetch compartido entre componentes.
    if (!inflight || inflightOrgId !== orgId) {
      inflightOrgId = orgId
      inflight = supabase
        .from('organizations')
        .select('settings')
        .eq('id', orgId)
        .single()
        .then(({ data }) => data?.settings?.stage_labels || {})
        .catch(() => ({}))
    }
    inflight.then(labels => {
      if (inflightOrgId === orgId && !getCachedStageLabels(orgId)) {
        setCachedStageLabels(orgId, labels)
      }
    })
  }, [orgId, profile])

  const labels = useMemo(() => mergeStageLabels(custom), [custom])
  const getLabel = useCallback(stage => getStageLabel(custom, stage), [custom])

  return { labels, getLabel, loading: orgId != null && custom == null }
}
