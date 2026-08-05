import { findKpiDefinition } from '@/config/kpis'
import { WidgetCard } from '@/components/widgets/WidgetCard'
import { formatKpiValue } from '@/lib/kpiFormat'
import { MIN_SECTOR_PEERS, type SectorPeerPositioning, type SectorPeerStat } from '@/mocks/sectorPeers'
import type { MockCompany } from '@/mocks/companies'

/** Map a value into 0–100% of a padded [min, max] domain. */
function position(value: number, min: number, max: number): number {
  if (max === min) return 50
  return ((value - min) / (max - min)) * 100
}

function PeerRangeRow({ stat }: { stat: SectorPeerStat }) {
  const definition = findKpiDefinition(stat.kpiId)
  const subject = stat.subjectValue
  // Domain spans the peer range and the subject (which may sit outside it),
  // padded so no marker collides with the track ends.
  const rawMin = Math.min(stat.low, subject ?? stat.low)
  const rawMax = Math.max(stat.high, subject ?? stat.high)
  const pad = (rawMax - rawMin || Math.abs(rawMax) || 1) * 0.12
  const min = rawMin - pad
  const max = rawMax + pad

  const lowPct = position(stat.low, min, max)
  const highPct = position(stat.high, min, max)
  const medianPct = position(stat.median, min, max)
  const subjectPct = subject === null ? null : position(subject, min, max)

  return (
    <div className="grid grid-cols-[7.5rem_2.75rem_1fr_2.75rem] items-center gap-2 sm:grid-cols-[10rem_3rem_1fr_3rem] sm:gap-3">
      <span className="truncate text-caption font-medium text-ink-secondary">{definition.label}</span>
      {/* Peer low / high sit in fixed side columns, so their labels can never
          collide with the median or the subject on the track. */}
      <span className="tabular text-right text-micro text-ink-subtle">
        {formatKpiValue(stat.low, definition)}
      </span>

      <div className="relative h-9">
        {/* baseline + the peer low→high range */}
        <div className="absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 bg-line-strong" />
        <div
          className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-brand-200"
          style={{ left: `${lowPct}%`, width: `${Math.max(0, highPct - lowPct)}%` }}
        />

        {/* peer low / high — open circles (values are in the side columns) */}
        {[lowPct, highPct].map((pct, index) => (
          <span
            key={index}
            className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-line-strong bg-surface-card"
            style={{ left: `${pct}%` }}
          />
        ))}

        {/* peer median — a tick with its value beneath */}
        <div
          className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
          style={{ left: `${medianPct}%` }}
        >
          <span className="h-3.5 w-0.5 rounded-full bg-ink-muted" />
          <span className="tabular absolute top-3.5 text-micro font-medium text-ink-muted">
            {formatKpiValue(stat.median, definition)}
          </span>
        </div>

        {/* the selected company — filled brand dot with its value above */}
        {subjectPct !== null && (
          <div
            className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${subjectPct}%` }}
          >
            <span className="tabular absolute -top-4 font-semibold text-brand-700">
              {formatKpiValue(subject, definition)}
            </span>
            <span className="size-3 rounded-full border-2 border-surface-card bg-brand-600 shadow-card ring-1 ring-brand-700/20" />
          </div>
        )}
      </div>

      <span className="tabular text-left text-micro text-ink-subtle">
        {formatKpiValue(stat.high, definition)}
      </span>
    </div>
  )
}

export interface PeerPositioningProps {
  company: MockCompany
  asOf: string
  positioning: SectorPeerPositioning | null
}

/**
 * Full-width peer-positioning strip: for each KPI, where the company sits
 * between its real sector peers' low, median and high. Shown only when the
 * sector has enough scraped peers; otherwise an honest note explains how many
 * are in and how many are needed — never a blank card or a fabricated range.
 */
export function PeerPositioning({ company, asOf, positioning }: PeerPositioningProps) {
  if (!positioning || !positioning.hasEnough || positioning.stats.length === 0) {
    const have = positioning?.peerCount ?? 0
    return (
      <WidgetCard title="Peer positioning" subtitle={`${company.sector} · ${asOf}`} wide>
        <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
          <p className="text-body font-semibold text-ink-primary">Limited peer data so far</p>
          <p className="max-w-md text-caption text-ink-secondary">
            {have === 0
              ? `No other ${company.sector} company has been scraped yet.`
              : `${have} other ${company.sector} ${have === 1 ? 'company has' : 'companies have'} been scraped.`}{' '}
            Peer positioning appears once at least {MIN_SECTOR_PEERS} peers are in — the rotation
            fills these in over the coming runs.
          </p>
        </div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard
      title="Peer positioning"
      subtitle={`${company.sector} · ${asOf}`}
      footnote={`Range across ${positioning.peerCount} scraped ${company.sector} peers. ○ peer low/high · │ peer median · ● ${company.ticker}.`}
      wide
    >
      <div className="flex flex-col gap-1.5 pt-1 pb-1">
        <div className="grid grid-cols-[7.5rem_2.75rem_1fr_2.75rem] gap-2 pb-1 text-micro font-semibold tracking-wide text-ink-subtle uppercase sm:grid-cols-[10rem_3rem_1fr_3rem] sm:gap-3">
          <span>KPI</span>
          <span className="text-right">Low</span>
          <span className="text-center">
            Peer median · <span className="text-brand-700">{company.ticker}</span>
          </span>
          <span className="text-left">High</span>
        </div>
        {positioning.stats.map((stat) => (
          <PeerRangeRow key={stat.kpiId} stat={stat} />
        ))}
      </div>
    </WidgetCard>
  )
}
