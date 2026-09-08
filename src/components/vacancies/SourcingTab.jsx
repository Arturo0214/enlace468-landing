// Refactor 2026-09: la pestaña Sourcing vive ahora en ./sourcing/ (orquestador
// SourcingTabInner + subcomponentes + hooks). Este re-export mantiene intacta
// la ruta de import de VacancyDetail.
export { default } from './sourcing/SourcingTabInner'
