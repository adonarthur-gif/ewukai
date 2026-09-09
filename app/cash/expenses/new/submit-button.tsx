'use client'

import { useFormStatus } from 'react-dom'

export default function SubmitButton() {
  const { pending } =
    useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-red-700 px-6 py-3 font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending
        ? 'Enregistrement...'
        : 'Valider le décaissement'}
    </button>
  )
}