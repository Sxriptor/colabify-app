export const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

  if (diffInHours < 1) return 'Just now'
  if (diffInHours < 24) return `${diffInHours}h ago`
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays}d ago`
  return date.toLocaleDateString()
}

export const getLocalRepositoryInfo = (repoConfig: any, project: any) => {
  const pathToUse = repoConfig.path || ''
  const folderName = pathToUse.split('/').pop() || pathToUse.split('\\').pop() || 'Unknown'

  let ownerName = 'local'
  if (repoConfig.remoteUrls) {
    const originUrl = repoConfig.remoteUrls.origin || Object.values(repoConfig.remoteUrls)[0]
    if (originUrl && typeof originUrl === 'string') {
      try {
        let cleanUrl = originUrl
        if (cleanUrl.startsWith('git@github.com:')) {
          cleanUrl = cleanUrl.replace('git@github.com:', 'https://github.com/')
        }
        if (cleanUrl.includes('github.com')) {
          const match = cleanUrl.match(/github\.com[\/:]([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/)?$/)
          if (match) {
            ownerName = match[1]
          }
        }
      } catch (error) {
        console.warn('Failed to parse Git remote URL:', originUrl, error)
      }
    }
  }

  if (ownerName === 'local') {
    const projectRemoteUrl = project?.repositories?.[0]?.url
    if (projectRemoteUrl) {
      try {
        const urlParts = projectRemoteUrl.replace('https://github.com/', '').replace('.git', '').split('/')
        if (urlParts.length >= 2) {
          ownerName = urlParts[0]
        }
      } catch (error) {
        console.warn('Failed to parse project remote URL:', projectRemoteUrl)
      }
    }
  }

  return {
    name: folderName,
    owner: ownerName,
    avatarUrl: `https://github.com/${ownerName}.png`,
    fullPath: pathToUse
  }
}

export const getRemoteRepositoryInfo = (repoConfig: any, project: any) => {
  let ownerName = 'local'
  let repoName = 'unknown'

  if (repoConfig.remoteUrls) {
    const originUrl = repoConfig.remoteUrls.origin || Object.values(repoConfig.remoteUrls)[0]
    if (originUrl && typeof originUrl === 'string') {
      try {
        let cleanUrl = originUrl
        if (cleanUrl.startsWith('git@github.com:')) {
          cleanUrl = cleanUrl.replace('git@github.com:', 'https://github.com/')
        }
        if (cleanUrl.includes('github.com')) {
          const match = cleanUrl.match(/github\.com[\/:]([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/)?$/)
          if (match) {
            ownerName = match[1]
            repoName = match[2]
          }
        }
      } catch (error) {
        console.warn('Failed to parse Git remote URL:', originUrl, error)
      }
    }
  }

  if (repoName === 'unknown') {
    const projectRemoteUrl = project?.repositories?.[0]?.url
    if (projectRemoteUrl) {
      try {
        const urlParts = projectRemoteUrl.replace('https://github.com/', '').replace('.git', '').split('/')
        if (urlParts.length >= 2) {
          ownerName = urlParts[0]
          repoName = urlParts[1]
        }
      } catch (error) {
        console.warn('Failed to parse project remote URL:', projectRemoteUrl)
      }
    }
  }

  return {
    name: repoName,
    owner: ownerName,
    avatarUrl: `https://github.com/${ownerName}.png`,
    fullPath: repoConfig.path || ''
  }
}
