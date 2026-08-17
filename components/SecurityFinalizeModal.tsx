import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ExitPermit } from '../types';
import { X, ShieldCheck, CheckCircle, Smartphone, User, Truck, Paperclip, Trash2 } from 'lucide-react';
import { IranianPlateInput } from './IranianPlate';

interface Props {
  permit: ExitPermit;
  onClose: () => void;
  onConfirm: (data: { driverName: string; driverPhone: string; plateNumber: string; exitTime: string; attachments: {fileName: string, data: string}[] }) => void;
}

const SecurityFinalizeModal: React.FC<Props> = ({ permit, onClose, onConfirm }) => {
  const [driverName, setDriverName] = useState(permit.driverName || '');
  const [driverPhone, setDriverPhone] = useState(permit.driverPhone || '');
  const [exitTime, setExitTime] = useState(new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }));
  const [plateNumber, setPlateNumber] = useState(permit.plateNumber || '');
  
  const [attachments, setAttachments] = useState<{fileName: string, data: string}[]>(permit.attachments || []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      files.forEach(file => {
          const reader = new FileReader();
          reader.onload = (evt) => {
              if (evt.target?.result) {
                  setAttachments(prev => [...prev, { fileName: file.name, data: evt.target!.result as string }]);
              }
          };
          reader.readAsDataURL(file);
      });
  };

  const removeAttachment = (index: number) => {
      setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    onConfirm({
      driverName,
      driverPhone,
      plateNumber,
      exitTime: '', // Handled in next stage
      attachments
    });
  };

  const modalContent = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 md:p-4 bg-black/70 backdrop-blur-md overflow-hidden animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl border border-white/20 animate-in fade-in zoom-in duration-300">
        <div className="p-6 border-b flex justify-between items-center bg-gradient-to-r from-blue-700 to-indigo-800 text-white">
          <div className="flex items-center gap-3">
             <ShieldCheck size={28} className="text-blue-200" />
             <div>
                <h2 className="text-xl font-black">تایید نهایی و ثبت خروج</h2>
                <p className="text-[10px] opacity-80 mt-0.5">لطفاً مشخصات راننده و خودرو را بررسی و وارد کنید.</p>
             </div>
          </div>
          <button onClick={onClose} data-close-modal="true" className="p-2 hover:bg-white/20 rounded-full transition-colors"><X size={24} /></button>
        </div>

        <div className="p-6 md:p-8 space-y-8 bg-gray-50/50">
          {/* Driver Section */}
          <div className="space-y-4">
            <h3 className="font-bold text-gray-700 flex items-center gap-2 border-r-4 border-blue-500 pr-3">
              <User size={18} className="text-blue-500" /> 👨‍✈️ مشخصات راننده
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">نام و نام خانوادگی راننده</label>
                <div className="relative">
                  <input className="w-full border-2 border-gray-100 rounded-2xl p-3 pr-10 text-sm focus:border-blue-400 outline-none transition-all shadow-sm" value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="مثلاً: احمد حسینی" />
                  <User className="absolute right-3 top-3.5 text-gray-300" size={18} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">شماره تماس راننده</label>
                <div className="relative">
                  <input className="w-full border-2 border-gray-100 rounded-2xl p-3 pr-10 text-sm font-mono focus:border-blue-400 outline-none transition-all shadow-sm" dir="ltr" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} placeholder="0912..." />
                  <Smartphone className="absolute right-3 top-3.5 text-gray-300" size={18} />
                </div>
              </div>
            </div>
          </div>

          {/* Vehicle Section */}
          <div className="space-y-4">
            <h3 className="font-bold text-gray-700 flex items-center gap-2 border-r-4 border-orange-500 pr-3">
              <Truck size={18} className="text-orange-500" /> 🚛 مشخصات خودرو و پلاک
            </h3>
            <div className="flex flex-col items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                <IranianPlateInput
                  value={plateNumber}
                  onChange={setPlateNumber}
                />
            </div>
          </div>
          {/* Attachments Section */}
          <div className="space-y-4">
              <h3 className="font-bold text-gray-700 flex items-center gap-2 border-r-4 border-emerald-500 pr-3">
                  <Paperclip size={18} className="text-emerald-500" /> 📎 ضمیمه تصاویر و مدارک (اختیاری)
              </h3>
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                  <div className="flex flex-col gap-3">
                      <input 
                          type="file" 
                          multiple 
                          accept="image/*,.pdf" 
                          className="hidden" 
                          ref={fileInputRef} 
                          onChange={handleFileUpload} 
                      />
                      <button 
                          onClick={() => fileInputRef.current?.click()} 
                          className="w-full py-3 border-2 border-dashed border-emerald-200 text-emerald-600 rounded-xl hover:bg-emerald-50 font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                          <Paperclip size={18} /> انتخاب فایل یا تصویر (مثلاً عکس باسکول یا بار)
                      </button>
                      
                      {attachments.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                              {attachments.map((att, idx) => (
                                  <div key={idx} className="flex justify-between items-center bg-gray-50 border border-gray-100 p-2 rounded-lg text-sm">
                                      <span className="truncate flex-1 font-mono text-xs" dir="ltr">{att.fileName}</span>
                                      <button onClick={() => removeAttachment(idx)} className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded-md shrink-0 ml-2">
                                          <Trash2 size={14} />
                                      </button>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          </div>
        </div>

        <div className="p-6 border-t glass-panel flex justify-end gap-3 bg-gray-100/50">
          <button onClick={onClose} className="px-6 py-3 rounded-2xl border-2 border-gray-200 text-gray-500 font-bold hover:bg-white transition-all">انصراف</button>
          <button onClick={handleSubmit} className="px-10 py-3 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2">
            <CheckCircle size={20} /> تایید نهایی و خروج
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default SecurityFinalizeModal;
