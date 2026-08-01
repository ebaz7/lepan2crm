
import React, { useState } from 'react';
import { SystemSettings, UserRole, RolePermissions, CustomRole } from '../../types';
import { ShieldCheck, Truck, Warehouse, Lock, ChevronDown, ChevronUp, Landmark, Trash2, CheckSquare, Square, Info, ClipboardList, ShoppingCart, Pencil, Check, FileText } from 'lucide-react';

interface Props {
    settings: SystemSettings;
    onUpdateSettings: (newSettings: SystemSettings) => void;
}

const PERMISSION_GROUPS = [
    { 
        id: 'purchase', 
        title: 'ماژول خرید', 
        icon: ShoppingCart, 
        color: 'amber', 
        items: [
            { id: 'canView', label: 'مشاهده ماژول درخواست خرید (کارتابل)' },
            { id: 'canCreate', label: 'ثبت درخواست خرید جدید (واحد فنی)' },
            { id: 'canApproveTechnical', label: 'بررسی و تایید فنی نت (مرحله اول)' },
            { id: 'canApproveShiftLeader', label: 'تایید سرشیفت (مرحله دوم)' },
            { id: 'canApproveWarehouseKeeper', label: 'بررسی موجودی توسط انباردار کارخانه (مرحله سوم)' },
            { id: 'canApproveFactoryDecision', label: 'تایید و تعیین مسیر خرید توسط مدیر کارخانه (مرحله چهارم)' },
            { id: 'canApproveFactory', label: 'تایید مدیر کارخانه (مراحل ثانویه)' },
            { id: 'canApproveCEO', label: 'تایید مدیرعامل / مدیر واحد (تهران)' },
            { id: 'canManageProformas', label: 'ثبت پیش‌فاکتورها و استعلام (بازرگانی)' },
            { id: 'canSelectProforma', label: 'انتخاب بهترین گزینه خرید' },
            { id: 'canRegisterEntry', label: 'ثبت ورود فیزیکی کالا (انتظامات)' },
            { id: 'canCheckQC', label: 'تایید کنترل کیفیت (QC)' },
            { id: 'canApproveFactoryFinal', label: 'تایید نهایی مدیر کارخانه (بعد از ورود)' },
            { id: 'canWarehouseFinalize', label: 'صدور رسید انبار نهایی' },
            { id: 'canCommercialFinalize', label: 'تایید نهایی و بایگانی بازرگانی' },
        ] 
    },
    { 
        id: 'payment', 
        title: 'ماژول پرداخت', 
        icon: Landmark, 
        color: 'blue', 
        items: [
            { id: 'canCreatePaymentOrder', label: 'ثبت دستور پرداخت جدید' },
            { id: 'canViewPaymentOrders', label: 'مشاهده کارتابل پرداخت' },
            { id: 'canApproveFinancial', label: 'تایید مرحله مالی' },
            { id: 'canApproveManager', label: 'تایید مرحله مدیریت' },
            { id: 'canApproveCeo', label: 'تایید مرحله نهایی (مدیرعامل)' }
        ] 
    }, 
    { 
        id: 'exit', 
        title: 'ماژول خروج کارخانه', 
        icon: Truck, 
        color: 'orange', 
        items: [
            { id: 'canCreateExitPermit', label: 'ثبت درخواست خروج بار (فروش)' },
            { id: 'canViewInvoices', label: 'مشاهده کارتابل فاکتورها' },
            { id: 'canViewExitPermits', label: 'مشاهده کارتابل خروج کارخانه' },
            { id: 'canApproveExitCeo', label: 'تایید خروج (مدیرعامل)' },
            { id: 'canApproveExitFactory', label: 'تایید خروج (مدیر کارخانه)' },
            { id: 'canApproveExitWarehouse', label: 'تایید خروج (سرپرست انبار/توزین)' },
            { id: 'canApproveExitSecurity', label: 'تایید خروج (انتظامات - نهایی)' },
            { id: 'canViewExitArchive', label: 'مشاهده بایگانی خروج' },
            { id: 'canEditExitArchive', label: 'اصلاح اسناد بایگانی (Admin)' },
            { id: 'canCancelExitPermit', label: 'ابطال/کنسلی برگه خروج کارخانه' }
        ] 
    }, 
    { 
        id: 'warehouse', 
        title: 'ماژول انبار', 
        icon: Warehouse, 
        color: 'green', 
        items: [
            { id: 'canManageWarehouse', label: 'مدیریت انبار (ورود/خروج)' },
            { id: 'canViewWarehouseReports', label: 'مشاهده گزارشات انبار' },
            { id: 'canApproveBijak', label: 'تایید نهایی بیجک (مدیریت)' }
        ] 
    }, 
    { 
        id: 'security', 
        title: 'ماژول انتظامات', 
        icon: ShieldCheck, 
        color: 'purple', 
        items: [
            { id: 'canViewSecurity', label: 'مشاهده ماژول انتظامات' },
            { id: 'canCreateSecurityLog', label: 'ثبت گزارشات (نگهبان)' },
            { id: 'canApproveSecuritySupervisor', label: 'تایید گزارشات (سرپرست)' }
        ] 
    }, 
    { 
        id: 'meeting', 
        title: 'ماژول جلسات تولید', 
        icon: ClipboardList, 
        color: 'indigo', 
        items: [
            { id: 'canViewMeetings', label: 'مشاهده جلسات تولید' },
            { id: 'canCreateMeeting', label: 'ثبت و ویرایش صورتجلسه' },
            { id: 'canApproveMeeting', label: 'تایید صورتجلسه (امضاء)' },
            { id: 'canManageMeetings', label: 'مدیریت و ارسال نهایی (Admin)' }
        ] 
    },
    { 
        id: 'balances', 
        title: 'ماژول مانده حساب مشتریان', 
        icon: Landmark, 
        color: 'emerald', 
        items: [
            { id: 'canViewCustomerBalances', label: 'مشاهده لیست مانده حساب‌های مالی مشتریان' },
            { id: 'canImportCustomerBalances', label: 'بارگذاری/واردات فایل اکسل تفصیلی مانده حساب‌ها' }
        ] 
    },
    { 
        id: 'ccti', 
        title: 'ماژول تبدیل CCTI', 
        icon: FileText, 
        color: 'pink', 
        items: [
            { id: 'canAccessCcti', label: 'دسترسی به بخش تبدیل شبا و تولید فایل پایا' },
            { id: 'canManageCctiArchive', label: 'مدیریت و حذف بایگانی فایل‌های CCTI' }
        ] 
    },
    { 
        id: 'sayan', 
        title: 'گزارشات هوشمند سایان ERP', 
        icon: FileText, 
        color: 'blue', 
        items: [
            { id: 'canViewSayan', label: 'دسترسی کلی به گزارشات سایان' },
            { id: 'canViewSayanTraz', label: 'مشاهده بخش تراز و مانده اشخاص سایان' },
            { id: 'canViewSayanSales', label: 'مشاهده بخش فروش و تحلیل مقایسه‌ای سایان' },
            { id: 'canViewSayanProduction', label: 'مشاهده بخش تولید روزانه سایان' },
            { id: 'canViewSayanCheques', label: 'مشاهده بخش لیست چک‌های سایان' }
        ] 
    },
    { 
        id: 'general', 
        title: 'عمومی و مدیریتی', 
        icon: Lock, 
        color: 'gray', 
        items: [
            { id: 'canViewAll', label: 'مشاهده تمام دستورات (همه کاربران)' },
            { id: 'canEditOwn', label: 'ویرایش دستور خود' },
            { id: 'canDeleteOwn', label: 'حذف دستور خود' },
            { id: 'canEditAll', label: 'ویرایش تمام دستورات' },
            { id: 'canDeleteAll', label: 'حذف تمام دستورات' },
            { id: 'canManageTrade', label: 'دسترسی به بخش بازرگانی' },
            { id: 'canManageSettings', label: 'دسترسی به تنظیمات سیستم' },
            { id: 'canViewKnowledgeBase', label: 'دسترسی کلی به ماژول اطلاعات و یادداشت‌ها' },
            { id: 'canViewCompanyInfo', label: 'مشاهده اطلاعات شرکت و حساب‌های بانکی' },
            { id: 'canManageCompanyInfo', label: 'مدیریت اطلاعات شرکت و حساب‌ها (افزودن/ویرایش/حذف)' },
            { id: 'canUsePersonalNotes', label: 'دسترسی به دفترچه یادداشت شخصی فردی' },
            { id: 'canViewNotifications', label: 'دسترسی به سیستم اعلان‌ها' },
            { id: 'canCreateNotifications', label: 'دسترسی به ثبت نوتیفیکیشن اپلیکیشن' },
            { id: 'canCreateAnnouncements', label: 'دسترسی به ثبت اعلان در داشبورد' }
        ] 
    }
];


const DEFAULT_ROLES = [
    { id: UserRole.USER, label: 'کاربر عادی' },
    { id: UserRole.FINANCIAL, label: 'مدیر مالی' },
    { id: UserRole.MANAGER, label: 'مدیر داخلی' },
    { id: UserRole.CEO, label: 'مدیر عامل' },
    { id: UserRole.SALES_MANAGER, label: 'مدیر فروش' },
    { id: UserRole.FACTORY_MANAGER, label: 'مدیر کارخانه' },
    { id: UserRole.WAREHOUSE_KEEPER, label: 'انبار واردات' },
    { id: UserRole.SECURITY_HEAD, label: 'سرپرست انتظامات' },
    { id: UserRole.SECURITY_GUARD, label: 'نگهبان' },
    { id: UserRole.ADMIN, label: 'مدیر سیستم' },
];

const RolePermissionsEditor: React.FC<Props> = ({ settings, onUpdateSettings }) => {
    // State to track which role accordion is open
    const [expandedRole, setExpandedRole] = useState<string | null>(null);
    const [newRoleName, setNewRoleName] = useState('');
    const [renamingRole, setRenamingRole] = useState<{id: string, name: string} | null>(null);

    const allRoles = [...DEFAULT_ROLES, ...(settings.customRoles || [])].map(r => ({
        ...r,
        label: settings.customRoleNames?.[r.id] || r.label
    }));

    const handleSaveRoleName = () => {
        if (!renamingRole) return;
        if (!renamingRole.name.trim()) { setRenamingRole(null); return; }
        
        onUpdateSettings({
            ...settings,
            customRoleNames: {
                ...(settings.customRoleNames || {}),
                [renamingRole.id]: renamingRole.name.trim()
            }
        });
        setRenamingRole(null);
    };

    const toggleExpand = (roleId: string) => {
        setExpandedRole(prev => prev === roleId ? null : roleId);
    };

    // --- CORE PERMISSION UPDATE LOGIC ---
    const handlePermissionChange = (roleId: string, groupId: string, permKey: string, value: boolean) => {
        const isPurchase = groupId === 'purchase';
        const currentStore = isPurchase ? (settings.purchaseRolePermissions || {}) : (settings.rolePermissions || {});
        const currentRolePerms = currentStore[roleId] || {};
        
        const updatedRolePerms = {
            ...currentRolePerms,
            [permKey]: value
        };

        const newSettingsKey = isPurchase ? 'purchaseRolePermissions' : 'rolePermissions';
        
        const newSettings = {
            ...settings,
            [newSettingsKey]: {
                ...currentStore,
                [roleId]: updatedRolePerms
            }
        };

        onUpdateSettings(newSettings);
    };

    const toggleGroup = (roleId: string, groupId: string, groupItems: {id: string}[], isChecked: boolean) => {
        const isPurchase = groupId === 'purchase';
        const currentStore = isPurchase ? (settings.purchaseRolePermissions || {}) : (settings.rolePermissions || {});
        const currentRolePerms = currentStore[roleId] || {};
        
        const updatedRolePerms = { ...currentRolePerms };
        
        groupItems.forEach(item => {
            // @ts-ignore
            updatedRolePerms[item.id] = isChecked;
        });

        const newSettingsKey = isPurchase ? 'purchaseRolePermissions' : 'rolePermissions';

        const newSettings = {
            ...settings,
            [newSettingsKey]: {
                ...currentStore,
                [roleId]: updatedRolePerms
            }
        };
        onUpdateSettings(newSettings);
    };

    const handleAddRole = () => {
        if (!newRoleName.trim()) return;
        const roleId = `role_${Date.now()}`;
        const newRole: CustomRole = { id: roleId, label: newRoleName.trim() };
        const newSettings = { 
            ...settings, 
            customRoles: [...(settings.customRoles || []), newRole] 
        };
        onUpdateSettings(newSettings);
        setNewRoleName('');
    };

    const handleRemoveRole = (roleId: string) => {
        if (!confirm("آیا از حذف این نقش اطمینان دارید؟")) return;
        const updatedRoles = (settings.customRoles || []).filter(r => r.id !== roleId);
        const updatedPermissions = { ...settings.rolePermissions };
        delete updatedPermissions[roleId];
        
        onUpdateSettings({ 
            ...settings, 
            customRoles: updatedRoles, 
            rolePermissions: updatedPermissions 
        });
    };

    return (
        <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
                <Info className="text-blue-600 shrink-0 mt-1" size={20}/>
                <div className="text-sm text-blue-800">
                    <p className="font-bold mb-1">راهنمای سطح دسترسی:</p>
                    <p>در این بخش می‌توانید مشخص کنید هر نقش کاربری دقیقاً به چه امکاناتی دسترسی داشته باشد. برای مثال، برای فعال شدن دکمه تایید خروج برای مدیر کارخانه، حتماً باید تیک <strong>«تایید خروج (مدیر کارخانه)»</strong> برای نقش <strong>Factory Manager</strong> روشن باشد.</p>
                </div>
            </div>

            {/* Custom Role Input */}
            <div className="glass-panel p-4 rounded-xl border border-gray-200/50 dark:border-white/10 flex flex-col md:flex-row gap-4 items-end shadow-sm">
                <div className="flex-1 w-full space-y-1">
                    <label className="text-xs font-bold text-gray-500">افزودن نقش سفارشی جدید</label>
                    <input 
                        className="w-full border rounded-lg p-2 text-sm focus:border-blue-500 outline-none transition-colors" 
                        placeholder="نام نقش (مثال: حسابدار ارشد)" 
                        value={newRoleName} 
                        onChange={e => setNewRoleName(e.target.value)} 
                    />
                </div>
                <button 
                    type="button" 
                    onClick={handleAddRole} 
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-purple-700 h-[38px] w-full md:w-auto"
                >
                    افزودن نقش
                </button>
            </div>

            {/* Roles List */}
            <div className="space-y-3">
                {allRoles.map(role => (
                    <div key={role.id} className="glass-panel border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                        {/* Header */}
                        <div 
                            className={`p-4 flex justify-between items-center cursor-pointer select-none transition-colors ${expandedRole === role.id ? 'bg-blue-50' : 'bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200'}`}
                            onClick={() => toggleExpand(role.id)}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${role.id === UserRole.ADMIN ? 'bg-red-100 text-red-600' : 'glass-panel border text-gray-600'}`}>
                                    <ShieldCheck size={20}/>
                                </div>
                                <div>
                                    {renamingRole?.id === role.id ? (
                                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                            <input 
                                                autoFocus
                                                value={renamingRole.name} 
                                                onChange={e => setRenamingRole({...renamingRole, name: e.target.value})} 
                                                onKeyDown={e => e.key === 'Enter' && handleSaveRoleName()}
                                                className="border-b border-blue-500 font-bold text-gray-800 bg-transparent outline-none px-1 py-0.5 text-sm"
                                            />
                                            <button onClick={handleSaveRoleName} className="text-green-600 bg-green-50 p-1 rounded hover:bg-green-100"><Check size={14}/></button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-800 block">{role.label}</span>
                                            <button onClick={(e) => { e.stopPropagation(); setRenamingRole({id: role.id, name: role.label}); }} className="text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"><Pencil size={12}/></button>
                                        </div>
                                    )}
                                    <span className="text-[10px] text-gray-500 font-mono">{role.id}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {!Object.values(UserRole).includes(role.id as any) && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleRemoveRole(role.id); }}
                                        className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded transition-colors"
                                        title="حذف نقش"
                                    >
                                        <Trash2 size={16}/>
                                    </button>
                                )}
                                {expandedRole === role.id ? <ChevronUp size={20} className="text-blue-600"/> : <ChevronDown size={20} className="text-gray-400"/>}
                            </div>
                        </div>
                        
                        {/* Body (Permissions) */}
                        {expandedRole === role.id && (
                            <div className="p-4 glass-panel border-t border-gray-100 animate-fade-in">
                                {role.id === UserRole.ADMIN ? (
                                    <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm font-bold text-center border border-red-100 flex items-center justify-center gap-2">
                                        <Lock size={16}/>
                                        مدیر سیستم دسترسی کامل به تمامی بخش‌ها دارد و قابل تغییر نیست.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                             {PERMISSION_GROUPS.map(group => {
                                             const GroupIcon = group.icon;
                                             // Check if ALL items in this group are checked
                                             const isPurchase = group.id === 'purchase';
                                             const currentStore = isPurchase ? (settings.purchaseRolePermissions || {}) : (settings.rolePermissions || {});
                                             const rolePerms = currentStore[role.id] || {};
                                             // @ts-ignore
                                             const isGroupAllChecked = group.items.every(item => rolePerms[item.id]);

                                             return (
                                                 <div key={group.id} className="border border-gray-200 rounded-xl overflow-hidden">
                                                     <div className={`px-4 py-2 bg-${group.color}-50 border-b border-${group.color}-100 flex justify-between items-center`}>
                                                         <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                                                             <GroupIcon size={16} className={`text-${group.color}-600`}/>
                                                             {group.title}
                                                         </div>
                                                         <label className="flex items-center gap-2 cursor-pointer select-none">
                                                             <input 
                                                                 type="checkbox" 
                                                                 className="hidden"
                                                                 checked={isGroupAllChecked}
                                                                 onChange={(e) => toggleGroup(role.id, group.id, group.items, e.target.checked)}
                                                             />
                                                             <span className="text-[10px] text-blue-600 hover:underline">
                                                                 {isGroupAllChecked ? 'لغو همه' : 'انتخاب همه'}
                                                             </span>
                                                         </label>
                                                     </div>
                                                     <div className="p-2 space-y-1">
                                                         {group.items.map(perm => {
                                                             // @ts-ignore
                                                             const isChecked = !!rolePerms[perm.id];
                                                             
                                                             return (
                                                                 <div 
                                                                     key={perm.id} 
                                                                     className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${isChecked ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                                                                     onClick={() => handlePermissionChange(role.id, group.id, perm.id, !isChecked)}
                                                                 >
                                                                     <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isChecked ? 'bg-green-500 border-green-500' : 'glass-panel border-gray-300'}`}>
                                                                         {isChecked && <CheckSquare size={14} className="text-white"/>}
                                                                     </div>
                                                                     <span className={`text-xs select-none ${isChecked ? 'text-gray-800 font-bold' : 'text-gray-600'}`}>{perm.label}</span>
                                                                 </div>
                                                             );
                                                         })}
                                                     </div>
                                                 </div>
                                             );
                                         })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RolePermissionsEditor;
