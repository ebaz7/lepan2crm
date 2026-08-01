
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
    PurchaseRequest, PurchaseRequestStatus, User, UserRole, 
    SystemSettings, PurchaseProforma, PartMasterData, PartKardex,
    PurchaseRequestItem, PurchaseAttachment, PurchaseAuditLog 
} from '../types';
import { 
    getPurchaseRequests, savePurchaseRequest, updatePurchaseRequest, 
    deletePurchaseRequest, getNextPurchaseRequestNumber, 
    getPartMasterData, savePartMasterData, updatePartMasterData, 
    deletePartMasterData, getPartKardex, uploadFileChunked 
} from '../services/storageService';
import { 
    ShoppingCart, Plus, Search, Filter, Eye, Edit, Trash2, 
    CheckCircle, XCircle, FileText, Package, Truck, 
    ShieldCheck, ClipboardCheck, Warehouse, History, 
    Image as ImageIcon, MoreVertical, Loader2, ArrowRight,
    Ruler, Layers, Tag, Upload, Info, FileUp, UploadCloud, Settings, Printer, FileDown, AlertCircle, X,
    GitFork, Clock, CornerUpLeft, UserCheck, FileCode, AlertTriangle, Check, ExternalLink, Paperclip, Wrench,
    FileSpreadsheet, Container, ArrowDownCircle, ArrowUpCircle
} from 'lucide-react';
import { formatDate, formatCurrency, generateUUID, getCurrentShamsiDate } from '../constants';
import useIsMobile from '../hooks/useIsMobile';
import * as XLSX from 'xlsx';
import PrintPurchaseRequest from './PrintPurchaseRequest';
import PrintPurchaseProforma from './PrintPurchaseProforma';
import PrintWarehouseReceipt from './PrintWarehouseReceipt';
import PrintPartDataSheet from './PrintPartDataSheet';
import PrintPurchaseBarcode from './PrintPurchaseBarcode';
import { generatePdf } from '../utils/pdfGenerator';
import { getRolePermissions } from '../services/authService';

const PurchaseModule: React.FC<{ currentUser: User, settings?: SystemSettings, initialTab?: 'DASHBOARD' | 'REQUESTS' | 'PARTS' | 'KARDEX' | 'ARCHIVE' }> = ({ currentUser, settings, initialTab = 'REQUESTS' }) => {
    const isMobile = useIsMobile();
    const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'REQUESTS' | 'PARTS' | 'KARDEX' | 'ARCHIVE'>(initialTab);
    const [loading, setLoading] = useState(false);
    
    const perms = React.useMemo(() => {
        return getRolePermissions(currentUser.role, settings || null, currentUser);
    }, [currentUser, settings]);
    
    // Requests State
    const [requests, setRequests] = useState<PurchaseRequest[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [requestSearch, setRequestSearch] = useState('');
    const [viewRequest, setViewRequest] = useState<PurchaseRequest | null>(null);

    // Parts State
    const [parts, setParts] = useState<PartMasterData[]>([]);
    const [showPartModal, setShowPartModal] = useState(false);
    const [partSearch, setPartSearch] = useState('');
    const [editingPart, setEditingPart] = useState<PartMasterData | null>(null);

    // Kardex State
    const [selectedPartKardex, setSelectedPartKardex] = useState<PartMasterData | null>(null);
    const [kardexEntries, setKardexEntries] = useState<PartKardex[]>([]);

    useEffect(() => {
        loadRequests();
        loadParts();
    }, []);

    useEffect(() => {
        if (viewRequest || editingPart || selectedPartKardex || showCreateModal || showPartModal) {
            const handleBack = () => {
                if (viewRequest) setViewRequest(null);
                if (editingPart) setEditingPart(null);
                if (selectedPartKardex) setSelectedPartKardex(null);
                if (showCreateModal) setShowCreateModal(false);
                if (showPartModal) setShowPartModal(false);
            };
            window.dispatchEvent(new CustomEvent('REGISTER_BACK_ACTION', { detail: handleBack }));
        } else if (activeTab !== 'DASHBOARD') {
            const handleBack = () => {
                setActiveTab('DASHBOARD');
            };
            window.dispatchEvent(new CustomEvent('REGISTER_BACK_ACTION', { detail: handleBack }));
        } else {
            window.dispatchEvent(new CustomEvent('UNREGISTER_BACK_ACTION'));
        }
        return () => { window.dispatchEvent(new CustomEvent('UNREGISTER_BACK_ACTION')); };
    }, [viewRequest, editingPart, selectedPartKardex, showCreateModal, showPartModal, activeTab]);

    const loadRequests = async () => {
        setLoading(true);
        try {
            const data = await getPurchaseRequests();
            setRequests(data.sort((a, b) => b.createdAt - a.createdAt));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const loadParts = async () => {
        try {
            const data = await getPartMasterData();
            setParts(data);
        } catch (e) { console.error(e); }
    };

    const loadKardex = async (partId: string) => {
        try {
            const data = await getPartKardex(partId);
            setKardexEntries(data);
        } catch (e) { console.error(e); }
    };

    const hasPurchasePerm = (perm: string) => {
        if (currentUser.role === UserRole.ADMIN) return true;
        return !!(perms as any)[perm];
    };

    // Components for each tab will go here
    return (
        <div className="space-y-6 pb-20 animate-fade-in h-full flex flex-col">
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center glass-panel p-4 rounded-2xl shadow-sm border border-gray-200">
                    <h1 className="text-xl font-black text-gray-800 flex items-center gap-2">
                        <ShoppingCart className="text-indigo-600"/> مدیریت خرید و کالا
                    </h1>
                </div>
                
                <div className="flex p-1 bg-gray-200 rounded-xl overflow-x-auto no-scrollbar">
                    <button 
                        onClick={() => setActiveTab('DASHBOARD')} 
                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'DASHBOARD' ? 'glass-panel text-indigo-700 shadow-md' : 'text-gray-500'}`}
                    >
                        داشبورد کارتابل
                    </button>
                    <button 
                        onClick={() => setActiveTab('REQUESTS')} 
                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'REQUESTS' ? 'glass-panel text-indigo-700 shadow-md' : 'text-gray-500'}`}
                    >
                        درخواست‌های فعال
                    </button>
                    <button 
                        onClick={() => setActiveTab('PARTS')} 
                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'PARTS' ? 'glass-panel text-indigo-700 shadow-md' : 'text-gray-500'}`}
                    >
                        کدینگ کالا
                    </button>
                    <button 
                        onClick={() => setActiveTab('KARDEX')} 
                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'KARDEX' ? 'glass-panel text-indigo-700 shadow-md' : 'text-gray-500'}`}
                    >
                        کاردکس موجودی
                    </button>
                    <button 
                        onClick={() => setActiveTab('ARCHIVE')} 
                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'ARCHIVE' ? 'glass-panel text-indigo-700 shadow-md' : 'text-gray-500'}`}
                    >
                        بایگانی نهایی
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar">
                {activeTab === 'DASHBOARD' && (
                    <PurchaseDashboard 
                        requests={requests} 
                        setActiveTab={setActiveTab} 
                        currentUser={currentUser}
                        settings={settings}
                    />
                )}
                {activeTab === 'REQUESTS' && (
                    <PurchaseRequestsTab 
                        requests={requests.filter(r => r.status !== PurchaseRequestStatus.COMPLETED && r.status !== PurchaseRequestStatus.REJECTED)} 
                        currentUser={currentUser} 
                        onRequestUpdate={loadRequests} 
                        parts={parts}
                        settings={settings}
                    />
                )}
                {activeTab === 'ARCHIVE' && (
                    <PurchaseRequestsTab 
                        requests={requests.filter(r => r.status === PurchaseRequestStatus.COMPLETED || r.status === PurchaseRequestStatus.REJECTED)} 
                        currentUser={currentUser} 
                        onRequestUpdate={loadRequests} 
                        parts={parts}
                        isArchive={true}
                        settings={settings}
                    />
                )}
                {activeTab === 'PARTS' && (
                    <PartsTab 
                        parts={parts} 
                        currentUser={currentUser} 
                        onPartUpdate={loadParts}
                        settings={settings}
                    />
                )}
                {activeTab === 'KARDEX' && (
                   <KardexTab 
                        parts={parts} 
                        selectedPart={selectedPartKardex} 
                        setSelectedPart={setSelectedPartKardex}
                        kardexEntries={kardexEntries}
                        loadKardex={loadKardex}
                        onPartUpdate={loadParts}
                   />
                )}
            </div>

            {/* Subtab Back Trigger */}
            {activeTab !== 'DASHBOARD' && (
                <button 
                    data-subtab-back="true" 
                    onClick={() => setActiveTab('DASHBOARD')} 
                    className="hidden"
                />
            )}
        </div>
    );
};

// --- BPMN WORKFLOW DIAGRAM COMPONENT ---
const BpmnWorkflowDiagram: React.FC<{ currentStatus?: PurchaseRequestStatus; location?: string }> = ({ currentStatus, location }) => {
    const isStepActive = (status: PurchaseRequestStatus) => {
        if (currentStatus === status) return true;
        if (status === PurchaseRequestStatus.PENDING_WAREHOUSE_KEEPER && currentStatus === PurchaseRequestStatus.PENDING_FACTORY) return true;
        return false;
    };

    // Grouping steps into logical phases to be extremely precise and compact
    const phases = [
        {
            title: '۱. بررسی اولیه',
            steps: [
                { status: PurchaseRequestStatus.PENDING_TECHNICAL, title: 'تایید فنی نت', role: 'واحد نت' },
                { status: PurchaseRequestStatus.PENDING_SHIFT_LEADER, title: 'تایید سرشیفت', role: 'سرشیفت کارخانه' },
                { status: PurchaseRequestStatus.PENDING_WAREHOUSE_KEEPER, title: 'بررسی موجودی', role: 'انباردار کارخانه' },
                { status: PurchaseRequestStatus.PENDING_COMMERCIAL_DECISION, title: 'تایید مسیر تامین', role: 'مدیر کارخانه' },
            ]
        },
        {
            title: location === 'Tehran' ? '۲. شعبه تهران (بازرگانی مرکزی)' : '۲. تامین محلی (زنجان/کارخانه)',
            isBranch: true,
            steps: location === 'Tehran' ? [
                { status: PurchaseRequestStatus.PENDING_CEO_INITIAL, title: 'مجوز استعلام', role: 'مدیرعامل' },
                { status: PurchaseRequestStatus.PENDING_TEHRAN_PROFORMA, title: 'ثبت پروفرما', role: 'بازرگانی تهران' },
                { status: PurchaseRequestStatus.PENDING_COMMERCIAL_MANAGER, title: 'بررسی بازرگانی', role: 'مدیر بازرگانی' },
                { status: PurchaseRequestStatus.PENDING_CEO_SELECTION, title: 'انتخاب نهایی', role: 'مدیرعامل' },
            ] : [
                { status: PurchaseRequestStatus.PENDING_ZANJAN_PURCHASING, title: 'پیشنهاد خرید', role: 'خرید زنجان' },
                { status: PurchaseRequestStatus.PENDING_FACTORY_MANAGER_APPROVAL, title: 'دستور خرید', role: 'مدیر کارخانه' },
                { status: PurchaseRequestStatus.PENDING_BUYER_EXECUTION, title: 'اجرای خرید', role: 'کارپرداز' },
            ]
        },
        {
            title: '۳. تحویل و ثبت نهایی کارخانه',
            steps: [
                { status: PurchaseRequestStatus.PENDING_TECHNICAL_APPROVAL, title: 'تایید فنی و کیفی', role: 'نت / QC' },
                { status: PurchaseRequestStatus.PENDING_FACTORY_ENTRY_APPROVAL, title: 'تایید ورود', role: 'مدیر کارخانه' },
                { status: PurchaseRequestStatus.PENDING_SECURITY_ENTRY, title: 'ورود انتظامات', role: 'انتظامات' },
                { status: PurchaseRequestStatus.PENDING_WAREHOUSE_RECEIPT, title: 'رسید انبار', role: 'انباردار' },
                { status: PurchaseRequestStatus.PENDING_FACTORY_FINAL_SIGN, title: 'تایید نهایی و امضا', role: 'مدیر کارخانه' },
                { status: PurchaseRequestStatus.COMPLETED, title: 'بایگانی شده', role: 'سیستم' },
            ]
        }
    ];

    return (
        <div className="bg-white text-gray-800 p-4 rounded-2xl border border-gray-200 shadow-sm text-right dir-rtl">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-3">
                <div className="flex items-center gap-2">
                    <GitFork className="text-indigo-600" size={14} />
                    <span className="text-xs font-black text-gray-800">رهگیری الکترونیک فرآیند خرید (BPMN Workflow Tracker)</span>
                </div>
                {currentStatus && (
                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full text-[9px] font-black">
                        مرحله فعلی: {currentStatus}
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {phases.map((phase, pIdx) => (
                    <div key={pIdx} className="space-y-2 bg-gray-50/50 p-2.5 rounded-xl border border-gray-100">
                        <span className="text-[9px] font-black text-indigo-600 block border-b pb-1 border-gray-200">{phase.title}</span>
                        <div className="space-y-1.5">
                            {phase.steps.map((step, sIdx) => {
                                const active = isStepActive(step.status);
                                return (
                                    <div key={sIdx} className={`p-1.5 rounded-lg border flex items-center justify-between transition-all ${active ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-[1.01]' : 'bg-white border-gray-100'}`}>
                                        <div className="flex items-center gap-1">
                                            <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white animate-ping' : 'bg-gray-300'}`}></span>
                                            <span className="text-[10px] font-bold">{step.title}</span>
                                        </div>
                                        <span className={`text-[8px] px-1 py-0.2 rounded font-black ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{step.role}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- DASHBOARD TAB ---
const PurchaseDashboard = ({ requests, setActiveTab, currentUser, settings }: any) => {
    const isRole = (roleName: string) => {
        if (currentUser.role === roleName) return true;
        if (currentUser.roles && currentUser.roles.includes(roleName)) return true;
        return false;
    };

    const isAdmin = isRole(UserRole.ADMIN);

    const perms = React.useMemo(() => {
        return getRolePermissions(currentUser.role, settings || null, currentUser);
    }, [currentUser, settings]);

    const stats = [
        { label: 'کل درخواست‌ها', count: requests.length, color: 'indigo', icon: ShoppingCart, tab: 'REQUESTS' },
        { label: 'در انتظار تایید', count: requests.filter((r: any) => r.status.includes('PENDING')).length, color: 'amber', icon: ClipboardCheck, tab: 'REQUESTS' },
        { label: 'ورود به کارخانه', count: requests.filter((r: any) => r.status === PurchaseRequestStatus.PENDING_SECURITY_ENTRY || r.status === PurchaseRequestStatus.PENDING_QC).length, color: 'orange', icon: Truck, tab: 'REQUESTS' },
        { label: 'تکمیل شده', count: requests.filter((r: any) => r.status === PurchaseRequestStatus.COMPLETED).length, color: 'green', icon: CheckCircle, tab: 'ARCHIVE' }
    ];

    const hasPurchasePerm = (perm: string) => {
        if (isAdmin) return true;
        
        let hasPerm = false;
        const rolesList = currentUser.roles && currentUser.roles.length > 0 ? currentUser.roles : [currentUser.role];
        for (const r of rolesList) {
            if (r === UserRole.ADMIN) return true;
            const rolePerms = settings?.purchaseRolePermissions?.[r] || {};
            if (!!(rolePerms as any)[perm]) {
                hasPerm = true;
            }
        }
        return hasPerm;
    };

    const myTasks = requests.filter((r: any) => {
        if (isAdmin) return r.status !== PurchaseRequestStatus.COMPLETED && r.status !== PurchaseRequestStatus.REJECTED;
        
        switch (r.status) {
            case PurchaseRequestStatus.PENDING_TECHNICAL: return hasPurchasePerm('canApproveTechnical');
            case PurchaseRequestStatus.PENDING_SHIFT_LEADER: return hasPurchasePerm('canApproveShiftLeader');
            case PurchaseRequestStatus.PENDING_WAREHOUSE_KEEPER:
            case PurchaseRequestStatus.PENDING_FACTORY:
                return hasPurchasePerm('canApproveWarehouseKeeper') || hasPurchasePerm('canApproveFactory');
            case PurchaseRequestStatus.PENDING_COMMERCIAL_DECISION: return hasPurchasePerm('canApproveFactoryDecision') || hasPurchasePerm('canCommercialFinalize');
            
            case PurchaseRequestStatus.PENDING_TEHRAN_PURCHASING: 
            case PurchaseRequestStatus.PENDING_TEHRAN_PROFORMA:
            case PurchaseRequestStatus.PENDING_COMMERCIAL_MANAGER:
                return hasPurchasePerm('canManageProformas') && r.location === 'Tehran';
            
            case PurchaseRequestStatus.PENDING_CEO_INITIAL:
            case PurchaseRequestStatus.PENDING_CEO_SELECTION:
                return hasPurchasePerm('canApproveCEO');
                
            case PurchaseRequestStatus.PENDING_ZANJAN_PURCHASING:
            case PurchaseRequestStatus.PENDING_FACTORY_PURCHASING:
            case PurchaseRequestStatus.PENDING_FACTORY_PROFORMA:
                return hasPurchasePerm('canManageProformas') && (r.location === 'Factory' || r.location === 'Zanjan');
                
            case PurchaseRequestStatus.PENDING_FACTORY_MANAGER_APPROVAL:
            case PurchaseRequestStatus.PENDING_FACTORY_MANAGER_SELECTION:
            case PurchaseRequestStatus.PENDING_FACTORY_FINAL_APPROVE:
            case PurchaseRequestStatus.PENDING_FACTORY_ENTRY_APPROVAL:
            case PurchaseRequestStatus.PENDING_FACTORY_FINAL_SIGN:
                return hasPurchasePerm('canApproveFactory');

            case PurchaseRequestStatus.PENDING_BUYER_EXECUTION:
                return hasPurchasePerm('canManageProformas');

            case PurchaseRequestStatus.PENDING_TECHNICAL_APPROVAL:
                return hasPurchasePerm('canApproveTechnical');
            
            case PurchaseRequestStatus.PENDING_SECURITY_ENTRY: return hasPurchasePerm('canRegisterEntry');
            case PurchaseRequestStatus.PENDING_QC: return hasPurchasePerm('canCheckQC');
            case PurchaseRequestStatus.PENDING_WAREHOUSE_RECEIPT: return hasPurchasePerm('canWarehouseFinalize');
            
            default: return false;
        }
    });

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((s, idx) => (
                    <div key={idx} onClick={() => setActiveTab(s.tab)} className={`glass-panel p-6 rounded-[2rem] border-2 cursor-pointer hover:scale-105 transition-all text-center flex flex-col items-center justify-center gap-2 border-indigo-100 bg-indigo-50/30`}>
                        <div className={`p-3 rounded-2xl bg-indigo-100 text-indigo-600`}>
                            <s.icon size={28} />
                        </div>
                        <div className="text-2xl font-black text-gray-800">{s.count}</div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{s.label}</div>
                    </div>
                ))}
            </div>

            <div className="glass-panel p-6 rounded-[2.5rem] border border-gray-100 bg-white shadow-sm mb-6">
                <h3 className="font-black text-indigo-900 border-b pb-4 mb-4 flex items-center gap-2"><ClipboardCheck /> کارتابل وظایف من</h3>
                {myTasks.length === 0 ? (
                    <div className="py-8 text-center text-gray-300 italic">موردی جهت اقدام شما یافت نشد.</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {myTasks.slice(0, 6).map((req: any) => (
                            <div key={req.id} onClick={() => setActiveTab('REQUESTS')} className="p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer group">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[9px] font-mono font-bold text-gray-400">#{req.requestNumber}</span>
                                    <span className="text-[9px] font-bold text-gray-500 bg-white px-2 py-0.5 rounded-full shadow-sm">{formatDate(req.date)}</span>
                                </div>
                                <h4 className="font-black text-gray-800 text-sm group-hover:text-indigo-700 transition-colors uppercase tracking-tight line-clamp-1">{req.itemName}</h4>
                                <div className="mt-2 flex items-center justify-between">
                                    <span className="text-[10px] font-black text-indigo-600">{req.status}</span>
                                    <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center text-indigo-600 shadow-sm"><ArrowRight size={14}/></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="glass-panel p-6 rounded-[2.5rem] border border-gray-100 bg-gray-50 shadow-inner">
                <h3 className="font-black text-gray-700 border-b pb-4 mb-4 flex items-center gap-2"><ShoppingCart className="text-gray-400" size={18}/> درخواست‌های اخیراً ثبت شده من</h3>
                {requests.filter((r: any) => r.requester === currentUser.fullName).length === 0 ? (
                    <div className="py-8 text-center text-gray-400 italic text-xs">شما هنوز درخواستی ثبت نکرده‌اید.</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {requests.filter((r: any) => r.requester === currentUser.fullName).slice(0, 3).map((req: any) => (
                            <div key={req.id} onClick={() => setActiveTab('REQUESTS')} className="p-4 bg-white rounded-2xl border border-gray-200 hover:shadow-md transition-all cursor-pointer">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[8px] font-mono text-gray-400">{req.requestNumber}</span>
                                    <span className={`text-[8px] font-bold px-2 py-0.5 rounded ${req.status === PurchaseRequestStatus.REJECTED ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                                        {req.status}
                                    </span>
                                </div>
                                <h4 className="font-black text-gray-800 text-xs line-clamp-1">{req.itemName}</h4>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- REQUESTS TAB ---
const PurchaseRequestsTab = ({ requests, currentUser, onRequestUpdate, parts, isArchive, settings }: any) => {
    const isAdmin = currentUser.role === UserRole.ADMIN;
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [viewingRequest, setViewingRequest] = useState<PurchaseRequest | null>(null);

    const filtered = requests.filter((r: PurchaseRequest) => {
        const search = searchTerm.toLowerCase();
        return (
            (r.itemName?.toLowerCase() || '').includes(search) || 
            (r.requestNumber?.toLowerCase() || '').includes(search) ||
            (r.requester?.toLowerCase() || '').includes(search) ||
            (r.specifications?.toLowerCase() || '').includes(search)
        );
    });

    const hasPurchasePerm = (perm: string) => {
        if (isAdmin) return true;
        const rolePerms = settings?.purchaseRolePermissions?.[currentUser.role] || {};
        return !!(rolePerms as any)[perm];
    };

    const canCreate = hasPurchasePerm('canCreate');

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-2">
                <div className="relative flex-1">
                    <input className="w-full glass-panel border border-gray-200 rounded-xl p-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-indigo-100" placeholder="جستجوی در کالا، شماره درخواست یا درخواست‌کننده..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    <Search className="absolute right-3 top-3.5 text-gray-400" size={18}/>
                </div>
                {canCreate && !isArchive && (
                    <button onClick={() => setShowCreate(true)} className="bg-indigo-600 text-white p-3 px-6 rounded-xl shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 font-bold text-sm">
                        <Plus size={20}/> ثبت درخواست جدید
                    </button>
                )}
            </div>

            {filtered.length === 0 ? (
                <div className="glass-panel p-12 text-center border-2 border-dashed border-gray-200 rounded-[2.5rem]">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                        <ShoppingCart size={40} />
                    </div>
                    <h3 className="text-lg font-black text-gray-400">موردی یافت نشد</h3>
                    <p className="text-xs text-gray-300 mt-2">هیچ درخواست خریدی در این بخش وجود ندارد</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((req: PurchaseRequest) => (
                        <RequestCard key={req.id} req={req} currentUser={currentUser} settings={settings} onClick={() => setViewingRequest(req)} />
                    ))}
                </div>
            )}

            {showCreate && <CreateRequestModal onClose={() => setShowCreate(false)} currentUser={currentUser} onSuccess={onRequestUpdate} parts={parts} />}
            {viewingRequest && <ViewRequestModal request={viewingRequest} onClose={() => setViewingRequest(null)} currentUser={currentUser} onSuccess={onRequestUpdate} settings={settings} parts={parts} />}
        </div>
    );
};

const RequestCard = ({ req, currentUser, onClick, settings }: { req: PurchaseRequest, currentUser: User, onClick: () => void, settings?: SystemSettings }) => {
    const isRole = (roleName: string) => {
        if (currentUser.role === roleName) return true;
        if (currentUser.roles && currentUser.roles.includes(roleName)) return true;
        return false;
    };

    const isAdmin = isRole(UserRole.ADMIN);

    const hasPurchasePerm = (perm: string) => {
        if (isAdmin) return true;
        
        let hasPerm = false;
        const rolesList = currentUser.roles && currentUser.roles.length > 0 ? currentUser.roles : [currentUser.role];
        for (const r of rolesList) {
            if (r === UserRole.ADMIN) return true;
            const rolePerms = settings?.purchaseRolePermissions?.[r] || {};
            if (!!(rolePerms as any)[perm]) {
                hasPerm = true;
            }
        }
        return hasPerm;
    };

    const isMyTurn = (r: PurchaseRequest) => {
        if (r.status === PurchaseRequestStatus.COMPLETED || r.status === PurchaseRequestStatus.REJECTED) return false;
        if (isAdmin) return true;

        switch (r.status) {
            case PurchaseRequestStatus.PENDING_TECHNICAL: return hasPurchasePerm('canApproveTechnical');
            case PurchaseRequestStatus.PENDING_FACTORY: return hasPurchasePerm('canApproveFactory');
            case PurchaseRequestStatus.PENDING_COMMERCIAL_DECISION: return hasPurchasePerm('canCommercialFinalize');
            case PurchaseRequestStatus.PENDING_TEHRAN_PURCHASING: 
            case PurchaseRequestStatus.PENDING_TEHRAN_PROFORMA:
                return hasPurchasePerm('canManageProformas') && r.location === 'Tehran';
            case PurchaseRequestStatus.PENDING_CEO_INITIAL:
            case PurchaseRequestStatus.PENDING_CEO_SELECTION:
                return hasPurchasePerm('canApproveCEO');
            case PurchaseRequestStatus.PENDING_FACTORY_PURCHASING:
            case PurchaseRequestStatus.PENDING_FACTORY_PROFORMA:
                return hasPurchasePerm('canManageProformas') && r.location === 'Factory';
            case PurchaseRequestStatus.PENDING_FACTORY_MANAGER_SELECTION:
            case PurchaseRequestStatus.PENDING_FACTORY_FINAL_APPROVE:
            case PurchaseRequestStatus.PENDING_FACTORY_FINAL_SIGN:
                return hasPurchasePerm('canApproveFactory');
            case PurchaseRequestStatus.PENDING_SECURITY_ENTRY: return hasPurchasePerm('canRegisterEntry');
            case PurchaseRequestStatus.PENDING_QC: return hasPurchasePerm('canCheckQC');
            case PurchaseRequestStatus.PENDING_WAREHOUSE_RECEIPT: return hasPurchasePerm('canWarehouseFinalize');
            default: return false;
        }
    };

    return (
        <div onClick={onClick} className={`glass-panel border rounded-2xl p-4 cursor-pointer transition-all hover:shadow-md relative overflow-hidden ${isMyTurn(req) ? 'border-indigo-400 ring-1 ring-indigo-50' : 'border-gray-200'}`}>
            {isMyTurn(req) && <div className="absolute top-0 right-0 left-0 h-1 bg-indigo-500 animate-pulse"></div>}
            <div className="flex justify-between items-start mb-3">
                <span className="text-[10px] font-mono text-gray-400">#{req.requestNumber}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    req.status === PurchaseRequestStatus.COMPLETED ? 'bg-green-100 text-green-700' : 
                    req.status === PurchaseRequestStatus.REJECTED ? 'bg-red-100 text-red-700' : 
                    'bg-indigo-50 text-indigo-600'
                }`}>
                    {req.status}
                </span>
            </div>
            <h3 className="font-bold text-gray-800 text-base mb-1">{req.itemName}</h3>
            <div className="flex gap-4 text-xs text-gray-500">
                <span>📦 {req.quantity} {req.unit}</span>
                <span>📅 {formatDate(req.date)}</span>
            </div>
            {req.image && (
                <div className="mt-3 rounded-lg overflow-hidden h-12 bg-gray-100 border">
                    <img src={req.image} className="w-full h-full object-cover" alt="part" referrerPolicy="no-referrer" />
                </div>
            )}
        </div>
    );
};

// --- MODALS ---
const CreateRequestModal = ({ onClose, currentUser, onSuccess, parts }: any) => {
    const [loading, setLoading] = useState(false);
    const [requestingUnit, setRequestingUnit] = useState('واحد نت و فنی');
    const [urgency, setUrgency] = useState<'عادی' | 'فوری' | 'اضطراری'>('عادی');
    const [machinery, setMachinery] = useState('');
    const [installationLocation, setInstallationLocation] = useState('');
    const [breakdownDescription, setBreakdownDescription] = useState('');
    const [purchaseReason, setPurchaseReason] = useState('');
    const [repairRequestNumber, setRepairRequestNumber] = useState(() => {
        const shamsi = getCurrentShamsiDate();
        const randomNum = Math.floor(100 + Math.random() * 900);
        return `REPAIR-${shamsi.year}/${randomNum}`;
    });

    const [items, setItems] = useState<PurchaseRequestItem[]>([
        { id: generateUUID(), itemName: '', itemCode: '', suggestedBrand: '', quantity: 1, unit: 'عدد', specifications: '' }
    ]);

    const [attachments, setAttachments] = useState<PurchaseAttachment[]>([]);
    const [uploading, setUploading] = useState(false);

    const handleAddItemRow = () => {
        setItems([...items, { id: generateUUID(), itemName: '', itemCode: '', suggestedBrand: '', quantity: 1, unit: 'عدد', specifications: '' }]);
    };

    const handleRemoveItemRow = (id: string) => {
        if (items.length <= 1) return;
        setItems(items.filter(it => it.id !== id));
    };

    const handleItemChange = (id: string, field: keyof PurchaseRequestItem, value: any) => {
        setItems(items.map(it => it.id === id ? { ...it, [field]: value } : it));
    };

    const handleSelectPart = (id: string, partId: string) => {
        const p = parts.find((pt: any) => pt.id === partId);
        if (!p) return;
        setItems(items.map(it => it.id === id ? {
            ...it,
            partId: p.id,
            itemName: p.name,
            itemCode: p.code || p.id.slice(0, 8),
            unit: p.unit || 'عدد',
            specifications: p.dimensions || ''
        } : it));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploading(true);
        try {
            const newAtts: PurchaseAttachment[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileType = file.name.endsWith('.pdf') ? 'PDF' :
                                file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ? 'EXCEL' :
                                file.type.startsWith('image/') ? 'IMAGE' : 'WORD';
                
                const url = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                newAtts.push({
                    id: generateUUID(),
                    fileName: file.name,
                    fileType,
                    fileUrl: url,
                    uploadedAt: new Date().toISOString(),
                    uploadedBy: currentUser.fullName
                });
            }
            setAttachments([...attachments, ...newAtts]);
        } catch (err) {
            alert('خطا در بارگذاری فایل');
            console.error(err);
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validItems = items.filter(it => it.itemName.trim().length > 0);
        if (validItems.length === 0) return alert('لطفاً حداقل یک کالا یا قطعه با نام مشخص وارد کنید');

        setLoading(true);
        try {
            const nextNum = await getNextPurchaseRequestNumber();
            const nowIso = new Date().toISOString();

            const primaryItem = validItems[0];
            const newAuditLog: PurchaseAuditLog = {
                id: generateUUID(),
                stage: PurchaseRequestStatus.PENDING_TECHNICAL,
                action: 'ثبت اولیه درخواست خرید',
                performedBy: currentUser.fullName,
                role: currentUser.role,
                timestamp: nowIso,
                comment: `ثبت درخواست با ${validItems.length} قلم کالا (${urgency})`
            };

            const newRequest: PurchaseRequest = {
                id: generateUUID(),
                requestNumber: nextNum,
                date: nowIso.split('T')[0],
                requester: currentUser.fullName,
                requestingUnit,
                urgency,
                machinery,
                installationLocation,
                breakdownDescription,
                purchaseReason,
                repairRequestNumber,
                
                itemName: validItems.length === 1 ? primaryItem.itemName : `${primaryItem.itemName} (+${validItems.length - 1} قلم دیگر)`,
                category: 'قطعات و ماشین‌آلات',
                quantity: primaryItem.quantity,
                unit: primaryItem.unit,
                specifications: primaryItem.specifications || breakdownDescription,
                
                items: validItems,
                attachments,
                auditLogs: [newAuditLog],

                status: PurchaseRequestStatus.PENDING_TECHNICAL,
                proformas: [],
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            await savePurchaseRequest(newRequest);
            onSuccess();
            onClose();
        } catch (e) { 
            alert('خطا در ثبت درخواست خرید'); 
            console.error(e);
        } finally { 
            setLoading(false); 
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100000000] flex items-start justify-center p-2 md:p-6 bg-black/80 backdrop-blur-xl animate-fade-in overflow-y-auto pt-12 md:pt-16 dir-rtl">
            <div className="bg-white rounded-[2.5rem] w-full max-w-5xl p-6 md:p-8 animate-scale-in relative shadow-2xl border-4 border-indigo-500/20 mb-10 text-right">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                            <ShoppingCart size={28} />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-black text-gray-800">ثبت فرم مهندسی درخواست خرید (ERP BPMN)</h2>
                            <p className="text-xs text-gray-400 font-bold">ماژول خریدهای صنعتی، قطعات یدکی و ماشین‌آلات کارخانه</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-2xl transition-all bg-gray-100"><X size={24}/></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">واحد درخواست‌کننده</label>
                            <input className="w-full border rounded-xl p-2.5 text-xs font-bold bg-white" value={requestingUnit} onChange={e => setRequestingUnit(e.target.value)} required />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">درجه فوریت تامین</label>
                            <select className="w-full border rounded-xl p-2.5 text-xs font-black bg-white" value={urgency} onChange={e => setUrgency(e.target.value as any)}>
                                <option value="عادی">🟢 عادی (روتین)</option>
                                <option value="فوری">🟡 فوری (تامین سریع)</option>
                                <option value="اضطراری">🔴 اضطراری (توقف خط)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">دستگاه / ماشین‌آلات مربوطه</label>
                            <input className="w-full border rounded-xl p-2.5 text-xs font-bold bg-white" value={machinery} onChange={e => setMachinery(e.target.value)} placeholder="مثلاً: پرس اکستروژن ۳۰۰۰ تن" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">محل نصب / مصرف</label>
                            <input className="w-full border rounded-xl p-2.5 text-xs font-bold bg-white" value={installationLocation} onChange={e => setInstallationLocation(e.target.value)} placeholder="مثلاً: خط انودایز / کارگاه ۲" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">شماره درخواست تعمیر (تولید خودکار)</label>
                            <input className="w-full border rounded-xl p-2.5 text-xs font-mono font-bold bg-gray-100 cursor-not-allowed text-gray-500" value={repairRequestNumber} readOnly />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">شرح خرابی / علت نیاز</label>
                            <input className="w-full border rounded-xl p-2.5 text-xs font-bold bg-white" value={breakdownDescription} onChange={e => setBreakdownDescription(e.target.value)} placeholder="مثلاً: شکستگی بلبرینگ شفت اصلی" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">توجیه لزوم خرید</label>
                            <input className="w-full border rounded-xl p-2.5 text-xs font-bold bg-white" value={purchaseReason} onChange={e => setPurchaseReason(e.target.value)} placeholder="عدم وجود در انبار و خطر توقف تولید" />
                        </div>
                    </div>

                    <div className="border border-gray-200 rounded-3xl overflow-hidden shadow-sm bg-white">
                        <div className="bg-gradient-to-r from-gray-800 to-indigo-900 text-white p-3 px-4 flex justify-between items-center">
                            <span className="text-xs font-black flex items-center gap-2"><Package size={16}/> جدول اقلام درخواستی (تعدد اقلام)</span>
                            <button type="button" onClick={handleAddItemRow} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 transition-all">
                                <Plus size={14}/> افزودن ردیف کالا
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-right dir-rtl">
                                <thead className="bg-gray-100 border-b text-gray-600 font-bold">
                                    <tr>
                                        <th className="p-2.5 w-10 text-center">#</th>
                                        <th className="p-2.5 min-w-[180px]">انتخاب از انبار یا نام کالا</th>
                                        <th className="p-2.5 w-28">کد فنی کالا</th>
                                        <th className="p-2.5 w-28">برند / سازنده پیشنهاد</th>
                                        <th className="p-2.5 w-20 text-center">تعداد</th>
                                        <th className="p-2.5 w-24">واحد</th>
                                        <th className="p-2.5">مشخصات فنی و نقشه</th>
                                        <th className="p-2.5 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {items.map((it, index) => (
                                        <tr key={it.id} className="hover:bg-gray-50/80">
                                            <td className="p-2 text-center font-mono font-bold text-gray-400">{index + 1}</td>
                                            <td className="p-2">
                                                <div className="space-y-1">
                                                    {parts && parts.length > 0 && (
                                                        <select className="w-full border rounded-lg p-1.5 text-[10px] text-gray-500 bg-gray-50" onChange={e => handleSelectPart(it.id, e.target.value)}>
                                                            <option value="">-- انتخاب از کاتالوگ انبار (اختیاری) --</option>
                                                            {parts.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.category})</option>)}
                                                        </select>
                                                    )}
                                                    <input className="w-full border rounded-lg p-2 text-xs font-black text-gray-800" value={it.itemName} onChange={e => handleItemChange(it.id, 'itemName', e.target.value)} placeholder="نام دقیق کالا / قطعه" required />
                                                </div>
                                            </td>
                                            <td className="p-2"><input className="w-full border rounded-lg p-2 text-xs font-mono" value={it.itemCode || ''} onChange={e => handleItemChange(it.id, 'itemCode', e.target.value)} placeholder="PN-1002" /></td>
                                            <td className="p-2"><input className="w-full border rounded-lg p-2 text-xs" value={it.suggestedBrand || ''} onChange={e => handleItemChange(it.id, 'suggestedBrand', e.target.value)} placeholder="مثلاً: SKF, Siemens" /></td>
                                            <td className="p-2"><input type="number" min="1" className="w-full border rounded-lg p-2 text-xs text-center font-black text-indigo-700" value={it.quantity} onChange={e => handleItemChange(it.id, 'quantity', +e.target.value)} required /></td>
                                            <td className="p-2">
                                                <select className="w-full border rounded-lg p-2 text-xs font-bold" value={it.unit} onChange={e => handleItemChange(it.id, 'unit', e.target.value)}>
                                                    <option value="عدد">عدد</option>
                                                    <option value="کیلوگرم">کیلوگرم</option>
                                                    <option value="متر">متر</option>
                                                    <option value="دستگاه">دستگاه</option>
                                                    <option value="پک/بسته">پک/بسته</option>
                                                    <option value="لیتر">لیتر</option>
                                                    <option value="شاخه">شاخه</option>
                                                </select>
                                            </td>
                                            <td className="p-2"><input className="w-full border rounded-lg p-2 text-xs" value={it.specifications || ''} onChange={e => handleItemChange(it.id, 'specifications', e.target.value)} placeholder="ابعاد، ولتاژ، استاندارد و..." /></td>
                                            <td className="p-2 text-center">
                                                {items.length > 1 && (
                                                    <button type="button" onClick={() => handleRemoveItemRow(it.id)} className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50"><Trash2 size={16}/></button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-800 flex items-center gap-2"><Paperclip size={16}/> پیوست مدارک فنی، نقشه، کاتالوگ یا عکس خرابی (PDF/Word/Excel/عکس)</span>
                            <label className="bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer transition-all flex items-center gap-1.5">
                                <UploadCloud size={16}/> آپلود فایل
                                <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                            </label>
                        </div>
                        {attachments.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2">
                                {attachments.map(att => (
                                    <div key={att.id} className="p-2 bg-white rounded-xl border border-gray-200 flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <FileText size={16} className="text-indigo-500 shrink-0" />
                                            <span className="font-bold text-gray-700 truncate">{att.fileName}</span>
                                        </div>
                                        <button type="button" onClick={() => setAttachments(attachments.filter(a => a.id !== att.id))} className="text-red-500 hover:bg-red-50 p-1 rounded-lg"><X size={14}/></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={onClose} className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-xs transition-all">انصراف</button>
                        <button type="submit" disabled={loading || uploading} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl text-xs shadow-xl shadow-indigo-100 transition-all flex items-center gap-2">
                            {loading ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle size={18}/>}
                            ثبت و ارسال به کارشناس فنی کارخانه
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

// --- SUBMODALS FOR NEW WORKFLOW STAGES ---

const ReturnModal = ({ onClose, onConfirm, currentStatus }: { onClose: () => void, onConfirm: (prevStage: PurchaseRequestStatus, reason: string) => void, currentStatus: PurchaseRequestStatus }) => {
    const [reason, setReason] = useState('');
    const [targetStage, setTargetStage] = useState<PurchaseRequestStatus>(PurchaseRequestStatus.PENDING_TECHNICAL);

    const availableStages = [
        { status: PurchaseRequestStatus.PENDING_TECHNICAL, label: 'مرحله ۱: بررسی و تایید فنی نت' },
        { status: PurchaseRequestStatus.PENDING_SHIFT_LEADER, label: 'مرحله ۱.۵: تایید سرشیفت کارخانه' },
        { status: PurchaseRequestStatus.PENDING_WAREHOUSE_KEEPER, label: 'مرحله ۲: بررسی موجودی انباردار کارخانه' },
        { status: PurchaseRequestStatus.PENDING_COMMERCIAL_DECISION, label: 'مرحله ۳: تصمیم‌گیری مسیر خرید' },
        { status: PurchaseRequestStatus.PENDING_TEHRAN_PROFORMA, label: 'مرحله استعلام / ثبت پروفرما' },
        { status: PurchaseRequestStatus.PENDING_COMMERCIAL_MANAGER, label: 'مرحله بررسی مدیر بازرگانی' },
        { status: PurchaseRequestStatus.PENDING_FACTORY_MANAGER_APPROVAL, label: 'مرحله دستور خرید مدیر کارخانه' },
        { status: PurchaseRequestStatus.PENDING_BUYER_EXECUTION, label: 'مرحله اجرای خرید کارپرداز' },
    ];

    return createPortal(
        <div className="fixed inset-0 z-[100000008] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl animate-scale-in text-right dir-rtl">
                <div className="flex items-center gap-3 mb-6 text-amber-600 border-b pb-4">
                    <CornerUpLeft size={28} />
                    <div>
                        <h3 className="font-black text-xl text-gray-800">عودت درخواست جهت اصلاح</h3>
                        <p className="text-xs text-gray-500 mt-0.5">بازگشت به مرحله قبلی با ثبت دلایل فنی یا اداری</p>
                    </div>
                </div>
                <div className="space-y-5">
                    <div>
                        <label className="text-xs font-bold text-gray-700 block mb-2">مرحله مقصد جهت عودت:</label>
                        <select className="w-full border rounded-xl p-3 text-xs font-bold bg-gray-50 outline-none focus:ring-2 focus:ring-amber-200" value={targetStage} onChange={e => setTargetStage(e.target.value as PurchaseRequestStatus)}>
                            {availableStages.map(s => (
                                <option key={s.status} value={s.status}>{s.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-700 block mb-2">علت و توضیحات عودت <span className="text-red-500">*</span>:</label>
                        <textarea className="w-full border rounded-xl p-3 text-xs h-28 focus:ring-2 focus:ring-amber-200 outline-none" value={reason} onChange={e => setReason(e.target.value)} placeholder="علت بازگشت و اصلاحات لازم را بنویسید..." />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button onClick={() => { if(!reason.trim()) return alert('ثبت علت عودت الزامی است'); onConfirm(targetStage, reason); }} className="flex-1 bg-amber-600 text-white font-black py-3.5 rounded-2xl shadow-lg active:scale-95 transition-all text-xs">تایید و عودت پرونده</button>
                        <button onClick={onClose} className="px-6 bg-gray-100 text-gray-600 font-bold text-xs rounded-2xl">انصراف</button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const RejectModal = ({ onClose, onConfirm }: { onClose: () => void, onConfirm: (reason: string) => void }) => {
    const [reason, setReason] = useState('');

    return createPortal(
        <div className="fixed inset-0 z-[100000008] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl animate-scale-in text-right dir-rtl">
                <div className="flex items-center gap-3 mb-6 text-red-600 border-b pb-4">
                    <AlertTriangle size={28} />
                    <div>
                        <h3 className="font-black text-xl text-gray-800">رد و توقف کلی فرآیند خرید</h3>
                        <p className="text-xs text-gray-500 mt-0.5">ثبت دلیل رد و خاتمه درخواست در سامانه</p>
                    </div>
                </div>
                <div className="space-y-5">
                    <div>
                        <label className="text-xs font-bold text-gray-700 block mb-2">علت رد درخواست <span className="text-red-500">*</span>:</label>
                        <textarea className="w-full border rounded-xl p-3 text-xs h-32 focus:ring-2 focus:ring-red-200 outline-none" value={reason} onChange={e => setReason(e.target.value)} placeholder="دلایل عدم موافقت با این درخواست خرید را وارد کنید..." />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button onClick={() => { if(!reason.trim()) return alert('ثبت علت رد الزامی است'); onConfirm(reason); }} className="flex-1 bg-red-600 text-white font-black py-3.5 rounded-2xl shadow-lg active:scale-95 transition-all text-xs">تایید و رد درخواست</button>
                        <button onClick={onClose} className="px-6 bg-gray-100 text-gray-600 font-bold text-xs rounded-2xl">انصراف</button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const WarehouseCheckModal = ({ onClose, onConfirm }: { onClose: () => void, onConfirm: (inStock: boolean, data: any) => void }) => {
    const [inStock, setInStock] = useState(false);
    const [exitNumber, setExitNumber] = useState(() => {
        const shamsi = getCurrentShamsiDate();
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        return `OUT-${shamsi.year}/${randomNum}`;
    });
    const [recipient, setRecipient] = useState('');
    const [notes, setNotes] = useState('');

    return createPortal(
        <div className="fixed inset-0 z-[100000008] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl animate-scale-in text-right dir-rtl">
                <div className="flex items-center gap-3 mb-6 text-indigo-600 border-b pb-4">
                    <Warehouse size={28} />
                    <div>
                        <h3 className="font-black text-lg text-gray-800">بررسی موجودی انبار توسط سرشیفت</h3>
                        <p className="text-xs text-gray-500">بررسی امکان تحویل مستقیم کالا یا ارجاع جهت خرید</p>
                    </div>
                </div>
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-2xl">
                        <button onClick={() => setInStock(true)} className={`py-3 rounded-xl text-xs font-black transition-all ${inStock ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-600'}`}>
                            تحویل مستقیم از انبار
                        </button>
                        <button onClick={() => setInStock(false)} className={`py-3 rounded-xl text-xs font-black transition-all ${!inStock ? 'bg-amber-600 text-white shadow-md' : 'text-gray-600'}`}>
                            عدم موجودی (خرید)
                        </button>
                    </div>

                    {inStock ? (
                        <div className="space-y-3 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                            <div>
                                <label className="text-[10px] font-bold text-gray-600 block mb-1">شماره حواله خروج انبار (تولید خودکار):</label>
                                <input className="w-full border rounded-xl p-2.5 text-xs font-mono font-bold bg-gray-100 cursor-not-allowed text-gray-500" value={exitNumber} readOnly />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-600 block mb-1">نام تحویل‌گیرنده:</label>
                                <input className="w-full border rounded-xl p-2.5 text-xs font-bold" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="نام واحد یا فرد تحویل گیرنده" />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">ملاحظات انبارداری:</label>
                            <textarea className="w-full border rounded-xl p-3 text-xs h-24 focus:ring-2 focus:ring-indigo-100 outline-none" value={notes} onChange={e => setNotes(e.target.value)} placeholder="توضیحات عدم وجود در انبار یا حداقل موجودی..." />
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button onClick={() => onConfirm(inStock, { warehouseExitVoucherNumber: exitNumber, warehouseRecipient: recipient, warehouseNotes: notes })} className="flex-1 bg-indigo-600 text-white font-black py-3.5 rounded-2xl shadow-lg active:scale-95 transition-all text-xs">ثبت و ادامه فرآیند</button>
                        <button onClick={onClose} className="px-6 bg-gray-100 text-gray-600 font-bold text-xs rounded-2xl">انصراف</button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const FactoryBranchModal = ({ onClose, onConfirm }: { onClose: () => void, onConfirm: (location: 'Tehran' | 'Factory', notes: string) => void }) => {
    const [selectedBranch, setSelectedBranch] = useState<'Tehran' | 'Factory'>('Tehran');
    const [notes, setNotes] = useState('');

    return createPortal(
        <div className="fixed inset-0 z-[100000008] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl animate-scale-in text-right dir-rtl">
                <div className="flex items-center gap-3 mb-6 text-amber-600 border-b pb-4">
                    <GitFork size={28} />
                    <div>
                        <h3 className="font-black text-lg text-gray-800">تعیین مسیر تامین و خرید</h3>
                        <p className="text-xs text-gray-500">انتخاب شاخه خرید از بازرگانی تهران یا تامین محلی کارخانه</p>
                    </div>
                </div>
                <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div onClick={() => setSelectedBranch('Tehran')} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedBranch === 'Tehran' ? 'border-sky-500 bg-sky-50 shadow-md ring-2 ring-sky-200' : 'border-gray-200 hover:border-sky-200'}`}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-black text-xs text-sky-800">مسیر ۱: خرید از تهران</span>
                                <span className="w-3 h-3 rounded-full bg-sky-500"></span>
                            </div>
                            <p className="text-[10px] text-gray-500 leading-relaxed">ارسال پرونده به دفتر مرکزی تهران جهت استعلامات کلی و تایید مدیرعامل</p>
                        </div>
                        <div onClick={() => setSelectedBranch('Factory')} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedBranch === 'Factory' ? 'border-teal-500 bg-teal-50 shadow-md ring-2 ring-teal-200' : 'border-gray-200 hover:border-teal-200'}`}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-black text-xs text-teal-800">مسیر ۲: خرید کارخانه (زنجان)</span>
                                <span className="w-3 h-3 rounded-full bg-teal-500"></span>
                            </div>
                            <p className="text-[10px] text-gray-500 leading-relaxed">تامین سریع و خرید محلی قطعات توسط انبار و کارپرداز کارخانه زنجان</p>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-700 block mb-1">دستور و ملاحظات مدیر کارخانه:</label>
                        <textarea className="w-full border rounded-xl p-3 text-xs h-24 focus:ring-2 focus:ring-amber-200 outline-none" value={notes} onChange={e => setNotes(e.target.value)} placeholder="توضیحات و نکات الزام‌آور خرید..." />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button onClick={() => onConfirm(selectedBranch, notes)} className="flex-1 bg-amber-600 text-white font-black py-3.5 rounded-2xl shadow-lg active:scale-95 transition-all text-xs">تایید و ارجاع شاخه</button>
                        <button onClick={onClose} className="px-6 bg-gray-100 text-gray-600 font-bold text-xs rounded-2xl">انصراف</button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const TechnicalApprovalModal = ({ onClose, onConfirm }: { onClose: () => void, onConfirm: (data: any) => void }) => {
    const [specsOk, setSpecsOk] = useState(true);
    const [brandOk, setBrandOk] = useState(true);
    const [equipmentOk, setEquipmentOk] = useState(true);
    const [techReport, setTechReport] = useState('');
    
    // Quality Control Fields
    const [qcStatus, setQcStatus] = useState<'تایید' | 'مشروط' | 'رد'>('تایید');
    const [qcNotes, setQcNotes] = useState('');
    const [inspectorName, setInspectorName] = useState('');

    return createPortal(
        <div className="fixed inset-0 z-[100000008] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl animate-scale-in text-right dir-rtl">
                <div className="flex items-center gap-3 mb-6 text-indigo-600 border-b pb-4">
                    <Wrench size={28} />
                    <div>
                        <h3 className="font-black text-lg text-gray-800">فرم یکپارچه تایید فنی و کنترل کیفی (QC/Net)</h3>
                        <p className="text-xs text-gray-500">بررسی همزمان تطابق فنی، کنترل کیفی و سلامت فیزیکی قطعات</p>
                    </div>
                </div>
                <div className="space-y-6">
                    {/* Section 1: Technical specs Check */}
                    <div>
                        <h4 className="text-xs font-black text-indigo-600 mb-2.5 flex items-center gap-1.5 border-r-4 border-indigo-500 pr-2">۱. تایید مشخصات فنی و تطابق سفارش</h4>
                        <div className="space-y-2 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                            <label className="flex items-center gap-3 text-xs font-bold text-gray-700 cursor-pointer">
                                <input type="checkbox" checked={specsOk} onChange={e => setSpecsOk(e.target.checked)} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-300" />
                                تطابق مشخصات فنی، ابعاد، گام، رزوه و شفت قطعه
                            </label>
                            <label className="flex items-center gap-3 text-xs font-bold text-gray-700 cursor-pointer">
                                <input type="checkbox" checked={brandOk} onChange={e => setBrandOk(e.target.checked)} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-300" />
                                تایید اصالت برند، کاتالوگ و گواهی مبدا سازنده
                            </label>
                            <label className="flex items-center gap-3 text-xs font-bold text-gray-700 cursor-pointer">
                                <input type="checkbox" checked={equipmentOk} onChange={e => setEquipmentOk(e.target.checked)} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-300" />
                                تست و تطابق کامل با ماشین‌آلات هدف و خطوط تولید
                            </label>
                        </div>
                    </div>

                    {/* Section 2: QC Check */}
                    <div>
                        <h4 className="text-xs font-black text-emerald-600 mb-2.5 flex items-center gap-1.5 border-r-4 border-emerald-500 pr-2">۲. ارزیابی کنترل کیفی و بازرسی فیزیکی</h4>
                        <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100 space-y-3">
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">نتیجه بازرسی کیفی:</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button 
                                        type="button" 
                                        onClick={() => setQcStatus('تایید')} 
                                        className={`py-2 text-xs font-black rounded-xl border transition-all ${qcStatus === 'تایید' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                                    >
                                        تایید کامل کیفی
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setQcStatus('مشروط')} 
                                        className={`py-2 text-xs font-black rounded-xl border transition-all ${qcStatus === 'مشروط' ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                                    >
                                        تایید مشروط / اصلاحی
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setQcStatus('رد')} 
                                        className={`py-2 text-xs font-black rounded-xl border transition-all ${qcStatus === 'رد' ? 'bg-red-600 text-white border-red-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                                    >
                                        مردود / عودت کالا
                                    </button>
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">نام بازرس یا تایید کننده کیفی:</label>
                                <input className="w-full border rounded-xl p-2.5 text-xs font-black text-gray-800 outline-none focus:ring-2 focus:ring-emerald-200" value={inspectorName} onChange={e => setInspectorName(e.target.value)} placeholder="مثلاً: مهندس احمدی" />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Technical report Text area */}
                    <div>
                        <label className="text-xs font-black text-gray-700 block mb-1">گزارش کارشناسی نهایی واحد فنی و QC:</label>
                        <textarea className="w-full border rounded-xl p-3 text-xs h-24 focus:ring-2 focus:ring-indigo-100 outline-none" value={techReport} onChange={e => setTechReport(e.target.value)} placeholder="نتایج دقیق تست فیزیکی، مرغوبیت، ابعاد اندازه‌گیری شده و انحرافات احتمالی..." />
                    </div>

                    {/* Submit and Close Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button 
                            onClick={() => onConfirm({ 
                                technicalReport: techReport, 
                                specsApproved: specsOk, 
                                brandApproved: brandOk, 
                                equipmentMatchApproved: equipmentOk,
                                qcResult: qcStatus,
                                qcDescription: qcNotes || techReport,
                                qcInspector: inspectorName
                            })} 
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3.5 rounded-2xl shadow-lg active:scale-95 transition-all text-xs"
                        >
                            تایید نهایی فرم و ارجاع به مدیر کارخانه
                        </button>
                        <button onClick={onClose} className="px-6 bg-gray-100 text-gray-600 font-bold text-xs rounded-2xl hover:bg-gray-200 transition">انصراف</button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const PurchasingAgentModal = ({ onClose, onConfirm }: { onClose: () => void, onConfirm: (data: any) => void }) => {
    const [vendor, setVendor] = useState('');
    const [invoiceNum, setInvoiceNum] = useState('');
    const [amount, setAmount] = useState<number>(0);
    const [buyerName, setBuyerName] = useState('');

    return createPortal(
        <div className="fixed inset-0 z-[100000008] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl animate-scale-in text-right dir-rtl">
                <div className="flex items-center gap-3 mb-6 text-teal-600 border-b pb-4">
                    <ShoppingCart size={28} />
                    <div>
                        <h3 className="font-black text-lg text-gray-800">ثبت فاکتور و خرید کارپرداز</h3>
                        <p className="text-xs text-gray-500">ورود مشخصات فاکتور و صورت‌حساب خرید</p>
                    </div>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-700 block mb-1">نام فروشنده / تامین‌کننده:</label>
                        <input className="w-full border rounded-xl p-3 text-xs font-bold" value={vendor} onChange={e => setVendor(e.target.value)} placeholder="نام فروشگاه یا شرکت تامین کننده" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">شماره فاکتور خرید:</label>
                            <input className="w-full border rounded-xl p-3 text-xs font-bold" value={invoiceNum} onChange={e => setInvoiceNum(e.target.value)} placeholder="مثلاً: 1402/904" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">مامور خرید / کارپرداز:</label>
                            <input className="w-full border rounded-xl p-3 text-xs font-bold" value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder="نام کارپرداز" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-700 block mb-1">مبلغ کل فاکتور (ریال):</label>
                        <input type="number" className="w-full border rounded-xl p-3 text-sm font-black text-indigo-600" value={amount} onChange={e => setAmount(+e.target.value)} />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button onClick={() => onConfirm({ vendorName: vendor, invoiceNumber: invoiceNum, totalPaidAmount: amount, purchasingAgentName: buyerName })} className="flex-1 bg-teal-600 text-white font-black py-3.5 rounded-2xl shadow-lg active:scale-95 transition-all text-xs">ثبت فاکتور و ارجاع به ورود کالا</button>
                        <button onClick={onClose} className="px-6 bg-gray-100 text-gray-600 font-bold text-xs rounded-2xl">انصراف</button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const ViewRequestModal = ({ request, onClose, currentUser, onSuccess, settings, parts }: { request: PurchaseRequest, onClose: () => void, currentUser: User, onSuccess: () => void, settings?: SystemSettings, parts: PartMasterData[] }) => {
    const [actionLoading, setActionLoading] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [showProformaModal, setShowProformaModal] = useState(false);
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [showQCModal, setShowQCModal] = useState(false);
    const [showWarehouseModal, setShowWarehouseModal] = useState(false);
    const [showAdminEditModal, setShowAdminEditModal] = useState(false);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showWarehouseCheckModal, setShowWarehouseCheckModal] = useState(false);
    const [showFactoryBranchModal, setShowFactoryBranchModal] = useState(false);
    const [showTechnicalApprovalModal, setShowTechnicalApprovalModal] = useState(false);
    const [showPurchasingAgentModal, setShowPurchasingAgentModal] = useState(false);
    const [printingProforma, setPrintingProforma] = useState<PurchaseProforma | null>(null);
    const [printType, setPrintType] = useState<'REQUEST' | 'PROFORMA' | 'RECEIPT' | 'BARCODE'>('REQUEST');

    const handleAction = async (nextStatus: PurchaseRequestStatus, extra: any = {}, actionLabel?: string) => {
        setActionLoading(true);
        try {
            const nowIso = new Date().toISOString();
            const newAuditLog: PurchaseAuditLog = {
                id: generateUUID(),
                stage: nextStatus,
                action: actionLabel || extra.actionName || `انتقال به مرحله ${nextStatus}`,
                performedBy: currentUser.fullName,
                role: currentUser.role,
                timestamp: nowIso,
                comment: extra.comment || extra.returnReason || extra.notes || extra.technicalReport || extra.qcDescription || ''
            };

            const updated = { 
                ...request, 
                status: nextStatus, 
                updatedAt: Date.now(), 
                auditLogs: [...(request.auditLogs || []), newAuditLog],
                ...extra 
            };
            
            // Approval Trails logic
            if (nextStatus === PurchaseRequestStatus.PENDING_FACTORY) updated.approverTechnical = currentUser.fullName;
            if (nextStatus === PurchaseRequestStatus.PENDING_COMMERCIAL_DECISION) updated.approverFactory = currentUser.fullName;
            
            if (nextStatus === PurchaseRequestStatus.PENDING_TEHRAN_PURCHASING) updated.approverCommercial = currentUser.fullName;
            if (nextStatus === PurchaseRequestStatus.PENDING_FACTORY_PURCHASING) updated.approverCommercial = currentUser.fullName;
            
            if (nextStatus === PurchaseRequestStatus.PENDING_CEO_INITIAL) updated.approverCommercial = currentUser.fullName;
            if (nextStatus === PurchaseRequestStatus.PENDING_TEHRAN_PROFORMA) updated.approverCeoInitial = currentUser.fullName;
            if (nextStatus === PurchaseRequestStatus.PENDING_SECURITY_ENTRY) {
                if (request.status === PurchaseRequestStatus.PENDING_CEO_SELECTION) updated.approverCeoSelection = currentUser.fullName;
                if (request.status === PurchaseRequestStatus.PENDING_FACTORY_MANAGER_SELECTION) updated.approverFactorySelection = currentUser.fullName;
            }
            
            if (nextStatus === PurchaseRequestStatus.PENDING_FACTORY_FINAL_APPROVE) updated.approverQc = currentUser.fullName;
            if (nextStatus === PurchaseRequestStatus.PENDING_WAREHOUSE_RECEIPT) updated.approverFactoryFinal = currentUser.fullName;
            if (nextStatus === PurchaseRequestStatus.PENDING_FACTORY_FINAL_SIGN) updated.approverWarehouseReceipt = currentUser.fullName;
            if (nextStatus === PurchaseRequestStatus.COMPLETED) updated.approverFactoryArchive = currentUser.fullName;
            
            await updatePurchaseRequest(updated);
            onSuccess();
            onClose();
        } catch (e) { alert('خطا در عملیات'); console.error(e); }
        finally { setActionLoading(false); }
    };

    const handleDelete = async () => {
        if (!confirm('آیا از حذف این درخواست اطمینان دارید؟ این عمل غیرقابل بازگشت است.')) return;
        setActionLoading(true);
        try {
            await deletePurchaseRequest(request.id);
            onSuccess();
            onClose();
        } catch (e) {
            alert('خطا در حذف درخواست');
            console.error(e);
        } finally {
            setActionLoading(false);
        }
    };

    const isCurrentStep = (step: PurchaseRequestStatus) => request.status === step;

    const isRole = (roleName: string) => {
        if (currentUser.role === roleName) return true;
        if (currentUser.roles && currentUser.roles.includes(roleName)) return true;
        return false;
    };

    const isAdmin = isRole(UserRole.ADMIN);

    const hasPurchasePerm = (perm: string) => {
        if (isAdmin) return true;
        
        let hasPerm = false;
        const rolesList = currentUser.roles && currentUser.roles.length > 0 ? currentUser.roles : [currentUser.role];
        for (const r of rolesList) {
            if (r === UserRole.ADMIN) return true;
            const rolePerms = settings?.purchaseRolePermissions?.[r] || {};
            if (!!(rolePerms as any)[perm]) {
                hasPerm = true;
            }
        }
        return hasPerm;
    };

    return createPortal(
        <div className="fixed inset-0 z-[100000005] flex items-start justify-center p-2 md:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto pt-16 md:pt-20">
            <div className="bg-white rounded-[2.5rem] w-full max-w-[94vw] lg:max-w-6xl xl:max-w-7xl overflow-hidden shadow-2xl border border-white/20 animate-in fade-in zoom-in h-auto min-h-[60vh] max-h-[96vh] md:max-h-[94vh] flex flex-col relative mb-10">
                <div className="p-4 md:p-6 border-b flex justify-between items-center bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-900 text-white shrink-0 z-20 shadow-lg">
                    <div className="flex items-center gap-3">
                        <div className="p-2 md:p-3 bg-white/10 rounded-2xl">
                             <ShoppingCart size={window.innerWidth < 768 ? 22 : 28} />
                        </div>
                        <div>
                            <h2 className="text-base md:text-xl font-black italic">گردش کار درخواست خرید</h2>
                            <p className="text-[9px] md:text-[10px] opacity-80 uppercase tracking-widest font-mono">{request.requestNumber} | {request.status}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isAdmin && (
                            <button 
                                onClick={() => setShowAdminEditModal(true)}
                                className="p-2 md:p-2.5 bg-blue-500/20 hover:bg-blue-500/40 text-white rounded-xl transition-all flex items-center gap-2 text-[10px] md:text-xs font-bold ring-1 ring-white/20"
                            >
                                <Edit size={window.innerWidth < 768 ? 16 : 18} />
                                <span className="hidden md:inline">ویرایش مدیریت</span>
                            </button>
                        )}
                        <button 
                            onClick={handleDelete} 
                            disabled={actionLoading}
                            className="p-2 md:p-2.5 bg-red-500/20 hover:bg-red-500/40 text-white rounded-xl transition-all flex items-center gap-2 text-[10px] md:text-xs font-bold ring-1 ring-white/20"
                            title="حذف درخواست"
                        >
                            <Trash2 size={window.innerWidth < 768 ? 16 : 20} />
                            <span className="hidden md:inline">حذف</span>
                        </button>
                        <button onClick={onClose} className="p-1 md:p-2 bg-red-500/20 hover:bg-red-500 hover:rotate-90 rounded-xl transition-all text-white border border-white/20"><X size={window.innerWidth < 768 ? 24 : 28} strokeWidth={3} /></button>
                    </div>
                </div>
                
                {showAdminEditModal && (
                    <AdminEditRequestModal 
                        request={request} 
                        onClose={() => setShowAdminEditModal(false)} 
                        onSuccess={() => { onSuccess(); onClose(); }}
                        parts={parts}
                    />
                )}

                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50 no-scrollbar">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            {/* Core Info */}
                            <div className="glass-panel p-6 rounded-3xl border border-gray-200 bg-white shadow-sm">
                                <div className="flex justify-between items-start mb-6">
                                    <h3 className="text-sm font-black text-gray-800 flex items-center gap-2"><Package className="text-indigo-500" size={18}/> اطلاعات کالا</h3>
                                    <span className="text-[10px] font-mono bg-gray-100 px-3 py-1 rounded-full text-gray-500 font-bold uppercase">{request.requestNumber}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                                    <div><label className="text-[10px] font-bold text-gray-400 block mb-1">نام قطعه / کالا:</label><p className="text-sm font-black text-gray-800">{request.itemName}</p></div>
                                    <div><label className="text-[10px] font-bold text-gray-400 block mb-1">دسته بندی:</label><p className="text-sm font-bold text-gray-700">{request.category} {request.subCategory && `| ${request.subCategory}`}</p></div>
                                    <div><label className="text-[10px] font-bold text-gray-400 block mb-1">تعداد درخواستی:</label><p className="text-lg font-black text-indigo-600">{request.quantity} {request.unit}</p></div>
                                    <div><label className="text-[10px] font-bold text-gray-400 block mb-1">تاریخ ثبت:</label><p className="text-sm font-bold text-gray-700">{formatDate(request.date)}</p></div>
                                    <div className="col-span-2"><label className="text-[10px] font-bold text-gray-400 block mb-1">مشخصات فنی و ملاحظات:</label><p className="text-xs text-gray-600 font-medium leading-relaxed bg-gray-50 p-3 rounded-xl border border-dashed border-gray-200">{request.specifications || '---'}</p></div>
                                </div>
                            </div>

                            {/* Proformas */}
                            <div className="glass-panel p-6 rounded-3xl border border-indigo-100 bg-white shadow-sm overflow-hidden relative">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-black text-gray-800 flex items-center gap-2"><FileText className="text-indigo-500" size={18}/> پیش‌فاکتورها و استعلام‌ها</h3>
                                    {(isCurrentStep(PurchaseRequestStatus.PENDING_TEHRAN_PROFORMA) || isCurrentStep(PurchaseRequestStatus.PENDING_FACTORY_PROFORMA) || isCurrentStep(PurchaseRequestStatus.PENDING_ZANJAN_PURCHASING)) && hasPurchasePerm('canManageProformas') && (
                                        <button onClick={() => setShowProformaModal(true)} className="text-xs font-black bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg shadow-indigo-100 flex items-center gap-2"><Plus size={14}/> ثبت پیش‌فاکتور</button>
                                    )}
                                </div>
                                
                                {request.proformas.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-2 border-2 border-dashed border-gray-100 rounded-2xl">
                                        <FileText size={40} className="opacity-20" />
                                        <p className="text-xs font-bold italic">هنوز پیش‌فاکتوری ثبت نشده است</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {request.proformas.map((p: PurchaseProforma) => (
                                            <div key={p.id} className={`p-4 rounded-2xl border-2 transition-all ${p.isChosen ? 'border-green-500 bg-green-50/50 shadow-md' : 'border-gray-100 hover:border-indigo-100 bg-gray-50/30'}`}>
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <p className="text-xs font-black text-gray-800">{p.vendorName}</p>
                                                        <p className="text-[10px] text-gray-500 font-bold">{p.number} | {formatDate(p.date)}</p>
                                                    </div>
                                                    {p.isChosen && <span className="bg-green-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm">انتخاب شده</span>}
                                                </div>
                                                <div className="flex justify-between items-center border-t border-gray-100 pt-3">
                                                    <span className="text-sm font-black text-indigo-700">{formatCurrency(p.totalAmount)} <span className="text-[9px]">ریال</span></span>
                                                    <div className="flex gap-1">
                                                        <button 
                                                            onClick={() => {
                                                                setPrintingProforma(p);
                                                                setTimeout(() => window.print(), 300);
                                                            }}
                                                            className="p-2 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50" title="چاپ پیش‌فاکتور"
                                                        >
                                                            <Printer size={14}/>
                                                        </button>
                                                        {(isAdmin || hasPurchasePerm('canSelectProforma')) && !p.isChosen && (
                                                            <button 
                                                                onClick={() => {
                                                                    if(confirm('آیا این پیش‌فاکتور را برای خرید تایید می‌کنید؟')) {
                                                                        const updated = request.proformas.map(x => ({ ...x, isChosen: x.id === p.id }));
                                                                        handleAction(PurchaseRequestStatus.PENDING_TECHNICAL_APPROVAL, { proformas: updated }, 'تایید و انتخاب تامین‌کننده');
                                                                    }
                                                                }}
                                                                className="px-3 py-1.5 bg-green-600 text-white text-[10px] font-black rounded-lg shadow-sm"
                                                            >
                                                                تایید و انتخاب
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Arrival & QC Details */}
                            {(request.entryQuantity || request.qcResult) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="glass-panel p-6 rounded-3xl border border-orange-100 bg-white">
                                        <h3 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2"><Truck className="text-orange-500" size={18}/> اطلاعات ورود (انتظامات)</h3>
                                        <div className="space-y-3">
                                            <div className="flex justify-between text-xs border-b pb-2"><span className="text-gray-500">تعداد ورودی:</span> <span className="font-black text-orange-700">{request.entryQuantity} {request.unit}</span></div>
                                            <div className="flex justify-between text-xs border-b pb-2"><span className="text-gray-500">وزن ورودی:</span> <span className="font-bold">{request.entryWeight || '-'} کیلوگرم</span></div>
                                            <div className="flex justify-between text-xs"><span className="text-gray-500">زمان ورود:</span> <span className="font-bold">{request.entryDate} {request.entryTime}</span></div>
                                        </div>
                                    </div>
                                    <div className="glass-panel p-6 rounded-3xl border border-green-100 bg-white">
                                        <h3 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2"><ShieldCheck className="text-green-500" size={18}/> کنترل کیفی (QC)</h3>
                                        <div className="space-y-3">
                                            <div className="flex justify-between text-xs border-b pb-2"><span className="text-gray-500">نتیجه بررسی:</span> <span className={`font-black ${request.qcResult === 'تایید' ? 'text-green-600' : 'text-red-500'}`}>{request.qcResult || 'در انتظار'}</span></div>
                                            <div className="flex flex-col gap-1 text-xs"><span className="text-gray-500">ملاحظات کیفی:</span> <p className="text-[10px] bg-gray-50 p-2 rounded-lg italic">{request.qcDescription || 'فاقد ملاحظات'}</p></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sidebar Approvals */}
                        <div className="space-y-6">
                             <div className="glass-panel p-6 rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                                <h3 className="text-sm font-black text-gray-800 mb-6 border-b pb-3 border-gray-100 flex items-center gap-2"><ClipboardCheck className="text-indigo-500" size={18}/> تاریخچه و لاگ‌های سیستم</h3>
                                <div className="space-y-6 relative before:absolute before:right-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100 max-h-96 overflow-y-auto pl-2 no-scrollbar">
                                    {(request.auditLogs && request.auditLogs.length > 0 ? request.auditLogs : [
                                        { stage: request.status, action: 'ثبت درخواست اولیه', performedBy: request.requester, role: 'انبار / متقاضی', timestamp: request.date }
                                    ]).map((log: any, idx: number) => (
                                        <div key={idx} className="flex gap-4 relative pr-8">
                                            <div className="absolute right-0 w-6 h-6 rounded-lg flex items-center justify-center text-white shadow-sm z-10 bg-indigo-600">
                                                <CheckCircle size={14}/>
                                            </div>
                                            <div className="flex-1 bg-gray-50/80 p-3 rounded-2xl border border-gray-100">
                                                <div className="flex justify-between items-center mb-1">
                                                    <p className="text-[10px] font-black text-gray-800">{log.action}</p>
                                                    <span className="text-[8px] font-mono text-gray-400">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                                </div>
                                                <p className="text-[9px] text-indigo-600 font-bold">{log.performedBy} ({log.role})</p>
                                                {log.comment && <p className="text-[9px] text-gray-600 mt-1 bg-white p-2 rounded-xl border border-dashed border-gray-200 italic">{log.comment}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                             </div>

                             {request.image && (
                                <div className="rounded-3xl overflow-hidden border-2 border-gray-100 shadow-md group relative h-64">
                                     <img src={request.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="part" referrerPolicy="no-referrer" />
                                     <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                                         <p className="text-white text-[10px] font-bold opacity-80 line-clamp-2">{request.itemName}</p>
                                     </div>
                                </div>
                             )}
                        </div>
                    </div>

                    {/* Compact BPMN tracker placed at the bottom of the request info */}
                    <div className="pt-4 border-t border-gray-100">
                        <BpmnWorkflowDiagram currentStatus={request.status} location={request.location} />
                    </div>
                </div>

                {/* Actions Footer */}
                <div className="p-6 border-t glass-panel flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/80">
                    <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                        {/* Universal Return & Reject Buttons */}
                        {request.status !== PurchaseRequestStatus.COMPLETED && request.status !== PurchaseRequestStatus.REJECTED && (
                            <>
                                <button onClick={() => setShowReturnModal(true)} className="bg-amber-500/10 text-amber-700 border border-amber-300 hover:bg-amber-500 hover:text-white px-4 py-3 rounded-2xl font-black text-xs transition-all flex items-center gap-1.5 shadow-sm" disabled={actionLoading}>
                                    <CornerUpLeft size={16}/> عودت جهت اصلاح
                                </button>
                                <button onClick={() => setShowRejectModal(true)} className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white px-4 py-3 rounded-2xl font-black text-xs transition-all flex items-center gap-1.5 shadow-sm" disabled={actionLoading}>
                                    <XCircle size={16}/> رد / توقف فرآیند
                                </button>
                            </>
                        )}

                        {/* Stage 1: Technical & Repair Inspection */}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_TECHNICAL) && (isAdmin || hasPurchasePerm('canApproveTechnical')) && (
                            <button onClick={() => handleAction(PurchaseRequestStatus.PENDING_SHIFT_LEADER, {}, 'تایید فنی و ارجاع به سرشیفت')} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-indigo-100 transition-all hover:-translate-y-0.5 text-xs" disabled={actionLoading}>تایید فنی و ارسال به سرشیفت کارخانه</button>
                        )}

                        {/* Stage 1.5: Shift Leader Approval */}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_SHIFT_LEADER) && (isAdmin || hasPurchasePerm('canApproveShiftLeader')) && (
                            <button onClick={() => handleAction(PurchaseRequestStatus.PENDING_WAREHOUSE_KEEPER, {}, 'تایید سرشیفت و ارجاع به انباردار')} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg transition-all hover:scale-105 text-xs" disabled={actionLoading}>تایید سرشیفت و ارسال به انباردار کارخانه</button>
                        )}
                        
                        {/* Stage 2: Warehouse Stock Check */}
                        {(isCurrentStep(PurchaseRequestStatus.PENDING_FACTORY) || isCurrentStep(PurchaseRequestStatus.PENDING_WAREHOUSE_KEEPER)) && (isAdmin || hasPurchasePerm('canApproveWarehouseKeeper') || hasPurchasePerm('canApproveFactory')) && (
                            <button onClick={() => setShowWarehouseCheckModal(true)} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black transition-all hover:scale-105 text-xs shadow-lg" disabled={actionLoading}>بررسی موجودی انبار (انباردار کارخانه)</button>
                        )}

                        {/* Stage 3: Factory Manager Branch Selection */}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_COMMERCIAL_DECISION) && (isAdmin || hasPurchasePerm('canApproveFactoryDecision')) && (
                            <button onClick={() => setShowFactoryBranchModal(true)} className="bg-amber-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-amber-100 text-xs hover:scale-105 transition-all" disabled={actionLoading}>تعیین و تایید مسیر تامین (مدیر کارخانه)</button>
                        )}

                        {/* Tehran Branch: CEO Initial Approval */}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_CEO_INITIAL) && (isAdmin || hasPurchasePerm('canApproveCEO')) && (
                            <button onClick={() => handleAction(PurchaseRequestStatus.PENDING_TEHRAN_PROFORMA, {}, 'تایید اولیه و مجوز اخذ استعلام')} className="bg-sky-600 text-white px-8 py-3 rounded-2xl font-black text-xs shadow-lg" disabled={actionLoading}>تایید اولیه استعلام و اجازه ثبت پروفرما</button>
                        )}

                        {/* Tehran Branch: Proforma Entry */}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_TEHRAN_PROFORMA) && request.proformas.length > 0 && (isAdmin || hasPurchasePerm('canManageProformas')) && (
                            <button onClick={() => handleAction(PurchaseRequestStatus.PENDING_COMMERCIAL_MANAGER, {}, 'ارسال پروفرماها به مدیر بازرگانی')} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-xs" disabled={actionLoading}>ارسال لیست پیش‌فاکتورها به مدیر بازرگانی</button>
                        )}

                        {/* Tehran Branch: Commercial Manager Selection */}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_COMMERCIAL_MANAGER) && (isAdmin || hasPurchasePerm('canCommercialFinalize')) && (
                            <button onClick={() => handleAction(PurchaseRequestStatus.PENDING_CEO_SELECTION, {}, 'بررسی بازرگانی و ارسال به مدیرعامل')} className="bg-purple-600 text-white px-8 py-3 rounded-2xl font-black text-xs shadow-lg" disabled={actionLoading}>تایید مدیر بازرگانی و ارسال به مدیرعامل</button>
                        )}

                        {/* Zanjan Branch: Proposal & Purchasing */}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_ZANJAN_PURCHASING) && (isAdmin || hasPurchasePerm('canManageProformas')) && (
                            <button onClick={() => handleAction(PurchaseRequestStatus.PENDING_FACTORY_MANAGER_APPROVAL, {}, 'ارسال پیشنهاد خرید کارخانه به مدیر')} className="bg-teal-600 text-white px-8 py-3 rounded-2xl font-black text-xs shadow-lg" disabled={actionLoading}>ارسال پیشنهاد خرید به مدیر کارخانه</button>
                        )}

                        {/* Zanjan Branch: Factory Manager Approval */}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_FACTORY_MANAGER_APPROVAL) && (isAdmin || hasPurchasePerm('canApproveFactory')) && (
                            <button onClick={() => handleAction(PurchaseRequestStatus.PENDING_BUYER_EXECUTION, {}, 'دستور خرید و صدور سفارش کارخانه')} className="bg-teal-700 text-white px-8 py-3 rounded-2xl font-black text-xs shadow-lg" disabled={actionLoading}>دستور خرید و ارجاع به کارپرداز</button>
                        )}

                        {/* Zanjan Branch: Purchasing Agent Execution */}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_BUYER_EXECUTION) && (isAdmin || hasPurchasePerm('canManageProformas')) && (
                            <button onClick={() => setShowPurchasingAgentModal(true)} className="bg-teal-600 text-white px-8 py-3 rounded-2xl font-black text-xs shadow-lg hover:scale-105 transition-all">ثبت خرید کارپرداز و صدور فاکتور</button>
                        )}

                        {/* Common: Technical Specs Approval */}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_TECHNICAL_APPROVAL) && (isAdmin || hasPurchasePerm('canApproveTechnical')) && (
                            <button onClick={() => setShowTechnicalApprovalModal(true)} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-xs shadow-lg hover:scale-105 transition-all">تایید فنی و تطابق سفارش (QC/Net)</button>
                        )}

                        {/* Common: Factory Manager Entry Approval */}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_FACTORY_ENTRY_APPROVAL) && (isAdmin || hasPurchasePerm('canApproveFactory')) && (
                            <button onClick={() => handleAction(PurchaseRequestStatus.PENDING_SECURITY_ENTRY, {}, 'صدور مجوز ورود کالا به کارخانه')} className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black text-xs shadow-lg" disabled={actionLoading}>مجوز ورود کالا به کارخانه</button>
                        )}

                        {/* Security Entry */}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_SECURITY_ENTRY) && (isAdmin || hasPurchasePerm('canRegisterEntry')) && (
                            <button onClick={() => setShowSecurityModal(true)} className="bg-orange-600 text-white px-8 py-3 rounded-2xl font-black transition-all hover:scale-105 shadow-xl text-xs shadow-orange-100">ثبت ورود کالا (انتظامات)</button>
                        )}

                        {/* Quality Control (QC) */}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_QC) && (isAdmin || hasPurchasePerm('canCheckQC')) && (
                            <button onClick={() => setShowQCModal(true)} className="bg-green-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-green-100 transition-all hover:scale-105 text-xs">بررسی و تایید کنترل کیفی (QC)</button>
                        )}

                        {/* Factory Manager Final Approve */}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_FACTORY_FINAL_APPROVE) && (isAdmin || hasPurchasePerm('canApproveFactory')) && (
                            <button onClick={() => handleAction(PurchaseRequestStatus.PENDING_WAREHOUSE_RECEIPT, {}, 'تایید نهایی تحویل و ارسال به انبار')} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-xs" disabled={actionLoading}>تایید نهایی ورود کالا (مدیر کارخانه)</button>
                        )}

                        {/* Warehouse Receipt */}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_WAREHOUSE_RECEIPT) && (isAdmin || hasPurchasePerm('canWarehouseFinalize')) && (
                            <button onClick={() => setShowWarehouseModal(true)} className="bg-indigo-700 text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-indigo-200 hover:scale-105 transition-all text-xs">صدور رسید انبار نهایی</button>
                        )}

                        {/* Factory Manager Final Sign */}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_FACTORY_FINAL_SIGN) && (isAdmin || hasPurchasePerm('canApproveFactory')) && (
                            <button onClick={() => handleAction(PurchaseRequestStatus.COMPLETED, {}, 'امضای الکترونیکی و بایگانی پرونده')} className="bg-indigo-900 text-white px-8 py-3 rounded-2xl font-black shadow-2xl transition-all hover:bg-black text-xs">امضا، تکمیل و بایگانی نهایی پرونده</button>
                        )}

                        {isCurrentStep(PurchaseRequestStatus.REJECTED) && (
                            <span className="text-red-600 font-bold bg-red-50 px-4 py-2 rounded-xl border border-red-200 italic text-xs">این درخواست رد شده است</span>
                        )}
                        {isCurrentStep(PurchaseRequestStatus.DELIVERED_FROM_WAREHOUSE) && (
                            <span className="text-emerald-700 font-bold bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200 italic text-xs">کالا مستقیماً از موجودی انبار تحویل گردید</span>
                        )}
                    </div>

                    <div className="flex gap-4 border-r pr-4 border-gray-200">
                         <div className="relative group">
                            <button className="flex items-center gap-2 p-3 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors shadow-sm font-black text-xs">
                                <Printer size={16} /> چاپ اسناد
                            </button>
                            <div className="absolute bottom-full mb-2 left-0 w-48 bg-white rounded-2xl shadow-2xl border border-gray-200 p-2 hidden group-hover:block animate-in slide-in-from-bottom-2 fade-in">
                                <button onClick={() => { setPrintType('REQUEST'); setTimeout(() => window.print(), 300); }} className="w-full text-right p-2 hover:bg-gray-50 rounded-lg text-[10px] font-bold border-b mb-1">چاپ درخواست اولیه (A5)</button>
                                <button onClick={() => { setPrintType('BARCODE'); setTimeout(() => window.print(), 300); }} className="w-full text-right p-2 hover:bg-gray-50 rounded-lg text-[10px] font-bold border-b mb-1 text-indigo-700 font-black">چاپ برچسب بارکد (Barcode)</button>
                                {request.proformas.find(p => p.isChosen) && (
                                    <button onClick={() => { setPrintType('PROFORMA'); setTimeout(() => window.print(), 300); }} className="w-full text-right p-2 hover:bg-gray-50 rounded-lg text-[10px] font-bold border-b mb-1">چاپ پیش‌فاکتور منتخب (A5)</button>
                                )}
                                {request.warehouseReceiptNumber && (
                                    <button onClick={() => { setPrintType('RECEIPT'); setTimeout(() => window.print(), 300); }} className="w-full text-right p-2 hover:bg-gray-50 rounded-lg text-[10px] font-bold">چاپ رسید انبار نهایی (A5)</button>
                                )}
                            </div>
                         </div>
                    </div>
                </div>

                {/* Print Sections */}
                <div className="print-render-wrapper opacity-0 pointer-events-none absolute -z-50 overflow-hidden h-0 w-0" aria-hidden="true">
                    <div id="print-purchase-request-section">
                        {printType === 'REQUEST' && <PrintPurchaseRequest request={request} />}
                        {printType === 'BARCODE' && <PrintPurchaseBarcode request={request} />}
                        {printType === 'PROFORMA' && <PrintPurchaseProforma request={request} proforma={request.proformas.find(p => p.isChosen) || request.proformas[0]} />}
                        {printType === 'RECEIPT' && <PrintWarehouseReceipt request={request} />}
                    </div>
                    {/* Multi-print for custom proforma */}
                    {printingProforma && (
                        <div id="print-specific-proforma">
                            <PrintPurchaseProforma request={request} proforma={printingProforma} />
                        </div>
                    )}
                </div>

                {/* Submodals */}
                {showReturnModal && <ReturnModal 
                    currentStatus={request.status}
                    onClose={() => setShowReturnModal(false)}
                    onConfirm={(stage: PurchaseRequestStatus, reason: string) => {
                        handleAction(stage, { returnReason: reason }, 'عودت پرونده جهت اصلاح');
                        setShowReturnModal(false);
                    }}
                />}

                {showRejectModal && <RejectModal 
                    onClose={() => setShowRejectModal(false)}
                    onConfirm={(reason: string) => {
                        handleAction(PurchaseRequestStatus.REJECTED, { rejectionReason: reason }, 'رد و توقف کلی فرآیند');
                        setShowRejectModal(false);
                    }}
                />}

                {showWarehouseCheckModal && <WarehouseCheckModal 
                    onClose={() => setShowWarehouseCheckModal(false)}
                    onConfirm={(inStock: boolean, data: any) => {
                        if (inStock) {
                            handleAction(PurchaseRequestStatus.DELIVERED_FROM_WAREHOUSE, data, 'تحویل مستقیم از انبار');
                        } else {
                            handleAction(PurchaseRequestStatus.PENDING_COMMERCIAL_DECISION, data, 'عدم موجودی - ارسال به مدیر کارخانه جهت تصمیم مسیر');
                        }
                        setShowWarehouseCheckModal(false);
                    }}
                />}

                {showFactoryBranchModal && <FactoryBranchModal 
                    onClose={() => setShowFactoryBranchModal(false)}
                    onConfirm={(location: 'Tehran' | 'Factory', notes: string) => {
                        if (location === 'Tehran') {
                            handleAction(PurchaseRequestStatus.PENDING_CEO_INITIAL, { location: 'Tehran', factoryNotes: notes }, 'تعیین مسیر خرید از تهران');
                        } else {
                            handleAction(PurchaseRequestStatus.PENDING_ZANJAN_PURCHASING, { location: 'Factory', factoryNotes: notes }, 'تعیین مسیر خرید از کارخانه زنجان');
                        }
                        setShowFactoryBranchModal(false);
                    }}
                />}

                {showTechnicalApprovalModal && <TechnicalApprovalModal 
                    onClose={() => setShowTechnicalApprovalModal(false)}
                    onConfirm={(data: any) => {
                        handleAction(PurchaseRequestStatus.PENDING_FACTORY_ENTRY_APPROVAL, data, 'تایید فنی و تطابق کالا');
                        setShowTechnicalApprovalModal(false);
                    }}
                />}

                {showPurchasingAgentModal && <PurchasingAgentModal 
                    onClose={() => setShowPurchasingAgentModal(false)}
                    onConfirm={(data: any) => {
                        handleAction(PurchaseRequestStatus.PENDING_TECHNICAL_APPROVAL, data, 'ثبت فاکتور توسط کارپرداز');
                        setShowPurchasingAgentModal(false);
                    }}
                />}

                {showProformaModal && <ProfessionalProformaModal 
                    request={request} 
                    onClose={() => setShowProformaModal(false)}
                    onSuccess={(updatedProformas: any) => {
                        handleAction(request.status, { proformas: updatedProformas }, 'ثبت پیش‌فاکتور جدید');
                        setShowProformaModal(false);
                    }}
                    currentUser={currentUser}
                />}

                {showSecurityModal && <SecurityEntryModal 
                    onClose={() => setShowSecurityModal(false)}
                    onConfirm={(data: any) => handleAction(PurchaseRequestStatus.PENDING_WAREHOUSE_RECEIPT, data, 'ثبت ورود انتظامات')}
                />}
                
                {showQCModal && <QCApprovalModal 
                    onClose={() => setShowQCModal(false)}
                    onConfirm={(data: any) => handleAction(PurchaseRequestStatus.PENDING_FACTORY_FINAL_APPROVE, data, 'گزارش و تایید کیفی QC')}
                />}

                {showWarehouseModal && <WarehouseReceiptModal 
                   onClose={() => setShowWarehouseModal(false)}
                   onConfirm={(data: any) => handleAction(PurchaseRequestStatus.PENDING_FACTORY_FINAL_SIGN, data, 'صدور رسید انبار')}
                />}
            </div>
        </div>,
        document.body
    );
};

const ProfessionalProformaModal = ({ request, onClose, onSuccess, currentUser }: any) => {
    const [vendor, setVendor] = useState('');
    const [phone, setPhone] = useState('');
    const [num, setNum] = useState('');
    const [items, setItems] = useState([{ id: generateUUID(), description: request.itemName, quantity: request.quantity, unit: request.unit, unitPrice: 0, totalPrice: 0 }]);
    const [tax, setTax] = useState(0);
    const [discount, setDiscount] = useState(0);

    const updateItem = (id: string, field: string, val: any) => {
        setItems(items.map(it => {
            if (it.id === id) {
                const updated = { ...it, [field]: val };
                if (field === 'quantity' || field === 'unitPrice') {
                    updated.totalPrice = updated.quantity * updated.unitPrice;
                }
                return updated;
            }
            return it;
        }));
    };

    const addItem = () => setItems([...items, { id: generateUUID(), description: '', quantity: 1, unit: 'عدد', unitPrice: 0, totalPrice: 0 }]);
    const removeItem = (id: string) => setItems(items.filter(it => it.id !== id));

    const totalItems = items.reduce((sum, it) => sum + it.totalPrice, 0);
    const finalTotal = totalItems + tax - discount;

    const handleAdd = () => {
        const newP: PurchaseProforma = {
            id: generateUUID(),
            vendorName: vendor,
            vendorPhone: phone,
            number: num,
            date: new Date().toISOString().split('T')[0],
            items: items,
            totalAmount: finalTotal,
            taxAmount: tax,
            discountAmount: discount,
            attachments: [],
            registeredBy: currentUser.fullName
        };
        onSuccess([...request.proformas, newP]);
    };

    return createPortal(
        <div className="fixed inset-0 z-[100000008] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 bg-black/60 backdrop-blur-sm shadow-2xl">
            <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
                <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-black text-xl text-gray-800">ثبت پیش‌فاکتور حرفه‌ای</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full"><XCircle/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className="text-xs font-bold text-gray-500 block mb-1">نام فروشنده/تامین کننده</label><input className="w-full border rounded-xl p-3 text-sm" value={vendor} onChange={e=>setVendor(e.target.value)} /></div>
                        <div><label className="text-xs font-bold text-gray-500 block mb-1">تلفن تماس</label><input className="w-full border rounded-xl p-3 text-sm" value={phone} onChange={e=>setPhone(e.target.value)} /></div>
                        <div><label className="text-xs font-bold text-gray-500 block mb-1">شماره پیش‌فاکتور</label><input className="w-full border rounded-xl p-3 text-sm" value={num} onChange={e=>setNum(e.target.value)} /></div>
                    </div>

                    <div className="border rounded-2xl overflow-hidden">
                        <table className="w-full text-xs">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="p-3 text-right">شرح کالا/خدمات</th>
                                    <th className="p-3 w-20">تعداد</th>
                                    <th className="p-3 w-24">واحد</th>
                                    <th className="p-3 w-32">فی (ریال)</th>
                                    <th className="p-3 w-32">جمع کل</th>
                                    <th className="p-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {items.map(it => (
                                    <tr key={it.id}>
                                        <td className="p-2"><input className="w-full p-2 bg-transparent" value={it.description} onChange={e=>updateItem(it.id, 'description', e.target.value)} /></td>
                                        <td className="p-2"><input type="number" className="w-full p-2 bg-transparent text-center font-bold" value={it.quantity} onChange={e=>updateItem(it.id, 'quantity', +e.target.value)} /></td>
                                        <td className="p-2"><input className="w-full p-2 bg-transparent text-center" value={it.unit} onChange={e=>updateItem(it.id, 'unit', e.target.value)} /></td>
                                        <td className="p-2"><input type="number" className="w-full p-2 bg-transparent text-center font-bold text-indigo-600" value={it.unitPrice} onChange={e=>updateItem(it.id, 'unitPrice', +e.target.value)} /></td>
                                        <td className="p-2 text-center font-black">{formatCurrency(it.totalPrice)}</td>
                                        <td className="p-2"><button onClick={()=>removeItem(it.id)} className="text-red-500"><Trash2 size={16}/></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button onClick={addItem} className="w-full py-3 bg-gray-50 text-indigo-600 font-bold hover:bg-indigo-50 border-t border-dashed">+ افزودن ردیف جدید</button>
                    </div>

                    <div className="flex flex-col items-end gap-3 pt-4 border-t">
                        <div className="flex items-center gap-4">
                            <span className="text-xs font-bold text-gray-500">جمع ردیف‌ها:</span>
                            <span className="text-sm font-black">{formatCurrency(totalItems)} ریال</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-xs font-bold text-gray-500">مالیات / عوارض:</span>
                            <input type="number" className="w-32 border rounded-lg p-2 text-xs font-bold" value={tax} onChange={e=>setTax(+e.target.value)} />
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-xs font-bold text-red-400">تخفیف:</span>
                            <input type="number" className="w-32 border rounded-lg p-2 text-xs font-bold text-red-500" value={discount} onChange={e=>setDiscount(+e.target.value)} />
                        </div>
                        <div className="flex items-center gap-4 bg-indigo-50 px-6 py-4 rounded-2xl border border-indigo-200">
                            <span className="text-sm font-black text-indigo-900">مبلغ نهایی قابل پرداخت:</span>
                            <span className="text-xl font-black text-indigo-700">{formatCurrency(finalTotal)} ریال</span>
                        </div>
                    </div>
                </div>
                <div className="p-6 bg-gray-50 flex gap-3">
                    <button onClick={handleAdd} className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-100 active:scale-95 transition-all">تایید و ثبت نهایی پیش‌فاکتور</button>
                    <button onClick={onClose} className="px-8 bg-white border border-gray-300 text-gray-600 font-bold rounded-2xl hover:bg-gray-100 transition-all">انصراف</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

const QCApprovalModal = ({ onClose, onConfirm }: any) => {
    const [result, setResult] = useState<'تایید' | 'مشروط' | 'رد'>('تایید');
    const [desc, setDesc] = useState('');

    return createPortal(
        <div className="fixed inset-0 z-[100000008] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-scale-in text-right">
                <h3 className="font-black text-xl mb-6 text-gray-800 flex items-center gap-2"><ShieldCheck className="text-green-600"/> بررسی کیفی (QC)</h3>
                <div className="space-y-6">
                    <div className="flex p-1 bg-gray-100 rounded-2xl">
                        {(['تایید', 'مشروط', 'رد'] as any[]).map(r => (
                            <button key={r} onClick={()=>setResult(r)} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${result === r ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-gray-400'}`}>{r}</button>
                        ))}
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-2">ملاحظات و گزارش کیفی</label>
                        <textarea className="w-full border rounded-xl p-4 text-sm h-32 focus:ring-2 focus:ring-indigo-100 outline-none" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="شرح وضعیت ظاهری، فنی و تطابق با استانداردهای کارخانه..."/>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button onClick={() => onConfirm({ qcResult: result, qcDescription: desc })} className="flex-1 bg-green-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all">تایید گزارش QC</button>
                        <button onClick={onClose} className="px-6 bg-white border border-gray-300 text-gray-500 font-bold rounded-2xl">انصراف</button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const WarehouseReceiptModal = ({ onClose, onConfirm }: any) => {
    const shamsi = getCurrentShamsiDate();
    const [num, setNum] = useState(() => {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        return `RI-${shamsi.year}/${randomNum}`;
    });
    const [date, setDate] = useState(`${shamsi.year}/${shamsi.month}/${shamsi.day}`);

    return createPortal(
        <div className="fixed inset-0 z-[100000008] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 bg-black/50 backdrop-blur-sm text-right dir-rtl">
            <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-scale-in">
                <h3 className="font-black text-xl mb-6 text-gray-800 flex items-center gap-2"><Warehouse className="text-indigo-600"/> صدور رسید انبار</h3>
                <div className="space-y-6">
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-2">شماره رسید انبار (تولید خودکار)</label>
                        <input className="w-full border rounded-xl p-4 text-sm font-mono font-black bg-gray-100 cursor-not-allowed text-gray-500" value={num} readOnly />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-2">تاریخ رسید</label>
                        <input className="w-full border rounded-xl p-4 text-sm font-black text-center" value={date} onChange={e=>setDate(e.target.value)} />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button onClick={() => onConfirm({ warehouseReceiptNumber: num, warehouseReceiptDate: date })} className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all text-xs">صدور و تایید نهایی رسید</button>
                        <button onClick={onClose} className="px-6 bg-white border border-gray-300 text-gray-500 font-bold rounded-2xl text-xs">انصراف</button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const SecurityEntryModal = ({ onClose, onConfirm }: any) => {
    const [qty, setQty] = useState(0);
    const [weight, setWeight] = useState(0);

    return createPortal(
        <div className="fixed inset-0 z-[100000008] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 bg-black/50 shadow-2xl">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                <h3 className="font-black text-lg mb-4">ثبت ورود کالا (انتظامات)</h3>
                <div className="space-y-4">
                    <div><label className="text-xs font-bold text-gray-500 mb-1">تعداد واقعی ورود</label><input type="number" className="w-full border rounded-xl p-3" value={qty} onChange={e=>setQty(+e.target.value)} /></div>
                    <div><label className="text-xs font-bold text-gray-500 mb-1">وزن واقعی ورود</label><input type="number" className="w-full border rounded-xl p-3" value={weight} onChange={e=>setWeight(+e.target.value)} /></div>
                    <button onClick={() => onConfirm({ entryQuantity: qty, entryWeight: weight, entryTime: new Date().toLocaleTimeString('fa-IR') })} className="w-full bg-orange-600 text-white font-black py-3 rounded-xl shadow-lg">تایید و ثبت ورود</button>
                    <button onClick={onClose} className="w-full text-gray-500 font-bold border rounded-xl py-2 mt-2">انصراف</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- PARTS TAB ---
const PartsTab = ({ parts, currentUser, onPartUpdate, settings }: any) => {
    const perms = React.useMemo(() => {
        return getRolePermissions(currentUser.role, settings || null, currentUser);
    }, [currentUser, settings]);

    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showDataSheet, setShowDataSheet] = useState<PartMasterData | null>(null);
    const [editingPart, setEditingPart] = useState<PartMasterData | null>(null);

    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);

    const hasPurchasePerm = (perm: string) => {
        if (currentUser.role === UserRole.ADMIN) return true;
        const rolePerms = settings?.purchaseRolePermissions?.[currentUser.role] || {};
        return !!(rolePerms as any)[perm];
    };

    const filtered = parts.filter((p: PartMasterData) => 
        p.name.includes(searchTerm) || 
        p.category.includes(searchTerm) || 
        (p.subCategory && p.subCategory.includes(searchTerm)) ||
        (p.dimensions && p.dimensions.includes(searchTerm))
    );

    const categories = Array.from(new Set(parts.map((p: PartMasterData) => p.category)));
    const subCategories = selectedCategory ? Array.from(new Set(parts.filter((p: PartMasterData) => p.category === selectedCategory && p.subCategory).map((p: PartMasterData) => p.subCategory))) : [];

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);
                
                let successCount = 0;
                for (const row of data as any[]) {
                    if (!row['نام کالا']) continue;
                    const newPart: PartMasterData = {
                        id: generateUUID(),
                        name: row['نام کالا'] || '',
                        type: row['نوع'] || 'قطعات',
                        category: row['گروه'] || 'عمومی',
                        subCategory: row['زیرگروه'] || '',
                        dimensions: row['ابعاد یا مشخصات'] || '',
                        unit: row['واحد'] || 'عدد',
                        minStock: parseInt(row['حداقل موجودی']) || 0,
                        currentStock: parseInt(row['موجودی اولیه']) || 0
                    };
                    await savePartMasterData(newPart);
                    successCount++;
                }
                alert(`${successCount} کالا با موفقیت از اکسل وارد شد.`);
                onPartUpdate();
            } catch (err) {
                alert('خطا در خواندن فایل اکسل');
                console.error(err);
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-2 items-center">
                <div className="relative flex-1 w-full">
                    <input className="w-full glass-panel border border-gray-200 rounded-xl p-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-indigo-100" placeholder="جستجوی کالا، گروه یا زیرگروه..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setSelectedCategory(null); setSelectedSubCategory(null); }} />
                    <Search className="absolute right-3 top-3.5 text-gray-400" size={18}/>
                </div>
                {hasPurchasePerm('canManageWarehouse') && (
                    <div className="flex gap-2 w-full md:w-auto">
                        <label className="bg-green-600 text-white p-3 rounded-xl shadow-lg shadow-green-100 flex justify-center items-center gap-2 font-bold text-sm cursor-pointer hover:bg-green-700 transition">
                            <UploadCloud size={20}/> اکسل
                            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                        </label>
                        <button onClick={() => { setEditingPart(null); setShowModal(true); }} className="flex-1 md:flex-none justify-center bg-indigo-600 text-white p-3 rounded-xl shadow-lg shadow-indigo-100 flex items-center gap-2 font-bold text-sm transition hover:bg-indigo-700">
                            <Plus size={20}/> تعریف جدید
                        </button>
                    </div>
                )}            </div>

            {!searchTerm && selectedCategory && (
                 <div className="flex items-center gap-2 text-sm font-bold text-gray-600 bg-gray-100 p-3 rounded-xl shadow-inner">
                    <button onClick={() => { setSelectedCategory(null); setSelectedSubCategory(null); }} className="hover:text-indigo-600">گروه‌ها</button>
                    <span>/</span>
                    <button onClick={() => setSelectedSubCategory(null)} className={`hover:text-indigo-600 ${!selectedSubCategory ? 'text-indigo-600' : ''}`}>{selectedCategory}</button>
                    {selectedSubCategory && (
                        <>
                            <span>/</span>
                            <span className="text-indigo-600">{selectedSubCategory}</span>
                        </>
                    )}
                 </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {searchTerm ? (
                    filtered.map((p: PartMasterData) => (
                        <div key={p.id} className="glass-panel border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group">
                            <div className="h-40 bg-gray-100 relative overflow-hidden cursor-pointer" onClick={() => setShowDataSheet(p)}>
                                {p.image ? (
                                    <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={p.name} referrerPolicy="no-referrer" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                                        <ImageIcon size={48} />
                                        <span className="text-[10px] font-bold uppercase mt-2">No Image</span>
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] px-2 py-0.5 rounded-full backdrop-blur-sm">{p.type || 'کالا'} | {p.category}</div>
                            </div>
                            <div className="p-4">
                                <h3 className="font-black text-gray-800 text-sm mb-1">{p.name}</h3>
                                <p className="text-[10px] text-gray-500 line-clamp-1 mb-3">{p.subCategory ? `زیرگروه: ${p.subCategory}` : 'فاقد زیرگروه'} | {p.dimensions || 'فاقد مشخصات ابعادی'}</p>
                                
                                <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Stock Balance</span>
                                        <span className={`text-sm font-black ${p.currentStock <= (p.minStock || 0) ? 'text-red-500 animate-pulse' : 'text-green-600'}`}>
                                            {p.currentStock} {p.unit}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => setShowDataSheet(p)} className="p-2 bg-gray-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="مشاهده شناسنامه فنی"><Info size={16}/></button>
                                        {p.pdfAttachment && (
                                            <a href={p.pdfAttachment} target="_blank" rel="noopener noreferrer" className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="مشاهده کاتالوگ/PDF"><FileText size={16}/></a>
                                        )}
                                        <button onClick={() => { setEditingPart(p); setShowModal(true); }} className="p-2 bg-gray-50 text-emerald-600 rounded-lg hover:bg-emerald-100" title="ویرایش کالا"><Edit size={16}/></button>
                                        <button onClick={async () => { if(confirm('حذف شود؟')) { await deletePartMasterData(p.id); onPartUpdate(); } }} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100" title="حذف کالا"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : !selectedCategory ? (
                     categories.map((cat: any) => (
                         <div key={cat} onClick={() => setSelectedCategory(cat)} className="glass-panel border-2 border-indigo-100 rounded-3xl p-8 text-center cursor-pointer hover:shadow-xl hover:-translate-y-1 hover:border-indigo-300 transition-all flex flex-col items-center gap-4 bg-gradient-to-b from-white to-indigo-50/30">
                              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                                  <Layers size={32} />
                              </div>
                              <div>
                                  <h3 className="text-xl font-black text-gray-800 mb-1">{cat}</h3>
                                  <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">{parts.filter((p: any) => p.category === cat).length} کالا</span>
                              </div>
                         </div>
                     ))
                ) : selectedCategory && !selectedSubCategory && subCategories.length > 0 ? (
                     subCategories.map((sub: any) => (
                         <div key={sub} onClick={() => setSelectedSubCategory(sub)} className="glass-panel border-2 border-teal-100 rounded-3xl p-8 text-center cursor-pointer hover:shadow-xl hover:-translate-y-1 hover:border-teal-300 transition-all flex flex-col items-center gap-4 bg-gradient-to-b from-white to-teal-50/30">
                              <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center text-teal-600 shadow-inner">
                                  <Tag size={32} />
                              </div>
                              <div>
                                  <h3 className="text-xl font-black text-gray-800 mb-1">{sub}</h3>
                                  <span className="text-xs font-bold text-teal-500 bg-teal-50 px-3 py-1 rounded-full">{parts.filter((p: any) => p.category === selectedCategory && p.subCategory === sub).length} کالا</span>
                              </div>
                         </div>
                     )).concat(
                         // Parts that don't have subcategory
                         parts.filter((p: any) => p.category === selectedCategory && !p.subCategory).map((p: any) => (
                             <div key={p.id} className="glass-panel border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group">
                                <div className="h-40 bg-gray-100 relative overflow-hidden cursor-pointer" onClick={() => setShowDataSheet(p)}>
                                    {p.image ? (
                                        <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={p.name} referrerPolicy="no-referrer" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                                            <ImageIcon size={48} />
                                            <span className="text-[10px] font-bold uppercase mt-2">No Image</span>
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] px-2 py-0.5 rounded-full backdrop-blur-sm">{p.type || 'کالا'} | {p.category}</div>
                                </div>
                                <div className="p-4">
                                    <h3 className="font-black text-gray-800 text-sm mb-1">{p.name}</h3>
                                    <p className="text-[10px] text-gray-500 line-clamp-1 mb-3">{p.subCategory ? `زیرگروه: ${p.subCategory}` : 'فاقد زیرگروه'} | {p.dimensions || 'فاقد مشخصات ابعادی'}</p>
                                    
                                    <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Stock Balance</span>
                                            <span className={`text-sm font-black ${p.currentStock <= (p.minStock || 0) ? 'text-red-500 animate-pulse' : 'text-green-600'}`}>
                                                {p.currentStock} {p.unit}
                                            </span>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => setShowDataSheet(p)} className="p-2 bg-gray-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="مشاهده شناسنامه فنی"><Info size={16}/></button>
                                            {p.pdfAttachment && (
                                                <a href={p.pdfAttachment} target="_blank" rel="noopener noreferrer" className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="مشاهده کاتالوگ/PDF"><FileText size={16}/></a>
                                            )}
                                            {hasPurchasePerm('canManageWarehouse') && (
                                                <>
                                                    <button onClick={() => { setEditingPart(p); setShowModal(true); }} className="p-2 bg-gray-50 text-emerald-600 rounded-lg hover:bg-emerald-100" title="ویرایش کالا"><Edit size={16}/></button>
                                                    <button onClick={async () => { if(confirm('حذف شود؟')) { await deletePartMasterData(p.id); onPartUpdate(); } }} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100" title="حذف کالا"><Trash2 size={16}/></button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                         ))
                     )
                ) : (
                     parts.filter((p: any) => p.category === selectedCategory && (!selectedSubCategory || p.subCategory === selectedSubCategory)).map((p: any) => (
                        <div key={p.id} className="glass-panel border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group">
                            <div className="h-40 bg-gray-100 relative overflow-hidden cursor-pointer" onClick={() => setShowDataSheet(p)}>
                                {p.image ? (
                                    <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={p.name} referrerPolicy="no-referrer" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                                        <ImageIcon size={48} />
                                        <span className="text-[10px] font-bold uppercase mt-2">No Image</span>
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] px-2 py-0.5 rounded-full backdrop-blur-sm">{p.type || 'کالا'} | {p.category}</div>
                            </div>
                            <div className="p-4">
                                <h3 className="font-black text-gray-800 text-sm mb-1">{p.name}</h3>
                                <p className="text-[10px] text-gray-500 line-clamp-1 mb-3">{p.subCategory ? `زیرگروه: ${p.subCategory}` : 'فاقد زیرگروه'} | {p.dimensions || 'فاقد مشخصات ابعادی'}</p>
                                
                                <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Stock Balance</span>
                                        <span className={`text-sm font-black ${p.currentStock <= (p.minStock || 0) ? 'text-red-500 animate-pulse' : 'text-green-600'}`}>
                                            {p.currentStock} {p.unit}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => setShowDataSheet(p)} className="p-2 bg-gray-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="مشاهده شناسنامه فنی"><Info size={16}/></button>
                                        {p.pdfAttachment && (
                                            <a href={p.pdfAttachment} target="_blank" rel="noopener noreferrer" className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="مشاهده کاتالوگ/PDF"><FileText size={16}/></a>
                                        )}
                                        {hasPurchasePerm('canManageWarehouse') && (
                                            <>
                                                <button onClick={() => { setEditingPart(p); setShowModal(true); }} className="p-2 bg-gray-50 text-emerald-600 rounded-lg hover:bg-emerald-100" title="ویرایش کالا"><Edit size={16}/></button>
                                                <button onClick={async () => { if(confirm('حذف شود؟')) { await deletePartMasterData(p.id); onPartUpdate(); } }} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100" title="حذف کالا"><Trash2 size={16}/></button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                     ))
                )}
            </div>

            {showModal && <PartModal onClose={() => setShowModal(false)} onSuccess={onPartUpdate} initialData={editingPart} parts={parts} />}
            {showDataSheet && <DataSheetModal part={showDataSheet} onClose={() => setShowDataSheet(null)} />}
        </div>
    );
};

const DataSheetModal = ({ part, onClose }: { part: PartMasterData, onClose: () => void }) => {
    return createPortal(
        <div className="fixed inset-0 z-[100000008] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 bg-black/70 backdrop-blur-md">
            <div className="bg-white rounded-[2.5rem] w-full max-w-4xl overflow-hidden shadow-2xl border border-white/20 animate-in fade-in zoom-in h-[90vh] flex flex-col">
                <div className="p-6 border-b flex justify-between items-center bg-gray-900 text-white">
                    <div className="flex items-center gap-3">
                        <Info size={28} className="text-yellow-400" />
                        <div>
                            <h2 className="text-xl font-black">شناسنامه کالا (Data Sheet)</h2>
                            <p className="text-[10px] opacity-80 font-mono tracking-widest">{part.id}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors"><XCircle size={24} /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-8">
                    <div id="datasheet-print-area" className="bg-white p-4 md:p-12 shadow-sm rounded-2xl mx-auto max-w-3xl border border-gray-200 printable-datasheet">
                         <PrintPartDataSheet part={part} />
                    </div>
                </div>

                <div className="p-6 border-t flex justify-end gap-3 bg-white">
                    <button onClick={onClose} className="px-6 py-3 border-2 border-gray-200 rounded-2xl font-bold text-gray-500">بستن</button>
                    <button onClick={() => window.print()} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black flex items-center gap-2 shadow-lg shadow-indigo-100">
                        <Printer size={20}/> چاپ شناسنامه
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

const PartModal = ({ onClose, onSuccess, initialData, parts }: any) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Partial<PartMasterData>>(initialData || {
        name: '',
        type: 'قطعات',
        category: '',
        subCategory: '',
        dimensions: '',
        unit: 'عدد',
        minStock: 0,
        currentStock: 0,
        image: '',
        pdfAttachment: ''
    });

    const categories = Array.from(new Set(parts.map((p: any) => p.category).filter(Boolean)));
    const subCategories = Array.from(new Set(parts.filter((p: any) => p.category === formData.category).map((p: any) => p.subCategory).filter(Boolean)));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!formData.name || !formData.category) return alert('نام و گروه‌بندی الزامی است');
        setLoading(true);
        try {
            if (initialData?.id) await updatePartMasterData({ ...initialData, ...formData } as PartMasterData);
            else await savePartMasterData({ ...formData, id: generateUUID() } as PartMasterData);
            onSuccess();
            onClose();
        } catch (e) { 
            console.error('Save Part error', e); 
            alert('خطا در ذخیره: ' + (e as any).message); 
        }
        finally { setLoading(false); }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            uploadFileChunked(file, () => {}).then(res => setFormData({ ...formData, image: res.url }));
        }
    };

    const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            uploadFileChunked(file, () => {}).then(res => setFormData({ ...formData, pdfAttachment: res.url }));
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100000008] flex items-start justify-center p-4 bg-black/60 backdrop-blur-sm pt-16 md:pt-20 overflow-y-auto">
            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 animate-scale-in max-h-[92vh] overflow-y-auto no-scrollbar mb-10 relative">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><Layers className="text-indigo-600"/> {initialData ? 'ویرایش کالا / قطعه' : 'معرفی کالا جدید'}</h2>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><XCircle size={28} className="text-gray-400"/></button>
                </div>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">اطلاعات پایه</label>
                            <div className="space-y-3">
                                <div className="relative"><input className="w-full border-2 border-gray-100 rounded-2xl p-3 pr-10 text-sm focus:border-indigo-400 outline-none" placeholder="نام دقیق کالا..." value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} /><Tag className="absolute right-3 top-3.5 text-gray-300" size={18}/></div>
                                
                                <div className="relative">
                                    <select className="w-full border-2 border-gray-100 rounded-2xl p-3 pr-10 text-sm focus:border-indigo-400 outline-none appearance-none" value={formData.type} onChange={e=>setFormData({...formData, type: e.target.value})}>
                                        <option value="قطعات">قطعات</option>
                                        <option value="مواد اولیه">مواد اولیه</option>
                                        <option value="ملزومات">ملزومات</option>
                                    </select>
                                    <Package className="absolute right-3 top-3.5 text-gray-300" size={18}/>
                                </div>

                                <div className="relative"><input className="w-full border-2 border-gray-100 rounded-2xl p-3 pr-10 text-sm focus:border-indigo-400 outline-none" placeholder="گروه (برقی، روانکار، و ...)" value={formData.category} onChange={e=>setFormData({...formData, category: e.target.value})} list="category-list" /><Layers className="absolute right-3 top-3.5 text-gray-300" size={18}/></div>
                                <datalist id="category-list">{categories.map((c: any) => <option key={c} value={c} />)}</datalist>

                                <div className="relative"><input className="w-full border-2 border-gray-100 rounded-2xl p-3 pr-10 text-sm focus:border-indigo-400 outline-none" placeholder="زیر مجموعه..." value={formData.subCategory} onChange={e=>setFormData({...formData, subCategory: e.target.value})} list="subcategory-list" /><Layers className="absolute right-3 top-3.5 text-gray-300" size={14}/></div>
                                <datalist id="subcategory-list">{subCategories.map((c: any) => <option key={c} value={c} />)}</datalist>

                                <div className="relative"><input className="w-full border-2 border-gray-100 rounded-2xl p-3 pr-10 text-sm focus:border-indigo-400 outline-none" placeholder="ابعاد و مشخصات ابعادی..." value={formData.dimensions} onChange={e=>setFormData({...formData, dimensions: e.target.value})} /><Ruler className="absolute right-3 top-3.5 text-gray-300" size={18}/></div>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">موجودی و تصویر</label>
                            <div className="space-y-3">
                                <div className="flex gap-4">
                                    <div className="flex-1"><label className="text-[10px] font-bold text-gray-400 mb-1 block">واحد</label><input className="w-full border-2 border-gray-100 rounded-2xl p-3 text-sm" value={formData.unit} onChange={e=>setFormData({...formData, unit: e.target.value})} /></div>
                                    <div className="flex-1"><label className="text-[10px] font-bold text-gray-400 mb-1 block">حداقل موجودی</label><input type="number" className="w-full border-2 border-gray-100 rounded-2xl p-3 text-sm font-bold text-red-500" value={formData.minStock} onChange={e=>setFormData({...formData, minStock: +e.target.value})} /></div>
                                </div>
                                <div className="relative group h-32 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:bg-gray-100 transition-all">
                                    {formData.image ? (
                                        <img src={formData.image} className="w-full h-full object-cover" alt="preview" />
                                    ) : (
                                        <>
                                            <Upload className="text-gray-300 group-hover:text-indigo-400 transition-colors" size={32}/>
                                            <p className="text-[10px] font-black text-gray-400 mt-2">کلیک جهت بارگذاری تصویر</p>
                                        </>
                                    )}
                                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImageUpload} />
                                </div>

                                <div className="relative group p-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex items-center gap-3 cursor-pointer hover:bg-gray-100 transition-all">
                                    <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
                                        <FileUp size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-gray-700">{formData.pdfAttachment ? 'فایل ضمیمه بارگذاری شد' : 'بارگذاری کاتالوگ / PDF'}</p>
                                        <p className="text-[10px] text-gray-400">{formData.pdfAttachment ? 'جهت جایگزینی کلیک کنید' : 'فقط فایل‌های PDF مجاز است'}</p>
                                    </div>
                                    {formData.pdfAttachment && <CheckCircle size={16} className="text-green-500"/>}
                                    <input type="file" accept="application/pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handlePdfUpload} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="md:col-span-2 pt-4">
                        <button disabled={loading} className="w-full bg-gradient-to-r from-indigo-600 to-indigo-800 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-70">
                            {loading ? <Loader2 className="animate-spin"/> : <ClipboardCheck size={20}/>} {initialData ? 'ثبت تغییرات' : 'معرفی نهایی کالا'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

// Barcode Generator Component (SVG-based Code 128 / stripes)
const BarcodeVisual = ({ value }: { value: string }) => {
    const s = value || 'PART-9999';
    const lines: boolean[] = [];
    
    // Deterministic visual stripes generation based on characters ASCII
    for (let i = 0; i < s.length; i++) {
        const code = s.charCodeAt(i);
        for (let j = 0; j < 8; j++) {
            lines.push(((code >> j) & 1) === 1);
        }
    }
    
    return (
        <div className="flex flex-col items-center bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-stretch h-10 bg-white px-1 gap-[1px]">
                {lines.slice(0, 50).map((isBlack, idx) => (
                    <div 
                        key={idx} 
                        className={`w-[2px] h-full ${isBlack ? 'bg-black' : 'bg-gray-100'}`} 
                    />
                ))}
            </div>
            <span className="text-[10px] font-mono tracking-widest text-gray-400 font-bold mt-1.5 uppercase select-all">{s.slice(0, 16).toUpperCase()}</span>
        </div>
    );
};

// --- KARDEX TAB ---
const KardexTab = ({ parts, selectedPart, setSelectedPart, kardexEntries, loadKardex, onPartUpdate }: any) => {
    const getShamsiString = (shamsi: any = getCurrentShamsiDate()) => {
        if (!shamsi) return '';
        return `${shamsi.year}/${String(shamsi.month).padStart(2, '0')}/${String(shamsi.day).padStart(2, '0')}`;
    };

    // Manual Transaction Form State
    const [showManualModal, setShowManualModal] = useState(false);
    const [manualType, setManualType] = useState<'IN' | 'OUT'>('IN');
    const [manualPartId, setManualPartId] = useState('');
    const [manualQty, setManualQty] = useState<number>(1);
    const [manualPrice, setManualPrice] = useState<number>(0);
    const [manualRef, setManualRef] = useState('');
    const [manualDesc, setManualDesc] = useState('');
    const [manualDate, setManualDate] = useState(getShamsiString());
    const [actionLoading, setActionLoading] = useState(false);

    // Stocktaking (انبارگردانی) State
    const [isStocktaking, setIsStocktaking] = useState(false);
    const [stocktakeItems, setStocktakeItems] = useState<any[]>([]);
    const [stocktakeDate, setStocktakeDate] = useState(getShamsiString());
    const [stocktakeDesc, setStocktakeDesc] = useState('انبارگردانی میان‌دوره');
    const [scanBuffer, setScanBuffer] = useState('');
    const [filterDiscrepancy, setFilterDiscrepancy] = useState(false);

    // Global barcode listener/quick action state
    const [generalScanInput, setGeneralScanInput] = useState('');
    const [scanMessage, setScanMessage] = useState('');

    useEffect(() => {
        if (selectedPart?.id) {
            setManualPartId(selectedPart.id);
        }
    }, [selectedPart]);

    // Handle Manual IN / OUT Submission
    const handleManualTransactionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualPartId) return alert('لطفاً قطعه را انتخاب کنید.');
        if (manualQty <= 0) return alert('تعداد وارد شده باید بزرگتر از صفر باشد.');

        setActionLoading(true);
        try {
            const response = await fetch('/api/part-kardex/transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    partId: manualPartId,
                    type: manualType,
                    quantity: manualQty,
                    referenceNumber: manualRef || (manualType === 'IN' ? 'MANUAL-IN' : 'MANUAL-OUT'),
                    unitPrice: manualPrice,
                    description: manualDesc,
                    date: manualDate
                })
            });

            if (!response.ok) throw new Error('Failed to register transaction');
            const resData = await response.json();
            
            alert('تراکنش با موفقیت ثبت و کاردکس قطعه بروزرسانی شد.');
            setShowManualModal(false);
            setManualQty(1);
            setManualPrice(0);
            setManualRef('');
            setManualDesc('');
            
            // Reload master parts and select part again
            if (onPartUpdate) await onPartUpdate();
            
            const reselected = parts.find((p: any) => p.id === manualPartId);
            if (reselected) {
                setSelectedPart(reselected);
                loadKardex(manualPartId);
            }
        } catch (err) {
            alert('خطا در ثبت تراکنش');
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    // Excel Export for Single Kardex
    const exportKardexToExcel = () => {
        if (!selectedPart) return;
        try {
            const excelData = kardexEntries.map((k: any) => ({
                'کالا': selectedPart.name,
                'تاریخ': k.date,
                'مرجع': k.referenceNumber,
                'نوع تراکنش': k.type === 'IN' ? 'ورود' : 'خروج',
                'مقدار': k.quantity,
                'موجودی مانده': k.balance,
                'قیمت واحد': k.unitPrice || 0,
                'توضیحات': k.description
            }));

            const ws = XLSX.utils.json_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'کاردکس');
            XLSX.writeFile(wb, `Kardex_${selectedPart.name.replace(/\s+/g, '_')}.xlsx`);
        } catch (e) {
            alert('خطا در خروجی اکسل');
        }
    };

    // Excel Export for All Parts Inventory List
    const exportInventoryToExcel = () => {
        try {
            const excelData = parts.map((p: any) => ({
                'شناسه قطعه': p.id,
                'کد کالا': p.code || p.id.slice(0, 8),
                'نام کالا': p.name,
                'نوع': p.type || 'قطعات',
                'گروه': p.category,
                'زیرگروه': p.subCategory || '-',
                'ابعاد / مشخصات': p.dimensions || '-',
                'واحد سنجش': p.unit || 'عدد',
                'موجودی فعلی': p.currentStock || 0,
                'حداقل موجودی': p.minStock || 0,
                'وضعیت سفارش‌دهی': (p.currentStock || 0) <= (p.minStock || 0) ? 'نیاز به خرید فوری' : 'نرمال'
            }));

            const ws = XLSX.utils.json_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'موجودی انبار قطعات');
            XLSX.writeFile(wb, `Inventory_Report_${getShamsiString().replace(/\//g, '-')}.xlsx`);
        } catch (e) {
            alert('خطا در خروجی اکسل کل قطعات');
        }
    };

    // Hardware Scanner simulation input search
    const handleBarcodeSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const code = generalScanInput.trim();
        if (!code) return;

        // Try matching part by exact ID or short ID or code or barcode
        const found = parts.find((p: any) => 
            p.id.toLowerCase() === code.toLowerCase() || 
            p.id.split('_')[1]?.toLowerCase() === code.toLowerCase() ||
            p.code?.toLowerCase() === code.toLowerCase() ||
            p.name.toLowerCase().includes(code.toLowerCase())
        );

        if (found) {
            setSelectedPart(found);
            loadKardex(found.id);
            setScanMessage(`قطعه پیدا شد: ${found.name}`);
            setTimeout(() => setScanMessage(''), 4000);
        } else {
            setScanMessage('❌ قطعه‌ای با این کد یا بارکد یافت نشد.');
            setTimeout(() => setScanMessage(''), 4000);
        }
        setGeneralScanInput('');
    };

    // Periodic Stocktaking Setup
    const handleStartStocktaking = () => {
        const initItems = parts.map((p: any) => ({
            partId: p.id,
            name: p.name,
            category: p.category,
            systemQty: p.currentStock || 0,
            countedQty: p.currentStock || 0, // default starts at current stock
            unit: p.unit || 'عدد'
        }));
        setStocktakeItems(initItems);
        setIsStocktaking(true);
    };

    // Increments count by scanning in Stocktaking
    const handleStocktakeBarcodeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const code = scanBuffer.trim();
        if (!code) return;

        const partIdx = stocktakeItems.findIndex((it: any) => 
            it.partId.toLowerCase() === code.toLowerCase() || 
            it.partId.split('_')[1]?.toLowerCase() === code.toLowerCase() ||
            it.name.toLowerCase().includes(code.toLowerCase())
        );

        if (partIdx > -1) {
            const newItems = [...stocktakeItems];
            newItems[partIdx].countedQty += 1; // scanned, increment by 1!
            setStocktakeItems(newItems);
            setScanMessage(`تعداد ${newItems[partIdx].name} افزایش یافت.`);
            setTimeout(() => setScanMessage(''), 3000);
        } else {
            setScanMessage('⚠️ بارکد در انبارگردانی یافت نشد.');
            setTimeout(() => setScanMessage(''), 3000);
        }
        setScanBuffer('');
    };

    // Save Stocktaking Results
    const handleSaveStocktaking = async () => {
        if (!confirm('آیا مطمئن هستید که می‌خواهید نتایج انبارگردانی را نهایی و موجودی سیستم را اصلاح کنید؟')) return;

        setActionLoading(true);
        try {
            const response = await fetch('/api/part-kardex/stocktake', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: stocktakeItems.map(it => ({ partId: it.partId, countedQty: it.countedQty })),
                    date: stocktakeDate,
                    description: stocktakeDesc
                })
            });

            if (!response.ok) throw new Error('Failed to commit stocktaking');
            
            alert('انبارگردانی اصولی با موفقیت پایان یافت. مغایرت‌ها اصلاح و در کاردکس ثبت گردید.');
            setIsStocktaking(false);
            if (onPartUpdate) await onPartUpdate();
            
            // Reload selected part if any
            if (selectedPart) {
                loadKardex(selectedPart.id);
            }
        } catch (err) {
            alert('خطا در نهایی‌سازی انبارگردانی');
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    const displayedStocktakeItems = filterDiscrepancy 
        ? stocktakeItems.filter(it => it.countedQty !== it.systemQty)
        : stocktakeItems;

    return (
        <div className="space-y-6 text-right dir-rtl">
            {/* Header / Setup Box */}
            <div className="glass-panel p-6 rounded-3xl border-2 border-indigo-100 shadow-sm bg-white">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                            <History size={28} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-800">سامانه کاردکس و انبارگردانی بارکدی قطعات</h2>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Dynamic Spare Parts Kardex & Cycle Counting</p>
                        </div>
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                        <button 
                            onClick={exportInventoryToExcel} 
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all"
                        >
                            <FileSpreadsheet size={16}/> خروجی اکسل کل انبار
                        </button>
                        <button 
                            onClick={() => { setManualType('IN'); setShowManualModal(true); }} 
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all"
                        >
                            <Plus size={16}/> ثبت ورود دستی
                        </button>
                        <button 
                            onClick={() => { setManualType('OUT'); setShowManualModal(true); }} 
                            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all"
                        >
                            <Trash2 size={16}/> ثبت خروج دستی
                        </button>
                        {!isStocktaking ? (
                            <button 
                                onClick={handleStartStocktaking} 
                                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all"
                            >
                                <CheckCircle size={16}/> شروع انبارگردانی دوره‌ای
                            </button>
                        ) : (
                            <button 
                                onClick={() => setIsStocktaking(false)} 
                                className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all"
                            >
                                <X size={16}/> لغو انبارگردانی
                            </button>
                        )}
                    </div>
                </div>

                <hr className="my-5 border-gray-100" />

                {/* Barcode Lookup & Fast Scan Input */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <form onSubmit={handleBarcodeSearchSubmit} className="space-y-1">
                        <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block mb-1">خوانش و شبیه‌ساز بارکدخوان (USB Scanner/Manual Lookup)</label>
                        <div className="relative">
                            <input 
                                className="w-full border-2 border-indigo-100 rounded-2xl p-3 pr-10 text-xs font-bold outline-none focus:border-indigo-500 bg-indigo-50/20" 
                                placeholder="بارکد کالا را اسکن کنید یا شناسه/نام آن را وارد کرده و Enter بزنید..." 
                                value={generalScanInput} 
                                onChange={e => setGeneralScanInput(e.target.value)} 
                            />
                            <Search className="absolute right-3 top-3.5 text-indigo-400" size={16}/>
                        </div>
                        {scanMessage && (
                            <p className="text-[10px] font-black text-emerald-600 animate-pulse mt-1">{scanMessage}</p>
                        )}
                    </form>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">انتخاب سنتی قطعه جهت کاردکس</label>
                        <select 
                            className="w-full border-2 border-gray-100 rounded-2xl p-3 text-xs font-black bg-white focus:border-indigo-400 outline-none text-gray-800"
                            value={selectedPart?.id || ''} 
                            onChange={e => { 
                                const p = parts.find((x: any) => x.id === e.target.value); 
                                setSelectedPart(p); 
                                if(p) loadKardex(p.id);
                            }}
                        >
                            <option value="">-- برای نمایش گردش موجودی کالا را انتخاب کنید --</option>
                            {parts.map((p: any) => <option key={p.id} value={p.id}>{p.name} (موجودی: {p.currentStock} {p.unit})</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* IF STOCKTAKING MODULE IS ACTIVE */}
            {isStocktaking && (
                <div className="glass-panel p-6 rounded-3xl border-2 border-amber-200 shadow-xl bg-gradient-to-r from-amber-50/20 to-white animate-fade-in space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-amber-100 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 shadow-inner">
                                <CheckCircle size={22} />
                            </div>
                            <div>
                                <h3 className="font-black text-gray-800 text-base">بخش مدیریت و مغایرت‌گیری انبارگردانی اصولی</h3>
                                <p className="text-[10px] text-gray-500 font-bold">موجود به صورت لحظه‌ای با امکان ثبت شمارش با بارکدخوان</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3 w-full md:w-auto">
                            <form onSubmit={handleStocktakeBarcodeSubmit} className="relative w-full md:w-64">
                                <input 
                                    className="w-full border-2 border-amber-300 rounded-xl py-2 px-3 pr-8 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-200" 
                                    placeholder="برای شمارش بارکد اسکن کنید..."
                                    value={scanBuffer}
                                    onChange={e => setScanBuffer(e.target.value)}
                                    autoFocus
                                />
                                <Container className="absolute right-2 top-2.5 text-amber-500" size={14} />
                            </form>
                            <button 
                                onClick={handleSaveStocktaking} 
                                className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-amber-100 transition"
                            >
                                ثبت نهایی و اصلاح مغایرت‌ها
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-gray-400 block mb-1">عنوان دوره انبارگردانی:</label>
                            <input className="w-full border rounded-xl p-2.5 text-xs font-bold" value={stocktakeDesc} onChange={e => setStocktakeDesc(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 block mb-1">تاریخ انبارگردانی:</label>
                            <input className="w-full border rounded-xl p-2.5 text-xs font-bold text-center" value={stocktakeDate} onChange={e => setStocktakeDate(e.target.value)} />
                        </div>
                        <div className="flex items-end pb-1.5">
                            <label className="flex items-center gap-2.5 text-xs font-black text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-2.5 cursor-pointer w-full select-none justify-center">
                                <input type="checkbox" checked={filterDiscrepancy} onChange={e => setFilterDiscrepancy(e.target.checked)} className="w-4 h-4 rounded text-amber-600" />
                                فقط نمایش اقلام دارای مغایرت انبارداری
                            </label>
                        </div>
                    </div>

                    <div className="border rounded-2xl overflow-hidden bg-white max-h-[450px] overflow-y-auto">
                        <table className="w-full text-right">
                            <thead>
                                <tr className="bg-amber-50/50 border-b border-amber-100 text-gray-700">
                                    <th className="p-3 text-xs font-black">ردیف</th>
                                    <th className="p-3 text-xs font-black">نام کالا / قطعه</th>
                                    <th className="p-3 text-xs font-black">گروه کالا</th>
                                    <th className="p-3 text-xs font-black text-center">موجودی سیستمی (دفتر)</th>
                                    <th className="p-3 text-xs font-black text-center">تعداد شمارش شده (انبار)</th>
                                    <th className="p-3 text-xs font-black text-center">مغایرت</th>
                                    <th className="p-3 text-xs font-black text-center">عملیات دستی</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y text-xs font-bold text-gray-800">
                                {displayedStocktakeItems.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-12 text-gray-400">موردی یافت نشد.</td></tr>
                                ) : (
                                    displayedStocktakeItems.map((it, idx) => {
                                        const diff = it.countedQty - it.systemQty;
                                        return (
                                            <tr key={it.partId} className={`hover:bg-amber-50/20 ${diff !== 0 ? 'bg-red-50/30' : ''}`}>
                                                <td className="p-3 text-gray-400 font-mono">{idx + 1}</td>
                                                <td className="p-3 font-black">{it.name}</td>
                                                <td className="p-3 text-gray-500">{it.category}</td>
                                                <td className="p-3 text-center font-mono text-gray-600">{it.systemQty} {it.unit}</td>
                                                <td className="p-3 text-center">
                                                    <input 
                                                        type="number" 
                                                        className="w-20 text-center font-mono font-black border-2 border-gray-200 rounded-lg p-1 focus:border-amber-500 outline-none text-indigo-700" 
                                                        value={it.countedQty} 
                                                        onChange={e => {
                                                            const newItems = [...stocktakeItems];
                                                            const targetIdx = newItems.findIndex(x => x.partId === it.partId);
                                                            newItems[targetIdx].countedQty = Number(e.target.value) || 0;
                                                            setStocktakeItems(newItems);
                                                        }}
                                                    />
                                                </td>
                                                <td className="p-3 text-center">
                                                    {diff === 0 ? (
                                                        <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded font-black text-[10px]">بدون مغایرت</span>
                                                    ) : (
                                                        <span className={`px-2 py-1 rounded font-black text-[10px] ${diff > 0 ? 'text-green-700 bg-green-50' : 'text-rose-700 bg-rose-50'}`}>
                                                            {diff > 0 ? `+${diff}` : diff}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button 
                                                        onClick={() => {
                                                            const newItems = [...stocktakeItems];
                                                            const targetIdx = newItems.findIndex(x => x.partId === it.partId);
                                                            newItems[targetIdx].countedQty += 1;
                                                            setStocktakeItems(newItems);
                                                        }}
                                                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded p-1 text-[10px] px-2.5 transition"
                                                    >
                                                        شمارش +۱
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MAIN KARDEX TRANSACTIONS REPORT */}
            {selectedPart ? (
                <div className="animate-fade-in space-y-4">
                    {/* Part Details & Visual Barcode Header */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 bg-gradient-to-r from-indigo-500 to-indigo-700 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div>
                                <span className="text-[10px] font-black tracking-widest text-indigo-200 bg-indigo-800/50 px-3 py-1 rounded-full uppercase">اطلاعات کاتالوگ قطعه</span>
                                <h3 className="text-2xl font-black mt-3">{selectedPart.name}</h3>
                                <p className="text-xs text-indigo-100 font-bold mt-1.5 flex gap-4">
                                    <span>دسته: {selectedPart.category}</span>
                                    {selectedPart.subCategory && <span>زیرگروه: {selectedPart.subCategory}</span>}
                                    <span>مشخصات: {selectedPart.dimensions || 'فاقد ابعاد ثبت شده'}</span>
                                </p>
                            </div>
                            <div className="flex gap-4">
                                <button 
                                    onClick={exportKardexToExcel}
                                    className="bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl px-4 py-2.5 text-xs font-black transition flex items-center gap-1.5"
                                >
                                    <FileSpreadsheet size={16}/> خروجی اکسل کاردکس
                                </button>
                            </div>
                        </div>

                        {/* Barcode Display */}
                        <div className="bg-white p-4 rounded-3xl border shadow-sm flex flex-col items-center justify-center">
                            <span className="text-[9px] font-black text-gray-400 mb-1.5">بارکد سازمانی کالا (جهت انبارگردانی و خروج)</span>
                            <BarcodeVisual value={selectedPart.id} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="glass-panel p-4 rounded-2xl bg-white border border-gray-100 flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">موجودی فعلی (سیستم)</span>
                            <span className="text-2xl font-black text-indigo-600">{selectedPart.currentStock}</span>
                            <span className="text-[10px] font-bold text-indigo-400">{selectedPart.unit}</span>
                        </div>
                        <div className="glass-panel p-4 rounded-2xl bg-white border border-gray-100 flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">کل ورودی به انبار</span>
                            <span className="text-2xl font-black text-green-600">
                                {kardexEntries.filter((k: any) => k.type === 'IN').reduce((a: any, b: any) => a + b.quantity, 0)}
                            </span>
                        </div>
                        <div className="glass-panel p-4 rounded-2xl bg-white border border-gray-100 flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">کل خروجی از انبار</span>
                            <span className="text-2xl font-black text-red-500">
                                {kardexEntries.filter((k: any) => k.type === 'OUT').reduce((a: any, b: any) => a + b.quantity, 0)}
                            </span>
                        </div>
                        <div className="glass-panel p-4 rounded-2xl bg-white border border-gray-100 flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">آستانه سفارش دهی</span>
                            <span className="text-2xl font-black text-amber-600">{selectedPart.minStock || 0}</span>
                            <span className="text-[9px] font-black text-red-500">
                                {(selectedPart.currentStock || 0) <= (selectedPart.minStock || 0) ? '⚠️ نیاز به خرید فوری' : 'کافی'}
                            </span>
                        </div>
                    </div>

                    {/* Ledgers table */}
                    <div className="glass-panel rounded-3xl border border-gray-200 overflow-hidden bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="py-4 px-6 text-xs font-black text-gray-500 text-right">تاریخ</th>
                                        <th className="py-4 px-6 text-xs font-black text-gray-500 text-right">شماره سند / مرجع</th>
                                        <th className="py-4 px-6 text-xs font-black text-gray-500 text-center">نوع تراکنش</th>
                                        <th className="py-4 px-6 text-xs font-black text-gray-500 text-center">مقدار</th>
                                        <th className="py-4 px-6 text-xs font-black text-gray-500 text-center">فی/قیمت واحد (ریال)</th>
                                        <th className="py-4 px-6 text-xs font-black text-gray-500 text-center">مانده انبار</th>
                                        <th className="py-4 px-6 text-xs font-black text-gray-500 text-right">توضیحات تراکنش</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {kardexEntries.length === 0 ? (
                                        <tr><td colSpan={7} className="py-20 text-center text-gray-400 italic font-bold">تراکنشی یافت نشد.</td></tr>
                                    ) : (
                                        kardexEntries.map((k: any) => (
                                            <tr key={k.id} className="border-b border-gray-50 hover:bg-indigo-50/20 transition-colors">
                                                <td className="py-4 px-6 text-xs font-bold text-gray-600">{formatDate(k.date)}</td>
                                                <td className="py-4 px-6 text-xs font-mono font-bold text-gray-400">#{k.referenceNumber}</td>
                                                <td className="py-4 px-6 text-center">
                                                    <span className={`text-[9px] px-3 py-1 rounded-full font-black ${k.type === 'IN' ? 'bg-green-100 text-green-700 font-black' : 'bg-red-100 text-red-700 font-black'}`}>
                                                        {k.type === 'IN' ? 'ورود' : 'خروج'}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 text-center text-sm font-black">{k.quantity}</td>
                                                <td className="py-4 px-6 text-center text-sm font-black text-blue-600">{k.unitPrice ? Number(k.unitPrice).toLocaleString() : '-'}</td>
                                                <td className="py-4 px-6 text-center text-sm font-black text-indigo-700">{k.balance}</td>
                                                <td className="py-4 px-6 text-xs text-gray-500">{k.description}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="py-32 flex flex-col items-center justify-center text-gray-300 bg-white border border-gray-100 rounded-3xl">
                    <History size={64} className="mb-4 opacity-25 text-indigo-400 animate-pulse" />
                    <p className="font-bold text-gray-500 text-sm">لطفاً برای مشاهده گردش موجودی، یک قطعه انتخاب کنید یا بارکد آن را اسکن کنید.</p>
                </div>
            )}

            {/* MANUAL TRANSACTION DIALOG */}
            {showManualModal && (
                <div className="fixed inset-0 z-[100000008] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl animate-scale-in text-right">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h3 className="font-black text-lg text-gray-800 flex items-center gap-2">
                                {manualType === 'IN' ? <ArrowDownCircle className="text-green-600"/> : <ArrowUpCircle className="text-rose-600"/>}
                                {manualType === 'IN' ? 'ثبت ورود دستی قطعه به انبار' : 'ثبت خروج دستی قطعه از انبار'}
                            </h3>
                            <button onClick={() => setShowManualModal(false)} className="text-gray-400 hover:text-gray-600"><XCircle size={22}/></button>
                        </div>
                        <form onSubmit={handleManualTransactionSubmit} className="space-y-4">
                            <div>
                                <label className="text-xs font-black text-gray-700 block mb-1">قطعه هدف:</label>
                                <select 
                                    className="w-full border rounded-xl p-3 text-xs font-bold" 
                                    value={manualPartId} 
                                    onChange={e => setManualPartId(e.target.value)}
                                    required
                                >
                                    <option value="">-- انتخاب کالا --</option>
                                    {parts.map((p: any) => <option key={p.id} value={p.id}>{p.name} (موجودی: {p.currentStock})</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-black text-gray-700 block mb-1">تعداد/مقدار:</label>
                                    <input type="number" min="1" className="w-full border rounded-xl p-3 text-xs font-black text-center" value={manualQty} onChange={e => setManualQty(Number(e.target.value))} required />
                                </div>
                                <div>
                                    <label className="text-xs font-black text-gray-700 block mb-1">قیمت واحد (ریال):</label>
                                    <input type="number" min="0" className="w-full border rounded-xl p-3 text-xs font-black text-center" value={manualPrice} onChange={e => setManualPrice(Number(e.target.value))} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-black text-gray-700 block mb-1">شماره سند/مرجع:</label>
                                    <input className="w-full border rounded-xl p-3 text-xs font-bold text-center" value={manualRef} onChange={e => setManualRef(e.target.value)} placeholder="مثلاً: RI-1402-12" />
                                </div>
                                <div>
                                    <label className="text-xs font-black text-gray-700 block mb-1">تاریخ تراکنش:</label>
                                    <input className="w-full border rounded-xl p-3 text-xs font-bold text-center" value={manualDate} onChange={e => setManualDate(e.target.value)} required />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-black text-gray-700 block mb-1">توضیحات تراکنش:</label>
                                <textarea className="w-full border rounded-xl p-2.5 text-xs h-20" value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder="دلیل خروج یا ورود کالا، نام تحویل گیرنده یا حواله مصرف..." required />
                            </div>
                            <button 
                                type="submit" 
                                disabled={actionLoading} 
                                className={`w-full text-white font-black text-xs py-3.5 rounded-2xl shadow-lg transition ${manualType === 'IN' ? 'bg-green-600 hover:bg-green-700 shadow-green-100' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-100'}`}
                            >
                                {actionLoading ? <Loader2 className="animate-spin mx-auto"/> : 'ثبت قطعی تراکنش'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const AdminEditRequestModal = ({ request, onClose, onSuccess, parts }: any) => {
    const [loading, setLoading] = useState(false);
    const [quantity, setQuantity] = useState(request.quantity);
    const [description, setDescription] = useState(request.specifications);
    const [status, setStatus] = useState(request.status);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const updated = { 
                ...request, 
                quantity, 
                specifications: description,
                status,
                updatedAt: Date.now() 
            };
            await updatePurchaseRequest(updated);
            onSuccess();
            onClose();
        } catch (e) {
            alert('خطا در بروزرسانی');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100000010] flex items-start justify-center p-4 bg-black/90 backdrop-blur-2xl transition-all pt-20 md:pt-24 overflow-y-auto">
            <div className="bg-white rounded-[3rem] w-full max-w-lg p-10 animate-scale-in shadow-2xl border-4 border-indigo-600/30 relative mb-10">
                <div className="absolute -top-3 -right-3">
                    <button onClick={onClose} className="w-12 h-12 bg-red-600 text-white rounded-2xl shadow-xl flex items-center justify-center hover:rotate-90 transition-all hover:bg-red-700">
                        <X size={28} strokeWidth={3} />
                    </button>
                </div>
                <div className="flex items-center gap-4 mb-10 border-b-2 border-gray-100 pb-8">
                    <div className="p-4 bg-indigo-50 text-indigo-700 rounded-[1.5rem] italic font-black text-xl shadow-inner">ADM</div>
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">ویرایش سیستمی</h2>
                        <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest">مدیریت مستقیم دیتا‌بیس</p>
                    </div>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6 text-right" dir="rtl">
                    <div>
                        <label className="text-xs font-black text-gray-400 block mb-2 uppercase tracking-widest">تعداد مورد نیاز</label>
                        <input type="number" className="w-full border-2 border-gray-100 rounded-2xl p-4 text-lg font-black focus:border-indigo-500 outline-none transition-all" value={quantity} onChange={e => setQuantity(+e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-black text-gray-400 block mb-2 uppercase tracking-widest">توضیحات و مشخصات فنی</label>
                        <textarea className="w-full border-2 border-gray-100 rounded-2xl p-4 text-sm h-32 focus:border-indigo-500 outline-none transition-all font-medium" value={description} onChange={e => setDescription(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-black text-gray-400 block mb-2 uppercase tracking-widest">تغییر وضعیت مرحله کاری</label>
                        <select className="w-full border-2 border-gray-100 rounded-2xl p-4 text-sm font-bold focus:border-indigo-500 outline-none appearance-none bg-gray-50" value={status} onChange={e => setStatus(e.target.value as PurchaseRequestStatus)}>
                            {Object.values(PurchaseRequestStatus).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <button disabled={loading} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                        {loading ? <Loader2 className="animate-spin"/> : <ShieldCheck size={20}/>} ثبت تغییرات سیستمی (مدیریت)
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default PurchaseModule;
