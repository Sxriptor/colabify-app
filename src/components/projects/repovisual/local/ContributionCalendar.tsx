'use client'

import { memo, useMemo, useState } from 'react'
import { GitHubCommit } from '../types'

interface ContributionCalendarProps {
  commits: GitHubCommit[]
}

interface DayData {
  date: Date
  count: number
  dateString: string
  isEmpty: boolean
}

function ContributionCalendarComponent({ commits }: ContributionCalendarProps) {
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  // Generate GitHub-style contribution calendar data
  const calendarData = useMemo(() => {
    const today = new Date()
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
    
    // Create a map of date strings to commit counts
    const commitsByDate = new Map<string, number>()
    
    commits.forEach(commit => {
      const date = new Date(commit.commit.author.date)
      const dateString = date.toISOString().split('T')[0] // YYYY-MM-DD
      commitsByDate.set(dateString, (commitsByDate.get(dateString) || 0) + 1)
    })

    // Generate all days for the past year
    const days: DayData[] = []
    const currentDate = new Date(oneYearAgo)
    
    while (currentDate <= today) {
      const dateString = currentDate.toISOString().split('T')[0]
      const count = commitsByDate.get(dateString) || 0
      
      days.push({
        date: new Date(currentDate),
        count,
        dateString,
        isEmpty: false
      })
      
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Organize into weeks (7 days each) starting from Sunday
    const weeks: DayData[][] = []
    let currentWeek: DayData[] = []
    
    // Find the first Sunday before or on the first day
    const firstDay = days[0]
    const dayOfWeek = firstDay.date.getDay() // 0 = Sunday
    
    // Add empty days at the beginning if needed
    for (let i = 0; i < dayOfWeek; i++) {
      currentWeek.push({
        date: new Date(0),
        count: 0,
        dateString: '',
        isEmpty: true
      })
    }
    
    days.forEach(day => {
      currentWeek.push(day)
      
      if (currentWeek.length === 7) {
        weeks.push(currentWeek)
        currentWeek = []
      }
    })
    
    // Add remaining days to last week
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({
          date: new Date(0),
          count: 0,
          dateString: '',
          isEmpty: true
        })
      }
      weeks.push(currentWeek)
    }

    const maxCount = Math.max(...Array.from(commitsByDate.values()), 1)
    return { weeks, maxCount, totalCommits: commits.length }
  }, [commits])

  // Get color intensity based on commit count (0-4 levels)
  const getIntensity = (count: number, maxCount: number) => {
    if (count === 0) return 0
    const ratio = count / maxCount
    if (ratio <= 0.25) return 1
    if (ratio <= 0.5) return 2
    if (ratio <= 0.75) return 3
    return 4
  }

  // Color classes for different intensities with dark theme
  const getColorClass = (intensity: number) => {
    switch (intensity) {
      case 0: return 'bg-gray-900/50 border-gray-800/50'
      case 1: return 'bg-green-900/60 border-green-800/70'
      case 2: return 'bg-green-700/70 border-green-600/80'
      case 3: return 'bg-green-500/80 border-green-400/90'
      case 4: return 'bg-green-400 border-green-300'
      default: return 'bg-gray-900/50 border-gray-800/50'
    }
  }

  // Calculate current streak
  const currentStreak = useMemo(() => {
    const today = new Date()
    let streak = 0
    const currentDate = new Date(today)
    
    for (let i = 0; i < 365; i++) {
      const dateString = currentDate.toISOString().split('T')[0]
      const dayData = calendarData.weeks.flat().find(d => d.dateString === dateString)
      
      if (dayData && dayData.count > 0) {
        streak++
        currentDate.setDate(currentDate.getDate() - 1)
      } else {
        break
      }
    }
    
    return streak
  }, [calendarData])

  return (
    <div className="border border-gray-800/50 bg-gradient-to-br from-[#050509] via-[#0a0f1a] to-[#050509] rounded-lg overflow-hidden">
      <div className="border-b border-gray-800/50 p-5 flex items-center justify-between bg-black/40 backdrop-blur-sm">
        <div>
          <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-[#22c55e] to-[#16a34a] font-mono text-sm font-semibold tracking-wide">
            CONTRIBUTION.CALENDAR
          </h3>
          <p className="text-gray-500 font-mono text-xs mt-1">
            {calendarData.totalCommits} contributions in the last year • {currentStreak} day current streak
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs font-mono text-gray-400">
          <span>Less</span>
          <div className="flex space-x-1">
            {[0, 1, 2, 3, 4].map(intensity => (
              <div
                key={intensity}
                className={`w-2.5 h-2.5 rounded-sm border ${getColorClass(intensity)}`}
              />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>
      
      <div className="p-6 relative">
        <div className="flex flex-col space-y-2">
          {/* Month labels */}
          <div className="flex mb-3">
            <div className="w-8"></div> {/* Space for day labels */}
            <div className="flex-1 grid grid-cols-12 text-xs font-mono text-gray-500">
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(month => (
                <span key={month} className="text-center">{month}</span>
              ))}
            </div>
          </div>
          
          {/* Calendar grid */}
          <div className="flex">
            {/* Day labels */}
            <div className="flex flex-col justify-between mr-3 py-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                <div key={day} className="h-3 flex items-center">
                  <span className="text-xs font-mono text-gray-500 w-8">
                    {index % 2 === 1 ? day : ''}
                  </span>
                </div>
              ))}
            </div>
            
            {/* Contribution squares */}
            <div className="flex space-x-1 overflow-x-auto min-w-0">
              {calendarData.weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col space-y-1">
                  {week.map((day, dayIndex) => {
                    const intensity = getIntensity(day.count, calendarData.maxCount)
                    
                    return (
                      <div
                        key={`${weekIndex}-${dayIndex}`}
                        className={`w-3 h-3 rounded-sm border transition-all duration-200 ${
                          day.isEmpty 
                            ? 'bg-transparent border-transparent' 
                            : `${getColorClass(intensity)} cursor-pointer hover:ring-1 hover:ring-green-400/50 hover:scale-110 hover:z-10`
                        }`}
                        onMouseEnter={(e) => {
                          if (!day.isEmpty) {
                            setHoveredDay(day)
                            setMousePos({ x: e.pageX, y: e.pageY })
                          }
                        }}
                        onMouseLeave={() => setHoveredDay(null)}
                        onMouseMove={(e) => {
                          if (!day.isEmpty) {
                            setMousePos({ x: e.pageX, y: e.pageY })
                          }
                        }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {hoveredDay && (
          <div 
            className="fixed z-50 bg-gradient-to-br from-gray-900/95 to-gray-950/95 backdrop-blur-md border border-gray-700/50 rounded-lg p-3 shadow-2xl pointer-events-none"
            style={{
              left: mousePos.x + 15,
              top: mousePos.y - 80,
              maxWidth: '250px'
            }}
          >
            <div className="text-xs font-mono">
              <div className="text-white font-semibold">
                {hoveredDay.count} contribution{hoveredDay.count !== 1 ? 's' : ''}
              </div>
              <div className="text-gray-400 mt-1">
                {hoveredDay.date.toLocaleDateString('en-US', { 
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {commits.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-500 font-mono text-sm">
              <div className="text-gray-400 mb-2 text-2xl">📊</div>
              <div>No contribution data available</div>
              <div className="text-xs mt-1 text-gray-600">Start making commits to see your activity</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Memoize the component to prevent unnecessary re-renders
export const ContributionCalendar = memo(ContributionCalendarComponent)