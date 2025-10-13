import { useState, useEffect, useMemo } from 'react'
import { GitHubBranch, GitHubCommit, LocalUserLocation, DataSource, GitHubDataSource } from '../types'
import * as dataFetchers from '../dataFetchers'

export function useRepositoryData(isOpen: boolean, project: any, activeTab?: string) {
  const [loading, setLoading] = useState(false)
  const [branches, setBranches] = useState<GitHubBranch[]>([])
  const [commits, setCommits] = useState<GitHubCommit[]>([])
  const [localUsers, setLocalUsers] = useState<LocalUserLocation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dataSource, setDataSource] = useState<DataSource>('mock')
  const [githubConnected, setGithubConnected] = useState<boolean>(false)
  const [githubDataSource, setGithubDataSource] = useState<GitHubDataSource>('disconnected')
  
  // Add state to track last data hash to prevent unnecessary updates
  const [lastDataHash, setLastDataHash] = useState<string>('')
  const [isBackgroundCheck, setIsBackgroundCheck] = useState(false)
  const [lastCheckTime, setLastCheckTime] = useState<number>(0)

  useEffect(() => {
    if (isOpen && project?.repositories?.length > 0) {
      // Only check GitHub connection if we're on the remote tab
      if (activeTab === 'remote') {
        checkGitHubConnection()
      }
      fetchRepositoryData()

      // Set up real-time Git event listener
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const electronAPI = (window as any).electronAPI

        const handleGitEvent = (event: any) => {
          console.log('📡 Received Git event in visualization:', event)

          if (event.projectId === project.id) {
            // Filter out test events that don't represent real changes
            const testEventTypes = ['COMMIT', 'PUSH', 'REMOTE_UPDATE', 'BRANCH_SWITCH']
            if (event.details?.isTest || 
                event.type?.includes('test') || 
                event.type?.includes('TEST') ||
                (testEventTypes.includes(event.type) && event.details?.source === 'test')) {
              console.log(`🧪 Ignoring test event (${event.type}) - no real changes occurred`)
              return
            }
            
            // Do a background check without showing loading state
            checkForDataChanges()
          }
        }

        if (electronAPI.git) {
          electronAPI.git.onEvent(handleGitEvent)
        }

        return () => {
          if (electronAPI.git) {
            electronAPI.git.removeEventListeners()
          }
        }
      }
    }
  }, [isOpen, project, activeTab])

  // Function to create a comprehensive hash of the data for comparison
  const createDataHash = (data: any) => {
    try {
      // Create a stable representation of the data, excluding timestamps and volatile fields
      const stableData = {
        branches: data.branches?.map((b: any) => ({ 
          name: b.name, 
          head: b.head, 
          branch: b.branch,
          dirty: b.dirty,
          ahead: b.ahead,
          behind: b.behind,
          localBranches: b.localBranches?.sort() || [],
          remoteBranches: b.remoteBranches?.sort() || [],
          path: b.path
          // Exclude lastChecked and other timestamp fields that change on every read
        })).sort((a: any, b: any) => a.name.localeCompare(b.name)),
        commits: data.commits?.map((c: any) => ({
          sha: c.sha,
          message: c.commit?.message,
          author: c.commit?.author?.name
          // Exclude date as it might be generated with current timestamp
        })).sort((a: any, b: any) => a.sha.localeCompare(b.sha)),
        users: data.users?.map((u: any) => ({
          userId: u.userId,
          userName: u.userName,
          currentBranch: u.currentBranch,
          localPath: u.localPath,
          commitsToday: u.commitsToday
        })).sort((a: any, b: any) => a.userId.localeCompare(b.userId))
      }
      
      const dataString = JSON.stringify(stableData, null, 0)
      
      // Simple hash function
      let hash = 0
      for (let i = 0; i < dataString.length; i++) {
        const char = dataString.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32-bit integer
      }
      return hash.toString()
    } catch (error) {
      console.warn('Error creating data hash:', error)
      return Date.now().toString()
    }
  }

  const checkGitHubConnection = async () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      try {
        const hasToken = await (window as any).electronAPI.hasGitHubToken()
        setGithubConnected(hasToken)
        console.log('🔍 GitHub connection status:', hasToken ? 'Connected' : 'Disconnected')
      } catch (error) {
        console.log('⚠️ Could not check GitHub connection:', error)
        setGithubConnected(false)
      }
    }
  }

  const checkForDataChanges = async () => {
    const now = Date.now()
    const timeSinceLastCheck = now - lastCheckTime
    
    // Debounce: only check if it's been at least 2 seconds since last check
    if (timeSinceLastCheck < 2000) {
      console.log('🔍 Skipping background check - too soon since last check')
      return
    }
    
    console.log('🔍 Checking for data changes in background...')
    setLastCheckTime(now)
    setIsBackgroundCheck(true)
    await fetchRepositoryData(true) // Pass true for background check
    setIsBackgroundCheck(false)
  }

  const fetchRepositoryData = async (backgroundCheck = false) => {
    if (!backgroundCheck) {
      setLoading(true)
      setError(null)
    }

    try {
      if (typeof window === 'undefined' || !(window as any).electronAPI) {
        console.log('🔍 Not in Electron environment, using mock data')
        await dataFetchers.fetchMockBranches(setBranches)
        await dataFetchers.fetchMockCommits(setCommits)
        await dataFetchers.fetchMockUsers(setLocalUsers)
        setDataSource('mock')
        return
      }

      const electronAPI = (window as any).electronAPI
      const localMappings = project.repositories?.[0]?.local_mappings || []
      console.log('📂 Using stored local repository mappings:', localMappings)

      if (localMappings.length === 0) {
        console.log('⚠️ No local repository mappings found, using mock data')
        await dataFetchers.fetchMockBranches(setBranches)
        await dataFetchers.fetchMockCommits(setCommits)
        await dataFetchers.fetchMockUsers(setLocalUsers)
        setDataSource('mock')
        return
      }

      if (!electronAPI.git) {
        console.log('❌ Git API not available, using mock data with stored paths')
        await dataFetchers.fetchMockBranches(setBranches)
        await dataFetchers.fetchMockCommits(setCommits)
        await dataFetchers.fetchMockUsers(setLocalUsers)
        setDataSource('mock')
        return
      }

      console.log(`📂 Processing ${localMappings.length} stored repository mappings`)

      const allBranches: any[] = []

      for (const mapping of localMappings) {
        try {
          console.log(`📚 Reading complete Git history from: ${mapping.local_path}`)
          const history = await dataFetchers.readCompleteGitHistory(mapping.local_path)

          if (history) {
            // If we got complete history, use it
            if (history.commits && history.commits.length > 0) {
              allBranches.push({
                name: history.repoPath?.split('/').pop() || 'Unknown',
                path: mapping.local_path,
                branch: history.commits[0]?.branches?.[0] || 'main',
                head: history.commits[0]?.sha || 'unknown',
                dirty: false,
                ahead: 0,
                behind: 0,
                localBranches: history.branches?.filter((b: any) => b.isLocal).map((b: any) => b.name) || [],
                remoteBranches: history.branches?.filter((b: any) => b.isRemote).map((b: any) => b.name) || [],
                remoteUrls: history.remotes || {},
                lastChecked: history.readAt,
                user: mapping.user,
                id: `local-${mapping.id || Date.now()}`,
                history: history // Store complete history
              })
              console.log(`✅ Read ${history.commits.length} commits from ${mapping.local_path}`)
            } else {
              // Fallback to basic Git data
              const gitData = await dataFetchers.readGitDataFromPath(mapping.local_path)
              if (gitData) {
                allBranches.push({
                  ...gitData,
                  path: mapping.local_path,
                  user: mapping.user,
                  id: `local-${mapping.id || Date.now()}`
                })
                console.log(`✅ Successfully read basic Git data from ${mapping.local_path}`)
              }
            }
          } else {
            console.warn(`⚠️ No Git data returned from ${mapping.local_path}`)
          }
        } catch (repoError) {
          console.warn(`❌ Failed to read Git data from ${mapping.local_path}:`, repoError)
        }
      }

      if (allBranches.length > 0) {
        // Generate commits from complete history if available
        const allCommits: any[] = []
        for (const branch of allBranches) {
          if (branch.history && branch.history.commits) {
            const historyCommits = await dataFetchers.generateCommitsFromHistory(branch.history)
            allCommits.push(...historyCommits)
          }
        }

        // If we have commits from history, use them; otherwise fall back to generated data
        const finalCommits = allCommits.length > 0 ? allCommits : await dataFetchers.generateCommitsFromRealData(allBranches)
        const realUsers = await dataFetchers.generateUsersFromRealData(allBranches)

        // Create hash of new data
        const newDataHash = createDataHash({
          branches: allBranches,
          commits: finalCommits,
          users: realUsers
        })

        // Debug logging for hash comparison
        if (backgroundCheck) {
          console.log(`🔍 Hash comparison - Previous: ${lastDataHash}, New: ${newDataHash}, Changed: ${newDataHash !== lastDataHash}`)
        }

        // Only update state if data has actually changed
        if (newDataHash !== lastDataHash || !backgroundCheck) {
          if (backgroundCheck && newDataHash !== lastDataHash) {
            console.log('🔄 Data changed - updating UI')
          } else if (!backgroundCheck) {
            console.log('🔄 Initial load or manual refresh - updating UI')
          }
          
          if (!backgroundCheck) {
            console.log('📊 All branches data:', allBranches)
          }
          setBranches(allBranches)
          setCommits(finalCommits)
          setLocalUsers(realUsers)
          setDataSource('backend')
          setLastDataHash(newDataHash)
          
          console.log(`✅ Using real Git data from ${allBranches.length} stored repositories`)
          if (finalCommits.length > 0) {
            console.log(`✅ Using ${finalCommits.length} commits from ${allCommits.length > 0 ? 'complete Git history' : 'generated data'}`)
          }
        } else if (backgroundCheck) {
          console.log('✅ No data changes detected - skipping UI update')
        }
      }
      
      // Only fetch GitHub data if we're on the remote tab
      if (activeTab === 'remote') {
        console.log('🔍 Attempting to fetch GitHub data for Remote tab...')
        
        // Try to get GitHub repo info from local Git remotes first
        let githubOwner = null
        let githubRepo = null
        
        for (const branch of allBranches) {
          if (branch.remoteUrls) {
            const originUrl = branch.remoteUrls.origin || Object.values(branch.remoteUrls)[0]
            if (originUrl && typeof originUrl === 'string') {
              try {
                let cleanUrl = originUrl
                if (cleanUrl.startsWith('git@github.com:')) {
                  cleanUrl = cleanUrl.replace('git@github.com:', 'https://github.com/')
                }
                if (cleanUrl.includes('github.com')) {
                  const match = cleanUrl.match(/github\.com[\/:]([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/)?$/)
                  if (match) {
                    githubOwner = match[1]
                    githubRepo = match[2]
                    break
                  }
                }
              } catch (error) {
                console.warn('Failed to parse Git remote URL:', originUrl, error)
              }
            }
          }
        }
        
        // Fallback to project configuration if no remote found
        if (!githubOwner || !githubRepo) {
          if (project.repositories?.[0]?.url) {
            try {
              const repo = project.repositories[0]
              const urlParts = repo.url.replace('https://github.com/', '').replace(/\.git$/, '').split('/')
              githubOwner = urlParts[0]
              githubRepo = urlParts[1]
            } catch (error) {
              console.warn('⚠️ Could not parse owner/repo from project URL:', project.repositories[0].url)
            }
          }
        }

        if (githubOwner && githubRepo) {
          try {
            console.log(`📡 Fetching GitHub branches for ${githubOwner}/${githubRepo}`)
            await dataFetchers.fetchGitHubBranches(githubOwner, githubRepo, setGithubDataSource, setError)
          } catch (githubError) {
            console.error('❌ Error fetching GitHub data:', githubError)
            setGithubDataSource('disconnected')
          }
        } else {
          console.log('⚠️ No GitHub repository information found')
          setGithubDataSource('disconnected')
        }
      } else {
        console.log('📍 Local tab active - skipping GitHub API calls')
        setGithubDataSource('disconnected')
      }
      
      if (allBranches.length === 0) {
        console.log(`⚠️ No Git data could be read, falling back to mock data`)
        await dataFetchers.fetchMockBranches(setBranches)
        await dataFetchers.fetchMockCommits(setCommits)
        await dataFetchers.fetchMockUsers(setLocalUsers)
        setDataSource('mock')

        if (project.repositories?.[0]?.url) {
          try {
            const repo = project.repositories[0]
            const urlParts = repo.url.replace('https://github.com/', '').split('/')
            const owner = urlParts[0]
            const repoName = urlParts[1]?.replace(/\.git$/, '')

            if (owner && repoName) {
              await dataFetchers.fetchGitHubBranches(owner, repoName, setGithubDataSource, setError)
            }
          } catch (githubError) {
            console.log('GitHub API not available, using backend data only')
          }
        }
      }

    } catch (err) {
      console.error('Error fetching repository data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch repository data')

      await dataFetchers.fetchMockBranches(setBranches)
      await dataFetchers.fetchMockCommits(setCommits)
      await dataFetchers.fetchMockUsers(setLocalUsers)
      setDataSource('mock')
    } finally {
      if (!backgroundCheck) {
        setLoading(false)
      }
    }
  }

  // Create stable memoized versions of the data to prevent unnecessary re-renders
  const stableBranches = useMemo(() => branches, [JSON.stringify(branches.map(b => ({
    name: b.name,
    head: b.head,
    branch: b.branch,
    dirty: b.dirty,
    ahead: b.ahead,
    behind: b.behind,
    localBranches: b.localBranches,
    remoteBranches: b.remoteBranches,
    path: b.path
  })))])

  const stableCommits = useMemo(() => commits, [JSON.stringify(commits.map(c => ({
    sha: c.sha,
    message: c.commit?.message,
    author: c.commit?.author?.name,
    email: c.commit?.author?.email,
    date: c.commit?.author?.date,
    additions: c.stats?.additions || 0,
    deletions: c.stats?.deletions || 0
  })))])

  const stableLocalUsers = useMemo(() => localUsers, [JSON.stringify(localUsers.map(u => ({
    userId: u.userId,
    userName: u.userName,
    userEmail: u.userEmail,
    localPath: u.localPath,
    currentBranch: u.currentBranch,
    status: u.status,
    commitsToday: u.commitsToday
  })))])

  return {
    loading,
    branches: stableBranches,
    commits: stableCommits,
    localUsers: stableLocalUsers,
    error,
    dataSource,
    githubConnected,
    githubDataSource,
    fetchRepositoryData
  }
}
