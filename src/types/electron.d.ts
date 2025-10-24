declare global {
  interface Window {
    electronAPI?: {
      // Notification API
      showNotification: (data: { title: string; body: string; icon?: string }) => Promise<{ success: boolean }>;
      requestNotificationPermission: () => Promise<{ status: 'granted' | 'denied'; reason?: string; needsSystemSettings?: boolean }>;
      checkNotificationPermission: () => Promise<{ status: 'granted' | 'denied'; reason?: string; needsSystemSettings?: boolean }>;

      // OAuth / Browser API
      openExternalUrl: (url: string) => Promise<{ success: boolean }>;
      onAuthCallback: (callback: (url: string) => void) => void;
      removeAuthCallback: () => void;
      
      // Auth functions
      startSignIn: () => Promise<any>;
      logout: () => Promise<any>;
      getUser: () => Promise<any>;
      isAuthenticated: () => Promise<boolean>;
      getToken: () => Promise<string | null>;
      getGitHubToken: () => Promise<string | null>;
      hasGitHubToken: () => Promise<boolean>;
      hasUserPAT: () => Promise<boolean>;

      // API calls with stored token
      apiCall: (endpoint: string, options?: any) => Promise<any>;

      // Auth event listeners
      onAuthSuccess: (callback: (data: any) => void) => void;
      onAuthError: (callback: (error: any) => void) => void;
      onAuthSignedOut: (callback: () => void) => void;
      removeAuthListeners: () => void;

      // Navigation
      onNavigateToInbox: (callback: () => void) => void;
      removeNavigationListeners: () => void;

      // Platform information
      platform: string;
      isElectron: boolean;
      
      // File system operations
      selectFolder: () => Promise<{ success: boolean; folderPath?: string; canceled?: boolean; error?: string }>;
      testFolderSelection: () => Promise<{ success: boolean; message?: string }>;
      
      // Test events
      onTestEvent: (callback: (data: any) => void) => void;

      // Git operations
      git: {
        watchProject: (projectId: string, on: boolean) => Promise<any>;
        listProjectRepos: (projectId: string) => Promise<any>;
        getRepoState: (repoId: string) => Promise<any>;
        connectRepoToProject: (projectId: string, path: string) => Promise<any>;
        readDirectGitState: (path: string) => Promise<any>;
        readCompleteHistory: (path: string, options?: any) => Promise<any>;
        onEvent: (callback: (data: any) => void) => void;
        removeEventListeners: () => void;
      };

      // Update API
      checkForUpdates: () => Promise<{ success: boolean; error?: string }>;
      downloadUpdate?: () => Promise<{ success: boolean; error?: string }>;
      quitAndInstall?: () => Promise<{ success: boolean; error?: string }>;
      openDownload?: () => Promise<{ success: boolean; error?: string }>;
      
      // Update event listeners (legacy auto-updater)
      onUpdateEvent?: (callback: (event: string, data: any) => void) => void;
      removeUpdateListeners?: () => void;
      
      // Generic invoke method
      invoke: (channel: string, ...args: any[]) => Promise<any>;

      // Event listeners (for manual updates)
      on?: (event: string, callback: (data: any) => void) => void;
      removeListener?: (event: string, callback: (data: any) => void) => void;
      removeAllListeners?: (event: string) => void;
    };
  }
}

export {};