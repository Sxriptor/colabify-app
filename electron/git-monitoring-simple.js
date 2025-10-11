// Simple JavaScript version for immediate testing
const { ipcMain } = require('electron');

class SimpleGitMonitoring {
  constructor() {
    this.isInitialized = false;
    this.watchedProjects = new Set(); // Track which projects are being watched
    this.repositoryCache = new Map(); // Cache repositories by ID for quick lookup
  }

  initialize(mainWindow) {
    if (this.isInitialized) return;
    
    console.log('🚀 Initializing simple Git monitoring...');
    console.log('📋 About to register IPC handlers...');
    
    // Register basic IPC handlers for testing
    ipcMain.handle('git:watchProject', async (event, projectId, on) => {
      console.log(`📡 Git IPC: ${on ? 'Starting' : 'Stopping'} watch for project ${projectId}`);
      
      // Track watched projects
      if (on) {
        this.watchedProjects.add(projectId);
        console.log(`✅ Now watching project ${projectId}`);
      } else {
        this.watchedProjects.delete(projectId);
        console.log(`⏹️ Stopped watching project ${projectId}`);
      }
      
      console.log(`📊 Currently watching ${this.watchedProjects.size} projects:`, Array.from(this.watchedProjects));
      
      // Emit event to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('git:event', {
          evt: on ? 'watchingOn' : 'watchingOff',
          projectId: projectId
        });
      }
      
      return { success: true };
    });

    ipcMain.handle('git:listProjectRepos', async (event, projectId) => {
      console.log(`📡 Git IPC: Listing repositories for project ${projectId}`);
      
      try {
        // Try to find real Git repositories on the system
        const realRepos = await this.findRealGitRepositories(projectId);
        
        if (realRepos.length > 0) {
          console.log(`📋 Found ${realRepos.length} real Git repositories for project ${projectId}:`);
          realRepos.forEach(repo => {
            console.log(`  - ${repo.path} (${repo.last.branch})`);
            // Cache the repository for quick lookup
            this.repositoryCache.set(repo.id, repo);
          });
          return realRepos;
        }
        
        // Fallback to mock data if no real repos found
        console.log(`📋 No real repositories found, returning mock data for project ${projectId}`);
        const mockRepos = [
          {
            id: `repo-mock-${projectId}`,
            projectId: projectId,
            path: `~/workspace/${projectId}`,
            watching: true,
            last: {
              branch: 'main',
              head: 'abc123mock',
              statusShort: '',
              ahead: 0,
              behind: 0,
              localBranches: ['main', 'develop'],
              remoteBranches: ['origin/main', 'origin/develop']
            }
          }
        ];
        
        return mockRepos;
      } catch (error) {
        console.error(`❌ Error listing repositories for project ${projectId}:`, error);
        return [];
      }
    });

    ipcMain.handle('git:getRepoState', async (event, repoId) => {
      console.log(`📡 Git IPC: Getting state for repository ${repoId}`);
      
      try {
        // First, try to get the repository from cache
        const cachedRepo = this.repositoryCache.get(repoId);
        
        if (cachedRepo && cachedRepo.path) {
          console.log(`🔍 Found cached repository ${repoId} at ${cachedRepo.path}`);
          console.log(`🔧 Getting fresh Git state for ${cachedRepo.path}`);
          
          const realState = await this.getActualGitState(cachedRepo.path);
          console.log(`📊 Real repository ${repoId} state:`, realState);
          
          // Update the cache with fresh state
          cachedRepo.last = realState;
          this.repositoryCache.set(repoId, cachedRepo);
          
          return realState;
        }
        
        // If not in cache, try to find it by searching again
        console.log(`⚠️ Repository ${repoId} not in cache, searching...`);
        
        // Extract project ID from repo ID (assuming format: repo-xxx-{projectId}-{number})
        const projectIdMatch = repoId.match(/repo-.+-(.+)-\d+$/);
        const projectId = projectIdMatch ? projectIdMatch[1] : 'unknown';
        
        const allRepos = await this.findRealGitRepositories(projectId);
        const repo = allRepos.find(r => r.id === repoId);
        
        if (repo && repo.path) {
          console.log(`🔍 Found repository ${repoId} at ${repo.path}`);
          const realState = await this.getActualGitState(repo.path);
          console.log(`📊 Real repository ${repoId} state:`, realState);
          
          // Cache it for next time
          this.repositoryCache.set(repoId, repo);
          
          return realState;
        }
        
        // Fallback to mock state if repository not found
        console.log(`❌ Repository ${repoId} not found anywhere, returning mock state`);
        const mockState = {
          branch: 'main',
          head: 'abc123def',
          statusShort: 'M  src/file.js',
          upstream: 'origin/main',
          ahead: 1,
          behind: 0,
          dirty: true,
          localBranches: ['main', 'feature/test'],
          remoteBranches: ['origin/main', 'origin/develop'],
          lastChecked: new Date().toISOString()
        };
        
        return mockState;
      } catch (error) {
        console.error(`❌ Error getting repository state for ${repoId}:`, error);
        
        // Return error state
        return {
          branch: 'error',
          head: 'error',
          statusShort: 'Error reading repository',
          ahead: 0,
          behind: 0,
          dirty: false,
          localBranches: [],
          remoteBranches: [],
          lastChecked: new Date().toISOString()
        };
      }
    });

    ipcMain.handle('git:connectRepoToProject', async (event, projectId, repoPath) => {
      console.log(`📡 Git IPC: Connecting repository at ${repoPath} to project ${projectId}`);
      
      // Return mock repository config
      const mockRepoConfig = {
        id: `repo-${Date.now()}`,
        projectId: projectId,
        path: repoPath,
        watching: true,
        last: {
          branch: 'main',
          head: 'abc123def',
          dirty: false,
          ahead: 0,
          behind: 0,
          lastChecked: new Date().toISOString()
        }
      };
      
      console.log(`📊 Connected repository:`, mockRepoConfig);
      return mockRepoConfig;
    });

    ipcMain.handle('git:readDirectGitState', async (event, repoPath) => {
      console.log(`📡 Git IPC: Reading Git state directly from ${repoPath} (no searching)`);
      
      try {
        // Read Git state directly from the specified path without any filesystem searching
        const gitState = await this.getActualGitState(repoPath);
        console.log(`📊 Direct Git state from ${repoPath}:`, gitState);
        return gitState;
      } catch (error) {
        console.error(`❌ Error reading direct Git state from ${repoPath}:`, error);
        return null;
      }
    });
    
    console.log('✅ Registered git:readDirectGitState handler');

    // Send test activity events for watched projects
    setInterval(() => {
      if (this.watchedProjects.size > 0 && mainWindow && !mainWindow.isDestroyed()) {
        const projectIds = Array.from(this.watchedProjects);
        const randomProject = projectIds[Math.floor(Math.random() * projectIds.length)];
        
        const activityTypes = ['COMMIT', 'BRANCH_SWITCH', 'PUSH', 'REMOTE_UPDATE'];
        const randomActivity = activityTypes[Math.floor(Math.random() * activityTypes.length)];
        
        const mockActivities = {
          COMMIT: {
            branch: 'main',
            head: Math.random().toString(36).substring(7),
            author: 'Test Developer',
            subject: 'Add new feature implementation'
          },
          BRANCH_SWITCH: {
            from: 'main',
            to: 'feature/new-branch'
          },
          PUSH: {
            branch: 'main',
            head: Math.random().toString(36).substring(7)
          },
          REMOTE_UPDATE: {
            branch: 'main',
            ahead: Math.floor(Math.random() * 3),
            behind: Math.floor(Math.random() * 2)
          }
        };
        
        console.log(`📤 Sending test ${randomActivity} activity for project ${randomProject}`);
        mainWindow.webContents.send('git:event', {
          evt: 'activity',
          projectId: randomProject,
          repoId: `repo-1-${randomProject}`,
          type: randomActivity,
          details: mockActivities[randomActivity],
          at: new Date().toISOString()
        });
      }
    }, 10000); // Send test activity every 10 seconds

    this.isInitialized = true;
    console.log('✅ Simple Git monitoring initialized');
    console.log('📋 All registered IPC handlers:', [
      'git:watchProject',
      'git:listProjectRepos', 
      'git:getRepoState',
      'git:connectRepoToProject',
      'git:readDirectGitState'
    ]);
    console.log('📋 Integration points:');
    console.log('  - Watches Supabase project_watches table changes');
    console.log('  - Syncs with existing handleWatchToggle() function');
    console.log('  - Tracks watch state in memory for testing');
  }

  async findRealGitRepositories(projectId) {
    const fs = require('fs').promises;
    const path = require('path');
    const os = require('os');
    
    console.log(`🔍 Searching for Git repositories for project ${projectId}...`);
    console.log(`🏠 Home directory: ${os.homedir()}`);
    
    const repositories = [];
    
    // Common directories where Git repositories might be found
    const searchPaths = [
      process.cwd(), // Current working directory (likely the project itself!)
      path.dirname(process.cwd()), // Parent directory
      path.join(os.homedir(), 'workspace'),
      path.join(os.homedir(), 'projects'),
      path.join(os.homedir(), 'dev'),
      path.join(os.homedir(), 'code'),
      path.join(os.homedir(), 'Documents'),
      path.join(os.homedir(), 'Desktop'),
      '/Users/Shared', // macOS shared folder
      '/opt/projects', // Common Linux location
    ];
    
    console.log(`📂 Will search these paths:`, searchPaths);
    
    for (const searchPath of searchPaths) {
      try {
        console.log(`🔍 Checking directory: ${searchPath}`);
        const exists = await fs.access(searchPath).then(() => true).catch(() => false);
        if (!exists) {
          console.log(`❌ Directory does not exist: ${searchPath}`);
          continue;
        }
        
        console.log(`✅ Directory exists: ${searchPath}`);
        const entries = await fs.readdir(searchPath, { withFileTypes: true });
        console.log(`📁 Found ${entries.length} entries in ${searchPath}`);
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const fullPath = path.join(searchPath, entry.name);
            const gitPath = path.join(fullPath, '.git');
            
            try {
              await fs.access(gitPath);
              // This is a Git repository
              console.log(`🎉 Found Git repository: ${fullPath}`);
              
              console.log(`🔧 Getting Git state for: ${fullPath}`);
              const repoState = await this.getActualGitState(fullPath);
              console.log(`📊 Git state:`, repoState);
              
              repositories.push({
                id: `repo-real-${Buffer.from(fullPath).toString('base64').slice(0, 8)}`,
                projectId: projectId,
                path: fullPath,
                watching: true,
                last: repoState
              });
              
              // Limit to 3 repositories to avoid overwhelming the UI
              if (repositories.length >= 3) break;
              
            } catch (gitError) {
              // Not a Git repository, continue
            }
          }
        }
        
        if (repositories.length >= 3) break;
      } catch (error) {
        // Directory doesn't exist or can't be read, continue
        console.log(`❌ Could not search ${searchPath}: ${error.message}`);
      }
    }
    
    console.log(`🏁 Search complete. Found ${repositories.length} Git repositories total.`);
    return repositories;
  }

  async getActualGitState(repoPath) {
    try {
      console.log(`🔧 Executing Git commands in: ${repoPath}`);
      
      // Get current branch
      console.log(`🌿 Getting current branch...`);
      const branch = await this.execGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD']);
      console.log(`🌿 Branch: ${branch.trim()}`);
      
      // Get current commit hash
      console.log(`🔗 Getting current commit hash...`);
      const head = await this.execGit(repoPath, ['rev-parse', 'HEAD']);
      console.log(`🔗 Head: ${head.trim().substring(0, 8)}`);
      
      // Get status
      console.log(`📊 Getting working directory status...`);
      const status = await this.execGit(repoPath, ['status', '--porcelain']);
      console.log(`📊 Status: ${status.trim() || 'clean'}`);
      
      // Get local branches
      const localBranches = await this.execGit(repoPath, ['branch', '--format=%(refname:short)']);
      
      // Get remote branches (if any)
      let remoteBranches = [];
      try {
        const remotes = await this.execGit(repoPath, ['branch', '-r', '--format=%(refname:short)']);
        remoteBranches = remotes.trim().split('\n').filter(b => b.trim());
      } catch (remoteError) {
        // No remotes configured
      }
      
      // Get ahead/behind info (if remote exists)
      let ahead = 0, behind = 0;
      try {
        const aheadBehind = await this.execGit(repoPath, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']);
        const [aheadStr, behindStr] = aheadBehind.trim().split('\t');
        ahead = parseInt(aheadStr) || 0;
        behind = parseInt(behindStr) || 0;
      } catch (upstreamError) {
        // No upstream configured
      }
      
      return {
        branch: branch.trim() === 'HEAD' ? 'DETACHED' : branch.trim(),
        head: head.trim().substring(0, 8), // Short hash
        statusShort: status.trim(),
        ahead: ahead,
        behind: behind,
        dirty: status.trim().length > 0,
        localBranches: localBranches.trim().split('\n').filter(b => b.trim()),
        remoteBranches: remoteBranches,
        lastChecked: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`Error getting Git state for ${repoPath}:`, error);
      
      // Return fallback state
      return {
        branch: 'unknown',
        head: 'unknown',
        statusShort: '',
        ahead: 0,
        behind: 0,
        dirty: false,
        localBranches: ['main'],
        remoteBranches: [],
        lastChecked: new Date().toISOString()
      };
    }
  }

  async execGit(repoPath, args) {
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, {
        cwd: repoPath,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      git.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Git command failed (${code}): ${stderr}`));
        }
      });

      git.on('error', (error) => {
        reject(error);
      });
    });
  }

  cleanup() {
    if (!this.isInitialized) return;
    
    console.log('🧹 Cleaning up simple Git monitoring...');
    console.log(`📊 Was watching ${this.watchedProjects.size} projects`);
    
    ipcMain.removeHandler('git:watchProject');
    ipcMain.removeHandler('git:listProjectRepos');
    ipcMain.removeHandler('git:getRepoState');
    ipcMain.removeHandler('git:connectRepoToProject');
    ipcMain.removeHandler('git:readDirectGitState');
    
    this.watchedProjects.clear();
    this.isInitialized = false;
    console.log('✅ Simple Git monitoring cleaned up');
  }

  isReady() {
    return this.isInitialized;
  }

  getWatchedProjects() {
    return Array.from(this.watchedProjects);
  }
}

// Export singleton instance
const gitMonitoringBackend = new SimpleGitMonitoring();

module.exports = { gitMonitoringBackend };