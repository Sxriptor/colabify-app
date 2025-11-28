'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'

interface Application {
  name: string
  category: string
  path: string
  executable?: string
  icon?: string
}

interface TimeData {
  applications: Record<string, {
    name: string
    lastUsed: string | null
    totalMinutes: number
  }>
  sessions: Array<{
    appName: string
    startTime: string
    endTime: string
    duration: number
  }>
  totalTime: Record<string, number>
  activeSessions: Array<{
    appName: string
    startTime: string
    currentDuration: number
  }>
}

export function TimeCardContent() {
  const { user } = useAuth()
  const [applications, setApplications] = useState<Application[]>([])
  const [timeData, setTimeData] = useState<TimeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [activeApps, setActiveApps] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.isElectron) {
      loadApplications()
      loadTimeData()
      
      // Refresh time data every 30 seconds to update active sessions
      const interval = setInterval(() => {
        loadTimeData()
      }, 30000)

      return () => clearInterval(interval)
    }
  }, [])

  const loadApplications = async () => {
    try {
      setScanning(true)
      const electronAPI = (window as any).electronAPI
      const result = await electronAPI.timecard.scanApplications()
      
      if (result.success) {
        setApplications(result.applications || [])
      } else {
        console.error('Failed to scan applications:', result.error)
      }
    } catch (error) {
      console.error('Error loading applications:', error)
    } finally {
      setScanning(false)
      setLoading(false)
    }
  }

  const loadTimeData = async () => {
    try {
      const electronAPI = (window as any).electronAPI
      const result = await electronAPI.timecard.getData()
      
      if (result.success) {
        setTimeData(result.data)
        
        // Update active apps
        const active = new Set<string>()
        if (result.data.activeSessions) {
          result.data.activeSessions.forEach((session: any) => {
            active.add(session.appName)
          })
        }
        setActiveApps(active)
      }
    } catch (error) {
      console.error('Error loading time data:', error)
    }
  }

  const handleLaunchApp = async (app: Application) => {
    try {
      const electronAPI = (window as any).electronAPI
      const result = await electronAPI.timecard.launchApp(
        app.name,
        app.executable || app.path
      )
      
      if (result.success) {
        // Add to active apps
        setActiveApps(prev => new Set(prev).add(app.name))
        
        // Reload time data after a short delay
        setTimeout(() => {
          loadTimeData()
        }, 1000)
      } else {
        alert(`Failed to launch ${app.name}: ${result.error}`)
      }
    } catch (error) {
      console.error('Error launching app:', error)
      alert(`Failed to launch ${app.name}`)
    }
  }

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const getCategoryDisplayName = (category: string) => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const getAppIcon = (appName: string) => {
    // Placeholder for app icons - in a real app, these would be loaded from system or bundled
    // For now we use a consistent generic style
    const initials = appName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    return initials.substring(0, 2)
  }

  // Group applications by category
  const groupedApps = applications.reduce((acc, app) => {
    const category = app.category || 'Other'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(app)
    return acc
  }, {} as Record<string, Application[]>)

  const categories = Object.keys(groupedApps).sort()

  const filteredCategories = selectedCategory
    ? [selectedCategory]
    : categories

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading your workspace...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Time Card</h1>
            <p className="text-gray-500">Track and manage your application usage</p>
          </div>
          
          <div className="flex items-center gap-3">
             <button
              onClick={loadApplications}
              disabled={scanning}
              className={`flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm text-sm font-medium ${scanning ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {scanning ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700 mr-2"></div>
                  Scanning...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Apps
                </>
              )}
            </button>
          </div>
        </div>

        {/* Stats Summary Cards */}
        {timeData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-center">
              <div className="p-3 rounded-full bg-blue-50 text-blue-600 mr-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Total Apps</p>
                <p className="text-2xl font-bold text-gray-900">{applications.length}</p>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-center">
              <div className="p-3 rounded-full bg-green-50 text-green-600 mr-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Total Tracked Time</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatTime(
                    Object.values(timeData.totalTime || {}).reduce((sum, time) => sum + time, 0)
                  )}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-center">
              <div className={`p-3 rounded-full mr-4 ${activeApps.size > 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-400'}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Active Sessions</p>
                <p className={`text-2xl font-bold ${activeApps.size > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>
                  {activeApps.size}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Active Sessions Banner */}
        {activeApps.size > 0 && timeData?.activeSessions && timeData.activeSessions.length > 0 && (
          <div className="mb-10 bg-white rounded-xl shadow-sm border border-indigo-100 overflow-hidden">
            <div className="bg-indigo-50 px-6 py-3 border-b border-indigo-100 flex justify-between items-center">
              <h2 className="text-sm font-semibold text-indigo-900 uppercase tracking-wider flex items-center">
                <span className="w-2 h-2 rounded-full bg-indigo-500 mr-2 animate-pulse"></span>
                Now Tracking
              </h2>
              <span className="text-xs font-medium text-indigo-600 bg-white px-2 py-1 rounded-full border border-indigo-100">
                {activeApps.size} Running
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {timeData.activeSessions.map(session => (
                <div
                  key={session.appName}
                  className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm mr-4 shadow-sm">
                      {getAppIcon(session.appName)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{session.appName}</p>
                      <p className="text-xs text-gray-500 flex items-center mt-1">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Started at {new Date(session.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="block text-xl font-bold text-gray-900 tabular-nums tracking-tight">
                        {formatTime(session.currentDuration)}
                      </span>
                      <span className="text-xs text-green-600 font-medium">Active</span>
                    </div>
                    <button
                      onClick={async () => {
                        const electronAPI = (window as any).electronAPI
                        await electronAPI.timecard.stopTracking(session.appName)
                        loadTimeData()
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                      title="Stop Tracking"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Categories Navigation */}
        <div className="mb-8 overflow-x-auto pb-2 scrollbar-hide">
          <div className="flex space-x-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === null
                  ? 'bg-gray-900 text-white shadow-md transform scale-105'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              All Categories
            </button>
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === category
                    ? 'bg-gray-900 text-white shadow-md transform scale-105'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {getCategoryDisplayName(category)}
              </button>
            ))}
          </div>
        </div>

        {/* Applications Grid */}
        {filteredCategories.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No applications found</h3>
            <p className="mt-1 text-sm text-gray-500">Click refresh to scan for installed applications.</p>
            <div className="mt-6">
              <button
                onClick={loadApplications}
                disabled={scanning}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Scan Applications
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {filteredCategories.map(category => (
              <div key={category}>
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <span className="w-1 h-5 bg-blue-500 rounded-full mr-3"></span>
                  {getCategoryDisplayName(category)}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {groupedApps[category].map(app => {
                    const appTime = timeData?.totalTime[app.name] || 0
                    const isActive = activeApps.has(app.name)
                    
                    return (
                      <div
                        key={app.name}
                        onClick={() => handleLaunchApp(app)}
                        className={`group bg-white rounded-xl border transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col h-full ${
                          isActive 
                            ? 'border-indigo-200 ring-1 ring-indigo-200 shadow-md' 
                            : 'border-gray-100 hover:border-gray-300 hover:shadow-md'
                        }`}
                      >
                        {isActive && (
                          <div className="absolute top-0 right-0 -mt-1 -mr-1 w-3 h-3 bg-indigo-500 rounded-full animate-pulse"></div>
                        )}
                        
                        <div className="p-5 flex flex-col h-full">
                          <div className="flex items-start justify-between mb-4">
                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm ${
                              isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200 transition-colors'
                            }`}>
                              {getAppIcon(app.name)}
                            </div>
                            {isActive ? (
                              <span className="px-2 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-md border border-indigo-100">
                                Active
                              </span>
                            ) : appTime > 0 ? (
                              <span className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50 rounded-md">
                                History
                              </span>
                            ) : null}
                          </div>
                          
                          <div className="mb-4 flex-grow">
                            <h3 className="font-semibold text-gray-900 text-base mb-1 line-clamp-1" title={app.name}>
                              {app.name}
                            </h3>
                            <p className="text-xs text-gray-500 line-clamp-1" title={app.path}>
                              {app.executable ? 'Executable found' : 'Path detected'}
                            </p>
                          </div>
                          
                          <div className="pt-4 border-t border-gray-50 mt-auto">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-medium text-gray-500">Total Time</span>
                              <span className="text-sm font-bold text-gray-900">{formatTime(appTime)}</span>
                            </div>
                            
                            <button
                              className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center ${
                                isActive
                                  ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                  : 'bg-gray-900 text-white hover:bg-gray-800 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleLaunchApp(app)
                              }}
                            >
                              {isActive ? (
                                <>
                                  <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2 animate-pulse"></span>
                                  Running
                                </>
                              ) : (
                                <>
                                  Launch App
                                  <svg className="w-3.5 h-3.5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
