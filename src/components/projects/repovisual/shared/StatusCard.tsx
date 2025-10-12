interface StatusCardProps {
  label: string
  value: string | number
  subtext?: string
  className?: string
}

export function StatusCard({ label, value, subtext, className = '' }: StatusCardProps) {
  return (
    <div className={`border border-gray-800 p-4 ${className}`}>
      <div className="text-gray-400 font-mono text-xs mb-2">{label}</div>
      <div className="text-white font-mono text-lg font-bold">{value}</div>
      {subtext && (
        <div className="text-gray-500 font-mono text-xs mt-1">{subtext}</div>
      )}
    </div>
  )
}
