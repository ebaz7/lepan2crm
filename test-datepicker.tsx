import React, { useState } from 'react';
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

export default function Test() {
  const [date, setDate] = useState('1402/01/01');
  return <DatePicker 
    calendar={persian} 
    locale={persian_fa} 
    format="YYYY/MM/DD" 
    value={date} 
    onChange={d => setDate(d?.format?.('YYYY/MM/DD') || '')} 
  />
}
