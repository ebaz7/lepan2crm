import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Download, 
  Printer, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Maximize2, 
  Minimize2, 
  FileText, 
  Image as ImageIcon, 
  Film, 
  Music, 
  ExternalLink,
  RefreshCw,
  Eye
} from 'lucide-react';
import { resolveImageUrl } from '../services/apiService';
import { downloadAndOpenFile } from '../services/fileService';

export interface FileViewerProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName?: string;
  fileType?: 'image' | 'pdf' | 'audio' | 'video' | 'other' | 'auto';
}

export const FileViewerModal: React.FC<FileViewerProps> = ({
  isOpen,
  onClose,
  fileUrl,
  fileName = 'فایل پیوست',
  fileType = 'auto'
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Reset zoom & rotation when file changes
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setIsDownloading(false);
    }
  }, [isOpen, fileUrl]);

  // Handle ESC key and keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        setZoom(prev => Math.min(prev + 0.25, 4));
      } else if (e.key === '-' || e.key === '_') {
        setZoom(prev => Math.max(prev - 0.25, 0.5));
      } else if (e.key === 'r' || e.key === 'R') {
        setRotation(prev => (prev + 90) % 360);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !fileUrl) return null;

  // Detect file type if auto
  const getDetectedType = (): 'image' | 'pdf' | 'audio' | 'video' | 'other' => {
    if (fileType && fileType !== 'auto') return fileType;
    const cleanUrl = (fileUrl || '').toLowerCase();
    const cleanName = (fileName || '').toLowerCase();
    
    if (cleanUrl.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(cleanUrl) || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(cleanName)) {
      return 'image';
    }
    if (cleanUrl.startsWith('data:application/pdf') || /\.pdf$/i.test(cleanUrl) || /\.pdf$/i.test(cleanName)) {
      return 'pdf';
    }
    if (cleanUrl.startsWith('data:audio/') || /\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(cleanUrl) || /\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(cleanName)) {
      return 'audio';
    }
    if (cleanUrl.startsWith('data:video/') || /\.(mp4|webm|mkv|mov)$/i.test(cleanUrl) || /\.(mp4|webm|mkv|mov)$/i.test(cleanName)) {
      return 'video';
    }
    return 'other';
  };

  const detectedType = getDetectedType();
  const resolvedUrl = resolveImageUrl(fileUrl);

  const handleDownload = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsDownloading(true);
    try {
      await downloadAndOpenFile(resolvedUrl, fileName || 'download');
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (detectedType === 'image') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>${fileName}</title>
              <style>
                body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #fff; }
                img { max-width: 100%; max-height: 100vh; object-fit: contain; }
              </style>
            </head>
            <body>
              <img src="${resolvedUrl}" onload="window.print();window.close();" />
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } else {
      // For PDF or other files, open in new tab for printing
      window.open(resolvedUrl, '_blank');
    }
  };

  const modalElement = (
    <div 
      className="fixed inset-0 z-[9999] flex flex-col bg-slate-950/90 backdrop-blur-md animate-fade-in select-none"
      onClick={onClose}
    >
      {/* Top Header Bar */}
      <div 
        className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800 text-white z-50 shrink-0 shadow-lg"
        onClick={e => e.stopPropagation()}
      >
        {/* File Info */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            {detectedType === 'image' && <ImageIcon size={20} />}
            {detectedType === 'pdf' && <FileText size={20} className="text-red-400" />}
            {detectedType === 'audio' && <Music size={20} className="text-emerald-400" />}
            {detectedType === 'video' && <Film size={20} className="text-purple-400" />}
            {detectedType === 'other' && <FileText size={20} className="text-amber-400" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-100 truncate" title={fileName} dir="ltr">
              {fileName}
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">
              {detectedType === 'image' && 'پیش‌نمایش تصویر'}
              {detectedType === 'pdf' && 'سند PDF'}
              {detectedType === 'audio' && 'فایل صوتی'}
              {detectedType === 'video' && 'ویدیو'}
              {detectedType === 'other' && 'فایل پیوست'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Image-Specific Tools */}
          {detectedType === 'image' && (
            <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 ml-1 sm:ml-2">
              <button 
                onClick={() => setZoom(prev => Math.min(prev + 0.25, 4))}
                className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                title="بزرگ‌نمایی (+)"
              >
                <ZoomIn size={16} />
              </button>
              <button 
                onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.5))}
                className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                title="کوچک‌نمایی (-)"
              >
                <ZoomOut size={16} />
              </button>
              <button 
                onClick={() => setRotation(prev => (prev + 90) % 360)}
                className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                title="چرخش ۹۰ درجه (R)"
              >
                <RotateCw size={16} />
              </button>
              {(zoom !== 1 || rotation !== 0) && (
                <button 
                  onClick={() => { setZoom(1); setRotation(0); }}
                  className="px-2 py-1 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
                  title="بازنشانی"
                >
                  ۱۰۰٪
                </button>
              )}
            </div>
          )}

          {/* Open In New Tab */}
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-colors hidden sm:flex items-center gap-1 text-xs"
            title="باز کردن در تب جدید"
          >
            <ExternalLink size={16} />
            <span className="hidden md:inline">تب جدید</span>
          </a>

          {/* Print Button */}
          {(detectedType === 'image' || detectedType === 'pdf') && (
            <button
              onClick={handlePrint}
              className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-colors flex items-center gap-1 text-xs"
              title="چاپ فایل"
            >
              <Printer size={16} />
              <span className="hidden md:inline">چاپ</span>
            </button>
          )}

          {/* Direct Download Button */}
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
            title="دانلود فایل روی دستگاه"
          >
            {isDownloading ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
            <span>دانلود</span>
          </button>

          {/* Close Button */}
          <button 
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-rose-600/80 text-slate-300 hover:text-white rounded-xl transition-colors mr-1 cursor-pointer"
            title="بستن (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div 
        className="flex-1 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden relative"
        onClick={onClose}
      >
        {detectedType === 'image' && (
          <div 
            className="relative flex items-center justify-center w-full h-full overflow-auto"
            onClick={onClose}
          >
            <img 
              src={resolvedUrl} 
              alt={fileName}
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transition: 'transform 0.2s ease-out'
              }}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl cursor-default"
              onClick={e => e.stopPropagation()}
            />
          </div>
        )}

        {detectedType === 'pdf' && (
          <div 
            className="w-full h-full max-w-6xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-700/50"
            onClick={e => e.stopPropagation()}
          >
            <iframe 
              src={`${resolvedUrl}#toolbar=1&navpanes=1`} 
              className="w-full flex-1 border-0 rounded-2xl"
              title={fileName}
            />
          </div>
        )}

        {detectedType === 'audio' && (
          <div 
            className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl max-w-md w-full flex flex-col items-center gap-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Music size={36} />
            </div>
            <div className="text-center">
              <h4 className="text-white font-bold text-base line-clamp-1" dir="ltr">{fileName}</h4>
              <p className="text-xs text-slate-400 mt-1">پخش فایل صوتی پیوست</p>
            </div>
            <audio controls src={resolvedUrl} className="w-full" autoPlay />
          </div>
        )}

        {detectedType === 'video' && (
          <div 
            className="max-w-4xl max-h-[85vh] w-full rounded-2xl overflow-hidden shadow-2xl bg-black"
            onClick={e => e.stopPropagation()}
          >
            <video controls src={resolvedUrl} className="w-full h-full max-h-[85vh] object-contain" autoPlay />
          </div>
        )}

        {detectedType === 'other' && (
          <div 
            className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center flex flex-col items-center gap-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center text-amber-400">
              <FileText size={36} />
            </div>
            <div>
              <h4 className="text-white font-bold text-base line-clamp-2" dir="ltr">{fileName}</h4>
              <p className="text-xs text-slate-400 mt-1">این نوع فایل امکان پیش‌نمایش مستقیم درون مرورگر را ندارد.</p>
            </div>
            <div className="flex gap-3 mt-4 w-full">
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-3 px-4 rounded-xl font-bold text-sm transition-all shadow-lg"
              >
                <Download size={18} />
                <span>دانلود و باز کردن</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalElement, document.body);
};
