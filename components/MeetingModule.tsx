
import React, { useState, useEffect, useRef } from 'react';
import PrintMeeting from './print/PrintMeeting';
import { User, MeetingMinutes, MeetingStatus, MeetingAttendee, MeetingItem, UserRole, SystemSettings, RolePermissions } from '../types';
import { getMeetings, saveMeeting, updateMeeting, deleteMeeting, getNextMeetingNumber, getSettings, sendMeetingAnnouncement, sendMeetingMinutes, sendMessage, uploadFileChunked } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, formatDate } from '../constants';
import { ClipboardList, Plus, Search, Calendar, Clock, MapPin, Users, CheckCircle, XCircle, Trash2, Edit, Printer, Send, Eye, Loader2, Save, X, PlusCircle, UserCheck, MessageSquare, AlertCircle, CheckSquare, Lock, Paperclip, FileText, Image } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { getUsers } from '../services/authService';
import { downloadAndOpenFile } from '../services/fileService';

interface Props {
    currentUser: User;
    initialYear?: string;
}

const MeetingModule: React.FC<Props> = ({ currentUser, initialYear }) => {
    const [meetings, setMeetings] = useState<MeetingMinutes[]>([]);
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'draft' | 'archive' | 'kartable'>('all');
    
    const [showModal, setShowModal] = useState(false);
    const [editingMeeting, setEditingMeeting] = useState<MeetingMinutes | null>(null);
    const [viewMeeting, setViewMeeting] = useState<MeetingMinutes | null>(null);
    const [showPrintModal, setShowPrintModal] = useState<MeetingMinutes | null>(null);
    const [activeAttendeeIndex, setActiveAttendeeIndex] = useState<number | null>(null);
    
    const [meetingForm, setMeetingForm] = useState<Partial<MeetingMinutes>>({
        date: '',
        time: '',
        location: 'محل دائمی جلسات کارخانه',
        chairman: '',
        secretary: '',
        attendees: [],
        items: [],
        status: MeetingStatus.DRAFT
    });
    
    const [searchTerm, setSearchTerm] = useState('');
    const [guestInput, setGuestInput] = useState('');
    const [newCommentText, setNewCommentText] = useState('');

    const canView = currentUser.role === UserRole.ADMIN || (settings?.rolePermissions?.[currentUser.role]?.canViewMeetings);
    const canCreate = currentUser.role === UserRole.ADMIN || (settings?.rolePermissions?.[currentUser.role]?.canCreateMeeting);
    const canApprove = currentUser.role === UserRole.ADMIN || (settings?.rolePermissions?.[currentUser.role]?.canApproveMeeting);
    const canManage = currentUser.role === UserRole.ADMIN || (settings?.rolePermissions?.[currentUser.role]?.canManageMeetings);

    useEffect(() => {
        if (showModal || viewMeeting) {
            const handleBack = () => {
                if (showModal) setShowModal(false);
                if (viewMeeting) setViewMeeting(null);
            };
            window.dispatchEvent(new CustomEvent('REGISTER_BACK_ACTION', { detail: handleBack }));
        } else {
            window.dispatchEvent(new CustomEvent('UNREGISTER_BACK_ACTION'));
        }
        return () => { window.dispatchEvent(new CustomEvent('UNREGISTER_BACK_ACTION')); };
    }, [showModal, viewMeeting]);

    useEffect(() => {
        if (showModal && meetingForm) {
            setGuestInput((meetingForm.guestAttendees || []).join('، '));
        }
    }, [showModal, meetingForm.id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [m, s, u] = await Promise.all([getMeetings(), getSettings(), getUsers()]);
            setMeetings(Array.isArray(m) ? m : []);
            setSettings(s);
            setUsers(u);
        } catch (error) {
            console.error("Failed to load meetings data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleOpenCreateModal = async () => {
        const nextNum = await getNextMeetingNumber();
        const shamsi = getCurrentShamsiDate();
        
        let initialChairman = '';
        let initialSecretary = '';
        
        const initialAttendees = settings?.defaultMeetingAttendeesData?.length 
            ? settings.defaultMeetingAttendeesData.map(datt => {
                const user = users.find(x => x.username === datt.username);
                if (datt.role === 'رئیس جلسه') initialChairman = user?.fullName || datt.username;
                if (datt.role === 'دبیر جلسه') initialSecretary = user?.fullName || datt.username;
                
                return {
                    username: datt.username,
                    fullName: user?.fullName || datt.username,
                    role: datt.role,
                    isPresent: true
                };
            })
            : [
                { fullName: 'سیّد احمدر ضا احمدی', role: 'مدیر تولید', isPresent: true },
                { fullName: 'زینب محمدیان', role: 'سرپرست کاورینگ و کنترل فرآیند', isPresent: true },
                { fullName: 'رامین شرفی', role: 'سرپرست برق و الکترونیک', isPresent: true },
                { fullName: 'مهسا کیانی', role: 'کنترل کیفی', isPresent: true }
            ];

        setMeetingForm({
            meetingNumber: nextNum,
            date: `${shamsi.year}-${String(shamsi.month).padStart(2, '0')}-${String(shamsi.day).padStart(2, '0')}`,
            time: '12:00',
            location: 'محل دائمی جلسات کارخانه',
            chairman: initialChairman || 'سیّد علی احمدی (مدیر کارخانه)',
            secretary: initialSecretary || 'پریسا مرادی(نت)',
            attendees: initialAttendees,
            guestAttendees: [],
            items: [],
            status: MeetingStatus.DRAFT,
            imageAttachments: [],
            pdfAttachments: []
        });
        setEditingMeeting(null);
        setShowModal(true);
    };

    const handleSendToGroup = async (meetingId: string) => {
        try {
            await sendMeetingMinutes(meetingId);
            alert('صورتجلسه با موفقیت به گروه ارسال شد');
            loadData();
        } catch (error) {
            alert('خطا در ارسال به گروه');
        }
    };

    const handleEditMeeting = (meeting: MeetingMinutes) => {
        setMeetingForm(meeting);
        setEditingMeeting(meeting);
        setShowModal(true);
        setViewMeeting(null);
    };

    const handleSaveMeeting = async () => {
        if (!meetingForm.date || !meetingForm.meetingNumber) {
            alert('لطفا تاریخ و شماره جلسه را وارد کنید.');
            return;
        }

        const meetingData: MeetingMinutes = editingMeeting 
            ? { ...editingMeeting, ...meetingForm as MeetingMinutes, updatedAt: Date.now() }
            : {
                ...meetingForm as MeetingMinutes,
                id: generateUUID(),
                createdAt: Date.now(),
                updatedAt: Date.now(),
                createdBy: currentUser.fullName,
                absentees: [],
                status: MeetingStatus.DRAFT
            };

        try {
            if (editingMeeting) {
                await updateMeeting(meetingData);
            } else {
                await saveMeeting(meetingData);
            }

            // TRIGGER NOTIFICATIONS: If final or pending approval, notify those tagged
            if (meetingData.status !== MeetingStatus.DRAFT) {
                await sendPvNotificationsOnApproval(meetingData);
            }

            setShowModal(false);
            loadData();
        } catch (error) {
            console.error("Save meeting error:", error);
            alert('خطا در ذخیره جلسه');
        }
    };

    const handleDeleteMeeting = async (id: string) => {
        if (!window.confirm('آیا از حذف این صورتجلسه اطمینان دارید؟')) return;
        try {
            await deleteMeeting(id);
            loadData();
        } catch (error) {
            alert('خطا در حذف جلسه');
        }
    };

    const handleAddAttendee = () => {
        setMeetingForm(prev => ({
            ...prev,
            attendees: [...(prev.attendees || []), { fullName: '', role: '', isPresent: true }]
        }));
    };

    const handleRemoveAttendee = (index: number) => {
        setMeetingForm(prev => ({
            ...prev,
            attendees: (prev.attendees || []).filter((_, i) => i !== index)
        }));
    };

    const handleAddItem = () => {
        setMeetingForm(prev => ({
            ...prev,
            items: [...(prev.items || []), { id: generateUUID(), description: '', responsiblePerson: '-', duration: '-' }]
        }));
    };

    const handleRemoveItem = (index: number) => {
        setMeetingForm(prev => ({
            ...prev,
            items: (prev.items || []).filter((_, i) => i !== index)
        }));
    };

    const handleRenameAttachment = async (type: 'image' | 'pdf', index: number) => {
        const currentName = type === 'image' 
            ? meetingForm.imageAttachments?.[index]?.fileName 
            : meetingForm.pdfAttachments?.[index]?.fileName;
        
        const newName = window.prompt('نام جدید فایل را وارد کنید:', currentName);
        if (!newName || newName.trim() === '') return;

        setMeetingForm(prev => {
            const updated = { ...prev };
            if (type === 'image' && updated.imageAttachments) {
                const arr = [...updated.imageAttachments];
                arr[index] = { ...arr[index], fileName: newName.trim() };
                updated.imageAttachments = arr;
            } else if (type === 'pdf' && updated.pdfAttachments) {
                const arr = [...updated.pdfAttachments];
                arr[index] = { ...arr[index], fileName: newName.trim() };
                updated.pdfAttachments = arr;
            }

            if (editingMeeting) {
                const finalMeeting = { ...editingMeeting, ...updated as MeetingMinutes, updatedAt: Date.now() };
                updateMeeting(finalMeeting).then(() => loadData());
            }
            return updated;
        });
    };

    const handleDeleteAttachment = async (type: 'image' | 'pdf', index: number) => {
        if (!window.confirm('آیا از حذف این فایل پیوست اطمینان دارید؟')) return;

        setMeetingForm(prev => {
            const updated = { ...prev };
            if (type === 'image' && updated.imageAttachments) {
                updated.imageAttachments = updated.imageAttachments.filter((_, i) => i !== index);
            } else if (type === 'pdf' && updated.pdfAttachments) {
                updated.pdfAttachments = updated.pdfAttachments.filter((_, i) => i !== index);
            }

            if (editingMeeting) {
                const finalMeeting = { ...editingMeeting, ...updated as MeetingMinutes, updatedAt: Date.now() };
                updateMeeting(finalMeeting).then(() => loadData());
            }
            return updated;
        });
    };

    const handleUploadFiles = async (type: 'image' | 'pdf', files: FileList) => {
        const uploads = await Promise.all(Array.from(files).map(async f => {
            const res = await uploadFileChunked(f, () => {});
            return { fileName: f.name, url: res.url };
        }));

        setMeetingForm(prev => {
            const updated = { ...prev };
            if (type === 'image') {
                updated.imageAttachments = [...(prev.imageAttachments || []), ...uploads];
            } else {
                updated.pdfAttachments = [...(prev.pdfAttachments || []), ...uploads];
            }

            if (editingMeeting) {
                const finalMeeting = { ...editingMeeting, ...updated as MeetingMinutes, updatedAt: Date.now() };
                updateMeeting(finalMeeting).then(() => loadData());
            }
            return updated;
        });
    };

    const handleCeoFinalApprove = async (meeting: MeetingMinutes) => {
        if (!window.confirm('آیا از تایید نهایی و بایگانی این صورتجلسه اطمینان دارید؟')) return;
        try {
            const updated = {
                ...meeting,
                status: MeetingStatus.APPROVED,
                updatedAt: Date.now()
            };
            await updateMeeting(updated);
            try {
                await sendMeetingMinutes(updated.id);
            } catch (err) {
                console.warn('sendMeetingMinutes failed, continuing...', err);
            }
            
            // Send system notification to all attendees
            for (const attendee of updated.attendees) {
                if (attendee.username) {
                    await apiCall('/notifications/add', 'POST', {
                        username: attendee.username,
                        title: `تایید نهایی صورتجلسه ${updated.meetingNumber}`,
                        body: `مدیرعامل صورتجلسه شماره ${updated.meetingNumber} را تایید نهایی و بایگانی کرد.`,
                        url: 'meetings'
                    });
                    await sendMessage({
                        id: generateUUID(),
                        sender: 'system',
                        senderUsername: 'system',
                        role: 'system',
                        message: `✅ تایید نهایی صورتجلسه ${updated.meetingNumber}\n\nباسلام، صورتجلسه شماره ${updated.meetingNumber} توسط مدیرعامل تایید نهایی و بایگانی گردید.\n\nجهت مشاهده به کارتابل صورتجلسات مراجعه فرمایید.`,
                        recipient: attendee.username,
                        timestamp: Date.now()
                    });
                }
            }
            
            setViewMeeting(updated);
            loadData();
            alert('صورتجلسه با موفقیت تایید نهایی و بایگانی شد.');
        } catch (error) {
            console.error("CEO Approval failed", error);
            alert('خطا در تایید نهایی صورتجلسه');
        }
    };

    const handleAddComment = async () => {
        if (!newCommentText.trim() || !viewMeeting) return;
        const comment = {
            id: generateUUID(),
            username: currentUser.username,
            fullName: currentUser.fullName,
            text: newCommentText.trim(),
            timestamp: Date.now()
        };

        const updated = {
            ...viewMeeting,
            comments: [...(viewMeeting.comments || []), comment]
        };

        try {
            await updateMeeting(updated);
            setViewMeeting(updated);
            setNewCommentText('');
            loadData();
        } catch (error) {
            alert('خطا در ثبت نظر');
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!window.confirm('آیا از حذف این نظر اطمینان دارید؟') || !viewMeeting) return;
        const updated = {
            ...viewMeeting,
            comments: (viewMeeting.comments || []).filter(c => c.id !== commentId)
        };
        try {
            await updateMeeting(updated);
            setViewMeeting(updated);
            loadData();
        } catch (error) {
            alert('خطا در حذف نظر');
        }
    };

    const sendPvNotificationsOnApproval = async (m: MeetingMinutes) => {
        const notifiedUsernames = new Map<string, string[]>(); // username -> list of mentioned items
        
        users.forEach(user => {
            const mentions: string[] = [];
            (m.items || []).forEach((item, idx) => {
                const isMentioned = 
                    (item.responsiblePerson || '') === user.fullName || 
                    (item.responsiblePerson || '') === user.username ||
                    (item.description || '').includes(user.fullName) ||
                    (item.description || '').includes(user.username);
                
                if (isMentioned) {
                    mentions.push(`بند ${idx + 1}: ${item.description.substring(0, 50)}...`);
                }
            });
            
            if (mentions.length > 0) {
                notifiedUsernames.set(user.username, mentions);
            }
        });
        
        for (const [username, mentions] of Array.from(notifiedUsernames)) {
            try {
                const mentionText = mentions.join('\n');
                
                // 1. Chat Message
                await sendMessage({ 
                    id: generateUUID(), 
                    sender: 'سیستم', 
                    senderUsername: 'system', 
                    role: 'system', 
                    message: `📌 تگ در صورتجلسه شماره ${m.meetingNumber}\n\nباسلام، شما در موارد زیر از صورتجلسه تگ شده‌اید:\n\n${mentionText}\n\nجهت مشاهده جزئیات کامل به سامانه مراجعه کنید.`, 
                    recipient: username, 
                    timestamp: Date.now() 
                });

                // 2. System Notification
                await apiCall('/notifications/add', 'POST', {
                    username: username,
                    title: `تگ در صورتجلسه ${m.meetingNumber}`,
                    body: `شما در صورتجلسه شماره ${m.meetingNumber} تگ شده‌اید. مسئولیت یا موردی به شما ارجاع شده است.`,
                    url: 'meetings'
                });
            } catch (e) { console.error("PV notification failed", e); }
        }
    };

    const sendApprovalRequests = async (m: MeetingMinutes) => {
        const requiredSigners = m.attendees.filter(a => a.isPresent && a.username);
        for (const signer of requiredSigners) {
            if (!signer.username) continue;
            try {
                await sendMessage({ 
                    id: generateUUID(), 
                    sender: 'system', 
                    senderUsername: 'system', 
                    role: 'system', 
                    message: `✍️ درخواست تایید صورتجلسه\n\nباسلام، صورتجلسه شماره ${m.meetingNumber} در انتظار بررسی و امضای شماست.\n\n📅 تاریخ: ${m.date}\n📍 محل: ${m.location}\n\nلطفا جهت بررسی به کارتابل خود مراجعه فرمایید.`, 
                    recipient: signer.username, 
                    timestamp: Date.now() 
                });
            } catch (e) { console.error(e); }
        }
    };

    const handleStatusChange = async (meeting: MeetingMinutes, newStatus: MeetingStatus) => {
        try {
            const updated = { ...meeting, status: newStatus, updatedAt: Date.now() };
            await updateMeeting(updated);
            
            if (newStatus === MeetingStatus.PENDING_APPROVAL) {
                await sendApprovalRequests(updated);
            }
            if (newStatus === MeetingStatus.APPROVED) {
                await sendMeetingMinutes(meeting.id);
                await sendPvNotificationsOnApproval(updated);
            }
            
            loadData();
        } catch (error) {
            alert('خطا در تغییر وضعیت');
        }
    };

    const handleSignMeeting = async (meeting: MeetingMinutes) => {
        if (!window.confirm('آیا با مفاد این صورتجلسه موافق هستید و مایل به امضای آن می‌باشید؟')) return;
        
        try {
            const approvals = { ...(meeting.approvals || {}) };
            approvals[currentUser.username] = {
                approved: true,
                date: Date.now()
            };
            
            let newStatus = meeting.status;
            
            const requiredSigners = meeting.attendees.filter(a => a.isPresent && a.username);
            const allSigned = requiredSigners.every(a => approvals[a.username!]?.approved);
            
            if (allSigned && requiredSigners.length > 0) {
                newStatus = MeetingStatus.APPROVED;
            }
            
            const updated = { ...meeting, approvals, status: newStatus, updatedAt: Date.now() };
            await updateMeeting(updated);
            
            if (newStatus === MeetingStatus.APPROVED) {
                await sendMeetingMinutes(meeting.id);
                await sendPvNotificationsOnApproval(updated);
                alert('تمامی امضاها تکمیل شد و صورتجلسه نهایی و به گروه تلگرام/سازمانی ارسال شد.');
            } else {
                alert('امضای شما با موفقیت ثبت شد. در انتظار امضای سایر اعضا...');
            }
            
            loadData();
        } catch (error) {
            console.error("Signature error", error);
            alert('خطا در ثبت امضا');
        }
    };

    const handleSendAnnouncement = async (meeting: MeetingMinutes) => {
        if (!window.confirm('آیا از ارسال اعلان برگزاری این جلسه اطمینان دارید؟')) return;
        try {
            await sendMeetingAnnouncement(meeting.id);
            alert('اعلان با موفقیت ارسال شد.');
            loadData();
        } catch (error) {
            alert('خطا در ارسال اعلان');
        }
    };

    const handleSendMinutes = async (meeting: MeetingMinutes) => {
        if (!window.confirm('آیا از ارسال صورتجلسه تایید شده به گروه تولید اطمینان دارید؟')) return;
        try {
            await sendMeetingMinutes(meeting.id);
            alert('صورتجلسه با موفقیت ارسال شد.');
            loadData();
        } catch (error) {
            alert('خطا در ارسال صورتجلسه');
        }
    };

    const pendingMySignatureCount = meetings.filter(m => 
        m.status === MeetingStatus.PENDING_APPROVAL && 
        m.attendees.some(a => a.fullName === currentUser.fullName) && 
        !m.approvals?.[currentUser.username]?.approved
    ).length;

    const filteredMeetings = meetings.filter(meeting => {
        const searchText = searchTerm.toLowerCase();
        const matchesSearch = 
            (meeting.meetingNumber || '').toLowerCase().includes(searchText) || 
            (meeting.chairman || '').toLowerCase().includes(searchText) ||
            (meeting.date || '').includes(searchTerm) ||
            meeting.items.some(item => 
                (item.description || '').toLowerCase().includes(searchText) || 
                (item.responsiblePerson || '').toLowerCase().includes(searchText)
            );
        
        if (activeTab === 'all') return matchesSearch && meeting.status !== MeetingStatus.APPROVED;
        if (activeTab === 'pending') {
            return matchesSearch && meeting.status === MeetingStatus.PENDING_APPROVAL;
        }
        if (activeTab === 'kartable') {
            return matchesSearch && meeting.status === MeetingStatus.PENDING_APPROVAL && 
                   meeting.attendees.some(a => a.username === currentUser.username) &&
                   (!meeting.approvals || !meeting.approvals[currentUser.username]?.approved);
        }
        if (activeTab === 'draft') return matchesSearch && meeting.status === MeetingStatus.DRAFT;
        if (activeTab === 'archive') return matchesSearch && meeting.status === MeetingStatus.APPROVED;
        return matchesSearch;
    }).sort((a, b) => b.createdAt - a.createdAt);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 animate-pulse">
                <Loader2 size={48} className="animate-spin text-blue-500 mb-4" />
                <p className="text-gray-500 font-bold">در حال بارگزاری جلسات...</p>
            </div>
        );
    }

    if (!canView) {
        return (
            <div className="flex flex-col items-center justify-center p-20 bg-white/50 dark:bg-gray-900/30 rounded-[2.5rem] border border-white dark:border-white/5 backdrop-blur-2xl">
                <Lock size={48} className="text-rose-500 mb-4" />
                <h2 className="text-xl font-black text-gray-900 dark:text-gray-100">عدم دسترسی</h2>
                <p className="text-gray-500 font-bold mt-2 text-center text-sm">شما دسترسی لازم برای مشاهده ماژول جلسات تولید را ندارید. <br/> لطفا با مدیر سیستم تماس بگیرید.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/70 dark:bg-gray-900/50 p-6 rounded-[2.5rem] border border-white dark:border-white/5 backdrop-blur-3xl shadow-xl">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl rotate-3 shadow-blue-500/30">
                        <ClipboardList size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">جلسات تولید</h2>
                        <p className="text-[10px] md:text-xs text-gray-400 font-bold mt-0.5">مدیریت و ثبت صورتجلسات کارخانه</p>
                    </div>
                </div>
                
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                    <div className="relative group flex-1 md:flex-none">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="جستجو در جلسات..."
                            className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl pr-10 pl-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 outline-none w-full md:w-64 transition-all font-bold"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {canCreate && (
                        <button
                            onClick={handleOpenCreateModal}
                            className="bg-blue-600 text-white px-6 py-3 md:py-3.5 rounded-2xl flex items-center justify-center gap-2 font-black shadow-lg shadow-blue-600/20 active:scale-95 transition-all hover:bg-blue-700 text-sm"
                        >
                            <Plus size={20} />
                            <span>ثبت جلسه جدید</span>
                        </button>
                    )}
                </div>
            </div>

            {/* List and Tabs */}
            <div className="bg-white/50 dark:bg-gray-900/30 rounded-[2.5rem] border border-white dark:border-white/5 backdrop-blur-2xl overflow-hidden p-4 md:p-6">
                <div className="flex items-center gap-2 mb-6 bg-gray-100/50 dark:bg-black/20 p-1 rounded-2xl w-full overflow-x-auto no-scrollbar scroll-smooth">
                    <button onClick={() => setActiveTab('all')} className={`px-4 md:px-5 py-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all whitespace-nowrap ${activeTab === 'all' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-xl' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}>همه جلسات</button>
                    <button onClick={() => setActiveTab('kartable')} className={`px-4 md:px-5 py-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'kartable' ? 'bg-white dark:bg-gray-800 text-orange-600 shadow-xl' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                        <span>کارتابل امضا</span>
                        {pendingMySignatureCount > 0 && (
                            <span className="flex h-4 w-4 md:h-5 md:w-5 items-center justify-center rounded-full bg-orange-500 text-[9px] md:text-[10px] text-white animate-pulse">
                                {pendingMySignatureCount}
                            </span>
                        )}
                    </button>
                    <button onClick={() => setActiveTab('pending')} className={`px-4 md:px-5 py-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all whitespace-nowrap ${activeTab === 'pending' ? 'bg-white dark:bg-gray-800 text-amber-600 shadow-xl' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}>در انتظار تایید</button>
                    <button onClick={() => setActiveTab('draft')} className={`px-4 md:px-5 py-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all whitespace-nowrap ${activeTab === 'draft' ? 'bg-white dark:bg-gray-800 text-gray-600 shadow-xl' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}>پیش‌نویس</button>
                    <button onClick={() => setActiveTab('archive')} className={`px-4 md:px-5 py-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all whitespace-nowrap ${activeTab === 'archive' ? 'bg-white dark:bg-gray-800 text-emerald-600 shadow-xl' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}>بایگانی</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredMeetings.map(meeting => (
                        <div key={meeting.id} className="group glass-panel border border-white dark:border-white/10 p-5 rounded-3xl hover:shadow-2xl transition-all relative overflow-hidden flex flex-col h-full bg-white/40 dark:bg-gray-800/40">
                             <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 font-black text-xs">
                                        #{meeting.meetingNumber}
                                    </div>
                                    <div>
                                        <div className="font-black text-gray-900 dark:text-gray-100 text-sm tracking-tight">{meeting.date}</div>
                                        <div className="text-[10px] text-gray-400 font-bold">{meeting.time} | {meeting.location}</div>
                                    </div>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-[10px] font-black ${
                                    meeting.status === MeetingStatus.APPROVED ? 'bg-emerald-100 text-emerald-700' :
                                    meeting.status === MeetingStatus.PENDING_APPROVAL ? 'bg-amber-100 text-amber-700' :
                                    meeting.status === MeetingStatus.REJECTED ? 'bg-rose-100 text-rose-700' :
                                    'bg-gray-100 text-gray-600'
                                }`}>
                                    {meeting.status}
                                </div>
                             </div>

                             <div className="space-y-3 flex-1">
                                <div className="p-3 bg-gray-50/50 dark:bg-black/10 rounded-2xl border border-gray-100/50 dark:border-white/5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Users size={14} className="text-gray-400" />
                                        <span className="text-[10px] font-bold text-gray-500">حاضرین جلسه:</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {meeting.attendees.slice(0, 3).map((a, i) => (
                                            <span key={i} className="text-[9px] bg-white dark:bg-gray-700 px-2 py-0.5 rounded-lg border border-gray-200 dark:border-white/5 font-bold text-gray-700 dark:text-gray-300">
                                                {a.fullName}
                                            </span>
                                        ))}
                                        {meeting.attendees.length > 3 && <span className="text-[9px] text-gray-400 font-bold">+{meeting.attendees.length - 3} نفر دیگر</span>}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 px-2">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1.5 text-blue-600">
                                            <CheckSquare size={14} />
                                            <span>{meeting.items.length} مصوبه</span>
                                        </div>
                                        {((meeting.imageAttachments?.length || 0) + (meeting.pdfAttachments?.length || 0)) > 0 && (
                                            <div className="flex items-center gap-1 text-teal-600">
                                                <Paperclip size={14} />
                                                <span>{(meeting.imageAttachments?.length || 0) + (meeting.pdfAttachments?.length || 0)} فایل</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-[10px]">توسط: {meeting.createdBy}</div>
                                </div>
                             </div>

                             <div className="mt-5 pt-4 border-t border-gray-100 dark:border-white/5 flex flex-col gap-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => setViewMeeting(meeting)} className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 rounded-xl transition-colors" title="مشاهده">
                                            <Eye size={18} />
                                        </button>
                                        {((meeting.imageAttachments?.length || 0) + (meeting.pdfAttachments?.length || 0)) > 0 && (
                                            <div className="flex gap-1 border-r border-gray-100 dark:border-white/5 mr-1 pr-1">
                                                {meeting.imageAttachments?.map((att, idx) => (
                                                    <button 
                                                        key={`img-${idx}`} 
                                                        onClick={() => downloadAndOpenFile(att.url, att.fileName)} 
                                                        className="p-2 hover:bg-teal-50 dark:hover:bg-teal-900/20 text-teal-600 rounded-xl transition-colors" 
                                                        title={`مشاهده تصویر: ${att.fileName}`}
                                                    >
                                                        <Image size={18} />
                                                    </button>
                                                ))}
                                                {meeting.pdfAttachments?.map((att, idx) => (
                                                    <button 
                                                        key={`pdf-${idx}`} 
                                                        onClick={() => downloadAndOpenFile(att.url, att.fileName)} 
                                                        className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-600 rounded-xl transition-colors" 
                                                        title={`دریافت فایل PDF: ${att.fileName}`}
                                                    >
                                                        <FileText size={18} />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        <button onClick={() => setShowPrintModal(meeting)} className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 rounded-xl transition-colors" title="دریافت PDF">
                                            <Printer size={18} />
                                        </button>
                                        {canCreate && meeting.status === MeetingStatus.DRAFT && (
                                            <button onClick={() => handleEditMeeting(meeting)} className="p-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 rounded-xl transition-colors" title="ویرایش">
                                                <Edit size={18} />
                                            </button>
                                        )}
                                        {canManage && (
                                            <button onClick={() => handleDeleteMeeting(meeting.id)} className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-600 rounded-xl transition-colors" title="حذف">
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {meeting.status === MeetingStatus.PENDING_APPROVAL && 
                                         meeting.attendees.some(a => a.fullName === currentUser.fullName || a.username === currentUser.username) && 
                                         !meeting.approvals?.[currentUser.username]?.approved && (
                                            <button onClick={() => handleSignMeeting(meeting)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-1.5 animate-pulse">
                                                <UserCheck size={14} />
                                                امضای صورتجلسه
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2 w-full">
                                    {canManage && meeting.status === MeetingStatus.DRAFT && (
                                        <button onClick={() => handleStatusChange(meeting, MeetingStatus.PENDING_APPROVAL)} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5">
                                            <Send size={14} />
                                            ارسال جهت تایید
                                        </button>
                                    )}
                                    {canManage && meeting.status === MeetingStatus.APPROVED && (
                                        <button onClick={() => handleSendToGroup(meeting.id)} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5">
                                            <MessageSquare size={14} />
                                            ارسال به گروه
                                        </button>
                                    )}
                                </div>
                             </div>
                        </div>
                    ))}
                </div>

                {filteredMeetings.length === 0 && (
                    <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                        <AlertCircle size={48} className="mb-4 opacity-20" />
                        <p className="font-bold">هیچ جلسه‌ای یافت نشد.</p>
                    </div>
                )}
            </div>
            
            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
                    <div className="bg-white dark:bg-gray-900 w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-visible flex flex-col border border-white dark:border-white/10">
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-black/20">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl">
                                    {editingMeeting ? <Edit size={20}/> : <PlusCircle size={20}/>}
                                </div>
                                <div>
                                    <h3 className="font-black text-gray-900 dark:text-gray-100 italic tracking-tight">
                                        {editingMeeting ? 'ویرایش صورتجلسه' : 'ثبت صورتجلسه جدید'}
                                    </h3>
                                    <p className="text-[10px] text-gray-400 font-bold">تمام اطلاعات را با دقت وارد کنید</p>
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors">
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                            {/* General Info */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-1.5 focus-within:scale-[1.02] transition-transform">
                                    <label className="text-xs font-black text-gray-500 mr-2 flex items-center gap-1.5"><Calendar size={14} className="text-blue-500" /> شماره جلسه</label>
                                    <input
                                        type="text"
                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                                        value={meetingForm.meetingNumber}
                                        onChange={e => setMeetingForm({...meetingForm, meetingNumber: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1.5 focus-within:scale-[1.02] transition-transform">
                                    <label className="text-xs font-black text-gray-500 mr-2 flex items-center gap-1.5"><Calendar size={14} className="text-blue-500" /> تاریخ برگزاری</label>
                                    <input
                                        type="date"
                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 text-center dir-ltr"
                                        value={meetingForm.date}
                                        onChange={e => setMeetingForm({...meetingForm, date: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1.5 focus-within:scale-[1.02] transition-transform">
                                    <label className="text-xs font-black text-gray-500 mr-2 flex items-center gap-1.5"><Clock size={14} className="text-blue-500" /> ساعت برگزاری</label>
                                    <input
                                        type="time"
                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 text-center dir-ltr"
                                        value={meetingForm.time}
                                        onChange={e => setMeetingForm({...meetingForm, time: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1.5 focus-within:scale-[1.02] transition-transform">
                                    <label className="text-xs font-black text-gray-500 mr-2 flex items-center gap-1.5"><MapPin size={14} className="text-blue-500" /> محل برگزاری</label>
                                    <input
                                        type="text"
                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                                        value={meetingForm.location}
                                        onChange={e => setMeetingForm({...meetingForm, location: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 focus-within:scale-[1.02] transition-transform">
                                    <label className="text-xs font-black text-gray-500 mr-2 flex items-center gap-1.5"><UserCheck size={14} className="text-blue-500" /> رئیس جلسه</label>
                                    <input
                                        type="text"
                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                                        value={meetingForm.chairman}
                                        onChange={e => setMeetingForm({...meetingForm, chairman: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1.5 focus-within:scale-[1.02] transition-transform">
                                    <label className="text-xs font-black text-gray-500 mr-2 flex items-center gap-1.5"><UserCheck size={14} className="text-blue-500" /> دبیر جلسه</label>
                                    <input
                                        type="text"
                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                                        value={meetingForm.secretary}
                                        onChange={e => setMeetingForm({...meetingForm, secretary: e.target.value})}
                                    />
                                </div>
                            </div>

                            {/* Attendees Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-black text-gray-900 dark:text-gray-100 flex items-center gap-2"><Users size={18} className="text-blue-600" /> حاضرین جلسه</label>
                                    <button onClick={handleAddAttendee} className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-100 transition-colors">
                                        <Plus size={14} /> افزودن عضو
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative pb-20">
                                    {meetingForm.attendees?.map((attendee, idx) => (
                                        <div key={idx} className={`flex items-center gap-2 bg-gray-50 dark:bg-black/20 p-2 rounded-2xl border border-gray-100 dark:border-white/5 group shadow-sm relative ${activeAttendeeIndex === idx ? 'z-[100]' : 'z-auto'}`}>
                                            <div className="flex-1 relative">
                                                <input
                                                    type="text"
                                                    placeholder="نام و نام خانوادگی (جستجو...)"
                                                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 rounded-xl text-xs font-bold outline-none"
                                                    value={attendee.fullName}
                                                    onChange={e => {
                                                        const newVal = e.target.value;
                                                        const newAttendees = [...(meetingForm.attendees || [])];
                                                        newAttendees[idx].fullName = newVal;
                                                        setMeetingForm({...meetingForm, attendees: newAttendees});
                                                        
                                                        // Show search results if typing
                                                        if (newVal.length > 1) {
                                                            setActiveAttendeeIndex(idx);
                                                        }
                                                    }}
                                                    onFocus={() => setActiveAttendeeIndex(idx)}
                                                    onBlur={() => { setTimeout(() => setActiveAttendeeIndex(null), 200); }}
                                                />
                                                {attendee.fullName && activeAttendeeIndex === idx && (
                                                    <div className="absolute top-full left-0 right-0 z-[1000] bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl mt-1 max-h-40 overflow-y-auto overflow-x-hidden animate-scale-in flex flex-col">
                                                        {users.filter(u => u.fullName.includes(attendee.fullName) || u.username.includes(attendee.fullName)).map(u => (
                                                            <button
                                                                key={u.id}
                                                                className="w-full p-2 text-right hover:bg-blue-50 dark:hover:bg-blue-900/20 text-[10px] font-bold border-b border-gray-50 dark:border-white/5 last:border-0 truncate"
                                                                onClick={() => {
                                                                    const newAttendees = [...(meetingForm.attendees || [])];
                                                                    const userRole = settings?.defaultMeetingAttendeesData?.find(d => d.username === u.username)?.role || u.role || 'عضو حاضر';
                                                                    
                                                                    newAttendees[idx] = { 
                                                                        fullName: u.fullName, 
                                                                        role: userRole, 
                                                                        isPresent: true,
                                                                        username: u.username 
                                                                    };
                                                                    
                                                                    // Update chairman/secretary if applicable
                                                                    const updates: Partial<MeetingMinutes> = { attendees: newAttendees };
                                                                    if (userRole === 'رئیس جلسه') updates.chairman = u.fullName;
                                                                    if (userRole === 'دبیر جلسه') updates.secretary = u.fullName;
                                                                    
                                                                    setMeetingForm(prev => ({...prev, ...updates}));
                                                                    setActiveAttendeeIndex(null);
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-[10px] text-blue-600 shrink-0">
                                                                        {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover rounded-full" alt={u.fullName}/> : u.fullName.charAt(0)}
                                                                    </div>
                                                                    <div className="flex flex-col text-right truncate">
                                                                        <span className="truncate">{u.fullName}</span>
                                                                        <span className="text-[8px] text-gray-400 font-normal truncate">@{u.username}</span>
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {settings?.meetingRoles && settings.meetingRoles.length > 0 ? (
                                                <select
                                                    className="w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 rounded-xl text-[10px] font-bold outline-none"
                                                    value={attendee.role}
                                                    onChange={e => {
                                                        const newVal = e.target.value;
                                                        const newAttendees = [...(meetingForm.attendees || [])];
                                                        newAttendees[idx].role = newVal;
                                                        
                                                        const updates: Partial<MeetingMinutes> = { attendees: newAttendees };
                                                        if (newVal === 'رئیس جلسه') updates.chairman = attendee.fullName;
                                                        if (newVal === 'دبیر جلسه') updates.secretary = attendee.fullName;
                                                        
                                                        setMeetingForm(prev => ({...prev, ...updates}));
                                                    }}
                                                >
                                                    <option value="">-- سمت --</option>
                                                    {settings.meetingRoles.map(r => <option key={r} value={r}>{r}</option>)}
                                                </select>
                                            ) : (
                                                <input
                                                    type="text"
                                                    placeholder="سمت"
                                                    className="w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 rounded-xl text-xs font-bold outline-none"
                                                    value={attendee.role}
                                                    onChange={e => {
                                                        const newAttendees = [...(meetingForm.attendees || [])];
                                                        newAttendees[idx].role = e.target.value;
                                                        setMeetingForm({...meetingForm, attendees: newAttendees});
                                                    }}
                                                />
                                            )}
                                            <button onClick={() => {
                                                const newAttendees = [...(meetingForm.attendees || [])];
                                                newAttendees[idx].isPresent = !newAttendees[idx].isPresent;
                                                setMeetingForm({...meetingForm, attendees: newAttendees});
                                            }} className={`p-2 rounded-xl transition-all ${attendee.isPresent ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`} title={attendee.isPresent ? 'حاضر' : 'غایب'}>
                                                <UserCheck size={16} />
                                            </button>
                                            <button onClick={() => handleRemoveAttendee(idx)} className="p-2 text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Guest Attendees */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between border-b dark:border-white/10 pb-2">
                                    <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2"><UserCheck size={18} className="text-gray-500" /> مدعوین (بدون نیاز به کاربری)</h3>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <input
                                        type="text"
                                        placeholder="نام مدعوین را بنویسید (با ویرگول یا اسپیس جدا کنید، در صورت مطابقت با کاربران، به لیست حاضرین اضافه می‌شوند)"
                                        className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-3 rounded-2xl text-xs font-bold outline-none focus:bg-white dark:focus:bg-gray-800 transition-all focus:ring-2 ring-gray-200"
                                        value={guestInput}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setGuestInput(val);
                                            
                                            // Parse the names
                                            const names = val.split(/[،,]/).map(v => v.trim()).filter(v => v !== '');
                                            
                                            const remainingGuests: string[] = [];
                                            let currentAttendees = [...(meetingForm.attendees || [])];
                                            let updated = false;
                                            
                                            names.forEach(name => {
                                                const matchedUser = users.find(u => u.fullName.trim() === name.trim());
                                                if (matchedUser) {
                                                    const exists = currentAttendees.some(a => a.username === matchedUser.username || a.fullName === matchedUser.fullName);
                                                    if (!exists) {
                                                        currentAttendees.push({
                                                            username: matchedUser.username,
                                                            fullName: matchedUser.fullName,
                                                            role: matchedUser.role || 'عضو حاضر',
                                                            isPresent: true
                                                        });
                                                        updated = true;
                                                    }
                                                } else {
                                                    remainingGuests.push(name);
                                                }
                                            });
                                            
                                            setMeetingForm(prev => ({
                                                ...prev,
                                                guestAttendees: remainingGuests,
                                                attendees: currentAttendees
                                            }));
                                        }}
                                        onBlur={() => {
                                            setGuestInput((meetingForm.guestAttendees || []).join('، '));
                                        }}
                                    />
                                    <span className="text-[10px] text-gray-500 font-bold pr-2">در صورتی که نام تایپ شده با یکی از کاربران سیستم همخوانی داشته باشد، سیستم وی را به صورت خودکار به لیست حاضرین با حق امضا اضافه می‌کند.</span>
                                </div>
                            </div>

                            {/* Meeting Items / Resolutions */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-black text-gray-900 dark:text-gray-100 flex items-center gap-2"><CheckSquare size={18} className="text-blue-600" /> شرح صورتجلسه و مصوبات</label>
                                    <button onClick={handleAddItem} className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-100 transition-colors">
                                        <Plus size={14} /> افزودن بند جدید
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {meetingForm.items?.map((item, idx) => (
                                        <div key={item.id} className="flex gap-3 bg-gray-50 dark:bg-black/20 p-3 rounded-2xl border border-gray-100 dark:border-white/5 relative group shadow-sm transition-all hover:bg-blue-50/30 dark:hover:bg-blue-900/10">
                                            <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black text-xs shrink-0 mt-1 shadow-md">
                                                {idx + 1}
                                            </div>
                                            <div className="flex-1 space-y-3">
                                                <textarea
                                                    placeholder="شرح مصوبه یا موضوع مطرح شده..."
                                                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-xl text-xs font-bold outline-none resize-none min-h-[60px]"
                                                    value={item.description}
                                                    onChange={e => {
                                                        const newItems = [...(meetingForm.items || [])];
                                                        newItems[idx].description = e.target.value;
                                                        setMeetingForm({...meetingForm, items: newItems});
                                                    }}
                                                />
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="flex items-center gap-2 relative">
                                                        <span className="text-[10px] font-bold text-gray-400 shrink-0">مسئول اجرا:</span>
                                                        <div className="relative flex-1">
                                                            <input
                                                                type="text"
                                                                list={`user-suggestions-${idx}`}
                                                                className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 rounded-lg text-xs font-bold outline-none"
                                                                value={item.responsiblePerson}
                                                                onChange={e => {
                                                                    const newItems = [...(meetingForm.items || [])];
                                                                    newItems[idx].responsiblePerson = e.target.value;
                                                                    setMeetingForm({...meetingForm, items: newItems});
                                                                }}
                                                            />
                                                            <datalist id={`user-suggestions-${idx}`}>
                                                                {users.map(u => (
                                                                    <option key={u.id} value={u.fullName}>
                                                                        {u.role}
                                                                    </option>
                                                                ))}
                                                            </datalist>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold text-gray-400 shrink-0">مدت زمان:</span>
                                                        <input
                                                            type="text"
                                                            className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 rounded-lg text-xs font-bold outline-none"
                                                            value={item.duration}
                                                            onChange={e => {
                                                                const newItems = [...(meetingForm.items || [])];
                                                                newItems[idx].duration = e.target.value;
                                                                setMeetingForm({...meetingForm, items: newItems});
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <button onClick={() => handleRemoveItem(idx)} className="p-2 text-gray-300 hover:text-rose-500 self-start opacity-0 group-hover:opacity-100 transition-all">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    {(!meetingForm.items || meetingForm.items.length === 0) && (
                                        <div className="text-center py-6 border-2 border-dashed border-gray-100 dark:border-white/5 rounded-2xl text-gray-400 text-xs font-bold">
                                            هیچ مصوبه‌ای ثبت نشده است
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {/* Attachments Section */}
                            <div className="space-y-4">
                                <label className="text-sm font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">پیوست‌ها</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50/50 transition-colors relative">
                                        <label className="text-xs font-bold text-gray-500 mb-2 block cursor-pointer">تصاویر (عکس صورتجلسه و ...)</label>
                                        <input type="file" multiple accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={async (e) => {
                                            if (e.target.files && e.target.files.length > 0) {
                                                await handleUploadFiles('image', e.target.files);
                                            }
                                        }} />
                                        <div className="text-[10px] text-gray-400 font-bold">برای انتخاب فایل تصویر کلیک کنید</div>
                                    </div>
                                    <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50/50 transition-colors relative">
                                        <label className="text-xs font-bold text-gray-500 mb-2 block cursor-pointer">فایل‌های PDF</label>
                                        <input type="file" multiple accept=".pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={async (e) => {
                                            if (e.target.files && e.target.files.length > 0) {
                                                await handleUploadFiles('pdf', e.target.files);
                                            }
                                        }} />
                                        <div className="text-[10px] text-gray-400 font-bold">برای انتخاب فایل PDF کلیک کنید</div>
                                    </div>
                                </div>
                                
                                {/* Interactive Attachment List */}
                                <div className="space-y-2 mt-4">
                                    {((meetingForm.imageAttachments || []).length > 0 || (meetingForm.pdfAttachments || []).length > 0) && (
                                        <h4 className="text-xs font-black text-gray-500">فایل‌های پیوست شده:</h4>
                                    )}
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {(meetingForm.imageAttachments || []).map((att, i) => (
                                            <div key={`img-${i}`} className="flex items-center justify-between bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 p-2.5 rounded-xl">
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                    <span className="text-[11px] font-bold text-blue-900 dark:text-blue-200 truncate" title={att.fileName}>{att.fileName}</span>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0 mr-2">
                                                    <button onClick={() => handleRenameAttachment('image', i)} className="text-[10px] font-black text-blue-600 hover:underline px-2 py-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">ویرایش نام</button>
                                                    <button onClick={() => handleDeleteAttachment('image', i)} className="text-[10px] font-black text-rose-600 hover:underline px-2 py-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">حذف</button>
                                                </div>
                                            </div>
                                        ))}
                                        
                                        {(meetingForm.pdfAttachments || []).map((att, i) => (
                                            <div key={`pdf-${i}`} className="flex items-center justify-between bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 p-2.5 rounded-xl">
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                                    <span className="text-[11px] font-bold text-red-900 dark:text-red-200 truncate" title={att.fileName}>{att.fileName}</span>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0 mr-2">
                                                    <button onClick={() => handleRenameAttachment('pdf', i)} className="text-[10px] font-black text-blue-600 hover:underline px-2 py-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">ویرایش نام</button>
                                                    <button onClick={() => handleDeleteAttachment('pdf', i)} className="text-[10px] font-black text-rose-600 hover:underline px-2 py-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">حذف</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/20 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-black text-gray-500 ml-2">وضعیت:</label>
                                <select
                                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                                    value={meetingForm.status}
                                    onChange={e => setMeetingForm({...meetingForm, status: e.target.value as MeetingStatus})}
                                >
                                    {Object.values(MeetingStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-6 py-3 rounded-2xl text-sm font-black text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-800 transition-all"
                                >
                                    انصراف
                                </button>
                                <button
                                    onClick={handleSaveMeeting}
                                    className="px-10 py-3 rounded-2xl text-sm font-black bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2"
                                >
                                    <Save size={18} />
                                    ذخیره صورتجلسه
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* View/Approval Modal */}
            {viewMeeting && (
                <div className="fixed inset-0 z-[100] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
                    <div className="bg-white dark:bg-gray-900 w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white dark:border-white/10">
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-black/20 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-xl">
                                    <Eye size={20}/>
                                </div>
                                <h3 className="font-black text-gray-900 dark:text-gray-100 italic tracking-tight uppercase text-sm md:text-base">صورتجلسه شماره {viewMeeting.meetingNumber}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => { setShowPrintModal(viewMeeting); setViewMeeting(null); }} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors text-blue-600">
                                    <Printer size={20} />
                                </button>
                                <button onClick={() => setViewMeeting(null)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors">
                                    <X size={20} className="text-gray-400" />
                                </button>
                            </div>
                        </div>

                        <div className="p-4 md:p-10 overflow-y-auto flex-1 bg-white dark:bg-gray-950 font-sans print:p-0">
                            {/* Meeting Header Block */}
                            <div className="border-4 border-gray-900 dark:border-gray-100 p-6 relative">
                                <div className="text-center space-y-2 mb-8">
                                    <h1 className="text-2xl font-black">صورتجلسه</h1>
                                    <div className="text-sm font-bold text-gray-600 dark:text-gray-400 italic">گروه تولیدی احمدی</div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm mb-8">
                                    <div className="space-y-1">
                                        <div className="text-gray-400 font-bold text-[10px]">شماره جلسه:</div>
                                        <div className="font-black underline decoration-2 underline-offset-4">{viewMeeting.meetingNumber}</div>
                                    </div>
                                    <div className="space-y-1 text-center">
                                        <div className="text-gray-400 font-bold text-[10px]">تاریخ برگزاری:</div>
                                        <div className="font-black underline decoration-2 underline-offset-4 font-mono">{viewMeeting.date}</div>
                                    </div>
                                    <div className="space-y-1 text-center">
                                        <div className="text-gray-400 font-bold text-[10px]">ساعت برگزاری:</div>
                                        <div className="font-black underline decoration-2 underline-offset-4 font-mono">{viewMeeting.time}</div>
                                    </div>
                                    <div className="space-y-1 text-left">
                                        <div className="text-gray-400 font-bold text-[10px]">محل برگزاری:</div>
                                        <div className="font-black underline decoration-2 underline-offset-4">{viewMeeting.location}</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 pb-8 border-b border-gray-200 dark:border-white/10">
                                    <div className="flex gap-2">
                                        <span className="font-black whitespace-nowrap">رئیس جلسه:</span>
                                        <span className="text-gray-700 dark:text-gray-300 font-bold">{viewMeeting.chairman}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="font-black whitespace-nowrap">دبیر جلسه:</span>
                                        <span className="text-gray-700 dark:text-gray-300 font-bold">{viewMeeting.secretary}</span>
                                    </div>
                                </div>

                                {/* Attendees Tableish */}
                                <div className="mb-10">
                                    <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 font-black text-sm mb-4">اعضای حاضر در جلسه</div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {viewMeeting.attendees.filter(a => a.isPresent).map((a, i) => (
                                            <div key={i} className="flex flex-col border-b border-gray-100 dark:border-white/5 pb-2">
                                                <span className="font-black text-xs">{a.fullName}</span>
                                                <span className="text-[10px] text-gray-500 font-bold">{a.role}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {viewMeeting.guestAttendees && viewMeeting.guestAttendees.length > 0 && (
                                        <div className="mt-4">
                                            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400">مدعوین: </span>
                                            <span className="text-[11px] font-black">{viewMeeting.guestAttendees.join('، ')}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Items Table */}
                                <div className="mb-10">
                                    <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 font-black text-sm mb-4">شرح مصوبات و پیگیری‌ها</div>
                                    <div className="w-full overflow-x-auto">
                                        <table className="w-full border-collapse border border-gray-300 dark:border-gray-700">
                                            <thead>
                                                <tr className="bg-gray-50 dark:bg-black/20 text-xs font-black">
                                                    <th className="border border-gray-300 dark:border-gray-700 p-3 w-12 text-center">ردیف</th>
                                                    <th className="border border-gray-300 dark:border-gray-700 p-3 text-right">شرح موضوع / مصوبه</th>
                                                    <th className="border border-gray-300 dark:border-gray-700 p-3 w-32 text-center">مسئول اجرا</th>
                                                    <th className="border border-gray-300 dark:border-gray-700 p-3 w-24 text-center">مهلت (روز)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-[11px] font-bold">
                                                {viewMeeting.items.map((item, idx) => (
                                                    <tr key={item.id}>
                                                        <td className="border border-gray-300 dark:border-gray-700 p-4 text-center">{idx + 1}</td>
                                                        <td className="border border-gray-300 dark:border-gray-700 p-4 leading-relaxed">{item.description}</td>
                                                        <td className="border border-gray-300 dark:border-gray-700 p-4 text-center">{item.responsiblePerson}</td>
                                                        <td className="border border-gray-300 dark:border-gray-700 p-4 text-center">{item.duration}</td>
                                                    </tr>
                                                ))}
                                                {viewMeeting.items.length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="border border-gray-300 dark:border-gray-700 p-8 text-center text-gray-400 italic">موردی ثبت نشده است</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Approval/Signatures Section */}
                                <div>
                                    <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 font-black text-sm mb-6 uppercase tracking-wider">تایید نهایی و امضاء الکترونیک اعضا</div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                        {viewMeeting.attendees.filter(a => a.isPresent).map((a, i) => {
                                            const approvalKey = a.username || a.fullName;
                                            const isApproved = viewMeeting.approvals?.[approvalKey]?.approved;
                                            return (
                                                <div key={i} className="flex flex-col items-center gap-3 p-4 border border-dashed border-gray-200 dark:border-white/10 rounded-2xl bg-gray-50/30 dark:bg-black/5 relative overflow-hidden group">
                                                    <span className="font-black text-[9px] text-gray-400 group-hover:text-gray-600 transition-colors uppercase tracking-tight">{a.role}</span>
                                                    <div className="h-16 flex items-center justify-center italic font-black text-blue-900 dark:text-blue-200 opacity-80 scale-110">
                                                        {isApproved ? (
                                                            <div className="flex flex-col items-center animate-bounce-subtle">
                                                                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-1 border border-emerald-500">
                                                                    <CheckCircle size={28} />
                                                                </div>
                                                                <div className="text-[8px] text-emerald-600 font-black">تایید شده</div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-gray-300 dark:text-gray-700 flex flex-col items-center opacity-40">
                                                                <Loader2 size={32} className="animate-spin mb-1 opacity-20" />
                                                                <span className="text-[8px] font-black">در انتظار تایید</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="font-black text-xs z-10 text-center">{a.fullName}</span>
                                                    
                                                    {/* Approval Overlay for current user if they are the attendee */}
                                                    {(a.username === currentUser.username || a.fullName === currentUser.fullName) && !isApproved && canApprove && (
                                                        <button 
                                                            onClick={async () => {
                                                                const updated = {
                                                                    ...viewMeeting,
                                                                    approvals: {
                                                                        ...(viewMeeting.approvals || {}),
                                                                        [approvalKey]: { approved: true, date: Date.now() }
                                                                    }
                                                                };
                                                                // If all attendees have approved, set status to PENDING_CEO
                                                                const attendeesToApprove = viewMeeting.attendees.filter(at => at.isPresent && (at.username || at.fullName)).length;
                                                                const currentApprovalsCount = Object.keys(updated.approvals || {}).length;
                                                                
                                                                if (currentApprovalsCount >= attendeesToApprove) {
                                                                    updated.status = MeetingStatus.PENDING_CEO;
                                                                    // Notify CEO users
                                                                    const ceoUsers = users.filter(u => u.role === UserRole.CEO || u.role === 'ceo');
                                                                    for (const ceo of ceoUsers) {
                                                                        try {
                                                                            await apiCall('/notifications/add', 'POST', {
                                                                                username: ceo.username,
                                                                                title: `درخواست تایید نهایی صورتجلسه ${updated.meetingNumber}`,
                                                                                body: `تمامی اعضا صورتجلسه شماره ${updated.meetingNumber} را امضاء کرده‌اند. این صورتجلسه هم‌اکنون منتظر تایید نهایی و بایگانی توسط شماست.`,
                                                                                url: 'meetings'
                                                                            });
                                                                        } catch (err) {
                                                                            console.warn('Failed to add CEO notification', err);
                                                                        }
                                                                    }
                                                                } else {
                                                                    updated.status = MeetingStatus.PENDING_APPROVAL;
                                                                }
                                                                
                                                                try {
                                                                    await updateMeeting(updated);
                                                                    setViewMeeting(updated);
                                                                    loadData();
                                                                } catch (error) {
                                                                    alert('خطا در تایید صورتجلسه');
                                                                }
                                                            }}
                                                            className="absolute inset-0 bg-blue-600/90 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all font-black cursor-pointer"
                                                        >
                                                            <CheckCircle size={32} className="mb-2" />
                                                            <span className="text-[10px]">تایید صورتجلسه</span>
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                
                                {((viewMeeting.imageAttachments && viewMeeting.imageAttachments.length > 0) || (viewMeeting.pdfAttachments && viewMeeting.pdfAttachments.length > 0) || ((viewMeeting as any).attachments && (viewMeeting as any).attachments.length > 0)) && (
                                    <div className="mt-8 pt-6 border-t border-gray-100 dark:border-white/5">
                                        <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                                            <Paperclip size={20} className="text-amber-500" /> فایل‌های پیوست صورتجلسه
                                        </h3>
                                        <div className="flex flex-wrap gap-3">
                                            {viewMeeting.imageAttachments?.map((att, i) => (
                                                <button key={`img-${i}`} onClick={() => downloadAndOpenFile(att.url, att.fileName)} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-xl flex items-center gap-3 hover:border-blue-300 dark:hover:border-blue-700 transition-colors shadow-sm">
                                                    <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/40 rounded-lg flex items-center justify-center text-blue-600">
                                                        <Image size={20} />
                                                    </div>
                                                    <div className="flex flex-col items-start gap-1">
                                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 max-w-[150px] truncate" dir="ltr">{att.fileName}</span>
                                                        <span className="text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">مشاهده تصویر</span>
                                                    </div>
                                                </button>
                                            ))}
                                            {viewMeeting.pdfAttachments?.map((att, i) => (
                                                <button key={`pdf-${i}`} onClick={() => downloadAndOpenFile(att.url, att.fileName)} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-xl flex items-center gap-3 hover:border-red-300 dark:hover:border-red-700 transition-colors shadow-sm">
                                                    <div className="w-10 h-10 bg-red-50 dark:bg-red-900/40 rounded-lg flex items-center justify-center text-red-600">
                                                        <FileText size={20} />
                                                    </div>
                                                    <div className="flex flex-col items-start gap-1">
                                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 max-w-[150px] truncate" dir="ltr">{att.fileName}</span>
                                                        <span className="text-[10px] text-red-600 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded">دانلود PDF</span>
                                                    </div>
                                                </button>
                                            ))}
                                            {(viewMeeting as any).attachments?.map((att: any, i: number) => (
                                                <button key={`leg-${i}`} onClick={() => downloadAndOpenFile(att.url || att.data, att.fileName)} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-xl flex items-center gap-3 hover:border-gray-300 dark:hover:border-gray-700 transition-colors shadow-sm">
                                                    <div className="w-10 h-10 bg-gray-50 dark:bg-gray-900/40 rounded-lg flex items-center justify-center text-gray-600">
                                                        <Paperclip size={20} />
                                                    </div>
                                                    <div className="flex flex-col items-start gap-1">
                                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 max-w-[150px] truncate" dir="ltr">{att.fileName}</span>
                                                        <span className="text-[10px] text-gray-600 bg-gray-50 dark:bg-gray-900/30 px-2 py-0.5 rounded">دریافت فایل (نسخه قدیم)</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Comments and Discussion Section */}
                                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-white/5">
                                    <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                                        <MessageSquare size={20} className="text-blue-500" /> نظرات و گفتگو پیرامون صورتجلسه
                                    </h3>
                                    
                                    {/* Comments List */}
                                    <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2">
                                        {(!viewMeeting.comments || viewMeeting.comments.length === 0) ? (
                                            <div className="text-center py-6 text-gray-400 text-xs font-bold bg-gray-50/50 dark:bg-black/5 rounded-2xl border border-dashed border-gray-100 dark:border-white/5">
                                                نظری برای این صورتجلسه ثبت نشده است. اولین نظر را شما بنویسید!
                                            </div>
                                        ) : (
                                            viewMeeting.comments.map((c) => (
                                                <div key={c.id} className="bg-gray-50 dark:bg-black/20 p-3.5 rounded-2xl border border-gray-100 dark:border-white/5 flex gap-3 relative group">
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center font-black text-xs shrink-0">
                                                        {c.fullName.charAt(0)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="font-black text-xs text-gray-800 dark:text-gray-200">{c.fullName}</span>
                                                            <span className="text-[9px] text-gray-400 font-bold font-mono">
                                                                {new Date(c.timestamp).toLocaleDateString('fa-IR')} | {new Date(c.timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-medium break-words">{c.text}</p>
                                                    </div>
                                                    
                                                    {/* Trash button for creator of comment or admin */}
                                                    {(c.username === currentUser.username || currentUser.role === UserRole.ADMIN) && (
                                                        <button 
                                                            onClick={() => handleDeleteComment(c.id)}
                                                            className="absolute top-2 left-2 p-1 text-gray-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* New Comment Form */}
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="دیدگاه یا پیام خود را بنویسید..."
                                            className="flex-1 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-2xl text-xs font-bold outline-none focus:bg-white dark:focus:bg-gray-800 transition-all focus:ring-2 ring-blue-100"
                                            value={newCommentText}
                                            onChange={e => setNewCommentText(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    handleAddComment();
                                                }
                                            }}
                                        />
                                        <button
                                            onClick={handleAddComment}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
                                        >
                                            <Send size={14} /> ثبت نظر
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/20 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                            <div className="flex gap-3 w-full sm:w-auto">
                                {viewMeeting.status === MeetingStatus.DRAFT && (
                                    <button onClick={() => handleSendAnnouncement(viewMeeting)} className="flex-1 sm:flex-none px-5 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] md:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
                                        <Send size={18} /> ارسال اعلان برگزاری
                                    </button>
                                )}
                                {viewMeeting.status === MeetingStatus.PENDING_CEO && (currentUser.role === UserRole.CEO || currentUser.role === 'ceo' || currentUser.role === UserRole.ADMIN) && (
                                    <button onClick={() => handleCeoFinalApprove(viewMeeting)} className="flex-1 sm:flex-none px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl text-[10px] md:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
                                        <CheckCircle size={18} /> تایید نهایی و بایگانی مدیرعامل
                                    </button>
                                )}
                                {viewMeeting.status === MeetingStatus.APPROVED && (
                                    <button onClick={() => handleSendMinutes(viewMeeting)} className="flex-1 sm:flex-none px-5 py-3 bg-blue-600 text-white rounded-2xl text-[10px] md:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                                        <MessageSquare size={18} /> ارسال به گروه تولید
                                    </button>
                                )}
                            </div>
                            <div className="w-full sm:w-auto">
                                <button onClick={() => setViewMeeting(null)} className="w-full sm:w-auto px-8 py-3 rounded-2xl text-xs font-black bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 transition-all active:scale-95">بستن پنجره</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {showPrintModal && <PrintMeeting meeting={showPrintModal} onClose={() => setShowPrintModal(null)} />}
        </div>
    );
};

export default MeetingModule;
