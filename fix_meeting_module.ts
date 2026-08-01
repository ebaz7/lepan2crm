
import fs from 'fs';
import path from 'path';

const filePath = './components/MeetingModule.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove duplicate handleSignMeeting between lines 80 and 120
const lines = content.split('\n');
let firstSignIndex = -1;
for (let i = 0; i < 150; i++) {
    if (lines[i] && lines[i].includes('const handleSignMeeting =')) {
        firstSignIndex = i;
        break;
    }
}
if (firstSignIndex !== -1) {
    // Find the end of this function (it ends around line 114)
    let endFirstSign = -1;
    for (let i = firstSignIndex + 1; i < 150; i++) {
        if (lines[i] && lines[i].includes('    };')) {
            endFirstSign = i;
            // Check if it's really the end of handleSignMeeting
             // We'll keep searching until we find a line with just }; usually
             // but let's be more specific or just delete a fixed range if we know it.
             // Based on view_file, it's 88 to 114.
        }
    }
    // Let's just delete the known range 88 to 115 (approx)
    // Actually, I'll delete from line 88 to 114 inclusive (0-indexed: 87 to 113)
    console.log('Removing duplicate handleSignMeeting at lines 88 to 115');
    lines.splice(87, 115 - 87 + 1); 
}

// 2. Fix the corrupted buttons block
// We need to find the block again since indices changed
content = lines.join('\n');
const fixedLines = content.split('\n');

const btnStartMarker = '<div className="mt-5 pt-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between gap-2">';
const btnEndMarker = '</div>'; // This is tricky as there are many </div>

// Let's just find the section around line 413 (now shifted)
// and replace it with a clean one.
let sectionStart = -1;
for (let i = 0; i < fixedLines.length; i++) {
    if (fixedLines[i].includes('mt-5 pt-4 border-t')) {
        sectionStart = i;
        break;
    }
}

if (sectionStart !== -1) {
    // Find the end of the meeting card (the </div> for </div>))} )
    // Actually, let's just replace from sectionStart to the next </div></div> at the end of card.
    let sectionEnd = -1;
    let openDivs = 0;
    for (let i = sectionStart; i < fixedLines.length; i++) {
        if (fixedLines[i].includes('<div')) openDivs++;
        if (fixedLines[i].includes('</div')) openDivs--;
        if (openDivs <= -1) { // we went past the section
             sectionEnd = i - 1;
             break;
        }
        // Actually simpler: the cards end with certain patterns.
    }
    
    // Based on previous view, 413 to 463 was the block.
    // Let's just replace a large safe chunk.
    const newButtonsBlock = `                             <div className="mt-5 pt-4 border-t border-gray-100 dark:border-white/5 flex flex-col gap-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => setViewMeeting(meeting)} className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 rounded-xl transition-colors" title="مشاهده">
                                            <Eye size={18} />
                                        </button>
                                        <button onClick={() => handleDownloadPDF(meeting.id, meeting.meetingNumber || 'Unknown')} className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 rounded-xl transition-colors" title="دریافت PDF">
                                            <Printer size={18} />
                                        </button>
                                        {canCreate && meeting.status === MeetingStatus.DRAFT && (
                                            <button onClick={() => handleEditMeeting(meeting)} className="p-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 rounded-xl transition-colors" title="ویرایش">
                                                <Edit size={18} />
                                            </button>
                                        )}
                                        {canManage && (
                                            <button onClick={() => handleDeleteMeeting(meeting.id)} className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-600 rounded-xl transition-colors" title="حذف">
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {meeting.status === MeetingStatus.PENDING_APPROVAL && 
                                         meeting.attendees.some(a => a.fullName === currentUser.fullName) && 
                                         !meeting.approvals?.[currentUser.username]?.approved && (
                                            <button onClick={() => handleSignMeeting(meeting)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-1.5 animate-pulse">
                                                <UserCheck size={14} />
                                                امضای صورتجلسه
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2 w-full">
                                    {canManage && meeting.status === MeetingStatus.DRAFT && (
                                        <button onClick={() => handleStatusChange(meeting, MeetingStatus.PENDING_APPROVAL)} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5">
                                            <Send size={14} />
                                            ارسال جهت تایید
                                        </button>
                                    )}
                                    {canManage && meeting.status === MeetingStatus.APPROVED && (
                                        <button onClick={() => handleSendToGroup(meeting.id)} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5">
                                            <MessageSquare size={14} />
                                            ارسال به گروه
                                        </button>
                                    )}
                                </div>
                             </div>`;

    // Final clean up of the corrupted area
    // Find where the map ends
    let mapEnd = -1;
    for (let i = sectionStart; i < fixedLines.length; i++) {
        if (fixedLines[i].includes('))}')) {
            mapEnd = i;
            break;
        }
    }
    
    if (mapEnd !== -1) {
        console.log(`Replacing section between ${sectionStart + 1} and ${mapEnd}`);
        // We replace from sectionStart to mapEnd - 1 (the content of the map)
        // Wait, the map content ends before ))}
        fixedLines.splice(sectionStart, mapEnd - sectionStart, newButtonsBlock);
        fs.writeFileSync(filePath, fixedLines.join('\n'));
        console.log('Successfully cleaned buttons and signature logic.');
    }
}
