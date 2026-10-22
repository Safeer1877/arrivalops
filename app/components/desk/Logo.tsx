/** A pickup bay seen from above, with the one car nobody has accounted for. */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#0f172a" />
      <path d="M9 24V9h14v15" fill="none" stroke="#f5f5f4" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="12.5" y="13" width="7" height="9" rx="2" fill="#f59e0b" />
    </svg>
  )
}
