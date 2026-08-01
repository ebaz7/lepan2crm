
import React, { useState } from 'react';
import { ExitPermit, ExitPermitItem } from '../types';
import { Save, X, Package, Calculator, Plus, Trash2 } from 'lucide-react';
import { generateUUID } from '../constants';

interface Props {
  permit: ExitPermit;
  onClose: () => void;
  onConfirm: (updatedItems: ExitPermitItem[]) => void;
}

const WarehouseFinalizeModal: React.FC<Props> = ({ permit, onClose, onConfirm }) => {
  const [items, setItems] = useState<ExitPermitItem[]>(
    permit.items && permit.items.length > 0 
      ? permit.items.map(i => ({
          ...i,
          deliveredCartonCount: i.deliveredCartonCount !== undefined && i.deliveredCartonCount !== null ? i.deliveredCartonCount : 0,
          deliveredWeight: i.deliveredWeight !== undefined && i.deliveredWeight !== null ? i.deliveredWeight : 0
        })) 
      : [{ id: generateUUID(), goodsName: permit.goodsName || '', cartonCount: permit.cartonCount || 0, weight: permit.weight || 0, deliveredCartonCount: 0, deliveredWeight: 0 }]
  );

  const handleUpdateItem = (index: number, field: keyof ExitPermitItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleAddItem = () => {
    setItems([...items, { id: generateUUID(), goodsName: '', cartonCount: 0, weight: 0, deliveredCartonCount: 0, deliveredWeight: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return alert("حداقل یک ردیف کالا باید وجود داشته باشد.");
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const totalRequestedCount = items.reduce((sum, i) => sum + (Number(i.cartonCount) || 0), 0);
  const totalDeliveredCount = items.reduce((sum, i) => sum + (Number(i.deliveredCartonCount) || 0), 0);
  const totalRequestedWeight = items.reduce((sum, i) => sum + (Number(i.weight) || 0), 0);
  const totalDeliveredWeight = items.reduce((sum, i) => sum + (Number(i.deliveredWeight) || 0), 0);

  const handleSave = () => {
    if (items.some(i => !i.goodsName)) return alert("نام کالا نمی‌تواند خالی باشد.");
    if (items.some(i => i.deliveredCartonCount === undefined || i.deliveredCartonCount === null || i.deliveredCartonCount <= 0)) {
      return alert("وارد کردن تعداد کارتن خروجی معتبر برای تمامی ردیف‌ها الزامی است.");
    }
    if (items.some(i => !i.deliveredWeight || i.deliveredWeight <= 0)) return alert("وارد کردن وزن خروجی برای تمامی ردیف‌ها الزامی است.");
    
    const finalizedItems = items.map(i => ({
        ...i,
        cartonCount: Number(i.cartonCount), 
        weight: Number(i.weight),
        deliveredCartonCount: Number(i.deliveredCartonCount),
        deliveredWeight: Number(i.deliveredWeight)
    }));

    onConfirm(finalizedItems);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 animate-fade-in">
      <div className="glass-panel rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-orange-50 p-4 border-b border-orange-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-lg text-orange-600"><Package size={24} /></div>
            <div><h3 className="font-bold text-lg text-gray-800">تایید نهایی انبار (توزین خروج)</h3><p className="text-xs text-gray-500">لطفاً مقدار دقیق خروجی را وارد کنید.</p></div>
          </div>
          <button onClick={onClose} data-close-modal="true" className="text-gray-400 hover:text-red-500 transition-colors"><X size={24} /></button>
        </div>

        <div className="p-4 md:p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200 flex-1 min-h-0">
          <div className="glass-panel rounded-xl border border-gray-200/50 dark:border-white/10 shadow-sm overflow-x-auto w-full max-w-full block mb-6" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full min-w-[700px] text-sm text-center">
              <thead className="bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200 text-gray-700 font-bold whitespace-nowrap">
                <tr><th className="p-3 w-10">#</th><th className="p-3 text-right">شرح کالا</th><th className="p-3 w-24 bg-blue-50 text-blue-800 border-l border-white">عدد/کارتن (درخواست)</th><th className="p-3 w-24 bg-green-50 text-green-800">کارتن خروجی</th><th className="p-3 w-32 bg-blue-50 text-blue-800 border-l border-white">وزن درخواستی</th><th className="p-3 w-32 bg-green-50 text-green-800">وزن خروجی</th><th className="p-3 w-10"></th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-blue-50/30 transition-colors">
                    <td className="p-3 text-gray-500 font-mono">{idx + 1}</td>
                    <td className="p-3"><input className="w-full border rounded-lg p-2 text-sm font-bold" value={item.goodsName} onChange={e => handleUpdateItem(idx, 'goodsName', e.target.value)} placeholder="نام کالا"/></td>
                    <td className="p-3 bg-blue-50/30 font-mono text-gray-500 border-l border-gray-100">{item.cartonCount}</td>
                    <td className="p-3 bg-green-50/30"><input type="number" className="w-full border rounded-lg p-2 text-center font-mono font-bold text-green-700 outline-none glass-panel" value={item.deliveredCartonCount || ''} onChange={e => handleUpdateItem(idx, 'deliveredCartonCount', e.target.value === '' ? 0 : Number(e.target.value))}/></td>
                    <td className="p-3 bg-blue-50/30 font-mono text-gray-500 border-l border-gray-100">{Number(item.weight || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</td>
                    <td className="p-3 bg-green-50/30"><input type="number" step="0.001" className="w-full border rounded-lg p-2 text-center font-mono font-bold text-green-700 outline-none glass-panel text-lg" value={item.deliveredWeight || ''} onChange={e => handleUpdateItem(idx, 'deliveredWeight', e.target.value === '' ? 0 : Number(e.target.value))}/></td>
                    <td className="p-3 text-center"><button onClick={() => handleRemoveItem(idx)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={18}/></button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={2} className="p-3 text-left pl-6 font-bold text-gray-600 flex items-center justify-between"><button onClick={handleAddItem} className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-100 font-bold border border-blue-200"><Plus size={14}/> افزودن کالا</button><span className="flex items-center gap-2"><Calculator size={16}/> جمع کل:</span></td>
                  <td className="p-3 font-bold text-gray-500 font-mono text-lg bg-blue-50/30 border-l border-gray-200">{totalRequestedCount}</td>
                  <td className="p-3 font-black text-green-700 font-mono text-lg bg-green-50/30 border-l border-gray-200">{totalDeliveredCount}</td>
                  <td className="p-3 font-bold text-gray-500 font-mono text-lg bg-blue-50/30 border-l border-gray-200">{Number(totalRequestedWeight.toFixed(3))}</td>
                  <td className="p-3 font-black text-green-700 font-mono text-xl bg-green-50/30">{Number(totalDeliveredWeight.toFixed(3))}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        <div className="p-4 border-t glass-panel flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50">انصراف</button>
          <button onClick={handleSave} className="px-6 py-2 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 shadow-lg flex items-center gap-2">
            <Save size={18} /> تایید نهایی و ارسال به انتظامات
          </button>
        </div>
      </div>
    </div>
  );
};
export default WarehouseFinalizeModal;
