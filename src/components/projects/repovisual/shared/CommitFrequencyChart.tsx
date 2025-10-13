import { memo, useMemo } from 'react'
import { GitHubCommit } from '../types'

interface CommitFrequencyChartProps {
  commits?: GitHubCommit[]
}

function CommitFrequencyChartComponent({ commits = [] }: CommitFrequencyChartProps) {
  // Calculate commit frequency by day of week from real data
  const dayFrequency = useMemo(() => {
    const frequency = [0, 0, 0, 0, 0, 0, 0] // Sun, Mon, Tue, Wed, Thu, Fri, Sat
    
    commits.forEach(commit => {
      const date = new Date(commit.commit.author.date)
      const dayOfWeek = date.getDay()
      frequency[dayOfWeek]++
    })
    
    return frequency
  }, [commits])

  const maxCommits = Math.max(...dayFrequency, 1) // Avoid division by zero

  return (
    <div className="border border-gray-800 bg-black">
      <div className="border-b border-gray-800 p-4">
        <h3 className="text-white font-mono text-sm">COMMIT.FREQUENCY.ANALYSIS</h3>
        <p className="text-gray-500 font-mono text-xs mt-1">
          {commits.length} commits analyzed • Distribution by day of week
        </p>
      </div>
      <div className="p-6">
        <div className="font-mono text-xs space-y-1">
          {dayFrequency.map((commitCount, dayIndex) => {
            const dayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][dayIndex]
            const barLength = maxCommits > 0 ? Math.floor((commitCount / maxCommits) * 40) : 0

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
        {commits.length === 0 && (
          <div className="text-center text-gray-500 font-mono text-xs mt-4">
            No commit data available
          </div>
        )}
      </div>
    </div>
  )
}

// Memoize the component to prevent unnecessary re-renders
export const CommitFrequencyChart = memo(CommitFrequencyChartComponent)
