'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'

interface AddLocalFolderModalProps {
  isOpen: boolean
  onClose: () => void
  repositoryId: string
  projectId: string
  repositoryName: string
  onSuccess: () => void
}

export function AddLocalFolderModal({ 
  isOpen, 
  onClose, 
  repositoryId, 
  projectId, 
  repositoryName, 
  onSuccess 
}: AddLocalFolderModalProps) {
  const { user } = useAuth()
  const [selectedFolders, setSelectedFolders] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isElectron, setIsElectron] = useState(false)

  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && (window as any).electronAPI?.isElectron === true)
  }, [])

  const handleFolderSelection = async () => {
    if (!isElectron) {
      setError('Folder selection is only available in the desktop app')
      return
    }

    try {
      const electronAPI = (window as any).electronAPI
      console.log('📁 AddLocalFolderModal: Calling selectFolder')
      console.log('📁 electronAPI available methods:', Object.keys(electronAPI))
      
      const result = await electronAPI.selectFolder()
      console.log('📁 AddLocalFolderModal: selectFolder result:', result)
      
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
      setError(err instanceof Error ? err.message : 'Failed to add local folders')
      console.error('Local folder mapping error:', err)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
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
              Add Local Folders
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

          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-700 mb-3">
                Select the local folder(s) where <strong>{repositoryName}</strong> is cloned on your computer:
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
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
          >
            Cancel
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={loading || selectedFolders.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Adding...
              </>
            ) : (
              'Add Folders'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}