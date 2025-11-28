const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class TimeTracker {
  constructor() {
    this.dataPath = path.join(app.getPath('userData'), 'time-tracking.json');
    this.activeSessions = new Map(); // Map of appName -> { startTime, executablePath, processName, intervalId }
    this.monitoringIntervals = new Map(); // Map of appName -> intervalId
    this.loadData();
    this.startMonitoring();
  }

  /**
   * Start monitoring active sessions
   */
  startMonitoring() {
    // Check every 10 seconds if applications are still running
    // Store interval ID so we can clear it if needed
    this.monitoringInterval = setInterval(() => {
      this.checkActiveSessions();
    }, 10000);
    
    console.log('✅ Started monitoring active application sessions (checking every 10 seconds)');
  }

  /**
   * Stop monitoring active sessions
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('⏹️ Stopped monitoring active application sessions');
    }
  }

  /**
   * Manually trigger a check of all active sessions
   */
  async manualCheck() {
    console.log('🔍 Manual check triggered for active sessions');
    await this.checkActiveSessions();
  }

  /**
   * Check if a process is running by executable name
   */
  async isProcessRunning(executablePath) {
    if (!executablePath) {
      console.warn('⚠️ No executable path provided for process check');
      return false;
    }

    const platform = process.platform;
    const executableName = path.basename(executablePath);
    const exeNameWithoutExt = executableName.replace(/\.(exe|app)$/i, '');
    
    try {
      if (platform === 'win32') {
        // Windows: use tasklist - check for exact match
        const cleanName = executableName.replace(/"/g, '').toLowerCase();
        
        try {
          // First, try exact match with tasklist filter
          const { stdout } = await execAsync(`tasklist /FI "IMAGENAME eq ${executableName}" /FO CSV /NH`);
          if (stdout.trim().length > 0) {
            // Parse CSV output to verify it's actually the process
            const lines = stdout.split('\n').filter(line => line.trim());
            for (const line of lines) {
              const match = line.match(/"([^"]+\.exe)"/i);
              if (match) {
                const processName = match[1].toLowerCase();
                if (processName === cleanName) {
                  return true;
                }
              }
            }
          }
        } catch (e) {
          // Filter might not work, continue to full scan
        }
        
        // Full tasklist scan for more accurate detection
        try {
          const { stdout } = await execAsync(`tasklist /FO CSV /NH`);
          const lines = stdout.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            // Extract process name from CSV format: "Image Name","PID","Session Name","Session#","Mem Usage"
            const match = line.match(/"([^"]+\.exe)"/i);
            if (match) {
              const processName = match[1].toLowerCase();
              
              // Exact match
              if (processName === cleanName) {
                return true;
              }
              
              // For apps like VS Code, check if process name starts with executable name
              // e.g., "Code.exe" matches "Code Helper.exe", "Code - Insiders.exe"
              if (processName.startsWith(exeNameWithoutExt.toLowerCase() + '.exe') ||
                  processName.startsWith(exeNameWithoutExt.toLowerCase() + ' ')) {
                return true;
              }
            }
          }
        } catch (e) {
          console.warn(`⚠️ Error scanning tasklist:`, e.message);
          // If we can't check, assume it might still be running (don't stop tracking prematurely)
          return true;
        }
        
        return false;
      } else if (platform === 'darwin') {
        // macOS: use ps - check for .app bundle or executable name
        try {
          // Check for .app bundle first
          if (executablePath.includes('.app')) {
            const appName = path.basename(executablePath, '.app');
            const { stdout } = await execAsync(`ps aux | grep -i "${appName}" | grep -v grep`);
            if (stdout.trim().length > 0) {
              return true;
            }
          }
          
          // Check for executable name
          const { stdout } = await execAsync(`ps aux | grep -i "${exeNameWithoutExt}" | grep -v grep`);
          return stdout.trim().length > 0;
        } catch {
          return false;
        }
      } else {
        // Linux: use pgrep or ps
        try {
          // Try pgrep first (more reliable)
          const { stdout } = await execAsync(`pgrep -f "${exeNameWithoutExt}"`);
          return stdout.trim().length > 0;
        } catch {
          // Fallback to ps
          try {
            const { stdout } = await execAsync(`ps aux | grep -i "${exeNameWithoutExt}" | grep -v grep`);
            return stdout.trim().length > 0;
          } catch {
            return false;
          }
        }
      }
    } catch (error) {
      // If command fails, assume process might still be running (don't stop tracking prematurely)
      console.warn(`⚠️ Could not check if ${executableName} is running, assuming it is:`, error.message);
      return true;
    }
  }

  /**
   * Check all active sessions to see if applications are still running
   */
  async checkActiveSessions() {
    if (this.activeSessions.size === 0) {
      return; // No active sessions to check
    }

    console.log(`🔍 Checking ${this.activeSessions.size} active session(s)...`);
    
    // Create a copy of entries to avoid modification during iteration
    const sessionsToCheck = Array.from(this.activeSessions.entries());
    
    for (const [normalizedName, session] of sessionsToCheck) {
      // Skip check if we just started tracking (wait for app to fully launch)
      if (session.checkAfter && Date.now() < session.checkAfter) {
        continue;
      }
      
      if (session.executablePath) {
        try {
          const isRunning = await this.isProcessRunning(session.executablePath);
          if (!isRunning) {
            const displayName = session.originalName || normalizedName;
            console.log(`📴 Application "${displayName}" is no longer running (checked: ${path.basename(session.executablePath)})`);
            this.stopTracking(normalizedName);
          } else {
            // Log successful check (optional, can be removed for less verbose logging)
            // console.log(`✅ Application "${session.originalName || normalizedName}" is still running`);
          }
        } catch (error) {
          console.error(`❌ Error checking if ${session.originalName || normalizedName} is running:`, error.message);
          // On error, don't stop tracking (assume it's still running to avoid false positives)
        }
      } else {
        // No executable path - can't check, but log a warning
        console.warn(`⚠️ Cannot check application "${session.originalName || normalizedName}" - no executable path`);
      }
    }
  }

  /**
   * Load time tracking data from local storage
   */
  loadData() {
    try {
      if (fs.existsSync(this.dataPath)) {
        const data = fs.readFileSync(this.dataPath, 'utf8');
        this.data = JSON.parse(data);
      } else {
        this.data = {
          applications: {},
          sessions: [],
          totalTime: {}
        };
      }
    } catch (error) {
      console.error('Error loading time tracking data:', error);
      this.data = {
        applications: {},
        sessions: [],
        totalTime: {}
      };
    }
  }

  /**
   * Save time tracking data to local storage
   */
  saveData() {
    try {
      fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Error saving time tracking data:', error);
    }
  }

  /**
   * Start tracking time for an application
   */
  startTracking(appName, executablePath) {
    // Normalize app name to lowercase for consistent tracking
    const normalizedName = appName.toLowerCase().trim();
    
    // Stop any existing session for this app (using normalized name)
    this.stopTracking(normalizedName);

    const startTime = Date.now();
    const processName = path.basename(executablePath || appName);
    
    this.activeSessions.set(normalizedName, {
      startTime,
      executablePath,
      processName,
      originalName: appName, // Keep original name for display
      checkAfter: Date.now() + 5000 // Wait 5 seconds before first check (give app time to start)
    });

    console.log(`⏱️ Started tracking: ${appName} (monitoring: ${processName})`);
  }

  /**
   * Stop tracking time for an application
   */
  stopTracking(appName) {
    // Normalize app name to lowercase for consistent tracking
    const normalizedName = appName.toLowerCase().trim();
    const session = this.activeSessions.get(normalizedName);
    if (!session) {
      return;
    }

    // Use original name for display/storage if available, otherwise use provided name
    const displayName = session.originalName || appName;
    const storageName = normalizedName; // Store with normalized name for consistency

    const duration = Date.now() - session.startTime;
    const minutes = Math.floor(duration / 60000);
    
    if (minutes > 0) {
      // Add to sessions log
      this.data.sessions.push({
        appName: displayName,
        normalizedName: storageName,
        startTime: new Date(session.startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: minutes
      });

      // Update total time (use normalized name for storage)
      if (!this.data.totalTime[storageName]) {
        this.data.totalTime[storageName] = 0;
      }
      this.data.totalTime[storageName] += minutes;

      // Update application info (use normalized name for storage, original for display)
      if (!this.data.applications[storageName]) {
        this.data.applications[storageName] = {
          name: displayName,
          lastUsed: null,
          totalMinutes: 0
        };
      }
      this.data.applications[storageName].lastUsed = new Date().toISOString();
      this.data.applications[storageName].totalMinutes = this.data.totalTime[storageName];

      this.saveData();
      console.log(`⏱️ Stopped tracking: ${displayName} (${minutes} minutes)`);
    }

    // Clear monitoring interval if exists
    if (this.monitoringIntervals.has(normalizedName)) {
      clearInterval(this.monitoringIntervals.get(normalizedName));
      this.monitoringIntervals.delete(normalizedName);
    }

    this.activeSessions.delete(normalizedName);
  }

  /**
   * Get all time tracking data
   */
  getData() {
    // Update any active sessions' current time
    const now = Date.now();
    const activeApps = [];
    
    for (const [normalizedName, session] of this.activeSessions.entries()) {
      const currentDuration = Math.floor((now - session.startTime) / 60000);
      activeApps.push({
        appName: session.originalName || normalizedName,
        normalizedName: normalizedName,
        startTime: new Date(session.startTime).toISOString(),
        currentDuration
      });
    }

    return {
      ...this.data,
      activeSessions: activeApps
    };
  }

  /**
   * Get time tracking data for a specific application
   */
  getAppData(appName) {
    // Normalize app name to lowercase for consistent lookup
    const normalizedName = appName.toLowerCase().trim();
    return {
      totalMinutes: this.data.totalTime[normalizedName] || 0,
      lastUsed: this.data.applications[normalizedName]?.lastUsed || null,
      sessions: this.data.sessions.filter(s => 
        (s.normalizedName && s.normalizedName === normalizedName) || 
        (!s.normalizedName && s.appName && s.appName.toLowerCase().trim() === normalizedName)
      )
    };
  }

  /**
   * Get time tracking data grouped by date
   */
  getDataByDate(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const sessions = this.data.sessions.filter(session => {
      const sessionDate = new Date(session.startTime);
      return sessionDate >= start && sessionDate <= end;
    });

    // Group by date
    const byDate = {};
    for (const session of sessions) {
      const date = new Date(session.startTime).toISOString().split('T')[0];
      if (!byDate[date]) {
        byDate[date] = [];
      }
      byDate[date].push(session);
    }

    return byDate;
  }

  /**
   * Clean up old sessions (optional, to prevent data from growing too large)
   */
  cleanupOldSessions(daysToKeep = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    this.data.sessions = this.data.sessions.filter(session => {
      return new Date(session.startTime) >= cutoffDate;
    });

    this.saveData();
  }

  /**
   * Stop all active tracking sessions
   */
  stopAllTracking() {
    for (const appName of this.activeSessions.keys()) {
      this.stopTracking(appName);
    }
  }
}

module.exports = { TimeTracker };


