import { useState, useEffect } from 'react'
import { GitHubBranch, GitHubCommit, LocalUserLocation, DataSource, GitHubDataSource } from '../types'
import * as dataFetchers from '../dataFetchers'

export function useRepositoryData(isOpen: boolean, project: any) {
  const [loading, setLoading] = useState(false)
  const [branches, setBranches] = useState<GitHubBranch[]>([])
  const [commits, setCommits] = useState<GitHubCommit[]>([])
  const [localUsers, setLocalUsers] = useState<LocalUserLocation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dataSource, setDataSource] = useState<DataSource>('mock')
  const [githubConnected, setGithubConnected] = useState<boolean>(false)
  const [githubDataSource, setGithubDataSource] = useState<GitHubDataSource>('disconnected')

  useEffect(() => {
    if (isOpen && project?.repositories?.length > 0) {
      checkGitHubConnection()
      fetchRepositoryData()

      // Set up real-time Git event listener
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const electronAPI = (window as any).electronAPI

        const handleGitEvent = (event: any) => {
          console.log('📡 Received Git event in visualization:', event)

          if (event.projectId === project.id) {
            fetchRepositoryData()
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
  }, [isOpen, project])

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

  const fetchRepositoryData = async () => {
    setLoading(true)
    setError(null)

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
        console.log('📊 All branches data:', allBranches)
        setBranches(allBranches)
        setDataSource('backend')
        console.log(`✅ Using real Git data from ${allBranches.length} stored repositories`)

        // Generate commits from complete history if available
        const allCommits: any[] = []
        for (const branch of allBranches) {
          if (branch.history && branch.history.commits) {
            const historyCommits = await dataFetchers.generateCommitsFromHistory(branch.history)
            allCommits.push(...historyCommits)
          }
        }

        // If we have commits from history, use them; otherwise fall back to generated data
        if (allCommits.length > 0) {
          setCommits(allCommits)
          console.log(`✅ Using ${allCommits.length} commits from complete Git history`)
        } else {
          const realCommits = await dataFetchers.generateCommitsFromRealData(allBranches)
          setCommits(realCommits)
        }

        const realUsers = await dataFetchers.generateUsersFromRealData(allBranches)
        setLocalUsers(realUsers)
      }
      
      console.log('🔍 Attempting to fetch GitHub data for Remote tab...')
      if (project.repositories?.[0]?.url) {
        try {
          const repo = project.repositories[0]
          const urlParts = repo.url.replace('https://github.com/', '').split('/')
          const owner = urlParts[0]
          const repoName = urlParts[1]?.replace(/\.git$/, '')

          if (owner && repoName) {
            console.log(`📡 Fetching GitHub branches for ${owner}/${repoName}`)
            await dataFetchers.fetchGitHubBranches(owner, repoName, setGithubDataSource, setError)
          } else {
            console.warn('⚠️ Could not parse owner/repo from URL:', repo.url)
            setGithubDataSource('disconnected')
          }
        } catch (githubError) {
          console.error('❌ Error fetching GitHub data:', githubError)
          setGithubDataSource('disconnected')
        }
      } else {
        console.log('⚠️ No remote repository URL configured')
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
      setLoading(false)
    }
  }

  return {
    loading,
    branches,
    commits,
    localUsers,
    error,
    dataSource,
    githubConnected,
    githubDataSource,
    fetchRepositoryData
  }
}
