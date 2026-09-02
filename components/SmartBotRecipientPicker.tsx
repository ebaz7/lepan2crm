import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  User as UserIcon, 
  Bot, 
  Send, 
  MessageSquare, 
  Search, 
  Check, 
  X, 
  Plus, 
  Building2, 
  Phone, 
  ShieldCheck, 
  Sparkles,
  CheckCheck,
  HelpCircle
} from 'lucide-react';
import { User, SystemSettings } from '../types';
import { getUsers } from '../services/authService';

export interface SmartRecipient {
  id: string; // Unique key in picker (e.g. `user_123_bale`)
  name: string;
  detail?: string;
  roleTitle?: string;
  roleFa?: string;
  platform: 'telegram' | 'bale' | 'whatsapp';
  chatId: string;
  sourceType: 'user' | 'contact' | 'group' | 'lead' | 'custom';
  avatar?: string;
  phoneNumber?: string;
}

interface SmartBotRecipientPickerProps {
  selectedPlatforms: ('telegram' | 'bale' | 'whatsapp')[];
  selectedChatIdsTele?: string[];
  selectedChatIdsBale?: string[];
  selectedChatIdsWa?: string[];
  onChangeTele?: (chatIds: string[]) => void;
  onChangeBale?: (chatIds: string[]) => void;
  onChangeWa?: (chatIds: string[]) => void;
  // Legacy single string bindings support (comma separated)
  valueTele?: string;
  valueBale?: string;
  valueWa?: string;
  onChangeValueTele?: (val: string) => void;
  onChangeValueBale?: (val: string) => void;
  onChangeValueWa?: (val: string) => void;
  settings?: SystemSettings;
  users?: User[];
  label?: string;
  compact?: boolean;
}

export const SmartBotRecipientPicker: React.FC<SmartBotRecipientPickerProps> = ({
  selectedPlatforms,
  selectedChatIdsTele = [],
  selectedChatIdsBale = [],
  selectedChatIdsWa = [],
  onChangeTele,
  onChangeBale,
  onChangeWa,
  valueTele = '',
  valueBale = '',
  valueWa = '',
  onChangeValueTele,
  onChangeValueBale,
  onChangeValueWa,
  settings,
  users: propUsers,
  label = 'انتخاب هوشمند مخاطبین و گروه‌های دریافت‌کننده پیام:',
  compact = false
}) => {
  const [systemUsers, setSystemUsers] = useState<User[]>(propUsers || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'users' | 'contacts' | 'groups'>('all');
  const [customInput, setCustomInput] = useState('');
  const [customInputPlatform, setCustomInputPlatform] = useState<'bale' | 'telegram' | 'whatsapp'>('bale');

  // Load system users if not passed via props
  useEffect(() => {
    if (propUsers && propUsers.length > 0) {
      setSystemUsers(propUsers);
    } else {
      getUsers().then(res => {
        if (Array.isArray(res)) setSystemUsers(res);
      }).catch(err => console.warn('Could not fetch users for SmartBotRecipientPicker:', err));
    }
  }, [propUsers]);

  // Sync custom input default platform with selected platforms
  useEffect(() => {
    if (selectedPlatforms.includes('bale')) {
      setCustomInputPlatform('bale');
    } else if (selectedPlatforms.includes('telegram')) {
      setCustomInputPlatform('telegram');
    } else if (selectedPlatforms.includes('whatsapp')) {
      setCustomInputPlatform('whatsapp');
    }
  }, [selectedPlatforms]);

  // Resolve current active selected chat IDs
  const activeTeleIds = useMemo(() => {
    if (selectedChatIdsTele.length > 0) return selectedChatIdsTele;
    if (valueTele) {
      return valueTele.split(/[,،;\n\r]+/).map(s => s.trim()).filter(Boolean);
    }
    return [];
  }, [selectedChatIdsTele, valueTele]);

  const activeBaleIds = useMemo(() => {
    if (selectedChatIdsBale.length > 0) return selectedChatIdsBale;
    if (valueBale) {
      return valueBale.split(/[,،;\n\r]+/).map(s => s.trim()).filter(Boolean);
    }
    return [];
  }, [selectedChatIdsBale, valueBale]);

  const activeWaIds = useMemo(() => {
    if (selectedChatIdsWa.length > 0) return selectedChatIdsWa;
    if (valueWa) {
      return valueWa.split(/[,،;\n\r]+/).map(s => s.trim()).filter(Boolean);
    }
    return [];
  }, [selectedChatIdsWa, valueWa]);

  // Helper updater
  const updateTeleList = (newList: string[]) => {
    const cleanList = Array.from(new Set(newList.map(s => s.trim()).filter(Boolean)));
    if (onChangeTele) onChangeTele(cleanList);
    if (onChangeValueTele) onChangeValueTele(cleanList.join(', '));
  };

  const updateBaleList = (newList: string[]) => {
    const cleanList = Array.from(new Set(newList.map(s => s.trim()).filter(Boolean)));
    if (onChangeBale) onChangeBale(cleanList);
    if (onChangeValueBale) onChangeValueBale(cleanList.join(', '));
  };

  const updateWaList = (newList: string[]) => {
    const cleanList = Array.from(new Set(newList.map(s => s.trim()).filter(Boolean)));
    if (onChangeWa) onChangeWa(cleanList);
    if (onChangeValueWa) onChangeValueWa(cleanList.join(', '));
  };

  const toggleRecipient = (recipient: SmartRecipient) => {
    const { platform, chatId } = recipient;
    if (platform === 'bale') {
      if (activeBaleIds.includes(chatId)) {
        updateBaleList(activeBaleIds.filter(id => id !== chatId));
      } else {
        updateBaleList([...activeBaleIds, chatId]);
      }
    } else if (platform === 'telegram') {
      if (activeTeleIds.includes(chatId)) {
        updateTeleList(activeTeleIds.filter(id => id !== chatId));
      } else {
        updateTeleList([...activeTeleIds, chatId]);
      }
    } else if (platform === 'whatsapp') {
      if (activeWaIds.includes(chatId)) {
        updateWaList(activeWaIds.filter(id => id !== chatId));
      } else {
        updateWaList([...activeWaIds, chatId]);
      }
    }
  };

  const removeId = (platform: 'telegram' | 'bale' | 'whatsapp', idToRemove: string) => {
    if (platform === 'bale') {
      updateBaleList(activeBaleIds.filter(id => id !== idToRemove));
    } else if (platform === 'telegram') {
      updateTeleList(activeTeleIds.filter(id => id !== idToRemove));
    } else if (platform === 'whatsapp') {
      updateWaList(activeWaIds.filter(id => id !== idToRemove));
    }
  };

  const handleAddManualId = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = customInput.trim();
    if (!raw) return;

    if (customInputPlatform === 'bale') {
      updateBaleList([...activeBaleIds, raw]);
    } else if (customInputPlatform === 'telegram') {
      updateTeleList([...activeTeleIds, raw]);
    } else if (customInputPlatform === 'whatsapp') {
      updateWaList([...activeWaIds, raw]);
    }
    setCustomInput('');
  };

  // Compile full catalog of intelligent recipients
  const allSmartRecipients = useMemo(() => {
    const list: SmartRecipient[] = [];

    // 1. SYSTEM USERS
    systemUsers.forEach(u => {
      const roleName = typeof u.role === 'string' ? u.role : '';
      let roleFa = 'کاربر سامانه';
      if (roleName === 'admin') roleFa = 'مدیر ارشد سامانه';
      else if (roleName === 'ceo') roleFa = 'مدیرعامل';
      else if (roleName === 'financial') roleFa = 'مدیر مالی / حسابداری';
      else if (roleName === 'sales_manager') roleFa = 'مدیر فروش';
      else if (roleName === 'factory_manager') roleFa = 'مدیر کارخانه / فنی';
      else if (roleName === 'warehouse_keeper') roleFa = 'مسئول انبار';
      else if (roleName === 'commercial') roleFa = 'بازرگانی و تدارکات';
      else if (roleName === 'security_head' || roleName === 'security_guard') roleFa = 'حراست و انتظامات';

      // Bale Account
      const baleId = u.baleChatId || (u as any).baleId;
      if (baleId && String(baleId).trim()) {
        list.push({
          id: `usr_${u.id}_bale`,
          name: u.fullName || u.username,
          detail: `@${u.username} | ${roleFa}`,
          roleTitle: roleFa,
          platform: 'bale',
          chatId: String(baleId).trim(),
          sourceType: 'user',
          avatar: u.avatar,
          phoneNumber: u.phoneNumber
        });
      }

      // Telegram Account
      const tgId = u.telegramChatId || (u as any).telegramId;
      if (tgId && String(tgId).trim()) {
        list.push({
          id: `usr_${u.id}_tele`,
          name: u.fullName || u.username,
          detail: `@${u.username} | ${roleFa}`,
          roleTitle: roleFa,
          platform: 'telegram',
          chatId: String(tgId).trim(),
          sourceType: 'user',
          avatar: u.avatar,
          phoneNumber: u.phoneNumber
        });
      }

      // WhatsApp / Phone
      if (u.phoneNumber && String(u.phoneNumber).trim()) {
        list.push({
          id: `usr_${u.id}_wa`,
          name: u.fullName || u.username,
          detail: `${u.phoneNumber} | ${roleFa}`,
          roleTitle: roleFa,
          platform: 'whatsapp',
          chatId: String(u.phoneNumber).trim(),
          sourceType: 'user',
          avatar: u.avatar,
          phoneNumber: u.phoneNumber
        });
      }
    });

    // 2. CRM SALES CONTACTS
    const salesContacts = (settings?.salesContacts || []) as any[];
    salesContacts.forEach((sc, idx) => {
      const companyOrTitle = sc.company || sc.position || 'مشتری / مخاطب تجاری';

      if (sc.baleId && String(sc.baleId).trim()) {
        list.push({
          id: `sc_${sc.id || idx}_bale`,
          name: sc.name || 'مخاطب بدون نام',
          detail: `${sc.mobile || ''} (${companyOrTitle})`,
          roleTitle: companyOrTitle,
          platform: 'bale',
          chatId: String(sc.baleId).trim(),
          sourceType: 'contact',
          phoneNumber: sc.mobile
        });
      }

      if (sc.telegramId && String(sc.telegramId).trim()) {
        list.push({
          id: `sc_${sc.id || idx}_tele`,
          name: sc.name || 'مخاطب بدون نام',
          detail: `${sc.mobile || ''} (${companyOrTitle})`,
          roleTitle: companyOrTitle,
          platform: 'telegram',
          chatId: String(sc.telegramId).trim(),
          sourceType: 'contact',
          phoneNumber: sc.mobile
        });
      }

      if (sc.mobile && String(sc.mobile).trim()) {
        list.push({
          id: `sc_${sc.id || idx}_wa`,
          name: sc.name || 'مخاطب بدون نام',
          detail: `${sc.mobile} (${companyOrTitle})`,
          roleTitle: companyOrTitle,
          platform: 'whatsapp',
          chatId: String(sc.mobile).trim(),
          sourceType: 'contact',
          phoneNumber: sc.mobile
        });
      }
    });

    // 3. SYSTEM DEFAULT BOT GROUPS & CHANNELS
    if (settings) {
      const s = settings as any;
      // Bale Groups
      if (s.baleGroupId) {
        list.push({
          id: 'grp_bale_main',
          name: 'گروه اصلی بله (پیش‌فرض سیستم)',
          detail: `شناسه: ${s.baleGroupId}`,
          roleTitle: 'گروه بله',
          platform: 'bale',
          chatId: String(s.baleGroupId).trim(),
          sourceType: 'group'
        });
      }
      if (s.botAccountingGroupIdBale && s.botAccountingGroupIdBale !== s.baleGroupId) {
        list.push({
          id: 'grp_bale_acc',
          name: 'گروه مالی و حسابداری بله',
          detail: `شناسه: ${s.botAccountingGroupIdBale}`,
          roleTitle: 'گروه مالی',
          platform: 'bale',
          chatId: String(s.botAccountingGroupIdBale).trim(),
          sourceType: 'group'
        });
      }
      if (s.dailySalesBaleGroupId && s.dailySalesBaleGroupId !== s.baleGroupId) {
        list.push({
          id: 'grp_bale_sales',
          name: 'گروه گزارش فروش روزانه بله',
          detail: `شناسه: ${s.dailySalesBaleGroupId}`,
          roleTitle: 'گروه فروش',
          platform: 'bale',
          chatId: String(s.dailySalesBaleGroupId).trim(),
          sourceType: 'group'
        });
      }

      // Telegram Groups
      if (s.telegramGroupId) {
        list.push({
          id: 'grp_tele_main',
          name: 'گروه اصلی تلگرام (پیش‌فرض سیستم)',
          detail: `شناسه: ${s.telegramGroupId}`,
          roleTitle: 'گروه تلگرام',
          platform: 'telegram',
          chatId: String(s.telegramGroupId).trim(),
          sourceType: 'group'
        });
      }
      if (s.botAccountingGroupIdTele && s.botAccountingGroupIdTele !== s.telegramGroupId) {
        list.push({
          id: 'grp_tele_acc',
          name: 'گروه مالی و حسابداری تلگرام',
          detail: `شناسه: ${s.botAccountingGroupIdTele}`,
          roleTitle: 'گروه مالی',
          platform: 'telegram',
          chatId: String(s.botAccountingGroupIdTele).trim(),
          sourceType: 'group'
        });
      }
      if (s.dailySalesTelegramGroupId && s.dailySalesTelegramGroupId !== s.telegramGroupId) {
        list.push({
          id: 'grp_tele_sales',
          name: 'گروه گزارش فروش روزانه تلگرام',
          detail: `شناسه: ${s.dailySalesTelegramGroupId}`,
          roleTitle: 'گروه فروش',
          platform: 'telegram',
          chatId: String(s.dailySalesTelegramGroupId).trim(),
          sourceType: 'group'
        });
      }
    }

    return list;
  }, [systemUsers, settings]);

  // Filter list by selected platform and search query
  const filteredRecipients = useMemo(() => {
    return allSmartRecipients.filter(r => {
      // 1. Platform must be selected
      if (!selectedPlatforms.includes(r.platform)) return false;

      // 2. Tab Filter
      if (activeTab === 'users' && r.sourceType !== 'user') return false;
      if (activeTab === 'contacts' && r.sourceType !== 'contact') return false;
      if (activeTab === 'groups' && r.sourceType !== 'group') return false;

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = r.name.toLowerCase().includes(q);
        const matchDetail = r.detail ? r.detail.toLowerCase().includes(q) : false;
        const matchRole = r.roleFa ? (r as any).roleFa.toLowerCase().includes(q) : false;
        const matchId = r.chatId.toLowerCase().includes(q);
        const matchPhone = r.phoneNumber ? r.phoneNumber.includes(q) : false;
        return matchName || matchDetail || matchRole || matchId || matchPhone;
      }

      return true;
    });
  }, [allSmartRecipients, selectedPlatforms, activeTab, searchQuery]);

  // Helpers to check selection
  const isSelected = (r: SmartRecipient) => {
    if (r.platform === 'bale') return activeBaleIds.includes(r.chatId);
    if (r.platform === 'telegram') return activeTeleIds.includes(r.chatId);
    if (r.platform === 'whatsapp') return activeWaIds.includes(r.chatId);
    return false;
  };

  // Find recipient object for given chatId if available
  const findRecipientInfo = (platform: 'telegram' | 'bale' | 'whatsapp', chatId: string) => {
    const found = allSmartRecipients.find(r => r.platform === platform && r.chatId === chatId);
    if (found) return found;
    return {
      name: `شناسه ${chatId}`,
      chatId,
      platform,
      sourceType: 'custom' as const
    };
  };

  // Select all matching
  const handleSelectAllPlatform = (platform: 'bale' | 'telegram') => {
    const matching = allSmartRecipients.filter(r => r.platform === platform);
    const ids = matching.map(r => r.chatId);
    if (platform === 'bale') {
      updateBaleList([...activeBaleIds, ...ids]);
    } else {
      updateTeleList([...activeTeleIds, ...ids]);
    }
  };

  const totalSelectedCount = activeBaleIds.length + activeTeleIds.length + activeWaIds.length;

  return (
    <div className="space-y-3" dir="rtl">
      {/* Label and Selected Counter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-200">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          <span>{label}</span>
        </div>
        <span className="text-[11px] font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-200 dark:border-indigo-800/80">
          {totalSelectedCount > 0 ? `${totalSelectedCount} گیرنده انتخاب‌شده` : 'هیچ گیرنده‌ای انتخاب نشده'}
        </span>
      </div>

      {/* --- SELECTED BADGES CHIPS DISPLAY --- */}
      {totalSelectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700/80 max-h-28 overflow-y-auto custom-scrollbar">
          {/* Bale Selected */}
          {activeBaleIds.map(id => {
            const info = findRecipientInfo('bale', id);
            return (
              <span 
                key={`bale_${id}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 rounded-lg text-xs font-extrabold shadow-2xs"
              >
                <Bot className="w-3 h-3 text-emerald-600" />
                <span className="max-w-[140px] truncate">{info.name}</span>
                <span className="text-[10px] opacity-75 font-mono dir-ltr">({id})</span>
                <button
                  type="button"
                  onClick={() => removeId('bale', id)}
                  className="p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-800 rounded-full text-emerald-700 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}

          {/* Telegram Selected */}
          {activeTeleIds.map(id => {
            const info = findRecipientInfo('telegram', id);
            return (
              <span 
                key={`tele_${id}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/50 border border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200 rounded-lg text-xs font-extrabold shadow-2xs"
              >
                <Send className="w-3 h-3 text-blue-600" />
                <span className="max-w-[140px] truncate">{info.name}</span>
                <span className="text-[10px] opacity-75 font-mono dir-ltr">({id})</span>
                <button
                  type="button"
                  onClick={() => removeId('telegram', id)}
                  className="p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full text-blue-700 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}

          {/* WhatsApp Selected */}
          {activeWaIds.map(id => {
            const info = findRecipientInfo('whatsapp', id);
            return (
              <span 
                key={`wa_${id}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 dark:bg-green-950/50 border border-green-300 dark:border-green-700 text-green-800 dark:text-green-200 rounded-lg text-xs font-extrabold shadow-2xs"
              >
                <MessageSquare className="w-3 h-3 text-green-600" />
                <span className="max-w-[140px] truncate">{info.name}</span>
                <span className="text-[10px] opacity-75 font-mono dir-ltr">({id})</span>
                <button
                  type="button"
                  onClick={() => removeId('whatsapp', id)}
                  className="p-0.5 hover:bg-green-200 dark:hover:bg-green-800 rounded-full text-green-700 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Search Bar & Category Filter Tabs */}
      <div className="space-y-2">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجوی هوشمند در نام کاربران، سمت، شماره تماس یا شناسه بله/تلگرام..."
            className="w-full pl-8 pr-9 py-2 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Tabs & Quick Select All Actions */}
        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 text-[11px] font-bold">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeTab === 'all' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              همه ({filteredRecipients.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                activeTab === 'users' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              <UserIcon className="w-3 h-3" />
              <span>کاربران سیستم</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('contacts')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                activeTab === 'contacts' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              <Building2 className="w-3 h-3" />
              <span>مخاطبان مشتریان</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('groups')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                activeTab === 'groups' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              <Users className="w-3 h-3" />
              <span>گروه‌ها و کانال‌ها</span>
            </button>
          </div>

          {/* Quick Select Platform all */}
          <div className="flex items-center gap-1 shrink-0">
            {selectedPlatforms.includes('bale') && (
              <button
                type="button"
                onClick={() => handleSelectAllPlatform('bale')}
                className="px-2 py-1 text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-lg hover:bg-emerald-200 transition-colors flex items-center gap-1"
                title="انتخاب همه دارندگان آیدی بله"
              >
                <CheckCheck className="w-3 h-3" />
                <span>همه بله</span>
              </button>
            )}
            {selectedPlatforms.includes('telegram') && (
              <button
                type="button"
                onClick={() => handleSelectAllPlatform('telegram')}
                className="px-2 py-1 text-[10px] bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1"
                title="انتخاب همه دارندگان آیدی تلگرام"
              >
                <CheckCheck className="w-3 h-3" />
                <span>همه تلگرام</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* --- RECIPIENTS CARDS GRID --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800 custom-scrollbar">
        {filteredRecipients.map((item) => {
          const selected = isSelected(item);
          return (
            <div
              key={item.id}
              onClick={() => toggleRecipient(item)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 select-none ${
                selected
                  ? item.platform === 'bale'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 shadow-xs'
                    : item.platform === 'telegram'
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 shadow-xs'
                    : 'bg-green-50 dark:bg-green-950/40 border-green-400 dark:border-green-600 shadow-xs'
                  : 'bg-white dark:bg-zinc-800/90 border-slate-200 dark:border-zinc-700/70 hover:border-slate-300 dark:hover:border-zinc-600'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {/* Platform Badge Icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  item.platform === 'bale'
                    ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300'
                    : item.platform === 'telegram'
                    ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300'
                    : 'bg-green-100 dark:bg-green-900/60 text-green-600 dark:text-green-300'
                }`}>
                  {item.platform === 'bale' ? <Bot className="w-4 h-4" /> : item.platform === 'telegram' ? <Send className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                </div>

                {/* Info Text */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 truncate block">
                      {item.name}
                    </span>
                    {item.roleTitle && (
                      <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-slate-300 rounded font-medium truncate max-w-[85px]">
                        {item.roleTitle}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono dir-ltr truncate">
                    <span className="font-bold text-slate-700 dark:text-slate-300">{item.chatId}</span>
                    {item.phoneNumber && <span className="opacity-70">({item.phoneNumber})</span>}
                  </div>
                </div>
              </div>

              {/* Checkbox indicator */}
              <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                selected
                  ? item.platform === 'bale'
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : item.platform === 'telegram'
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-green-600 border-green-600 text-white'
                  : 'border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'
              }`}>
                {selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </div>
          );
        })}

        {filteredRecipients.length === 0 && (
          <div className="col-span-full py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
            {searchQuery ? 'هیچ مخاطبی با مشخصات جستجو شده یافت نشد.' : 'مخاطبی با آیدی فعال برای پیام‌رسان‌های انتخابی یافت نشد.'}
          </div>
        )}
      </div>

      {/* --- ADD CUSTOM CHAT ID OR GROUP --- */}
      <form onSubmit={handleAddManualId} className="pt-1 flex items-center gap-2">
        <select
          value={customInputPlatform}
          onChange={(e) => setCustomInputPlatform(e.target.value as any)}
          className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
        >
          {selectedPlatforms.includes('bale') && <option value="bale">بله (Bale)</option>}
          {selectedPlatforms.includes('telegram') && <option value="telegram">تلگرام</option>}
          {selectedPlatforms.includes('whatsapp') && <option value="whatsapp">واتس‌اپ</option>}
        </select>

        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          placeholder="افزودن شناسه چت یا گروه دستی دیگر (مثال: 1065384434 یا -100123)..."
          className="flex-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-left dir-ltr font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <button
          type="button"
          onClick={() => handleAddManualId()}
          disabled={!customInput.trim()}
          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>افزودن شناسه</span>
        </button>
      </form>
    </div>
  );
};
