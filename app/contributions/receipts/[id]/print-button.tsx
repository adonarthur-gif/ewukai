'use client'

// ============================================================
// EWUKAI
// BOUTON D'IMPRESSION DU RECU
// ============================================================

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() =>
        window.print()
      }
      className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white transition hover:bg-emerald-800"
    >
      Imprimer / Enregistrer en PDF
    </button>
  )
}