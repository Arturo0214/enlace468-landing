import { usePlan } from '../../lib/planContext'
import UpgradePrompt from './UpgradePrompt'

export default function FeatureGate({ action, fallback, children }) {
  const { canDo, loading } = usePlan()

  if (loading) return null

  if (canDo(action)) return children

  return fallback ?? <UpgradePrompt action={action} />
}
