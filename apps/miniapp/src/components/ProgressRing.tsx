export function ProgressRing({ value, size = 50 }: { value: number; size?: number }) {
  const radius = 20
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="progress-ring" style={{ width: size, height: size }} aria-label={`${value}% complete`}>
      <svg viewBox="0 0 48 48" role="presentation">
        <circle className="progress-ring__track" cx="24" cy="24" r={radius} />
        <circle
          className="progress-ring__value"
          cx="24"
          cy="24"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span>{value}%</span>
    </div>
  )
}
