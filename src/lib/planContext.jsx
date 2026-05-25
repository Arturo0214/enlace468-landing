import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

const PlanContext = createContext(null)

// Maps actions to the plan slugs that support them (minimum tier)
// Keys are product_line + "_" + tier from the plans table
const ACTION_PLAN_MAP = {
  create_vacancy: true,
  access_candidate_bank: [
    'enterprise_starter', 'enterprise_growth', 'enterprise_partner',
    'recruiter_pro_pro',
    'talent_desk_pro',
  ],
  use_screening: [
    'enterprise_starter', 'enterprise_growth', 'enterprise_partner',
    'recruiter_pro_pro',
  ],
  use_outreach: [
    'recruiter_pro_pro',
    'talent_desk_pro',
    'enterprise_starter', 'enterprise_growth', 'enterprise_partner',
  ],
  view_reports: [
    'enterprise_growth', 'enterprise_partner',
    'talent_desk_pro',
  ],
  access_academy: true,
  use_ai_prompts: [
    'recruiter_pro_basic', 'recruiter_pro_pro',
    'academy_founder', 'academy_plus', 'academy_pro',
    'enterprise_starter', 'enterprise_growth', 'enterprise_partner',
    'talent_desk_light', 'talent_desk_pro',
    'tu_marca_vende_diagnostico', 'tu_marca_vende_perfil_pro',
  ],
  use_marca_vende: [
    'tu_marca_vende_diagnostico', 'tu_marca_vende_perfil_pro',
    'candidate_basic', 'candidate_plus', 'candidate_pro',
  ],
  use_recruiter_tools: [
    'recruiter_pro_basic', 'recruiter_pro_pro',
    'enterprise_starter', 'enterprise_growth', 'enterprise_partner',
  ],
}

// Roles that bypass all feature gates
const ADMIN_ROLES = ['super_admin', 'admin']

export function PlanProvider({ children }) {
  const { profile } = useAuth()
  const [currentPlan, setCurrentPlan] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) {
      setCurrentPlan(null)
      setLoading(false)
      return
    }
    fetchSubscription()
  }, [profile])

  async function fetchSubscription() {
    setLoading(true)
    try {
      // First try: subscription assigned directly to this profile
      let { data, error } = await supabase
        .from('subscriptions')
        .select('*, plans(*)')
        .eq('status', 'active')
        .eq('profile_id', profile.id)
        .limit(1)
        .maybeSingle()

      // Fallback: subscription assigned to the org (no specific profile)
      if (!data && !error && profile.organization_id) {
        const orgResult = await supabase
          .from('subscriptions')
          .select('*, plans(*)')
          .eq('status', 'active')
          .eq('organization_id', profile.organization_id)
          .is('profile_id', null)
          .limit(1)
          .maybeSingle()
        data = orgResult.data
        error = orgResult.error
      }

      if (error) {
        console.warn('Could not fetch subscription:', error.message)
        setCurrentPlan(null)
      } else {
        setCurrentPlan(data?.plans ?? null)
      }
    } catch (err) {
      console.warn('Subscription fetch failed:', err)
      setCurrentPlan(null)
    } finally {
      setLoading(false)
    }
  }

  const planLimits = currentPlan?.limits ?? null
  const planFeatures = currentPlan?.features ?? []

  const hasFeature = useCallback(
    (featureName) => {
      if (!profile) return false
      if (ADMIN_ROLES.includes(profile.role)) return true
      return planFeatures.includes(featureName)
    },
    [profile, planFeatures]
  )

  const canDo = useCallback(
    (action) => {
      if (!profile) return false
      // Admins bypass everything
      if (ADMIN_ROLES.includes(profile.role)) return true

      const requirement = ACTION_PLAN_MAP[action]
      if (requirement === undefined) return false

      // true means all plans (even free / no plan)
      if (requirement === true) return true

      // No plan → cannot do gated actions
      if (!currentPlan) return false

      // Check if current plan's product_line_tier is in allowed list
      const planKey = `${currentPlan.product_line}_${currentPlan.tier}`
      return requirement.includes(planKey)
    },
    [profile, currentPlan]
  )

  return (
    <PlanContext.Provider value={{ currentPlan, planLimits, planFeatures, hasFeature, canDo, loading }}>
      {children}
    </PlanContext.Provider>
  )
}

export function usePlan() {
  const context = useContext(PlanContext)
  if (!context) throw new Error('usePlan must be used within PlanProvider')
  return context
}
