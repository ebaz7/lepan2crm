import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Undo2, Check, Sparkles, X, PenTool, RefreshCw } from 'lucide-react';

interface PersianHandwritingPadProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectText: (text: string, targetField: string) => void;
  initialTargetField?: string;
}

export const PersianHandwritingPad: React.FC<PersianHandwritingPadProps> = ({
  isOpen,
  onClose,
  onSelectText,
  initialTargetField = 'amountWords'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [targetField, setTargetField] = useState<string>(initialTargetField);
  const [languageMode, setLanguageMode] = useState<'fa' | 'en'>('fa');
  
  // Ink strokes in Google Input Tools format:
  // An array of strokes. Each stroke is [[x1, x2, ...], [y1, y2, ...], [t1, t2, ...]]
  const [strokes, setStrokes] = useState<number[][][]>([]);
  const [currentStrokeX, setCurrentStrokeX] = useState<number[]>([]);
  const [currentStrokeY, setCurrentStrokeY] = useState<number[]>([]);
  const [currentStrokeT, setCurrentStrokeT] = useState<number[]>([]);
  
  const [candidates, setCandidates] = useState<string[]>([]);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognitionError, setRecognitionError] = useState<string>('');

  // Target field options
  const fieldOptions = [
    { value: 'sayyadId', label: 'شناسه ۱۶ رقمی صیاد' },
    { value: 'chequeNumber', label: 'شماره چک' },
    { value: 'dueDate', label: 'تاریخ سررسید (مثال: ۱۴۰۵/۰۳/۳۱)' },
    { value: 'amountWords', label: 'مبلغ به حروف' },
    { value: 'amountDigits', label: 'مبلغ به عدد (ریال)' },
    { value: 'drawerName', label: 'نام صاحب حساب' }
  ];

  // Initialize canvas
  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#3b82f6'; // beautiful blue ink
      }
      clearCanvas();
    }
  }, [isOpen]);

  // Keep target field in sync with initial value if it changes
  useEffect(() => {
    setTargetField(initialTargetField);
  }, [initialTargetField]);

  // Draw on canvas and update strokes
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const t = Date.now();

    setIsDrawing(true);
    setCurrentStrokeX([x]);
    setCurrentStrokeY([y]);
    setCurrentStrokeT([t]);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.1, y + 0.1); // draw a point
      ctx.stroke();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const t = Date.now();

    setCurrentStrokeX(prev => [...prev, x]);
    setCurrentStrokeY(prev => [...prev, y]);
    setCurrentStrokeT(prev => [...prev, t]);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentStrokeX.length > 0) {
      const newStroke = [currentStrokeX, currentStrokeY, currentStrokeT];
      const updatedStrokes = [...strokes, newStroke];
      setStrokes(updatedStrokes);
      
      // Trigger recognition after a slight delay
      triggerRecognition(updatedStrokes);
    }

    setCurrentStrokeX([]);
    setCurrentStrokeY([]);
    setCurrentStrokeT([]);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setStrokes([]);
    setCandidates([]);
    setRecognitionError('');
  };

  const undoLastStroke = () => {
    if (strokes.length === 0) return;
    
    const updatedStrokes = strokes.slice(0, -1);
    setStrokes(updatedStrokes);
    
    // Redraw canvas
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    updatedStrokes.forEach(stroke => {
      const xs = stroke[0];
      const ys = stroke[1];
      if (xs.length === 0) return;

      ctx.beginPath();
      ctx.moveTo(xs[0], ys[0]);
      for (let i = 1; i < xs.length; i++) {
        ctx.lineTo(xs[i], ys[i]);
      }
      ctx.stroke();
    });

    if (updatedStrokes.length > 0) {
      triggerRecognition(updatedStrokes);
    } else {
      setCandidates([]);
    }
  };

  // Debounce helper for auto-recognition
  const recognitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerRecognition = (targetStrokes: number[][][]) => {
    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
    }

    recognitionTimeoutRef.current = setTimeout(() => {
      performRecognition(targetStrokes);
    }, 600);
  };

  const performRecognition = async (targetStrokes: number[][][]) => {
    if (targetStrokes.length === 0) return;

    setIsRecognizing(true);
    setRecognitionError('');

    try {
      const canvas = canvasRef.current;
      const width = canvas ? canvas.width : 500;
      const height = canvas ? canvas.height : 250;

      const languageCode = languageMode === 'fa' ? 'fa-t-i0-handwrit' : 'en-t-i0-handwrit';

      const payload = {
        app: 'translate',
        device: 'desktop',
        input_type: '0',
        itc: languageCode,
        requests: [
          {
            writing_area_width: width,
            writing_area_height: height,
            ink: targetStrokes
          }
        ]
      };

      const response = await fetch('https://inputtools.google.com/request?itc=' + languageCode + '&app=translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Google Input Tools response error');
      }

      const data = await response.json();
      
      if (data && data[0] === 'SUCCESS') {
        const results = data[1][0][1];
        if (results && results.length > 0) {
          setCandidates(results);
        } else {
          setCandidates([]);
        }
      } else {
        setCandidates([]);
      }
    } catch (error) {
      console.error('Handwriting recognition failed:', error);
      setRecognitionError('خطا در ارتباط با سرویس آنلاین تشخیص دست‌خط');
    } finally {
      setIsRecognizing(false);
    }
  };

  const handleSelectCandidate = (text: string) => {
    onSelectText(text, targetField);
    
    // Auto clear canvas for next input to make it feel extremely fluid
    clearCanvas();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden animate-fade-in flex flex-col text-right" dir="rtl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
          <div className="flex items-center gap-2.5">
            <div className="bg-blue-100 dark:bg-blue-950/40 p-2 rounded-xl text-blue-600 dark:text-blue-400">
              <PenTool size={18} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs font-black text-gray-900 dark:text-white">بوم هوشمند تشخیص دست‌خط (طرح Samsung Notes)</h3>
              <p className="text-[10px] text-gray-500 mt-0.5 font-bold">با ماوس یا قلم روی بوم بنویسید تا دست‌خط شما به متن تبدیل شود</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Target Field and Language Selector */}
        <div className="p-5 flex flex-col md:flex-row gap-4 border-b border-gray-50 dark:border-white/5">
          <div className="flex-1">
            <label className="block text-[10px] font-black text-gray-500 mb-1.5">فیلد هدف برای درج متن:</label>
            <select
              value={targetField}
              onChange={(e) => setTargetField(e.target.value)}
              className="w-full text-xs font-bold px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl text-gray-800 dark:text-white outline-none focus:border-blue-500"
            >
              {fieldOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="shrink-0 flex flex-col justify-end">
            <label className="block text-[10px] font-black text-gray-500 mb-1.5">زبان نوشتن:</label>
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => {
                  setLanguageMode('fa');
                  clearCanvas();
                }}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                  languageMode === 'fa' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                فارسی (دست‌نویس)
              </button>
              <button
                type="button"
                onClick={() => {
                  setLanguageMode('en');
                  clearCanvas();
                }}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                  languageMode === 'en' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                English / 123
              </button>
            </div>
          </div>
        </div>

        {/* Drawing Canvas Area */}
        <div className="p-5 flex flex-col items-center">
          <div className="relative w-full h-[220px] bg-sky-50/20 dark:bg-blue-950/10 border-2 border-dashed border-blue-200 dark:border-blue-900/40 rounded-2xl overflow-hidden shadow-inner">
            <canvas
              ref={canvasRef}
              width={520}
              height={220}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
            />
            {strokes.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-gray-400 dark:text-gray-600 gap-2">
                <PenTool size={36} className="opacity-40" />
                <span className="text-[11px] font-bold">اینجا بنویسید (مثلاً: پانصد میلیون یا ۵۲۵۷۰۴...)</span>
              </div>
            )}

            {/* Canvas Actions Overlay */}
            <div className="absolute left-3 bottom-3 flex items-center gap-1.5">
              <button
                type="button"
                onClick={undoLastStroke}
                disabled={strokes.length === 0}
                className="p-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/10 rounded-xl text-gray-600 dark:text-gray-300 disabled:opacity-40 transition-colors cursor-pointer shadow"
                title="بازگشت (Undo)"
              >
                <Undo2 size={14} />
              </button>
              <button
                type="button"
                onClick={clearCanvas}
                disabled={strokes.length === 0}
                className="p-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/10 rounded-xl text-red-500 disabled:opacity-40 transition-colors cursor-pointer shadow"
                title="پاک کردن کل صفحه"
              >
                <Eraser size={14} />
              </button>
            </div>

            {/* Smart recognition loader */}
            {isRecognizing && (
              <div className="absolute right-3 top-3 bg-white/90 dark:bg-gray-900/90 px-2.5 py-1 rounded-lg shadow border border-gray-100 dark:border-white/5 text-[10px] font-black text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <RefreshCw size={10} className="animate-spin" />
                در حال شناسایی هوشمند...
              </div>
            )}
          </div>
        </div>

        {/* Live Recognition Candidates */}
        <div className="px-5 pb-5 flex flex-col min-h-[90px] border-t border-gray-50 dark:border-white/5 bg-gray-50/30 dark:bg-white/5 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-gray-400 flex items-center gap-1">
              <Sparkles size={11} className="text-yellow-500" />
              کلمات پیشنهادی (برای تایید و درج کلیک کنید):
            </span>
            {recognitionError && (
              <span className="text-[10px] text-red-500 font-bold">{recognitionError}</span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {candidates.length > 0 ? (
              candidates.map((cand, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectCandidate(cand)}
                  className="px-3 py-1.5 bg-gradient-to-tr from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200/50 dark:border-blue-800/30 hover:border-blue-400 dark:hover:border-blue-600 text-blue-700 dark:text-blue-400 text-xs font-black rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95"
                >
                  {cand}
                </button>
              ))
            ) : (
              <span className="text-[10px] text-gray-400 italic">هیچ متنی شناسایی نشده است. شروع به نوشتن کنید.</span>
            )}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex items-center justify-between p-5 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-black text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all cursor-pointer"
          >
            بستن بوم
          </button>
          
          <button
            type="button"
            disabled={candidates.length === 0}
            onClick={() => handleSelectCandidate(candidates[0])}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Check size={14} />
            درج اولین کاندید ({candidates[0] || '-'})
          </button>
        </div>

      </div>
    </div>
  );
};
