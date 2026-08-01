
import { PaymentOrder, User, UserRole, SystemSettings, ChatMessage, ChatGroup, GroupTask, TradeRecord, WarehouseItem, WarehouseTransaction } from '../types';
import { INITIAL_ORDERS } from '../constants';
import { Capacitor } from '@capacitor/core';

// تنظیمات آدرس سرور
let DEFAULT_SERVER_URL = 'https://dlkam.ir'; 

export const getServerHost = () => {
    // Check if we are running strictly in the Cloud Run/AI Studio preview environment in the browser
    const isDevEnvironment = !Capacitor.isNativePlatform() && (
        window.location.hostname.includes('run.app') || 
        window.location.hostname.includes('google.com')
    );

    if (isDevEnvironment) {
        // If a stored server host is found in sandbox, we clear it because it causes loading/CORS errors
        if (localStorage.getItem('app_server_host')) {
            try { localStorage.removeItem('app_server_host'); } catch (e) {}
        }
        return '';
    }

    const stored = localStorage.getItem('app_server_host');
    if (stored) return stored.trim().replace(/\/$/, '');
    if (Capacitor.isNativePlatform()) {
        if (DEFAULT_SERVER_URL) return DEFAULT_SERVER_URL.replace(/\/$/, '');
    }
    return '';
};

export const resolveImageUrl = (url: string | null | undefined): string => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
    }
    const host = getServerHost();
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    
    // On web, if no host is configured, we use relative paths to current origin.
    // On native, getServerHost() will return either stored host or DEFAULT_SERVER_URL.
    if (!host && !Capacitor.isNativePlatform()) {
        return cleanUrl;
    }
    
    // Fallback for native or if host is set
    const effectiveHost = host || DEFAULT_SERVER_URL;
    return `${effectiveHost}${cleanUrl}`;
};

export const setServerHost = (url: string) => {
    const cleanUrl = url.trim().replace(/\/$/, '');
    localStorage.setItem('app_server_host', cleanUrl);
};

const isNativeApp = Capacitor.isNativePlatform();

const MOCK_USERS: User[] = [
    { id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم (آفلاین)', role: UserRole.ADMIN, canManageTrade: true }
];

export const LS_KEYS = {
    ORDERS: 'app_data_orders',
    USERS: 'app_data_users',
    SETTINGS: 'app_data_settings',
    CHAT: 'app_data_chat',
    GROUPS: 'app_data_groups',
    TASKS: 'app_data_tasks',
    TRADE: 'app_data_trade',
    WH_ITEMS: 'app_data_wh_items',
    WH_TX: 'app_data_wh_tx',
    NOTES: 'app_data_notes',
    EXIT_PERMITS: 'app_data_exit_permits',
    PURCHASE_REQS: 'app_data_purchase_reqs',
    ANNOUNCEMENTS: 'app_data_announcements',
    TASK_GROUPS: 'app_data_task_groups'
};

// Exported so App.tsx can use it for instant load
export const getLocalData = <T>(key: string, defaultData: T): T => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultData;
    } catch {
        return defaultData;
    }
};

export const apiCall = async <T>(endpoint: string, method: string = 'GET', body?: any): Promise<T> => {
    try {
        const controller = new AbortController();
        // Increased timeout significantly for mobile networks AND large file uploads (300s)
        const timeoutId = setTimeout(() => controller.abort(), 300000); 

        let baseUrl = '';
        const host = getServerHost();

        if (isNativeApp) {
            if (!host) {
                throw new Error("SERVER_URL_MISSING");
            }
            baseUrl = `${host}/api`;
        } else {
            if (host) {
                baseUrl = `${host}/api`;
            } else {
                baseUrl = '/api';
            }
        }

        // Ensure endpoint starts with /
        const safeEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        // Prevent double //api/api if someone passes full path erroneously, though baseUrl handles prefix
        const finalUrl = `${baseUrl}${safeEndpoint}`;

        console.log(`API calling: ${method} ${finalUrl}`); 

        const response = await fetch(finalUrl, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const contentType = response.headers.get("content-type");
        const isJson = contentType && contentType.includes("application/json");

        if (response.ok) {
            let data;
            if (isJson) {
                try {
                    data = await response.json();
                } catch (jsonErr) {
                    throw new Error("پاسخ سرور در قالب معتبر JSON نبود. احتمالاً مشکلی در پروکسی یا شبکه وجود دارد.");
                }
            } else {
                data = { success: true } as unknown as T;
            }

            // --- CACHING ENABLED ---
            // Crucial for Android app to prevent "raw/empty" state if network fluctuates
            if (method === 'GET') {
                try {
                    if (endpoint === '/orders') localStorage.setItem(LS_KEYS.ORDERS, JSON.stringify(data));
                    else if (endpoint === '/users') localStorage.setItem(LS_KEYS.USERS, JSON.stringify(data));
                    else if (endpoint === '/settings') localStorage.setItem(LS_KEYS.SETTINGS, JSON.stringify(data));
                    else if (endpoint === '/chat') localStorage.setItem(LS_KEYS.CHAT, JSON.stringify(data));
                    else if (endpoint === '/trade') localStorage.setItem(LS_KEYS.TRADE, JSON.stringify(data));
                    else if (endpoint === '/customer-balances') localStorage.setItem('app_data_balances', JSON.stringify(data));
                    else if (endpoint === '/customer-balances/chat-codes') localStorage.setItem('app_data_balances_mappings', JSON.stringify(data));
                    else if (endpoint === '/customer-balances/statements/all') localStorage.setItem('app_data_balances_statements', JSON.stringify(data));
                    else if (endpoint === '/warehouse/items') localStorage.setItem(LS_KEYS.WH_ITEMS, JSON.stringify(data));
                    else if (endpoint === '/warehouse/transactions') localStorage.setItem(LS_KEYS.WH_TX, JSON.stringify(data));
                    else if (endpoint === '/notes') localStorage.setItem(LS_KEYS.NOTES, JSON.stringify(data));
                    else if (endpoint === '/exit-permits') localStorage.setItem(LS_KEYS.EXIT_PERMITS, JSON.stringify(data));
                    else if (endpoint === '/purchase-requests') localStorage.setItem(LS_KEYS.PURCHASE_REQS, JSON.stringify(data));
                    else if (endpoint === '/announcements') localStorage.setItem(LS_KEYS.ANNOUNCEMENTS, JSON.stringify(data));
                    else if (endpoint === '/groups') localStorage.setItem(LS_KEYS.GROUPS, JSON.stringify(data));
                    else if (endpoint === '/task-groups') localStorage.setItem(LS_KEYS.TASK_GROUPS, JSON.stringify(data));
                    else if (endpoint === '/tasks') localStorage.setItem(LS_KEYS.TASKS, JSON.stringify(data));
                } catch (cacheError) {
                    console.warn("Cache write failed (storage full?)", cacheError);
                }
            }
            
            return data;
        } else {
            // Attempt to parse server error message
            let serverErrorMsg = `خطای سرور: ${response.status}`;
            if (isJson) {
                try {
                    const errData = await response.json();
                    if (errData && errData.error) {
                        serverErrorMsg = errData.error;
                    }
                } catch (e) {
                    // Fallback to text if JSON parse failed
                }
            } else {
                try {
                    const text = await response.text();
                    if (text && text.length < 500 && !text.startsWith('<!')) {
                        serverErrorMsg = text;
                    }
                } catch (e) {}
            }
            throw new Error(serverErrorMsg);
        }

    } catch (error: any) {
        
        if (error.message === "SERVER_URL_MISSING") {
            throw error; 
        }

        console.warn(`API Error for ${endpoint}:`, error);

        if (endpoint === '/login' && method === 'POST') {
             // Let login handle specific connection errors if needed, but usually we just throw
             // If we are here, it means fetch failed completely (network) or server returned error
             if (error.message.includes("Server Error") || (error.message && error.message.includes("خطا"))) throw error; 
             throw new Error('اتصال به سرور برقرار نشد. آدرس سرور یا اینترنت را بررسی کنید.');
        }

        // --- CACHE FALLBACK (READ-ONLY) ---
        // If network fails, return cached data to prevent empty UI
        if (method === 'GET') {
            if (endpoint === '/orders') return getLocalData<any>(LS_KEYS.ORDERS, INITIAL_ORDERS);
            if (endpoint === '/trade') return getLocalData<any>(LS_KEYS.TRADE, []);
            if (endpoint === '/customer-balances') return getLocalData<any>('app_data_balances', { balances: [] });
            if (endpoint === '/customer-balances/chat-codes') return getLocalData<any>('app_data_balances_mappings', []);
            if (endpoint === '/customer-balances/statements/all') return getLocalData<any>('app_data_balances_statements', []);
            if (endpoint === '/warehouse/items') return getLocalData<any>(LS_KEYS.WH_ITEMS, []);
            if (endpoint === '/warehouse/transactions') return getLocalData<any>(LS_KEYS.WH_TX, []);
            if (endpoint === '/settings') return getLocalData<any>(LS_KEYS.SETTINGS, { currentTrackingNumber: 1000 });
            if (endpoint === '/chat') return getLocalData<any>(LS_KEYS.CHAT, []);
            if (endpoint === '/users') return getLocalData<any>(LS_KEYS.USERS, MOCK_USERS);
            if (endpoint === '/notes') return getLocalData<any>(LS_KEYS.NOTES, []);
            if (endpoint === '/exit-permits') return getLocalData<any>(LS_KEYS.EXIT_PERMITS, []);
            if (endpoint === '/purchase-requests') return getLocalData<any>(LS_KEYS.PURCHASE_REQS, []);
            if (endpoint === '/announcements') return getLocalData<any>(LS_KEYS.ANNOUNCEMENTS, []);
            if (endpoint === '/groups') return getLocalData<any>(LS_KEYS.GROUPS, []);
            if (endpoint === '/task-groups') return getLocalData<any>(LS_KEYS.TASK_GROUPS, []);
            if (endpoint === '/tasks') return getLocalData<any>(LS_KEYS.TASKS, []);
        }
        
        throw error;
    }
};
