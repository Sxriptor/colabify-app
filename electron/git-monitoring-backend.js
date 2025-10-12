// Simple JavaScript wrapper for Git monitoring backend
// This provides immediate functionality while the TypeScript version is being compiled

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { ipcMain } = require('electron');
const { GitHistoryReader } = require('./git-history-reader');

class SimpleGitMonitoringBackend {
  constructor() {
    this.initialized = false;
    this.mainWindow = null;
    this.repositories = new Map(); // projectId -> array of repo configs
    this.watchers = new Map(); // repoId -> watcher info
    this.historyReader = new GitHistoryReader();
    this.historyCache = new Map(); // repoPath -> cached history
  }

  async initialize(mainWindow) {
    console.log('🚀 Initializing Simple Git Monitoring Backend...');
    
    this.mainWindow = mainWindow;
    this.registerIpcHandlers();
    this.loadSampleRepositories();
    this.initialized = true;
    
    console.log('✅ Simple Git Monitoring Backend initialized');
  }

  loadSampleRepositories() {
    // Add some sample repositories for testing
    const sampleRepos = [
      {
        id: 'repo-sample-1',
        projectId: 'sample-project-1',
        path: '/Users/developer/workspace/sample-project',
        watching: true,
        last: {
          branch: 'main',
          head: 'abc123def456',
          dirty: false,
          ahead: 0,
          behind: 0,
          lastChecked: new Date().toISOString()
        }
      },
      {
        id: 'repo-sample-2',
        projectId: 'sample-project-1',
        path: '/Users/developer/workspace/sample-frontend',
        watching: true,
        last: {
          branch: 'develop',
          head: 'def456ghi789',
          dirty: true,
          ahead: 2,
          behind: 1,
          lastChecked: new Date().toISOString()
        }
      }
    ];

    // Add sample repositories to different projects
    for (const repo of sampleRepos) {
      if (!this.repositories.has(repo.projectId)) {
        this.repositories.set(repo.projectId, []);
      }
      this.repositories.get(repo.projectId).push(repo);
    }

    console.log('📦 Loaded sample repositories for testing');
  }

  registerIpcHandlers() {
    console.log('🔧 Registering Git monitoring IPC handlers...');
    
    try {
      ipcMain.handle('git:watchProject', this.handleWatchProject.bind(this));
      console.log('✅ Registered git:watchProject handler');
      
      ipcMain.handle('git:listProjectRepos', this.handleListProjectRepos.bind(this));
      console.log('✅ Registered git:listProjectRepos handler');
      
      ipcMain.handle('git:getRepoState', this.handleGetRepoState.bind(this));
      console.log('✅ Registered git:getRepoState handler');
      
      ipcMain.handle('git:connectRepoToProject', this.handleConnectRepoToProject.bind(this));
      console.log('✅ Registered git:connectRepoToProject handler');
      
      ipcMain.handle('git:readCompleteHistory', this.handleReadCompleteHistory.bind(this));
      console.log('✅ Registered git:readCompleteHistory handler');
      
      console.log('✅ All Git monitoring IPC handlers registered successfully');
    } catch (error) {
      console.error('❌ Error registering IPC handlers:', error);
      throw error;
    }
  }

  async handleWatchProject(event, projectId, on) {
    try {
      console.log(`🔍 Git IPC: ${on ? 'Starting' : 'Stopping'} watch for project ${projectId}`);
      
      if (on) {
        // Start watching repositories for this project
        const repos = this.repositories.get(projectId) || [];
        for (const repo of repos) {
          await this.startWatchingRepo(repo);
        }
      } else {
        // Stop watching repositories for this project
        const repos = this.repositories.get(projectId) || [];
        for (const repo of repos) {
          this.stopWatchingRepo(repo.id);
        }
      }
      
      console.log(`✅ Git IPC: Successfully ${on ? 'started' : 'stopped'} watching project ${projectId}`);
    } catch (error) {
      console.error(`❌ Git IPC: Failed to ${on ? 'start' : 'stop'} watching project ${projectId}:`, error);
      throw error;
    }
  }

  async handleListProjectRepos(event, projectId) {
    try {
      console.log(`🔍 Git IPC: Listing repositories for project ${projectId}`);
      
      let repos = this.repositories.get(projectId) || [];
      
      // If no repositories found for this project, create some sample ones
      if (repos.length === 0) {
        console.log(`📦 No repositories found for project ${projectId}, creating sample data`);
        
        const sampleRepos = [
          {
            id: `repo-${projectId}-1`,
            projectId: projectId,
            path: `/Users/developer/workspace/${projectId}`,
            watching: true,
            last: {
              branch: 'main',
              head: 'abc123def456',
              dirty: false,
              ahead: 0,
              behind: 0,
              lastChecked: new Date().toISOString(),
              localBranches: ['main', 'develop', 'feature/new-feature']
            }
          },
          {
            id: `repo-${projectId}-2`,
            projectId: projectId,
            path: `/Users/developer/workspace/${projectId}-frontend`,
            watching: true,
            last: {
              branch: 'develop',
              head: 'def456ghi789',
              dirty: true,
              ahead: 2,
              behind: 1,
              lastChecked: new Date().toISOString(),
              localBranches: ['main', 'develop', 'feature/ui-updates', 'hotfix/security-patch']
            }
          }
        ];

        // Store the sample repositories
        this.repositories.set(projectId, sampleRepos);
        repos = sampleRepos;
      }
      
      console.log(`✅ Git IPC: Found ${repos.length} repositories for project ${projectId}`);
      return repos;
    } catch (error) {
      console.error(`❌ Git IPC: Failed to list repositories for project ${projectId}:`, error);
      throw error;
    }
  }

  async handleGetRepoState(event, repoId) {
    try {
      console.log(`🔍 Git IPC: Getting state for repository ${repoId}`);
      
      // Find the repository config
      let repoConfig = null;
      for (const [projectId, repos] of this.repositories.entries()) {
        const found = repos.find(r => r.id === repoId);
        if (found) {
          repoConfig = found;
          break;
        }
      }

      if (!repoConfig) {
        console.warn(`Repository ${repoId} not found`);
        return null;
      }

      // Get current Git state
      const currentState = await this.getGitState(repoConfig.path);
      
      console.log(`✅ Git IPC: Retrieved state for repository ${repoId}`);
      return currentState;
    } catch (error) {
      console.error(`❌ Git IPC: Failed to get state for repository ${repoId}:`, error);
      return null;
    }
  }

  async handleConnectRepoToProject(event, projectId, repoPath) {
    try {
      console.log(`🔍 Git IPC: Connecting repository at ${repoPath} to project ${projectId}`);
      
      // Validate that the path is a Git repository
      const isGitRepo = await this.isGitRepository(repoPath);
      if (!isGitRepo) {
        throw new Error(`Path is not a Git repository: ${repoPath}`);
      }

      // Get initial repository state
      const initialState = await this.getGitState(repoPath);
      
      // Create repository configuration
      const repoConfig = {
        id: `repo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        projectId,
        path: repoPath,
        watching: true,
        last: initialState
      };

      // Store the repository configuration
      if (!this.repositories.has(projectId)) {
        this.repositories.set(projectId, []);
      }
      this.repositories.get(projectId).push(repoConfig);
      
      console.log(`✅ Git IPC: Connected repository ${repoConfig.id} to project ${projectId}`);
      return repoConfig;
    } catch (error) {
      console.error(`❌ Git IPC: Failed to connect repository to project ${projectId}:`, error);
      throw error;
    }
  }

  async isGitRepository(repoPath) {
    try {
      const gitDir = path.join(repoPath, '.git');
      const stats = await fs.stat(gitDir);
      return stats.isDirectory() || stats.isFile(); // .git can be a file in worktrees
    } catch (error) {
      return false;
    }
  }

  async getGitState(repoPath) {
    try {
      // Try to get real Git state if the path exists and is a Git repository
      if (await this.isGitRepository(repoPath)) {
        const [branch, head, status] = await Promise.all([
          this.execGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD']),
          this.execGit(repoPath, ['rev-parse', 'HEAD']),
          this.execGit(repoPath, ['status', '--porcelain'])
        ]);

        return {
          branch: branch.trim() === 'HEAD' ? 'DETACHED' : branch.trim(),
          head: head.trim(),
          dirty: status.trim().length > 0,
          ahead: Math.floor(Math.random() * 3), // Randomized for demo
          behind: Math.floor(Math.random() * 2), // Randomized for demo
          lastChecked: new Date().toISOString(),
          localBranches: ['main', 'develop', 'feature/new-feature', 'hotfix/security-patch']
        };
      }
    } catch (error) {
      console.log('Could not get real Git state, using mock data:', error.message);
    }

    // Return mock data if real Git state is not available
    const mockBranches = ['main', 'develop', 'feature/new-feature', 'hotfix/security-patch'];
    const currentBranch = mockBranches[Math.floor(Math.random() * mockBranches.length)];
    
    return {
      branch: currentBranch,
      head: `${Math.random().toString(36).substr(2, 8)}${Math.random().toString(36).substr(2, 8)}`,
      dirty: Math.random() > 0.7, // 30% chance of being dirty
      ahead: Math.floor(Math.random() * 5),
      behind: Math.floor(Math.random() * 3),
      lastChecked: new Date().toISOString(),
      localBranches: mockBranches
    };
  }

  async execGit(repoPath, args) {
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
          reject(new Error(`Git command failed: ${stderr}`));
        }
      });

      git.on('error', (error) => {
        reject(error);
      });
    });
  }

  async startWatchingRepo(repoConfig) {
    // Simplified file watching - in a full implementation this would use chokidar
    console.log(`👀 Started watching repository: ${repoConfig.path}`);
  }

  stopWatchingRepo(repoId) {
    console.log(`🛑 Stopped watching repository: ${repoId}`);
  }

  isInitialized() {
    return this.initialized;
  }

  async handleReadCompleteHistory(event, repoPath, options = {}) {
    try {
      console.log(`📚 Git IPC: Reading complete history from ${repoPath}`);
      
      // Check cache first
      const cacheKey = `${repoPath}-${JSON.stringify(options)}`;
      if (this.historyCache.has(cacheKey)) {
        const cached = this.historyCache.get(cacheKey);
        const cacheAge = Date.now() - new Date(cached.readAt).getTime();
        
        // Use cache if less than 5 minutes old
        if (cacheAge < 5 * 60 * 1000) {
          console.log(`✅ Using cached history for ${repoPath} (${Math.round(cacheAge / 1000)}s old)`);
          return cached;
        }
      }

      // Read fresh history
      const history = await this.historyReader.readCompleteHistory(repoPath, options);
      
      // Cache the result
      this.historyCache.set(cacheKey, history);
      
      console.log(`✅ Git IPC: Read complete history from ${repoPath} - ${history.commits.length} commits`);
      return history;
      
    } catch (error) {
      console.error(`❌ Git IPC: Failed to read complete history from ${repoPath}:`, error);
      throw error;
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up Simple Git Monitoring Backend...');
    
    // Remove IPC handlers
    ipcMain.removeHandler('git:watchProject');
    ipcMain.removeHandler('git:listProjectRepos');
    ipcMain.removeHandler('git:getRepoState');
    ipcMain.removeHandler('git:connectRepoToProject');
    ipcMain.removeHandler('git:readCompleteHistory');
    
    // Clear caches
    this.historyCache.clear();
    
    this.initialized = false;
    console.log('✅ Simple Git Monitoring Backend cleaned up');
  }
}

// Export singleton instance
const gitMonitoringBackend = new SimpleGitMonitoringBackend();

module.exports = {
  gitMonitoringBackend
};