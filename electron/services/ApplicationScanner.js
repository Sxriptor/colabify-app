const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Path to application list - try txt.md first, then get-scan.js as fallback
const txtMdPath = path.join(__dirname, '../../txt.md');
const getScanPath = path.join(__dirname, '../../get-scan.js');

class ApplicationScanner {
  constructor() {
    this.platform = process.platform;
    this.applicationList = null; // Lazy load
  }

  /**
   * Load application list from txt.md (primary) or get-scan.js (fallback)
   * STRICT MODE: If list is empty, return empty - don't scan all apps
   */
  loadApplicationList() {
    if (this.applicationList !== null) {
      return this.applicationList;
    }

    // Try txt.md first, then get-scan.js as fallback
    let filePath = null;
    if (fs.existsSync(txtMdPath)) {
      filePath = txtMdPath;
      console.log('📄 Loading application list from txt.md');
    } else if (fs.existsSync(getScanPath)) {
      filePath = getScanPath;
      console.log('📄 Loading application list from get-scan.js');
    }

    if (!filePath) {
      console.warn('⚠️ No application list file found (txt.md or get-scan.js)');
      console.log('ℹ️ Will only scan applications that match the list (strict mode)');
      this.applicationList = { Applications: {} };
      return this.applicationList;
    }

    try {
      let fileContent = fs.readFileSync(filePath, 'utf8');
      
      // Remove any trailing whitespace and newlines
      fileContent = fileContent.trim();
      
      if (!fileContent || fileContent.length === 0) {
        console.warn('⚠️ Application list file is empty');
        this.applicationList = { Applications: {} };
        return this.applicationList;
      }
      
      // The file contains JSON, but might have trailing content - extract just the JSON object
      // Find the first { and last } to extract the JSON
      const firstBrace = fileContent.indexOf('{');
      const lastBrace = fileContent.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonContent = fileContent.substring(firstBrace, lastBrace + 1).trim();
        
        // Try to parse the JSON
        try {
          this.applicationList = JSON.parse(jsonContent);
          const categoryCount = Object.keys(this.applicationList.Applications || {}).length;
          const totalApps = Object.values(this.applicationList.Applications || {})
            .reduce((sum, apps) => sum + (Array.isArray(apps) ? apps.length : 0), 0);
          console.log(`✅ Loaded application list with ${categoryCount} categories, ${totalApps} applications`);
        } catch (parseError) {
          console.error('❌ Failed to parse application list as JSON:', parseError.message);
          this.applicationList = { Applications: {} };
        }
      } else {
        console.error('❌ Could not find JSON object in application list file');
        this.applicationList = { Applications: {} };
      }
    } catch (error) {
      console.error('❌ Error loading application list:', error.message);
      this.applicationList = { Applications: {} };
    }

    return this.applicationList;
  }

  /**
   * Scan for installed applications based on the platform
   */
  async scanInstalledApplications() {
    console.log('🔍 Scanning for installed applications on', this.platform);
    
    // Ensure application list is loaded
    this.loadApplicationList();
    
    const installedApps = [];
    
    if (this.platform === 'win32') {
      return await this.scanWindowsApplications();
    } else if (this.platform === 'darwin') {
      return await this.scanMacApplications();
    } else if (this.platform === 'linux') {
      return await this.scanLinuxApplications();
    }
    
    return installedApps;
  }

  /**
   * Scan Windows applications from registry and common install locations
   */
  async scanWindowsApplications() {
    const apps = [];
    const applicationList = this.loadApplicationList();
    const categories = applicationList.Applications || {};
    
    // Common Windows installation paths
    const installPaths = [
      'C:\\Program Files',
      'C:\\Program Files (x86)',
      process.env.LOCALAPPDATA + '\\Programs',
      process.env.APPDATA + '\\Microsoft\\Windows\\Start Menu\\Programs'
    ];
    
    // Desktop path
    const desktopPath = process.env.USERPROFILE ? 
      path.join(process.env.USERPROFILE, 'Desktop') : 
      path.join(process.env.HOME || 'C:\\Users\\Public', 'Desktop');

    // Scan registry for installed applications
    try {
      const { stdout } = await execAsync(
        'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall" /s'
      );
      
      const lines = stdout.split('\n');
      let currentApp = {};
      let currentKey = '';
      
      for (const line of lines) {
        // Track the registry key
        if (line.includes('HKEY_')) {
          currentKey = line.trim();
          currentApp = {}; // Reset for new key
        } else if (line.includes('DisplayName')) {
          const match = line.match(/REG_SZ\s+(.+)/);
          if (match) {
            currentApp.name = match[1].trim();
          }
        } else if (line.includes('DisplayIcon') && currentApp.name) {
          const match = line.match(/REG_SZ\s+(.+)/);
          if (match) {
            let iconPath = match[1].trim();
            // DisplayIcon often contains the main executable (sometimes with index)
            // Format: "C:\Path\app.exe,0" - extract just the path
            iconPath = iconPath.split(',')[0].replace(/"/g, '');
            currentApp.icon = iconPath;
            // If DisplayIcon is an .exe, it's often the main executable
            if (iconPath.endsWith('.exe') && !this.isInstallerOrUninstaller(path.basename(iconPath).toLowerCase())) {
              currentApp.possibleExe = iconPath;
            }
          }
        } else if (line.includes('InstallLocation') && currentApp.name) {
          const match = line.match(/REG_SZ\s+(.+)/);
          if (match) {
            currentApp.path = match[1].trim();
          }
        } else if (line.includes('UninstallString') && currentApp.name) {
          // Save app and reset
          if (this.isAppInList(currentApp.name, categories)) {
            let executable = null;
            
            // Special handling for Visual Studio Code
            if (currentApp.name.toLowerCase().includes('visual studio code') || 
                currentApp.name.toLowerCase() === 'code') {
              console.log(`🔍 Special handling for VS Code - InstallLocation: ${currentApp.path}, DisplayIcon: ${currentApp.possibleExe}`);
              
              // VS Code common installation paths (check these first)
              const commonVSCodePaths = [
                path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'Code.exe'),
                path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft VS Code', 'Code.exe'),
                path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft VS Code', 'Code.exe'),
                path.join(process.env.APPDATA || '', 'Local', 'Programs', 'Microsoft VS Code', 'Code.exe')
              ];
              
              // Check common paths first
              for (const vsCodePath of commonVSCodePaths) {
                if (fs.existsSync(vsCodePath)) {
                  executable = vsCodePath;
                  console.log(`✅ Found VS Code executable in common location: ${vsCodePath}`);
                  break;
                }
              }
              
              // VS Code executable is typically "Code.exe" in the install directory
              if (!executable && currentApp.path) {
                // Make sure the path doesn't contain "Git" (common false positive)
                if (!currentApp.path.toLowerCase().includes('\\git\\') && 
                    !currentApp.path.toLowerCase().includes('/git/')) {
                  // Try Code.exe (capital C) first
                  const codeExe = path.join(currentApp.path, 'Code.exe');
                  if (fs.existsSync(codeExe)) {
                    executable = codeExe;
                    console.log(`✅ Found VS Code executable: ${codeExe}`);
                  } else {
                    // Try code.exe (lowercase)
                    const codeExeLower = path.join(currentApp.path, 'code.exe');
                    if (fs.existsSync(codeExeLower)) {
                      executable = codeExeLower;
                      console.log(`✅ Found VS Code executable: ${codeExeLower}`);
                    }
                  }
                } else {
                  console.warn(`⚠️ VS Code InstallLocation appears to be in Git directory, skipping: ${currentApp.path}`);
                }
              }
              
              // Also check DisplayIcon - it often points directly to code.exe
              if (!executable && currentApp.possibleExe && fs.existsSync(currentApp.possibleExe)) {
                const iconExe = currentApp.possibleExe.toLowerCase();
                // Make sure it's actually code.exe, not something else
                if ((iconExe.includes('code.exe') || iconExe.endsWith('code.exe')) && 
                    !this.isInstallerOrUninstaller(iconExe) &&
                    !iconExe.includes('git') && // Exclude Git's code.exe if it exists
                    !iconExe.includes('od.exe') && // Definitely exclude od.exe
                    !iconExe.includes('\\git\\') && // Exclude Git paths
                    !iconExe.includes('/git/')) {
                  executable = currentApp.possibleExe;
                  console.log(`✅ Found VS Code executable from DisplayIcon: ${currentApp.possibleExe}`);
                } else {
                  console.warn(`⚠️ DisplayIcon for VS Code looks wrong: ${currentApp.possibleExe}`);
                }
              }
              
              // DO NOT use findExecutable for VS Code - it's too unreliable and finds wrong files
              // Instead, if we still don't have it, skip this entry
              if (!executable) {
                console.error(`❌ Could not find valid VS Code executable. InstallLocation: ${currentApp.path}, DisplayIcon: ${currentApp.possibleExe}`);
              }
            } else {
              // For other apps, try DisplayIcon first
              if (currentApp.possibleExe && fs.existsSync(currentApp.possibleExe)) {
                const iconExe = currentApp.possibleExe.toLowerCase();
                if (!this.isInstallerOrUninstaller(iconExe)) {
                  executable = currentApp.possibleExe;
                }
              }
              
              // Otherwise, search in InstallLocation
              if (!executable && currentApp.path) {
                executable = this.findExecutable(currentApp.name, currentApp.path);
              }
            }
            
            // Only add if we found a valid executable (not installer/uninstaller)
            if (executable) {
              // Final validation - make sure executable is not in Git directory (common false positive)
              const execPathLower = executable.toLowerCase();
              if (execPathLower.includes('\\git\\') || execPathLower.includes('/git/')) {
                console.warn(`⚠️ Skipping ${currentApp.name} - executable is in Git directory: ${executable}`);
              } else {
                // For VS Code, validate it's actually code.exe
                const appNameLower = currentApp.name.toLowerCase();
                if ((appNameLower.includes('visual studio code') || appNameLower === 'code')) {
                  const exeName = path.basename(executable).toLowerCase();
                  if (exeName !== 'code.exe' && exeName !== 'code') {
                    console.warn(`⚠️ Skipping ${currentApp.name} - executable is not code.exe: ${executable}`);
                  } else {
                    apps.push({
                      name: currentApp.name,
                      category: this.findCategory(currentApp.name, categories),
                      path: currentApp.path || path.dirname(executable),
                      icon: currentApp.icon || '',
                      executable: executable
                    });
                    console.log(`✅ Added ${currentApp.name} with executable: ${executable}`);
                  }
                } else {
                  apps.push({
                    name: currentApp.name,
                    category: this.findCategory(currentApp.name, categories),
                    path: currentApp.path || path.dirname(executable),
                    icon: currentApp.icon || '',
                    executable: executable
                  });
                  console.log(`✅ Added ${currentApp.name} with executable: ${executable}`);
                }
              }
            } else {
              console.log(`⚠️ Skipping ${currentApp.name} - no valid executable found`);
            }
          }
          currentApp = {};
        }
      }
    } catch (error) {
      console.error('Error scanning Windows registry:', error);
    }

    // Also scan common install paths
    for (const installPath of installPaths) {
      if (fs.existsSync(installPath)) {
        try {
          const entries = fs.readdirSync(installPath, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const appName = entry.name;
              if (this.isAppInList(appName, categories)) {
                const appPath = path.join(installPath, appName);
                const executable = this.findExecutable(appName, appPath);
                // Only add if we found a valid executable (not installer/uninstaller)
                if (executable && fs.existsSync(executable)) {
                  // Double-check it's not an installer/uninstaller
                  const exeName = path.basename(executable).toLowerCase();
                  if (!this.isInstallerOrUninstaller(exeName)) {
                    apps.push({
                      name: appName,
                      category: this.findCategory(appName, categories),
                      path: appPath,
                      executable: executable
                    });
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error scanning ${installPath}:`, error);
        }
      }
    }

    // Scan Desktop for shortcuts and executables
    if (fs.existsSync(desktopPath)) {
      try {
        console.log('🔍 Scanning Desktop for applications...');
        const entries = fs.readdirSync(desktopPath, { withFileTypes: true });
        for (const entry of entries) {
          const entryPath = path.join(desktopPath, entry.name);
          let appName = entry.name;
          
          // Handle .lnk shortcuts (Windows shortcuts)
          if (entry.name.endsWith('.lnk')) {
            appName = entry.name.replace('.lnk', '');
            // Try to extract target from shortcut (simplified - in production you'd use a library)
            // For now, just use the shortcut name
          } else if (entry.name.endsWith('.exe')) {
            appName = entry.name.replace('.exe', '');
          }
          
          // Check if this app is in our list
          if (this.isAppInList(appName, categories)) {
            // If it's an exe, check it's not an installer/uninstaller
            if (entry.name.endsWith('.exe') && fs.existsSync(entryPath)) {
              const exeName = entry.name.toLowerCase();
              if (!this.isInstallerOrUninstaller(exeName)) {
                apps.push({
                  name: appName,
                  category: this.findCategory(appName, categories),
                  path: desktopPath,
                  executable: entryPath
                });
              }
            } else if (entry.name.endsWith('.lnk')) {
              // For shortcuts, try to find the actual executable
              // Search in common locations
              const searchPaths = [
                'C:\\Program Files',
                'C:\\Program Files (x86)',
                process.env.LOCALAPPDATA + '\\Programs'
              ];
              
              for (const searchPath of searchPaths) {
                const possibleExe = this.findExecutable(appName, searchPath);
                if (possibleExe && fs.existsSync(possibleExe)) {
                  const exeName = path.basename(possibleExe).toLowerCase();
                  if (!this.isInstallerOrUninstaller(exeName)) {
                    apps.push({
                      name: appName,
                      category: this.findCategory(appName, categories),
                      path: desktopPath,
                      executable: possibleExe
                    });
                    break; // Found a valid executable, stop searching
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error scanning Desktop:', error);
      }
    }

    // Remove duplicates and prioritize correct entries
    const uniqueApps = [];
    const seen = new Map(); // Map of normalized name (lowercase) -> best app entry
    
    for (const app of apps) {
      const appNameLower = app.name.toLowerCase().trim();
      
      // Special handling for VS Code duplicates - normalize all variants
      if (appNameLower.includes('visual studio code') || 
          appNameLower === 'code' ||
          appNameLower.includes('vscode')) {
        const key = 'visual studio code'; // Normalize all VS Code variants to one key
        
        // Only consider entries with valid code.exe
        const hasValidCodeExe = app.executable && 
          fs.existsSync(app.executable) && 
          path.basename(app.executable).toLowerCase() === 'code.exe';
        
        if (!hasValidCodeExe) {
          console.log(`⚠️ Skipping VS Code entry without valid code.exe: ${app.name} - ${app.executable}`);
          continue; // Skip entries without valid code.exe
        }
        
        if (!seen.has(key)) {
          seen.set(key, app);
        } else {
          // Compare and keep the better one
          const existing = seen.get(key);
          
          // Prioritize entries with valid executables
          const existingHasValidExe = existing.executable && 
            fs.existsSync(existing.executable) && 
            path.basename(existing.executable).toLowerCase() === 'code.exe';
          
          // Prefer "Microsoft Visual Studio Code" over just "Visual Studio Code"
          const currentIsMicrosoft = app.name.toLowerCase().includes('microsoft');
          const existingIsMicrosoft = existing.name.toLowerCase().includes('microsoft');
          
          // Keep the better one
          if (currentIsMicrosoft && !existingIsMicrosoft) {
            seen.set(key, app); // Prefer Microsoft version
          } else if (!currentIsMicrosoft && existingIsMicrosoft) {
            // Keep existing Microsoft version
          } else if (app.executable && !existing.executable) {
            seen.set(key, app);
          } else if (app.name.length > existing.name.length) {
            // Prefer longer/more descriptive name
            seen.set(key, app);
          }
          // Otherwise keep existing
        }
      } else {
        // For other apps, use normalized lowercase name as key to handle case variations
        if (!seen.has(appNameLower)) {
          seen.set(appNameLower, app);
        } else {
          // If duplicate, prefer the one with a valid executable
          const existing = seen.get(appNameLower);
          
          // Helper to check if name is in title case (first letter uppercase, rest lowercase or proper case)
          const isTitleCase = (name) => {
            if (name.length === 0) return false;
            const firstChar = name[0];
            return firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase();
          };
          
          if (app.executable && fs.existsSync(app.executable) && 
              (!existing.executable || !fs.existsSync(existing.executable))) {
            seen.set(appNameLower, app);
          } else if (existing.executable && fs.existsSync(existing.executable) && 
                     (!app.executable || !fs.existsSync(app.executable))) {
            // Keep existing if it has valid executable and current doesn't
          } else if (isTitleCase(app.name) && !isTitleCase(existing.name)) {
            // Prefer title case names (e.g., "Cursor" over "cursor")
            seen.set(appNameLower, app);
          } else if (app.name.length > existing.name.length) {
            // Prefer longer/more descriptive name
            seen.set(appNameLower, app);
          }
          // Otherwise keep existing
        }
      }
    }
    
    // Convert map to array
    for (const app of seen.values()) {
      uniqueApps.push(app);
    }

    return uniqueApps;
  }

  /**
   * Scan macOS applications from /Applications and Desktop
   */
  async scanMacApplications() {
    const apps = [];
    const applicationList = this.loadApplicationList();
    const categories = applicationList.Applications || {};
    
    // Scan /Applications
    const applicationsPath = '/Applications';
    if (fs.existsSync(applicationsPath)) {
      try {
        console.log('🔍 Scanning /Applications...');
        const entries = fs.readdirSync(applicationsPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name.endsWith('.app')) {
            const appName = entry.name.replace('.app', '');
            if (this.isAppInList(appName, categories)) {
              const appPath = path.join(applicationsPath, entry.name);
              const executablePath = path.join(appPath, 'Contents', 'MacOS', appName);
              // Check if executable exists, otherwise try to find it
              let executable = executablePath;
              if (!fs.existsSync(executablePath)) {
                // Try to find executable in Contents/MacOS
                try {
                  const macosPath = path.join(appPath, 'Contents', 'MacOS');
                  if (fs.existsSync(macosPath)) {
                    const macosFiles = fs.readdirSync(macosPath);
                    if (macosFiles.length > 0) {
                      executable = path.join(macosPath, macosFiles[0]);
                    }
                  }
                } catch (e) {
                  // Use default path
                }
              }
              
              apps.push({
                name: appName,
                category: this.findCategory(appName, categories),
                path: appPath,
                executable: executable
              });
            }
          }
        }
      } catch (error) {
        console.error('Error scanning /Applications:', error);
      }
    }

    // Scan Desktop
    const desktopPath = path.join(process.env.HOME || '/Users', process.env.USER || 'user', 'Desktop');
    if (fs.existsSync(desktopPath)) {
      try {
        console.log('🔍 Scanning Desktop...');
        const entries = fs.readdirSync(desktopPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name.endsWith('.app')) {
            const appName = entry.name.replace('.app', '');
            if (this.isAppInList(appName, categories)) {
              const appPath = path.join(desktopPath, entry.name);
              const executablePath = path.join(appPath, 'Contents', 'MacOS', appName);
              
              apps.push({
                name: appName,
                category: this.findCategory(appName, categories),
                path: appPath,
                executable: executablePath
              });
            }
          }
        }
      } catch (error) {
        console.error('Error scanning Desktop:', error);
      }
    }

    return apps;
  }

  /**
   * Scan Linux applications from common locations and Desktop
   */
  async scanLinuxApplications() {
    const apps = [];
    const applicationList = this.loadApplicationList();
    const categories = applicationList.Applications || {};
    
    // Common Linux application locations
    const desktopPaths = [
      path.join(process.env.HOME || '', '.local/share/applications'),
      '/usr/share/applications',
      '/usr/local/share/applications'
    ];

    // Scan .desktop files
    for (const desktopPath of desktopPaths) {
      if (fs.existsSync(desktopPath)) {
        try {
          console.log(`🔍 Scanning ${desktopPath}...`);
          const files = fs.readdirSync(desktopPath);
          for (const file of files) {
            if (file.endsWith('.desktop')) {
              const desktopFile = path.join(desktopPath, file);
              const content = fs.readFileSync(desktopFile, 'utf8');
              const nameMatch = content.match(/Name=(.+)/);
              const execMatch = content.match(/Exec=(.+)/);
              
              if (nameMatch && execMatch) {
                const appName = nameMatch[1].trim();
                if (this.isAppInList(appName, categories)) {
                  apps.push({
                    name: appName,
                    category: this.findCategory(appName, categories),
                    path: execMatch[1].trim(),
                    executable: execMatch[1].trim()
                  });
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error scanning ${desktopPath}:`, error);
        }
      }
    }

    // Scan Desktop for .desktop files and executables
    const userDesktopPath = path.join(process.env.HOME || '', 'Desktop');
    if (fs.existsSync(userDesktopPath)) {
      try {
        console.log('🔍 Scanning Desktop...');
        const entries = fs.readdirSync(userDesktopPath, { withFileTypes: true });
        for (const entry of entries) {
          const entryPath = path.join(userDesktopPath, entry.name);
          
          if (entry.name.endsWith('.desktop')) {
            const content = fs.readFileSync(entryPath, 'utf8');
            const nameMatch = content.match(/Name=(.+)/);
            const execMatch = content.match(/Exec=(.+)/);
            
            if (nameMatch && execMatch) {
              const appName = nameMatch[1].trim();
              if (this.isAppInList(appName, categories)) {
                apps.push({
                  name: appName,
                  category: this.findCategory(appName, categories),
                  path: execMatch[1].trim(),
                  executable: execMatch[1].trim()
                });
              }
            }
          } else if (!entry.isDirectory() && fs.statSync(entryPath).mode & parseInt('111', 8)) {
            // Check if it's an executable file
            const appName = entry.name;
            if (this.isAppInList(appName, categories)) {
              apps.push({
                name: appName,
                category: this.findCategory(appName, categories),
                path: userDesktopPath,
                executable: entryPath
              });
            }
          }
        }
      } catch (error) {
        console.error('Error scanning Desktop:', error);
      }
    }

    return apps;
  }

  /**
   * Check if an application name matches any in the list
   * STRICT MODE: If categories is empty, return false (don't include app)
   */
  isAppInList(appName, categories) {
    // STRICT MODE: If no categories defined, exclude all applications
    if (!categories || Object.keys(categories).length === 0) {
      return false;
    }
    
    const normalizedName = appName.toLowerCase().trim();
    
    // Check all categories for matching app names
    for (const categoryApps of Object.values(categories)) {
      if (Array.isArray(categoryApps)) {
        for (const listApp of categoryApps) {
          const normalizedListApp = listApp.toLowerCase().trim();
          
          // Exact match
          if (normalizedName === normalizedListApp) {
            return true;
          }
          
          // Check if app name contains list app name or vice versa
          // But be more strict - require significant match
          if (normalizedName.includes(normalizedListApp) || 
              normalizedListApp.includes(normalizedName)) {
            // Additional check: make sure it's not just a partial word match
            // e.g., "Code" should match "Visual Studio Code" but not "Coder"
            const words = normalizedName.split(/\s+/);
            const listWords = normalizedListApp.split(/\s+/);
            
            // If either is a single word, check if it's contained as a whole word
            if (words.length === 1 || listWords.length === 1) {
              // Check if the shorter one is a complete word in the longer one
              const shorter = words.length === 1 ? words[0] : listWords[0];
              const longer = words.length === 1 ? normalizedListApp : normalizedName;
              
              // Match if shorter is a complete word in longer (with word boundaries)
              if (longer.includes(shorter) && 
                  (longer.startsWith(shorter + ' ') || 
                   longer.endsWith(' ' + shorter) ||
                   longer.includes(' ' + shorter + ' ') ||
                   longer === shorter)) {
                return true;
              }
            } else {
              // Multi-word match - check if significant words match
              const commonWords = words.filter(w => listWords.includes(w));
              if (commonWords.length >= Math.min(words.length, listWords.length) * 0.5) {
                return true;
              }
            }
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Find which category an application belongs to
   */
  findCategory(appName, categories) {
    // If no categories defined, use "Other"
    if (!categories || Object.keys(categories).length === 0) {
      return 'Other';
    }
    
    const normalizedName = appName.toLowerCase();
    
    for (const [category, apps] of Object.entries(categories)) {
      if (Array.isArray(apps)) {
        for (const app of apps) {
          if (normalizedName.includes(app.toLowerCase()) || 
              app.toLowerCase().includes(normalizedName)) {
            return category;
          }
        }
      }
    }
    
    return 'Other';
  }

  /**
   * Check if an executable is an installer/uninstaller (should be skipped)
   */
  isInstallerOrUninstaller(exeName) {
    const normalized = exeName.toLowerCase();
    const installerPatterns = [
      'uninstall',
      'installer',
      'install',
      'setup',
      'setup.exe',
      'install.exe',
      'uninstall.exe',
      'installer.exe',
      'msiexec',
      'wix',
      'nsis',
      'inno',
      'update',
      'updater',
      'patch',
      'repair',
      'remove',
      'deinstall',
      'unins',
      'remove.exe',
      'repair.exe',
      'update.exe',
      'updater.exe'
    ];
    
    return installerPatterns.some(pattern => normalized.includes(pattern));
  }

  /**
   * Find executable file for an application (skips installers/uninstallers)
   */
  findExecutable(appName, appPath) {
    if (!appPath || !fs.existsSync(appPath)) {
      return null;
    }

    const normalizedName = appName.toLowerCase();
    const exeName = normalizedName.replace(/\s+/g, '').replace(/[^a-z0-9]/gi, '');
    
    // Priority order for finding executables
    const searchPaths = [
      appPath, // Root directory
      path.join(appPath, 'bin'),
      path.join(appPath, 'Bin'),
      path.join(appPath, 'BIN'),
      path.join(appPath, 'exe'),
      path.join(appPath, 'Exe'),
      path.join(appPath, 'EXE'),
      path.join(appPath, 'app'),
      path.join(appPath, 'App'),
      path.join(appPath, 'APP'),
      path.join(appPath, 'runtime'),
      path.join(appPath, 'Runtime'),
      path.join(appPath, 'RUNTIME')
    ];

    // Collect all potential executables with priority scores
    const candidates = [];

    for (const searchPath of searchPaths) {
      if (!fs.existsSync(searchPath)) {
        continue;
      }

      try {
        const entries = fs.readdirSync(searchPath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isFile() && entry.name.endsWith('.exe')) {
            const exePath = path.join(searchPath, entry.name);
            const exeNameLower = entry.name.toLowerCase();
            
            // Skip installers/uninstallers
            if (this.isInstallerOrUninstaller(exeNameLower)) {
              continue;
            }
            
            // Calculate priority score (higher = better match)
            let priority = 0;
            const exeNameNoExt = entry.name.replace('.exe', '').toLowerCase();
            
            // Special cases for known applications
            // Visual Studio Code -> code.exe
            if (normalizedName.includes('visual studio code') && exeNameNoExt === 'code') {
              priority = 200; // Highest priority
            }
            // Code (short name) -> code.exe
            else if (normalizedName === 'code' && exeNameNoExt === 'code') {
              priority = 200;
            }
            // Exact match with app name gets highest priority
            else if (exeNameNoExt === normalizedName || exeNameNoExt === exeName) {
              priority = 100;
            }
            // App name contains exe name or vice versa (check word by word)
            else if (normalizedName.includes(exeNameNoExt) || exeNameNoExt.includes(normalizedName)) {
              // Check if any word in app name matches the exe name
              const appWords = normalizedName.split(/\s+/);
              if (appWords.some(word => word === exeNameNoExt || exeNameNoExt === word)) {
                priority = 90; // High priority for word match
              } else {
                priority = 80;
              }
            }
            // Common application executable names
            else if (['app', 'application', 'launcher', 'main', 'run'].includes(exeNameNoExt)) {
              priority = 60;
            }
            // Root directory executables get higher priority than subdirectories
            else if (searchPath === appPath) {
              priority = 50;
            }
            // Bin/exe directories get medium priority
            else if (searchPath.toLowerCase().includes('bin') || searchPath.toLowerCase().includes('exe')) {
              priority = 40;
            }
            // Other executables
            else {
              priority = 20;
            }
            
            candidates.push({ path: exePath, priority, name: entry.name });
          }
        }
      } catch (error) {
        // Continue searching other paths
        continue;
      }
    }

    // Sort by priority (highest first) and return the best match
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.priority - a.priority);
      const bestMatch = candidates[0];
      console.log(`✅ Found executable for ${appName}: ${bestMatch.name} (priority: ${bestMatch.priority})`);
      return bestMatch.path;
    }

    // If no good match found, try a deeper recursive search (but still skip installers)
    try {
      const findExeRecursive = (dir, depth = 0, maxDepth = 3) => {
        if (depth > maxDepth) return null;
        
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          
          for (const entry of entries) {
            const entryPath = path.join(dir, entry.name);
            
            if (entry.isFile() && entry.name.endsWith('.exe')) {
              const exeNameLower = entry.name.toLowerCase();
              
              // Skip installers/uninstallers
              if (this.isInstallerOrUninstaller(exeNameLower)) {
                continue;
              }
              
              // Prefer executables that match the app name
              const exeNameNoExt = entry.name.replace('.exe', '').toLowerCase();
              if (normalizedName.includes(exeNameNoExt) || exeNameNoExt.includes(normalizedName)) {
                return entryPath;
              }
            } else if (entry.isDirectory()) {
              // Skip common directories that don't contain main executables
              const dirNameLower = entry.name.toLowerCase();
              if (['temp', 'tmp', 'cache', 'logs', 'log', 'doc', 'docs', 'help', 'samples', 'examples'].includes(dirNameLower)) {
                continue;
              }
              
              const found = findExeRecursive(entryPath, depth + 1, maxDepth);
              if (found) return found;
            }
          }
        } catch (error) {
          // Continue searching
        }
        
        return null;
      };
      
      const found = findExeRecursive(appPath);
      if (found) {
        console.log(`✅ Found executable for ${appName} (deep search): ${path.basename(found)}`);
        return found;
      }
    } catch (error) {
      console.error(`Error in recursive search for ${appName}:`, error);
    }

    console.warn(`⚠️ Could not find valid executable for ${appName} in ${appPath}`);
    return null;
  }
}

module.exports = { ApplicationScanner };

