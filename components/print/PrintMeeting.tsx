
import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Loader2, FileDown } from 'lucide-react';
import { generatePdf } from '../../utils/pdfGenerator';
import { MeetingMinutes, MeetingStatus } from '../../types';

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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-start p-4 overflow-y-auto animate-fade-in safe-pb">
      <div className="relative z-50 flex flex-col gap-2 no-print w-full max-w-4xl mb-4">
         <div className="glass-panel p-3 rounded-xl shadow-lg flex justify-between items-center gap-4">
             <span className="font-bold text-sm">پیش‌نمایش چاپ صورتجلسه</span>
             <div className="flex gap-2">
                <button onClick={handleDownloadPDF} disabled={processing} className="bg-red-600 text-white p-2 rounded text-xs flex items-center gap-1">{processing ? <Loader2 size={16} className="animate-spin"/> : <FileDown size={16}/>} دانلود PDF</button>
                <button onClick={() => window.print()} className="bg-blue-600 text-white p-2 rounded text-xs flex items-center gap-1"><Printer size={16}/> چاپ</button>
                <button onClick={onClose} className="bg-gray-100 text-gray-700 p-2 rounded hover:bg-gray-200"><X size={18}/></button>
             </div>
         </div>
      </div>
      
      {/* Printable Area */}
      <div id="meeting-print-area" className="w-full max-w-4xl bg-white p-10 font-sans text-black shadow-lg printable-content" style={{ direction: 'rtl' }}>
        <div className="border-4 border-gray-900 p-6 relative">
            <h1 className="text-2xl font-black text-center mb-8">صورتجلسه</h1>

            <div className="grid grid-cols-2 gap-6 text-sm mb-8 border-b-2 border-gray-200 pb-8">
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

            <div className="grid grid-cols-2 gap-8 mb-8">
                <div><span className="font-black">رئیس جلسه:</span> {meeting.chairman}</div>
                <div><span className="font-black">دبیر جلسه:</span> {meeting.secretary}</div>
            </div>

            <div className="mb-8">
                <h2 className="font-black border-b-2 border-gray-200 mb-4 pb-2">اعضای حاضر</h2>
                <div className="grid grid-cols-2 gap-2">
                    {meeting.attendees.filter(a => a.isPresent).map((a, i) => (
                        <div key={i} className="text-sm">• {a.fullName} - {a.role}</div>
                    ))}
                    {meeting.guestAttendees && meeting.guestAttendees.map((g, i) => (
                        <div key={`guest-${i}`} className="text-sm text-gray-700">• {g} - مدعو</div>
                    ))}
                </div>
            </div>

            <div className="mb-8">
                <h2 className="font-black border-b-2 border-gray-200 mb-4 pb-2">مصوبات</h2>
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
                                <td className="border border-gray-400 p-2 text-center text-sm">{idx + 1}</td>
                                <td className="border border-gray-400 p-2 text-sm">{item.description}</td>
                                <td className="border border-gray-400 p-2 text-center text-sm">{item.responsiblePerson}</td>
                                <td className="border border-gray-400 p-2 text-center text-sm">{item.duration}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-10 border-t-2 border-gray-900 pt-6">
                <h3 className="font-black text-sm mb-4">امضاها و تاییدات:</h3>
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
};
export default PrintMeeting;
