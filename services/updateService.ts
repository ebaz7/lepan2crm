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

// Check for updates by querying /api/version
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

    const serverBuild = data.buildNumber || data.version;
    const serverVer = data.version || data.buildNumber;
    const serverSig = `${serverVer}_${serverBuild}_${data.timestamp || 0}`;

    // Get the build signature that this specific browser session first booted with
    let sessionBootSig = typeof window !== 'undefined' ? sessionStorage.getItem('client_boot_sig') : null;
    if (!sessionBootSig) {
      // First check upon page load: record the boot signature
      sessionBootSig = CURRENT_CLIENT_BUILD.version;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('client_boot_sig', sessionBootSig);
      }
    }

    // Check if user already clicked update for this specific server release signature
    const lastApplied = typeof window !== 'undefined' ? localStorage.getItem('last_applied_release_sig') : null;
    if (lastApplied && lastApplied === serverSig) {
      return { hasUpdate: false, serverInfo: data };
    }

    const currentBuild = CURRENT_CLIENT_BUILD.buildNumber;
    const currentVer = CURRENT_CLIENT_BUILD.version;

    // Check if server version, build number or timestamp indicates a new update
    const hasVersionDiff = (serverBuild && serverBuild !== currentBuild) || 
                           (serverVer && serverVer !== currentVer) ||
                           (sessionBootSig && sessionBootSig !== serverVer && sessionBootSig !== serverSig);

    return {
      hasUpdate: Boolean(hasVersionDiff),
      serverInfo: data
    };
  } catch (error) {
    console.debug('Update check failed (offline or network error):', error);
    return { hasUpdate: false, serverInfo: null };
  }
}

// Publish a new update to all clients
export async function publishApplicationUpdate(payload: {
  version: string;
  title?: string;
  releaseNotes?: string;
  sendToBots?: boolean;
}): Promise<{ success: boolean; data?: AppVersionInfo; error?: string }> {
  try {
    const res = await fetch('/api/version/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'خطا در انتشار به‌روزرسانی' };
    }

    // Notify window components immediately
    if (typeof window !== 'undefined') {
      localStorage.removeItem('last_applied_release_sig');
      window.dispatchEvent(new CustomEvent('app:update-published', { detail: data }));
    }

    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message || 'خطا در برقراری ارتباط با سرور' };
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

    // 3. Send automated backup to bots before applying update
    try {
      await fetch('/api/backups/send-to-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: `پشتیبان خودکار قبل از بروزرسانی به نسخه ${serverInfo?.version || serverInfo?.buildNumber || 'جدید'}` })
      });
    } catch (botErr) {
      console.warn('Backup to bot before update note:', botErr);
    }

    // 4. Mark update signature
    if (serverInfo) {
      const serverSig = `${serverInfo.version}_${serverInfo.buildNumber}_${serverInfo.timestamp || 0}`;
      localStorage.setItem('last_applied_release_sig', serverSig);
    }
  } catch (e) {
    console.error('Error during applyApplicationUpdate:', e);
  } finally {
    // 5. Force hard reload with cache-buster parameter
    const cleanUrl = window.location.origin + window.location.pathname;
    window.location.replace(`${cleanUrl}?_update=${Date.now()}`);
  }
}
