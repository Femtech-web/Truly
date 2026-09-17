export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ '--mark-size': `${size}px` } as React.CSSProperties} aria-hidden="true">
      <span className="brand-mark__ring" />
      <span className="brand-mark__dot" />
    </span>
  )
}
