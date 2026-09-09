'use client'

import { useFormStatus } from 'react-dom'

export default function SubmitButton() {
  const { pending } =
    useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-emerald-700 px-6 py-4 font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      {pending
        ? 'Envoi en cours...'
        : 'Envoyer ma demande'}
    </button>
  )
}