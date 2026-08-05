import React, { useState, useEffect, useRef } from 'react';
import { normalizeInputNumber } from '../constants';
import { Camera, Keyboard, Sparkles, Check, Info } from 'lucide-react';

interface IranPlateInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  readOnly?: boolean;
}

export const PERSIAN_PLATE_LETTERS = [
  'الف', 'ب', 'پ', 'ت', 'ث', 'ج', 'چ', 'ح', 'خ', 'د', 
  'ذ', 'ر', 'ز', 'ژ', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 
  'ع', 'غ', 'ف', 'ق', 'ک', 'گ', 'ل', 'م', 'ن', 'و', 
  'ه', 'ی', 'D', 'S'
];

// Most common plate letters for quick visual tap grid
export const QUICK_PLATE_LETTERS = [
  'ب', 'ج', 'د', 'س', 'ص', 'ط', 'ع', 'ق', 'ل', 'م', 'ن', 'و', 'ه', 'ی', 'الف', 'ت'
];

export const parseIranianPlate = (str: string): { p1: string; char: string; p2: string; city: string } => {
  if (!str) return { p1: '', char: '', p2: '', city: '' };
  
  const clean = normalizeInputNumber(str).replace(/\s+/g, '').replace(/[\-\_]/g, '');
  
  // Try matching 2 digits + 1-2 chars + 3 digits + 2 digits
  // e.g. 12ب34567 or 12الف34567
  const m = clean.match(/^(\d{2})([آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیA-Za-z]{1,3})(\d{3})(\d{2})$/);
  if (m) {
    return { p1: m[1], char: m[2], p2: m[3], city: m[4] };
  }

  // Fallback pattern matching
  const numOnly = clean.replace(/[^0-9]/g, '');
  const lettersOnly = clean.replace(/[0-9]/g, '');

  if (numOnly.length >= 7) {
    return {
      p1: numOnly.slice(0, 2),
      char: lettersOnly || 'ب',
      p2: numOnly.slice(2, 5),
      city: numOnly.slice(5, 7)
    };
  }

  // Attempt partial parse for user typing
  if (numOnly.length > 0) {
    return {
      p1: numOnly.slice(0, 2),
      char: lettersOnly || 'ب',
      p2: numOnly.slice(2, 5),
      city: numOnly.slice(5, 7)
    };
  }

  return { p1: '', char: '', p2: '', city: '' };
};

export const IranPlateInput: React.FC<IranPlateInputProps> = ({ value, onChange, className = '', readOnly = false }) => {
  const parsed = parseIranianPlate(value);

  const [p1, setP1] = useState(parsed.p1);
  const [char, setChar] = useState(parsed.char || 'ب');
  const [p2, setP2] = useState(parsed.p2);
  const [city, setCity] = useState(parsed.city);
  
  // Input method: 'realistic' (gorgeous interactive plate) or 'simple' (standard single input text field)
  const [entryMode, setEntryMode] = useState<'realistic' | 'simple'>(() => {
    return (localStorage.getItem('plate_entry_mode') as 'realistic' | 'simple') || 'realistic';
  });

  // Plate background color theme: 'white' (private), 'yellow' (public/truck), 'red' (gov), 'blue' (diplomatic)
  const [plateTheme, setPlateTheme] = useState<'white' | 'yellow' | 'red' | 'blue'>(() => {
    if (char === 'ع' || char === 'ت') return 'yellow';
    if (char === 'الف') return 'red';
    return 'white';
  });

  // Flat text input state for 'simple' mode
  const [simpleText, setSimpleText] = useState('');

  const p1Ref = useRef<HTMLInputElement>(null);
  const p2Ref = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);

  // Sync internal state if external value changes
  useEffect(() => {
    const updated = parseIranianPlate(value);
    setP1(updated.p1);
    if (updated.char) {
      setChar(updated.char);
      // Auto theme based on characters
      if (updated.char === 'ع' || updated.char === 'ت') {
        setPlateTheme('yellow');
      } else if (updated.char === 'الف') {
        setPlateTheme('red');
      }
    }
    setP2(updated.p2);
    setCity(updated.city);

    // Also sync simpleText state
    if (value) {
      // Human readable format e.g. "12 ب 345 - ایران 67"
      setSimpleText(`${updated.p1} ${updated.char} ${updated.p2} - ${updated.city}`);
    } else {
      setSimpleText('');
    }
  }, [value]);

  const updatePlate = (newP1: string, newChar: string, newP2: string, newCity: string) => {
    setP1(newP1);
    setChar(newChar);
    setP2(newP2);
    setCity(newCity);

    if (newP1 || newChar || newP2 || newCity) {
      onChange(`${newP1}${newChar}${newP2}${newCity}`);
    } else {
      onChange('');
    }
  };

  const handleP1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = normalizeInputNumber(e.target.value).replace(/\D/g, '').slice(0, 2);
    updatePlate(raw, char, p2, city);
    if (raw.length === 2 && p2Ref.current) {
      p2Ref.current.focus();
      p2Ref.current.select();
    }
  };

  const handleP2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = normalizeInputNumber(e.target.value).replace(/\D/g, '').slice(0, 3);
    updatePlate(p1, char, raw, city);
    if (raw.length === 3 && cityRef.current) {
      cityRef.current.focus();
      cityRef.current.select();
    }
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = normalizeInputNumber(e.target.value).replace(/\D/g, '').slice(0, 2);
    updatePlate(p1, char, p2, raw);
  };

  const handleCharSelect = (selectedChar: string) => {
    updatePlate(p1, selectedChar, p2, city);
    
    // Auto color switch based on selected letter for realism
    if (selectedChar === 'ع' || selectedChar === 'ت') {
      setPlateTheme('yellow');
    } else if (selectedChar === 'الف') {
      setPlateTheme('red');
    } else {
      setPlateTheme('white');
    }

    if (p2Ref.current) {
      p2Ref.current.focus();
      p2Ref.current.select();
    }
  };

  // Move back on backspace if field is empty
  const handleP2KeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !p2 && p1Ref.current) {
      p1Ref.current.focus();
      p1Ref.current.select();
    }
  };

  const handleCityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !city && p2Ref.current) {
      p2Ref.current.focus();
      p2Ref.current.select();
    }
  };

  const handleSimpleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setSimpleText(text);

    // Live parsing simple input
    const parsedText = parseIranianPlate(text);
    if (parsedText.p1 || parsedText.p2 || parsedText.city) {
      onChange(`${parsedText.p1}${parsedText.char || 'ب'}${parsedText.p2}${parsedText.city}`);
    } else {
      onChange(text); // fallback raw
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const parsedPasted = parseIranianPlate(pastedText);
    if (parsedPasted.p1 || parsedPasted.p2 || parsedPasted.city) {
      updatePlate(
        parsedPasted.p1,
        parsedPasted.char || 'ب',
        parsedPasted.p2,
        parsedPasted.city
      );
    }
  };

  const toggleEntryMode = () => {
    const nextMode = entryMode === 'realistic' ? 'simple' : 'realistic';
    setEntryMode(nextMode);
    localStorage.setItem('plate_entry_mode', nextMode);
  };

  // Theme color styling mapper
  const getThemeStyles = () => {
    switch (plateTheme) {
      case 'yellow':
        return {
          bg: 'bg-[#fbbf24]', // Yellow taxi/commercial
          text: 'text-gray-950',
          border: 'border-amber-600',
          inputBg: 'bg-transparent',
          lineColor: 'border-gray-900/40',
          cityDivider: 'border-gray-950'
        };
      case 'red':
        return {
          bg: 'bg-[#dc2626]', // Red government
          text: 'text-white',
          border: 'border-red-800',
          inputBg: 'bg-transparent',
          lineColor: 'border-white/40',
          cityDivider: 'border-white'
        };
      case 'blue':
        return {
          bg: 'bg-[#1d4ed8]', // Blue diplomatic/service
          text: 'text-white',
          border: 'border-blue-900',
          inputBg: 'bg-transparent',
          lineColor: 'border-white/40',
          cityDivider: 'border-white'
        };
      case 'white':
      default:
        return {
          bg: 'bg-white', // Standard White Passenger
          text: 'text-gray-900',
          border: 'border-gray-400',
          inputBg: 'bg-transparent',
          lineColor: 'border-gray-300',
          cityDivider: 'border-gray-900'
        };
    }
  };

  const theme = getThemeStyles();

  return (
    <div className="w-full max-w-sm mx-auto space-y-4">
      {/* Mode Selector and Quick Theme Toggle */}
      <div className="flex justify-between items-center bg-gray-100 p-1.5 rounded-xl border border-gray-200">
        <button
          type="button"
          onClick={toggleEntryMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            entryMode === 'realistic' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Sparkles size={14} className={entryMode === 'realistic' ? 'text-blue-500' : ''} />
          <span>پلاک هوشمند گرافیکی</span>
        </button>
        
        <button
          type="button"
          onClick={toggleEntryMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            entryMode === 'simple' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Keyboard size={14} />
          <span>ورود ساده متنی</span>
        </button>
      </div>

      {entryMode === 'realistic' ? (
        <div className="space-y-4 animate-fadeIn">
          {/* Real 2D Plate Visual display */}
          <div className="relative flex justify-center">
            <div className={`relative flex items-center ${theme.bg} ${theme.text} border-3 border-gray-900 rounded-xl overflow-hidden h-16 w-full max-w-[320px] shadow-lg dir-ltr font-black select-none transition-all duration-300`}>
              
              {/* Blue National Flag Ribbon */}
              <div className="bg-[#153e90] w-8 h-full flex flex-col items-center justify-between text-white py-1 px-1 shrink-0 border-r border-gray-900/30">
                <div className="flex flex-col gap-[1px] w-full items-center mt-0.5">
                  <div className="w-4 h-1 bg-[#22c55e] rounded-sm"></div>
                  <div className="w-4 h-1 bg-[#ffffff] rounded-sm"></div>
                  <div className="w-4 h-1 bg-[#ef4444] rounded-sm"></div>
                </div>
                <div className="text-[6px] font-black text-center tracking-tighter opacity-90 leading-tight">
                  I.R.
                  <br />
                  IRAN
                </div>
              </div>

              {/* Part 1: 2 Digits */}
              <div className="flex-1 h-full flex items-center justify-center">
                <input
                  ref={p1Ref}
                  type="text"
                  inputMode="numeric"
                  disabled={readOnly}
                  value={p1}
                  onChange={handleP1Change}
                  onPaste={handlePaste}
                  placeholder="۱۲"
                  maxLength={2}
                  className="w-full h-full text-center text-2xl font-extrabold bg-transparent outline-none text-current placeholder-gray-400/40 select-all border-none focus:ring-0"
                />
              </div>

              {/* Part 2: Persian Letter Label */}
              <div className={`w-14 h-full flex items-center justify-center border-x ${theme.lineColor} bg-black/5 cursor-pointer hover:bg-black/10 transition-colors`}>
                <span className="text-xl font-black text-center">{char || 'ب'}</span>
              </div>

              {/* Part 3: 3 Digits */}
              <div className="flex-[1.5] h-full flex items-center justify-center">
                <input
                  ref={p2Ref}
                  type="text"
                  inputMode="numeric"
                  disabled={readOnly}
                  value={p2}
                  onChange={handleP2Change}
                  onKeyDown={handleP2KeyDown}
                  onPaste={handlePaste}
                  placeholder="۳۴۵"
                  maxLength={3}
                  className="w-full h-full text-center text-2xl font-extrabold bg-transparent outline-none text-current placeholder-gray-400/40 select-all border-none focus:ring-0"
                />
              </div>

              {/* Part 4: Iran City Code Ribbon */}
              <div className={`w-12 h-full flex flex-col border-l-3 ${theme.cityDivider} bg-black/5 shrink-0`}>
                <div className="h-4.5 flex items-center justify-center text-[8px] font-black opacity-80 border-b border-gray-900/15 pt-0.5">
                  ایـران
                </div>
                <input
                  ref={cityRef}
                  type="text"
                  inputMode="numeric"
                  disabled={readOnly}
                  value={city}
                  onChange={handleCityChange}
                  onKeyDown={handleCityKeyDown}
                  onPaste={handlePaste}
                  placeholder="۶۷"
                  maxLength={2}
                  className="w-full flex-1 text-center text-lg font-black bg-transparent outline-none text-current placeholder-gray-400/40 pb-1 border-none focus:ring-0"
                />
              </div>
            </div>
          </div>

          {/* Quick Vehicle Plate Category Switcher */}
          <div className="flex justify-center gap-1.5">
            <button
              type="button"
              onClick={() => setPlateTheme('white')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                plateTheme === 'white' ? 'bg-white text-gray-900 border-gray-400 shadow-sm' : 'bg-gray-50 text-gray-500 border-gray-200'
              }`}
            >
              🚗 شخصی
            </button>
            <button
              type="button"
              onClick={() => setPlateTheme('yellow')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                plateTheme === 'yellow' ? 'bg-amber-400 text-amber-950 border-amber-500 shadow-sm' : 'bg-gray-50 text-gray-500 border-gray-200'
              }`}
            >
              🚛 سنگین / عمومی
            </button>
            <button
              type="button"
              onClick={() => setPlateTheme('red')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                plateTheme === 'red' ? 'bg-red-600 text-white border-red-700 shadow-sm' : 'bg-gray-50 text-gray-500 border-gray-200'
              }`}
            >
              🏛️ دولتی
            </button>
            <button
              type="button"
              onClick={() => setPlateTheme('blue')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                plateTheme === 'blue' ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-gray-50 text-gray-500 border-gray-200'
              }`}
            >
              🤝 خدمت / دیپلمات
            </button>
          </div>

          {/* Touch-Friendly Visual Grid Keyboard of Persian Plate Letters */}
          <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 space-y-2">
            <div className="flex justify-between items-center text-gray-500 text-[10px] font-bold border-b pb-1.5 px-0.5">
              <span>صفحه‌کلید سریع حروف پلاک انتظامات</span>
              <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">بدون نیاز به کیبورد</span>
            </div>
            
            {/* Quick Grid layout */}
            <div className="grid grid-cols-4 gap-1.5">
              {QUICK_PLATE_LETTERS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => handleCharSelect(l)}
                  className={`py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 ${
                    char === l 
                      ? 'bg-blue-600 text-white shadow-md scale-105 border-blue-700' 
                      : 'bg-white hover:bg-gray-100 text-gray-800 border border-gray-200/80 hover:border-gray-300'
                  }`}
                >
                  <span>{l}</span>
                  {char === l && <Check size={10} className="stroke-[3]" />}
                </button>
              ))}
            </div>

            {/* Dropdown for other rare letters */}
            <div className="pt-2 border-t flex items-center gap-2">
              <span className="text-[9px] font-bold text-gray-400 whitespace-nowrap">سایر حروف نادر:</span>
              <select
                disabled={readOnly}
                value={QUICK_PLATE_LETTERS.includes(char) ? '' : char}
                onChange={(e) => {
                  if (e.target.value) handleCharSelect(e.target.value);
                }}
                className="flex-1 text-xs border rounded bg-white p-1 font-bold text-gray-800"
              >
                <option value="">-- انتخاب از لیست تکمیلی --</option>
                {PERSIAN_PLATE_LETTERS.filter(x => !QUICK_PLATE_LETTERS.includes(x)).map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : (
        /* Simple entry mode for typing the entire plate as one piece */
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3 animate-fadeIn">
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">شماره پلاک خودرو (ثبت سریع پیوسته)</label>
            <input
              type="text"
              dir="rtl"
              value={simpleText}
              onChange={handleSimpleTextChange}
              placeholder="مثال: ۱۲ب۳۴۵۶۷ یا 12ب34567"
              className="w-full border-2 border-gray-300 focus:border-blue-500 rounded-xl p-3 text-center text-lg font-black tracking-wide outline-none shadow-inner bg-white transition-all"
            />
          </div>
          
          <div className="bg-blue-50 border border-blue-150 rounded-xl p-2.5 flex items-start gap-2">
            <Info size={14} className="text-blue-600 mt-0.5 shrink-0" />
            <p className="text-[10px] text-blue-800 leading-relaxed font-medium">
              شما می‌توانید کل شماره پلاک را به صورت متوالی (مثلاً <strong className="font-black font-mono">۱۲ب۳۴۵۶۷</strong>) تایپ کنید. سیستم به صورت خودکار اجزای آن را تفکیک و قالب‌بندی می‌کند.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export const IranPlateBadge: React.FC<{ plate: string; className?: string }> = ({ plate, className = '' }) => {
  if (!plate) return <span className="text-gray-400 text-xs">-</span>;

  const parsed = parseIranianPlate(plate);
  if (!parsed.p1 && !parsed.p2) {
    return <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded dir-ltr">{plate}</span>;
  }

  // Choose appropriate background badge color based on letter
  const getBadgeTheme = (ch: string) => {
    if (ch === 'ع' || ch === 'ت') return 'bg-amber-400 border-amber-500 text-amber-950'; // Yellow
    if (ch === 'الف') return 'bg-red-600 border-red-700 text-white'; // Red
    return 'bg-white border-gray-300 text-gray-900'; // Default White
  };

  const badgeTheme = getBadgeTheme(parsed.char);

  return (
    <div className={`inline-flex items-center ${badgeTheme} border border-gray-900/60 rounded overflow-hidden h-7 text-xs font-black dir-ltr select-none shadow-sm ${className}`}>
      <div className="bg-[#153e90] w-4 h-full flex flex-col items-center justify-center text-white py-0.5 px-0.5 shrink-0">
        <span className="text-[4px] leading-none font-bold">IRAN</span>
      </div>
      <span className="px-1.5 text-sm font-extrabold">{parsed.p1}</span>
      <span className="px-1 border-x border-gray-800/15 text-xs font-black">{parsed.char || 'ب'}</span>
      <span className="px-1.5 text-sm font-extrabold">{parsed.p2}</span>
      <div className="border-l border-gray-900/40 px-1.5 h-full flex flex-col items-center justify-center text-[10px] font-black">
        <span>{parsed.city || '--'}</span>
      </div>
    </div>
  );
};
