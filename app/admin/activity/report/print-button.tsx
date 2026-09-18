'use client'

export function PrintAuditReportButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800"
    >
      Imprimer / Enregistrer en PDF
    </button>
  )
}
