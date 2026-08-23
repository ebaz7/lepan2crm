
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Loader2, FileDown } from 'lucide-react';
import { generatePdf } from '../../utils/pdfGenerator';
import { MeetingMinutes } from '../../types';

interface PrintMeetingProps {
  meeting: MeetingMinutes;
  onClose: () => void;
}

const PrintMeeting: React.FC<PrintMeetingProps> = ({ meeting, onClose }) => {
  const [processing, setProcessing] = useState(false);

  const handleDownloadPDF = async () => {
      setProcessing(true);
      await generatePdf({
          elementId: 'meeting-print-area',
          filename: `Meeting_${meeting.meetingNumber}.pdf`,
          format: 'A4',
          orientation: 'portrait',
          onComplete: () => setProcessing(false),
          onError: () => { alert('خطا در ایجاد PDF'); setProcessing(false); }
      });
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex flex-col items-center justify-start p-3 sm:p-6 md:p-8 overflow-y-auto animate-fade-in custom-scrollbar">
      <div className="relative z-50 flex flex-col gap-2 no-print w-full max-w-4xl mb-4 shrink-0">
         <div className="glass-panel p-3 sm:p-4 rounded-2xl shadow-xl flex justify-between items-center gap-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
             <span className="font-bold text-sm text-gray-800 dark:text-gray-200">پیش‌نمایش چاپ صورتجلسه شماره {meeting.meetingNumber}</span>
             <div className="flex items-center gap-2">
                <button onClick={handleDownloadPDF} disabled={processing} className="bg-red-600 hover:bg-red-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm">{processing ? <Loader2 size={15} className="animate-spin"/> : <FileDown size={15}/>} دانلود PDF</button>
                <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"><Printer size={15}/> چاپ</button>
                <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 p-1.5 rounded-xl transition-colors"><X size={18}/></button>
             </div>
         </div>
      </div>
      
      {/* Printable Area */}
      <div id="meeting-print-area" className="w-full max-w-4xl bg-white p-6 sm:p-10 font-sans text-black shadow-2xl rounded-2xl printable-content my-2" style={{ direction: 'rtl' }}>
        <div className="border-4 border-gray-900 p-4 sm:p-6 relative rounded-xl">
            <h1 className="text-xl sm:text-2xl font-black text-center mb-6 sm:mb-8">صورتجلسه</h1>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs sm:text-sm mb-6 sm:mb-8 border-b-2 border-gray-200 pb-6 sm:pb-8">
                <div className="space-y-1">
                    <div className="text-gray-500 font-bold text-xs">شماره جلسه:</div>
                    <div className="font-black">{meeting.meetingNumber}</div>
                </div>
                <div className="space-y-1">
                    <div className="text-gray-500 font-bold text-xs">تاریخ برگزاری:</div>
                    <div className="font-black font-mono">{meeting.date}</div>
                </div>
                <div className="space-y-1">
                    <div className="text-gray-500 font-bold text-xs">ساعت برگزاری:</div>
                    <div className="font-black font-mono">{meeting.time}</div>
                </div>
                <div className="space-y-1">
                    <div className="text-gray-500 font-bold text-xs">محل برگزاری:</div>
                    <div className="font-black">{meeting.location}</div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm mb-6 sm:mb-8 border-b-2 border-gray-200 pb-6 sm:pb-8">
                <div><span className="font-black">رئیس جلسه:</span> {meeting.chairman}</div>
                <div><span className="font-black">دبیر جلسه:</span> {meeting.secretary}</div>
            </div>

            <div className="mb-8">
                <h2 className="font-black border-b-2 border-gray-200 mb-4 pb-2 text-xs sm:text-sm">اعضای حاضر</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {meeting.attendees.filter(a => a.isPresent).map((a, i) => (
                        <div key={i} className="text-xs bg-gray-50 p-2 rounded border border-gray-200 font-bold">• {a.fullName} - {a.role}</div>
                    ))}
                    {meeting.guestAttendees && meeting.guestAttendees.map((g, i) => (
                        <div key={`guest-${i}`} className="text-xs text-gray-700 bg-gray-50 p-2 rounded border border-gray-200 font-bold">• {g} - مدعو</div>
                    ))}
                </div>
            </div>

            <div className="mb-8">
                <h2 className="font-black border-b-2 border-gray-200 mb-4 pb-2 text-xs sm:text-sm">مصوبات</h2>
                <table className="w-full border-collapse border border-gray-400">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-gray-400 p-2 text-xs">ردیف</th>
                            <th className="border border-gray-400 p-2 text-xs">شرح</th>
                            <th className="border border-gray-400 p-2 text-xs">مسئول</th>
                            <th className="border border-gray-400 p-2 text-xs">مهلت</th>
                        </tr>
                    </thead>
                    <tbody>
                        {meeting.items.map((item, idx) => (
                            <tr key={item.id}>
                                <td className="border border-gray-400 p-2 text-center text-xs">{idx + 1}</td>
                                <td className="border border-gray-400 p-2 text-xs leading-relaxed">{item.description}</td>
                                <td className="border border-gray-400 p-2 text-center text-xs">{item.responsiblePerson}</td>
                                <td className="border border-gray-400 p-2 text-center text-xs">{item.duration}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-10 border-t-2 border-gray-900 pt-6">
                <h3 className="font-black text-xs sm:text-sm mb-4">امضاها و تاییدات:</h3>
                <div className="flex flex-wrap gap-4">
                {Object.entries(meeting.approvals || {}).map(([username, appInfo]) => {
                    const attendee = meeting.attendees.find(a => a.username === username);
                    const name = attendee ? attendee.fullName : username;
                    const role = attendee ? attendee.role : 'عضو';
                    return (
                        <div key={username} className="border-2 border-emerald-800 text-emerald-800 rounded-xl p-3 transform -rotate-3 text-center bg-white min-w-[100px] shadow-sm">
                            <div className="text-[9px] font-black border-b border-emerald-800 mb-1 pb-0.5">تایید شد</div>
                            <div className="text-xs font-black">{name}</div>
                            <div className="text-[8px] font-bold mt-1">{role}</div>
                            <div className="text-[8px] font-bold">{new Date(appInfo.date).toLocaleDateString('fa-IR')}</div>
                        </div>
                    );
                })}
                </div>
            </div>
        </div>
      </div>

    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
export default PrintMeeting;
