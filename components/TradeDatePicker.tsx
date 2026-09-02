import React, { useState, useEffect, useRef } from 'react';
import * as jalaali from 'jalaali-js';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface TradeDatePickerProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    className?: string;
}

const SHAMSI_MONTH_NAMES = [
    'فروردین', 'اردیبهشت', 'خرداد',
    'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر',
    'دی', 'بهمن', 'اسفند'
];

const MILADI_MONTH_NAMES = [
    'January', 'February', 'March',
    'April', 'May', 'June',
    'July', 'August', 'September',
    'October', 'November', 'December'
];

const SHAMSI_WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const MILADI_WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const TradeDatePicker: React.FC<TradeDatePickerProps> = ({
    value,
    onChange,
    placeholder = '۱۴۰۳/۰۱/۰۱',
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState<'shamsi' | 'miladi'>('shamsi');
    const containerRef = useRef<HTMLDivElement>(null);

    // Navigation state
    const [viewYear, setViewYear] = useState<number>(1403);
    const [viewMonth, setViewMonth] = useState<number>(1); // 1-indexed

    // Sync view with value on open or load
    useEffect(() => {
        if (value) {
            const parts = value.split('/').map(p => parseInt(p, 10));
            if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
                const year = parts[0];
                const month = parts[1];
                if (year > 1900) {
                    setMode('miladi');
                    setViewYear(year);
                    setViewMonth(month);
                } else if (year > 1300 && year < 1500) {
                    setMode('shamsi');
                    setViewYear(year);
                    setViewMonth(month);
                }
            }
        } else {
            // Default to today
            const now = new Date();
            const jToday = jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
            setViewYear(jToday.jy);
            setViewMonth(jToday.jm);
        }
    }, [value, isOpen]);

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Toggle Mode
    const handleToggleMode = () => {
        if (mode === 'shamsi') {
            // Convert current view month/year from Shamsi to Miladi approx
            const g = jalaali.toGregorian(viewYear, viewMonth, 15);
            setViewYear(g.gy);
            setViewMonth(g.gm);
            setMode('miladi');
        } else {
            // Convert current view from Miladi to Shamsi approx
            const j = jalaali.toJalaali(viewYear, viewMonth, 15);
            setViewYear(j.jy);
            setViewMonth(j.jm);
            setMode('shamsi');
        }
    };

    // Calendar generation
    const getDaysInMonth = (): { day: number; currentMonth: boolean }[] => {
        const days: { day: number; currentMonth: boolean }[] = [];

        if (mode === 'shamsi') {
            const len = jalaali.jalaaliMonthLength(viewYear, viewMonth);
            
            // To get start weekday, find Gregorian of the 1st of this Jalaali month
            const gFirst = jalaali.toGregorian(viewYear, viewMonth, 1);
            const dateFirst = new Date(gFirst.gy, gFirst.gm - 1, gFirst.gd);
            // JS weekday: 0=Sun, 1=Mon, ..., 6=Sat
            // Shamsi grid: 0=Sat, 1=Sun, ..., 6=Fri
            const jsDay = dateFirst.getDay();
            const shamsiStartIdx = (jsDay + 1) % 7; // Convert so Sat is 0

            // Add empty/previous month padding
            let prevYear = viewYear;
            let prevMonth = viewMonth - 1;
            if (prevMonth === 0) {
                prevMonth = 12;
                prevYear--;
            }
            const prevLen = jalaali.jalaaliMonthLength(prevYear, prevMonth);
            for (let i = shamsiStartIdx - 1; i >= 0; i--) {
                days.push({ day: prevLen - i, currentMonth: false });
            }

            // Current month days
            for (let i = 1; i <= len; i++) {
                days.push({ day: i, currentMonth: true });
            }
        } else {
            // Miladi
            const len = new Date(viewYear, viewMonth, 0).getDate();
            const dateFirst = new Date(viewYear, viewMonth - 1, 1);
            const startIdx = dateFirst.getDay(); // 0=Sun, ..., 6=Sat

            // Add previous month padding
            const prevLen = new Date(viewYear, viewMonth - 1, 0).getDate();
            for (let i = startIdx - 1; i >= 0; i--) {
                days.push({ day: prevLen - i, currentMonth: false });
            }

            // Current month days
            for (let i = 1; i <= len; i++) {
                days.push({ day: i, currentMonth: true });
            }
        }

        // Fill up to multiple of 7 to form complete weeks (typically 42 cells)
        const totalCells = Math.ceil(days.length / 7) * 7;
        const currentLen = days.length;
        for (let i = 1; i <= (totalCells - currentLen); i++) {
            days.push({ day: i, currentMonth: false });
        }

        return days;
    };

    const handleDayClick = (day: number, isCurrentMonth: boolean) => {
        let y = viewYear;
        let m = viewMonth;
        
        if (!isCurrentMonth) {
            // If clicked on previous month's day
            if (day > 15) {
                m--;
                if (m === 0) {
                    m = 12;
                    y--;
                }
            } else {
                m++;
                if (m === 13) {
                    m = 1;
                    y++;
                }
            }
        }

        const formattedY = y.toString();
        const formattedM = m.toString().padStart(2, '0');
        const formattedD = day.toString().padStart(2, '0');
        onChange(`${formattedY}/${formattedM}/${formattedD}`);
        setIsOpen(false);
    };

    const handlePrevMonth = () => {
        if (viewMonth === 1) {
            setViewMonth(12);
            setViewYear(prev => prev - 1);
        } else {
            setViewMonth(prev => prev - 1);
        }
    };

    const handleNextMonth = () => {
        if (viewMonth === 12) {
            setViewMonth(1);
            setViewYear(prev => prev + 1);
        } else {
            setViewMonth(prev => prev + 1);
        }
    };

    // Dropdown selections list
    const yearList = Array.from({ length: 41 }, (_, i) => (mode === 'shamsi' ? 1380 : 2000) + i);
    const monthList = mode === 'shamsi' ? SHAMSI_MONTH_NAMES : MILADI_MONTH_NAMES;

    const days = getDaysInMonth();

    // Check if a day is the currently selected date
    const isSelected = (day: number, isCurrentMonth: boolean) => {
        if (!isCurrentMonth || !value) return false;
        const parts = value.split('/').map(p => parseInt(p, 10));
        return parts.length === 3 && parts[0] === viewYear && parts[1] === viewMonth && parts[2] === day;
    };

    return (
        <div ref={containerRef} className="relative w-full" dir="rtl">
            <div className="relative flex items-center">
                <input
                    type="text"
                    className={`w-full border rounded p-2 text-sm text-left dir-ltr focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-950 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-zinc-800 ${className}`}
                    placeholder={placeholder}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={() => setIsOpen(true)}
                />
                <button
                    type="button"
                    onClick={() => setIsOpen(prev => !prev)}
                    className="absolute left-2.5 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                >
                    <CalendarIcon size={16} />
                </button>
            </div>

            {isOpen && (
                <div className="absolute left-0 mt-1.5 w-72 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xl z-[999] p-3 text-right select-none animate-fade-in">
                    {/* Header Controls: Calendar Toggle & Navigation */}
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-2 mb-2 gap-2">
                        {/* Toggle */}
                        <button
                            type="button"
                            onClick={handleToggleMode}
                            className="bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 px-2 py-1 rounded text-[11px] font-bold text-gray-700 dark:text-gray-300 transition-colors"
                        >
                            {mode === 'shamsi' ? 'شمسی ➔ میلادی' : 'Miladi ➔ Shamsi'}
                        </button>

                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={handleNextMonth}
                                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500"
                            >
                                <ChevronRight size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={handlePrevMonth}
                                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500"
                            >
                                <ChevronLeft size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Year / Month Dropdowns */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <select
                            value={viewMonth}
                            onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                            className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-xs p-1.5 rounded-lg text-gray-700 dark:text-gray-200 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            {monthList.map((mName, idx) => (
                                <option key={idx} value={idx + 1}>{mName}</option>
                            ))}
                        </select>

                        <select
                            value={viewYear}
                            onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
                            className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-xs p-1.5 rounded-lg text-gray-700 dark:text-gray-200 font-bold font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            {yearList.map((yr) => (
                                <option key={yr} value={yr}>{yr}</option>
                            ))}
                        </select>
                    </div>

                    {/* Weekdays Header */}
                    <div className="grid grid-cols-7 text-center text-[10px] font-bold text-gray-400 mb-1.5">
                        {(mode === 'shamsi' ? SHAMSI_WEEKDAYS : MILADI_WEEKDAYS).map((wd, i) => (
                            <div key={i}>{wd}</div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium">
                        {days.map((item, idx) => {
                            const isCurrent = item.currentMonth;
                            const isSel = isSelected(item.day, isCurrent);
                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleDayClick(item.day, isCurrent)}
                                    className={`py-1.5 rounded-lg font-mono transition-all text-center flex items-center justify-center ${
                                        isSel
                                            ? 'bg-blue-600 text-white font-bold shadow'
                                            : isCurrent
                                            ? 'text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800/80 cursor-pointer'
                                            : 'text-gray-300 dark:text-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-900/40 cursor-pointer'
                                    }`}
                                >
                                    {item.day}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
