export function BrandMark({ size = 28 }: { size?: number }) {
  // A cylinder seen from the side: shoulder, body and valve.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="brand-mark">
      <rect width="32" height="32" rx="8" className="brand-mark__bg" />
      <rect x="13.5" y="5" width="5" height="3.5" rx="1" className="brand-mark__fg" opacity="0.85" />
      <path d="M10 13.5a6 6 0 0 1 12 0V25a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2z" className="brand-mark__fg" />
      <rect x="10" y="12.5" width="12" height="2.5" className="brand-mark__band" />
    </svg>
  )
}
