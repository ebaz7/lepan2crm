
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, SystemSettings } from '../types';
import { getUsers, saveUser, updateUser, deleteUser } from '../services/authService';
import { getSettings, uploadFile } from '../services/storageService'; 
import { UserPlus, Trash2, Shield, User as UserIcon, Download, Pencil, X, Save, Container, Camera, Send, Phone, BellRing, Info, Package } from 'lucide-react';
import { generateUUID } from '../constants';
import { apiCall } from '../services/apiService';

const ManageUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null); 
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    username: '', 
    password: '', 
    fullName: '', 
    role: UserRole.USER as string, 
    roles: [UserRole.USER] as string[],
    canManageTrade: false, 
    canManageSales: false, 
    receiveNotifications: true, 
    canAccessSecretariat: false,
    secretariatAllowedCompanies: [],
    canManageSecretariatSettings: false,
    avatar: '', 
    signatureUrl: '', // New signature field
    telegramChatId: '', 
    baleChatId: '', 
    phoneNumber: '' 
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
      const [usersData, settingsData] = await Promise.all([getUsers(), getSettings()]);
      setUsers(usersData);
      setSettings(settingsData);
  };

  useEffect(() => { loadData(); }, []);
  
  const handleSubmit = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      let primaryRole = formData.role;
      const rolesArray = formData.roles && formData.roles.length > 0 ? formData.roles : [primaryRole];
      
      // Admin/CEO priority mapping
      if (rolesArray.includes(UserRole.ADMIN)) {
          primaryRole = UserRole.ADMIN;
      } else if (rolesArray.includes(UserRole.CEO)) {
          primaryRole = UserRole.CEO;
      } else if (rolesArray.length > 0) {
          primaryRole = rolesArray[0];
      }

      const payload = {
          ...formData,
          role: primaryRole,
          roles: rolesArray
      };

      if (editingId) { 
          const updatedUser: User = { id: editingId, ...payload }; 
          await updateUser(updatedUser); 
          setEditingId(null); 
      } else { 
          const user: User = { id: generateUUID(), ...payload }; 
          await saveUser(user); 
      } 
      await loadData(); 
      setFormData({ 
          username: '', 
          password: '', 
          fullName: '', 
          role: UserRole.USER, 
          roles: [UserRole.USER],
          canManageTrade: false, 
          canManageSales: false, 
          receiveNotifications: true, 
          canAccessSecretariat: false,
          canManageSecretariatSettings: false,
          secretariatAllowedCompanies: [],
          avatar: '', 
          signatureUrl: '',
          telegramChatId: '', 
          baleChatId: '', 
          phoneNumber: '' 
      }); 
  };
  
  const handleEditClick = (user: User) => { 
      setEditingId(user.id); 
      const rolesArray = user.roles && user.roles.length > 0 ? user.roles : [user.role];
      setFormData({ 
          username: user.username, 
          password: user.password || '', 
          fullName: user.fullName, 
          role: user.role, 
          roles: rolesArray,
          canManageTrade: user.canManageTrade || false, 
          canManageSales: user.canManageSales || false, 
          receiveNotifications: user.receiveNotifications !== false, 
          canAccessSecretariat: user.canAccessSecretariat || false,
          canManageSecretariatSettings: user.canManageSecretariatSettings || false,
          secretariatAllowedCompanies: user.secretariatAllowedCompanies || [],
          avatar: user.avatar || '', 
          signatureUrl: user.signatureUrl || '',
          telegramChatId: user.telegramChatId || '', 
          baleChatId: user.baleChatId || '', 
          phoneNumber: user.phoneNumber || '' 
      }); 
      window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };
  
  const handleCancelEdit = () => { 
      setEditingId(null); 
      setFormData({ 
          username: '', 
          password: '', 
          fullName: '', 
          role: UserRole.USER, 
          roles: [UserRole.USER],
          canManageTrade: false, 
          canManageSales: false, 
          receiveNotifications: true, 
          canAccessSecretariat: false,
          secretariatAllowedCompanies: [],
          canManageSecretariatSettings: false,
          avatar: '', 
          signatureUrl: '',
          telegramChatId: '', 
          baleChatId: '', 
          phoneNumber: '' 
      }); 
  };

  const handleDeleteUser = async (id: string) => { if (window.confirm('آیا از حذف این کاربر اطمینان دارید؟')) { await deleteUser(id); await loadData(); } };
  const handleBackup = async () => { try { const backupData = await apiCall<any>('/backup'); const jsonString = JSON.stringify(backupData, null, 2); const blob = new Blob([jsonString], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `backup_payment_system_${new Date().toISOString().split('T')[0]}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); } catch (e) { alert('خطا در دریافت فایل پشتیبان'); } };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      setUploadingAvatar(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
          const base64 = ev.target?.result as string;
          try { const result = await uploadFile(file.name, base64); setFormData({ ...formData, avatar: result.url }); } catch (error) { alert('خطا در آپلود تصویر'); } finally { setUploadingAvatar(false); }
      };
      reader.readAsDataURL(file);
  };

  const handleSignatureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      setUploadingSignature(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
          const base64 = ev.target?.result as string;
          try { const result = await uploadFile(file.name, base64); setFormData({ ...formData, signatureUrl: result.url }); } catch (error) { alert('خطا در آپلود امضا'); } finally { setUploadingSignature(false); }
      };
      reader.readAsDataURL(file);
  };

  const getRoleLabel = (roleId: string) => {
      if (settings?.customRoleNames?.[roleId]) {
          return settings.customRoleNames[roleId];
      }
      switch (roleId) {
          case UserRole.ADMIN: return 'مدیر سیستم';
          case UserRole.CEO: return 'مدیر عامل';
          case UserRole.FINANCIAL: return 'مدیر مالی';
          case UserRole.MANAGER: return 'مدیر داخلی';
          case UserRole.SALES_MANAGER: return 'مدیر فروش';
          case UserRole.FACTORY_MANAGER: return 'مدیر کارخانه';
          case UserRole.WAREHOUSE_KEEPER: return 'انبار واردات'; 
          case UserRole.SECURITY_HEAD: return 'سرپرست انتظامات';
          case UserRole.SECURITY_GUARD: return 'نگهبان';
          case UserRole.QC: return 'کنترل کیفی';
          case UserRole.COMMERCIAL: return 'بازرگانی';
          case UserRole.USER: return 'کاربر عادی';
          default:
              const custom = settings?.customRoles?.find(r => r.id === roleId);
              return custom ? custom.label : roleId;
      }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="glass-panel rounded-2xl shadow-sm border border-gray-200/50 dark:border-white/10 p-6">
        <div className="flex items-center justify-between mb-6"><div className="flex items-center gap-3"><div className={`p-2 rounded-lg ${editingId ? 'bg-amber-100 text-amber-600' : 'bg-purple-100 text-purple-600'}`}>{editingId ? <Pencil size={24} /> : <UserPlus size={24} />}</div><h2 className="text-xl font-bold text-gray-800">{editingId ? 'ویرایش اطلاعات کاربر' : 'تعریف کاربر جدید'}</h2></div><button onClick={handleBackup} className="flex items-center gap-2 text-sm bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors"><Download size={16} />دانلود نسخه پشتیبان</button></div>
        
        {/* Warning about Role Selection */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 flex items-start gap-2">
            <Info size={18} className="text-blue-600 shrink-0 mt-0.5"/>
            <div className="text-xs text-blue-800 leading-relaxed">
                <strong>توجه مهم در انتخاب نقش:</strong><br/>
                شما می‌توانید <strong>چندین نقش</strong> را به صورت همزمان به یک کاربر اختصاص دهید. کاربر دسترسی‌های ترکیبی تمامی نقش‌ها را خواهد داشت. این نقش‌ها به دکمه‌های تایید متناسب متصل هستند.
            </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
          {/* Avatar & Signature Upload */}
          <div className="flex flex-col items-center justify-center row-span-2 gap-4 border-l border-gray-100 dark:border-white/5 pl-2">
              <div className="flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-gray-200 mb-1 overflow-hidden relative group border">
                      {formData.avatar ? <img src={formData.avatar} className="w-full h-full object-cover" /> : <UserIcon className="w-full h-full p-3 text-gray-400" />}
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity" onClick={() => avatarInputRef.current?.click()}>
                          <Camera className="text-white" size={18}/>
                      </div>
                  </div>
                  <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
                  <button type="button" onClick={() => avatarInputRef.current?.click()} className="text-[11px] text-blue-600 hover:underline font-bold" disabled={uploadingAvatar}>{uploadingAvatar ? '...' : 'عکس پروفایل'}</button>
              </div>

              <div className="flex flex-col items-center justify-center">
                  <div className="w-16 h-12 rounded bg-slate-50 border border-dashed border-slate-300 mb-1 overflow-hidden relative group flex items-center justify-center">
                      {formData.signatureUrl ? <img src={formData.signatureUrl} className="w-full h-full object-contain" /> : <span className="text-[10px] text-gray-400">بدون امضا</span>}
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity" onClick={() => signatureInputRef.current?.click()}>
                          <Camera className="text-white" size={16}/>
                      </div>
                  </div>
                  <input type="file" ref={signatureInputRef} className="hidden" accept="image/*" onChange={handleSignatureChange} />
                  <button type="button" onClick={() => signatureInputRef.current?.click()} className="text-[11px] text-emerald-600 hover:underline font-bold" disabled={uploadingSignature}>{uploadingSignature ? '...' : 'آپلود امضا'}</button>
              </div>
          </div>

          <div className="space-y-1 lg:col-span-2"><label className="text-sm text-gray-600">نام و نام خانوادگی</label><input required type="text" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="مثال: محمد احمدی" /></div>
          <div className="space-y-1 lg:col-span-3"><label className="text-sm text-gray-600">نام کاربری</label><input required type="text" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm text-left dir-ltr" placeholder="username" /></div>
          <div className="space-y-1 lg:col-span-2"><label className="text-sm text-gray-600">رمز عبور</label><input required type="text" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm text-left dir-ltr" placeholder="password" /></div>
          
          <div className="space-y-1 lg:col-span-2">
            <label className="text-sm text-gray-600 font-bold flex items-center gap-1">
              <Shield size={14} className="text-indigo-600"/> نقش‌های کاربری (چندگانه)
            </label>
            <div className="w-full border-2 border-blue-50 rounded-xl p-3 h-40 overflow-y-auto bg-white/50 glass-panel space-y-2.5">
                <div className="text-[10px] font-bold text-indigo-400 border-b pb-1">✅ نقش‌های سیستمی (پیش‌فرض)</div>
                <div className="grid grid-cols-1 gap-2">
                    {[
                        UserRole.ADMIN,
                        UserRole.CEO,
                        UserRole.FACTORY_MANAGER,
                        UserRole.WAREHOUSE_KEEPER,
                        UserRole.SECURITY_HEAD,
                        UserRole.SECURITY_GUARD,
                        UserRole.MANAGER,
                        UserRole.FINANCIAL,
                        UserRole.SALES_MANAGER,
                        UserRole.QC,
                        UserRole.COMMERCIAL,
                        UserRole.USER
                    ].map((rId) => {
                        const isChecked = formData.roles ? formData.roles.includes(rId) : formData.role === rId;
                        return (
                            <label key={rId} className="flex items-center gap-2 text-xs font-black text-gray-700 hover:bg-slate-100 p-1.5 rounded cursor-pointer transition-colors border border-transparent hover:border-indigo-100">
                                <input 
                                    type="checkbox" 
                                    checked={isChecked} 
                                    onChange={() => {
                                        let currentRoles = formData.roles ? [...formData.roles] : [formData.role];
                                        if (currentRoles.includes(rId)) {
                                            if (currentRoles.length > 1) {
                                                currentRoles = currentRoles.filter(x => x !== rId);
                                            }
                                        } else {
                                            currentRoles.push(rId);
                                        }
                                        setFormData({ ...formData, roles: currentRoles });
                                    }}
                                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" 
                                />
                                <span>{getRoleLabel(rId)}</span>
                            </label>
                        );
                    })}
                </div>
                {settings?.customRoles && settings.customRoles.length > 0 && (
                    <>
                        <div className="text-[10px] font-bold text-amber-400 border-b pb-1 mt-3">✏️ نقش‌های سفارشی</div>
                        <div className="grid grid-cols-1 gap-2">
                            {settings.customRoles.map(role => {
                                const isChecked = formData.roles ? formData.roles.includes(role.id) : formData.role === role.id;
                                return (
                                    <label key={role.id} className="flex items-center gap-2 text-xs font-bold text-gray-700 hover:bg-slate-100 p-1.5 rounded cursor-pointer transition-colors border border-transparent hover:border-amber-100">
                                        <input 
                                            type="checkbox" 
                                            checked={isChecked} 
                                            onChange={() => {
                                                let currentRoles = formData.roles ? [...formData.roles] : [formData.role];
                                                if (currentRoles.includes(role.id)) {
                                                    if (currentRoles.length > 1) {
                                                        currentRoles = currentRoles.filter(x => x !== role.id);
                                                    }
                                                } else {
                                                    currentRoles.push(role.id);
                                                }
                                                setFormData({ ...formData, roles: currentRoles });
                                            }}
                                            className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" 
                                        />
                                        <span>{role.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
          </div>
          
          <div className="space-y-1 lg:col-span-1"><label className="text-sm text-gray-600 flex items-center gap-1"><Phone size={12}/> موبایل (واتساپ)</label><input type="text" value={formData.phoneNumber} onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm text-left dir-ltr" placeholder="98912..." /></div>
          <div className="space-y-1 lg:col-span-1"><label className="text-sm text-gray-600 flex items-center gap-1"><Send size={12} className="text-blue-500"/> آیدی بله (Bale ID)</label><input type="text" value={formData.baleChatId} onChange={(e) => setFormData({...formData, baleChatId: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm text-left dir-ltr" placeholder="12345678" /></div>
          <div className="space-y-1 lg:col-span-1"><label className="text-sm text-gray-600 flex items-center gap-1"><Send size={12}/> آیدی تلگرام</label><input type="text" value={formData.telegramChatId} onChange={(e) => setFormData({...formData, telegramChatId: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm text-left dir-ltr" placeholder="Chat ID" /></div>
          
          <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200 px-2 py-1.5 rounded cursor-pointer border border-gray-200">
                  <input type="checkbox" checked={formData.canManageTrade} onChange={e => setFormData({...formData, canManageTrade: e.target.checked})} className="w-4 h-4 text-blue-600" />
                  <span>دسترسی اختصاصی بازرگانی</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-700 bg-sky-50 px-2 py-1.5 rounded cursor-pointer border border-sky-200">
                  <input type="checkbox" checked={formData.canManageSales} onChange={e => setFormData({...formData, canManageSales: e.target.checked})} className="w-4 h-4 text-sky-600" />
                  <span>دسترسی مدیر فروش (پنل بات)</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-700 bg-green-50 px-2 py-1.5 rounded cursor-pointer border border-green-200">
                  <input type="checkbox" checked={formData.receiveNotifications} onChange={e => setFormData({...formData, receiveNotifications: e.target.checked})} className="w-4 h-4 text-green-600" />
                  <span>دریافت پیام‌های اطلاع‌رسانی</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-700 bg-purple-50 px-2 py-1.5 rounded cursor-pointer border border-purple-200">
                  <input type="checkbox" checked={formData.canAccessSecretariat} onChange={e => setFormData({...formData, canAccessSecretariat: e.target.checked})} className="w-4 h-4 text-purple-600" />
                  <span>دسترسی به دبیرخانه</span>
              </label>
              
              {formData.canAccessSecretariat && settings?.companies && (
                  <div className="flex flex-col gap-1 col-span-1 md:col-span-2 p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                      <span className="text-xs font-semibold text-purple-800 mb-1">شرکت‌های مجاز برای دبیرخانه:</span>
                      <div className="flex flex-wrap gap-2">
                          {settings.companies.map(comp => (
                              <label key={comp.id} className="flex items-center gap-1.5 text-xs text-gray-600 bg-white px-2 py-1 rounded border border-gray-200 cursor-pointer">
                                  <input 
                                      type="checkbox" 
                                      className="w-3.5 h-3.5 text-purple-600"
                                      checked={formData.secretariatAllowedCompanies?.includes(comp.id) || false}
                                      onChange={(e) => {
                                          const isChecked = e.target.checked;
                                          const current = formData.secretariatAllowedCompanies || [];
                                          setFormData({
                                              ...formData,
                                              secretariatAllowedCompanies: isChecked 
                                                ? [...current, comp.id] 
                                                : current.filter(id => id !== comp.id)
                                          });
                                      }}
                                  />
                                  <span>{comp.name}</span>
                              </label>
                          ))}
                      </div>
                  </div>
              )}

              <label className="flex items-center gap-2 text-xs text-gray-700 bg-indigo-50 px-2 py-1.5 rounded cursor-pointer border border-indigo-200">
                  <input type="checkbox" checked={formData.canManageSecretariatSettings} onChange={e => setFormData({...formData, canManageSecretariatSettings: e.target.checked})} className="w-4 h-4 text-indigo-600" />
                  <span>مدیریت تنظیمات دبیرخانه</span>
              </label>
              <div className="flex gap-2 mt-1">
                  {editingId && (<button type="button" onClick={handleCancelEdit} className="bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-3 rounded-lg text-sm font-medium transition-colors h-[38px] flex items-center justify-center" title="انصراف"><X size={18} /></button>)}
                  <button type="submit" className={`${editingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-purple-600 hover:bg-purple-700'} text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors h-[38px] flex-1 flex items-center justify-center gap-1`}>{editingId ? <><Save size={16}/> ذخیره</> : 'افزودن'}</button>
              </div>
          </div>
        </form>
      </div>
      <div className="glass-panel rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-800">لیست کاربران سیستم</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right"><thead className="bg-gray-5 text-gray-600"><tr><th className="px-6 py-3">تصویر</th><th className="px-6 py-3">نام و نام خانوادگی</th><th className="px-6 py-3">نام کاربری</th><th className="px-6 py-3">شماره تماس</th><th className="px-6 py-3">نقش‌ها</th><th className="px-6 py-3">دسترسی‌ها</th><th className="px-6 py-3 text-center">عملیات</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{users.map((user) => (<tr key={user.id} className={`hover:bg-gray-50 transition-colors ${editingId === user.id ? 'bg-amber-50' : ''}`}><td className="px-6 py-4"><div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">{user.avatar ? <img src={user.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-gray-400"><UserIcon size={20}/></div>}</div></td><td className="px-6 py-4 flex items-center gap-2">{user.fullName}</td><td className="px-6 py-4 font-mono text-gray-500">{user.username}</td><td className="px-6 py-4 font-mono text-gray-500" dir="ltr">{user.phoneNumber || '-'}</td><td className="px-6 py-4"><div className="flex flex-wrap gap-1">{(user.roles && user.roles.length > 0 ? user.roles : [user.role]).map((r, i) => (<span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${r === UserRole.ADMIN ? 'bg-purple-100/70 text-purple-700 border-purple-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>{r === UserRole.ADMIN && <Shield size={10} />}{getRoleLabel(r)}</span>))}</div></td><td className="px-6 py-4 flex gap-1 flex-wrap">{user.canManageTrade && (<span className="flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded w-fit"><Container size={10} /> بازرگانی</span>)}{user.canManageSales && (<span className="flex items-center gap-1 text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded w-fit"><Package size={10} /> فروش</span>)}{user.receiveNotifications !== false && (<span className="flex items-center gap-1 text-[10px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded w-fit"><BellRing size={10} /> اعلان‌ها</span>)}{user.canAccessSecretariat && (<span className="flex items-center gap-1 text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded w-fit"><Shield size={10} /> دبیرخانه</span>)}{user.canManageSecretariatSettings && (<span className="flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded w-fit"><Shield size={10} /> مدیریت دبیرخانه</span>)}</td><td className="px-6 py-4 text-center"><div className="flex items-center justify-center gap-2"><button onClick={() => handleEditClick(user)} className="text-amber-500 hover:text-amber-700 p-1 hover:bg-amber-50 rounded transition-colors" title="ویرایش / تغییر رمز"><Pencil size={16} /></button>{user.username !== 'admin' && (<button onClick={() => handleDeleteUser(user.id)} className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-colors" title="حذف کاربر"><Trash2 size={16} /></button>)}</div></td></tr>))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default ManageUsers;
