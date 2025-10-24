'use client';

import { useState, useEffect } from 'react';

interface UpdateInfo {
  version: string;
  releaseNotes: string;
  downloadUrl: string;
  currentVersion: string;
}

export default function ManualUpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only run in Electron environment
    if (typeof window !== 'undefined' && window.electronAPI) {
      // Listen for manual update notifications
      const handleUpdateAvailable = (info: UpdateInfo) => {
        console.log('📦 Manual update available:', info);
        setUpdateInfo(info);
        setIsVisible(true);
      };

      // Check if the new event listener methods exist
      if (window.electronAPI.on) {
        window.electronAPI.on('manual-update-available', handleUpdateAvailable);
        
        // Cleanup
        return () => {
          if (window.electronAPI?.removeListener) {
            window.electronAPI.removeListener('manual-update-available', handleUpdateAvailable);
          }
        };
      }
    }
  }, []);

  const handleDownload = async () => {
    if (window.electronAPI) {
      try {
        // Use the openDownload method if available, otherwise fall back to invoke
        if (window.electronAPI.openDownload) {
          await window.electronAPI.openDownload();
        } else if (window.electronAPI.invoke) {
          await window.electronAPI.invoke('updater:open-download');
        }
        setIsVisible(false);
      } catch (error) {
        console.error('Error opening download:', error);
      }
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible || !updateInfo) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md bg-white border border-gray-200 rounded-lg shadow-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            🎉 Update Available!
          </h3>
          <p className="text-sm text-gray-600 mb-2">
            Version {updateInfo.version} is now available
          </p>
          <p className="text-xs text-gray-500 mb-3">
            Current version: {updateInfo.currentVersion}
          </p>
          
          {updateInfo.releaseNotes && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-700 mb-1">What's new:</p>
              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                {updateInfo.releaseNotes.split('\n').slice(0, 3).map((line, index) => (
                  <p key={index} className="mb-1">{line}</p>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              Download Update
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors"
            >
              Later
            </button>
          </div>
        </div>
        
        <button
          onClick={handleDismiss}
          className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}