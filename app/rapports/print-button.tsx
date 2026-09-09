'use client'

import {
  Printer,
} from 'lucide-react'

export default function PrintReportButton() {
  return (
    <button
      type="button"
      onClick={() =>
        window.print()
      }
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
    >
      <Printer className="h-4 w-4" />
      Imprimer / PDF
    </button>
  )
}
