
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { apiCall } from './apiService';

const PREF_KEY = 'app_notification_pref';

export const isNotificationEnabledInApp = (): boolean => {
    return localStorage.getItem(PREF_KEY) !== 'false';
};

export const setNotificationPreference = (enabled: boolean) => {
    localStorage.setItem(PREF_KEY, String(enabled));
};

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
 
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
 
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (Capacitor.isNativePlatform()) {
      try {
          const result = await PushNotifications.requestPermissions();
          const localResult = await LocalNotifications.requestPermissions();
          
          if (Capacitor.getPlatform() === 'android') {
              try {
                  await LocalNotifications.createChannel({
                      id: 'default',
                      name: 'Default',
                      description: 'General Notifications',
                      importance: 5,
                      visibility: 1,
                      vibration: true,
                  });
                  await LocalNotifications.createChannel({
                      id: 'fcm_default_channel',
                      name: 'FCM Default Channel',
                      description: 'FCM Background Alerts',
                      importance: 5,
                      visibility: 1,
                      vibration: true,
                  });
              } catch (e) {
                  console.error('Create channel failed', e);
              }
          }

          if (result.receive === 'granted' || localResult.display === 'granted') {
              await PushNotifications.register();
              return true;
          }
          return false;
      } catch (e) {
          console.error("Push Registration Error:", e);
          return false;
      }
  }

  // Web Logic
  if (!("Notification" in window)) return false;
  
  try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
          await subscribeToPushNotifications();
          return true;
      }
      return false;
  } catch (e) {
      console.error("Web Permission Error:", e);
      return false;
  }
};

export const clearAllActiveNotifications = async () => {
    if (Capacitor.isNativePlatform()) {
        try {
            await PushNotifications.removeAllDeliveredNotifications();
        } catch (e) {
            console.error('Error removing delivered push notifications', e);
        }
        try {
            await LocalNotifications.removeAllDeliveredNotifications();
        } catch (e) {
            console.error('Error removing delivered local notifications', e);
        }
    } else {
        if ("serviceWorker" in navigator) {
            try {
                const reg = await navigator.serviceWorker.ready;
                if (reg && reg.getNotifications) {
                    const activeNotifs = await reg.getNotifications();
                    activeNotifs.forEach(n => n.close());
                }
            } catch (e) {}
        }
    }
};

export const setupNativePushNotifications = async (username: string, role: string) => {
    if (!Capacitor.isNativePlatform()) return;
    try {
        // Clear old listeners first to protect against multiple callbacks
        await PushNotifications.removeAllListeners();

        // 1. Listen for successful registration & get the actual FCM registration token
        await PushNotifications.addListener('registration', async (token) => {
            console.log("FCM registration token achieved:", token.value);
            try {
                // Save token value to push_endpoint so logout can unregister it nicely
                localStorage.setItem('push_endpoint', token.value);

                // Post to /api/subscribe so the server caches this native token securely
                await apiCall('/subscribe', 'POST', {
                    endpoint: token.value,
                    username: username,
                    role: role,
                    type: 'android',
                    deviceType: 'android',
                    keys: {} // Standard parameters
                });
                console.log("FCM push token registered with server for user:", username);
            } catch (e) {
                console.error("Error subscribing FCM token on server", e);
            }
        });

        // 2. Listen for registration failures
        await PushNotifications.addListener('registrationError', (error) => {
            console.error('Capacitor Push Registration Error:', JSON.stringify(error));
        });

        // 3. Listen for foreground push notification reception
        await PushNotifications.addListener('pushNotificationReceived', async (notification) => {
            console.log('FCM Push received in foreground:', notification);
            const data = notification.data || {};
            const idValue = data.id || '';
            
            // Prevent duplicated notification loops if it has already been shown
            if (idValue && hasNotificationBeenShown(idValue)) {
                return;
            }

            // Fire clean local toast/banner on Android screen immediately
            try {
                await LocalNotifications.schedule({
                    notifications: [
                        {
                            title: notification.title || 'اعلان جدید',
                            body: notification.body || '',
                            id: Math.floor(Math.random() * 2147483647),
                            schedule: { at: new Date(Date.now() + 50) },
                            extra: data || null,
                            channelId: 'fcm_default_channel',
                            smallIcon: 'res://ic_launcher',
                            sound: 'default'
                        }
                    ]
                });
                if (idValue) markNotificationAsShown(idValue);
            } catch (err) {
                console.error('Error scheduling local notification for received FCM push', err);
            }
        });

        // Request permissions and trigger register
        const result = await PushNotifications.requestPermissions();
        if (result.receive === 'granted') {
            await PushNotifications.register();
            console.log("PushNotifications registered for user:", username);
        }
    } catch (e) {
        console.error("setupNativePushNotifications setup failed:", e);
    }
};

export const subscribeToPushNotifications = async () => {
    if (Capacitor.isNativePlatform()) return; // Native handled by Capacitor plugin

    try {
        // 1. Get VAPID Key from Server
        const { publicKey } = await apiCall<{publicKey: string}>('/vapid-key');
        if (!publicKey) throw new Error("No VAPID key returned");

        // 2. Get Service Worker Registration
        const registration = await navigator.serviceWorker.ready;
        if (!registration) throw new Error("Service Worker not ready");

        // 3. Subscribe to Push Manager
        const convertedVapidKey = urlBase64ToUint8Array(publicKey);
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
        });

        // 4. Send Subscription to Server
        // We also send user info to allow targeting
        const userStr = localStorage.getItem('app_current_user');
        const user = userStr ? JSON.parse(userStr) : null;

        const subData = subscription.toJSON();
        await apiCall('/subscribe', 'POST', {
            ...subData,
            username: user?.username,
            role: user?.role,
            type: 'web'
        });

        if (subscription.endpoint) {
            localStorage.setItem('push_endpoint', subscription.endpoint);
        }

        console.log("✅ Web Push Subscribed Successfully");
    } catch (e) {
        console.error("Failed to subscribe to push:", e);
    }
};

const shownInMemory = new Set<string>();

export const syncServiceWorkerShownNotifications = async () => {
    try {
        if ('caches' in window) {
            const cache = await caches.open('shown-notifications-v1');
            const requests = await cache.keys();
            const key = 'shown_notifications_log';
            const raw = localStorage.getItem(key);
            const list: string[] = raw ? JSON.parse(raw) : [];
            let updated = false;

            for (const req of requests) {
                const parts = req.url.split('/notification-shown/');
                if (parts.length > 1) {
                    const id = parts[1];
                    shownInMemory.add(id);
                    if (!list.includes(id)) {
                        list.push(id);
                        updated = true;
                    }
                }
            }

            if (updated) {
                if (list.length > 500) list.splice(0, list.length - 500);
                localStorage.setItem(key, JSON.stringify(list));
                console.log('[SWSync] Synchronized service worker shown notifications. New database count:', list.length);
            }
        }
    } catch (e) {
        console.error('Error synchronizing service worker shown notifications', e);
    }
};

export const syncNativeShownNotifications = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
        const { keys } = await Preferences.keys();
        const shownIdsFromNative: string[] = [];
        for (const k of keys) {
            if (k.startsWith('shown_')) {
                const id = k.substring(6); // remove 'shown_'
                shownIdsFromNative.push(id);
            }
        }
        if (shownIdsFromNative.length > 0) {
            const key = 'shown_notifications_log';
            const raw = localStorage.getItem(key);
            const list: string[] = raw ? JSON.parse(raw) : [];
            let updated = false;
            for (const id of shownIdsFromNative) {
                shownInMemory.add(id);
                if (!list.includes(id)) {
                    list.push(id);
                    updated = true;
                }
            }
            if (updated) {
                if (list.length > 500) list.splice(0, list.length - 500);
                localStorage.setItem(key, JSON.stringify(list));
                console.log('[NativeSync] Synchronized native shown notifications count:', shownIdsFromNative.length);
            }
        }
    } catch (e) {
        console.error('Error synchronizing native shown notifications', e);
    }
};

export const hasNotificationBeenShown = (id: string): boolean => {
    if (!id) return false;
    if (shownInMemory.has(id)) return true;
    try {
        const key = 'shown_notifications_log';
        const raw = localStorage.getItem(key);
        const list: string[] = raw ? JSON.parse(raw) : [];
        const found = list.includes(id);
        if (found) {
            shownInMemory.add(id);
        }
        return found;
    } catch {
        return false;
    }
};

export const markNotificationAsShown = (id: string) => {
    if (!id) return;
    shownInMemory.add(id);
    try {
        const key = 'shown_notifications_log';
        const raw = localStorage.getItem(key);
        const list: string[] = raw ? JSON.parse(raw) : [];
        if (!list.includes(id)) {
            list.push(id);
            if (list.length > 500) {
                list.shift();
            }
            localStorage.setItem(key, JSON.stringify(list));
            
            // Sync to native SharedPreferences as well so background worker can see it!
            if (Capacitor.isNativePlatform()) {
                Preferences.set({ key: `shown_${id}`, value: 'true' }).catch(console.error);
            }

            // Sync to Service Worker CacheStorage
            if ('caches' in window) {
                caches.open('shown-notifications-v1').then(cache => {
                    cache.put(
                        new Request(`/notification-shown/${id}`),
                        new Response('true', { headers: { 'Content-Type': 'text/plain' } })
                    ).catch(() => {});
                }).catch(() => {});
            }
        }
    } catch (e) {
        console.error("markNotificationAsShown error", e);
    }
};

let lastNotificationString = '';
let lastNotificationTime = 0;

const getPwaIconUrl = (): string => {
  try {
    const cached = localStorage.getItem('app_data_settings');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.pwaIcon) {
        return parsed.pwaIcon;
      }
    }
  } catch (e) {
    console.error('Failed to parse settings for pwaIcon', e);
  }
  return '/pwa-192x192.png'; // default fallback
};

export const sendNotification = async (title: string, body: string, data?: any) => {
  if (!isNotificationEnabledInApp()) return;
  
  const idValue = data?.id || '';
  if (idValue && hasNotificationBeenShown(idValue)) {
      return; // Already notified on this device, do not duplicate!
  }

  const currentStr = `${title}:${body}`;
  const now = Date.now();
  if (currentStr === lastNotificationString && (now - lastNotificationTime < 5000)) {
      return; // Deduplicate identical notifications fired within 5 seconds
  }
  lastNotificationString = currentStr;
  lastNotificationTime = now;

  if (idValue) {
      markNotificationAsShown(idValue);
  }

  if (Capacitor.isNativePlatform()) {
      try {
          await LocalNotifications.schedule({
              notifications: [
                  {
                      title: title,
                      body: body,
                      id: Math.floor(Math.random() * 2147483647),
                      schedule: { at: new Date(Date.now() + 50) },
                      extra: data || null,
                      channelId: 'fcm_default_channel',
                      smallIcon: 'res://ic_launcher',
                      sound: 'default'
                  }
              ]
          });
      } catch (e) { console.error('LocalNotifications error', e); }
      return;
  }

  if (Notification.permission === "granted") {
      try {
          const iconUrl = getPwaIconUrl();
          // Check if SW is active to show via SW (more reliable)
          const registration = await navigator.serviceWorker.ready;
          if (registration && registration.active) {
              registration.showNotification(title, {
                  body,
                  icon: iconUrl,
                  dir: 'rtl',
                  lang: 'fa',
                  vibrate: [200, 100, 200],
                  tag: idValue || 'general',
                  renotify: true,
                  data: data
              } as any);
          } else {
              new Notification(title, { body, icon: iconUrl, dir: 'rtl', lang: 'fa' });
          }
      } catch (e) {
          console.error("Web Notification Error:", e);
      }
  }
};
