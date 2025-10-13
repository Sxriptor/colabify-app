declare global {
  interface Window {
    electronAPI?: {
      showNotification: (data: { title: string; body: string; icon?: string }) => Promise<{ success: boolean }>;
      requestNotificationPermission: () => Promise<'granted' | 'denied'>;
      openExternalUrl: (url: string) => Promise<{ success: boolean }>;
      onAuthCallback: (callback: (url: string) => void) => void;
      removeAuthCallback: () => void;
      startSignIn: () => Promise<{ success: boolean; user?: any; error?: string }>;
      logout: () => Promise<{ success: boolean }>;
      getUser: () => Promise<any>;
      isAuthenticated: () => Promise<boolean>;
      onAuthSuccess: (callback: (data: { user: any; subscriptionStatus?: string }) => void) => void;
      onAuthError: (callback: (error: string) => void) => void;
      onAuthSignedOut: (callback: () => void) => void;
      removeAuthListeners: () => void;
      apiCall: (endpoint: string, options?: any) => Promise<any>;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      platform: string;
      isElectron: boolean;
    };
  }
}

export {};
