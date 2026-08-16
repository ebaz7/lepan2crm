import React, { useState, useEffect } from 'react';
import { 
  Send, Clock, Calendar, CheckCircle2, AlertCircle, RefreshCw, Plus, 
  Trash2, Edit3, Power, FileText, Download, Image, Sparkles, Layers,
  Check, X, ChevronDown, Play, MessageSquare, Bot
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiCall } from '../../services/apiService';

export interface ReportDeliveryJob {
  id: string;
  title: string;
  module: 'sales' | 'purchasing' | 'inventory' | 'accounting' | 'hr';
  reportType: 'daily_sales' | 'sales_comparison' | 'inventory_stock' | 'customer_balances' | 'cheque_alerts' | 'cheque_vault' | 'custom';
  botPlatforms: ('telegram' | 'bale' | 'eitaa' | 'whatsapp')[];
  destinationGroup?: string;
  telegramGroup?: string;
  baleGroup?: string;
  whatsappGroup?: string;
  scheduleType: 'daily_custom' | 'daily_1900' | 'daily_comp_1900' | 'weekly' | 'monthly' | 'cron';
  sendTime?: string; // HH:MM (e.g. 19:00, 09:00, 15:30)
  sendHour?: number;
  sendMinute?: number;
  cronExpression?: string;
  attachPdf: boolean;
  attachExcel: boolean;
  attachImage: boolean;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt?: string;
}

const MODULE_OPTIONS = [
  { value: 'sales', label: 'فروش و بازاریابی (Sales)' },
  { value: 'purchasing', label: 'خرید و تدارکات (Purchasing)' },
  { value: 'inventory', label: 'انبار و انبارداری (Inventory)' },
  { value: 'accounting', label: 'حسابداری و خزانه‌داری (Accounting/Treasury)' },
  { value: 'hr', label: 'تردد و خروج نیروها (HR/Logistics)' },
];

const REPORT_TYPE_OPTIONS = [
  { value: 'daily_sales', label: 'گزارش روزانه عملکرد فروش (سایان ERP)' },
  { value: 'sales_comparison', label: 'گزارش مقایسه‌ای فروش (امروز با دیروز / دو بازه)' },
  { value: 'cheque_vault', label: '🏛️ گزارش جامع اسناد و چک‌های دریافتنی نزد صندوق (شامل سررسید آتی و گذشته)' },
  { value: 'cheque_not_due', label: '⏳ فقط چک‌های سررسید نشده نزد صندوق (اسناد آتی)' },
  { value: 'cheque_overdue', label: '⚠️ فقط چک‌های سررسید گذشته / معوق نزد صندوق (پیگیری فوری)' },
  { value: 'cheque_alerts', label: 'گزارش سررسید کلی چک‌ها و اسناد دریافتنی' },
  { value: 'customer_balances', label: 'گزارش مانده حساب و تراز مشتریان (تفضیل‌ها)' },
  { value: 'inventory_stock', label: 'گزارش موجودی و گردش کالای انبار' },
];

const SCHEDULE_OPTIONS = [
  { value: 'daily_custom', label: 'روزانه در ساعت مشخص دلخواه (ارسال دقیق به وقت تهران)' },
  { value: 'daily_1900', label: 'هر روز ساعت ۱۹:۰۰ (پیش‌فرض فروش)' },
  { value: 'daily_comp_1900', label: 'هر روز ساعت ۱۹:۰۰ (پایش مقایسه‌ای امروز با دیروز)' },
  { value: 'weekly', label: 'هفتگی (شنبه‌ها ساعت ۱۹:۰۰)' },
  { value: 'monthly', label: 'ماهانه (اول هر ماه شمسی ساعت ۱۹:۰۰)' },
  { value: 'cron', label: 'فرمول اختصاصی و پیشرفته کرون (Cron Expression)' },
];

export const ReportDeliveryManager: React.FC = () => {
  const [jobs, setJobs] = useState<ReportDeliveryJob[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [executingId, setExecutingId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingJob, setEditingJob] = useState<Partial<ReportDeliveryJob> | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const res = await apiCall('/report-delivery/jobs');
      if (Array.isArray(res)) {
        setJobs(res);
      }
    } catch (e: any) {
      console.error('Fetch Jobs Error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingJob({
      title: '',
      module: 'sales',
      reportType: 'daily_sales',
      botPlatforms: ['telegram', 'bale'],
      destinationGroup: '',
      telegramGroup: '',
      baleGroup: '',
      whatsappGroup: '',
      scheduleType: 'daily_custom',
      sendTime: '19:00',
      sendHour: 19,
      sendMinute: 0,
      cronExpression: '0 19 * * *',
      attachPdf: true,
      attachExcel: true,
      attachImage: true,
      enabled: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (job: ReportDeliveryJob) => {
    const timeVal = job.sendTime || (job.sendHour !== undefined ? `${String(job.sendHour).padStart(2, '0')}:${String(job.sendMinute || 0).padStart(2, '0')}` : '19:00');
    setEditingJob({
      ...job,
      sendTime: timeVal,
      telegramGroup: job.telegramGroup || (job.botPlatforms?.includes('telegram') ? job.destinationGroup || '' : ''),
      baleGroup: job.baleGroup || (job.botPlatforms?.includes('bale') ? job.destinationGroup || '' : ''),
      whatsappGroup: job.whatsappGroup || (job.botPlatforms?.includes('whatsapp') ? job.destinationGroup || '' : ''),
    });
    setIsModalOpen(true);
  };

  const handleSaveJob = async () => {
    if (!editingJob?.title?.trim()) {
      toast.error('لطفاً عنوان زمان‌بندی را وارد نمایید.');
      return;
    }

    const tg = editingJob.telegramGroup?.trim() || '';
    const bale = editingJob.baleGroup?.trim() || '';
    const wa = editingJob.whatsappGroup?.trim() || '';
    const dest = editingJob.destinationGroup?.trim() || '';

    if (!tg && !bale && !wa && !dest) {
      toast.error('لطفاً حداقل شناسه گروه مقصد برای یکی از پیام‌رسان‌ها (تلگرام، بله یا واتساپ) را وارد نمایید.');
      return;
    }

    let sendHour = editingJob.sendHour;
    let sendMinute = editingJob.sendMinute;
    let cronPattern = editingJob.cronExpression || '0 19 * * *';

    if (editingJob.sendTime && editingJob.sendTime.includes(':')) {
      const parts = editingJob.sendTime.split(':').map(x => parseInt(x, 10) || 0);
      sendHour = parts[0];
      sendMinute = parts[1];
      cronPattern = `${sendMinute} ${sendHour} * * *`;
    }

    const payload = {
      ...editingJob,
      sendHour,
      sendMinute,
      cronExpression: editingJob.scheduleType === 'cron' ? (editingJob.cronExpression || cronPattern) : cronPattern,
      telegramGroup: tg,
      baleGroup: bale,
      whatsappGroup: wa,
      destinationGroup: tg || bale || wa || dest
    };

    try {
      if (editingJob.id) {
        await apiCall(`/report-delivery/jobs/${editingJob.id}`, 'PUT', payload);
        toast.success('زمان‌بندی با موفقیت به‌روزرسانی شد.');
      } else {
        await apiCall('/report-delivery/jobs', 'POST', payload);
        toast.success('موتور زمان‌بندی جدید با موفقیت ثبت گردید.');
      }
      setIsModalOpen(false);
      setEditingJob(null);
      fetchJobs();
    } catch (e: any) {
      toast.error(`خطا در ذخیره زمان‌بندی: ${e?.message || e}`);
    }
  };

  const handleDeleteJob = async (id: string) => {
    if (!confirm('آیا از حذف این زمان‌بندی گزارش مطمئن هستید؟')) return;
    try {
      await apiCall(`/report-delivery/jobs/${id}`, 'DELETE');
      toast.success('زمان‌بندی گزارش با موفقیت حذف شد.');
      fetchJobs();
    } catch (e: any) {
      toast.error(`خطا در حذف: ${e?.message || e}`);
    }
  };

  const handleToggleEnable = async (job: ReportDeliveryJob) => {
    try {
      const updated = { ...job, enabled: !job.enabled };
      await apiCall(`/report-delivery/jobs/${job.id}`, 'PUT', updated);
      toast.success(updated.enabled ? 'زمان‌بندی فعال گردید.' : 'زمان‌بندی غیرفعال شد.');
      fetchJobs();
    } catch (e: any) {
      toast.error(`خطا در تغییر وضعیت: ${e?.message || e}`);
    }
  };

  const handleExecuteNow = async (job: ReportDeliveryJob) => {
    setExecutingId(job.id);
    try {
      const res: any = await apiCall('/report-delivery/execute-now', 'POST', { jobId: job.id });
      toast.success(res?.message || 'گزارش با موفقیت تولید و به بات‌ها ارسال شد.');
      fetchJobs();
    } catch (e: any) {
      toast.error(`خطا در اجرای فوری گزارش: ${e?.message || e}`);
    } finally {
      setExecutingId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-right dir-rtl font-sans space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
            <Bot size={24} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>موتور مرکزی زمان‌بندی و ارسال گزارشات ERP (Report Delivery Engine)</span>
              <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">هوشمند</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              مدیریت و پیکربندی ارسال خودکار روزانه (ساعت ۱۹:۰۰)، هفتگی و درخواستی گزارشات به گروهها و چنل‌های تلگرام، بله، واتساپ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchJobs}
            disabled={isLoading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
            title="به‌روزرسانی لیست"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-md hover:shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>افزودن زمان‌بندی گزارش جدید</span>
          </button>
        </div>
      </div>

      {/* JOBS LIST */}
      <div className="grid grid-cols-1 gap-4">
        {jobs.length === 0 ? (
          <div className="p-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
            <Clock className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">هیچ زمان‌بندی گزارشی ثبت نشده است</p>
            <p className="text-[11px] text-slate-400 mt-1">
              با دکمه بالا می‌توانید ارسال خودکار daily ساعت ۱۹:۰۰ یا زمان‌بندی دلخواه را فعال نمایید.
            </p>
          </div>
        ) : (
          jobs.map(job => (
            <div 
              key={job.id} 
              className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                job.enabled 
                  ? 'bg-white border-slate-200/90 shadow-2xs hover:border-blue-300' 
                  : 'bg-slate-50/70 border-slate-200/50 opacity-75'
              }`}
            >
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${job.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                  <h4 className="font-extrabold text-sm text-slate-900">{job.title}</h4>
                  
                  <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-200">
                    {MODULE_OPTIONS.find(m => m.value === job.module)?.label || job.module}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1 bg-blue-50 text-blue-800 font-bold px-2.5 py-1 rounded-xl border border-blue-200">
                    <Clock size={14} className="text-blue-600" />
                    <span>
                      {job.scheduleType === 'cron' ? `کرون: ${job.cronExpression}` : `⏰ ساعت ارسال: ${job.sendTime || '19:00'} (به وقت تهران)`}
                    </span>
                  </span>

                  <span className="flex items-center gap-1">
                    <Send size={14} className="text-emerald-500" />
                    <span>پلتفرم‌ها: {job.botPlatforms.join('، ')}</span>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-600 pt-0.5">
                  {job.telegramGroup && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg border border-blue-200">تلگرام: {job.telegramGroup}</span>}
                  {job.baleGroup && <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-200">بله: {job.baleGroup}</span>}
                  {job.whatsappGroup && <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-lg border border-green-200">واتساپ: {job.whatsappGroup}</span>}
                  {!job.telegramGroup && !job.baleGroup && !job.whatsappGroup && job.destinationGroup && (
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200">مقصد: {job.destinationGroup}</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 pt-1">
                  <span>پیوست‌ها:</span>
                  {job.attachPdf && <span className="px-1.5 py-0.2 bg-rose-50 text-rose-700 rounded font-bold border border-rose-200">PDF</span>}
                  {job.attachExcel && <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded font-bold border border-emerald-200">Excel</span>}
                  {job.attachImage && <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded font-bold border border-blue-200">تصویر</span>}
                  
                  {job.lastRunAt && (
                    <span className="mr-auto font-mono text-slate-500">آخرین اجرا: {job.lastRunAt}</span>
                  )}
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                
                <button
                  onClick={() => handleExecuteNow(job)}
                  disabled={executingId === job.id}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  title="اجرا و ارسال فوری همین لحظه"
                >
                  {executingId === job.id ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                  <span>ارسال آنی</span>
                </button>

                <button
                  onClick={() => handleToggleEnable(job)}
                  className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    job.enabled 
                      ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' 
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  }`}
                  title={job.enabled ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                >
                  <Power size={14} />
                </button>

                <button
                  onClick={() => handleOpenEditModal(job)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
                  title="ویرایش پیکربندی"
                >
                  <Edit3 size={14} />
                </button>

                <button
                  onClick={() => handleDeleteJob(job.id)}
                  className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-colors cursor-pointer"
                  title="حذف زمان‌بندی"
                >
                  <Trash2 size={14} />
                </button>

              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL EDIT / CREATE */}
      {isModalOpen && editingJob && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-scaleUp text-right dir-rtl font-sans my-auto z-[10000]">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <span>{editingJob.id ? 'ویرایش زمان‌بندی گزارش' : 'افزودن زمان‌بندی گزارش جدید'}</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              
              <div>
                <label className="block font-bold text-slate-700 mb-1">عنوان زمان‌بندی:</label>
                <input
                  type="text"
                  value={editingJob.title || ''}
                  onChange={(e) => setEditingJob(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="مثلاً: گزارش روزانه فروش مدیریت (ساعت ۱۹:۰۰)"
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ماژول مربوطه:</label>
                  <select
                    value={editingJob.module || 'sales'}
                    onChange={(e) => setEditingJob(prev => ({ ...prev, module: e.target.value as any }))}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-blue-500"
                  >
                    {MODULE_OPTIONS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">نوع گزارش:</label>
                  <select
                    value={editingJob.reportType || 'daily_sales'}
                    onChange={(e) => setEditingJob(prev => ({ ...prev, reportType: e.target.value as any }))}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-blue-500"
                  >
                    {REPORT_TYPE_OPTIONS.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SEPARATE TARGET GROUPS FOR BALE, TELEGRAM, WHATSAPP */}
              <div className="space-y-2 p-3 bg-slate-50/90 rounded-2xl border border-slate-200">
                <label className="block font-extrabold text-slate-800 text-xs">
                  شناسه گروه / چت‌آیدی مقاصد (به تفکیک پیام‌رسان):
                </label>

                {/* Telegram Group */}
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 mb-1">
                    <Send size={13} />
                    <span>گروه / کانال تلگرام:</span>
                  </div>
                  <input
                    type="text"
                    value={editingJob.telegramGroup || ''}
                    onChange={(e) => setEditingJob(prev => ({ ...prev, telegramGroup: e.target.value }))}
                    placeholder="مثلاً: -100123456789 یا @my_sales_channel"
                    className="w-full p-2 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 outline-none focus:border-blue-500 dir-ltr text-left bg-white"
                  />
                </div>

                {/* Bale Group */}
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 mb-1">
                    <MessageSquare size={13} />
                    <span>گروه / کانال بله:</span>
                  </div>
                  <input
                    type="text"
                    value={editingJob.baleGroup || ''}
                    onChange={(e) => setEditingJob(prev => ({ ...prev, baleGroup: e.target.value }))}
                    placeholder="مثلاً: -100123456789 یا bale_sales_channel"
                    className="w-full p-2 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 outline-none focus:border-emerald-500 dir-ltr text-left bg-white"
                  />
                </div>

                {/* WhatsApp Group */}
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-green-700 mb-1">
                    <Bot size={13} />
                    <span>گروه / شماره واتساپ:</span>
                  </div>
                  <input
                    type="text"
                    value={editingJob.whatsappGroup || ''}
                    onChange={(e) => setEditingJob(prev => ({ ...prev, whatsappGroup: e.target.value }))}
                    placeholder="مثلاً: 12036301234567890@g.us یا 09123456789"
                    className="w-full p-2 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 outline-none focus:border-green-600 dir-ltr text-left bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">نوع زمان‌بندی تکرار:</label>
                <select
                  value={editingJob.scheduleType || 'daily_custom'}
                  onChange={(e) => {
                    const st = e.target.value as any;
                    let defaultTime = editingJob.sendTime || '19:00';
                    if (st === 'daily_1900' || st === 'daily_comp_1900') defaultTime = '19:00';
                    setEditingJob(prev => ({ ...prev, scheduleType: st, sendTime: defaultTime }));
                  }}
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-blue-500"
                >
                  {SCHEDULE_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Exact Time Selector for Daily / Custom schedules */}
              {editingJob.scheduleType !== 'cron' ? (
                <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-extrabold text-xs text-blue-900 flex items-center gap-1.5">
                      <Clock size={15} className="text-blue-600" />
                      <span>ساعت دقیق ارسال خودکار روزانه (به وقت تهران):</span>
                    </label>
                    <span className="text-[10px] text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded-lg">Asia/Tehran</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="time"
                      value={editingJob.sendTime || '19:00'}
                      onChange={(e) => setEditingJob(prev => ({ ...prev, sendTime: e.target.value }))}
                      className="p-2 border-2 border-blue-300 rounded-xl font-mono text-sm font-black text-blue-950 bg-white outline-none focus:border-blue-600 text-center w-36 shadow-xs"
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 font-bold">ساعات پیشنهادی:</span>
                      {['08:30', '09:00', '15:00', '17:00', '19:00', '21:00'].map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setEditingJob(prev => ({ ...prev, sendTime: t }))}
                          className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                            editingJob.sendTime === t
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-blue-50'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    💡 گزارش در این ساعت دقیق به صورت اتوماتیک توسط سرور به گروه‌های مشخص شده ارسال خواهد شد.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-2">
                  <label className="font-extrabold text-xs text-amber-900 block">
                    فرمول زمان‌بندی کرون (Cron Expression):
                  </label>
                  <input
                    type="text"
                    value={editingJob.cronExpression || '0 19 * * *'}
                    onChange={(e) => setEditingJob(prev => ({ ...prev, cronExpression: e.target.value }))}
                    placeholder="مثلاً: 0 19 * * * یا 30 15 * * *"
                    className="w-full p-2 border border-amber-300 rounded-xl font-mono text-xs text-slate-900 outline-none focus:border-amber-600 dir-ltr text-left bg-white"
                  />
                  <p className="text-[10px] text-amber-800">
                    فرمت: دقیقه ساعت روز_ماه ماه روز_هفته (به عنوان مثال <code>0 19 * * *</code> یعنی هر روز راس ۱۹:۰۰ به وقت تهران)
                  </p>
                </div>
              )}

              {/* Bot Platforms */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">ربات‌های پیام‌رسان مجاز:</label>
                <div className="flex flex-wrap gap-3 p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {['telegram', 'bale', 'whatsapp', 'eitaa'].map(platform => {
                    const current = editingJob.botPlatforms || [];
                    const isChecked = current.includes(platform as any);
                    return (
                      <label key={platform} className="flex items-center gap-1.5 cursor-pointer font-bold capitalize">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditingJob(prev => ({ ...prev, botPlatforms: [...current, platform as any] }));
                            } else {
                              setEditingJob(prev => ({ ...prev, botPlatforms: current.filter(p => p !== platform) }));
                            }
                          }}
                          className="w-4 h-4 rounded text-blue-600"
                        />
                        <span>{platform}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Attachments */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">پیوست‌های گزارش:</label>
                <div className="flex flex-wrap gap-4 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                    <input
                      type="checkbox"
                      checked={editingJob.attachPdf ?? true}
                      onChange={(e) => setEditingJob(prev => ({ ...prev, attachPdf: e.target.checked }))}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span>فایل PDF رسمی</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                    <input
                      type="checkbox"
                      checked={editingJob.attachExcel ?? true}
                      onChange={(e) => setEditingJob(prev => ({ ...prev, attachExcel: e.target.checked }))}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span>فایل Excel کامل</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                    <input
                      type="checkbox"
                      checked={editingJob.attachImage ?? true}
                      onChange={(e) => setEditingJob(prev => ({ ...prev, attachImage: e.target.checked }))}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span>تصویر داشبورد</span>
                  </label>
                </div>
              </div>

            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                انصراف
              </button>

              <button
                type="button"
                onClick={handleSaveJob}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-md"
              >
                <Check size={16} />
                <span>ذخیره زمان‌بندی</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default ReportDeliveryManager;
