import React, { useState } from 'react';
import AccountingReports from './AccountingReports';
import SayanTablesConsole from './SayanTablesConsole';
import { getCurrentUser } from '../services/authService';
import { BarChart2, Database } from 'lucide-react';

interface SayanReportsProps {
  settings?: any;
  currentUser?: any;
}

const SayanReports: React.FC<SayanReportsProps> = (props) => {
  const currentUser = props.currentUser || getCurrentUser();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'console'>('dashboard');

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 select-text">
      {/* Tab Navigation header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 flex justify-between items-center h-14 flex-shrink-0">
        <div className="flex items-center gap-6 h-full">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-1 h-full border-b-2 text-xs font-bold transition-all ${
              activeTab === 'dashboard'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-extrabold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart2 size={16} />
            <span>داشبورد و گزارشات تحلیلی سایان</span>
          </button>
          
          <button
            onClick={() => setActiveTab('console')}
            className={`flex items-center gap-2 px-1 h-full border-b-2 text-xs font-bold transition-all ${
              activeTab === 'console'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-extrabold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Database size={16} />
            <span>کاوشگر جداول و فیلتر اکسل سایان</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 font-mono">ERP Integration System</span>
        </div>
      </div>

      {/* Tab Content body */}
      <div className="flex-1 flex flex-col min-h-0 bg-gray-50 dark:bg-gray-900 overflow-hidden">
        {activeTab === 'dashboard' ? (
          <AccountingReports {...props} currentUser={currentUser} />
        ) : (
          <SayanTablesConsole />
        )}
      </div>
    </div>
  );
};

export default SayanReports;
