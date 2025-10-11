'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'

interface ConnectRepositoryModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  onSuccess: () => void
  hasExistingRepositories?: boolean
}

export function ConnectRepositoryModal({ isOpen, onClose, projectId, onSuccess, hasExistingRepositories = false }: ConnectRepositoryModalProps) {
  const { user } = useAuth()
  const [step, setStep] = useState<'url' | 'folder'>('url')
  const [githubUrl, setGithubUrl] = useState('')
  const [selectedFolders, setSelectedFolders] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isElectron, setIsElectron] = useState(false)

  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && (window as any).electronAPI?.isElectron === true)
  }, [])

  const validateGithubUrl = (url: string) => {
    const githubRegex = /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(\.git)?\/?$/
    return githubRegex.test(url)
  }

  const handleUrlSubmit = () => {
    if (!githubUrl.trim()) {
      setError('Please enter a GitHub repository URL')
      return
    }

    if (!validateGithubUrl(githubUrl)) {
      setError('Please enter a valid GitHub repository URL (e.g., https://github.com/owner/repo)')
      return
    }

    setError(null)
    setStep('folder')
  }

  const handleFolderSelection = async () => {
    if (!isElectron) {
      setError('Folder selection is only available in the desktop app')
      return
    }

    try {
      const electronAPI = (window as any).electronAPI
      console.log('📁 ConnectRepositoryModal: Calling selectFolder')
      console.log('📁 electronAPI available methods:', Object.keys(electronAPI))
      
      const result = await electronAPI.selectFolder()
      console.log('📁 ConnectRepositoryModal: selectFolder result:', result)
      
      if (result.success && result.folderPath) {
        if (!selectedFolders.includes(result.folderPath)) {
          setSelectedFolders([...selectedFolders, result.folderPath])
        }
      } else if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to open folder selector')
      console.error('❌ Folder selection error:', err)
    }
  }

  const removeFolderPath = (pathToRemove: string) => {
    setSelectedFolders(selectedFolders.filter(path => path !== pathToRemove))
  }

  const handleSubmit = async () => {
    if (selectedFolders.length === 0) {
      setError('Please select at least one local folder')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Import dynamically to avoid SSR issues
      const { createElectronClient } = await import('@/lib/supabase/electron-client')
      const supabase = await createElectronClient()

      // Extract repository info from GitHub URL
      const cleanUrl = githubUrl.replace('https://github.com/', '').replace(/\/$/, '').replace(/\.git$/, '')
      const urlParts = cleanUrl.split('/')
      const owner = urlParts[0]
      const repoName = urlParts[1]
      const fullName = `${owner}/${repoName}`

      console.log('🔍 Repository info:', { owner, repoName, fullName, originalUrl: githubUrl, cleanUrl })

      // First, create or get the repository record
      console.log('🔍 Checking for existing repository...')
      const { data: existingRepo, error: checkError } = await supabase
        .from('repositories')
        .select('id')
        .eq('full_name', fullName)
        .eq('project_id', projectId)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('❌ Error checking existing repository:', checkError)
        throw checkError
      }

      let repositoryId: string

      if (existingRepo) {
        console.log('✅ Found existing repository:', existingRepo.id)
        repositoryId = existingRepo.id
      } else {
        // Create new repository record
        console.log('🆕 Creating new repository record...')
        
        // Try with minimal data first
        let repositoryData: any = {
          project_id: projectId,
          name: repoName,
          full_name: fullName,
          url: githubUrl,
          owner: owner
        }
        console.log('📝 Repository data (attempt 1):', repositoryData)

        let { data: newRepo, error: repoError } = await supabase
          .from('repositories')
          .insert(repositoryData)
          .select('id')
          .single()

        // If it fails due to github_id constraint, try with github_id set to null
        if (repoError && repoError.message?.includes('github_id')) {
          console.log('🔄 Retrying with github_id set to null...')
          repositoryData = {
            ...repositoryData,
            github_id: null
          }
          console.log('📝 Repository data (attempt 2):', repositoryData)

          const result = await supabase
            .from('repositories')
            .insert(repositoryData)
            .select('id')
            .single()
          
          newRepo = result.data
          repoError = result.error
        }

        if (repoError) {
          console.error('❌ Error creating repository:', repoError)
          throw repoError
        }
        
        if (!newRepo) {
          throw new Error('Failed to create repository - no data returned')
        }
        
        console.log('✅ Created new repository:', newRepo.id)
        repositoryId = newRepo.id
      }

      // Create local folder mappings for each selected folder
      const folderMappings = selectedFolders.map(folderPath => ({
        repository_id: repositoryId,
        user_id: user?.id,
        local_path: folderPath,
        project_id: projectId
      }))

      const { error: mappingError } = await supabase
        .from('repository_local_mappings')
        .insert(folderMappings)

      if (mappingError) throw mappingError

      onSuccess()
      onClose()
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect repository')
      console.error('Repository connection error:', err)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setStep('url')
    setGithubUrl('')
    setSelectedFolders([])
    setError(null)
  }

  const handleClose = () => {
    if (!loading) {
      resetForm()
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">
              {step === 'url' 
                ? (hasExistingRepositories ? 'Change Repository' : 'Connect Repository')
                : 'Select Local Folders'
              }
            </h2>
            <button
              onClick={handleClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {step === 'url' && (
            <div className="space-y-4">
              {hasExistingRepositories && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex">
                    <svg className="w-5 h-5 text-yellow-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <p className="text-sm text-yellow-800">
                        <strong>Note:</strong> Changing the repository will add a new repository to this project. 
                        Existing local folder mappings will remain linked to the previous repository.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div>
                <label htmlFor="github-url" className="block text-sm font-medium text-gray-700 mb-2">
                  GitHub Repository URL
                </label>
                <input
                  type="url"
                  id="github-url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/owner/repository"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {hasExistingRepositories 
                    ? 'Enter the GitHub URL of the new repository to add to this project'
                    : 'Enter the full GitHub URL of the repository you want to connect'
                  }
                </p>
              </div>
            </div>
          )}

          {step === 'folder' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-700 mb-3">
                  Select the local folder(s) where this repository is cloned on your computer:
                </p>
                
                <button
                  onClick={handleFolderSelection}
                  disabled={!isElectron}
                  className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-gray-400 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isElectron ? (
                    <>
                      <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Select Folder
                    </>
                  ) : (
                    'Folder selection only available in desktop app'
                  )}
                </button>

                {/* Test button for debugging */}
                {isElectron && (
                  <button
                    onClick={async () => {
                      try {
                        const electronAPI = (window as any).electronAPI
                        const result = await electronAPI.testFolderSelection()
                        console.log('🧪 Test result:', result)
                        alert('Test successful: ' + JSON.stringify(result))
                      } catch (err) {
                        console.error('🧪 Test failed:', err)
                        alert('Test failed: ' + (err instanceof Error ? err.message : String(err)))
                      }
                    }}
                    className="mt-2 w-full px-4 py-2 bg-yellow-100 border border-yellow-300 rounded-md text-yellow-800 text-sm"
                  >
                    Test IPC Connection
                  </button>
                )}

                {selectedFolders.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-medium text-gray-700">Selected folders:</p>
                    {selectedFolders.map((folderPath, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                        <span className="text-sm text-gray-700 truncate flex-1" title={folderPath}>
                          {folderPath}
                        </span>
                        <button
                          onClick={() => removeFolderPath(folderPath)}
                          className="ml-2 text-red-500 hover:text-red-700"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          {step === 'folder' && (
            <button
              onClick={() => setStep('url')}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
            >
              Back
            </button>
          )}
          
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
          >
            Cancel
          </button>
          
          <button
            onClick={step === 'url' ? handleUrlSubmit : handleSubmit}
            disabled={loading || (step === 'url' && !githubUrl.trim()) || (step === 'folder' && selectedFolders.length === 0)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              </>
            ) : step === 'url' ? (
              'Next'
            ) : (
              hasExistingRepositories ? 'Change Repository' : 'Connect Repository'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}