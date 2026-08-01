
import React, { useRef, useState, useEffect } from 'react';
import { Database, DownloadCloud, UploadCloud, Clock, Loader2, CheckCircle, ShieldCheck, FileJson, WifiOff, RefreshCw, FolderOpen, FileArchive, Save } from 'lucide-react';
import { apiCall, LS_KEYS, getServerHost, resolveImageUrl } from '../../services/apiService';
import { saveBlobAndOpenFile, downloadAndOpenFile } from '../../services/fileService';
import { Capacitor } from '@capacitor/core';

const BackupManager: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [restoring, setRestoring] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [message, setMessage] = useState('');
    
    // Auto Backup List
    const [autoBackups, setAutoBackups] = useState<any[]>([]);
    const [loadingBackups, setLoadingBackups] = useState(false);
    
    // Backup Configuration
    const [backupInterval, setBackupInterval] = useState(3);
    const [backupMode, setBackupMode] = useState<'full' | 'db-only'>('full');
    const [savingSettings, setSavingSettings] = useState(false);

    useEffect(() => {
        fetchAutoBackups();
        loadBackupSettings();
    }, []);

    const loadBackupSettings = async () => {
        try {
            const settings = await apiCall<any>('/settings');
            if (settings) {
                setBackupInterval(settings.backupIntervalHours || 3);
                setBackupMode(settings.backupMode || 'full');
            }
        } catch (e) { console.error("Load settings failed", e); }
    };

    const saveBackupSettings = async () => {
        setSavingSettings(true);
        try {
            await apiCall('/settings', 'POST', { 
                backupIntervalHours: backupInterval,
                backupMode: backupMode
            });
            alert('تنظیمات بکاپ با موفقیت ذخیره شد.');
        } catch (e) { alert('خطا در ذخیره تنظیمات'); }
        finally { setSavingSettings(false); }
    };

    const fetchAutoBackups = async () => {
        setLoadingBackups(true);
        try {
            const data = await apiCall<any[]>('/backups/list');
            setAutoBackups(data || []);
        } catch(e) {
            console.error("Failed to load backups", e);
        } finally {
            setLoadingBackups(false);
        }
    };

    // Helper to read local storage safely
    const getLocalJSON = (key: string, defaultVal: any = []) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultVal;
        } catch (e) { return defaultVal; }
    };

    const downloadBlob = (blob: Blob, filename: string) => {
        saveBlobAndOpenFile(blob, filename);
    };

    const handleDownloadBackup = async () => {
        setDownloading(true);
        setMessage('');
        
        try {
            // 1. Try Server Backup (Best Quality - Complete DB + Uploads)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for ZIP generation

            // Request the ZIP backup from new endpoint
            const host = getServerHost() || '';
            const baseUrl = host ? `${host}/api` : '/api';
            const response = await fetch(`${baseUrl}/full-backup`, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!response.ok) throw new Error("Server Download Failed");
            
            const blob = await response.blob();
            const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            downloadBlob(blob, `Full_System_Backup_${dateStr}.zip`);
            
        } catch (e) {
            console.warn("Server unreachable or timeout, switching to Offline Mode...", e);
            
            // 2. Fallback: Offline Backup (From LocalStorage) - JSON Only
            // IMPORTANT: We must include ALL data keys to ensure full backup
            try {
                // Try to fetch current state from server API first if possible (even if backup zip failed)
                // If not, fallback to localStorage cache
                
                let offlineData: any = {};
                
                try {
                    // Attempt quick API fetch for non-cached critical data
                    const [secLogs, delays, incidents, permits] = await Promise.all([
                        apiCall('/security/logs').catch(()=>[]),
                        apiCall('/security/delays').catch(()=>[]),
                        apiCall('/security/incidents').catch(()=>[]),
                        apiCall('/exit-permits').catch(()=>[])
                    ]);
                    
                    offlineData.securityLogs = secLogs;
                    offlineData.personnelDelays = delays;
                    offlineData.securityIncidents = incidents;
                    offlineData.exitPermits = permits;
                } catch(err) {
                    console.warn("Could not fetch fresh data for offline backup, using defaults");
                }

                const localData = {
                    settings: getLocalJSON(LS_KEYS.SETTINGS, {}),
                    users: getLocalJSON(LS_KEYS.USERS, []),
                    // Payment
                    orders: getLocalJSON(LS_KEYS.ORDERS, []),
                    // Warehouse
                    warehouseItems: getLocalJSON(LS_KEYS.WH_ITEMS, []),
                    warehouseTransactions: getLocalJSON(LS_KEYS.WH_TX, []),
                    // Trade
                    tradeRecords: getLocalJSON(LS_KEYS.TRADE, []),
                    // Chat
                    messages: getLocalJSON(LS_KEYS.CHAT, []),
                    groups: getLocalJSON(LS_KEYS.GROUPS, []),
                    tasks: getLocalJSON(LS_KEYS.TASKS, []),
                    // Merged Security & Exits (from API fetch above or empty if offline)
                    exitPermits: offlineData.exitPermits || [], 
                    securityLogs: offlineData.securityLogs || [],
                    personnelDelays: offlineData.personnelDelays || [],
                    securityIncidents: offlineData.securityIncidents || [],
                    
                    meta: { 
                        source: 'offline_browser_cache', 
                        date: new Date().toISOString(),
                        note: 'Offline Mode - JSON Data Only (No Files)'
                    }
                };

                const jsonStr = JSON.stringify(localData, null, 2);
                const blob = new Blob([jsonStr], { type: "application/json" });
                const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                
                downloadBlob(blob, `Offline_Cache_Backup_${dateStr}.json`);
                
                alert('⚠️ هشدار: ارتباط با سرور برای دانلود فایل ZIP برقرار نشد.\n\n✅ فایل پشتیبان JSON (داده‌های متنی) تهیه شد.\nتوجه: این نسخه شامل فایل‌های آپلود شده (تصاویر/PDF) نمی‌باشد.');
            } catch (err) {
                alert("خطا در ایجاد بکاپ آفلاین.");
            }
        } finally {
            setDownloading(false);
        }
    };

    const handleRestoreClick = () => {
        if (confirm('⚠️ هشدار بازگردانی:\n\nآیا مطمئن هستید؟ این عملیات تمام اطلاعات فعلی را جایگزین می‌کند.\n\nنکته: اگر فایل ZIP آپلود کنید، تمام فایل‌های چت، اسناد و تصاویر نیز بازیابی می‌شوند.\nفایل‌های JSON فقط دیتابیس را برمی‌گردانند.')) {
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setRestoring(true);
        setMessage('');

        const reader = new FileReader();
        reader.onload = async (ev) => {
            const base64 = ev.target?.result as string;
            try {
                const response = await apiCall<{success: boolean, mode: string}>('/emergency-restore', 'POST', { fileData: base64 });
                if (response.success) {
                    const modeMsg = response.mode === 'zip' ? '(کامل به همراه فایل‌ها)' : '(داده‌های متنی)';
                    alert(`✅ بازگردانی هوشمند ${modeMsg} با موفقیت انجام شد.\nسیستم جهت اعمال تغییرات رفرش می‌شود.`);
                    window.location.reload();
                } else {
                    throw new Error("Restore failed on server");
                }
            } catch (error) {
                setMessage('❌ خطا در بازگردانی. فایل نامعتبر است.');
                setRestoring(false);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // Reset input
    };

    const handleDownloadAutoBackup = (filename: string) => {
        const path = `/api/backups/download/${filename}`;
        
        if (Capacitor.isNativePlatform()) {
            const url = resolveImageUrl(path);
            downloadAndOpenFile(url, filename);
        } else {
            // For Web: use relative path if no host set (standard behavior)
            const host = getServerHost();
            const url = host ? `${host}${path}` : path;
            window.open(url, '_blank');
        }
    };

    return (
        <div className="glass-panel p-6 rounded-2xl border border-gray-200/50 dark:border-white/10 shadow-sm relative overflow-hidden animate-fade-in mb-6">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Database size={100}/>
            </div>
            
            <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 relative z-10 text-lg border-b pb-2">
                <Database size={24} className="text-blue-600"/> 
                مدیریت پشتیبان‌گیری و بازیابی (فول سیستم)
            </h3>
            
            {/* Auto-Backup Status */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 relative z-10">
                <div className="flex items-start gap-3 mb-3">
                    <div className="bg-green-100 p-2 rounded-full">
                        <Clock size={20} className="text-green-600 animate-pulse"/>
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-center mb-2">
                             <span className="text-sm font-bold text-green-800 block">پشتیبان‌گیری خودکار</span>
                             <button onClick={saveBackupSettings} disabled={savingSettings} className="bg-green-600 text-white text-[10px] px-3 py-1 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1">
                                 {savingSettings ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>} ذخیره تنظیمات
                             </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="glass-panel p-2 rounded-lg border border-green-200">
                                <label className="text-[10px] text-gray-500 block mb-1">بازه زمانی (ساعت)</label>
                                <select value={backupInterval} onChange={e => setBackupInterval(Number(e.target.value))} className="w-full text-xs font-bold text-green-800 bg-transparent">
                                    {[1, 2, 3, 6, 12, 24, 48].map(h => <option key={h} value={h}>{h} ساعت</option>)}
                                </select>
                            </div>
                            <div className="glass-panel p-2 rounded-lg border border-green-200">
                                <label className="text-[10px] text-gray-500 block mb-1">نوع بکاپ</label>
                                <select value={backupMode} onChange={e => setBackupMode(e.target.value as any)} className="w-full text-xs font-bold text-green-800 bg-transparent">
                                    <option value="full">کامل (دیتابیس + فایل‌ها)</option>
                                    <option value="db-only">فقط دیتابیس (سریع‌تر)</option>
                                </select>
                            </div>
                        </div>
                        <p className="text-[10px] text-green-700 leading-relaxed">
                            سیستم طبق بازه زمانی انتخابی شما، پشتیبان تهیه می‌کند. نسخه پشتیبان شامل {backupMode === 'full' ? 'تمام دیتابیس و فایل‌های آپلود شده' : 'فقط اطلاعات متنی دیتابیس'} می‌باشد.
                        </p>
                    </div>
                </div>
                
                {/* Auto Backup List */}
                <div className="glass-panel rounded-lg border border-green-100 overflow-hidden">
                    <div className="p-2 bg-green-100 flex justify-between items-center">
                        <span className="text-xs font-bold text-green-800 flex items-center gap-1"><FolderOpen size={14}/> آرشیو بکاپ‌های خودکار</span>
                        <button onClick={fetchAutoBackups} className="text-green-700 hover:bg-green-200 p-1 rounded"><RefreshCw size={14} className={loadingBackups ? "animate-spin" : ""}/></button>
                    </div>
                    <div className="max-h-32 overflow-y-auto">
                        {loadingBackups ? (
                            <div className="p-4 text-center text-xs text-gray-400">در حال بارگذاری...</div>
                        ) : autoBackups.length === 0 ? (
                            <div className="p-4 text-center text-xs text-gray-400">هیچ بکاپ خودکاری یافت نشد.</div>
                        ) : (
                            autoBackups.map((backup, idx) => (
                                <div key={idx} className="flex justify-between items-center p-2 text-xs border-b last:border-0 hover:bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-700">{backup.name}</span>
                                        <span className="text-[10px] text-gray-400">{new Date(backup.date).toLocaleString('fa-IR')} - {(backup.size / 1024 / 1024).toFixed(2)} MB</span>
                                    </div>
                                    <button onClick={() => handleDownloadAutoBackup(backup.name)} className="text-blue-600 hover:underline font-bold px-2">دانلود</button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                {/* Download Section */}
                <div className="space-y-3">
                    <h4 className="text-sm font-bold text-gray-700 mb-2">تهیه نسخه پشتیبان دستی</h4>
                    <button 
                        type="button" 
                        onClick={handleDownloadBackup} 
                        disabled={downloading}
                        className="w-full flex items-center justify-between bg-blue-50 hover:bg-blue-100 text-blue-800 px-4 py-4 rounded-xl text-sm font-bold transition-colors border border-blue-200 shadow-sm"
                    >
                        <span className="flex items-center gap-2">
                            {downloading ? <Loader2 size={20} className="animate-spin"/> : <DownloadCloud size={20}/>} 
                            دانلود کامل (ZIP: دیتابیس + فایل‌ها)
                        </span>
                        <span className="text-[10px] glass-panel px-2 py-1 rounded border border-blue-100 text-blue-600 flex items-center gap-1">
                            <FileArchive size={12}/>
                        </span>
                    </button>
                    
                    <div className="text-[10px] text-gray-500 leading-relaxed bg-gray-50 p-3 rounded-lg border">
                        <div className="flex items-center gap-1 font-bold text-gray-700 mb-1"><FileJson size={12}/> محتویات فایل بکاپ:</div>
                        <ul className="list-disc list-inside grid grid-cols-2 gap-x-2 gap-y-1">
                            <li>تمام اطلاعات دیتابیس</li>
                            <li>تصاویر و ویس‌های چت</li>
                            <li>اسناد PDF و اکسل</li>
                            <li>عکس‌های پرسنلی</li>
                            <li>تمام منوهای سیستم</li>
                        </ul>
                    </div>
                </div>

                {/* Restore Section */}
                <div className="border-r-0 md:border-r border-gray-100 md:pr-6">
                    <h4 className="text-sm font-bold text-gray-700 mb-2">بازیابی اطلاعات (Smart Restore)</h4>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept=".json,.txt,.zip" />
                    
                    <button 
                        type="button" 
                        onClick={handleRestoreClick} 
                        disabled={restoring} 
                        className="w-full h-[120px] flex flex-col items-center justify-center gap-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border-2 border-dashed border-amber-300 px-4 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        {restoring ? <Loader2 size={36} className="animate-spin"/> : <UploadCloud size={36} className="group-hover:scale-110 transition-transform"/>}
                        {restoring ? 'در حال بازگردانی و استخراج...' : 'آپلود فایل بکاپ (JSON یا ZIP)'}
                        {!restoring && <span className="text-[10px] opacity-70 font-normal bg-white/50 px-2 py-0.5 rounded">پشتیبانی از فایل‌های حجیم</span>}
                    </button>
                    
                    {message && (
                        <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded text-center font-bold border border-red-100">
                            {message}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BackupManager;
