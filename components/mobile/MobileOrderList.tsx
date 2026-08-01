
import React, { useState } from 'react';
import { PaymentOrder, User, OrderStatus, UserRole } from '../../types';
import MobileOrderCard from './MobileOrderCard';
import { Search, Filter, RefreshCcw } from 'lucide-react';
import { deleteOrder, updateOrderStatus } from '../../services/storageService';
import PrintVoucher from '../PrintVoucher';

interface Props {
  orders: PaymentOrder[];
  currentUser: User;
  refreshData: () => void;
}

const MobileOrderList: React.FC<Props> = ({ orders, currentUser, refreshData }) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<PaymentOrder | null>(null);

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.payee.includes(searchTerm) || o.description.includes(searchTerm) || o.trackingNumber.toString().includes(searchTerm);
    if (!matchesSearch) return false;

    if (filter === 'pending') return o.status !== OrderStatus.APPROVED_CEO && o.status !== OrderStatus.REVOKED && o.status !== OrderStatus.REJECTED;
    if (filter === 'completed') return o.status === OrderStatus.APPROVED_CEO || o.status === OrderStatus.REVOKED;
    return true;
  });

  const handleDelete = async (id: string) => {
    if (confirm('حذف شود؟')) {
      await deleteOrder(id);
      refreshData();
    }
  };

  const [processingId, setProcessingId] = useState<string | null>(null);

  const canApprove = (order: PaymentOrder) => {
      if (order.status === OrderStatus.APPROVED_CEO || order.status === OrderStatus.PAID || order.status === OrderStatus.REVOKED || order.status === OrderStatus.REJECTED) return false;
      const role = currentUser.role;
      if (role === UserRole.FINANCIAL && order.status === OrderStatus.PENDING) return true;
      if (role === UserRole.MANAGER && order.status === OrderStatus.APPROVED_FINANCE) return true;
      if (role === UserRole.CEO && order.status === OrderStatus.APPROVED_MANAGER) return true;
      return false;
  };

  const handleApprove = async (id: string, currentStatus: OrderStatus) => {
      const getNextStatus = (s: OrderStatus) => {
          if (s === OrderStatus.PENDING) return OrderStatus.APPROVED_FINANCE;
          if (s === OrderStatus.APPROVED_FINANCE) return OrderStatus.APPROVED_MANAGER;
          if (s === OrderStatus.APPROVED_MANAGER) return OrderStatus.APPROVED_CEO;
          return s;
      };
      
      setProcessingId(id);
      try {
          const updatedOrders = await updateOrderStatus(id, getNextStatus(currentStatus), currentUser);
          const order = updatedOrders.find(o => o.id === id);
          if (order) {
              const event = new CustomEvent('QUEUE_WHATSAPP_JOB', { 
                  detail: { order: order, type: 'approve' } 
              });
              window.dispatchEvent(event);
          }
          refreshData();
      } catch (e) {
          alert('خطا در انجام عملیات');
      } finally {
          setProcessingId(null);
      }
  };

  const canDelete = (order: PaymentOrder) => {
      // Replicating logic from ManageOrders
      if (currentUser.role === UserRole.ADMIN) return true;
      if (order.status === OrderStatus.APPROVED_CEO) return false;
      if (currentUser.role === UserRole.USER && order.requester === currentUser.fullName && order.status === OrderStatus.PENDING) return true;
      return false;
  };

  return (
    <div className="space-y-4">
      {/* Mobile Search & Filter Header */}
      <div className="sticky top-0 bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200 pt-2 pb-2 z-40 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input 
              type="text" 
              placeholder="جستجو..." 
              className="w-full pl-8 pr-4 py-3 rounded-xl border-none shadow-sm text-sm focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-3.5 text-gray-400" size={16} />
          </div>
          <button onClick={refreshData} className="glass-panel p-3 rounded-xl shadow-sm text-gray-600">
            <RefreshCcw size={20} />
          </button>
        </div>
        
        <div className="flex p-1 bg-gray-200 rounded-xl">
          <button onClick={() => setFilter('all')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filter === 'all' ? 'glass-panel shadow text-gray-800' : 'text-gray-500'}`}>همه</button>
          <button onClick={() => setFilter('pending')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filter === 'pending' ? 'glass-panel shadow text-blue-600' : 'text-gray-500'}`}>جاری</button>
          <button onClick={() => setFilter('completed')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filter === 'completed' ? 'glass-panel shadow text-green-600' : 'text-gray-500'}`}>بایگانی</button>
        </div>
      </div>

      {/* Cards List */}
      <div className="pb-20">
        {filteredOrders.length === 0 ? (
          <div className="text-center text-gray-400 mt-10">موردی یافت نشد</div>
        ) : (
          filteredOrders.map(order => (
            <MobileOrderCard 
              key={order.id} 
              order={order} 
              onView={setSelectedOrder} 
              onDelete={handleDelete}
              onApprove={handleApprove}
              canDelete={canDelete(order)}
              canApprove={canApprove(order)}
              isProcessing={processingId === order.id}
            />
          ))
        )}
      </div>

      {/* Detail Modal (Reusing existing PrintVoucher but making it full screen) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[100] glass-panel overflow-y-auto">
            <PrintVoucher 
                order={selectedOrder} 
                onClose={() => setSelectedOrder(null)} 
                // Pass existing handlers if needed or reimplement minimal ones
            />
        </div>
      )}
    </div>
  );
};

export default MobileOrderList;
