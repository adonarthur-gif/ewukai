export default function Loading() {
  return (
    <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-slate-50 px-6">
      <div className="flex flex-col items-center text-center">
        <img
          src="/branding/ewukai-mark-192.png"
          alt=""
          width="80"
          height="80"
          className="h-20 w-20 object-contain"
        />

        <p className="mt-4 text-xl font-black tracking-tight text-emerald-800">
          EWUKAI
        </p>

        <p className="mt-1 text-sm font-semibold text-slate-600">
          Votre organisation, simplement.
        </p>

        <div className="mt-5 h-1.5 w-28 overflow-hidden rounded-full bg-emerald-100">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-600" />
        </div>
      </div>
    </main>
  )
}
