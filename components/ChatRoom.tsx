
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, ChatMessage, ChatGroup, GroupTask, UserRole } from '../types';
import { sendMessage, deleteMessage, getGroups, createGroup, updateGroup, deleteGroup, getTasks, createTask, updateTask, deleteTask, uploadFile, uploadFileChunked, updateMessage, getTaskGroups, createTaskGroup, updateTaskGroup, deleteTaskGroup } from '../services/storageService';
import { getUsers } from '../services/authService';
import { generateUUID, formatDate } from '../constants';
import { TaskGroup } from '../types';
import { 
    Send, User as UserIcon, MessageSquare, Users, Plus, ListTodo, Paperclip, 
    CheckSquare, Square, X, Trash2, Reply, Edit2, ArrowRight, Mic, 
    Play, Pause, Loader2, Search, MoreVertical, File, Image as ImageIcon,
    Check, CheckCheck, DownloadCloud, StopCircle, Share2, Copy, Forward, Eye, CornerUpLeft, Bell,
    Shield, UserMinus, UserPlus, BellOff, Camera, Clock, MessageCircle, RefreshCw
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { sendNotification, clearAllActiveNotifications } from '../services/notificationService';
import { downloadAndOpenFile, checkFileExists } from '../services/fileService';
import { resolveImageUrl } from '../services/apiService';

interface ChatRoomProps { 
    currentUser: User | null; 
    preloadedMessages: ChatMessage[]; 
    onRefresh: () => void; 
    sharedData?: { fileUrl?: string; text?: string; title?: string } | null;
    onClearSharedData?: () => void;
    onMessagesRead?: (msgIds: string[]) => void;
    directChatTarget?: { type: 'private' | 'group' | 'public' | 'task_group', id: string, taskId?: string } | null;
    onClearDirectChatTarget?: () => void;
}

type TabType = 'ALL' | 'CHATS' | 'GROUPS' | 'TASKS';

interface ChannelItem {
    type: 'public' | 'private' | 'group' | 'task_group';
    id: string;
    name: string;
    avatar: string | null;
    isOnline: boolean;
    lastSeen?: number;
    lastMsg: ChatMessage | null;
    unread: number;
}

const AudioPlayer: React.FC<{ url: string; isMe: boolean; duration?: number }> = ({ url, isMe, duration: propDuration }) => {
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(propDuration || 0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [audioSource, setAudioSource] = useState('');
    
    // Generate random waveform bars (stable per instance)
    const waveform = useMemo(() => Array.from({ length: 25 }, () => Math.floor(Math.random() * 60) + 20), []);

    useEffect(() => {
        let absoluteUrl = url.startsWith('blob:') || url.startsWith('data:') ? url : resolveImageUrl(url);
        // Capacitor hack: if on Android and using localhost, we might need to ensure it's fully qualified
        if (Capacitor.getPlatform() === 'android' && absoluteUrl.startsWith('/')) {
            absoluteUrl = window.location.origin + absoluteUrl;
        }
        setAudioSource(absoluteUrl);
    }, [url]);

    const onLoadedMetadata = () => {
        const audio = audioRef.current;
        if (!audio) return;
        const d = audio.duration;
        if (d && d !== Infinity && !isNaN(d)) {
            setDuration(d);
        }
    };

    const onTimeUpdate = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (audio.duration && audio.duration !== Infinity) {
            setProgress((audio.currentTime / audio.duration) * 100);
        } else if (duration > 0) {
             setProgress((audio.currentTime / duration) * 100);
        }
    };

    const onEnded = () => { 
        setPlaying(false); 
        setProgress(0); 
    };
    
    const onError = (e: any) => {
        console.error("Audio Playback Error:", e);
    };

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (playing) {
            audioRef.current.pause();
            setPlaying(false);
        } else {
            audioRef.current.play().then(() => {
                setPlaying(true);
            }).catch(err => {
                console.error("Play failed", err);
                // On Android, sometimes play() fails if not fully loaded
                setTimeout(() => {
                   audioRef.current?.play().then(() => setPlaying(true)).catch(console.error);
                }, 200);
            });
        }
    };

    const formatTime = (time: number) => {
        if (isNaN(time) || time === Infinity) return '0:00';
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    return (
        <div className="flex items-center gap-3 flex-1 px-1">
            <audio 
                ref={audioRef}
                src={audioSource}
                onLoadedMetadata={onLoadedMetadata}
                onTimeUpdate={onTimeUpdate}
                onEnded={onEnded}
                onError={onError}
                preload="metadata"
                className="hidden"
            />
            <button 
                onClick={togglePlay}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition-transform active:scale-90 shadow-sm ${isMe ? 'bg-green-600' : 'bg-blue-600'}`}
            >
                {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
            </button>
            
            {/* Waveform Visualization */}
            <div className="flex items-center gap-[2px] h-8 flex-1 mx-2" dir="ltr">
                {waveform.map((height, i) => {
                    const barPercent = (i / waveform.length) * 100;
                    const isPlayed = barPercent <= progress;
                    return (
                        <div 
                            key={i}
                            className={`w-[3px] rounded-full transition-colors duration-200 ${isPlayed ? (isMe ? 'bg-green-700' : 'bg-blue-700') : (isMe ? 'bg-green-300/50' : 'bg-blue-300/50')}`}
                            style={{ height: `${height}%` }}
                        />
                    );
                })}
            </div>

            <span className="text-[10px] font-mono opacity-80 min-w-[35px] text-right">
                {playing ? formatTime(audioRef.current?.currentTime || 0) : formatTime(duration)}
            </span>
        </div>
    );
};

const ChatRoom: React.FC<ChatRoomProps> = ({ currentUser, preloadedMessages, onRefresh, sharedData, onClearSharedData, onMessagesRead, directChatTarget, onClearDirectChatTarget }) => {
    // --- Data State ---
    const [messages, setMessages] = useState<ChatMessage[]>(Array.isArray(preloadedMessages) ? preloadedMessages : []);
    const [pendingMessages, setPendingMessages] = useState<ChatMessage[]>([]);
    const [downloadedFiles, setDownloadedFiles] = useState<Record<string, boolean>>(() => {
        try {
            const item = localStorage.getItem('chat_downloaded_files');
            return item ? JSON.parse(item) : {};
        } catch { return {}; }
    });
    
    // Merge remote and local pending messages
    const displayMessages = useMemo(() => {
        const safeMessages = Array.isArray(messages) ? messages : [];
        const safePending = Array.isArray(pendingMessages) ? pendingMessages : [];
        const remoteIds = new Set(safeMessages.map(m => m.id));
        const filteredPending = safePending.filter(pm => !remoteIds.has(pm.id));
        return [...safeMessages, ...filteredPending].sort((a, b) => a.timestamp - b.timestamp);
    }, [messages, pendingMessages]);

    const [users, setUsers] = useState<User[]>(() => {
        try {
            const item = localStorage.getItem('app_data_users');
            return item ? JSON.parse(item) : [];
        } catch { return []; }
    });
    const [groups, setGroups] = useState<ChatGroup[]>(() => {
        try {
            const item = localStorage.getItem('app_data_groups');
            return item ? JSON.parse(item) : [];
        } catch { return []; }
    });
    const [tasks, setTasks] = useState<GroupTask[]>(() => {
        try {
            const item = localStorage.getItem('app_data_tasks');
            return item ? JSON.parse(item) : [];
        } catch { return []; }
    });
    const [taskGroups, setTaskGroups] = useState<TaskGroup[]>(() => {
        try {
            const item = localStorage.getItem('app_data_task_groups');
            return item ? JSON.parse(item) : [];
        } catch { return []; }
    });
    
    // --- UI State ---
    const [activeTab, setActiveTab] = useState<TabType>('ALL');
    const [activeChannel, setActiveChannel] = useState<{type: 'public' | 'private' | 'group' | 'task_group', id: string | null} | null>(null);
    const [searchTerm, setSearchTerm] = useState(''); // Main List Search
    const [innerSearchTerm, setInnerSearchTerm] = useState(''); // Inside Chat Search
    const [showInnerSearch, setShowInnerSearch] = useState(false);
    
    const notifiedMessageIdsRef = useRef<Set<string>>(new Set());
    const pendingTaskIdRef = useRef<string | null>(null);

    // Initialize the ref with existing messages so they don't trigger new notifications on mount
    useEffect(() => {
        if (messages.length > 0 && notifiedMessageIdsRef.current.size === 0) {
            messages.forEach(m => notifiedMessageIdsRef.current.add(m.id));
        }
    }, [messages]);

    // Check URL parameters for direct Chat Navigation on first load
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const pvUser = params.get('pv');
        const groupUser = params.get('group');
        if (pvUser) {
            setActiveTab('CHATS');
            setActiveChannel({ type: 'private', id: pvUser });
            window.history.replaceState({}, '', window.location.pathname);
        } else if (groupUser) {
            setActiveTab('CHATS');
            setActiveChannel({ type: 'group', id: groupUser });
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    // Handle directChatTarget updates dynamically
    useEffect(() => {
        if (directChatTarget && directChatTarget.id) {
            console.log("ChatRoom: Received directChatTarget", directChatTarget);
            if (directChatTarget.type === 'task_group') {
                setActiveTab('TASKS');
            } else if (directChatTarget.type === 'group') {
                setActiveTab('GROUPS');
            } else {
                setActiveTab('CHATS');
            }
            
            setActiveChannel({ type: directChatTarget.type as 'private' | 'group' | 'public' | 'task_group', id: directChatTarget.id });
            
            if (directChatTarget.taskId) {
                pendingTaskIdRef.current = directChatTarget.taskId;
                const foundTask = tasks.find(t => t.id === directChatTarget.taskId);
                if (foundTask) {
                    setActiveTaskForDetail(foundTask);
                    setTaskReplyText('');
                    pendingTaskIdRef.current = null;
                }
            }

            if (onClearDirectChatTarget) {
                onClearDirectChatTarget();
            }
        }
    }, [directChatTarget, onClearDirectChatTarget, tasks]);

    // Handle lazy-resolving pending task ID when tasks array loads/updates
    useEffect(() => {
        if (pendingTaskIdRef.current && tasks.length > 0) {
            const foundTask = tasks.find(t => t.id === pendingTaskIdRef.current);
            if (foundTask) {
                setActiveTaskForDetail(foundTask);
                setTaskReplyText('');
                pendingTaskIdRef.current = null;
            }
        }
    }, [tasks]);
    
    // --- File Progress & Management ---
    const [fileProgress, setFileProgress] = useState<{ [key: string]: number }>({});
    const [showGroupInfo, setShowGroupInfo] = useState<ChatGroup | (TaskGroup & {isTaskGroup?: boolean, admins?: string[], avatar?: string | null}) | null>(null);
    const [showContactInfo, setShowContactInfo] = useState<User | null>(null);
    const [isDownloading, setIsDownloading] = useState<{ [key: string]: boolean }>({});
    
    // Check if files are downloaded
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;
        const checkDownloads = async () => {
            const checks: Record<string, boolean> = {};
            let hasChanges = false;
            for (const msg of displayMessages) {
                if (msg.attachment && msg.attachment.fileName) {
                    const fileName = msg.attachment.fileName || 'file';
                    const uniqueLocalName = `${msg.id}_${fileName}`;
                    const exists = await checkFileExists(uniqueLocalName);
                    checks[msg.id] = exists;
                    if (downloadedFiles[msg.id] !== exists) hasChanges = true;
                }
            }
            if (hasChanges) {
                setDownloadedFiles(prev => {
                    const updated = { ...prev, ...checks };
                    try {
                        localStorage.setItem('chat_downloaded_files', JSON.stringify(updated));
                    } catch (e) { console.error(e); }
                    return updated;
                });
            }
        };
        checkDownloads();
    }, [displayMessages]);
    
    // --- Selection & Actions ---
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
    const [showForwardModal, setShowForwardModal] = useState(false);
    const [forwardNoQuote, setForwardNoQuote] = useState(false);
    const [showImageViewer, setShowImageViewer] = useState<string | null>(null);
    const [contextMenuMsg, setContextMenuMsg] = useState<{msg: ChatMessage, x: number, y: number} | null>(null);

    // --- Input & Recording ---
    const [inputText, setInputText] = useState('');
    const [localSharedData, setLocalSharedData] = useState<{ fileUrl?: string; text?: string; title?: string } | null>(null);

    useEffect(() => {
        if (sharedData) {
            setLocalSharedData({
                fileUrl: sharedData.fileUrl,
                text: sharedData.text,
                title: sharedData.title
            });
            if (sharedData.text) {
                setInputText(sharedData.text);
            }
            if (onClearSharedData) onClearSharedData();
        }
    }, [sharedData]);

    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<any>(null);
    const recordedMimeTypeRef = useRef<string>('');
    const recordingStartTimeRef = useRef<number>(0);

    const handleCopyMessage = (msg: ChatMessage) => {
        const textToCopy = msg.message || (msg.attachment ? msg.attachment.fileName : 'فایل');
        if (!textToCopy) return;

        const doCopy = async () => {
            try {
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(textToCopy);
                    alert('متن پیام کپی شد');
                } else {
                    throw new Error();
                }
            } catch (err) {
                const textArea = document.createElement("textarea");
                textArea.value = textToCopy;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                    alert('متن پیام کپی شد');
                } catch (e) {
                    console.error('Copy failed', e);
                }
                document.body.removeChild(textArea);
            }
        };
        doCopy();
    };

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // --- Refs ---
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const inputAreaRef = useRef<HTMLTextAreaElement>(null);
    const taskTitleInputRef = useRef<HTMLInputElement>(null);

    // --- Modals ---
    const [showGroupModal, setShowGroupModal] = useState<string | false>(false);
    const [mutedChannels, setMutedChannels] = useState<Set<string>>(new Set());
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);

    // Task Custom Modals State
    const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
    const [taskTitle, setTaskTitle] = useState('');
    const [taskDescription, setTaskDescription] = useState('');
    const [taskAssignedTo, setTaskAssignedTo] = useState<string[]>([]);
    const [taskDueDate, setTaskDueDate] = useState('');
    const [activeTaskForDetail, setActiveTaskForDetail] = useState<GroupTask | null>(null);
    const [taskReplyText, setTaskReplyText] = useState('');
    const [userSearchText, setUserSearchText] = useState('');

    useEffect(() => {
        if (!inputText && inputAreaRef.current) {
            inputAreaRef.current.style.height = 'auto';
        }
    }, [inputText]);

    // Focus task title input immediately when creation modal opens
    useEffect(() => {
        if (showCreateTaskModal) {
            const timer = setTimeout(() => {
                taskTitleInputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showCreateTaskModal]);

    // --- Effects ---
    useEffect(() => { 
        if (Array.isArray(preloadedMessages)) {
            setMessages(prev => {
                // If the messages are identical (check last message and length), avoid unnecessary update
                if (prev.length === preloadedMessages.length && prev.length > 0) {
                    const lastPrev = prev[prev.length - 1];
                    const lastNew = preloadedMessages[preloadedMessages.length - 1];
                    // Also check for edits if possible, but for simplicity we rely on timestamp/id
                    if (lastPrev.id === lastNew.id && lastPrev.timestamp === lastNew.timestamp) {
                        // Check if counts or some other property changed in existing messages
                        return preloadedMessages; 
                    }
                }
                return preloadedMessages;
            });
            // Clean up pending messages that are now on server
            const remoteIds = new Set(preloadedMessages.map(m => m.id));
            setPendingMessages(prev => {
                if (!Array.isArray(prev) || prev.length === 0) return [];
                const filtered = prev.filter(pm => !remoteIds.has(pm.id));
                return filtered;
            });
        }
    }, [preloadedMessages]);

    useEffect(() => { 
        loadMeta();
        const interval = setInterval(loadMeta, 5000); 
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        // Auto scroll with timeout to ensure rendering is done (Fix for Desktop)
        if (activeChannel && !showInnerSearch) {
            // Immediate scroll for better UX
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
            }
            // Follow up with smooth scroll to catch any layout shifts
            setTimeout(scrollToBottom, 150); 
            
            // Auto-mark as read when inside the active conversation
            if (activeChannel.id) {
                markAsRead(activeChannel.id, activeChannel.type);
            }
        }
    }, [activeChannel, messages.length]);

    // Handle Mobile Back Button Logic (Browser History)
    useEffect(() => {
        if (activeChannel) {
            // Push a state so "Back" button closes chat instead of exiting app
            try {
                const state = { chatOpen: true };
                window.history.pushState(state, '', window.location.pathname + (window.location.hash.includes('#chat') ? '' : '#chat'));
                
                const handlePopState = (event: PopStateEvent) => {
                    if (!event.state?.chatOpen) {
                        setActiveChannel(null);
                    }
                };
    
                window.addEventListener('popstate', handlePopState);
                return () => {
                    window.removeEventListener('popstate', handlePopState);
                };
            } catch (e) {
                console.warn("History push failed", e);
            }
        }
    }, [activeChannel]);

    useEffect(() => {
        if (activeChannel) {
            const handleBack = () => {
                 setActiveChannel(null);
            };
            window.dispatchEvent(new CustomEvent('REGISTER_BACK_ACTION', { detail: handleBack }));
        } else {
            window.dispatchEvent(new CustomEvent('UNREGISTER_BACK_ACTION'));
        }
        return () => {
            window.dispatchEvent(new CustomEvent('UNREGISTER_BACK_ACTION'));
        };
    }, [activeChannel]);

    // Handle Document Visibility for Notifications
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) return;
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    // Notification Trigger
    useEffect(() => {
        if (messages.length === 0 || !currentUser) return;

        // Find genuinely new messages that have not been registered in notifiedMessageIdsRef
        const newMessages = messages.filter(m => !notifiedMessageIdsRef.current.has(m.id));

        // Mark them as processed instantly
        newMessages.forEach(m => notifiedMessageIdsRef.current.add(m.id));

        // If the window is hidden, process the last newly arrived message
        const lastNewMsg = newMessages[newMessages.length - 1];
        if (lastNewMsg && lastNewMsg.senderUsername !== currentUser.username && document.hidden) {
            const channelId = lastNewMsg.groupId || lastNewMsg.senderUsername;
            
            // Validate if message is intended for the current user
            const isPublic = !lastNewMsg.groupId && (!lastNewMsg.recipient || lastNewMsg.recipient.trim() === '');
            const isGroupForMe = lastNewMsg.groupId && groups.some(g => g.id === lastNewMsg.groupId);
            const isPrivateForMe = lastNewMsg.recipient && lastNewMsg.recipient.trim() !== '' && lastNewMsg.recipient === currentUser.username;
            const isIntendedForMe = isPublic || isGroupForMe || isPrivateForMe;

            if (!mutedChannels.has(channelId) && isIntendedForMe) {
                let title = lastNewMsg.sender;
                if (lastNewMsg.groupId) {
                    const grp = groups.find(g => g.id === lastNewMsg.groupId);
                    if (grp) title = `${lastNewMsg.sender} @ ${grp.name}`;
                }
                
                let bodyText = 'پیام جدید';
                if (lastNewMsg.message && lastNewMsg.message.trim() !== '') {
                    bodyText = lastNewMsg.message;
                } else if (lastNewMsg.attachment) {
                    bodyText = `📎 فایل ضمیمه: ${lastNewMsg.attachment.fileName || 'بدون نام'}`;
                } else if (lastNewMsg.audioUrl) {
                    bodyText = `🎤 پیام صوتی ${lastNewMsg.audioDuration ? `(${lastNewMsg.audioDuration} ثانیه)` : ''}`;
                }
                
                const targetUrl = lastNewMsg.groupId 
                    ? `/chat?group=${lastNewMsg.groupId}` 
                    : `/chat?pv=${lastNewMsg.senderUsername}`;
                
                // Pass precise unique message ID to allow reliable deduplication on client and native platforms
                sendNotification(title, bodyText, { id: lastNewMsg.id, url: targetUrl, tab: 'chat' });
            }
        }
    }, [messages, mutedChannels, groups, currentUser]);

    const loadMeta = async () => {
        try {
            console.log("ChatRoom: Starting loadMeta");
            const [usrList, grpList, taskGps, tskList] = await Promise.all([
                getUsers(),
                getGroups(),
                getTaskGroups(),
                getTasks()
            ]);
            console.log("ChatRoom: Meta preloads loaded in parallel");
            
            setUsers(usrList);
            
            const isManager = [UserRole.ADMIN, UserRole.MANAGER, UserRole.CEO].includes(currentUser.role as UserRole);
            const visibleGroups = grpList.filter(g => isManager || g.members.includes(currentUser.username) || g.createdBy === currentUser.username);
            setGroups(visibleGroups);

            const visibleTaskGps = taskGps.filter(g => isManager || g.members.includes(currentUser.username) || g.createdBy === currentUser.username);
            setTaskGroups(visibleTaskGps);
            
            setTasks(tskList);
        } catch (e) { 
            console.error("Chat load error", e); 
        }
    };

    const formatLastSeen = (timestamp: number | undefined) => {
        if (!timestamp) return 'نامشخص';
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) return 'همین الان';
        if (diff < 3600000) return `لحظاتی پیش (${Math.floor(diff/60000)} دقیقه)`;
        
        const date = new Date(timestamp);
        if (diff < 86400000) {
            return `امروز ساعت ${date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`;
        }
        
        // Over 24 hours: Shamsi Date + Time
        const shamsiDate = date.toLocaleDateString('fa-IR-u-nu-latn');
        const shamsiTime = date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
        return `${shamsiDate} ساعت ${shamsiTime}`;
    };

    // --- Helpers ---
    const getUnreadCount = (channelId: string, type: 'private' | 'group' | 'public' | 'task_group') => {
        return messages.filter(m => {
            if (m.senderUsername === currentUser.username) return false;
            const isRead = m.readBy?.includes(currentUser.username);
            if (isRead) return false;
            
            if (type === 'private') {
                return (m.senderUsername === channelId && m.recipient === currentUser.username);
            } else if (type === 'group' || type === 'task_group') {
                return m.groupId === channelId;
            }
            return false;
        }).length;
    };

    const getLastMessage = (channelId: string, type: 'private' | 'group' | 'public' | 'task_group') => {
        const relevant = displayMessages.filter(m => {
            if (type === 'public') return !m.recipient && !m.groupId;
            if (type === 'private') return (m.senderUsername === channelId && m.recipient === currentUser.username) || (m.senderUsername === currentUser.username && m.recipient === channelId);
            if (type === 'group' || type === 'task_group') return m.groupId === channelId;
            return false;
        });
        return relevant.length > 0 ? relevant[relevant.length - 1] : null;
    };

    const markAsRead = async (channelId: string, type: 'private' | 'group' | 'public' | 'task_group') => {
        const unreadMsgs = messages.filter(m => {
            if (m.senderUsername === currentUser.username) return false;
            if (m.readBy?.includes(currentUser.username)) return false;
            
            if (type === 'public') return !m.recipient && !m.groupId;
            if (type === 'private') return (m.senderUsername === channelId && m.recipient === currentUser.username);
            if (type === 'group' || type === 'task_group') return m.groupId === channelId;
            return false;
        });

        // Whenever any chat is read, clear any status-bar notifications instantly
        clearAllActiveNotifications().catch(console.error);

        if (unreadMsgs.length > 0) {
            const updatedIds = new Set(unreadMsgs.map(m => m.id));
            setMessages(prev => prev.map(m => updatedIds.has(m.id) ? { ...m, readBy: [...(m.readBy || []), currentUser.username] } : m));
            
            if (onMessagesRead) {
                onMessagesRead(unreadMsgs.map(m => m.id));
            }

            for (const msg of unreadMsgs) {
                const reads = msg.readBy || [];
                if (!reads.includes(currentUser.username)) {
                    await updateMessage({ ...msg, readBy: [...reads, currentUser.username] });
                }
            }
        }
    };

    // --- Render Logic ---
    const getAllChannelsForForward = (): ChannelItem[] => {
        const list: ChannelItem[] = [];
        
        list.push({ type: 'public', id: 'public', name: 'کانال عمومی', avatar: null, isOnline: true, lastMsg: null, unread: 0 });
        
        users.forEach(u => {
            if (currentUser && u.username === currentUser.username) return;
            list.push({ type: 'private', id: u.username, name: u.fullName, avatar: resolveImageUrl(u.avatar), isOnline: false, lastMsg: null, unread: 0 });
        });
        
        groups.forEach(g => {
            list.push({ type: 'group', id: g.id, name: g.name, avatar: g.avatar || null, isOnline: false, lastMsg: null, unread: 0 });
        });

        taskGroups.forEach(tg => {
            list.push({ type: 'task_group', id: tg.id, name: tg.name, avatar: tg.avatar || null, isOnline: false, lastMsg: null, unread: 0 });
        });
        
        return list;
    };

    const getSortedChannels = (): ChannelItem[] => {
        const list: ChannelItem[] = [];
        const term = searchTerm.toLowerCase().trim();

        if (activeTab === 'ALL') {
            // 1. Public Channel
            const lastPub = getLastMessage('public', 'public');
            list.push({
                type: 'public', id: 'public', name: 'کانال عمومی', 
                avatar: null, isOnline: true, 
                lastMsg: lastPub, unread: getUnreadCount('public', 'public')
            });

            // 2. Groups (with avatars)
            groups.forEach(g => {
                const last = getLastMessage(g.id, 'group');
                const isMember = g.members.includes(currentUser.username) || g.createdBy === currentUser.username;
                if (isMember || last || term) {
                    list.push({
                        type: 'group', id: g.id, name: g.name,
                        avatar: g.avatar || null, isOnline: false,
                        lastMsg: last, unread: getUnreadCount(g.id, 'group')
                    });
                }
            });

            // 3. Task Groups (with avatars)
            taskGroups.forEach(g => {
                const last = getLastMessage(g.id, 'task_group');
                const isMember = g.members.includes(currentUser.username) || g.createdBy === currentUser.username;
                if (isMember || last || term) {
                    list.push({
                        type: 'task_group', id: g.id, name: g.name,
                        avatar: g.avatar || null, isOnline: false,
                        lastMsg: last, unread: getUnreadCount(g.id, 'task_group')
                    });
                }
            });

            // 4. Private chats
            users.forEach(u => {
                if (currentUser && u.username === currentUser.username) return;
                const last = getLastMessage(u.username, 'private');
                const isOnline = u.lastSeen ? (Date.now() - u.lastSeen) < 5 * 60 * 1000 : false;
                
                if (last || term) {
                    list.push({
                        type: 'private', id: u.username, name: u.fullName,
                        avatar: u.avatar || null, isOnline, lastSeen: u.lastSeen,
                        lastMsg: last, unread: getUnreadCount(u.username, 'private')
                    });
                }
            });

            // If empty, add some users for accessibility
            if (list.length <= 1 && !term) {
                 users.slice(0, 10).forEach(u => {
                     if (currentUser && u.username === currentUser.username) return;
                     if (!list.find(i => i.id === u.username)) {
                          list.push({
                             type: 'private', id: u.username, name: u.fullName,
                             avatar: u.avatar || null, isOnline: false,
                             lastMsg: null, unread: 0
                          });
                     }
                 });
            }
        } else if (activeTab === 'CHATS') {
            const lastPub = getLastMessage('public', 'public');
            list.push({
                type: 'public', id: 'public', name: 'کانال عمومی', 
                avatar: null, isOnline: true, 
                lastMsg: lastPub, unread: getUnreadCount('public', 'public')
            });

            // Include ALL groups that I am a member of or created
            groups.forEach(g => {
                const last = getLastMessage(g.id, 'group');
                const isMember = g.members.includes(currentUser.username) || g.createdBy === currentUser.username;
                if (isMember || last || term) {
                    list.push({
                        type: 'group', id: g.id, name: g.name,
                        avatar: g.avatar || null, isOnline: false,
                        lastMsg: last, unread: getUnreadCount(g.id, 'group')
                    });
                }
            });

            // Include task groups too if they have messages or match search
            taskGroups.forEach(g => {
                const last = getLastMessage(g.id, 'task_group');
                const isMember = g.members.includes(currentUser.username) || g.createdBy === currentUser.username;
                if (last || (isMember && term)) {
                    list.push({
                        type: 'task_group', id: g.id, name: g.name,
                        avatar: g.avatar || null, isOnline: false,
                        lastMsg: last, unread: getUnreadCount(g.id, 'task_group')
                    });
                }
            });

            // Include users with messages OR all users if looking at CHATS tab and no filters
            users.forEach(u => {
                if (currentUser && u.username === currentUser.username) return;
                const last = getLastMessage(u.username, 'private');
                const isOnline = u.lastSeen ? (Date.now() - u.lastSeen) < 5 * 60 * 1000 : false;
                
                // Show users if they have a message OR if searching
                if (last || term) {
                    list.push({
                        type: 'private', id: u.username, name: u.fullName,
                        avatar: resolveImageUrl(u.avatar), isOnline, lastSeen: u.lastSeen,
                        lastMsg: last, unread: getUnreadCount(u.username, 'private')
                    });
                }
            });

            // If list is still very empty (just Public), add some frequent users or just all users for accessibility
            if (list.length <= 1 && !term) {
                 users.slice(0, 10).forEach(u => {
                     if (currentUser && u.username === currentUser.username) return;
                     if (!list.find(i => i.id === u.username)) {
                         list.push({
                            type: 'private', id: u.username, name: u.fullName,
                            avatar: resolveImageUrl(u.avatar), isOnline: false,
                            lastMsg: null, unread: 0
                         });
                     }
                 });
            }
        } else if (activeTab === 'GROUPS') {
            groups.forEach(g => {
                const last = getLastMessage(g.id, 'group');
                list.push({
                    type: 'group', id: g.id, name: g.name,
                    avatar: g.avatar || null, isOnline: false,
                    lastMsg: last, unread: getUnreadCount(g.id, 'group')
                });
            });
        } else if (activeTab === 'TASKS') {
            taskGroups.forEach(g => {
                const last = getLastMessage(g.id, 'task_group');
                list.push({
                    type: 'task_group', id: g.id, name: g.name,
                    avatar: g.avatar || null, isOnline: false,
                    lastMsg: last, unread: getUnreadCount(g.id, 'task_group')
                });
            });
        }

        return list.filter(item => item.name.toLowerCase().includes(term)).sort((a, b) => {
            const timeA = a.lastMsg?.timestamp || 0;
            const timeB = b.lastMsg?.timestamp || 0;
            if (timeA || timeB) return timeB - timeA;
            return a.name.localeCompare(b.name);
        });
    };

    // --- Actions ---
    const handleSendMessage = async () => {
        if ((!inputText.trim() && !localSharedData?.fileUrl) || isUploading) return;

        if (editingMessageId) {
            const msgToUpdate = displayMessages.find(m => m.id === editingMessageId);
            if (msgToUpdate) {
                try {
                    await updateMessage({ ...msgToUpdate, message: inputText, isEdited: true });
                    setEditingMessageId(null);
                    setInputText('');
                    onRefresh();
                } catch(e: any) { alert("خطا در ویرایش پیام"); }
            }
            return;
        }

        const newMsgId = generateUUID();
        const hasLocalFile = !!localSharedData?.fileUrl;

        const newMsg: ChatMessage = {
            id: newMsgId,
            sender: currentUser.fullName,
            senderUsername: currentUser.username,
            role: currentUser.role,
            message: inputText,
            timestamp: Date.now(),
            recipient: activeChannel?.type === 'private' ? activeChannel.id! : undefined,
            groupId: (activeChannel?.type === 'group' || activeChannel?.type === 'task_group') ? activeChannel.id! : undefined,
            attachment: hasLocalFile ? {
                fileName: localSharedData.fileUrl!.split('/').pop() || 'فایل به اشتراک گذاشته شده',
                url: '' // Will be filled once uploaded
            } : undefined,
            replyTo: replyingTo ? {
                id: replyingTo.id,
                sender: replyingTo.sender,
                message: replyingTo.message || (replyingTo.audioUrl ? 'پیام صوتی' : 'فایل')
            } : undefined,
            readBy: [],
            isPending: true,
            uploadProgress: hasLocalFile ? 0 : undefined
        };

        const currentShared = localSharedData;

        // Optimistic UI Update using pendingMessages
        setPendingMessages(prev => [...prev, newMsg]);
        setLocalSharedData(null);
        setInputText('');
        setReplyingTo(null);
        setTimeout(scrollToBottom, 50);

        try {
            if (hasLocalFile && currentShared?.fileUrl) {
                const isAlreadyUploaded = currentShared.fileUrl.startsWith('/uploads/') || currentShared.fileUrl.includes('/uploads/');
                
                if (isAlreadyUploaded) {
                    // Already hosted on server (e.g. redirected from share-target server helper), send directly!
                    newMsg.attachment = {
                        fileName: currentShared.title || currentShared.fileUrl.split('/').pop() || 'فایل به اشتراک گذاشته شده',
                        url: currentShared.fileUrl
                    };
                } else {
                    setIsUploading(true);
                    let targetUrl = currentShared.fileUrl;
                    let blob;
                    
                    if (Capacitor.isNativePlatform() && (targetUrl.startsWith('content://') || targetUrl.startsWith('file://'))) {
                        try {
                            const readResult = await Filesystem.readFile({
                                path: currentShared.fileUrl
                            });
                            const base64Data = readResult.data;
                            const base64String = typeof base64Data === 'string' ? base64Data : ''; 
                            
                            let mimeType = 'application/octet-stream';
                            const ext = currentShared.fileUrl.split('.').pop()?.toLowerCase();
                            if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
                            else if (ext === 'png') mimeType = 'image/png';
                            else if (ext === 'gif') mimeType = 'image/gif';
                            else if (ext === 'pdf') mimeType = 'application/pdf';
                            else if (ext === 'xlsx') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                            else if (ext === 'xls') mimeType = 'application/vnd.ms-excel';
                            else if (ext === 'doc' || ext === 'docx') mimeType = 'application/msword';
                            else if (ext === 'txt') mimeType = 'text/plain';
                            else if (ext === 'mp4') mimeType = 'video/mp4';
                            else if (ext === 'mp3') mimeType = 'audio/mpeg';

                            // Safe synchronous base64 to blob conversion instead of fetching data URI
                            const rawBase64 = base64String.includes(',') ? base64String.split(',')[1] : base64String;
                            const byteCharacters = atob(rawBase64);
                            const byteNumbers = new Array(byteCharacters.length);
                            for (let idx = 0; idx < byteCharacters.length; idx++) {
                                byteNumbers[idx] = byteCharacters.charCodeAt(idx);
                            }
                            const byteArray = new Uint8Array(byteNumbers);
                            blob = new Blob([byteArray], { type: mimeType });
                        } catch (readErr) {
                            console.error("Capacitor Filesystem readFile fallback failed:", readErr);
                            // @ts-ignore
                            if (window.Capacitor) {
                                // @ts-ignore
                                targetUrl = window.Capacitor.convertFileSrc(targetUrl);
                            }
                            try {
                                const response = await fetch(targetUrl);
                                blob = await response.blob();
                            } catch (secFetchErr: any) {
                                console.error("Converter fetch also failed:", secFetchErr);
                                throw new Error(`سیستم در دسترسی به فایل گالری با خطا مواجه شد. لطفاً فایل را از دکمه سنجاق انتخاب فرمایید. جزئیات: ${secFetchErr.message || 'خطای دسترسی'}`);
                            }
                        }
                    } else {
                        if (targetUrl.startsWith('content://') || targetUrl.startsWith('file://')) {
                            // @ts-ignore
                            if (window.Capacitor) {
                                // @ts-ignore
                                targetUrl = window.Capacitor.convertFileSrc(targetUrl);
                            }
                        }
                        try {
                            const response = await fetch(targetUrl);
                            blob = await response.blob();
                        } catch (fetchErr: any) {
                            console.error("Standard native path fetch failed:", fetchErr);
                            throw new Error(`خطا در بارگذاری موقت فایل برای ارسال: ${fetchErr.message || 'خطای شبکه'}`);
                        }
                    }
                    
                    const defaultName = currentShared.title || `shared_file_${Date.now()}`;
                    const ext = blob.type.split('/').pop() || 'bin';
                    const fileSafeName = currentShared.fileUrl.split('/').pop() || `${defaultName}.${ext}`;
                    // @ts-ignore
                    const file = new window.File([blob], fileSafeName, { type: blob.type });

                    const result = await uploadFileChunked(file, (progress) => {
                        setPendingMessages(prev => prev.map(m => m.id === newMsgId ? { ...m, uploadProgress: progress } : m));
                    });
                    
                    newMsg.attachment = {
                        fileName: result.fileName,
                        url: result.url
                    };
                }
            }

            await sendMessage({ ...newMsg, isPending: undefined, uploadProgress: undefined });
            setIsUploading(false);
            onRefresh();
        } catch (e: any) { 
            console.error("Send Error:", e);
            setPendingMessages(prev => prev.filter(m => m.id !== newMsgId));
            setIsUploading(false);
            alert(`خطا در ارسال پیام: ${e.message || 'خطای شبکه'}`);
        }
    };

    const getBestMimeType = () => {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/ogg;codecs=opus',
            'audio/aac'
        ];
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) return type;
        }
        return '';
    };

    const startRecording = async () => {
        if (isRecording) return; 
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            const mimeType = getBestMimeType();
            const options = mimeType ? { mimeType } : undefined;
            recordedMimeTypeRef.current = mimeType || '';

            const mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => { 
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data); 
                }
            };
            
            mediaRecorder.onstop = async () => {
                const tracks = stream.getTracks();
                tracks.forEach(track => track.stop());

                const durationSec = Math.round((Date.now() - recordingStartTimeRef.current) / 1000);

                if (audioChunksRef.current.length === 0) {
                    setIsRecording(false);
                    return;
                }

                // Construct blob with correct type
                const finalMime = recordedMimeTypeRef.current || 'audio/webm';
                const audioBlob = new Blob(audioChunksRef.current, { type: finalMime });
                
                // Only send if substantial data
                if (audioBlob.size < 100) { 
                    setIsUploading(false); 
                    setIsRecording(false);
                    return; 
                }
                
                setIsUploading(true);
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = async () => {
                    const base64 = (reader.result || '') as string;
                    
                    // Optimistic UI for Voice
                    const tempId = generateUUID();
                    const tempUrl = URL.createObjectURL(audioBlob);
                    
                    const tempMsg: ChatMessage = {
                        id: tempId,
                        sender: currentUser.fullName,
                        senderUsername: currentUser.username,
                        role: currentUser.role,
                        message: '',
                        timestamp: Date.now(),
                        recipient: activeChannel?.type === 'private' ? activeChannel.id! : undefined,
                        groupId: activeChannel?.type === 'group' ? activeChannel.id! : undefined,
                        audioUrl: tempUrl,
                        audioDuration: durationSec,
                        readBy: [],
                        isPending: true,
                        uploadProgress: 0
                    };
                    
                    setMessages(prev => [...prev, tempMsg]);
                    setTimeout(scrollToBottom, 50);
                    setIsUploading(false); // Hide spinner, show message immediately
                    setIsRecording(false);
                    audioChunksRef.current = [];

                    try {
                        let ext = 'webm';
                        if (finalMime.includes('mp4') || finalMime.includes('aac')) ext = 'm4a';
                        else if (finalMime.includes('ogg')) ext = 'ogg';

                        // Simulate progress for UI
                        setTimeout(() => setMessages(prev => prev.map(m => m.id === tempId ? { ...m, uploadProgress: 50 } : m)), 200);

                        const result = await uploadFile(`voice_${Date.now()}.${ext}`, base64);
                        
                        // Update with real URL and same ID
                        const realMsg = { ...tempMsg, audioUrl: result.url, isPending: false, uploadProgress: undefined };
                        await sendMessage(realMsg);
                        
                        setMessages(prev => prev.map(m => m.id === tempId ? realMsg : m));
                        onRefresh();
                    } catch (e: any) { 
                        alert('خطا در ارسال ویس'); 
                        setMessages(prev => prev.filter(m => m.id !== tempId));
                    }
                };
            };

            // Start WITHOUT timeslice to let browser manage buffer and headers correctly.
            // This prevents corruption in some browsers (Safari/Mobile Chrome).
            mediaRecorder.start(); 
            recordingStartTimeRef.current = Date.now();
            setIsRecording(true);
            setRecordingTime(0);
            if(recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        } catch (err: any) { alert("دسترسی به میکروفون امکان‌پذیر نیست."); }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            if(recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }
        }
    };

    // --- True File Sharing ---
    const handleNativeShare = async (msg: ChatMessage) => {
        const fileUrl = msg.attachment?.url || msg.audioUrl;
        if (!fileUrl) return;

        // Try to fetch blob for file sharing
        try {
            // Need absolute URL for fetch if it's relative
            const fetchUrl = fileUrl.startsWith('data:') ? fileUrl : resolveImageUrl(fileUrl);
            
            const response = await fetch(fetchUrl);
            const blob = await response.blob();
            
            const fileName = msg.attachment?.fileName || `file_${Date.now()}.${blob.type.split('/')[1] || 'bin'}`;
            const file = new (window as any).File([blob], fileName, { type: blob.type });

            // Check if can share files
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'اشتراک‌گذاری',
                    text: msg.message || 'فایل ارسال شده'
                });
            } else {
                throw new Error("Cannot share file directly");
            }

        } catch (error: any) {
            console.log("File sharing failed, falling back to link share:", error);
            // Fallback to Link Share
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'اشتراک‌گذاری فایل',
                        text: `فایل ارسالی از طرف ${msg.sender}`,
                        url: fileUrl.startsWith('http') ? fileUrl : `${window.location.origin}${fileUrl}`
                    });
                } catch(e: any) { console.log('Link share failed', e); }
            } else {
                // Last resort: Open in new tab
                window.open(fileUrl, '_blank');
            }
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList | null, value: string } }) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const safeName = file.name || `unknown_${Date.now()}`;
        const newMsgId = generateUUID();

        const pendingMsg: ChatMessage = {
            id: newMsgId,
            sender: currentUser.fullName,
            senderUsername: currentUser.username,
            role: currentUser.role,
            message: '',
            timestamp: Date.now(),
            recipient: activeChannel?.type === 'private' ? activeChannel.id! : undefined,
            groupId: activeChannel?.type === 'group' ? activeChannel.id! : undefined,
            attachment: { fileName: safeName, url: '' }, // empty URL while pending
            readBy: [],
            isPending: true,
            uploadProgress: 0
        };

        setPendingMessages(prev => [...prev, pendingMsg]);
        setTimeout(scrollToBottom, 50);

        try {
            const result = await uploadFileChunked(file, (progress) => {
                setPendingMessages(prev => prev.map(m => m.id === newMsgId ? { ...m, uploadProgress: progress } : m));
            });
            
            const finalMsg: ChatMessage = {
                ...pendingMsg,
                attachment: { fileName: result.fileName, url: result.url },
                isPending: false,
                uploadProgress: undefined
            };
            
            await sendMessage(finalMsg);
            onRefresh();
        } catch (error: any) { 
            console.error("Upload Error:", error);
            alert(`خطا در ارسال فایل: ${error.message || 'خطای شبکه'}`); 
            setPendingMessages(prev => prev.filter(m => m.id !== newMsgId));
        }

        try {
            if (e.target) e.target.value = '';
        } catch(e){}
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleFileUpload({ target: { files, value: '' } });
        }
    };

    const handleDelete = async (forEveryone: boolean) => {
        const ids = Array.from(selectedMessages);
        if (ids.length === 0) return;

        // Check permission if trying to delete for everyone
        const canDeleteForEveryone = ids.every(id => {
            const msg = messages.find(m => m.id === id);
            return msg && (msg.senderUsername === currentUser.username || [UserRole.ADMIN, UserRole.MANAGER, UserRole.CEO].includes(currentUser.role as UserRole));
        });

        if (forEveryone && !canDeleteForEveryone) {
            alert("شما اجازه حذف دو طرفه برخی پیام‌های انتخاب شده را ندارید.");
            return;
        }

        const confirmMsg = forEveryone 
            ? `آیا از حذف ${ids.length > 1 ? 'پیام‌های انتخاب شده' : 'این پیام'} برای همه اطمینان دارید؟`
            : `آیا از حذف ${ids.length > 1 ? 'پیام‌های انتخاب شده' : 'این پیام'} برای خودتان اطمینان دارید؟ (این عمل محلی است)`;

        if (!confirm(confirmMsg)) return;
        
        for (const id of ids) {
            try {
                await deleteMessage(id, forEveryone);
                setMessages(prev => prev.filter(m => m.id !== id));
            } catch (e) {
                console.error("Delete failed", e);
            }
        }
        setSelectionMode(false);
        setSelectedMessages(new Set());
        onRefresh();
    };

    // Corrected Forward Logic
    const handleForward = async (targetId: string, targetType: 'private' | 'group' | 'public' | 'task_group') => {
        if (targetType === 'task_group') return;
        const ids = Array.from(selectedMessages);
        for (const id of ids) {
            const original = messages.find(m => m.id === id);
            if (original) {
                const newMsg: ChatMessage = {
                    id: generateUUID(),
                    sender: currentUser.fullName,
                    senderUsername: currentUser.username,
                    role: currentUser.role,
                    message: original.message,
                    timestamp: Date.now(),
                    recipient: targetType === 'private' ? targetId : undefined,
                    groupId: targetType === 'group' ? targetId : undefined,
                    attachment: original.attachment,
                    audioUrl: original.audioUrl,
                    isForwarded: true,
                    // Use flag from modal
                    forwardFrom: forwardNoQuote ? undefined : original.sender,
                    readBy: []
                };
                await sendMessage(newMsg);
            }
        }
        setSelectionMode(false);
        setSelectedMessages(new Set());
        setShowForwardModal(false);
        setForwardNoQuote(false); // Reset flag
        
        // Navigate to target chat
        setActiveChannel({ type: targetType, id: targetId });
        onRefresh();
        setTimeout(scrollToBottom, 150);
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedMessages);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedMessages(newSet);
        if (newSet.size === 0) setSelectionMode(false);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return;
        try {
            if (showGroupModal === 'task_group') {
                const newTaskGroup: TaskGroup = {
                    id: generateUUID(),
                    name: newGroupName.trim(),
                    members: [...selectedGroupMembers, currentUser.username],
                    createdBy: currentUser.username,
                    createdAt: Date.now()
                };
                await createTaskGroup(newTaskGroup);
                setTaskGroups(prev => [...prev, newTaskGroup]);
                setActiveChannel({ type: 'task_group', id: newTaskGroup.id });
            } else {
                const newGroup: ChatGroup = {
                    id: generateUUID(),
                    name: newGroupName.trim(),
                    members: [...selectedGroupMembers, currentUser.username],
                    admins: [currentUser.username],
                    createdBy: currentUser.username,
                    createdAt: Date.now(),
                    avatar: null
                };
                await createGroup(newGroup);
                setGroups(prev => [...prev, newGroup]);
                setActiveChannel({ type: 'group', id: newGroup.id });
            }
            setShowGroupModal(false);
            setNewGroupName('');
            setSelectedGroupMembers([]);
        } catch (e) {
            alert('خطا در ساخت گروه');
        }
    };

    const handleUpdateGroup = async (groupId: string, updates: Partial<ChatGroup>) => {
        try {
            if (showGroupInfo?.isTaskGroup) {
                const group = taskGroups.find(g => g.id === groupId);
                if (!group) return;
                const updatedGroup = { ...group, ...updates };
                await updateTaskGroup(updatedGroup);
                setTaskGroups(prev => prev.map(g => g.id === groupId ? updatedGroup : g));
                if (showGroupInfo && showGroupInfo.id === groupId) {
                    setShowGroupInfo({...updatedGroup, isTaskGroup: true});
                }
            } else {
                const group = groups.find(g => g.id === groupId);
                if (!group) return;
                const updatedGroup = { ...group, ...updates };
                await updateGroup(updatedGroup);
                setGroups(prev => prev.map(g => g.id === groupId ? updatedGroup : g));
                if (showGroupInfo && showGroupInfo.id === groupId) {
                    setShowGroupInfo(updatedGroup);
                }
            }
        } catch (e) {
            alert('خطا در بروزرسانی گروه');
        }
    };

    const handleAddMemberToGroup = async (groupId: string) => {
        const group = showGroupInfo?.isTaskGroup ? taskGroups.find(g => g.id === groupId) : groups.find(g => g.id === groupId);
        if (!group) return;
        
        const availableUsers = users.filter(u => !group.members.includes(u.username));
        if (availableUsers.length === 0) {
            alert('همه کاربران در این گروه عضو هستند.');
            return;
        }
        
        const userListStr = availableUsers.map(u => `${u.fullName} (${u.username})`).join('\n');
        const username = prompt(`نام کاربری کاربر جدید را جهت افزودن وارد کنید:\n\n${userListStr}`);
        if (username && users.find(u => u.username === username)) {
            const newMembers = [...group.members, username];
            await handleUpdateGroup(groupId, { members: newMembers });
        } else if (username) {
            alert('کاربر یافت نشد');
        }
    };

    const handleRemoveMemberFromGroup = async (groupId: string, memberUsername: string) => {
        const group = showGroupInfo?.isTaskGroup ? taskGroups.find(g => g.id === groupId) : groups.find(g => g.id === groupId);
        if (!group || group.createdBy === memberUsername) {
            alert('نمی‌توان سازنده گروه را حذف کرد');
            return;
        }
        
        if (confirm(`آیا از حذف ${memberUsername} اطمینان دارید؟`)) {
            const newMembers = group.members.filter(m => m !== memberUsername);
            const newAdmins = showGroupInfo?.isTaskGroup ? undefined : ((group as ChatGroup).admins || []).filter(a => a !== memberUsername);
            await handleUpdateGroup(groupId, { members: newMembers, admins: newAdmins });
        }
    };

    const handleToggleAdminStatus = async (groupId: string, memberUsername: string) => {
        if (showGroupInfo?.isTaskGroup) return; // Task groups don't have admins 
        
        const group = groups.find(g => g.id === groupId);
        if (!group) return;
        
        const admins = group.admins || [];
        const isCurrentlyAdmin = admins.includes(memberUsername);
        
        let newAdmins;
        if (isCurrentlyAdmin) {
            newAdmins = admins.filter(a => a !== memberUsername);
        } else {
            newAdmins = [...admins, memberUsername];
        }
        
        await handleUpdateGroup(groupId, { admins: newAdmins });
    };

    // --- Render Logic ---
    if (!currentUser) return null;

    const filteredMessages = displayMessages.filter(msg => {
        if (!activeChannel) return false;
        let match = false;
        if (activeChannel.type === 'public') match = !msg.recipient && !msg.groupId;
        else if (activeChannel.type === 'private') match = (msg.senderUsername === activeChannel.id && msg.recipient === currentUser.username) || (msg.senderUsername === currentUser.username && msg.recipient === activeChannel.id);
        else if (activeChannel.type === 'group' || activeChannel.type === 'task_group') match = msg.groupId === activeChannel.id;
        
        if (!match) return false;
        if (innerSearchTerm) {
            return (msg.message?.includes(innerSearchTerm) || msg.sender?.includes(innerSearchTerm));
        }
        return true;
    });

    return (
        <div className="absolute inset-0 bg-white dark:bg-[#1c1c1e] md:bg-gray-100/30 text-gray-800 dark:text-gray-200 md:p-2 lg:p-4 font-sans no-print overflow-hidden">
            <div className="flex-1 flex flex-row bg-white dark:bg-[#1c1c1e] md:rounded-2xl overflow-hidden md:shadow-xl md:border border-gray-200/50 dark:border-white/5 relative w-full h-full min-h-0">
                
                {/* --- LIST SIDEBAR --- */}
                <div className={`w-full md:w-80 lg:w-96 shrink-0 md:border-l border-gray-100 dark:border-white/5 flex-col min-h-0 h-full bg-white dark:bg-[#1c1c1e] z-20 ${activeChannel ? 'hidden md:flex' : 'flex'}`}>
                {/* Header */}
                <div className="sticky top-0 z-10 shrink-0 p-3 border-b bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex gap-1.5 bg-gray-200 dark:bg-white/10 p-1 rounded-lg text-[11px] font-bold w-full overflow-x-auto custom-scrollbar">
                            <button onClick={() => setActiveTab('ALL')} className={`flex-1 py-1.5 px-2 rounded-md transition-all whitespace-nowrap ${activeTab === 'ALL' ? 'glass-panel shadow text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>همه</button>
                            <button onClick={() => setActiveTab('CHATS')} className={`flex-1 py-1.5 px-2 rounded-md transition-all whitespace-nowrap ${activeTab === 'CHATS' ? 'glass-panel shadow text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>گفتگوها</button>
                            <button onClick={() => setActiveTab('GROUPS')} className={`flex-1 py-1.5 px-2 rounded-md transition-all whitespace-nowrap ${activeTab === 'GROUPS' ? 'glass-panel shadow text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>گروه‌ها</button>
                            <button onClick={() => setActiveTab('TASKS')} className={`flex-1 py-1.5 px-2 rounded-md transition-all whitespace-nowrap ${activeTab === 'TASKS' ? 'glass-panel shadow text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>تسک‌ها</button>
                        </div>
                        {(activeTab === 'GROUPS' || activeTab === 'TASKS') && <button onClick={() => {
                            setShowGroupModal(activeTab === 'TASKS' ? 'task_group' : 'group');
                        }} className="mr-2 text-blue-600 bg-blue-50 p-1.5 rounded-full shrink-0"><Plus size={16}/></button>}
                    </div>
                    <div className="relative">
                        <input className="w-full glass-panel border rounded-xl pl-8 pr-3 py-2 text-sm bg-white dark:bg-white/5" placeholder="جستجو..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <Search size={16} className="absolute left-2.5 top-2.5 text-gray-400"/>
                    </div>
                </div>

                {/* List Items */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-[#1c1c1e]">
                    {localSharedData && !activeChannel && (
                        <div className="m-3 p-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl text-white shadow-xl animate-bounce-subtle flex flex-col gap-2 border border-white/20">
                            <div className="flex justify-between items-center">
                                <h4 className="font-black text-sm flex items-center gap-2">
                                    <Share2 size={16} />
                                    محتوای پیوست آماده اشتراک‌گذاری
                                </h4>
                                <button onClick={() => setLocalSharedData(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                                    <X size={16} />
                                </button>
                            </div>
                            <p className="text-[10px] opacity-90 font-bold leading-relaxed line-clamp-2 bg-black/10 p-2 rounded-xl">
                                {localSharedData.fileUrl ? `📎 فایل: ${localSharedData.fileUrl.split('/').pop()}` : localSharedData.text}
                            </p>
                            <div className="bg-white text-blue-700 py-1.5 rounded-xl text-center text-[10px] font-black shadow-inner">
                                یک گفتگو را برای ارسال انتخاب کنید
                            </div>
                        </div>
                    )}
                    {getSortedChannels().length === 0 && !searchTerm && (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-400 p-10 text-center">
                            <MessageCircle size={32} className="mb-2 opacity-20" />
                            <p className="text-xs">پیامی یافت نشد</p>
                        </div>
                    )}
                    {getSortedChannels().map((item: ChannelItem) => (
                        <div key={item.id} onClick={() => { setActiveChannel({type: item.type, id: item.id}); markAsRead(item.id, item.type); }} className={`flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer border-b border-gray-50 dark:border-white/5 relative group ${activeChannel?.id === item.id ? 'bg-blue-50/50 dark:bg-blue-500/10' : ''}`}>
                            <div className="relative">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm ${item.type === 'private' ? 'bg-gradient-to-br from-blue-400 to-blue-600' : item.type === 'task_group' ? 'bg-gradient-to-br from-purple-400 to-purple-600' : 'bg-gradient-to-br from-orange-400 to-orange-600'}`}>
                                    {item.avatar ? <img src={resolveImageUrl(item.avatar)} className="w-full h-full rounded-full object-cover"/> : item.name.charAt(0)}
                                </div>
                                {item.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <div className="flex items-center gap-1 overflow-hidden">
                                        <span className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">{item.name}</span>
                                        {mutedChannels.has(item.id) && <BellOff size={10} className="text-gray-400 opacity-60"/>}
                                    </div>
                                    {item.lastMsg && <span className="text-[10px] text-gray-400 font-mono tracking-tighter">{new Date(item.lastMsg.timestamp).toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})}</span>}
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
                                        {item.type === 'task_group' ? 'لیست تسک‌ها...' : item.lastMsg ? (item.lastMsg.audioUrl ? '🎤 پیام صوتی' : item.lastMsg.attachment ? '📎 فایل' : item.lastMsg.message) : 'پیامی نیست'}
                                    </p>
                                    {item.unread > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center font-bold shadow-sm animate-pulse">{item.unread}</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- CHAT AREA --- */}
            <div className={`flex-1 flex flex-col min-h-0 h-full bg-white dark:bg-[#0b141a] md:bg-[#f0f2f5] z-30 md:z-10 w-full relative ${activeChannel ? 'flex' : 'hidden md:flex'}`}>
                {activeChannel ? (
                    <>
                        {/* Chat Header */}
                        <div className="sticky top-0 glass-panel p-2 px-4 flex justify-between items-center shadow-sm z-50 shrink-0 safe-pt bg-white/90 dark:bg-[#0b141a]/90 backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <button onClick={() => window.history.back()} className="md:hidden p-1 hover:bg-gray-100 rounded-full"><ArrowRight/></button>
                                
                                {/* Dynamic Conversation Avatar */}
                                {(() => {
                                    let avatarUrl: string | null = null;
                                    let initial = '?';
                                    let bgColor = 'bg-gradient-to-br from-blue-400 to-blue-600';
                                    
                                    if (activeChannel.type === 'private') {
                                        const u = users.find(x => x.username === activeChannel.id);
                                        avatarUrl = u?.avatar || null;
                                        initial = u?.fullName.charAt(0) || '?';
                                        bgColor = 'bg-gradient-to-br from-blue-400 to-blue-600';
                                    } else if (activeChannel.type === 'group') {
                                        const g = groups.find(x => x.id === activeChannel.id);
                                        avatarUrl = g?.avatar || null;
                                        initial = g?.name.charAt(0) || '?';
                                        bgColor = 'bg-gradient-to-br from-orange-400 to-orange-600';
                                    } else if (activeChannel.type === 'task_group') {
                                        const tg = taskGroups.find(x => x.id === activeChannel.id);
                                        avatarUrl = tg?.avatar || null;
                                        initial = tg?.name.charAt(0) || '?';
                                        bgColor = 'bg-gradient-to-br from-purple-400 to-purple-600';
                                    } else {
                                        initial = 'ع';
                                        bgColor = 'bg-gradient-to-br from-green-400 to-green-600';
                                    }
                                    
                                    return (
                                        <div 
                                            onClick={() => {
                                                if(activeChannel.type === 'private') setShowContactInfo(users.find(u=>u.username===activeChannel.id) || null);
                                                else if(activeChannel.type === 'group') setShowGroupInfo(groups.find(g=>g.id===activeChannel.id) || null);
                                                else if(activeChannel.type === 'task_group') {
                                                    const tg = taskGroups.find(g=>g.id===activeChannel.id);
                                                    if (tg) setShowGroupInfo({...tg, isTaskGroup: true});
                                                }
                                            }}
                                            className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base shadow-inner cursor-pointer overflow-hidden shrink-0 ${bgColor}`}
                                        >
                                            {avatarUrl ? <img src={resolveImageUrl(avatarUrl)} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : initial}
                                        </div>
                                    );
                                })()}

                                <div className="flex flex-col cursor-pointer" onClick={() => {
                                    if(activeChannel.type === 'private') setShowContactInfo(users.find(u=>u.username===activeChannel.id) || null);
                                    else if(activeChannel.type === 'group') setShowGroupInfo(groups.find(g=>g.id===activeChannel.id) || null);
                                    else if(activeChannel.type === 'task_group') {
                                        const tg = taskGroups.find(g=>g.id===activeChannel.id);
                                        if (tg) setShowGroupInfo({...tg, isTaskGroup: true});
                                    }
                                }}>
                                    <h3 className="font-bold text-gray-800 text-sm">
                                        {activeChannel.type === 'private' ? users.find(u=>u.username===activeChannel.id)?.fullName : 
                                         activeChannel.type === 'group' ? groups.find(g=>g.id===activeChannel.id)?.name :
                                         activeChannel.type === 'task_group' ? taskGroups.find(g=>g.id===activeChannel.id)?.name : 'کانال عمومی'}
                                    </h3>
                                    <span className="text-[10px] text-blue-500">
                                        {activeChannel.type === 'private' ? (
                                            users.find(u=>u.username===activeChannel.id)?.lastSeen && (Date.now() - (users.find(u=>u.username===activeChannel.id)?.lastSeen || 0) < 300000) ? 'آنلاین' : 
                                            `آخرین بازدید ${formatLastSeen(users.find(u=>u.username===activeChannel.id)?.lastSeen)}`
                                        ) : activeChannel.type === 'task_group' ? 'گروه تسک' : 'اطلاعات گروه'}
                                    </span>
                                </div>
                            </div>
                            {activeChannel.type !== 'task_group' && (
                                <div className="flex gap-2">
                                    <button onClick={() => onRefresh()} className="p-2 hover:bg-gray-100 rounded-full text-blue-600" title="بروزرسانی"><RefreshCw size={20} className={isUploading ? 'animate-spin' : ''}/></button>
                                    {selectionMode ? (
                                        <div className="flex gap-2 animate-fade-in">
                                            <button onClick={() => setShowForwardModal(true)} className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100" title="فوروارد"><Forward size={18}/></button>
                                            <button onClick={() => handleDelete(false)} className="p-2 bg-orange-50 text-orange-600 rounded-full hover:bg-orange-100" title="حذف برای من"><Trash2 size={18}/></button>
                                            <button onClick={() => handleDelete(true)} className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100" title="حذف دو طرفه"><Trash2 size={18}/></button>
                                            <button onClick={() => { setSelectionMode(false); setSelectedMessages(new Set()); }} className="p-2 hover:bg-gray-100 rounded-full"><X size={18}/></button>
                                        </div>
                                    ) : (
                                        <button onClick={() => setShowInnerSearch(!showInnerSearch)} className={`p-2 rounded-full ${showInnerSearch ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}><Search size={20}/></button>
                                    )}
                                </div>
                            )}
                        </div>

                        {activeChannel.type === 'task_group' ? (
                            <div className="flex-1 bg-gray-50 flex flex-col h-full overflow-y-auto w-full custom-scrollbar">
                                <div className="p-4 border-b glass-panel flex justify-between items-center sticky top-0 z-10 shadow-sm bg-white/90 dark:bg-gray-900/90 backdrop-blur-md">
                                    <h4 className="font-bold text-gray-800 dark:text-gray-200">تسک‌های این گروه</h4>
                                    <button 
                                        onClick={() => {
                                            setTaskTitle('');
                                            setTaskDescription('');
                                            setTaskAssignedTo([]);
                                            setTaskDueDate('');
                                            setUserSearchText('');
                                            setShowCreateTaskModal(true);
                                        }}
                                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition"
                                    >
                                        <Plus size={18}/> تسک جدید
                                    </button>
                                </div>
                                <div className="p-4 space-y-6">
                                    {/* 1. Active Tasks Section */}
                                    <div>
                                        <h5 className="text-xs font-black text-gray-400 dark:text-gray-500 mb-3 uppercase tracking-wider flex items-center gap-2">
                                            <span>تسک‌های فعال</span>
                                            <span className="bg-blue-100 text-blue-600 text-[10px] font-black px-2 py-0.5 rounded-full">
                                                {tasks.filter(t => t.groupId === activeChannel.id && t.status !== 'completed').length}
                                            </span>
                                        </h5>
                                        {tasks.filter(t => t.groupId === activeChannel.id && t.status !== 'completed').length === 0 ? (
                                            <div className="text-center text-gray-400 dark:text-gray-600 py-12 bg-white dark:bg-gray-900/35 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                                                <ListTodo size={32} className="mx-auto mb-2 opacity-20"/>
                                                <p className="text-xs">تسک فعال و در جریانی در این گروه وجود ندارد</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {tasks.filter(t => t.groupId === activeChannel.id && t.status !== 'completed').map(task => (
                                                    <div 
                                                        key={task.id} 
                                                        onClick={() => { setActiveTaskForDetail(task); setTaskReplyText(''); }}
                                                        className="glass-panel p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm group hover:shadow-md transition cursor-pointer flex justify-between items-start"
                                                    >
                                                        <div className="flex items-start gap-4 flex-1 min-w-0">
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const updatedTask = { 
                                                                        ...task, 
                                                                        status: 'completed' as const,
                                                                        completedBy: currentUser.username,
                                                                        completedAt: Date.now()
                                                                    };
                                                                    updateTask(updatedTask).then(() => {
                                                                        setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
                                                                    });
                                                                }}
                                                                className="mt-0.5 rounded-full border-2 border-gray-300 dark:border-gray-700 w-5 h-5 transition-colors flex items-center justify-center hover:border-green-500 bg-white dark:bg-gray-800 shrink-0"
                                                            >
                                                                <Check size={14} className="text-white opacity-0 group-hover:opacity-100 group-hover:text-green-500 transition-opacity"/>
                                                            </button>
                                                            <div className="min-w-0 flex-1">
                                                                <h5 className="font-bold text-gray-800 dark:text-gray-200 text-sm truncate">{task.title}</h5>
                                                                {task.description && (
                                                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-1">{task.description}</p>
                                                                )}
                                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-400 mt-2">
                                                                    <span>توسط: @{task.createdBy}</span>
                                                                    <span>ثبت: {formatDate(task.createdAt)}</span>
                                                                    {task.dueDate && (
                                                                        <span className="text-amber-600 font-bold bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded">مهلت: {formatDate(new Date(task.dueDate).getTime())}</span>
                                                                    )}
                                                                    {task.replies && task.replies.length > 0 && (
                                                                        <span className="text-blue-500 font-semibold">💬 {task.replies.length} پاسخ</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {task.assignedTo && task.assignedTo.length > 0 && (
                                                                <div className="flex -space-x-1.5 hover:space-x-0.5 transition-all">
                                                                    {task.assignedTo.slice(0, 3).map(un => {
                                                                        const uObj = users.find(u => u.username === un);
                                                                        return (
                                                                            <div key={un} className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black flex items-center justify-center border border-white dark:border-gray-800 shadow-sm" title={uObj?.fullName || un}>
                                                                                {uObj?.avatar ? <img src={resolveImageUrl(uObj.avatar)} className="w-full h-full rounded-full object-cover" /> : un.charAt(0)}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                    {task.assignedTo.length > 3 && (
                                                                        <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-[9px] font-bold flex items-center justify-center border border-white dark:border-gray-800 shadow-sm">
                                                                            +{task.assignedTo.length - 3}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (confirm('آیا مایل به حذف این تسک هستید؟')) {
                                                                        deleteTask(task.id).then(() => setTasks(prev => prev.filter(t => t.id !== task.id)));
                                                                    }
                                                                }} 
                                                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg opacity-0 group-hover:opacity-100 transition"
                                                            >
                                                                <Trash2 size={16}/>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* 2. Completed Tasks Section */}
                                    <div className="pt-2">
                                        <h5 className="text-xs font-black text-gray-400 dark:text-gray-500 mb-3 uppercase tracking-wider flex items-center gap-2">
                                            <span>تسک‌های انجام‌شده</span>
                                            <span className="bg-green-100 text-green-600 text-[10px] font-black px-2 py-0.5 rounded-full">
                                                {tasks.filter(t => t.groupId === activeChannel.id && t.status === 'completed').length}
                                            </span>
                                        </h5>
                                        {tasks.filter(t => t.groupId === activeChannel.id && t.status === 'completed').length === 0 ? (
                                            <p className="text-xs text-gray-400 dark:text-gray-500 italic py-4">تسکی در لیست انجام‌شده‌ها قرار ندارد.</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {tasks.filter(t => t.groupId === activeChannel.id && t.status === 'completed').map(task => (
                                                    <div 
                                                        key={task.id} 
                                                        onClick={() => { setActiveTaskForDetail(task); setTaskReplyText(''); }}
                                                        className="glass-panel p-4 rounded-xl border border-gray-100 dark:border-gray-800/80 shadow-sm group hover:shadow transition cursor-pointer flex justify-between items-start opacity-75 hover:opacity-100"
                                                    >
                                                        <div className="flex items-start gap-4 flex-1 min-w-0">
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const updatedTask = { 
                                                                        ...task, 
                                                                        status: 'pending' as const,
                                                                        completedBy: undefined,
                                                                        completedAt: undefined
                                                                    };
                                                                    updateTask(updatedTask).then(() => {
                                                                        setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
                                                                    });
                                                                }}
                                                                className="mt-0.5 rounded-full bg-green-500 border-2 border-green-500 w-5 h-5 flex items-center justify-center transition-colors hover:bg-green-600 shrink-0"
                                                            >
                                                                <Check size={14} className="text-white"/>
                                                            </button>
                                                            <div className="min-w-0 flex-1">
                                                                <h5 className="font-bold text-gray-400 dark:text-gray-500 text-sm line-through truncate">{task.title}</h5>
                                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-400 mt-2">
                                                                    <span>توسط: @{task.createdBy}</span>
                                                                    {task.completedBy && (
                                                                        <span className="text-green-600">انجام‌شده توسط: @{task.completedBy}</span>
                                                                    )}
                                                                    {task.replies && task.replies.length > 0 && (
                                                                        <span className="text-blue-500">💬 {task.replies.length} پاسخ</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (confirm('آیا مایل به حذف این تسک هستید؟')) {
                                                                    deleteTask(task.id).then(() => setTasks(prev => prev.filter(t => t.id !== task.id)));
                                                                }
                                                            }} 
                                                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg opacity-0 group-hover:opacity-100 transition shrink-0"
                                                        >
                                                            <Trash2 size={16}/>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Inner Search */}
                                {showInnerSearch && (
                                    <div className="glass-panel p-2 border-b flex items-center gap-2 animate-slide-down">
                                        <input className="flex-1 bg-gray-100 border-none rounded-lg py-2 px-4 text-sm" placeholder="جستجو در پیام‌ها..." value={innerSearchTerm} onChange={e => setInnerSearchTerm(e.target.value)} autoFocus />
                                        <button onClick={() => { setShowInnerSearch(false); setInnerSearchTerm(''); }}><X size={20} className="text-gray-500"/></button>
                                    </div>
                                )}

                                {/* Messages List */}
                                <div 
                                    className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 relative bg-white dark:bg-black"
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                >
                            {filteredMessages.map((msg: ChatMessage) => {
                                const isMe = msg.senderUsername === currentUser.username;
                                const isSelected = selectedMessages.has(msg.id);
                                
                                return (
                                    <div 
                                        key={msg.id} 
                                        className={`flex w-full mb-1 group ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2 ${selectionMode ? 'cursor-pointer' : ''}`}
                                        onClick={() => { if(selectionMode) toggleSelection(msg.id); }}
                                        onContextMenu={(e) => { e.preventDefault(); if(!selectionMode) setContextMenuMsg({msg, x: e.clientX, y: e.clientY}); }}
                                    >
                                        {/* Actions Button - LEFT for ME, RIGHT for OTHER */}
                                        {isMe && (
                                            <div className="flex flex-col gap-1 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                 <button onClick={() => setReplyingTo(msg)} className="p-1.5 glass-panel rounded-full text-blue-600 shadow-sm hover:scale-110" title="پاسخ"><CornerUpLeft size={12}/></button>
                                                 <button onClick={() => { setSelectedMessages(new Set([msg.id])); setShowForwardModal(true); }} className="p-1.5 glass-panel rounded-full text-green-600 shadow-sm hover:scale-110" title="فوروارد"><Forward size={12}/></button>
                                                 <button onClick={() => handleCopyMessage(msg)} className="p-1.5 glass-panel rounded-full text-gray-600 shadow-sm hover:scale-110" title="کپی"><Copy size={12}/></button>
                                                 {(msg.attachment || msg.audioUrl) && <button onClick={() => handleNativeShare(msg)} className="p-1.5 glass-panel rounded-full text-orange-600 shadow-sm hover:scale-110" title="اشتراک"><Share2 size={12}/></button>}
                                            </div>
                                        )}

                                        {selectionMode && (
                                            <div className={`mx-2 self-center w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-green-500 border-green-500' : 'border-gray-400 bg-white/50'}`}>
                                                {isSelected && <Check size={12} className="text-white"/>}
                                            </div>
                                        )}
                                        
                                        <div className={`relative max-w-[75%] md:max-w-[70%] rounded-xl px-3 py-1.5 shadow-sm text-sm transition-colors ${isMe ? 'bg-[#eeffde] rounded-tr-none' : 'glass-panel rounded-tl-none'} ${isSelected ? 'ring-2 ring-blue-400' : ''}`}>
                                            
                                            {/* Forward Header */}
                                            {msg.isForwarded && msg.forwardFrom && (
                                                <div className="text-[10px] text-blue-600 font-bold mb-1 flex items-center gap-1">
                                                    <Forward size={10}/> نقل قول از {msg.forwardFrom}
                                                </div>
                                            )}

                                            {/* Reply Header */}
                                            {msg.replyTo && (
                                                <div className={`mb-1 px-2 py-0.5 rounded border-r-2 text-[10px] bg-opacity-10 cursor-pointer ${isMe ? 'bg-green-600 border-green-600' : 'bg-blue-600 border-blue-600'}`}>
                                                    <div className="font-bold opacity-80">{msg.replyTo.sender}</div>
                                                    <div className="truncate opacity-70">{msg.replyTo.message.substring(0, 30)}...</div>
                                                </div>
                                            )}

                                            {/* Sender Name in Group */}
                                            {!isMe && activeChannel.type !== 'private' && (
                                                <div className="text-[11px] font-bold text-[#e17076] mb-0.5">{msg.sender}</div>
                                            )}

                                            {/* Content */}
                                            {msg.attachment ? (
                                                <div className="mb-1">
                                                    {msg.attachment.fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                                        <img 
                                                            src={resolveImageUrl(msg.attachment.url)} 
                                                            className="rounded-lg max-h-60 object-cover cursor-pointer hover:opacity-90"
                                                            onClick={(e) => { e.stopPropagation(); setShowImageViewer(resolveImageUrl(msg.attachment!.url)); }}
                                                        />
                                                    ) : (
                                                        <button 
                                                            className="flex items-center gap-2 bg-black/5 p-2 rounded hover:bg-black/10 transition-colors w-full text-right" 
                                                            onClick={async (e) => { 
                                                                e.stopPropagation(); 
                                                                if (isDownloading[msg.id]) return;
                                                                
                                                                setIsDownloading(prev => ({ ...prev, [msg.id]: true }));
                                                                setFileProgress(prev => ({ ...prev, [msg.id]: 0 }));
                                                                
                                                                const fileName = msg.attachment!.fileName || 'file';
                                                                const uniqueLocalName = `${msg.id}_${fileName}`;
                                                                await downloadAndOpenFile(msg.attachment!.url, uniqueLocalName, (p) => {
                                                                    setFileProgress(prev => ({ ...prev, [msg.id]: p }));
                                                                });

                                                                setTimeout(() => {
                                                                    setIsDownloading(prev => { const n = {...prev}; delete n[msg.id]; return n; });
                                                                    setFileProgress(prev => { const n = {...prev}; delete n[msg.id]; return n; });
                                                                    if(Capacitor.isNativePlatform()) {
                                                                        setDownloadedFiles(prev => {
                                                                            const updated = { ...prev, [msg.id]: true };
                                                                            try {
                                                                                localStorage.setItem('chat_downloaded_files', JSON.stringify(updated));
                                                                            } catch (e) {}
                                                                            return updated;
                                                                        });
                                                                    }
                                                                }, 500);
                                                            }}
                                                        >
                                                            <div className={`p-2 rounded text-white relative ${downloadedFiles[msg.id] ? 'bg-green-600' : 'bg-blue-500'}`}>
                                                                {isDownloading[msg.id] ? <Loader2 size={16} className="animate-spin"/> : downloadedFiles[msg.id] ? <Check size={16}/> : <File size={16}/>}
                                                                {isDownloading[msg.id] && (
                                                                    <div className="absolute inset-0 flex items-center justify-center bg-blue-600 rounded text-[8px] font-bold">
                                                                        {fileProgress[msg.id]}%
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="overflow-hidden flex-1">
                                                                <div className="font-bold text-xs truncate">{msg.attachment.fileName}</div>
                                                                <div className={`text-[10px] font-bold ${downloadedFiles[msg.id] ? 'text-green-600' : 'text-blue-600'}`}>
                                                                    {isDownloading[msg.id] ? 'در حال دریافت...' : downloadedFiles[msg.id] ? 'Downloaded/باز کردن' : 'کلیک برای دریافت'}
                                                                </div>
                                                            </div>
                                                        </button>
                                                    )}
                                                </div>
                                            ) : msg.audioUrl ? (
                                                <div className="flex items-center gap-2 min-w-[200px] py-1">
                                                    <AudioPlayer url={msg.audioUrl} isMe={isMe} duration={msg.audioDuration} />
                                                </div>
                                            ) : (
                                                <div 
                                                    className="whitespace-pre-wrap leading-relaxed message-content cursor-pointer"
                                                    onClick={(e) => { e.stopPropagation(); handleCopyMessage(msg); }}
                                                    title="برای کپی کلیک کنید"
                                                >
                                                    {msg.message}
                                                </div>
                                            )}

                                            {/* Footer */}
                                            <div className="flex justify-end items-center gap-1 mt-1 opacity-60 select-none">
                                                {msg.uploadProgress !== undefined && (
                                                    <span className="text-[10px] bg-blue-100 text-blue-800 px-1 rounded font-mono">{msg.uploadProgress}%</span>
                                                )}
                                                {msg.isEdited && <span className="text-[9px]">ویرایش شده</span>}
                                                <span className="text-[10px]">{new Date(msg.timestamp).toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})}</span>
                                                {isMe && (
                                                    msg.isPending ? <Clock size={12} className="text-gray-400"/> :
                                                    (msg.readBy && msg.readBy.length > 0) ? <CheckCheck size={14} className="text-green-500" /> :
                                                    <Check size={14} className="text-gray-500" />
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions Button - LEFT for ME, RIGHT for OTHER */}
                                        {!isMe && (
                                            <div className="flex flex-col gap-1 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                 <button onClick={() => setReplyingTo(msg)} className="p-1.5 glass-panel rounded-full text-blue-600 shadow-sm hover:scale-110" title="پاسخ"><CornerUpLeft size={12}/></button>
                                                 <button onClick={() => { setSelectedMessages(new Set([msg.id])); setShowForwardModal(true); }} className="p-1.5 glass-panel rounded-full text-green-600 shadow-sm hover:scale-110" title="فوروارد"><Forward size={12}/></button>
                                                 <button onClick={() => handleCopyMessage(msg)} className="p-1.5 glass-panel rounded-full text-gray-600 shadow-sm hover:scale-110" title="کپی"><Copy size={12}/></button>
                                                 {(msg.attachment || msg.audioUrl) && <button onClick={() => handleNativeShare(msg)} className="p-1.5 glass-panel rounded-full text-orange-600 shadow-sm hover:scale-110" title="اشتراک"><Share2 size={12}/></button>}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="shrink-0 sticky bottom-0 bg-white/90 dark:bg-[#0b141a]/90 backdrop-blur-md glass-panel p-2 flex items-end gap-2 border-t relative z-20 pb-[calc(12px+env(safe-area-inset-bottom))] md:pb-2">
                            {/* Reply/Edit Preview */}
                            {localSharedData && (
                                <div className="absolute bottom-full left-0 right-0 glass-panel border-t border-b p-2 flex justify-between items-center shadow-sm z-10 animate-slide-up bg-blue-50/90 dark:bg-blue-950/90">
                                    <div className="flex items-center gap-2 border-r-4 border-orange-500 pr-2">
                                        <Paperclip size={18} className="text-orange-500"/>
                                        <div className="flex flex-col text-xs">
                                            <span className="font-bold text-orange-600">فایل پیوست آماده‌ی ارسال</span>
                                            <span className="text-gray-500 truncate max-w-[200px]">{localSharedData.fileUrl ? localSharedData.fileUrl.split('/').pop() : localSharedData.text}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => { setLocalSharedData(null); }}><X size={18} className="text-gray-400 hover:text-red-500"/></button>
                                </div>
                            )}

                            {(replyingTo || editingMessageId) && (
                                <div className="absolute bottom-full left-0 right-0 glass-panel border-t border-b p-2 flex justify-between items-center shadow-sm z-10 animate-slide-up">
                                    <div className="flex items-center gap-2 border-r-4 border-blue-500 pr-2">
                                        {editingMessageId ? <Edit2 size={18} className="text-blue-500"/> : <Reply size={18} className="text-blue-500"/>}
                                        <div className="flex flex-col text-xs">
                                            <span className="font-bold text-blue-600">{editingMessageId ? 'ویرایش پیام' : `پاسخ به ${replyingTo?.sender}`}</span>
                                            <span className="text-gray-500 truncate max-w-[200px]">{editingMessageId ? '...' : replyingTo?.message}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => { setReplyingTo(null); setEditingMessageId(null); setInputText(''); }}><X size={18} className="text-gray-400 hover:text-red-500"/></button>
                                </div>
                            )}

                            <button onClick={() => document.getElementById('chat-file-menu')?.classList.toggle('hidden')} className="p-3 text-gray-500 hover:bg-gray-100 rounded-full transition-colors mb-1 relative">
                                <Paperclip size={24}/>
                                {/* Attachment Menu */}
                                <div id="chat-file-menu" className="hidden absolute bottom-14 right-0 glass-panel shadow-xl rounded-xl border p-2 flex flex-col gap-2 min-w-[150px] animate-scale-in z-50">
                                    <button onClick={() => galleryInputRef.current?.click()} className="flex items-center gap-2 hover:bg-gray-50 p-2 rounded text-sm text-gray-700"><ImageIcon size={18} className="text-blue-500"/> گالری (عکس/فیلم)</button>
                                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 hover:bg-gray-50 p-2 rounded text-sm text-gray-700"><File size={18} className="text-orange-500"/> فایل</button>
                                </div>
                            </button>
                            
                            <input type="file" ref={galleryInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileUpload}/>
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload}/>

                            <div className={`flex-1 rounded-3xl flex items-center px-4 py-2 min-h-[48px] relative transition-all duration-300 ${inputText.length > 0 ? 'bg-white shadow-[0_4px_20px_rgba(59,130,246,0.15)] ring-1 ring-blue-100 dark:bg-gray-800 dark:ring-blue-900/50' : 'bg-gray-100 dark:bg-gray-800/80'}`}>
                                {inputText.length > 0 && (
                                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 opacity-10 animate-bg-pan pointer-events-none dark:opacity-20" style={{ backgroundSize: '200% 200%' }} />
                                )}
                                <textarea 
                                    ref={inputAreaRef}
                                    value={inputText}
                                    onChange={e => {
                                        setInputText(e.target.value);
                                        e.target.style.height = 'auto';
                                        e.target.style.height = `${e.target.scrollHeight}px`;
                                    }}
                                    onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                    placeholder="پیام..."
                                    className="bg-transparent border-none outline-none w-full text-sm resize-none custom-scrollbar relative z-10 placeholder-gray-500 dark:placeholder-gray-400 text-gray-800 dark:text-gray-100"
                                    rows={1}
                                    style={{ height: 'auto', minHeight: '24px', maxHeight: '40vh' }}
                                />
                            </div>

                            {inputText.trim() || isUploading || localSharedData?.fileUrl ? (
                                <button onClick={handleSendMessage} className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all active:scale-95 mb-1 relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"></div>
                                    {isUploading ? <Loader2 size={24} className="animate-spin relative z-10"/> : <Send size={24} className={`relative z-10 ${document.dir==='rtl' ? 'rotate-180' : ''}`}/>}
                                </button>
                            ) : (
                                <button 
                                    onMouseDown={startRecording}
                                    onMouseUp={stopRecording}
                                    onTouchStart={startRecording}
                                    onTouchEnd={stopRecording}
                                    className={`p-3 rounded-full shadow-lg transition-all mb-1 ${isRecording ? 'bg-red-500 scale-110 shadow-red-200' : 'bg-blue-500 text-white'}`}
                                >
                                    {isRecording ? <div className="text-white font-mono text-xs">{formatTime(recordingTime)}</div> : <Mic size={24}/>}
                                </button>
                            )}
                        </div>
                        </>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-gray-50 dark:bg-[#0b141a]/10 relative overflow-hidden">
                        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none select-none flex flex-wrap gap-8 p-10 rotate-[-12deg]">
                            {Array.from({length: 30}).map((_, i) => (
                                <MessageSquare key={i} size={40} className={i % 4 === 0 ? 'text-blue-600' : ''} />
                            ))}
                        </div>
                        <div className="relative flex flex-col items-center animate-scale-in">
                            <div className="w-24 h-24 bg-gradient-to-tr from-blue-50 to-indigo-50 dark:from-blue-500/10 dark:to-indigo-500/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
                                <MessageSquare size={48} className="text-blue-500/30" />
                            </div>
                            <h2 className="text-lg font-black text-gray-700 dark:text-gray-300 mb-2">گفتگوی سازمانی</h2>
                            <p className="text-xs text-gray-400 dark:text-gray-500 font-bold">برای شروع گفتگو، یک مخاطب یا گروه را انتخاب کنید</p>
                        </div>
                    </div>
                )}
            </div>

            {/* --- OVERLAYS --- */}
            
            {/* 1. Context Menu */}
            {contextMenuMsg && (() => {
                const canDeleteForEveryone = contextMenuMsg.msg.senderUsername === currentUser.username || [UserRole.ADMIN, UserRole.MANAGER, UserRole.CEO].includes(currentUser.role as UserRole);
                const isOwner = contextMenuMsg.msg.senderUsername === currentUser.username;
                const totalItems = 6 + (isOwner ? 1 : 0) + (canDeleteForEveryone ? 1 : 0);
                const menuHeight = totalItems * 38 + 10; // Dynamic height based on actual visible items
                const menuWidth = 192;
                let topPosition = contextMenuMsg.y;
                let leftPosition = contextMenuMsg.x;

                // Smart Upward/Downward detection based on click position relative to viewport height
                if (contextMenuMsg.y > window.innerHeight / 2) {
                    // Clicked in bottom half, open upwards
                    topPosition = Math.max(10, contextMenuMsg.y - menuHeight);
                } else {
                    // Clicked in top half, open downwards
                    topPosition = Math.max(10, Math.min(contextMenuMsg.y, window.innerHeight - menuHeight - 10));
                }

                if (leftPosition + menuWidth > window.innerWidth) {
                    leftPosition = Math.max(10, window.innerWidth - menuWidth - 10);
                } else {
                    leftPosition = Math.max(10, leftPosition);
                }

                return (
                    <div className="fixed inset-0 z-[200]" onClick={() => setContextMenuMsg(null)}>
                        <div 
                            className="absolute glass-panel rounded-xl shadow-2xl border w-48 py-1 overflow-hidden animate-scale-in"
                            style={{ top: topPosition, left: leftPosition }}
                        >
                            <button onClick={() => { setReplyingTo(contextMenuMsg.msg); setContextMenuMsg(null); }} className="w-full text-right px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"><Reply size={16}/> پاسخ</button>
                            <button onClick={() => { handleCopyMessage(contextMenuMsg.msg); setContextMenuMsg(null); }} className="w-full text-right px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"><Copy size={16}/> کپی</button>
                            <button onClick={() => { handleNativeShare(contextMenuMsg.msg); setContextMenuMsg(null); }} className="w-full text-right px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"><Share2 size={16}/> اشتراک‌گذاری</button>
                            <button onClick={() => { setSelectedMessages(new Set([contextMenuMsg.msg.id])); setShowForwardModal(true); setContextMenuMsg(null); }} className="w-full text-right px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"><Forward size={16}/> فوروارد</button>
                            {contextMenuMsg.msg.senderUsername === currentUser.username && (
                                <button onClick={() => { setEditingMessageId(contextMenuMsg.msg.id); setInputText(contextMenuMsg.msg.message); setContextMenuMsg(null); }} className="w-full text-right px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"><Edit2 size={16}/> ویرایش</button>
                            )}
                            <button onClick={() => { setSelectedMessages(new Set([contextMenuMsg.msg.id])); setSelectionMode(true); setContextMenuMsg(null); }} className="w-full text-right px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"><CheckSquare size={16}/> انتخاب</button>
                            <button onClick={() => { setMessages(prev => prev.filter(m => m.id !== contextMenuMsg.msg.id)); setContextMenuMsg(null); }} className="w-full text-right px-4 py-2 hover:bg-orange-50 text-orange-600 flex items-center gap-2 text-sm"><Trash2 size={16}/> حذف برای من</button>
                            {(contextMenuMsg.msg.senderUsername === currentUser.username || [UserRole.ADMIN, UserRole.MANAGER, UserRole.CEO].includes(currentUser.role as UserRole)) && (
                                <button 
                                    onClick={async () => { 
                                        if(confirm('آیا از حذف این پیام برای همه اطمینان دارید؟')) {
                                            try {
                                                await deleteMessage(contextMenuMsg.msg.id); 
                                                setMessages(prev => prev.filter(m => m.id !== contextMenuMsg.msg.id));
                                                onRefresh(); 
                                            } catch (e) { alert("خطا در حذف پیام"); }
                                        }
                                        setContextMenuMsg(null); 
                                    }} 
                                    className="w-full text-right px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 text-sm"
                                >
                                    <Trash2 size={16}/> حذف دو طرفه
                                </button>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* 2. Image Viewer */}
            {showImageViewer && (
                <div className="fixed inset-0 bg-black/90 z-[200] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center animate-fade-in" onClick={() => setShowImageViewer(null)}>
                    <img src={showImageViewer} className="max-w-[90%] max-h-[90%] rounded shadow-2xl" onClick={e => e.stopPropagation()}/>
                    <div className="absolute top-4 right-4 flex gap-4 z-50">
                        <button onClick={(e) => { 
                            e.stopPropagation(); 
                            downloadAndOpenFile(showImageViewer, 'image_' + Date.now() + '.jpg'); 
                        }} className="p-2 bg-white/20 rounded-full hover:bg-white/40 text-white"><DownloadCloud/></button>
                        <button onClick={(e) => { e.stopPropagation(); setShowImageViewer(null); }} className="p-2 bg-white/20 rounded-full hover:bg-white/40 text-white"><X/></button>
                    </div>
                </div>
            )}

            {/* 3. Forward Modal */}
            {showForwardModal && (
                <div className="fixed inset-0 bg-black/50 z-[200] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 backdrop-blur-sm">
                    <div className="glass-panel rounded-xl w-full max-w-md h-[80vh] flex flex-col shadow-2xl">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <span className="font-bold">ارسال به...</span>
                            <button onClick={() => setShowForwardModal(false)}><X size={20}/></button>
                        </div>
                        
                        {/* New Quote Toggle */}
                        <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-100">
                             <label className="flex items-center gap-2 cursor-pointer text-sm text-yellow-800">
                                 <input type="checkbox" checked={forwardNoQuote} onChange={e => setForwardNoQuote(e.target.checked)} className="w-4 h-4 rounded text-yellow-600"/>
                                 ارسال بدون نقل قول (مخفی کردن نام فرستنده)
                             </label>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2">
                            {getAllChannelsForForward().map((item: ChannelItem) => (
                                <div key={item.id} onClick={() => handleForward(item.id, item.type)} className="flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg cursor-pointer">
                                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold">
                                        {item.avatar ? <img src={resolveImageUrl(item.avatar)} className="w-full h-full rounded-full"/> : item.name.charAt(0)}
                                    </div>
                                    <div className="font-bold text-sm tracking-tight">{item.name} <span className="text-xs text-gray-400 font-normal mr-2">({item.type === 'private' ? 'شخصی' : item.type === 'public' ? 'عمومی' : 'گروه'})</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 3.1 Group Creation Modal */}
            {showGroupModal && (
                <div className="fixed inset-0 bg-black/50 z-[202] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="glass-panel rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-scale-in">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold flex items-center gap-2"><Users size={20} className="text-orange-500"/> ساخت گروه جدید</h3>
                            <button onClick={() => setShowGroupModal(false)} className="p-2 hover:bg-gray-200 rounded-full"><X size={20}/></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">نام گروه</label>
                                <input 
                                    type="text" 
                                    value={newGroupName} 
                                    onChange={e => setNewGroupName(e.target.value)}
                                    placeholder="مثلاً: واحد حسابداری"
                                    className="w-full p-3 bg-gray-100 rounded-xl border-none outline-none focus:ring-2 focus:ring-orange-200 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">انتخاب اعضا</label>
                                <div className="max-h-48 overflow-y-auto space-y-1 p-1 bg-gray-50 rounded-xl border border-gray-100">
                                    {users.filter(u => u.username !== currentUser.username).map(user => (
                                        <label key={user.username} className="flex justify-between items-center p-2 hover:glass-panel rounded-lg cursor-pointer group transition-colors">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs uppercase">
                                                    {user.fullName.charAt(0)}
                                                </div>
                                                <span className="text-sm">{user.fullName}</span>
                                            </div>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedGroupMembers.includes(user.username)}
                                                onChange={e => {
                                                    if (e.target.checked) setSelectedGroupMembers([...selectedGroupMembers, user.username]);
                                                    else setSelectedGroupMembers(selectedGroupMembers.filter(id => id !== user.username));
                                                }}
                                                className="w-4 h-4 rounded text-orange-500"
                                            />
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t flex gap-3">
                            <button onClick={handleCreateGroup} className="flex-1 bg-orange-500 text-white font-bold py-3 rounded-xl hover:bg-orange-600 transition-colors shadow-lg shadow-orange-100">ایجاد گروه</button>
                            <button onClick={() => setShowGroupModal(false)} className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-300 transition-colors">انصراف</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. Group Info & Management Modal */}
            {showGroupInfo && (
                <div className="fixed inset-0 bg-black/50 z-[300] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="glass-panel rounded-2xl w-full max-w-md h-[70vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in">
                        <div className="relative bg-gradient-to-br from-orange-500 to-orange-700 p-8 text-white flex flex-col items-center">
                            <button onClick={() => setShowGroupInfo(null)} className="absolute top-4 left-4 p-2 bg-black/20 rounded-full hover:bg-black/30"><X size={20}/></button>
                            <div className="relative group/avatar">
                                <div className="w-20 h-20 rounded-3xl bg-white/20 flex items-center justify-center text-3xl font-black mb-3 shadow-lg backdrop-blur-md overflow-hidden">
                                    {showGroupInfo.avatar ? <img src={resolveImageUrl(showGroupInfo.avatar)} className="w-full h-full object-cover"/> : showGroupInfo.name.charAt(0)}
                                </div>
                                {(showGroupInfo.createdBy === currentUser.username || ((showGroupInfo as any).admins || []).includes(currentUser.username) || currentUser.role === UserRole.ADMIN) && (
                                    <button 
                                        onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = 'image/*';
                                            input.onchange = async (e: any) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = async (re) => {
                                                        const result = await uploadFile(file.name, re.target?.result as string);
                                                        handleUpdateGroup(showGroupInfo.id, { avatar: result.url });
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            };
                                            input.click();
                                        }}
                                        className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-3xl opacity-0 group-hover/avatar:opacity-100 transition-opacity backdrop-blur-[2px]"
                                    >
                                        <Camera size={24} className="text-white"/>
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-black">{showGroupInfo.name}</h3>
                                {(showGroupInfo.createdBy === currentUser.username || ((showGroupInfo as any).admins || []).includes(currentUser.username) || currentUser.role === UserRole.ADMIN) && (
                                    <button 
                                        onClick={() => {
                                            const newName = prompt('نام جدید گروه را وارد کنید:', showGroupInfo.name);
                                            if (newName && newName !== showGroupInfo.name) {
                                                handleUpdateGroup(showGroupInfo.id, { name: newName });
                                            }
                                        }}
                                        className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                                    >
                                        <Edit2 size={14}/>
                                    </button>
                                )}
                            </div>
                            <p className="text-xs opacity-80 mt-1">{showGroupInfo.members.length} عضو</p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <Bell size={20} className={showGroupInfo && mutedChannels.has(showGroupInfo.id) ? "text-gray-300" : "text-blue-500"}/>
                                    <span className="text-sm font-bold text-gray-700">اعلان‌ها و صدا</span>
                                </div>
                                <button 
                                    onClick={() => {
                                        const newMuted = new Set(mutedChannels);
                                        if (newMuted.has(showGroupInfo.id)) newMuted.delete(showGroupInfo.id);
                                        else newMuted.add(showGroupInfo.id);
                                        setMutedChannels(newMuted);
                                    }}
                                    className={`w-12 h-6 rounded-full relative p-1 transition-colors ${mutedChannels.has(showGroupInfo.id) ? 'bg-gray-300' : 'bg-green-500'}`}
                                >
                                    <div className={`w-4 h-4 glass-panel rounded-full absolute top-1 transition-all ${mutedChannels.has(showGroupInfo.id) ? 'left-1' : 'right-1'}`}></div>
                                </button>
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">اعضای گروه</h4>
                                {showGroupInfo.members.map(username => {
                                    const u = users.find(user => user.username === username);
                                    const isCreator = showGroupInfo.createdBy === username;
                                    const isAdmin = (showGroupInfo.admins || []).includes(username);
                                    const isMe = currentUser.username === username;
                                    const canManage = (showGroupInfo.admins || []).includes(currentUser.username) || currentUser.role === UserRole.ADMIN;
                                    
                                    return (
                                        <div key={username} className="flex items-center justify-between group/member p-2 hover:bg-gray-50 rounded-xl transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-sm font-bold overflow-hidden">
                                                    {u?.avatar ? <img src={resolveImageUrl(u.avatar)} className="w-full h-full object-cover"/> : (u?.fullName.charAt(0) || username.charAt(0))}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-800">{u?.fullName || username} {isMe && '(شما)'}</span>
                                                    <span className="text-[10px] text-gray-400">@{username}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {isCreator && <span className="text-[9px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">سازنده</span>}
                                                {!isCreator && isAdmin && <span className="text-[9px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">مدیر</span>}
                                                
                                                {canManage && !isCreator && !isMe && (
                                                    <div className="flex gap-1 ml-2">
                                                        {!showGroupInfo.isTaskGroup && (
                                                            <button 
                                                                onClick={() => handleToggleAdminStatus(showGroupInfo.id, username)}
                                                                className={`p-1.5 rounded-lg hover:glass-panel shadow-sm transition-all ${isAdmin ? 'text-blue-500' : 'text-gray-400'}`}
                                                                title={isAdmin ? 'سلب مدیریت' : 'ارتقا به مدیر'}
                                                            >
                                                                <Shield size={14}/>
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={() => handleRemoveMemberFromGroup(showGroupInfo.id, username)}
                                                            className="p-1.5 text-red-400 hover:text-red-600 hover:glass-panel shadow-sm rounded-lg transition-all"
                                                            title="حذف از گروه"
                                                        >
                                                            <UserMinus size={14}/>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {((showGroupInfo.admins || []).includes(currentUser.username) || showGroupInfo.createdBy === currentUser.username || currentUser.role === UserRole.ADMIN) && (
                                <div className="pt-4 border-t space-y-2">
                                    <button 
                                        onClick={() => handleAddMemberToGroup(showGroupInfo.id)}
                                        className="w-full bg-blue-50 text-blue-600 p-3 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <UserPlus size={18}/> افزودن عضو جدید
                                    </button>
                                    <button onClick={() => { 
                                        if(confirm('گروه حذف شود؟')) { 
                                            if (showGroupInfo.isTaskGroup) {
                                                deleteTaskGroup(showGroupInfo.id);
                                            } else {
                                                deleteGroup(showGroupInfo.id); 
                                            }
                                            setShowGroupInfo(null); 
                                            setActiveChannel(null); 
                                            onRefresh(); 
                                        } 
                                    }} className="w-full bg-red-50 text-red-600 p-3 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                                        <Trash2 size={18}/> حذف و انحلال گروه
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 5. Contact Info Modal */}
            {showContactInfo && (
                <div className="fixed inset-0 bg-black/50 z-[300] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={()=>setShowContactInfo(null)}>
                    <div className="glass-panel rounded-2xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden animate-scale-in" onClick={e=>e.stopPropagation()}>
                        <div className="relative bg-gradient-to-br from-blue-500 to-blue-700 p-8 text-white flex flex-col items-center">
                            <button onClick={() => setShowContactInfo(null)} className="absolute top-4 left-4 p-2 bg-black/20 rounded-full hover:bg-black/30"><X size={20}/></button>
                            <div className="w-24 h-24 rounded-full bg-white/20 p-1 mb-3">
                                <div className="w-full h-full rounded-full glass-panel flex items-center justify-center text-blue-600 text-4xl font-black shadow-inner overflow-hidden">
                                    {showContactInfo.avatar ? <img src={resolveImageUrl(showContactInfo.avatar)} className="w-full h-full object-cover"/> : showContactInfo.fullName.charAt(0)}
                                </div>
                            </div>
                            <h3 className="text-xl font-black">{showContactInfo.fullName}</h3>
                            <p className="text-xs opacity-80 mt-1">@{showContactInfo.username}</p>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <Bell size={20} className="text-gray-400"/>
                                    <span className="text-sm font-bold text-gray-700">بی‌صدا کردن</span>
                                </div>
                                <button className="w-12 h-6 bg-gray-300 rounded-full relative p-1">
                                    <div className="w-4 h-4 glass-panel rounded-full absolute left-1 transition-all"></div>
                                </button>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center gap-3 text-gray-600">
                                    <UserIcon size={18}/>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-400">نقش سیستم</span>
                                        <span className="text-sm font-bold">{showContactInfo.role}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-gray-600">
                                    <MessageSquare size={18}/>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-400">آخرین فعالیت</span>
                                        <span className="text-sm font-medium">{formatLastSeen(showContactInfo.lastSeen)}</span>
                                    </div>
                                </div>
                            </div>

                            <button className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-100 hover:shadow-xl transition-all" onClick={() => { setActiveChannel({type: 'private', id: showContactInfo.username}); setShowContactInfo(null); }}>
                                ارسال پیام
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 6. Custom Task Creation Modal */}
            {showCreateTaskModal && (
                <div className="fixed inset-0 bg-black/50 z-[301] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={() => setShowCreateTaskModal(false)}>
                    <div className="glass-panel rounded-2xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-800 bg-white dark:bg-gray-900">
                            <h3 className="font-bold flex items-center gap-2 text-gray-800 dark:text-gray-100"><ListTodo size={20} className="text-blue-500"/> ایجاد تسک جدید</h3>
                            <button onClick={() => setShowCreateTaskModal(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400"><X size={20}/></button>
                        </div>
                        
                        {/* Scrollable Form Body */}
                        <div className="p-4 space-y-4 overflow-y-auto max-h-[55vh] custom-scrollbar">
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">عنوان تسک <span className="text-red-500">*</span></label>
                                <input 
                                    ref={taskTitleInputRef}
                                    type="text" 
                                    value={taskTitle} 
                                    onChange={e => setTaskTitle(e.target.value)}
                                    placeholder="مثلاً: بررسی تراکنش‌های حسابداری"
                                    className="w-full p-3 bg-gray-100 dark:bg-gray-950 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-200 text-sm font-bold text-gray-800 dark:text-gray-200"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">توضیحات و جزئیات تسک</label>
                                <textarea 
                                    value={taskDescription} 
                                    onChange={e => setTaskDescription(e.target.value)}
                                    placeholder="شرح وظایف و جزئیات بیشتر در مورد تسک..."
                                    rows={4}
                                    className="w-full p-3 bg-gray-100 dark:bg-gray-950 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-200 text-sm resize-none text-gray-800 dark:text-gray-200"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">ارجاع به کاربر خاص (مسئولین تسک)</label>
                                
                                {/* Selected Assignees Chips */}
                                {taskAssignedTo.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-2 p-2 bg-gray-50 dark:bg-gray-950/40 rounded-xl border border-dashed border-gray-100 dark:border-gray-800">
                                        {taskAssignedTo.map(username => {
                                            const matchedUser = users.find(u => u.username === username);
                                            const name = matchedUser ? matchedUser.fullName : username;
                                            return (
                                                <div key={username} className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950/55 border border-blue-100 dark:border-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-lg text-xs font-bold animate-scale-in">
                                                    <div className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[8px] font-black uppercase">
                                                        {name.charAt(0)}
                                                    </div>
                                                    <span>{name}</span>
                                                    <button 
                                                        type="button"
                                                        onClick={() => setTaskAssignedTo(prev => prev.filter(un => un !== username))}
                                                        className="hover:bg-blue-100 dark:hover:bg-blue-900/60 p-0.5 rounded text-blue-500 hover:text-blue-700 transition cursor-pointer"
                                                    >
                                                        <X size={10} className="stroke-[3]" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Searchable Dropdown */}
                                <div className="relative">
                                    <div className="relative flex items-center bg-gray-100 dark:bg-gray-950 rounded-xl px-3 border border-transparent focus-within:border-blue-500 transition-colors">
                                        <Search size={16} className="text-gray-400 shrink-0 ml-2" />
                                        <input 
                                            type="text"
                                            value={userSearchText}
                                            onChange={e => setUserSearchText(e.target.value)}
                                            placeholder="جستجو و ارجاع کاربر جدید..."
                                            className="w-full py-2.5 bg-transparent border-none outline-none text-xs font-bold text-right text-gray-800 dark:text-gray-200"
                                        />
                                        {userSearchText && (
                                            <button 
                                                type="button"
                                                onClick={() => setUserSearchText('')}
                                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full text-gray-400 hover:text-gray-600 transition cursor-pointer"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Dropdown Box - Always visible if group has users, filtered by search */}
                                    <div className="mt-1 max-h-40 overflow-y-auto border border-gray-100 dark:border-gray-800/60 rounded-xl shadow-lg bg-white dark:bg-gray-900 custom-scrollbar absolute w-full z-10 left-0 right-0 animate-fade-in divide-y divide-gray-50 dark:divide-gray-800/40">
                                        {(() => {
                                            const tg = taskGroups.find(g => g.id === activeChannel.id);
                                            const filtered = users.filter(u => {
                                                const isMember = !tg || (tg.members || []).includes(u.username);
                                                const isSelf = currentUser && u.username === currentUser.username;
                                                const matchesSearch = u.fullName.toLowerCase().includes(userSearchText.toLowerCase()) || u.username.toLowerCase().includes(userSearchText.toLowerCase());
                                                return (isMember || isSelf) && matchesSearch;
                                            });

                                            if (filtered.length === 0) {
                                                return (
                                                    <div className="p-3 text-center text-xs text-gray-400">
                                                        کاربری یافت نشد 🔍
                                                    </div>
                                                );
                                            }

                                            return filtered.map(u => {
                                                const isSelected = taskAssignedTo.includes(u.username);
                                                const isCurrentUser = currentUser && u.username === currentUser.username;
                                                return (
                                                    <button
                                                        key={u.username}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setTaskAssignedTo(prev => prev.filter(un => un !== u.username));
                                                            } else {
                                                                setTaskAssignedTo(prev => [...prev, u.username]);
                                                            }
                                                            setUserSearchText('');
                                                        }}
                                                        className="w-full flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-850 text-right transition cursor-pointer"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-black text-[10px]">
                                                                {u.fullName.charAt(0)}
                                                            </div>
                                                            <div className="flex flex-col text-right">
                                                                <span className="font-bold text-xs text-gray-800 dark:text-gray-200">
                                                                    {u.fullName} {isCurrentUser && <span className="text-[9px] text-green-600 bg-green-50 dark:bg-green-950/40 px-1 py-0.5 rounded mr-1 font-semibold">(خودم)</span>}
                                                                </span>
                                                                <span className="text-[9px] text-gray-400">@{u.username}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-center">
                                                            {isSelected ? (
                                                                <div className="w-4 h-4 rounded bg-blue-600 text-white flex items-center justify-center">
                                                                    <Check size={10} className="stroke-[3]" />
                                                                </div>
                                                            ) : (
                                                                <div className="w-4 h-4 rounded border-2 border-gray-200 dark:border-gray-850" />
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">زمان و تاریخ مهلت (Due Date)</label>
                                <input 
                                    type="datetime-local" 
                                    value={taskDueDate} 
                                    onChange={e => setTaskDueDate(e.target.value)}
                                    className="w-full p-3 bg-gray-100 dark:bg-gray-950 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-200 text-sm text-gray-800 dark:text-gray-200"
                                />
                            </div>
                        </div>

                        {/* Fixed Footer for register/submit button */}
                        <div className="p-4 border-t bg-gray-50 dark:bg-gray-800/50 flex items-center justify-end">
                            <button 
                                onClick={() => {
                                    if (!taskTitle.trim()) return;
                                    const newTask: GroupTask = {
                                        id: generateUUID(),
                                        groupId: activeChannel.id!,
                                        title: taskTitle.trim(),
                                        description: taskDescription.trim() || undefined,
                                        assignedTo: taskAssignedTo,
                                        dueDate: taskDueDate || undefined,
                                        status: 'pending',
                                        createdBy: currentUser.username,
                                        createdAt: Date.now(),
                                        replies: []
                                    };
                                    createTask(newTask).then(() => {
                                        setTasks(prev => [newTask, ...prev]);
                                        setShowCreateTaskModal(false);
                                    });
                                }}
                                disabled={!taskTitle.trim()}
                                className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-100 disabled:opacity-50 hover:bg-blue-700 transition-all"
                            >
                                ثبت و ایجاد تسک
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 7. Custom Task Details & Conversation/Replies Modal */}
            {activeTaskForDetail && (
                <div className="fixed inset-0 bg-black/50 z-[301] flex items-start pt-12 md:pt-20 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={() => setActiveTaskForDetail(null)}>
                    <div className="glass-panel rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                            <div className="flex items-center gap-2">
                                <ListTodo size={20} className="text-blue-500"/>
                                <h3 className="font-bold text-gray-800 dark:text-gray-100">جزئیات و گفتگو درباره تسک</h3>
                            </div>
                            <button onClick={() => setActiveTaskForDetail(null)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"><X size={20}/></button>
                        </div>
                        <div className="p-5 flex-1 overflow-y-auto max-h-[65vh] space-y-4 custom-scrollbar">
                            <div className="flex items-start gap-3">
                                <button 
                                    onClick={() => {
                                        const newStatus = activeTaskForDetail.status === 'completed' ? 'pending' : 'completed';
                                        const updatedTask = { 
                                            ...activeTaskForDetail, 
                                            status: newStatus as any,
                                            completedBy: newStatus === 'completed' ? currentUser.username : undefined,
                                            completedAt: newStatus === 'completed' ? Date.now() : undefined
                                        };
                                        updateTask(updatedTask).then(() => {
                                            setTasks(prev => prev.map(t => t.id === activeTaskForDetail.id ? updatedTask : t));
                                            setActiveTaskForDetail(updatedTask);
                                        });
                                    }}
                                    className={`mt-1 rounded-full border-2 transition-colors flex items-center justify-center ${activeTaskForDetail.status === 'completed' ? 'bg-green-500 border-green-500 w-6 h-6' : 'border-gray-300 w-6 h-6 glass-panel shrink-0'}`}
                                >
                                    {activeTaskForDetail.status === 'completed' && <Check size={16} className="text-white"/>}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <h4 className={`text-lg font-black leading-snug break-words ${activeTaskForDetail.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-white'}`}>{activeTaskForDetail.title}</h4>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 mt-2">
                                        <span>ایجادکننده: @{activeTaskForDetail.createdBy}</span>
                                        <span>ثبت: {formatDate(activeTaskForDetail.createdAt)}</span>
                                        {activeTaskForDetail.status === 'completed' && activeTaskForDetail.completedAt && (
                                            <span className="text-green-600 font-bold bg-green-50 dark:bg-green-950/20 px-2 py-0.5 rounded">توسط: @{activeTaskForDetail.completedBy} در {formatDate(activeTaskForDetail.completedAt)}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Description / Extra Details */}
                            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-1">
                                <h5 className="text-xs font-bold text-gray-400">جزئیات و توضیحات</h5>
                                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                    {activeTaskForDetail.description || 'توضیحات بیشتری برای این تسک ثبت نشده است.'}
                                </p>
                            </div>

                            {/* Assigned users */}
                            <div className="space-y-2">
                                <h5 className="text-xs font-bold text-gray-400">مسئولین تسک</h5>
                                <div className="flex flex-wrap gap-2">
                                    {(!activeTaskForDetail.assignedTo || activeTaskForDetail.assignedTo.length === 0) ? (
                                        <span className="text-xs text-gray-400 italic">به شخص خاصی ارجاع داده نشده است (عمومی)</span>
                                    ) : (
                                        activeTaskForDetail.assignedTo.map(username => {
                                            const u = users.find(user => user.username === username);
                                            return (
                                                <div key={username} className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-full text-xs font-bold border border-blue-100">
                                                    <div className="w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-[10px] font-black overflow-hidden">
                                                        {u?.avatar ? <img src={resolveImageUrl(u.avatar)} className="w-full h-full object-cover"/> : username.charAt(0)}
                                                    </div>
                                                    <span>{u?.fullName || username}</span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Due Date */}
                            {activeTaskForDetail.dueDate && (
                                <div className="flex items-center gap-2 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-100">
                                    <Clock size={16}/>
                                    <span>مهلت انجام: {formatDate(new Date(activeTaskForDetail.dueDate).getTime())}</span>
                                </div>
                            )}

                            {/* Conversation/Replies List */}
                            <div className="border-t pt-4 space-y-3">
                                <h5 className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2">
                                    <MessageSquare size={16} className="text-blue-500"/>
                                    گفتگو و پاسخ‌ها ({activeTaskForDetail.replies?.length || 0})
                                </h5>
                                <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                                    {(!activeTaskForDetail.replies || activeTaskForDetail.replies.length === 0) ? (
                                        <p className="text-xs text-gray-400 italic text-center py-6">پاسخی برای این تسک ثبت نشده است. بحث خود را آغاز کنید!</p>
                                    ) : (
                                        activeTaskForDetail.replies.map(reply => (
                                            <div key={reply.id} className="p-3 bg-gray-50/75 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1">
                                                <div className="flex justify-between items-center text-[10px] font-bold text-gray-400">
                                                    <span>{reply.sender} (@{reply.senderUsername})</span>
                                                    <span>{formatDate(reply.timestamp)}</span>
                                                </div>
                                                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{reply.message}</p>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Reply Input Area */}
                                <div className="flex items-end gap-2 pt-2">
                                    <textarea 
                                        value={taskReplyText}
                                        onChange={e => setTaskReplyText(e.target.value)}
                                        placeholder="پاسخ خود را بنویسید..."
                                        rows={2}
                                        className="flex-1 p-2 bg-gray-50 dark:bg-gray-900 border rounded-xl text-xs focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                                    />
                                    <button 
                                        onClick={() => {
                                            if (!taskReplyText.trim()) return;
                                            const newReply = {
                                                id: generateUUID(),
                                                sender: currentUser.fullName || currentUser.username,
                                                senderUsername: currentUser.username,
                                                message: taskReplyText.trim(),
                                                timestamp: Date.now()
                                            };
                                            const updatedTask = {
                                                ...activeTaskForDetail,
                                                replies: [...(activeTaskForDetail.replies || []), newReply]
                                            };
                                            updateTask(updatedTask).then(() => {
                                                setTasks(prev => prev.map(t => t.id === activeTaskForDetail.id ? updatedTask : t));
                                                setActiveTaskForDetail(updatedTask);
                                                setTaskReplyText('');
                                            });
                                        }}
                                        disabled={!taskReplyText.trim()}
                                        className="bg-blue-600 disabled:opacity-50 text-white px-4 py-2 h-10 rounded-xl text-xs font-bold hover:bg-blue-700 transition flex items-center justify-center gap-1.5 shrink-0"
                                    >
                                        <Send size={14}/> ثبت پاسخ
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
    );
};

export default ChatRoom;
