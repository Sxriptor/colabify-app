export function CommitFrequencyChart() {
  return (
    <div className="border border-gray-800 bg-black">
      <div className="border-b border-gray-800 p-4">
        <h3 className="text-white font-mono text-sm">COMMIT.FREQUENCY.ANALYSIS</h3>
      </div>
      <div className="p-6">
        <div className="font-mono text-xs space-y-1">
          {Array.from({ length: 7 }).map((_, dayIndex) => {
            const dayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][dayIndex]
            const commitCount = Math.floor(Math.random() * 20)
            const barLength = Math.floor((commitCount / 20) * 40)

            return (
              <div key={dayIndex} className="flex items-center space-x-2">
                <span className="text-gray-400 w-8">{dayName}</span>
                <span className="text-gray-600">|</span>
                <div className="flex">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <span key={i} className={i < barLength ? 'text-white' : 'text-gray-800'}>
                      ▓
                    </span>
                  ))}
                </div>
                <span className="text-gray-400 ml-2">{commitCount.toString().padStart(2, '0')}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
