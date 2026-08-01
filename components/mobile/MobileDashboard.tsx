
import React from 'react';
import { PaymentOrder, OrderStatus, User, UserRole } from '../../types';
import { Clock, CheckCircle, Activity, XCircle, Banknote, Package, Truck, ShieldCheck } from 'lucide-react';
import { formatCurrency } from '../../constants';

interface Props {
  orders: PaymentOrder[];
  currentUser: User;
  onNavigate: (tab: string) => void;
}

const MobileDashboard: React.FC<Props> = ({ orders, currentUser, onNavigate }) => {
  const pendingCount = orders.filter(o => o.status === OrderStatus.PENDING).length;
  const approvedCount = orders.filter(o => o.status === OrderStatus.APPROVED_CEO).length;
  const myRequests = orders.filter(o => o.requester === currentUser.fullName && o.status !== OrderStatus.APPROVED_CEO).length;

  const canManageExit = [UserRole.ADMIN, UserRole.CEO, UserRole.FACTORY_MANAGER, UserRole.WAREHOUSE_KEEPER, UserRole.SECURITY_GUARD, UserRole.SALES_MANAGER].includes(currentUser.role as any);
  const canCreateExit = [UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.CEO].includes(currentUser.role as any);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-6 text-white shadow-lg shadow-blue-200/50 relative overflow-hidden">
        <div className="relative z-10">
            <h2 className="text-2xl font-black mb-1">خوش آمدید 👋</h2>
            <p className="text-blue-100 text-sm font-medium opacity-90">{currentUser.fullName}</p>
        </div>
        <div className="absolute top-0 right-0 p-4 opacity-10">
            <Activity size={100}/>
        </div>
      </div>

      {/* Main Action Grid */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onNavigate('create')} className="glass-panel p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-3 active:scale-95 transition-all">
          <div className="bg-green-100 p-3 rounded-2xl text-green-600 shadow-sm"><Banknote size={26}/></div>
          <span className="font-bold text-xs text-gray-700">ثبت پرداخت</span>
        </button>
        
        <button onClick={() => onNavigate('manage')} className="glass-panel p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-3 active:scale-95 transition-all">
          <div className="bg-orange-100 p-3 rounded-2xl text-orange-600 shadow-sm"><Activity size={26}/></div>
          <span className="font-bold text-xs text-gray-700">کارتابل مالی</span>
        </button>

        {canCreateExit && (
            <button onClick={() => onNavigate('create-exit')} className="glass-panel p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-3 active:scale-95 transition-all">
            <div className="bg-blue-100 p-3 rounded-2xl text-blue-600 shadow-sm"><Truck size={26}/></div>
            <span className="font-bold text-xs text-gray-700">ثبت خروج</span>
            </button>
        )}

        {canManageExit && (
            <button onClick={() => onNavigate('manage-exit')} className="glass-panel p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-3 active:scale-95 transition-all">
            <div className="bg-purple-100 p-3 rounded-2xl text-purple-600 shadow-sm"><ShieldCheck size={26}/></div>
            <span className="font-bold text-xs text-gray-700">کارتابل خروج</span>
            </button>
        )}
      </div>

      {/* Stats Vertical Stack */}
      <h3 className="font-bold text-gray-800 text-sm px-1 mt-4">وضعیت کلی سیستم</h3>
      <div className="space-y-3">
        <div onClick={() => onNavigate('manage')} className="glass-panel p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-3">
            <div className="bg-amber-50 p-2.5 rounded-xl text-amber-600"><Clock size={20}/></div>
            <span className="font-bold text-xs text-gray-600">در انتظار بررسی (مالی)</span>
          </div>
          <span className="text-lg font-black text-amber-600 font-mono">{pendingCount}</span>
        </div>

        <div className="glass-panel p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600"><CheckCircle size={20}/></div>
            <span className="font-bold text-xs text-gray-600">درخواست‌های من</span>
          </div>
          <span className="text-lg font-black text-blue-600 font-mono">{myRequests}</span>
        </div>

        <div className="glass-panel p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-green-50 p-2.5 rounded-xl text-green-600"><Package size={20}/></div>
            <span className="font-bold text-xs text-gray-600">پرداخت‌های نهایی</span>
          </div>
          <span className="text-lg font-black text-green-600 font-mono">{approvedCount}</span>
        </div>
      </div>
    </div>
  );
};

export default MobileDashboard;
