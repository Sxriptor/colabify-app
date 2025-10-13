import { memo } from 'react'
import { GitHubCommit } from '../types'

interface CommitFrequencyChartProps {
  commits?: GitHubCommit[]
}

function CommitFrequencyChartComponent({ commits = [] }: CommitFrequencyChartProps) {
  console.log('🔥 TESTING - NEW CommitFrequencyChart rendering with', commits.length, 'commits')

  // Simple test to see if component updates

  return (
    <div className="border border-red-500 bg-red-900 p-8">
      <h1 className="text-white text-2xl font-bold">
        🚨 TESTING NEW COMPONENT - {commits.length} COMMITS 🚨
      </h1>
      <p className="text-white mt-4">
        If you can see this red box, the component is updating correctly!
      </p>
      <div className="mt-4 text-yellow-300">
        Current time: {new Date().toLocaleTimeString()}
      </div>
    </div>
  )
}

// Memoize the component to prevent unnecessary re-renders
export const CommitFrequencyChart = memo(CommitFrequencyChartComponent)
