'use client';

import { useEffect, useState } from 'react';

interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
}

interface DownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

export function UpdateNotification() {
  const [state, setState] = useState<UpdateState>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if we're in Electron
    if (typeof window === 'undefined' || !window.electronAPI) {
      return;
    }

    // Setup update event listeners
    window.electronAPI.onUpdateEvent?.((event: string, data: any) => {
      console.log('🔄 Update event received:', event, data);

      switch (event) {
        case 'checking':
          setState('checking');
          setIsVisible(false); // Don't show notification for checking
          break;

        case 'available':
          setState('available');
          setUpdateInfo(data);
          setIsVisible(true);
          break;

        case 'not-available':
          setState('idle');
          setIsVisible(false);
          break;

        case 'download-progress':
          setState('downloading');
          setDownloadProgress(data);
          setIsVisible(true);
          break;

        case 'downloaded':
          setState('ready');
          setUpdateInfo(data);
          setIsVisible(true);
          break;

        case 'error':
          setState('error');
          setErrorMessage(data.message || 'Unknown error occurred');
          setIsVisible(true);
          break;
      }
    });

    // Cleanup listeners on unmount
    return () => {
      window.electronAPI?.removeUpdateListeners?.();
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
  };

  const handleDownload = async () => {
    if (!window.electronAPI?.downloadUpdate) return;

    try {
      const result = await window.electronAPI.downloadUpdate();
      if (!result.success) {
        console.error('❌ Failed to start download:', result.error);
      }
    } catch (error) {
      console.error('❌ Error downloading update:', error);
    }
  };

  const handleInstall = async () => {
    if (!window.electronAPI?.quitAndInstall) return;

    try {
      await window.electronAPI.quitAndInstall();
    } catch (error) {
      console.error('❌ Error installing update:', error);
    }
  };

  // Don't render if not in Electron or not visible
  if (typeof window === 'undefined' || !window.electronAPI || !isVisible) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-5 right-5 w-[360px] max-w-[calc(100vw-40px)] bg-gradient-to-br from-purple-600 to-indigo-700 text-white rounded-xl shadow-2xl p-5 z-[10000] transition-all duration-300 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0 pointer-events-none'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 font-semibold text-base">
          {state === 'available' && '🚀 Update Available'}
          {state === 'downloading' && '📥 Downloading Update'}
          {state === 'ready' && '✅ Update Ready'}
          {state === 'error' && '❌ Update Error'}
        </div>
        <button
          onClick={handleClose}
          className="bg-white/20 hover:bg-white/30 border-0 text-white cursor-pointer rounded-md px-2 py-1 text-lg leading-none transition-colors"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="mb-4 text-sm leading-relaxed opacity-95">
        {state === 'available' && (
          <>
            <div className="font-semibold mb-1">Version {updateInfo?.version || 'Unknown'}</div>
            <div>A new version of Colabify is available!</div>
          </>
        )}

        {state === 'downloading' && (
          <>
            <div>Downloading update...</div>
            <div className="mt-3">
              <div className="w-full h-1.5 bg-white/30 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-white rounded-full transition-all duration-300"
                  style={{ width: `${Math.round(downloadProgress?.percent || 0)}%` }}
                />
              </div>
              <div className="text-xs opacity-90 text-center">
                {Math.round(downloadProgress?.percent || 0)}%
              </div>
            </div>
          </>
        )}

        {state === 'ready' && (
          <>
            <div className="font-semibold mb-1">Version {updateInfo?.version || 'Unknown'}</div>
            <div>Update has been downloaded and is ready to install.</div>
          </>
        )}

        {state === 'error' && <div>{errorMessage || 'An error occurred while checking for updates.'}</div>}
      </div>

      {/* Actions */}
      <div className="flex gap-2.5">
        {state === 'available' && (
          <>
            <button
              onClick={handleClose}
              className="flex-1 py-2.5 px-4 border-0 rounded-lg text-sm font-semibold cursor-pointer transition-all bg-white/20 text-white hover:bg-white/30"
            >
              Later
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 py-2.5 px-4 border-0 rounded-lg text-sm font-semibold cursor-pointer transition-all bg-white text-purple-600 hover:-translate-y-0.5 hover:shadow-lg"
            >
              Download
            </button>
          </>
        )}

        {state === 'ready' && (
          <>
            <button
              onClick={handleClose}
              className="flex-1 py-2.5 px-4 border-0 rounded-lg text-sm font-semibold cursor-pointer transition-all bg-white/20 text-white hover:bg-white/30"
            >
              Later
            </button>
            <button
              onClick={handleInstall}
              className="flex-1 py-2.5 px-4 border-0 rounded-lg text-sm font-semibold cursor-pointer transition-all bg-white text-purple-600 hover:-translate-y-0.5 hover:shadow-lg"
            >
              Restart & Install
            </button>
          </>
        )}

        {state === 'error' && (
          <button
            onClick={handleClose}
            className="flex-1 py-2.5 px-4 border-0 rounded-lg text-sm font-semibold cursor-pointer transition-all bg-white text-purple-600"
          >
            OK
          </button>
        )}
      </div>
    </div>
  );
}
