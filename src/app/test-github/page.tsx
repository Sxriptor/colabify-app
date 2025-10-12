'use client'

import { useState } from 'react'

export default function TestGitHubToken() {
  const [output, setOutput] = useState<string[]>([])

  const log = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    const prefix = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'
    setOutput(prev => [...prev, `[${timestamp}] ${prefix} ${message}`])
  }

  const clearOutput = () => setOutput([])

  const checkToken = async () => {
    try {
      if (typeof window === 'undefined' || !(window as any).electronAPI) {
        log('Not in Electron environment', 'error')
        return
      }

      const hasToken = await (window as any).electronAPI.hasGitHubToken()
      
      if (hasToken) {
        log('GitHub token EXISTS in keychain', 'success')
      } else {
        log('No GitHub token found', 'error')
        log('Please sign in with GitHub to store a token', 'info')
      }
    } catch (error: any) {
      log(`Error: ${error.message}`, 'error')
    }
  }

  const getToken = async () => {
    try {
      if (typeof window === 'undefined' || !(window as any).electronAPI) {
        log('Not in Electron environment', 'error')
        return
      }

      const token = await (window as any).electronAPI.getGitHubToken()
      
      if (token) {
        const masked = token.substring(0, 4) + '...' + token.substring(token.length - 4)
        log(`Token retrieved: ${masked}`, 'success')
        log(`Token length: ${token.length} characters`, 'info')
        log(`Token prefix: ${token.substring(0, 4)}`, 'info')
      } else {
        log('No token found', 'error')
      }
    } catch (error: any) {
      log(`Error: ${error.message}`, 'error')
    }
  }

  const testGitHubAPI = async () => {
    try {
      if (typeof window === 'undefined' || !(window as any).electronAPI) {
        log('Not in Electron environment', 'error')
        return
      }

      log('Fetching GitHub token...', 'info')
      const token = await (window as any).electronAPI.getGitHubToken()
      
      if (!token) {
        log('No GitHub token available', 'error')
        return
      }

      log('Token retrieved, testing GitHub API...', 'success')
      
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      })

      log(`GitHub API Response: ${response.status} ${response.statusText}`, 'info')
      
      if (response.ok) {
        const data = await response.json()
        log('GitHub API SUCCESS!', 'success')
        log(`Authenticated as: ${data.login}`, 'success')
        log(`Name: ${data.name}`, 'info')
        log(`Public repos: ${data.public_repos}`, 'info')
        log(`Rate limit: ${response.headers.get('x-ratelimit-remaining')}/${response.headers.get('x-ratelimit-limit')}`, 'info')
      } else {
        const errorText = await response.text()
        log(`GitHub API Error: ${errorText}`, 'error')
        
        if (response.status === 401) {
          log('Token is invalid or expired', 'error')
        } else if (response.status === 403) {
          log('Rate limit exceeded or insufficient permissions', 'error')
        }
      }
    } catch (error: any) {
      log(`Error: ${error.message}`, 'error')
    }
  }

  return (
    <div className="min-h-screen bg-black text-green-400 p-8 font-mono">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">GITHUB.TOKEN.TEST</h1>
        <p className="text-gray-500 mb-8">Testing GitHub token integration</p>

        <div className="flex gap-2 mb-6">
          <button
            onClick={checkToken}
            className="bg-green-400 text-black px-4 py-2 hover:bg-green-300 transition-colors"
          >
            1. CHECK TOKEN
          </button>
          <button
            onClick={getToken}
            className="bg-green-400 text-black px-4 py-2 hover:bg-green-300 transition-colors"
          >
            2. GET TOKEN
          </button>
          <button
            onClick={testGitHubAPI}
            className="bg-green-400 text-black px-4 py-2 hover:bg-green-300 transition-colors"
          >
            3. TEST API
          </button>
          <button
            onClick={clearOutput}
            className="bg-gray-700 text-white px-4 py-2 hover:bg-gray-600 transition-colors ml-auto"
          >
            CLEAR
          </button>
        </div>

        <div className="border border-green-400 p-4 bg-gray-900 min-h-[400px]">
          {output.length === 0 ? (
            <p className="text-gray-600">Click buttons above to test...</p>
          ) : (
            <div className="space-y-1">
              {output.map((line, i) => (
                <div key={i} className="text-sm">
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 border border-gray-700 p-4 bg-gray-900">
          <h2 className="text-xl font-bold mb-4">MANUAL.CONSOLE.TESTS</h2>
          <p className="text-gray-400 mb-4">Open DevTools and run these commands:</p>
          
          <div className="space-y-4">
            <div>
              <p className="text-gray-500 mb-1">// Check if token exists</p>
              <code className="block bg-black p-2 border border-gray-700">
                await window.electronAPI.hasGitHubToken()
              </code>
            </div>

            <div>
              <p className="text-gray-500 mb-1">// Get token</p>
              <code className="block bg-black p-2 border border-gray-700">
                await window.electronAPI.getGitHubToken()
              </code>
            </div>

            <div>
              <p className="text-gray-500 mb-1">// Test GitHub API</p>
              <code className="block bg-black p-2 border border-gray-700 text-xs">
                {`const token = await window.electronAPI.getGitHubToken()
const res = await fetch('https://api.github.com/user', {
  headers: { 'Authorization': \`Bearer \${token}\` }
})
const user = await res.json()
console.log('User:', user.login)`}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
