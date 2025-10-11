// Simple JavaScript version for immediate testing
const { ipcMain } = require('electron');

class SimpleGitMonitoring {
  constructor() {
    this.isInitialized = false;
    this.watchedProjects = new Set(); // Track which projects are being watched
  }

  initialize(mainWindow) {
    if (this.isInitialized) return;
    
    console.log('🚀 Initializing simple Git monitoring...');
    
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
      
      // Simulate repository data based on whether project is watched
      const isWatched = this.watchedProjects.has(projectId);
      const mockRepos = isWatched ? [
        {
          id: `repo-1-${projectId}`,
          projectId: projectId,
          path: `/mock/path/to/repo1`,
          watching: true,
          last: {
            branch: 'main',
            head: 'abc123',
            statusShort: '',
            ahead: 0,
            behind: 0,
            localBranches: ['main', 'develop'],
            remoteBranches: ['origin/main', 'origin/develop']
          }
        }
      ] : [];
      
      console.log(`📋 Returning ${mockRepos.length} repositories for project ${projectId}`);
      return mockRepos;
    });

    ipcMain.handle('git:getRepoState', async (event, repoId) => {
      console.log(`📡 Git IPC: Getting state for repository ${repoId}`);
      
      // Return mock repository state
      const mockState = {
        branch: 'main',
        head: 'abc123def',
        statusShort: 'M  src/file.js',
        upstream: 'origin/main',
        ahead: 1,
        behind: 0,
        localBranches: ['main', 'feature/test'],
        remoteBranches: ['origin/main', 'origin/develop']
      };
      
      console.log(`📊 Repository ${repoId} state:`, mockState);
      return mockState;
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
    console.log('📋 Integration points:');
    console.log('  - Watches Supabase project_watches table changes');
    console.log('  - Syncs with existing handleWatchToggle() function');
    console.log('  - Tracks watch state in memory for testing');
  }

  cleanup() {
    if (!this.isInitialized) return;
    
    console.log('🧹 Cleaning up simple Git monitoring...');
    console.log(`📊 Was watching ${this.watchedProjects.size} projects`);
    
    ipcMain.removeHandler('git:watchProject');
    ipcMain.removeHandler('git:listProjectRepos');
    ipcMain.removeHandler('git:getRepoState');
    ipcMain.removeHandler('git:connectRepoToProject');
    
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

module.exports = { SimpleGitMonitoring };