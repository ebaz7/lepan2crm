import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Search, 
  Users, 
  User as UserIcon, 
  Send, 
  Paperclip, 
  CheckCircle, 
  Loader2, 
  MessageSquare, 
  Shield 
} from 'lucide-react';
import { generateUUID } from '../constants';
import { getUsers, getCurrentUser } from '../services/authService';
import { getGroups, sendMessage } from '../services/storageService';
import { ChatGroup, ChatMessage, User } from '../types';

interface SendToChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  attachment?: { fileName: string; url: string };
  defaultMessage?: string;
  title?: string;
  onGoToChat?: (target: { type: 'private' | 'group' | 'task_group' | 'system', id: string }) => void;
}

export const SendToChatModal: React.FC<SendToChatModalProps> = ({
  isOpen,
  onClose,
  attachment,
  defaultMessage = '',
  title = 'ارسال از طریق گفتگو',
  onGoToChat
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'groups'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [customMessage, setCustomMessage] = useState(defaultMessage);
  
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  
  const currentUser = getCurrentUser();

  useEffect(() => {
    if (!isOpen) return;
    
    const loadData = async () => {
      setLoading(true);
      try {
        const [usersData, groupsData] = await Promise.all([
          getUsers(),
          getGroups()
        ]);
        // Filter out admin/current user if needed, but let's keep all except the current user themselves
        setUsers(usersData.filter(u => u.username !== currentUser?.username));
        setGroups(groupsData);
      } catch (err) {
        console.error('Error loading contacts and groups:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
    setCustomMessage(defaultMessage);
    setSuccessId(null);
    setSendingId(null);
  }, [isOpen, defaultMessage]);

  if (!isOpen) return null;

  const handleSend = async (target: { id: string; username?: string; isGroup: boolean }) => {
    if (!currentUser) return;
    
    const targetId = target.id;
    setSendingId(targetId);
    
    try {
      const messageText = customMessage.trim() || (attachment ? `فایل ضمیمه: ${attachment.fileName}` : 'گزارش ارسال شده');
      
      const newMsg: ChatMessage = {
        id: generateUUID(),
        sender: currentUser.fullName,
        senderUsername: currentUser.username,
        role: currentUser.role || '',
        message: messageText,
        timestamp: Date.now(),
        recipient: target.isGroup ? undefined : target.username,
        groupId: target.isGroup ? targetId : undefined,
        attachment: attachment ? { fileName: attachment.fileName, url: attachment.url } : undefined,
        readBy: [currentUser.username],
        isPending: false
      };

      const serverMessages = await sendMessage(newMsg);
      
      // Instantly update local cache and broadcast chat update event
      try {
        const msgsToSave = Array.isArray(serverMessages) && serverMessages.length > 0 ? serverMessages : (() => {
          const current = JSON.parse(localStorage.getItem('app_data_chat') || '[]');
          return [...current, newMsg];
        })();
        localStorage.setItem('app_data_chat', JSON.stringify(msgsToSave));
        window.dispatchEvent(new CustomEvent('chat_updated', { detail: { message: newMsg, allMessages: msgsToSave } }));
      } catch (e) {
        console.warn('Failed to update local chat cache:', e);
      }
      
      setSuccessId(targetId);
      setTimeout(() => {
        setSuccessId(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('خطا در ارسال پیام به گفتگو');
    } finally {
      setSendingId(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-hidden select-text" 
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col h-[90vh] sm:h-[600px] max-h-[94vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <MessageSquare className="text-blue-600 dark:text-blue-400" size={20} />
            <h3 className="font-bold text-gray-800 dark:text-gray-100">{title}</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Details */}
        <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border-b border-gray-100 dark:border-zinc-800 space-y-3">
          {attachment && (
            <div className="flex items-center gap-2 text-xs text-blue-800 dark:text-blue-300 bg-blue-100/50 dark:bg-blue-900/30 p-2.5 rounded-xl border border-blue-200/50">
              <Paperclip size={14} className="shrink-0 text-blue-600" />
              <span className="font-semibold text-right truncate flex-1">{attachment.fileName}</span>
            </div>
          )}
          
          <div>
            <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 block mb-1">توضیح یا یادداشت پیام (اختیاری):</label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="یادداشتی همراه با این سند بنویسید..."
              className="w-full text-xs p-2 border border-gray-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 h-16 resize-none"
            />
          </div>
        </div>

        {/* Search & Tabs */}
        <div className="p-4 border-b border-gray-100 dark:border-zinc-800 space-y-3">
          <div className="relative">
            <Search className="absolute right-3 top-2.5 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="جستجو در گفتگوها..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-3 py-2 text-xs border border-gray-200 dark:border-zinc-800 rounded-xl bg-gray-50 dark:bg-zinc-950 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-1 bg-gray-100 dark:bg-zinc-950 p-1 rounded-xl">
            <button
              onClick={() => { setActiveTab('users'); setSearchQuery(''); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'users' 
                  ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <UserIcon size={14} />
              <span>افراد (گفتگوی شخصی)</span>
            </button>
            <button
              onClick={() => { setActiveTab('groups'); setSearchQuery(''); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'groups' 
                  ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Users size={14} />
              <span>گروه‌ها و کانال‌ها</span>
            </button>
          </div>
        </div>

        {/* List of Targets */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <Loader2 className="animate-spin text-blue-600" size={24} />
              <span className="text-xs">در حال بارگذاری لیست...</span>
            </div>
          ) : activeTab === 'users' ? (
            filteredUsers.length === 0 ? (
              <div className="text-center text-xs text-gray-400 py-10">کاربری یافت نشد.</div>
            ) : (
              filteredUsers.map((user) => {
                const isSending = sendingId === user.id;
                const isSuccess = successId === user.id;
                return (
                  <div key={user.id} className="flex items-center justify-between p-2.5 hover:bg-gray-50 dark:hover:bg-zinc-800/50 rounded-xl transition-all border border-transparent hover:border-gray-100 dark:hover:border-zinc-800">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-500 dark:text-gray-300">
                        {user.avatar ? (
                          <img src={user.avatar} className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <UserIcon size={18} />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-800 dark:text-gray-200">{user.fullName}</div>
                        <div className="text-[10px] text-gray-400">@{user.username}</div>
                      </div>
                    </div>
                    
                    {isSuccess ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400">
                          <CheckCircle size={13} />
                          <span>ارسال شد</span>
                        </span>
                        {onGoToChat && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onGoToChat({ type: 'private', id: user.username });
                            }}
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                          >
                            <span>مشاهده</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        disabled={isSending}
                        onClick={() => handleSend({ id: user.id, username: user.username, isGroup: false })}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow disabled:opacity-50"
                      >
                        {isSending ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Send size={12} className="rotate-180" />
                        )}
                        <span>ارسال</span>
                      </button>
                    )}
                  </div>
                );
              })
            )
          ) : (
            filteredGroups.length === 0 ? (
              <div className="text-center text-xs text-gray-400 py-10">گروهی یافت نشد.</div>
            ) : (
              filteredGroups.map((group) => {
                const isSending = sendingId === group.id;
                const isSuccess = successId === group.id;
                return (
                  <div key={group.id} className="flex items-center justify-between p-2.5 hover:bg-gray-50 dark:hover:bg-zinc-800/50 rounded-xl transition-all border border-transparent hover:border-gray-100 dark:hover:border-zinc-800">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <Users size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-800 dark:text-gray-200">{group.name}</div>
                        <div className="text-[10px] text-gray-400">{group.members?.length || 0} عضو</div>
                      </div>
                    </div>
                    
                    {isSuccess ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400">
                          <CheckCircle size={13} />
                          <span>ارسال شد</span>
                        </span>
                        {onGoToChat && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onGoToChat({ type: 'group', id: group.id });
                            }}
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                          >
                            <span>مشاهده</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        disabled={isSending}
                        onClick={() => handleSend({ id: group.id, isGroup: true })}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow disabled:opacity-50"
                      >
                        {isSending ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Send size={12} className="rotate-180" />
                        )}
                        <span>ارسال</span>
                      </button>
                    )}
                  </div>
                );
              })
            )
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 text-[10px] text-center text-gray-400">
          پیام به گفتگوهای داخلی نرم‌افزار ارسال خواهد شد.
        </div>
      </div>
    </div>,
    document.body
  );
};
