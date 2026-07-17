import { supabase } from './supabase'
import { logActivity } from './auditLog'

// Copia la definicion de la vacante (descripcion, competencias, scorecard, etc.)
// pero NO los candidatos ni el pipeline. La copia nace como borrador sin fecha limite.
export async function duplicateVacancy(source, profile) {
  const { data, error } = await supabase.from('vacancies').insert({
    organization_id: profile.organization_id,
    created_by: profile.id,
    title: `${source.title} (copia)`,
    company_name: source.company_name,
    department: source.department,
    location: source.location,
    modality: source.modality,
    salary_min: source.salary_min,
    salary_max: source.salary_max,
    description: source.description,
    challenges: source.challenges,
    team_info: source.team_info,
    competencies: source.competencies,
    priority: source.priority,
    target_date: null,
    status: 'draft',
    scorecard: source.scorecard || null,
    data_purpose: source.data_purpose,
    process_owner: source.process_owner,
    role_kpi: source.role_kpi,
    team_context: source.team_context,
  }).select().single()
  if (error) throw error
  await logActivity('vacancy', data.id, 'Vacante duplicada desde: ' + source.title, { source_vacancy_id: source.id })
  return data
}
