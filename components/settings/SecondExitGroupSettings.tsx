
import React from 'react';
import { SystemSettings, Contact, ExitPermitStatus } from '../../types';
import { Users, CheckSquare, Square, MessageCircle, Send } from 'lucide-react';

interface Props {
    settings: SystemSettings;
    setSettings: (s: SystemSettings) => void;
    contacts: Contact[];
    configKey: 'exitPermitFirstGroupConfig' | 'exitPermitSecondGroupConfig' | 'exitPermitThirdGroupConfig';
    title: string;
    bgColor?: string;
    borderColor?: string;
    colorClasses?: string;
    iconColorClass?: string;
}

const SecondExitGroupSettings: React.FC<Props> = ({ 
    settings, setSettings, contacts, configKey, title,
    bgColor = 'bg-orange-100/50',
    borderColor = 'border-orange-200',
    colorClasses = 'text-orange-900',
    iconColorClass = 'text-orange-700'
}) => {
    
    const config = settings[configKey] || { groupId: '', activeStatuses: [] };

    const updateConfig = (key: string, value: any) => {
        const newConfig = { ...config, [key]: value };
        setSettings({ ...settings, [configKey]: newConfig });
    };

    const toggleStatus = (status: string) => {
        let newStatuses = [...(config.activeStatuses || [])];
        if (newStatuses.includes(status)) {
            newStatuses = newStatuses.filter(s => s !== status);
        } else {
            newStatuses.push(status);
        }
        updateConfig('activeStatuses', newStatuses);
    };

    const statusOptions = [
        { value: 'CREATE', label: '۱. ثبت اولیه (ارجاع به مدیرعامل)' },
        { value: ExitPermitStatus.PENDING_FACTORY, label: '۲. تایید مدیرعامل (ارجاع به مدیر کارخانه)' },
        { value: ExitPermitStatus.PENDING_WAREHOUSE, label: '۳. تایید مدیر کارخانه (ارجاع به سرپرست انبار)' },
        { value: ExitPermitStatus.PENDING_SECURITY, label: '۴. تایید و توزین انبار (ارجاع به انتظامات)' },
        { value: ExitPermitStatus.PENDING_FACTORY_FINAL, label: '۵. تایید انتظامات (ارجاع تایید خروج مدیر کارخانه)' },
        { value: 'ARCHIVED', label: '۶. تایید نهایی مدیر کارخانه (خروج بار و بایگانی)' },
        { value: 'CANCELED', label: '❌ ابطال و کنسلی (بار خارج نشود)' },
        { value: 'REJECTED', label: '❌ رد شده / حذف شده' },
    ];

    return (
        <div className={`mt-4 border-t-2 ${borderColor} pt-4 ${bgColor} p-4 rounded-lg`}>
            <div className={`flex items-center gap-2 mb-3 ${colorClasses} font-bold text-sm`}>
                <Users size={18}/>
                {title}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                {/* WhatsApp */}
                <div className={`glass-panel p-2 rounded border ${borderColor}`}>
                    <div className="flex items-center gap-1 mb-1 text-green-700 font-bold text-[10px]">
                        <MessageCircle size={12}/> واتساپ
                    </div>
                    <select 
                        className="w-full border rounded p-1.5 text-xs glass-panel" 
                        value={config.groupId || ''} 
                        onChange={e => updateConfig('groupId', e.target.value)}
                    >
                        <option value="">-- انتخاب --</option>
                        {contacts.map(c => (
                            <option key={`group_${configKey}_${c.number}`} value={c.number}>
                                {c.name} {c.isGroup ? '(گروه)' : ''}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Bale */}
                <div className={`glass-panel p-2 rounded border ${borderColor}`}>
                    <div className="flex items-center gap-1 mb-1 text-cyan-700 font-bold text-[10px]">
                        <Send size={12}/> بله (شناسه گروه‌ها)
                    </div>
                    <input 
                        className="w-full border rounded p-1.5 text-xs dir-ltr" 
                        placeholder="ID..." 
                        value={config.baleId || ''}
                        onChange={e => updateConfig('baleId', e.target.value)}
                    />
                </div>

                {/* Telegram */}
                <div className={`glass-panel p-2 rounded border ${borderColor}`}>
                    <div className="flex items-center gap-1 mb-1 text-blue-700 font-bold text-[10px]">
                        <Send size={12}/> تلگرام (Chat ID)
                    </div>
                    <input 
                        className="w-full border rounded p-1.5 text-xs dir-ltr" 
                        placeholder="-100..." 
                        value={config.telegramId || ''}
                        onChange={e => updateConfig('telegramId', e.target.value)}
                    />
                </div>
            </div>

            {(config.groupId || config.baleId || config.telegramId) && (
                <div>
                    <label className="text-xs font-bold text-gray-700 block mb-2">در چه مراحلی پیام به این گروه اعمال شود؟</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {statusOptions.map(opt => {
                            const isChecked = (config.activeStatuses || []).includes(opt.value);
                            return (
                                <div 
                                    key={opt.value} 
                                    onClick={() => toggleStatus(opt.value)}
                                    className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${isChecked ? 'glass-panel border-blue-400 font-bold' : 'glass-panel border-gray-200/50 dark:border-white/10'}`}
                                >
                                    {isChecked ? <CheckSquare size={16} className={iconColorClass}/> : <Square size={16} className="text-gray-300"/>}
                                    <span className={`text-xs ${isChecked ? 'text-blue-900':'text-gray-600'}`}>{opt.label}</span>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2">
                        * سیستم فقط در مراحل انتخاب شده مدارک را به این گروه ارسال می‌کند.
                    </p>
                </div>
            )}
        </div>
    );
};

export default SecondExitGroupSettings;
