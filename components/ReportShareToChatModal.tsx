import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Search, 
  Users, 
  User as UserIcon, 
  Send, 
  Paperclip, 
  CheckCircle2, 
  Loader2, 
  MessageSquare, 
  FileText,
  Check,
  Building2,
  Filter,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { generateUUID } from '../constants';
import { getUsers, getCurrentUser } from '../services/authService';
import { getGroups, sendMessage, uploadFileChunked } from '../services/storageService';
import { generatePdfFromHtml } from '../utils/pdfGenerator';
import { ChatGroup, ChatMessage, User } from '../types';

export type TrazScope = 'both' | 'bed' | 'bes';

interface ReportShareToChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: 'traz' | 'sales' | 'production' | 'cheques' | 'statement' | 'general' | 'custom';
  reportTitle?: string;
  dateRange?: { from?: string; to?: string };
  dateRangeText?: string;
  onGenerateReport: (scope: TrazScope) => Promise<{
    htmlContent?: string;
    blob?: Blob;
    pdfFilename: string;
    defaultMsg: string;
    prebuiltUrl?: string;
  }>;
  initialScope?: TrazScope;
}

export const ReportShareToChatModal: React.FC<ReportShareToChatModalProps> = ({
  isOpen,
  onClose,
  reportType,
  reportTitle = 'ارسال گزارش به گفتگو',
  dateRange,
  dateRangeText,
  onGenerateReport,
  initialScope = 'both'
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'users' | 'groups'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [scope, setScope] = useState<TrazScope>(initialScope);
  const [customMessage, setCustomMessage] = useState('');
  const [isUpdatingMessage, setIsUpdatingMessage] = useState(false);
  const [showNoteEditor, setShowNoteEditor] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [sendingTargetId, setSendingTargetId] = useState<string | null>(null);
  const [successTargetIds, setSuccessTargetIds] = useState<Set<string>>(new Set());

  // Cache generated attachments per scope so multiple sends don't re-render or re-upload
  const attachmentCacheRef = useRef<Record<string, { fileName: string; url: string; defaultMsg: string }>>({});

  const currentUser = getCurrentUser();

  // Reset and load users & groups on open
  useEffect(() => {
    if (!isOpen) return;

    attachmentCacheRef.current = {};
    setSuccessTargetIds(new Set());
    setSendingTargetId(null);
    setSearchQuery('');
    setScope(initialScope);
    setShowNoteEditor(false);

    const loadData = async () => {
      setLoadingData(true);
      try {
        const [usersData, groupsData] = await Promise.all([
          getUsers(),
          getGroups()
        ]);
        setUsers(usersData.filter(u => u.username !== currentUser?.username));
        setGroups(groupsData);
      } catch (err) {
        console.error('Error loading contacts and groups:', err);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [isOpen, initialScope]);

  // Update default message when scope changes
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsUpdatingMessage(true);

    const updateDefaultText = async () => {
      try {
        // If cached, use cached message
        if (attachmentCacheRef.current[scope]) {
          if (isMounted) setCustomMessage(attachmentCacheRef.current[scope].defaultMsg);
          return;
        }

        // Preview default text quickly
        const res = await onGenerateReport(scope);
        if (isMounted && res.defaultMsg) {
          setCustomMessage(res.defaultMsg);
        }
      } catch (err) {
        console.error('Error preloading message:', err);
      } finally {
        if (isMounted) setIsUpdatingMessage(false);
      }
    };

    updateDefaultText();

    return () => {
      isMounted = false;
    };
  }, [isOpen, scope, onGenerateReport]);

  if (!isOpen) return null;

  const formattedDateRange = dateRangeText || (dateRange?.from || dateRange?.to ? `${dateRange.from || 'ابتدا'} تا ${dateRange.to || 'امروز'}` : undefined);

  const getOrGenerateAttachment = async (currentScope: TrazScope) => {
    if (attachmentCacheRef.current[currentScope]) {
      return attachmentCacheRef.current[currentScope];
    }

    const reportRes = await onGenerateReport(currentScope);

    let finalUrl = reportRes.prebuiltUrl;
    let finalFileName = reportRes.pdfFilename;

    if (!finalUrl) {
      let pdfBlob = reportRes.blob;
      if (!pdfBlob && reportRes.htmlContent) {
        pdfBlob = await generatePdfFromHtml(reportRes.htmlContent, reportRes.pdfFilename) as Blob;
      }

      if (!pdfBlob) {
        throw new Error('تولید فایل PDF ناموفق بود.');
      }

      const file = new File([pdfBlob], reportRes.pdfFilename, { type: 'application/pdf' });
      const uploadRes = await uploadFileChunked(file, () => {});
      finalUrl = uploadRes.url;
      finalFileName = uploadRes.fileName || reportRes.pdfFilename;
    }

    const cached = {
      fileName: finalFileName,
      url: finalUrl,
      defaultMsg: reportRes.defaultMsg
    };

    attachmentCacheRef.current[currentScope] = cached;
    return cached;
  };

  const handleSend = async (target: { id: string; name: string; username?: string; isGroup: boolean }) => {
    if (!currentUser) {
      toast.error('ابتدا وارد حساب کاربری خود شوید.');
      return;
    }

    setSendingTargetId(target.id);
    const toastId = toast.loading(`در حال آماده‌سازی و ارسال گزارش به ${target.name}...`);

    try {
      const attachment = await getOrGenerateAttachment(scope);

      const messageText = customMessage.trim() || attachment.defaultMsg || `گزارش ارسالی: ${attachment.fileName}`;

      const newMsg: ChatMessage = {
        id: generateUUID(),
        sender: currentUser.fullName,
        senderUsername: currentUser.username,
        role: currentUser.role || '',
        message: messageText,
        timestamp: Date.now(),
        recipient: target.isGroup ? undefined : target.username,
        groupId: target.isGroup ? target.id : undefined,
        attachment: { fileName: attachment.fileName, url: attachment.url },
        readBy: [currentUser.username],
        isPending: false
      };

      await sendMessage(newMsg);

      setSuccessTargetIds(prev => new Set(prev).add(target.id));
      toast.success(`گزارش با موفقیت به ${target.name} ارسال شد`, { id: toastId });
    } catch (err: any) {
      console.error('Send to chat error:', err);
      toast.error('خطا در ارسال: ' + (err?.message || 'مشکلی رخ داد'), { id: toastId });
    } finally {
      setSendingTargetId(null);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (u.username || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter(g => 
    (g.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-hidden" 
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col h-[90vh] sm:h-[620px] max-h-[94vh] overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 className="font-black text-xs sm:text-sm tracking-tight text-white">{reportTitle}</h3>
              {formattedDateRange && (
                <p className="text-[10px] text-slate-300 mt-0.5">بازه زمانی: {formattedDateRange}</p>
              )}
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Section 1: Scope Selection (for Traz or Multi-variant Reports) */}
        {reportType === 'traz' && (
          <div className="p-2.5 sm:p-3 bg-blue-50/80 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900/50 shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                <Filter size={13} className="text-blue-600 dark:text-blue-400" />
                محدوده حساب‌های ارسالی در PDF:
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-200/60 dark:bg-blue-800/60 text-blue-900 dark:text-blue-100">
                {scope === 'both' ? 'هر دو گروه' : (scope === 'bed' ? 'فقط بدهکاران' : 'فقط بستانکاران')}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setScope('both')}
                className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 min-h-[38px] ${
                  scope === 'both'
                    ? 'bg-blue-600 text-white shadow-md font-black ring-2 ring-blue-400/40'
                    : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 border border-slate-200 dark:border-zinc-700'
                }`}
              >
                <span>👥 هر دو گروه</span>
              </button>

              <button
                type="button"
                onClick={() => setScope('bed')}
                className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 min-h-[38px] ${
                  scope === 'bed'
                    ? 'bg-rose-600 text-white shadow-md font-black ring-2 ring-rose-400/40'
                    : 'bg-white dark:bg-zinc-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 border border-slate-200 dark:border-zinc-700'
                }`}
              >
                <span>🔴 فقط بدهکاران</span>
              </button>

              <button
                type="button"
                onClick={() => setScope('bes')}
                className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 min-h-[38px] ${
                  scope === 'bes'
                    ? 'bg-emerald-600 text-white shadow-md font-black ring-2 ring-emerald-400/40'
                    : 'bg-white dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 border border-slate-200 dark:border-zinc-700'
                }`}
              >
                <span>🟢 فقط بستانکاران</span>
              </button>
            </div>
          </div>
        )}

        {/* Section 2: Compact Caption / Note */}
        <div className="px-3 py-2 bg-slate-50 dark:bg-zinc-950/40 border-b border-slate-100 dark:border-zinc-800 shrink-0">
          <button
            type="button"
            onClick={() => setShowNoteEditor(!showNoteEditor)}
            className="w-full flex items-center justify-between text-slate-600 dark:text-slate-300 hover:text-blue-600 text-[11px] font-bold py-0.5 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Paperclip size={12} className="text-blue-500" />
              <span>متن توضیحات همراه سند PDF</span>
              {isUpdatingMessage && (
                <span className="text-[9px] text-blue-500 flex items-center gap-1 font-normal mr-1">
                  <Loader2 size={10} className="animate-spin" />
                  به‌روزرسانی خودکار...
                </span>
              )}
            </span>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
              {showNoteEditor ? 'بستن ویرایشگر' : 'مشاهده / ویرایش متن'}
              {showNoteEditor ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </span>
          </button>

          {showNoteEditor && (
            <div className="mt-2 space-y-1 animate-in fade-in duration-150">
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="یادداشتی همراه با این سند برای گیرنده بنویسید..."
                rows={2}
                className="w-full text-xs p-2 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none font-sans"
              />
            </div>
          )}
        </div>

        {/* Section 3: Search & Recipient Tabs */}
        <div className="p-2.5 sm:p-3 border-b border-slate-100 dark:border-zinc-800 space-y-2 shrink-0 bg-white dark:bg-zinc-900">
          <div className="relative">
            <Search className="absolute right-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="جستجوی همکار یا گروه گفتگو..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-3 py-1.5 text-xs border border-slate-200 dark:border-zinc-700 rounded-xl bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-1 bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'all' 
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span>همه ({users.length + groups.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'users' 
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <UserIcon size={13} />
              <span>افراد ({users.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('groups')}
              className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'groups' 
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Users size={13} />
              <span>گروه‌ها ({groups.length})</span>
            </button>
          </div>
        </div>

        {/* Section 4: Target List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-slate-50 dark:divide-zinc-800/60 custom-scrollbar">
          {loadingData ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
              <Loader2 size={24} className="animate-spin text-blue-600" />
              <span className="text-xs">در حال بارگذاری مخاطبین و گروه‌ها...</span>
            </div>
          ) : (
            <>
              {/* Groups List */}
              {(activeTab === 'all' || activeTab === 'groups') && filteredGroups.map((group) => {
                const isSending = sendingTargetId === group.id;
                const isSent = successTargetIds.has(group.id);

                return (
                  <div 
                    key={`group-${group.id}`} 
                    className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-zinc-800/50 rounded-xl transition-colors gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800/40">
                        <Users size={16} />
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                          <span>{group.name}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-normal">گروه</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                          {group.members?.length || 0} عضو
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSend({ id: group.id, name: group.name, isGroup: true })}
                      disabled={isSending}
                      className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer min-h-[36px] ${
                        isSent 
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-black'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs active:scale-95 disabled:opacity-50'
                      }`}
                    >
                      {isSending ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>ارسال...</span>
                        </>
                      ) : isSent ? (
                        <>
                          <Check size={13} className="text-emerald-600 stroke-[3]" />
                          <span>ارسال شد</span>
                        </>
                      ) : (
                        <>
                          <Send size={12} />
                          <span>ارسال به گروه</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}

              {/* Users List */}
              {(activeTab === 'all' || activeTab === 'users') && filteredUsers.map((user) => {
                const isSending = sendingTargetId === user.id;
                const isSent = successTargetIds.has(user.id);

                return (
                  <div 
                    key={`user-${user.id}`} 
                    className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-zinc-800/50 rounded-xl transition-colors gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-800/40 font-bold text-xs">
                        {user.fullName?.charAt(0) || user.username?.charAt(0) || 'U'}
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                          {user.fullName || user.username}
                        </div>
                        <span className="text-[10px] text-slate-400 block truncate font-mono mt-0.5">
                          @{user.username} {user.role ? `• ${user.role}` : ''}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSend({ id: user.id, name: user.fullName || user.username, username: user.username, isGroup: false })}
                      disabled={isSending}
                      className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer min-h-[36px] ${
                        isSent 
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-black'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs active:scale-95 disabled:opacity-50'
                      }`}
                    >
                      {isSending ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>ارسال...</span>
                        </>
                      ) : isSent ? (
                        <>
                          <Check size={13} className="text-emerald-600 stroke-[3]" />
                          <span>ارسال شد</span>
                        </>
                      ) : (
                        <>
                          <Send size={12} />
                          <span>ارسال</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}

              {/* Empty state */}
              {((activeTab === 'groups' && filteredGroups.length === 0) ||
                (activeTab === 'users' && filteredUsers.length === 0) ||
                (activeTab === 'all' && filteredUsers.length === 0 && filteredGroups.length === 0)) && (
                <div className="text-center py-12 text-slate-400 space-y-1">
                  <p className="text-xs font-bold">مخاطب یا گروهی با این نام یافت نشد</p>
                  <p className="text-[11px]">نام شخص یا عنوان گروه دیگری را جستجو نمایید</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/60 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            فایل PDF گزارش مستقیماً در تاریخچه چت ثبت می‌گردد.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-xl transition-all cursor-pointer shrink-0"
          >
            بستن
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
