import React from 'react';
import AccountingReports from './AccountingReports';
import { getCurrentUser } from '../services/authService';
import { BarChart2 } from 'lucide-react';

interface SayanReportsProps {
  settings?: any;
  currentUser?: any;
}

const SayanReports: React.FC<SayanReportsProps> = (props) => {
  const currentUser = props.currentUser || getCurrentUser();

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 select-text">
      {/* Navigation header */}
      <div className="bg-white/30 dark:bg-zinc-950/20 border-b border-zinc-200/40 dark:border-zinc-800/40 px-6 flex justify-between items-center h-14 flex-shrink-0 backdrop-blur-sm">
        <div className="flex items-center gap-6 h-full">
          <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
            <BarChart2 size={16} />
            <span>داشبورد و گزارشات تحلیلی سایان</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 font-mono">ERP Integration System</span>
        </div>
      </div>

      {/* Tab Content body */}
      <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-transparent pb-24 md:pb-6">
        <AccountingReports {...props} currentUser={currentUser} />
      </div>
    </div>
  );
};

export default SayanReports;
