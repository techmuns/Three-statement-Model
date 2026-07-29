import { APP } from '@/config/app'

/**
 * App logo + wordmark. The glyph is an inline SVG of three rising bars — no
 * image asset, so it stays crisp and costs no request.
 */
export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[0.5rem] bg-gradient-brand shadow-card">
        <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true" fill="none">
          <path
            d="M4 14V11M10 14V7M16 14V4"
            stroke="white"
            strokeWidth="2.25"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-heading font-bold tracking-tight text-gradient-brand">
          {APP.name}
        </span>
        <span className="mt-0.5 hidden text-micro font-medium tracking-wide text-ink-subtle uppercase sm:block">
          {APP.tagline}
        </span>
      </span>
    </span>
  )
}
