'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Component that listens for navigation events from the Electron tray menu
 * and handles navigation within the Next.js app
 */
export function TrayNavigationListener() {
  const router = useRouter();

  useEffect(() => {
    // Only set up listeners in Electron environment
    if (typeof window === 'undefined' || !window.electronAPI) {
      return;
    }

    console.log('🎧 Setting up tray navigation listener');

    // Handle navigation to inbox when triggered from tray menu
    const handleNavigateToInbox = () => {
      console.log('📬 Navigating to inbox from tray menu');
      router.push('/inbox');
    };

    // Set up the listener
    window.electronAPI.onNavigateToInbox(handleNavigateToInbox);

    // Cleanup on unmount
    return () => {
      if (window.electronAPI?.removeNavigationListeners) {
        console.log('🧹 Cleaning up tray navigation listeners');
        window.electronAPI.removeNavigationListeners();
      }
    };
  }, [router]);

  // This component doesn't render anything
  return null;
}

