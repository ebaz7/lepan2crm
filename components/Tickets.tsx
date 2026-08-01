import React, { useState, useEffect } from 'react';
import { CustomerTicket } from '../types';
import { Check, X, Send, Search, UserIcon } from 'lucide-react';
import { apiCall } from '../services/apiService';

export const Tickets: React.FC = () => {
  const [tickets, setTickets] = useState<CustomerTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<CustomerTicket | null>(null);
  const [replyText, setReplyText] = useState('');

  const fetchTickets = async () => {
    try {
      const d = await apiCall<CustomerTicket[]>('/tickets');
      setTickets(d);
    } catch(e) {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    try {
      const data = await apiCall<CustomerTicket>(`/tickets/${selectedTicket.id}/reply`, 'POST', { text: replyText, senderName: 'پشتیبانی فروش' });
      setSelectedTicket(data);
      setTickets(tickets.map(t => t.id === data.id ? data : t));
      setReplyText('');
    } catch(e) {}
  };

  const handleStatus = async (id: string, status: 'OPEN' | 'CLOSED') => {
    try {
      const data = await apiCall<CustomerTicket>(`/tickets/${id}/status`, 'PUT', { status });
      setTickets(tickets.map(t => t.id === data.id ? data : t));
      if (selectedTicket?.id === data.id) setSelectedTicket(data);
    } catch(e) {}
  };

  const filtered = tickets.filter(t => t.id.includes(search) || t.customerName?.includes(search) || t.chatId.toString().includes(search));

  return (
    <div className="space-y-4">
      <div className="glass-panel p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
        <h2 className="text-lg font-black text-gray-800">مدیریت تیکت‌های مشتریان</h2>
        <div className="relative w-64">
           <input type="text" placeholder="جستجوی کد، نام..." className="w-full pl-8 pr-4 text-sm border rounded-lg p-2" value={search} onChange={e=>setSearch(e.target.value)}/>
           <Search className="absolute left-2 top-2 text-gray-400" size={16}/>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-2 rounded-xl shadow-sm border border-gray-100 h-[600px] overflow-y-auto space-y-2">
            {loading ? <div className="p-4 text-center text-sm text-gray-500">در حال بارگذاری...</div> : null}
            {filtered.map(t => (
                <div key={t.id} onClick={(e)=>{const cur = e.currentTarget; setTimeout(() => cur.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50); setSelectedTicket(t);}} className={`p-3 rounded-lg cursor-pointer transition flex flex-col gap-1 border-r-4 ${selectedTicket?.id === t.id ? 'bg-blue-50 border-r-blue-500' : 'bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200 border-r-gray-300'}`}>
                    <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-gray-700">#{t.id}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>{t.status === 'OPEN' ? 'باز' : 'بسته'}</span>
                    </div>
                    <div className="text-xs font-bold text-gray-900">{t.customerName || 'مشتری نامشخص'}</div>
                    <div className="text-[10px] text-gray-500 truncate">{t.messages[t.messages.length-1]?.text}</div>
                </div>
            ))}
        </div>
        
        <div className="glass-panel rounded-xl shadow-sm border border-gray-100 md:col-span-2 flex flex-col h-[600px] overflow-hidden">
            {selectedTicket ? (
                <>
                <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-gray-800">تیکت #{selectedTicket.id}</h3>
                        <p className="text-xs text-gray-500">{selectedTicket.customerName} - {selectedTicket.platform}</p>
                    </div>
                    <div className="flex gap-2">
                        {selectedTicket.status === 'OPEN' ? (
                            <button onClick={()=>handleStatus(selectedTicket.id, 'CLOSED')} className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-bold hover:bg-red-200 transition">بستن تیکت</button>
                        ) : (
                            <button onClick={()=>handleStatus(selectedTicket.id, 'OPEN')} className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs font-bold hover:bg-green-200 transition">باز کردن تیکت</button>
                        )}
                    </div>
                </div>
                
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    {selectedTicket.messages.map(m => (
                        <div key={m.id} className={`flex ${m.sender === 'admin' ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[70%] p-3 rounded-xl border ${m.sender === 'admin' ? 'bg-blue-600 outline-blue-600 border-transparent rounded-tr-none text-white' : 'bg-gray-100 border-gray-200/50 dark:border-white/10 rounded-tl-none text-gray-800'}`}>
                                <div className={`text-[10px] font-bold mb-1 ${m.sender === 'admin' ? 'text-blue-100' : 'text-gray-500'}`}>{m.sender === 'admin' ? 'شما' : 'مشتری'}</div>
                                <div className="text-sm whitespace-pre-wrap leading-relaxed space-y-1">{m.text}</div>
                            </div>
                        </div>
                    ))}
                </div>
                
                <div className="p-4 border-t border-gray-100 glass-panel flex gap-2">
                    <textarea value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder="پاسخ خود را بنویسید..." className="flex-1 border border-gray-200 rounded-lg p-2 text-sm max-h-32 min-h-12 focus:ring-2 ring-blue-100 transition"></textarea>
                    <button onClick={handleReply} className="px-4 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center transition disabled:opacity-50" disabled={!replyText.trim() || selectedTicket.status === 'CLOSED'}><Send size={20} className="transform rotate-180"/></button>
                </div>
                </>
            ) : (
                <div className="flex-1 flex items-center justify-center flex-col text-gray-400">
                    <UserIcon size={48} className="mb-4 opacity-50"/>
                    <p>یک تیکت را برای مشاهده انتخاب کنید</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
