// ============================================================
// AFRI CLUB
// DASHBOARD ANALYTICS
// ANALYSE DES 6 DERNIERS MOIS
// ============================================================

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

type NormalizedAnalyticsRow = {
  month_start: string
  month_label: string

  expected: number
  paid: number
  remaining: number

  rate:
    | number
    | null

  cashIn: number
  cashOut: number
  cashBalance: number

  newMembers: number
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export default function DashboardAnalytics({
  rows,
}: {
  rows: DashboardAnalyticsRow[]
}) {
  // ==========================================================
  // AUCUNE DONNEE RETOURNEE
  // ==========================================================

  if (
    rows.length === 0
  ) {
    return (
      <section className="mt-8">

        <SectionTitle
          eyebrow="Analyse"
          title="Évolution sur 6 mois"
          description="Suivez les tendances de recouvrement, de trésorerie et d’adhésion."
        />

        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">

          <div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-black"
            style={{
              backgroundColor:
                'var(--brand-accent, #ECFDF5)',

              color:
                'var(--brand-primary, #047857)',
            }}
          >
            ↗
          </div>

          <h3 className="mt-4 text-lg font-black text-slate-900">
            Analyse en préparation
          </h3>

          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Les indicateurs apparaîtront automatiquement dès que
            l&apos;organisation disposera de données suffisantes.
          </p>

        </div>

      </section>
    )
  }

  // ==========================================================
  // NORMALISATION
  // ==========================================================

  const normalized:
    NormalizedAnalyticsRow[] =
    rows.map(
      (
        row
      ) => ({
        month_start:
          row.month_start,

        month_label:
          row.month_label,

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

  // ==========================================================
  // PRESENCE DE DONNEES
  // ==========================================================

  const hasCollectionData =
    normalized.some(
      (
        row
      ) =>
        row.expected >
        0
    )

  const hasCashMovements =
    normalized.some(
      (
        row
      ) =>
        row.cashIn !==
          0 ||
        row.cashOut !==
          0
    )

  const hasMembershipData =
    normalized.some(
      (
        row
      ) =>
        row.newMembers >
        0
    )

  // ==========================================================
  // TOTAUX RECOUVREMENT
  // ==========================================================

  const totalExpected =
    normalized.reduce(
      (
        total,
        row
      ) =>
        total +
        row.expected,
      0
    )

  const totalPaid =
    normalized.reduce(
      (
        total,
        row
      ) =>
        total +
        row.paid,
      0
    )

  const totalRemaining =
    normalized.reduce(
      (
        total,
        row
      ) =>
        total +
        row.remaining,
      0
    )

  const globalCollectionRate =
    totalExpected >
    0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(
              (
                totalPaid /
                totalExpected
              ) *
                100
            )
          )
        )
      : null

  // ==========================================================
  // TOTAUX TRESORERIE
  // ==========================================================

  const totalCashIn =
    normalized.reduce(
      (
        total,
        row
      ) =>
        total +
        row.cashIn,
      0
    )

  const totalCashOut =
    normalized.reduce(
      (
        total,
        row
      ) =>
        total +
        row.cashOut,
      0
    )

  const cashNet =
    totalCashIn -
    totalCashOut

  // ==========================================================
  // TOTAL NOUVEAUX MEMBRES
  // ==========================================================

  const totalNewMembers =
    normalized.reduce(
      (
        total,
        row
      ) =>
        total +
        row.newMembers,
      0
    )

  // ==========================================================
  // ECHELLES GRAPHIQUES
  // ==========================================================

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

  // ==========================================================
  // RENDU
  // ==========================================================

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

      {/* ==================================================== */}
      {/* RECOUVREMENT + TRESORERIE */}
      {/* ==================================================== */}

      <div className="mt-5 grid gap-6 xl:grid-cols-2">

        {/* ================================================== */}
        {/* RECOUVREMENT */}
        {/* ================================================== */}

        <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <CardHeader
            title="Recouvrement"
            description="Évolution du taux de recouvrement sur les six derniers mois"
          />

          {hasCollectionData ? (
            <>
              {/* ============================================= */}
              {/* RESUME */}
              {/* ============================================= */}

              <div className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-4">

                <MiniMetric
                  label="Attendu"
                  value={
                    formatMoney(
                      totalExpected
                    )
                  }
                />

                <MiniMetric
                  label="Recouvré"
                  value={
                    formatMoney(
                      totalPaid
                    )
                  }
                  positive
                />

                <MiniMetric
                  label="Reste"
                  value={
                    formatMoney(
                      totalRemaining
                    )
                  }
                />

                <MiniMetric
                  label="Taux global"
                  value={
                    globalCollectionRate ===
                    null
                      ? '—'
                      : `${globalCollectionRate} %`
                  }
                  positive={
                    globalCollectionRate !==
                      null &&
                    globalCollectionRate >=
                      70
                  }
                />

              </div>

              {/* ============================================= */}
              {/* DETAIL PAR MOIS */}
              {/* ============================================= */}

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

                      <div className="flex items-end justify-between gap-4">

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
                                )} encaissé sur ${formatMoney(
                                  row.expected
                                )}`

                              : 'Aucune échéance'}

                          </p>

                        </div>

                        <p className="shrink-0 text-lg font-black text-slate-950">

                          {row.rate ===
                          null
                            ? '—'
                            : `${formatPercent(
                                row.rate
                              )} %`}

                        </p>

                      </div>

                      <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-slate-100">

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
            </>
          ) : (
            <EmptyAnalyticsState
              icon="✓"
              title="Aucune cotisation exigible sur les 6 derniers mois"
              description="Le graphique de recouvrement apparaîtra automatiquement dès qu’une cotisation sera mise en recouvrement."
              footer="Aucun montant attendu sur cette période."
            />
          )}

        </article>

        {/* ================================================== */}
        {/* TRESORERIE */}
        {/* ================================================== */}

        <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <CardHeader
            title="Entrées et sorties"
            description="Mouvements de trésorerie comptabilisés sur les six derniers mois"
          />

          {hasCashMovements ? (
            <>
              {/* ============================================= */}
              {/* RESUME TRESORERIE */}
              {/* ============================================= */}

              <div className="grid grid-cols-3 gap-px border-b border-slate-200 bg-slate-200">

                <MiniMetric
                  label="Entrées"
                  value={
                    formatMoney(
                      totalCashIn
                    )
                  }
                  positive
                />

                <MiniMetric
                  label="Sorties"
                  value={
                    formatMoney(
                      totalCashOut
                    )
                  }
                />

                <MiniMetric
                  label="Net"
                  value={
                    formatSignedMoney(
                      cashNet
                    )
                  }
                  positive={
                    cashNet >=
                    0
                  }
                />

              </div>

              {/* ============================================= */}
              {/* MOUVEMENTS PAR MOIS */}
              {/* ============================================= */}

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

                        {/* =================================== */}
                        {/* ENTREES */}
                        {/* =================================== */}

                        <div className="mt-3 grid grid-cols-[68px_1fr_auto] items-center gap-3">

                          <span className="text-[11px] font-black uppercase text-emerald-700">
                            Entrées
                          </span>

                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">

                            {row.cashIn >
                              0 && (
                              <div
                                className="h-full rounded-full bg-emerald-600"
                                style={{
                                  width:
                                    `${Math.max(
                                      2,
                                      incomeWidth
                                    )}%`,
                                }}
                              />
                            )}

                          </div>

                          <span className="min-w-24 text-right text-xs font-black text-slate-700">
                            {formatMoney(
                              row.cashIn
                            )}
                          </span>

                        </div>

                        {/* =================================== */}
                        {/* SORTIES */}
                        {/* =================================== */}

                        <div className="mt-2 grid grid-cols-[68px_1fr_auto] items-center gap-3">

                          <span className="text-[11px] font-black uppercase text-red-700">
                            Sorties
                          </span>

                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">

                            {row.cashOut >
                              0 && (
                              <div
                                className="h-full rounded-full bg-red-500"
                                style={{
                                  width:
                                    `${Math.max(
                                      2,
                                      expenseWidth
                                    )}%`,
                                }}
                              />
                            )}

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
            </>
          ) : (
            <EmptyAnalyticsState
              icon="↔"
              title="Aucun mouvement financier sur cette période"
              description="Les entrées et sorties apparaîtront ici dès que des opérations de trésorerie seront comptabilisées."
              footer={`${formatMoney(
                totalCashIn
              )} d’entrées · ${formatMoney(
                totalCashOut
              )} de sorties`}
            />
          )}

        </article>

      </div>

      {/* ==================================================== */}
      {/* EVOLUTION DES ADHESIONS */}
      {/* ==================================================== */}

      <article className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

        <CardHeader
          title="Évolution des adhésions"
          description="Nouveaux membres enregistrés au cours des six derniers mois"
          badge={
            totalNewMembers >
            0
              ? `+${totalNewMembers} sur 6 mois`
              : undefined
          }
        />

        {hasMembershipData ? (
          <div className="p-6 sm:p-8">

            {/* =============================================== */}
            {/* GRAPHIQUE */}
            {/* =============================================== */}

            <div className="grid h-64 grid-cols-6 items-end gap-2 sm:gap-5">

              {normalized.map(
                (
                  row
                ) => {
                  const height =
                    row.newMembers >
                    0
                      ? Math.max(
                          18,
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

                      {/* ===================================== */}
                      {/* VALEUR */}
                      {/* ===================================== */}

                      <p
                        className={`mb-2 text-center text-sm font-black ${
                          row.newMembers >
                          0
                            ? 'text-slate-950'
                            : 'text-slate-400'
                        }`}
                      >
                        +
                        {
                          row.newMembers
                        }
                      </p>

                      {/* ===================================== */}
                      {/* BARRE */}
                      {/* ===================================== */}

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

                      {/* ===================================== */}
                      {/* MOIS */}
                      {/* ===================================== */}

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

            {/* =============================================== */}
            {/* RESUME */}
            {/* =============================================== */}

            <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Nouveaux membres
                </p>

                <p className="mt-1 text-xl font-black text-slate-950">
                  +{totalNewMembers}
                </p>

              </div>

              <p className="text-sm text-slate-500">
                enregistrés au cours des six derniers mois
              </p>

            </div>

          </div>
        ) : (
          <EmptyAnalyticsState
            icon="+"
            title="Aucune nouvelle adhésion sur les 6 derniers mois"
            description="Le graphique évoluera automatiquement dès qu’un nouveau membre sera enregistré."
            footer="0 nouveau membre sur cette période."
          />
        )}

      </article>

    </section>
  )
}

// ============================================================
// EN-TETE DE CARTE
// ============================================================

function CardHeader({
  title,
  description,
  badge,
}: {
  title: string
  description: string
  badge?: string
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

      <div>

        <h3 className="text-xl font-black text-slate-950">
          {title}
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>

      </div>

      {badge && (
        <span
          className="self-start rounded-full px-3 py-1.5 text-xs font-black sm:self-auto"
          style={{
            backgroundColor:
              'var(--brand-accent, #ECFDF5)',

            color:
              'var(--brand-primary, #047857)',
          }}
        >
          {badge}
        </span>
      )}

    </div>
  )
}

// ============================================================
// MINI KPI
// ============================================================

function MiniMetric({
  label,
  value,
  positive = false,
}: {
  label: string
  value: string
  positive?: boolean
}) {
  return (
    <div className="bg-white px-4 py-4">

      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 text-sm font-black sm:text-base ${
          positive
            ? 'text-emerald-700'
            : 'text-slate-950'
        }`}
      >
        {value}
      </p>

    </div>
  )
}

// ============================================================
// ETAT VIDE ANALYTIQUE
// ============================================================

function EmptyAnalyticsState({
  icon,
  title,
  description,
  footer,
}: {
  icon: string
  title: string
  description: string
  footer?: string
}) {
  return (
    <div className="flex min-h-[320px] items-center justify-center p-6 sm:p-8">

      <div className="max-w-md text-center">

        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-black"
          style={{
            backgroundColor:
              'var(--brand-accent, #ECFDF5)',

            color:
              'var(--brand-primary, #047857)',
          }}
        >
          {icon}
        </div>

        <h4 className="mt-5 text-lg font-black text-slate-900">
          {title}
        </h4>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          {description}
        </p>

        {footer && (
          <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
            {footer}
          </div>
        )}

      </div>

    </div>
  )
}

// ============================================================
// TITRE DE SECTION
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
// CONVERSION NUMBER
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

// ============================================================
// CONVERSION NUMBER NULLABLE
// ============================================================

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

// ============================================================
// POURCENTAGE RELATIF
// ============================================================

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

// ============================================================
// FORMAT POURCENTAGE
// ============================================================

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

// ============================================================
// FORMAT MONTANT
// ============================================================

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
    Math.round(
      value
    )
  )} FCFA`
}

// ============================================================
// FORMAT MONTANT SIGNE
// ============================================================

function formatSignedMoney(
  value: number
) {
  if (
    value === 0
  ) {
    return '0 FCFA'
  }

  const sign =
    value >
    0
      ? '+'
      : '-'

  return `${sign}${new Intl.NumberFormat(
    'fr-FR',
    {
      maximumFractionDigits:
        0,
    }
  ).format(
    Math.abs(
      Math.round(
        value
      )
    )
  )} FCFA`
}

// ============================================================
// MOIS LONG
// ============================================================

function formatMonth(
  value: string
) {
  return capitalize(
    new Intl.DateTimeFormat(
      'fr-FR',
      {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }
    ).format(
      createUtcDate(
        value
      )
    )
  )
}

// ============================================================
// MOIS COURT
// ============================================================

function formatMonthShort(
  value: string
) {
  return capitalize(
    new Intl.DateTimeFormat(
      'fr-FR',
      {
        month: 'short',
        timeZone: 'UTC',
      }
    ).format(
      createUtcDate(
        value
      )
    )
  )
}

// ============================================================
// CREATION DATE UTC
// ============================================================

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

// ============================================================
// CAPITALISATION
// ============================================================

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
      .charAt(0)
      .toUpperCase() +
    value.slice(1)
  )
}