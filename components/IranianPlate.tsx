import React, { useState, useEffect, useRef } from 'react';

// Common Persian plate letters
export const PERSIAN_PLATE_CHARS = [
  'الف', 'ب', 'پ', 'ت', 'ث', 'ج', 'چ', 'ح', 'خ', 
  'د', 'ذ', 'ر', 'ز', 'ژ', 'س', 'ش', 'ص', 'ض', 
  'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ک', 'گ', 'ل', 
  'م', 'ن', 'و', 'ه', 'ی', 'D', 'S'
];

// Helper to convert Persian/Arabic digits to English digits
export const toEnglishDigits = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/[۰-۹]/g, d => (d.charCodeAt(0) - 1776).toString())
    .replace(/[0-9]/g, d => (d.charCodeAt(0) - 1632).toString());
};

// Parse a raw plate string into 4 components
export const parsePlateParts = (plateStr: string) => {
  if (!plateStr) return { p1: '', char: '', p2: '', city: '' };
  
  const clean = toEnglishDigits(plateStr).replace(/\s/g, '').replace(/-/g, '').replace(/ایران/g, '');
  
  // Pattern match: 2 digits + 1 Persian/Latin character + 3 digits + 2 digits
  const match = clean.match(/^(\d{2})([آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیa-zA-Z]{1,3})(\d{3})(\d{2})$/);
  if (match) {
    return {
      p1: match[1],
      char: match[2],
      p2: match[3],
      city: match[4]
    };
  }
  
  // Partial match attempt
  const digits = clean.replace(/[^0-9]/g, '');
  const chars = clean.replace(/[0-9]/g, '');
  
  return {
    p1: digits.slice(0, 2),
    char: chars.slice(0, 3) || 'ب',
    p2: digits.slice(2, 5),
    city: digits.slice(5, 7)
  };
};

// Format parts back to a unified plate string (e.g. "12ب34567")
export const formatPlateParts = (p1: string, char: string, p2: string, city: string) => {
  if (!p1 && !char && !p2 && !city) return '';
  return `${p1}${char}${p2}${city}`;
};

// ==================== PLATE DISPLAY COMPONENT ====================
interface IranianPlateDisplayProps {
  value?: string;
  p1?: string;
  char?: string;
  p2?: string;
  city?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const IranianPlateDisplay: React.FC<IranianPlateDisplayProps> = ({
  value,
  p1: p1Prop,
  char: charProp,
  p2: p2Prop,
  city: cityProp,
  size = 'md',
  className = ''
}) => {
  let p1 = p1Prop || '';
  let char = charProp || '';
  let p2 = p2Prop || '';
  let city = cityProp || '';

  if (value && (!p1 || !char || !p2 || !city)) {
    const parsed = parsePlateParts(value);
    p1 = parsed.p1;
    char = parsed.char;
    p2 = parsed.p2;
    city = parsed.city;
  }

  // Size styling maps
  const sizeStyles = {
    xs: {
      container: 'h-6 text-[10px] rounded',
      flagWidth: 'w-3',
      flagText: 'text-[4px]',
      p1Width: 'w-5',
      charWidth: 'w-5',
      p2Width: 'w-7',
      cityWidth: 'w-6',
      cityText: 'text-[6px]',
    },
    sm: {
      container: 'h-8 text-xs rounded-md',
      flagWidth: 'w-4',
      flagText: 'text-[5px]',
      p1Width: 'w-6',
      charWidth: 'w-6',
      p2Width: 'w-9',
      cityWidth: 'w-7',
      cityText: 'text-[7px]',
    },
    md: {
      container: 'h-11 text-base rounded-lg border-2',
      flagWidth: 'w-6',
      flagText: 'text-[6px]',
      p1Width: 'w-10',
      charWidth: 'w-10',
      p2Width: 'w-14',
      cityWidth: 'w-11',
      cityText: 'text-[8px]',
    },
    lg: {
      container: 'h-14 text-2xl rounded-xl border-2',
      flagWidth: 'w-8',
      flagText: 'text-[7px]',
      p1Width: 'w-14',
      charWidth: 'w-14',
      p2Width: 'w-20',
      cityWidth: 'w-14',
      cityText: 'text-[9px]',
    }
  }[size];

  if (!p1 && !char && !p2 && !city) {
    return <span className={`text-gray-400 font-mono ${className}`}>-</span>;
  }

  return (
    <div 
      className={`inline-flex items-center bg-white border-gray-900 text-gray-900 font-black shadow-sm overflow-hidden select-none dir-ltr ${sizeStyles.container} ${className}`}
      style={{ borderColor: '#1f2937' }}
    >
      {/* Left Blue Strip */}
      <div className={`bg-[#1E4198] ${sizeStyles.flagWidth} h-full flex flex-col items-center justify-center text-white shrink-0 py-0.5`}>
        <div className="flex gap-[1px] mb-0.5">
          <div className="w-1.5 h-0.5 bg-green-500"></div>
          <div className="w-1.5 h-0.5 bg-white"></div>
          <div className="w-1.5 h-0.5 bg-red-500"></div>
        </div>
        <span className={`${sizeStyles.flagText} font-bold leading-none`}>I.R.</span>
        <span className={`${sizeStyles.flagText} font-bold leading-none`}>IRAN</span>
      </div>

      {/* Part 1 (2 digits) */}
      <div className={`${sizeStyles.p1Width} text-center font-bold tracking-tight shrink-0`}>
        {p1 || '--'}
      </div>

      {/* Letter */}
      <div className={`${sizeStyles.charWidth} text-center font-black text-blue-900 shrink-0`}>
        {char || '-'}
      </div>

      {/* Part 2 (3 digits) */}
      <div className={`${sizeStyles.p2Width} text-center font-bold tracking-tight shrink-0`}>
        {p2 || '---'}
      </div>

      {/* City Section (Right) */}
      <div className={`${sizeStyles.cityWidth} h-full flex flex-col border-l-2 border-gray-900 bg-gray-50 shrink-0`}>
        <div className={`h-1/3 flex items-center justify-center border-b border-gray-300 ${sizeStyles.cityText} font-black text-gray-500`}>
          ایران
        </div>
        <div className="flex-1 flex items-center justify-center font-bold leading-none">
          {city || '--'}
        </div>
      </div>
    </div>
  );
};


// ==================== PLATE INPUT COMPONENT ====================
interface IranianPlateInputProps {
  value?: string;
  onChange: (val: string) => void;
  onEnter?: () => void;
  className?: string;
}

export const IranianPlateInput: React.FC<IranianPlateInputProps> = ({
  value = '',
  onChange,
  onEnter,
  className = ''
}) => {
  const parsed = parsePlateParts(value);

  const [p1, setP1] = useState(parsed.p1);
  const [char, setChar] = useState(parsed.char || 'ب');
  const [p2, setP2] = useState(parsed.p2);
  const [city, setCity] = useState(parsed.city);

  const ref1 = useRef<HTMLInputElement>(null);
  const refChar = useRef<HTMLSelectElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);
  const refCity = useRef<HTMLInputElement>(null);

  // Keep state synced if parent value changes externally
  useEffect(() => {
    const curParsed = parsePlateParts(value);
    if (curParsed.p1 !== p1 || curParsed.char !== char || curParsed.p2 !== p2 || curParsed.city !== city) {
      setP1(curParsed.p1);
      if (curParsed.char) setChar(curParsed.char);
      setP2(curParsed.p2);
      setCity(curParsed.city);
    }
  }, [value]);

  const updateAll = (np1: string, nchar: string, np2: string, ncity: string) => {
    setP1(np1);
    setChar(nchar);
    setP2(np2);
    setCity(ncity);
    onChange(formatPlateParts(np1, nchar, np2, ncity));
  };

  const handleP1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = toEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 2);
    updateAll(val, char, p2, city);
    if (val.length === 2) {
      refChar.current?.focus();
    }
  };

  const handleCharChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    updateAll(p1, val, p2, city);
    if (val) {
      ref2.current?.focus();
    }
  };

  const handleP2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = toEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 3);
    updateAll(p1, char, val, city);
    if (val.length === 3) {
      refCity.current?.focus();
    }
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = toEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 2);
    updateAll(p1, char, p2, val);
  };

  // Keyboard Navigation: Enter advances, Backspace in empty field goes back
  const handleKeyDownP1 = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      refChar.current?.focus();
    }
  };

  const handleKeyDownChar = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      ref2.current?.focus();
    } else if (e.key === 'Backspace') {
      ref1.current?.focus();
    }
  };

  const handleKeyDownP2 = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      refCity.current?.focus();
    } else if (e.key === 'Backspace' && !p2) {
      refChar.current?.focus();
    }
  };

  const handleKeyDownCity = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (onEnter) onEnter();
    } else if (e.key === 'Backspace' && !city) {
      ref2.current?.focus();
    }
  };

  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`}>
      <div 
        className="flex items-center bg-white border-2 border-gray-800 rounded-2xl overflow-hidden h-14 md:h-16 font-black shadow-lg ring-4 ring-blue-500/10 focus-within:ring-blue-500/30 transition-all select-none"
        dir="ltr"
      >
        {/* Left Blue Strip */}
        <div className="bg-[#1E4198] w-8 md:w-10 h-full flex flex-col items-center justify-center text-white py-1 shrink-0 relative">
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex gap-[1px]">
              <div className="w-2 h-1 bg-green-500"></div>
              <div className="w-2 h-1 bg-white"></div>
              <div className="w-2 h-1 bg-red-500"></div>
            </div>
            <span className="text-[7px] md:text-[8px] font-black leading-none">I.R.</span>
            <span className="text-[7px] md:text-[8px] font-black leading-none">IRAN</span>
          </div>
        </div>

        {/* Part 1 (2 digits) */}
        <div className="w-12 md:w-16 h-full flex items-center justify-center border-r border-gray-200">
          <input
            ref={ref1}
            type="text"
            inputMode="numeric"
            maxLength={2}
            className="w-full h-full text-center text-2xl md:text-3xl font-black outline-none bg-transparent focus:bg-blue-50/60 transition-colors text-gray-900"
            placeholder="۱۲"
            value={p1}
            onChange={handleP1Change}
            onKeyDown={handleKeyDownP1}
          />
        </div>

        {/* Persian Letter Select */}
        <div className="w-14 md:w-16 h-full flex items-center justify-center bg-gray-50/50 border-r border-gray-200">
          <select
            ref={refChar}
            className="w-full h-full text-center text-xl md:text-2xl font-black bg-transparent outline-none appearance-none cursor-pointer text-blue-900"
            value={char}
            onChange={handleCharChange}
            onKeyDown={handleKeyDownChar}
          >
            {PERSIAN_PLATE_CHARS.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Part 2 (3 digits) */}
        <div className="w-16 md:w-20 h-full flex items-center justify-center">
          <input
            ref={ref2}
            type="text"
            inputMode="numeric"
            maxLength={3}
            className="w-full h-full text-center text-2xl md:text-3xl font-black outline-none bg-transparent focus:bg-blue-50/60 transition-colors text-gray-900"
            placeholder="۳۴۵"
            value={p2}
            onChange={handleP2Change}
            onKeyDown={handleKeyDownP2}
          />
        </div>

        {/* City Code (Right Section) */}
        <div className="w-14 md:w-16 h-full flex flex-col border-l-2 border-gray-800 bg-gray-50">
          <div className="h-5 flex items-center justify-center text-[9px] border-b border-gray-300 font-black text-gray-500 tracking-wider">
            ایران
          </div>
          <input
            ref={refCity}
            type="text"
            inputMode="numeric"
            maxLength={2}
            className="w-full flex-1 h-full text-center text-xl md:text-2xl font-black outline-none bg-transparent focus:bg-blue-50/60 transition-colors text-gray-900"
            placeholder="۶۷"
            value={city}
            onChange={handleCityChange}
            onKeyDown={handleKeyDownCity}
          />
        </div>
      </div>
      <p className="text-[10px] text-gray-400 font-bold">ورود اعداد به صورت پلاک ملی (استفاده از Enter برای پرش به کادر بعدی)</p>
    </div>
  );
};
