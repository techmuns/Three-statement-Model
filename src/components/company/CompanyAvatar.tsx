import { seriesColor } from '@/theme/tokens'
import { cn } from '@/lib/cn'
import type { MockCompany } from '@/mocks/companies'

/**
 * Monogram stand-in for a company logo.
 *
 * Tinted from the categorical series ramp by the company's fixed slot, so a
 * company keeps one identity colour everywhere it appears. Decorative: the
 * company name is always rendered as text beside it.
 */
export function CompanyAvatar({
  company,
  size = 'md',
}: {
  company: MockCompany
  size?: 'sm' | 'md'
}) {
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: seriesColor(company.colorIndex) }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md font-bold text-white',
        // A hairline inset ring keeps the lighter slots from bleeding into the
        // surface — the ramp's slots 3-5 sit below 3:1 against white.
        'ring-1 ring-inset ring-black/10',
        size === 'sm' ? 'size-6 text-micro' : 'size-8 text-label',
      )}
    >
      {company.monogram}
    </span>
  )
}
