import React from 'react';
import AccountingReports from './AccountingReports';
import { getCurrentUser } from '../services/authService';
import { BarChart2 } from 'lucide-react';

interface SayanReportsProps {
  settings?: any;
  currentUser?: any;
  onNavigateToChat?: (target: { type: 'private' | 'group' | 'task_group' | 'system', id: string }) => void;
}

const SayanReports: React.FC<SayanReportsProps> = (props) => {
  const currentUser = props.currentUser || getCurrentUser();

  return (
    <div className="flex flex-col w-full min-h-0 select-text">
      {/* Navigation header (Desktop only to prevent duplicate headers on mobile) */}
      <div className="hidden md:flex bg-white/40 dark:bg-zinc-950/30 border-b border-zinc-200/50 dark:border-zinc-800/50 px-6 justify-between items-center h-12 sm:h-14 flex-shrink-0 backdrop-blur-sm rounded-2xl mb-3">
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
      <div className="w-full bg-transparent pb-24 md:pb-8 p-0 m-0">
        <AccountingReports {...props} currentUser={currentUser} />
      </div>
    </div>
  );
};

export default SayanReports;

