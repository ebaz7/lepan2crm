import React, { useState } from 'react';
import { FileText, Image as ImageIcon, Download, Eye, Trash2, Paperclip } from 'lucide-react';
import { resolveImageUrl } from '../services/apiService';
import { downloadAndOpenFile } from '../services/fileService';
import { FileViewerModal } from './FileViewerModal';

export interface AttachmentItem {
  fileName: string;
  url?: string;
  data?: string;
}

interface AttachmentBadgeProps {
  attachment: AttachmentItem;
  onDelete?: () => void;
  showPreviewOnClick?: boolean;
  variant?: 'compact' | 'card' | 'pill';
  className?: string;
}

export const AttachmentBadge: React.FC<AttachmentBadgeProps> = ({
  attachment,
  onDelete,
  showPreviewOnClick = true,
  variant = 'compact',
  className = ''
}) => {
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const fileUrl = attachment.url || attachment.data || '';
  const fileName = attachment.fileName || 'فایل پیوست';

  const isImage = fileUrl.startsWith('data:image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(fileName) || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(fileUrl);
  const isPdf = fileUrl.startsWith('data:application/pdf') || /\.pdf$/i.test(fileName) || /\.pdf$/i.test(fileUrl);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadAndOpenFile(fileUrl, fileName);
  };

  const handleOpenViewer = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showPreviewOnClick) {
      setIsViewerOpen(true);
    } else {
      downloadAndOpenFile(fileUrl, fileName);
    }
  };

  return (
    <>
      {variant === 'card' && (
        <div 
          onClick={handleOpenViewer}
          className={`group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-xs hover:shadow-md transition-all cursor-pointer ${className}`}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {isImage ? (
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-blue-50 dark:bg-blue-900/30 shrink-0 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                <img 
                  src={resolveImageUrl(fileUrl)} 
                  alt={fileName} 
                  className="w-full h-full object-cover" 
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPdf ? 'bg-red-50 dark:bg-red-900/30 text-red-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
                {isPdf ? <FileText size={20} /> : <Paperclip size={20} />}
              </div>
            )}
            <div className="min-w-0 flex-1 text-right">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate" dir="ltr" title={fileName}>
                {fileName}
              </span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 mt-0.5">
                <Eye size={11} />
                <span>کلیک جهت مشاهده</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition-colors"
              title="دانلود فایل"
            >
              <Download size={16} />
            </button>
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-600 rounded-xl transition-colors"
                title="حذف پیوست"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {variant === 'pill' && (
        <div 
          onClick={handleOpenViewer}
          className={`inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer group ${className}`}
        >
          {isImage ? <ImageIcon size={13} className="text-blue-500 shrink-0" /> : isPdf ? <FileText size={13} className="text-red-500 shrink-0" /> : <Paperclip size={13} className="text-slate-400 shrink-0" />}
          <span className="font-bold truncate max-w-[140px] text-[11px]" dir="ltr" title={fileName}>
            {fileName}
          </span>
          <button
            onClick={handleDownload}
            className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors mr-0.5"
            title="دانلود فایل"
          >
            <Download size={12} />
          </button>
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-0.5 hover:bg-rose-100 text-rose-500 rounded-full transition-colors"
              title="حذف"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      )}

      {variant === 'compact' && (
        <div 
          onClick={handleOpenViewer}
          className={`inline-flex items-center gap-1.5 bg-blue-50/60 dark:bg-blue-900/20 border border-blue-200/70 dark:border-blue-800/40 text-blue-900 dark:text-blue-200 px-2.5 py-1 rounded-xl text-xs hover:bg-blue-100/80 dark:hover:bg-blue-900/40 transition-all cursor-pointer group ${className}`}
        >
          {isImage ? <ImageIcon size={13} className="text-blue-600 shrink-0" /> : isPdf ? <FileText size={13} className="text-red-600 shrink-0" /> : <Paperclip size={13} className="text-blue-600 shrink-0" />}
          <span className="font-bold truncate max-w-[150px] text-[11px]" dir="ltr" title={fileName}>
            {fileName}
          </span>
          <div className="flex items-center gap-0.5 border-r border-blue-200 dark:border-blue-800 pr-1 mr-1" onClick={e => e.stopPropagation()}>
            <button
              onClick={handleDownload}
              className="p-1 hover:bg-blue-200/60 dark:hover:bg-blue-800/60 text-blue-700 dark:text-blue-300 rounded-lg transition-colors"
              title="دانلود فایل"
            >
              <Download size={12} />
            </button>
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-1 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                title="حذف"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* In-app File Preview Modal */}
      <FileViewerModal
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        fileUrl={fileUrl}
        fileName={fileName}
      />
    </>
  );
};
