export interface AppVersionInfo {
  version: string;
  buildNumber: string;
  title?: string;
  releaseNotes?: string;
  timestamp?: number;
}

// Current client build embedded in the bundle
export const CURRENT_CLIENT_BUILD: AppVersionInfo = {
  version: '1.3.1',
  buildNumber: '20260831.101',
  title: 'نسخه جاری',
  releaseNotes: 'نسخه پایدار سامانه مالی و بازرگانی'
};

// Check for updates by querying /api/version and checking ServiceWorker lifecycle
export async function checkServerUpdate(): Promise<{ hasUpdate: boolean; serverInfo: AppVersionInfo | null }> {
  try {
    const res = await fetch(`/api/version?t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });
    
    if (!res.ok) {
      return { hasUpdate: false, serverInfo: null };
    }

    const data: AppVersionInfo = await res.json();
    if (!data || (!data.version && !data.buildNumber)) {
      return { hasUpdate: false, serverInfo: null };
    }

    const currentBuild = CURRENT_CLIENT_BUILD.buildNumber;
    const currentVer = CURRENT_CLIENT_BUILD.version;
    const serverBuild = data.buildNumber || data.version;
    const serverVer = data.version || data.buildNumber;

    // Check if server version or build is different from current client bundle
    const hasVersionDiff = (serverBuild && serverBuild !== currentBuild) || (serverVer && serverVer !== currentVer);

    return {
      hasUpdate: hasVersionDiff,
      serverInfo: data
    };
  } catch (error) {
    console.debug('Update check failed (offline or network error):', error);
    return { hasUpdate: false, serverInfo: null };
  }
}

// Apply update: clear caches, instruct SW to skip waiting, and reload
export async function applyApplicationUpdate(serverInfo?: AppVersionInfo | null): Promise<void> {
  try {
    // 1. Tell Service Worker to skip waiting
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        try {
          await reg.update();
        } catch (e) {}
      }
    }

    // 2. Clear stale cache storage
    if ('caches' in window) {
      try {
        const cacheKeys = await caches.keys();
        await Promise.all(
          cacheKeys.map(key => {
            if (key !== 'auth-session-v1' && key !== 'shown-notifications-v1') {
              return caches.delete(key);
            }
            return Promise.resolve(true);
          })
        );
      } catch (e) {
        console.warn('Failed clearing caches:', e);
      }
    }

    // 3. Mark update timestamp
    if (serverInfo) {
      localStorage.setItem('last_applied_build', serverInfo.buildNumber || serverInfo.version);
    }
  } catch (e) {
    console.error('Error during applyApplicationUpdate:', e);
  } finally {
    // 4. Force hard reload with cache-buster parameter
    const cleanUrl = window.location.origin + window.location.pathname;
    window.location.replace(`${cleanUrl}?_update=${Date.now()}`);
  }
}
