import React, { useState, useEffect } from 'react';
import { User, SystemSettings, KnowledgeBaseItem, Note } from '../types';
import { BookOpen, Copy, Share2, Check, ExternalLink, Plus, X, Edit2, Trash2, User as UserIcon, ListChecks, Bell, Clock, Search, Grid, List as ListIcon, MoreVertical, Square, CheckSquare, Trash, Lock, Unlock } from 'lucide-react';
import { getRolePermissions } from '../services/authService';
import { saveSettings, getNotes, saveNote, updateNote, deleteNote } from '../services/storageService';
import { sendNotification } from '../services/notificationService';
import { saveBlobAndOpenFile } from '../services/fileService';

// --- Modals for better focus handling ---

interface PersonalNoteModalProps {
    note: Partial<Note> | null;
    onClose: () => void;
    onSave: (note: Note) => void;
    userId: string;
}

const PersonalNoteModal: React.FC<PersonalNoteModalProps> = ({ note, onClose, onSave, userId }) => {
    const [title, setTitle] = useState(note?.title || '');
    const [content, setContent] = useState(note?.content || '');
    const [tasks, setTasks] = useState<any[]>(note?.tasks || []);
    const [reminder, setReminder] = useState<string>(note?.reminderTime ? new Date(note.reminderTime).toISOString().slice(0, 16) : '');
    const [color, setColor] = useState(note?.color || 'glass-panel');
    const [isPrivate, setIsPrivate] = useState(note?.isPrivate || false);

    const handleAddTask = () => {
        setTasks([...tasks, { id: Date.now().toString(), text: '', isCompleted: false }]);
    };

    const handleUpdateTask = (id: string, text: string) => {
        setTasks(tasks.map(t => t.id === id ? { ...t, text } : t));
    };

    const handleToggleTask = (id: string) => {
        setTasks(tasks.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted } : t));
    };

    const handleRemoveTask = (id: string) => {
        setTasks(tasks.filter(t => t.id !== id));
    };

    const handleSave = () => {
        if (!title.trim() && !content.trim() && tasks.length === 0) return;
        const finalNote: Note = {
            id: note?.id || Date.now().toString(),
            userId,
            title: title.trim() || 'بدون عنوان',
            content,
            tasks: tasks as any,
            reminderTime: reminder ? new Date(reminder).getTime() : undefined,
            color,
            isPrivate,
            createdAt: note?.createdAt || Date.now(),
            updatedAt: Date.now()
        } as any;
        onSave(finalNote);
    };

    const getShamsiReminderLabel = (isoStr: string) => {
        if (!isoStr) return null;
        try {
            const date = new Date(isoStr);
            return new Intl.DateTimeFormat('fa-IR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
            }).format(date);
        } catch { return null; }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 bg-black/60 backdrop-blur-sm rtl text-right">
            <div className={`w-full max-w-xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in max-h-[90vh] ${color}`}>
                <div className="p-4 border-b border-black/5 flex justify-between items-center flex-none">
                    <input 
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="عنوان"
                        className="bg-transparent border-none outline-none font-black text-xl text-gray-800 placeholder:text-gray-400 w-full"
                        autoFocus
                    />
                    <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full text-gray-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                    <textarea 
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="یادداشت خود را بنویسید..."
                        className="bg-transparent border-none outline-none w-full text-gray-700 leading-relaxed resize-none min-h-[100px]"
                    />

                    {/* Tasks Section */}
                    {tasks.length > 0 && (
                        <div className="space-y-2 mt-4 pt-4 border-t border-black/5">
                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <ListChecks size={14}/> لیست انجام کار
                            </h4>
                            {tasks.map((task) => (
                                <div key={task.id} className="flex items-center gap-2 group/task">
                                    <button onClick={() => handleToggleTask(task.id)} className="text-gray-400 hover:text-blue-500 transition-colors">
                                        {task.isCompleted ? <CheckSquare className="text-blue-500" size={20}/> : <Square size={20}/>}
                                    </button>
                                    <input 
                                        value={task.text}
                                        onChange={(e) => handleUpdateTask(task.id, e.target.value)}
                                        className={`flex-1 bg-transparent border-none outline-none text-sm ${task.isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}`}
                                        placeholder="تسک مورد نظر..."
                                    />
                                    <button onClick={() => handleRemoveTask(task.id)} className="opacity-0 group-hover/task:opacity-100 p-1 text-red-400 hover:bg-red-50 rounded transition-all">
                                        <Trash size={14}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-4">
                        <button onClick={handleAddTask} className="text-xs bg-black/5 text-gray-600 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold hover:bg-black/10 transition-all active:scale-95">
                            <Plus size={14}/> افزودن تسک
                        </button>
                        
                        <button 
                            onClick={() => setIsPrivate(!isPrivate)} 
                            className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold transition-all active:scale-95 ${isPrivate ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}
                        >
                            {isPrivate ? <Lock size={14}/> : <Unlock size={14}/>}
                            {isPrivate ? 'یادداشت خصوصی (مخفی در پیشخوان)' : 'یادداشت عمومی (نمایش در پیشخوان)'}
                        </button>

                        <div className="flex-1"></div>

                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 bg-black/5 px-3 py-1.5 rounded-lg">
                                <Bell size={14} className="text-gray-500"/>
                                <input 
                                    type="datetime-local"
                                    value={reminder}
                                    onChange={(e) => setReminder(e.target.value)}
                                    className="bg-transparent border-none outline-none text-[10px] font-bold text-gray-600 cursor-pointer"
                                />
                            </div>
                            {reminder && (
                                <div className="text-[9px] font-black text-blue-600 text-left px-1">
                                    {getShamsiReminderLabel(reminder)}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Color Picker */}
                    <div className="flex gap-2 justify-center pt-4 border-t border-black/5">
                        {['glass-panel', 'bg-rose-50', 'bg-amber-50', 'bg-emerald-50', 'bg-blue-50', 'bg-indigo-50', 'bg-purple-50'].map(c => (
                            <button 
                                key={c}
                                onClick={() => setColor(c)}
                                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${c} ${color === c ? 'border-gray-400' : 'border-black/5'}`}
                            />
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t border-black/5 bg-black/5 flex justify-end gap-3 flex-none">
                    <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-black/5 transition-colors">بستن</button>
                    <button onClick={handleSave} className="px-6 py-2.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg">ذخیره</button>
                </div>
            </div>
        </div>
    );
};

// --- Sub-components moved outside to fix focus issues ---

interface ItemModalProps {
    editingItem: KnowledgeBaseItem | null;
    titleStr: string;
    setTitleStr: (val: string) => void;
    contentStr: string;
    setContentStr: (val: string) => void;
    onClose: () => void;
    onSave: () => void;
}

const ItemModal: React.FC<ItemModalProps> = ({ 
    editingItem, titleStr, setTitleStr, contentStr, setContentStr, onClose, onSave 
}) => (
    <div className="fixed inset-0 z-50 flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 bg-black/50 backdrop-blur-sm rtl text-right">
        <div className="glass-panel rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200 flex-none">
                <h2 className="font-black text-gray-800 text-lg">{editingItem ? 'ویرایش یادداشت' : 'افزودن یادداشت جدید'}</h2>
                <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                    <X size={20} />
                </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">عنوان <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        value={titleStr}
                        onChange={(e) => setTitleStr(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="مثلا: شرایط فروش قسطی، شیوه ارسال کالا و..."
                        autoFocus
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">متن توضیحات</label>
                    <textarea
                        value={contentStr}
                        onChange={(e) => setContentStr(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl p-3 h-40 resize-y focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
                        placeholder="متن دلخواه..."
                    />
                </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 flex-none">
                <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors">انصراف</button>
                <button onClick={onSave} disabled={!titleStr.trim()} className="px-5 py-2.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                    <Check size={18}/> ذخیره اطلاعات
                </button>
            </div>
        </div>
    </div>
);

interface CompanyModalProps {
    editingCompany: any;
    setEditingCompany: (val: any) => void;
    onClose: () => void;
    onSave: () => void;
    companies: any[];
}

const CompanyModal: React.FC<CompanyModalProps> = ({ 
    editingCompany, setEditingCompany, onClose, onSave, companies 
}) => (
    <div className="fixed inset-0 z-50 flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 bg-black/50 backdrop-blur-sm rtl text-right">
        <div className="glass-panel rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-yellow-50 flex-none">
                <h2 className="font-black text-yellow-900 text-lg">
                    {companies.find(c => c.id === editingCompany?.id) ? 'ویرایش اطلاعات شخص / شرکت' : 'ثبت شخص / شرکت جدید'}
                </h2>
                <button onClick={onClose} className="p-2 hover:bg-yellow-200 rounded-full text-yellow-700 transition-colors">
                    <X size={20} />
                </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-1">نام شخص / نام شرکت <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={editingCompany?.name || ''}
                            onChange={(e) => setEditingCompany({...editingCompany, name: e.target.value})}
                            className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-yellow-500 outline-none font-bold text-gray-800"
                            placeholder="..."
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">کد ملی / شناسه ملی</label>
                        <input
                            type="text"
                            value={editingCompany?.nationalId || ''}
                            onChange={(e) => setEditingCompany({...editingCompany, nationalId: e.target.value})}
                            className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-yellow-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">شماره ثبت</label>
                        <input
                            type="text"
                            value={editingCompany?.registrationNumber || ''}
                            onChange={(e) => setEditingCompany({...editingCompany, registrationNumber: e.target.value})}
                            className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-yellow-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">شماره تماس</label>
                        <input
                            type="text"
                            value={editingCompany?.phone || ''}
                            onChange={(e) => setEditingCompany({...editingCompany, phone: e.target.value})}
                            className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-yellow-500 outline-none dir-ltr text-left"
                        />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-1">آدرس</label>
                        <textarea
                            value={editingCompany?.address || ''}
                            onChange={(e) => setEditingCompany({...editingCompany, address: e.target.value})}
                            className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-yellow-500 outline-none h-20 resize-y"
                        />
                    </div>
                </div>
                
                <div className="mt-8">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-800 text-lg">حساب‌های بانکی</h3>
                        <button 
                            onClick={() => {
                                const newBanks = [...(editingCompany.banks || [])];
                                newBanks.push({ id: Date.now().toString(), bankName: '', accountNumber: '', sheba: '', cardNumber: '' });
                                setEditingCompany({...editingCompany, banks: newBanks});
                            }}
                            className="text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold transition-colors hover:bg-green-200"
                        >
                            <Plus size={16}/> افزودن حساب
                        </button>
                    </div>
                    
                    <div className="space-y-4">
                        {(editingCompany?.banks || []).map((bank: any, idx: number) => (
                            <div key={bank.id} className="bg-gray-50 border border-gray-200/50 dark:border-white/10 rounded-xl p-4 relative">
                                <button 
                                    onClick={() => {
                                        const newBanks = editingCompany.banks.filter((b: any) => b.id !== bank.id);
                                        setEditingCompany({...editingCompany, banks: newBanks});
                                    }}
                                    className="absolute top-4 left-4 text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                >
                                    <Trash2 size={18}/>
                                </button>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-8">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">نام بانک</label>
                                        <input
                                            type="text"
                                            value={bank.bankName}
                                            onChange={(e) => {
                                                const newBanks = [...editingCompany.banks];
                                                newBanks[idx].bankName = e.target.value;
                                                setEditingCompany({...editingCompany, banks: newBanks});
                                            }}
                                            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 outline-none text-sm font-bold"
                                            placeholder="مثال: ملی، ملت..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">شماره حساب</label>
                                        <input
                                            type="text"
                                            value={bank.accountNumber}
                                            onChange={(e) => {
                                                const newBanks = [...editingCompany.banks];
                                                newBanks[idx].accountNumber = e.target.value;
                                                setEditingCompany({...editingCompany, banks: newBanks});
                                            }}
                                            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 outline-none dir-ltr text-left font-mono text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">شماره کارت (۱۶ رقم)</label>
                                        <input
                                            type="text"
                                            value={bank.cardNumber || ''}
                                            onChange={(e) => {
                                                const newBanks = [...editingCompany.banks];
                                                newBanks[idx].cardNumber = e.target.value;
                                                setEditingCompany({...editingCompany, banks: newBanks});
                                            }}
                                            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 outline-none dir-ltr text-left font-mono text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">شماره شبا</label>
                                        <div className="flex items-center">
                                            <input
                                                type="text"
                                                value={bank.sheba || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/^IR/i, '');
                                                    const newBanks = [...editingCompany.banks];
                                                    newBanks[idx].sheba = val;
                                                    setEditingCompany({...editingCompany, banks: newBanks});
                                                }}
                                                className="flex-1 w-full border border-gray-300 rounded-l-none rounded-r-lg p-2 focus:ring-2 outline-none dir-ltr text-left font-mono text-sm"
                                            />
                                            <span className="bg-gray-200 border border-gray-300 border-l-0 rounded-l-lg p-2 text-sm font-mono font-bold">IR</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {(editingCompany?.banks || []).length === 0 && (
                            <div className="text-center text-sm text-gray-500 py-4 bg-gray-50 border border-dashed border-gray-300 rounded-xl">
                                هیچ حسابی ثبت نشده است.
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 flex-none">
                <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors">انصراف</button>
                <button onClick={onSave} disabled={!editingCompany?.name.trim()} className="px-5 py-2.5 rounded-xl font-bold bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                    <Check size={18}/> ذخیره در سیستم
                </button>
            </div>
        </div>
    </div>
);

interface KnowledgeBaseModuleProps {
    currentUser: User;
    settings: SystemSettings | null;
    onUpdateSettings: (settings: SystemSettings) => void;
}

const KnowledgeBaseModule: React.FC<KnowledgeBaseModuleProps> = ({ currentUser, settings, onUpdateSettings }) => {
    const permissions = settings ? getRolePermissions(currentUser.role, settings, currentUser) : {};
    const isAdmin = currentUser.role.toLowerCase() === 'admin';
    const canViewCompanyTab = isAdmin || permissions.canViewCompanyInfo !== false;
    const canViewPersonalTab = isAdmin || permissions.canUsePersonalNotes !== false;

    const [activeTab, setActiveTab] = useState<'personal' | 'company'>(() => {
        if (!canViewPersonalTab && canViewCompanyTab) return 'company';
        return 'personal';
    });
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchTerm, setSearchTerm] = useState('');

    const canManageKnowledge = isAdmin || permissions.canManageKnowledgeBase === true || permissions.canManageCompanyInfo === true;
    
    // Personal Notes State
    const [personalNotes, setPersonalNotes] = useState<Note[]>([]);
    const [showPersonalModal, setShowPersonalModal] = useState(false);
    const [editingPersonalNote, setEditingPersonalNote] = useState<Partial<Note> | null>(null);

    useEffect(() => {
        if (currentUser?.id) {
            refreshNotes();
        }
    }, [currentUser]);

    const refreshNotes = async () => {
        try {
            console.log("Refreshing notes for user:", currentUser?.id);
            const allNotes = await getNotes();
            console.log("Notes fetched from API:", allNotes);
            if (!Array.isArray(allNotes)) {
                console.error("Notes fetched is not an array:", allNotes);
                setPersonalNotes([]);
                return;
            }
            const filtered = allNotes.filter(n => n && n.userId === currentUser.id);
            console.log("Filtered notes for user:", filtered);
            setPersonalNotes(filtered);
        } catch (e) {
            console.error("Refresh notes error", e);
        }
    };

    // Reminder Checker
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            personalNotes.forEach(async (note) => {
                if (note.reminderTime && note.reminderTime > now && note.reminderTime < now + 60000) {
                    sendNotification(`یادآوری: ${note.title}`, note.content.slice(0, 50));
                    // Optional: remove reminder after firing once
                    const updated = { ...note, reminderTime: undefined };
                    await updateNote(updated);
                    refreshNotes();
                }
            });
        }, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, [personalNotes]);

    const handleSavePersonalNote = async (note: Note) => {
        console.log("Saving personal note:", note);
        if (!note || !note.userId) {
            console.error("Invalid note data for save:", note);
            alert('خطا: اطلاعات یادداشت ناقص است');
            return;
        }
        try {
            const existingIdx = personalNotes.findIndex(n => n.id === note.id);
            if (existingIdx >= 0) {
                console.log("Updating existing note...");
                await updateNote(note);
            } else {
                console.log("Saving new note...");
                await saveNote(note);
            }
            refreshNotes();
            setShowPersonalModal(false);
            window.dispatchEvent(new CustomEvent('REFRESH_UI'));
        } catch (e: any) {
            console.error("Save note error:", e);
            alert(`خطا در ذخیره یادداشت: ${e.message || 'خطای ناشناخته'}`);
        }
    };

    const handleDeletePersonalNote = async (id: string) => {
        if (window.confirm('آیا این یادداشت حذف شود؟')) {
            try {
                await deleteNote(id);
                refreshNotes();
                window.dispatchEvent(new CustomEvent('REFRESH_UI'));
            } catch (e) {
                alert('خطا در حذف یادداشت');
            }
        }
    };

    const companies = settings?.companies || [];
    const customItems = settings?.knowledgeBaseItems || [];
    
    const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
    
    // Custom Notes Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<KnowledgeBaseItem | null>(null);
    const [titleStr, setTitleStr] = useState('');
    const [contentStr, setContentStr] = useState('');

    // Company/Person Modal state
    const [showCompanyModal, setShowCompanyModal] = useState(false);
    const [editingCompany, setEditingCompany] = useState<any | null>(null);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedStates({ ...copiedStates, [id]: true });
        setTimeout(() => setCopiedStates({ ...copiedStates, [id]: false }), 2000);
    };

    const handleShare = (text: string, title?: string) => {
        if (navigator.share) {
            navigator.share({
                title: title || 'اطلاعات سیستم',
                text: text
            }).catch(console.error);
        } else {
            const encodedText = encodeURIComponent(text);
            window.open(`https://wa.me/?text=${encodedText}`, '_blank');
        }
    };

    const downloadAsTxt = (text: string, filename: string) => {
        const file = new Blob([text], {type: 'text/plain;charset=utf-8'});
        saveBlobAndOpenFile(file, `${filename}.txt`);
    };

    const downloadAsPdf = (company: any) => {
        const printWindow = window.open('', '_blank');
        if(!printWindow) return;
        
        let html = `
        <html dir="rtl">
        <head>
            <title>اطلاعات ${company.name}</title>
            <style>
                body { font-family: Tahoma, Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
                h1 { color: #1e3a8a; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                .info-item { background: #f9fafb; padding: 15px; border-radius: 8px; font-weight: bold; }
                .label { font-size: 12px; color: #6b7280; display: block; margin-bottom: 5px; }
                h2 { color: #b45309; border-bottom: 1px solid #fef3c7; padding-bottom: 5px; margin-top: 30px; }
                .bank-card { background: #fffbeb; padding: 15px; border: 1px solid #fde68a; border-radius: 8px; margin-bottom: 15px; }
                .bank-name { font-size: 18px; font-weight: bold; color: #92400e; margin-bottom: 10px; }
                .bank-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: bold;}
                .bank-row font { font-family: monospace; font-size: 16px; }
            </style>
        </head>
        <body>
            <h1>${company.name}</h1>
            <div class="info-grid">
                ${company.nationalId ? `<div class="info-item"><span class="label">شناسه ملی</span>${company.nationalId}</div>` : ''}
                ${company.registrationNumber ? `<div class="info-item"><span class="label">شماره ثبت</span>${company.registrationNumber}</div>` : ''}
                ${company.phone ? `<div class="info-item"><span class="label">تلفن تماس</span>${company.phone}</div>` : ''}
                ${company.address ? `<div class="info-item"><span class="label">آدرس</span>${company.address}</div>` : ''}
            </div>
        `;

        if (company.banks && company.banks.length > 0) {
            html += `<h2>اطلاعات حساب‌های بانکی</h2>`;
            company.banks.forEach((b: any) => {
                html += `<div class="bank-card">
                    <div class="bank-name">بانک ${b.bankName}</div>
                    <div class="bank-row"><span>شماره حساب:</span> <font>${b.accountNumber}</font></div>
                    ${b.cardNumber ? `<div class="bank-row"><span>شماره کارت:</span> <font>${b.cardNumber}</font></div>` : ''}
                    ${b.sheba ? `<div class="bank-row"><span>شماره شبا:</span> <font dir="ltr">IR${b.sheba.replace(/^IR/i, '')}</font></div>` : ''}
                </div>`;
            });
        }

        html += `</body></html>`;
        printWindow.document.write(html);
        printWindow.document.close();
        
        // Wait for styles to load then print
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    const handleSaveItem = async () => {
        if (!titleStr.trim() || !settings) return;
        const now = new Date().toISOString();
        let newItems = [...customItems];
        if (editingItem) {
            newItems = newItems.map(item => item.id === editingItem.id ? { ...item, title: titleStr, content: contentStr, updatedAt: now } : item);
        } else {
            newItems.unshift({ id: Date.now().toString(), title: titleStr, content: contentStr, createdAt: now, updatedAt: now });
        }
        
        const updatedSettings = { ...settings, knowledgeBaseItems: newItems };
        await saveSettings(updatedSettings);
        onUpdateSettings(updatedSettings);
        closeModal();
    };

    const handleDeleteItem = async (id: string) => {
        if (!settings || !window.confirm('آیا از حذف این یادداشت اطمینان دارید؟')) return;
        const newItems = customItems.filter(item => item.id !== id);
        const updatedSettings = { ...settings, knowledgeBaseItems: newItems };
        await saveSettings(updatedSettings);
        onUpdateSettings(updatedSettings);
    };

    const openModal = (item?: KnowledgeBaseItem) => {
        if (item) {
            setEditingItem(item);
            setTitleStr(item.title);
            setContentStr(item.content);
        } else {
            setEditingItem(null);
            setTitleStr('');
            setContentStr('');
        }
        setShowModal(true);
    };

    const openCompanyModal = (company?: any) => {
        if (company) {
            setEditingCompany(JSON.parse(JSON.stringify(company)));
        } else {
            setEditingCompany({
                id: Date.now().toString(),
                name: '',
                nationalId: '',
                registrationNumber: '',
                phone: '',
                address: '',
                banks: []
            });
        }
        setShowCompanyModal(true);
    };

    const handleSaveCompany = async () => {
        if (!editingCompany || !editingCompany.name.trim() || !settings) return;
        const newCompanies = [...companies];
        const existingIdx = newCompanies.findIndex(c => c.id === editingCompany.id);
        
        if (existingIdx >= 0) {
            newCompanies[existingIdx] = editingCompany;
        } else {
            newCompanies.unshift(editingCompany);
        }
        
        const updatedSettings = { ...settings, companies: newCompanies };
        await saveSettings(updatedSettings);
        onUpdateSettings(updatedSettings);
        setShowCompanyModal(false);
    };
    
    const handleDeleteCompany = async (id: string) => {
        if (!settings || !window.confirm('آیا از حذف این شرکت/شخص اطمینان دارید؟')) return;
        const newCompanies = companies.filter(c => c.id !== id);
        const updatedSettings = { ...settings, companies: newCompanies };
        await saveSettings(updatedSettings);
        onUpdateSettings(updatedSettings);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingItem(null);
    };

    if (companies.length === 0 && customItems.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6 animate-fade-in relative">
                <div className="bg-blue-100 p-4 rounded-full text-blue-600 mb-4 shadow-sm"><BookOpen size={48}/></div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">اطلاعاتی یافت نشد</h2>
                <p className="text-gray-600 max-w-md leading-relaxed">هنوز هیچ شرکتی یا در تنظیمات تعریف نشده یا اطلاعاتی اضافه نشده است.</p>
                {canManageKnowledge && (
                    <div className="flex gap-2 justify-center mt-6">
                        <button onClick={() => openCompanyModal()} className="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700">
                            <Plus size={18}/> شخص / شرکت
                        </button>
                        <button onClick={() => openModal()} className="bg-orange-600 text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-700">
                            <Plus size={18}/> یادداشت
                        </button>
                    </div>
                )}
                {/* Modal rendering outside regular flow */}
                {showModal && (
                    <ItemModal 
                        editingItem={editingItem} 
                        titleStr={titleStr} 
                        setTitleStr={setTitleStr} 
                        contentStr={contentStr} 
                        setContentStr={setContentStr} 
                        onClose={closeModal} 
                        onSave={handleSaveItem} 
                    />
                )}
                {showCompanyModal && (
                    <CompanyModal 
                        editingCompany={editingCompany}
                        setEditingCompany={setEditingCompany}
                        onClose={() => setShowCompanyModal(false)}
                        onSave={handleSaveCompany}
                        companies={companies}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 animate-fade-in rtl text-right">
            {/* Header & App Selection */}
            <div className="glass-panel p-6 rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${activeTab === 'personal' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'}`}>
                            {activeTab === 'personal' ? <Edit2 size={32}/> : <BookOpen size={32}/>}
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-800">
                                {activeTab === 'personal' ? 'دفترچه یادداشت من' : 'دانشنامه و اطلاعات شرکت'}
                            </h2>
                            <p className="text-gray-500 text-xs font-bold mt-1">
                                {activeTab === 'personal' ? 'یادداشت‌های شخصی، تسک‌ها و یادآوری‌های شما (فقط در گوشی/سیستم شما)' : 'مشخصات بانکی، شبا و اطلاعات کلی شرکت‌ها'}
                            </p>
                        </div>
                    </div>
                    
                    {canViewPersonalTab && canViewCompanyTab && (
                        <div className="flex bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200 p-1 rounded-2xl self-start md:self-center">
                            <button 
                                onClick={() => setActiveTab('personal')}
                                className={`flex items-center gap-2 px-6 py-2 rounded-xl transition-all font-black text-sm ${activeTab === 'personal' ? 'glass-panel shadow-sm text-yellow-600' : 'text-gray-500 hover:text-gray-800'}`}
                            >
                                <UserIcon size={18}/> شخصی
                            </button>
                            <button 
                                onClick={() => setActiveTab('company')}
                                className={`flex items-center gap-2 px-6 py-2 rounded-xl transition-all font-black text-sm ${activeTab === 'company' ? 'glass-panel shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
                            >
                                <BookOpen size={18}/> شرکت
                            </button>
                        </div>
                    )}
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex-1 min-w-[300px] relative">
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
                        <input 
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={activeTab === 'personal' ? 'جستجو در یادداشت‌ها...' : 'جستجو در شرکت‌ها و عنوان‌ها...'}
                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3 pr-12 pl-4 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm"
                        />
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="flex bg-gray-100 p-1 rounded-xl">
                            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'glass-panel text-gray-800 shadow-sm' : 'text-gray-400'}`}><Grid size={18}/></button>
                            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'glass-panel text-gray-800 shadow-sm' : 'text-gray-400'}`}><ListIcon size={18}/></button>
                        </div>
                        <button 
                            onClick={() => {
                                if (activeTab === 'personal') { setEditingPersonalNote(null); setShowPersonalModal(true); }
                                else if (canManageKnowledge) { openModal(); }
                            }}
                            className={`px-6 py-3 rounded-2xl text-white font-black flex items-center gap-2 shadow-lg transition-all hover:scale-105 active:scale-95 ${activeTab === 'personal' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            <Plus size={20}/> مورد جدید
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {activeTab === 'personal' && canViewPersonalTab ? (
                <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "space-y-4"}>
                    {personalNotes
                        .filter(n => n.title.includes(searchTerm) || n.content.includes(searchTerm))
                        .map(note => (
                            <div 
                                key={note.id}
                                onClick={() => { setEditingPersonalNote(note); setShowPersonalModal(true); }}
                                className={`rounded-2xl p-5 shadow-sm border border-black/5 hover:shadow-md transition-all cursor-pointer relative group flex flex-col ${note.color || 'glass-panel'}`}
                            >
                                <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    {note.isPrivate && (
                                        <div className="p-1.5 bg-white/50 backdrop-blur-sm rounded-lg text-orange-500" title="خصوصی">
                                            <Lock size={16}/>
                                        </div>
                                    )}
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeletePersonalNote(note.id); }}
                                        className="p-1.5 bg-white/50 backdrop-blur-sm rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                        <Trash size={16}/>
                                    </button>
                                </div>

                                <h3 className="font-bold text-gray-800 mb-3 truncate pr-4">{note.title}</h3>
                                <div className="text-gray-600 text-sm leading-relaxed line-clamp-6 mb-4">{note.content}</div>
                                
                                {note.tasks && note.tasks.length > 0 && (
                                    <div className="space-y-1 mb-4">
                                        {note.tasks.slice(0, 3).map(task => (
                                            <div key={task.id} className="flex items-center gap-2 text-[11px] font-bold text-gray-500">
                                                {task.isCompleted ? <CheckSquare size={12} className="text-blue-500"/> : <Square size={12}/>}
                                                <span className={task.isCompleted ? 'line-through opacity-50' : ''}>{task.text}</span>
                                            </div>
                                        ))}
                                        {note.tasks.length > 3 && <div className="text-[10px] text-gray-400 pr-4">...و {note.tasks.length - 3} مورد دیگر</div>}
                                    </div>
                                )}

                                <div className="mt-auto pt-3 border-t border-black/5 flex justify-between items-center">
                                    {note.reminderTime ? (
                                        <div className="text-[10px] font-black text-rose-500 flex items-center gap-1">
                                            <Bell size={12}/> {new Date(note.reminderTime).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    ) : (
                                        <div className="text-[10px] text-gray-400 font-bold">
                                            {new Date(note.createdAt).toLocaleDateString('fa-IR')}
                                        </div>
                                    )}
                                    <button className="text-gray-400 group-hover:text-gray-800 transition-colors"><MoreVertical size={16}/></button>
                                </div>
                            </div>
                        ))}
                    {personalNotes.length === 0 && (
                        <div className="col-span-full py-20 bg-gray-50/50 border-2 border-dashed border-gray-200 rounded-3xl text-center flex flex-col items-center justify-center gap-4">
                            <div className="glass-panel p-4 rounded-full shadow-sm text-gray-400"><Edit2 size={48}/></div>
                            <h3 className="font-black text-gray-400">هنوز یادداشتی ننوشته‌اید</h3>
                            <button onClick={() => { setEditingPersonalNote(null); setShowPersonalModal(true); }} className="bg-yellow-500 text-white px-6 py-2 rounded-xl font-bold">اولین یادداشت را ثبت کنید</button>
                        </div>
                    )}
                </div>
            ) : activeTab === 'company' && canViewCompanyTab ? (
                <div className={viewMode === 'grid' ? "columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6" : "space-y-4"}>
                    {/* Custom Items First */}
                    {customItems
                        .filter(item => item.title.includes(searchTerm) || item.content.includes(searchTerm))
                        .map(item => {
                            const shareText = `📌 ${item.title}\n\n${item.content}`;
                            return (
                                <div key={item.id} className="bg-orange-50 rounded-2xl p-5 shadow-sm border border-orange-200 break-inside-avoid shadow-orange-100/50 relative group">
                                    <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity flex bg-white/80 backdrop-blur-sm rounded-lg p-1 shadow-sm gap-1">
                                        {canManageKnowledge && (
                                            <>
                                                <button onClick={() => openModal(item)} className="p-1.5 hover:bg-gray-100 rounded text-blue-600 transition-colors" title="ویرایش">
                                                    <Edit2 size={16}/>
                                                </button>
                                                <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 hover:bg-gray-100 rounded text-red-600 transition-colors" title="حذف">
                                                    <Trash2 size={16}/>
                                                </button>
                                                <div className="w-px bg-gray-300 my-1 mx-1"></div>
                                            </>
                                        )}
                                        <button onClick={() => handleCopy(shareText, item.id)} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors" title="کپی کردن متن">
                                            {copiedStates[item.id] ? <Check size={16} className="text-green-600"/> : <Copy size={16}/>}
                                        </button>
                                        <button onClick={() => handleShare(shareText, item.title)} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors" title="ارسال پیام">
                                            <Share2 size={16}/>
                                        </button>
                                    </div>
                                    
                                    <h3 className="font-bold text-gray-800 text-lg mb-3 border-b border-orange-200/50 pb-2 flex items-center gap-2">
                                        <BookOpen size={18} className="text-orange-500" />
                                        {item.title}
                                    </h3>
                                    <div className="text-sm font-bold text-gray-700 leading-relaxed whitespace-pre-wrap">
                                        {item.content || <span className="text-gray-400 italic">بدون توضیحات...</span>}
                                    </div>
                                    <div className="mt-4 text-[10px] text-gray-400 flex justify-end">
                                        ویرایش: {new Date(item.updatedAt).toLocaleDateString('fa-IR')}
                                    </div>
                                </div>
                            );
                        })}

                    {/* Companies Second */}
                    {companies
                        .filter(company => company.name.includes(searchTerm))
                        .map(company => {
                            let shareText = `📌 مشخصات ${company.name}\n`;
                            if(company.registrationNumber) shareText += `شماره ثبت: ${company.registrationNumber}\n`;
                            if(company.nationalId) shareText += `شناسه ملی: ${company.nationalId}\n`;
                            if(company.phone) shareText += `تماس: ${company.phone}\n`;
                            if(company.address) shareText += `آدرس: ${company.address}\n`;
                            
                            if(company.banks && company.banks.length > 0) {
                                shareText += `\n💳 اطلاعات حساب‌ها:\n`;
                                company.banks.forEach(b => {
                                    shareText += `بانک ${b.bankName}\nحساب: ${b.accountNumber}\n`;
                                    if(b.cardNumber) shareText += `کارت: ${b.cardNumber}\n`;
                                    if(b.sheba) shareText += `شبا: IR${b.sheba.replace(/^IR/i, '')}\n`;
                                    shareText += `-------------------\n`;
                                });
                            }

                            return (
                                <div key={company.id} className="bg-yellow-50 rounded-2xl p-5 shadow-sm border border-yellow-200 break-inside-avoid shadow-yellow-100/50 relative group">
                                    <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity flex bg-white/80 backdrop-blur-sm rounded-lg p-1 shadow-sm gap-1">
                                        {canManageKnowledge && (
                                            <>
                                                <button onClick={() => openCompanyModal(company)} className="p-1.5 hover:bg-gray-100 rounded text-blue-600 transition-colors" title="ویرایش">
                                                    <Edit2 size={16}/>
                                                </button>
                                                <button onClick={() => handleDeleteCompany(company.id)} className="p-1.5 hover:bg-gray-100 rounded text-red-600 transition-colors" title="حذف">
                                                    <Trash2 size={16}/>
                                                </button>
                                                <div className="w-px bg-gray-300 my-1 mx-1"></div>
                                            </>
                                        )}
                                        <button onClick={() => downloadAsTxt(shareText, company.name || 'document')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors text-xs font-bold uppercase" title="دانلود فایل متنی">
                                            TXT
                                        </button>
                                        <button onClick={() => downloadAsPdf(company)} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors text-xs font-bold uppercase" title="دانلود PDF">
                                            PDF
                                        </button>
                                        <button onClick={() => handleCopy(shareText, company.id)} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors" title="کپی کردن کل متن">
                                            {copiedStates[company.id] ? <Check size={16} className="text-green-600"/> : <Copy size={16}/>}
                                        </button>
                                        <button onClick={() => handleShare(shareText, company.name)} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors" title="ارسال پیام">
                                            <Share2 size={16}/>
                                        </button>
                                    </div>
                                    
                                    <h3 className="font-bold text-gray-800 text-lg mb-3 border-b border-yellow-200/50 pb-2">{company.name}</h3>
                                    
                                    <div className="space-y-4 text-sm font-bold text-gray-700">
                                        <div className="space-y-1">
                                            {company.nationalId && <div>شناسه ملی: <span className="font-mono glass-panel px-1.5 py-0.5 rounded text-gray-800 border border-yellow-100 select-all">{company.nationalId}</span></div>}
                                            {company.registrationNumber && <div>شماره ثبت: <span className="font-mono glass-panel px-1.5 py-0.5 rounded text-gray-800 border border-yellow-100 select-all">{company.registrationNumber}</span></div>}
                                            {company.phone && <div>تلفن: <span className="font-mono glass-panel px-1.5 py-0.5 rounded text-gray-800 border border-yellow-100 select-all">{company.phone}</span></div>}
                                        </div>
                                        
                                        {company.banks && company.banks.length > 0 ? (
                                            <div className="space-y-3 pt-2">
                                                <div className="text-xs bg-yellow-100/50 text-yellow-800 px-2 py-1 rounded-lg inline-block">حساب‌های بانکی:</div>
                                                {company.banks.map(bank => (
                                                    <div key={bank.id} className="glass-panel rounded-xl p-3 shadow-sm border border-yellow-100 relative group/bank">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="font-black text-blue-900 border-r-2 border-blue-500 pr-2">{bank.bankName}</span>
                                                            <div className="flex gap-1 opacity-0 group/bank:opacity-100 transition-opacity">
                                                                <button onClick={() => handleCopy(`بانک ${bank.bankName}\nحساب: ${bank.accountNumber}${bank.sheba ? '\nشبا: '+bank.sheba : ''}`, bank.id)} className="p-1 hover:bg-gray-100 rounded">
                                                                    {copiedStates[bank.id] ? <Check size={14} className="text-green-600"/> : <Copy size={14} className="text-gray-500"/>}
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-gray-500">حساب:</span>
                                                            <span className="font-mono font-bold select-all">{bank.accountNumber}</span>
                                                        </div>
                                                        {bank.cardNumber && (
                                                            <div className="flex items-center justify-between mt-1">
                                                                <span className="text-xs text-gray-500">کارت:</span>
                                                                <span className="font-mono font-bold tracking-widest text-[13px] select-all">{bank.cardNumber}</span>
                                                            </div>
                                                        )}
                                                        {bank.sheba && (
                                                            <div className="flex items-center justify-between mt-1">
                                                                <span className="text-xs text-gray-500">شبا:</span>
                                                                <span className="font-mono font-black tracking-widest text-[11px] select-all dir-ltr">IR{bank.sheba.replace(/^IR/i, '')}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-gray-400 italic">حساب بانکی ثبت نشده است</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                </div>
            ) : (
                <div className="p-12 text-center text-gray-500 font-bold bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                    شما دسترسی به این بخش را ندارید.
                </div>
            )}
            {/* Modals */}
            {showPersonalModal && (
                <PersonalNoteModal 
                    note={editingPersonalNote}
                    onClose={() => setShowPersonalModal(false)}
                    onSave={handleSavePersonalNote}
                    userId={currentUser.id}
                />
            )}
            {showModal && (
                <ItemModal 
                    editingItem={editingItem} 
                    titleStr={titleStr} 
                    setTitleStr={setTitleStr} 
                    contentStr={contentStr} 
                    setContentStr={setContentStr} 
                    onClose={closeModal} 
                    onSave={handleSaveItem} 
                />
            )}
            {showCompanyModal && (
                <CompanyModal 
                    editingCompany={editingCompany}
                    setEditingCompany={setEditingCompany}
                    onClose={() => setShowCompanyModal(false)}
                    onSave={handleSaveCompany}
                    companies={companies}
                />
            )}
        </div>
    );
};

export default KnowledgeBaseModule;
