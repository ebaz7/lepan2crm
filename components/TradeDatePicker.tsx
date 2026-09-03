import React, { useState } from 'react';
// @ts-ignore
import DatePicker from "react-multi-date-picker";
// @ts-ignore
import persian from "react-date-object/calendars/persian";
// @ts-ignore
import persian_fa from "react-date-object/locales/persian_fa";
// @ts-ignore
import gregorian from "react-date-object/calendars/gregorian";
// @ts-ignore
import gregorian_en from "react-date-object/locales/gregorian_en";

interface TradeDatePickerProps {
    value: string;
    onChange: (date: string) => void;
    placeholder?: string;
    className?: string;
}

export const TradeDatePicker: React.FC<TradeDatePickerProps> = ({ value, onChange, placeholder, className = '' }) => {
    const [isGregorian, setIsGregorian] = useState(false);

    return (
        <div className="relative w-full flex flex-col gap-1">
            <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-bold text-gray-500 flex items-center gap-1 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={isGregorian} 
                        onChange={(e) => setIsGregorian(e.target.checked)} 
                        className="rounded text-blue-500 w-3 h-3"
                    />
                    تقویم میلادی
                </label>
            </div>
            <DatePicker
                calendar={isGregorian ? gregorian : persian}
                locale={isGregorian ? gregorian_en : persian_fa}
                format="YYYY/MM/DD"
                value={value}
                onChange={(date: any) => onChange(date?.format?.('YYYY/MM/DD') || '')}
                inputClass={`w-full border rounded p-2 text-sm text-left dir-ltr focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-950 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-zinc-800 ${className}`}
                placeholder={placeholder || (isGregorian ? '2024/01/01' : '۱۴۰۳/۰۱/۰۱')}
                containerClassName="w-full"
                calendarPosition="bottom-right"
            />
        </div>
    );
};
