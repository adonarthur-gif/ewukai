// ============================================================
// TYPES
// ============================================================

export type DashboardAnalyticsRow = {
  month_start: string
  month_label: string

  expected_amount:
    | number
    | string
    | null

  paid_amount:
    | number
    | string
    | null

  remaining_amount:
    | number
    | string
    | null

  collection_rate:
    | number
    | string
    | null

  cash_in:
    | number
    | string
    | null

  cash_out:
    | number
    | string
    | null

  cash_balance:
    | number
    | string
    | null

  new_members:
    | number
    | string
    | null
}

// ============================================================
// COMPOSANT
// ============================================================

export default function DashboardAnalytics({
  rows,
}: {
  rows:
    DashboardAnalyticsRow[]
}) {
  if (
    rows.length === 0
  ) {
    return (
      <section className="mt-8">

        <SectionTitle
          eyebrow="Analyse"
          title="Évolution sur 6 mois"
        />

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">

          <p className="font-black text-slate-800">
            Les données analytiques ne sont pas encore disponibles.
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Les graphiques apparaîtront dès que des données seront enregistrées.
          </p>

        </div>

      </section>
    )
  }

  const normalized =
    rows.map(
      (
        row
      ) => ({
        ...row,

        expected:
          numberValue(
            row.expected_amount
          ),

        paid:
          numberValue(
            row.paid_amount
          ),

        remaining:
          numberValue(
            row.remaining_amount
          ),

        rate:
          nullableNumber(
            row.collection_rate
          ),

        cashIn:
          numberValue(
            row.cash_in
          ),

        cashOut:
          numberValue(
            row.cash_out
          ),

        cashBalance:
          numberValue(
            row.cash_balance
          ),

        newMembers:
          numberValue(
            row.new_members
          ),
      })
    )

  const maxCash =
    Math.max(
      1,

      ...normalized.map(
        (
          row
        ) =>
          Math.max(
            row.cashIn,
            row.cashOut
          )
      )
    )

  const maxMembers =
    Math.max(
      1,

      ...normalized.map(
        (
          row
        ) =>
          row.newMembers
      )
    )

  return (
    <section className="mt-8">

      {/* ==================================================== */}
      {/* TITRE */}
      {/* ==================================================== */}

      <SectionTitle
        eyebrow="Analyse"
        title="Évolution sur 6 mois"
        description="Suivez les tendances de recouvrement, de trésorerie et d’adhésion."
      />

      <div className="mt-5 grid gap-6 xl:grid-cols-2">

        {/* ================================================== */}
        {/* RECOUVREMENT */}
        {/* ================================================== */}

        <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <CardHeader
            title="Recouvrement"
            description="Taux de recouvrement par mois"
          />

          <div className="space-y-5 p-6">

            {normalized.map(
              (
                row
              ) => (
                <div
                  key={
                    row.month_start
                  }
                >

                  <div className="flex items-center justify-between gap-4">

                    <div>

                      <p className="font-black text-slate-800">
                        {formatMonth(
                          row.month_start
                        )}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-400">
                        {row.expected >
                        0
                          ? `${formatMoney(
                              row.paid
                            )} / ${formatMoney(
                              row.expected
                            )}`
                          : 'Aucune échéance'}
                      </p>

                    </div>

                    <p className="text-lg font-black text-slate-950">

                      {row.rate ===
                      null
                        ? '—'
                        : `${formatPercent(
                            row.rate
                          )} %`}

                    </p>

                  </div>

                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">

                    {row.rate !==
                      null && (
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width:
                            `${Math.max(
                              0,
                              Math.min(
                                100,
                                row.rate
                              )
                            )}%`,

                          backgroundColor:
                            'var(--brand-primary, #047857)',
                        }}
                      />
                    )}

                  </div>

                </div>
              )
            )}

          </div>

        </article>

        {/* ================================================== */}
        {/* TRESORERIE */}
        {/* ================================================== */}

        <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <CardHeader
            title="Entrées et sorties"
            description="Mouvements de trésorerie comptabilisés par mois"
          />

          <div className="space-y-6 p-6">

            {normalized.map(
              (
                row
              ) => {
                const incomeWidth =
                  percentageOf(
                    row.cashIn,
                    maxCash
                  )

                const expenseWidth =
                  percentageOf(
                    row.cashOut,
                    maxCash
                  )

                return (
                  <div
                    key={
                      row.month_start
                    }
                  >

                    <p className="font-black text-slate-800">
                      {formatMonth(
                        row.month_start
                      )}
                    </p>

                    {/* ENTREES */}

                    <div className="mt-3 grid grid-cols-[65px_1fr_auto] items-center gap-3">

                      <span className="text-xs font-black uppercase text-emerald-700">
                        Entrées
                      </span>

                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">

                        <div
                          className="h-full rounded-full bg-emerald-600"
                          style={{
                            width:
                              `${incomeWidth}%`,
                          }}
                        />

                      </div>

                      <span className="min-w-24 text-right text-xs font-black text-slate-700">
                        {formatMoney(
                          row.cashIn
                        )}
                      </span>

                    </div>

                    {/* SORTIES */}

                    <div className="mt-2 grid grid-cols-[65px_1fr_auto] items-center gap-3">

                      <span className="text-xs font-black uppercase text-red-700">
                        Sorties
                      </span>

                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">

                        <div
                          className="h-full rounded-full bg-red-500"
                          style={{
                            width:
                              `${expenseWidth}%`,
                          }}
                        />

                      </div>

                      <span className="min-w-24 text-right text-xs font-black text-slate-700">
                        {formatMoney(
                          row.cashOut
                        )}
                      </span>

                    </div>

                  </div>
                )
              }
            )}

          </div>

        </article>

        {/* ================================================== */}
        {/* NOUVEAUX MEMBRES */}
        {/* ================================================== */}

        <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm xl:col-span-2">

          <CardHeader
            title="Évolution des adhésions"
            description="Nouveaux membres enregistrés au cours des six derniers mois"
          />

          <div className="p-6">

            <div className="grid h-56 grid-cols-6 items-end gap-3 sm:gap-5">

              {normalized.map(
                (
                  row
                ) => {
                  const height =
                    row.newMembers >
                    0
                      ? Math.max(
                          12,
                          percentageOf(
                            row.newMembers,
                            maxMembers
                          )
                        )
                      : 2

                  return (
                    <div
                      key={
                        row.month_start
                      }
                      className="flex h-full min-w-0 flex-col justify-end"
                    >

                      <p className="mb-2 text-center text-sm font-black text-slate-950">
                        +{
                          row.newMembers
                        }
                      </p>

                      <div className="flex flex-1 items-end justify-center">

                        <div
                          className="w-full max-w-16 rounded-t-xl transition-all"
                          style={{
                            height:
                              `${height}%`,

                            backgroundColor:
                              row.newMembers >
                              0
                                ? 'var(--brand-primary, #047857)'
                                : '#E2E8F0',
                          }}
                        />

                      </div>

                      <p className="mt-3 truncate text-center text-xs font-bold text-slate-500">
                        {formatMonthShort(
                          row.month_start
                        )}
                      </p>

                    </div>
                  )
                }
              )}

            </div>

          </div>

        </article>

      </div>

    </section>
  )
}

// ============================================================
// HEADER
// ============================================================

function CardHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="border-b border-slate-200 px-6 py-5">

      <h3 className="text-xl font-black text-slate-950">
        {title}
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        {description}
      </p>

    </div>
  )
}

// ============================================================
// TITRE SECTION
// ============================================================

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description?: string
}) {
  return (
    <div>

      <p
        className="text-xs font-black uppercase tracking-[0.16em]"
        style={{
          color:
            'var(--brand-primary, #047857)',
        }}
      >
        {eyebrow}
      </p>

      <h2 className="mt-1 text-2xl font-black text-slate-950">
        {title}
      </h2>

      {description && (
        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>
      )}

    </div>
  )
}

// ============================================================
// HELPERS
// ============================================================

function numberValue(
  value:
    | number
    | string
    | null
) {
  const parsed =
    Number(
      value ?? 0
    )

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0
}

function nullableNumber(
  value:
    | number
    | string
    | null
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null
  }

  const parsed =
    Number(
      value
    )

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null
}

function percentageOf(
  value: number,
  maximum: number
) {
  if (
    maximum <= 0
  ) {
    return 0
  }

  return Math.max(
    0,
    Math.min(
      100,
      (
        value /
        maximum
      ) *
        100
    )
  )
}

function formatPercent(
  value: number
) {
  return new Intl.NumberFormat(
    'fr-FR',
    {
      maximumFractionDigits:
        1,
    }
  ).format(
    value
  )
}

function formatMoney(
  value: number
) {
  return `${new Intl.NumberFormat(
    'fr-FR',
    {
      maximumFractionDigits:
        0,
    }
  ).format(
    value
  )} FCFA`
}

function formatMonth(
  value: string
) {
  return capitalize(
    new Intl.DateTimeFormat(
      'fr-FR',
      {
        month:
          'long',

        year:
          'numeric',

        timeZone:
          'UTC',
      }
    ).format(
      createUtcDate(
        value
      )
    )
  )
}

function formatMonthShort(
  value: string
) {
  return capitalize(
    new Intl.DateTimeFormat(
      'fr-FR',
      {
        month:
          'short',

        timeZone:
          'UTC',
      }
    ).format(
      createUtcDate(
        value
      )
    )
  )
}

function createUtcDate(
  value: string
) {
  const dateOnly =
    value.slice(
      0,
      10
    )

  return new Date(
    `${dateOnly}T00:00:00Z`
  )
}

function capitalize(
  value: string
) {
  if (
    !value
  ) {
    return value
  }

  return (
    value
      .charAt(
        0
      )
      .toUpperCase() +
    value.slice(
      1
    )
  )
}