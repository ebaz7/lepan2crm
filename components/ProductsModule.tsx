import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, Edit2, Trash2, Tag, DollarSign, Filter, RefreshCw, ShoppingCart, MessageSquare, Check, X, ChevronRight, ChevronDown, EyeOff, Eye, Upload, Download } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { formatCurrency, parsePersianDate } from '../constants';
import * as XLSX from 'xlsx';
import { saveBlobAndOpenFile } from '../services/fileService';

interface Product {
    id: string;
    code: string;
    name: string;
    group: string;
    subgroup?: string;
    price: number;
    stock: number;
    unit: string;
    hidePrice?: boolean;
    hideStock?: boolean;
}

interface CustomerOrder {
    id: string;
    customerChatId: string;
    text: string;
    status: 'pending' | 'processing' | 'done' | 'rejected';
    date: string;
}

const ProductsModule: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [orders, setOrders] = useState<CustomerOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'products' | 'orders'>('products');

    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [formData, setFormData] = useState({ 
        code: '', name: '', group: '', subgroup: '', price: '', stock: '', unit: '',
        hidePrice: false, hideStock: false
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const fetchData = async () => {
        setLoading(true);
        try {
            const [prods, ords] = await Promise.all([
                apiCall<Product[]>('/products'),
                apiCall<CustomerOrder[]>('/customer-orders')
            ]);
            setProducts(prods || []);
            setOrders(ords || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (!confirm(`آیا از وارد کردن ${data.length} محصول اطمینان دارید؟`)) return;

                setLoading(true);
                let successCount = 0;
                for (const row of (data as any[])) {
                    const payload = {
                        code: String(row['کد کالا'] || row['Code'] || ''),
                        name: String(row['نام کالا'] || row['Name'] || ''),
                        group: String(row['گوه'] || row['گروه'] || row['Group'] || 'سایر'),
                        subgroup: String(row['زیرگروه'] || row['Subgroup'] || ''),
                        price: Number(row['قیمت'] || row['Price'] || 0),
                        stock: Number(row['موجودی'] || row['Stock'] || 0),
                        unit: String(row['واحد'] || row['Unit'] || 'عدد')
                    };
                    if (payload.name) {
                        await apiCall('/products', 'POST', payload);
                        successCount++;
                    }
                }
                alert(`${successCount} محصول با موفقیت وارد شد.`);
                fetchData();
            } catch (err) {
                console.error(err);
                alert('خطا در پردازش فایل اکسل');
            } finally {
                setLoading(false);
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const downloadSampleExcel = () => {
        const sampleData = [
            { 'کد کالا': 'P1001', 'نام کالا': 'میلگرد ۱۰', 'گروه': 'آهن آلات', 'زیرگروه': 'میلگرد', 'قیمت': 250000, 'موجودی': 100, 'واحد': 'شاخه' },
            { 'کد کالا': 'P1002', 'نام کالا': 'تیرآهن ۱۴', 'گروه': 'آهن آلات', 'زیرگروه': 'تیرآهن', 'قیمت': 4500000, 'موجودی': 50, 'واحد': 'شاخه' }
        ];
        const ws = XLSX.utils.json_to_sheet(sampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Products");
        
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveBlobAndOpenFile(blob, "Sample_Products.xlsx");
    };

    useEffect(() => { fetchData(); }, []);

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            code: formData.code,
            name: formData.name,
            group: formData.group || 'بدون گروه',
            subgroup: formData.subgroup || 'سایر',
            price: Number(formData.price) || 0,
            stock: Number(formData.stock) || 0,
            unit: formData.unit || 'عدد',
            hidePrice: formData.hidePrice,
            hideStock: formData.hideStock
        };

        try {
            if (editingProduct) {
                await apiCall(`/products/${editingProduct.id}`, 'PUT', payload);
            } else {
                await apiCall('/products', 'POST', payload);
            }
            setShowProductModal(false);
            fetchData();
        } catch (e) {
            console.error(e);
            alert('خطا در ذخیره اطلاعات');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('آیا از حذف این محصول اطمینان دارید؟')) return;
        try {
            await apiCall(`/products/${id}`, 'DELETE');
            fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    const handleUpdateOrder = async (id: string, status: string) => {
        try {
            await apiCall(`/customer-orders/${id}`, 'PUT', { status });
            fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    const deleteOrder = async (id: string) => {
        if (!window.confirm('آیا از حذف این درخواست اطمینان دارید؟')) return;
        try {
            await apiCall(`/customer-orders/${id}`, 'DELETE');
            fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    // Tree grouping logic
    const filteredProducts = products.filter(p => 
        p.name.includes(searchQuery) || 
        p.code.includes(searchQuery) || 
        (p.group && p.group.includes(searchQuery)) || 
        (p.subgroup && p.subgroup.includes(searchQuery))
    );

    const groupedProducts: Record<string, Record<string, Product[]>> = {};

    filteredProducts.forEach(p => {
        const g = p.group || 'بدون گروه';
        const sg = p.subgroup || 'سایر';
        if (!groupedProducts[g]) groupedProducts[g] = {};
        if (!groupedProducts[g][sg]) groupedProducts[g][sg] = [];
        groupedProducts[g][sg].push(p);
    });

    const isSearching = searchQuery.length > 0;

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 glass-panel p-6 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                        <Package className="text-blue-600 w-8 h-8" />
                        مدیریت بازرگانی و فروش
                    </h2>
                    <p className="text-gray-500 mt-1 text-sm font-medium">مدیریت هرمی محصولات، قیمت‌ها و سفارشات مشتریان</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchData} className="p-2 border-2 text-gray-600 hover:bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200 rounded-xl transition-all" title="بروزرسانی">
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    {view === 'products' && (
                        <>
                            <button onClick={downloadSampleExcel} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200 text-gray-700 px-3 py-2 rounded-xl hover:bg-gray-200 transition-all font-bold text-sm" title="دانلود نمونه اکسل">
                                <Download className="w-5 h-5" />
                                <span className="hidden sm:inline">نمونه اکسل</span>
                            </button>
                            <label className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-2 rounded-xl hover:bg-emerald-700 transition-all font-bold text-sm cursor-pointer shadow-lg shadow-emerald-100">
                                <Upload className="w-5 h-5" />
                                <span className="hidden sm:inline">واردات اکسل</span>
                                <input type="file" accept=".xlsx, .xls" onChange={handleExcelImport} className="hidden" />
                            </label>
                            <button onClick={() => { 
                                setEditingProduct(null); 
                                setFormData({ code: '', name: '', group: '', subgroup: '', price: '', stock: '', unit: 'عدد', hidePrice: false, hideStock: false }); 
                                setShowProductModal(true); 
                            }} 
                                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-200">
                                <Plus className="w-5 h-5" />
                                <span className="hidden sm:inline">تعریف محصول</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex gap-4 border-b-2 border-gray-100 pb-2">
                <button onClick={() => setView('products')} className={`flex flex-col items-center gap-1 font-bold pb-2 border-b-4 transition-all px-4 ${view === 'products' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    <Package className="w-5 h-5" />
                    محصولات ({products.length})
                </button>
                <button onClick={() => setView('orders')} className={`flex flex-col items-center gap-1 font-bold pb-2 border-b-4 transition-all px-4 ${view === 'orders' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    <ShoppingCart className="w-5 h-5" />
                    سفارشات مشتریان ({orders.length})
                </button>
            </div>

            {view === 'products' && (
                <div className="glass-panel rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full sm:w-96">
                            <Search className="w-5 h-5 absolute right-3 top-2.5 text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="جستجو در محصولات و دسته‌ها..." 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-4 pr-10 py-2 border-2 border-gray-200/50 dark:border-white/10 focus:border-blue-500 rounded-xl outline-none transition-all" 
                            />
                        </div>
                        <button 
                            onClick={async () => {
                                if (!confirm("آیا مایلید لیست قیمت برای کاربران ربات پیام‌رسان‌ها ارسال شود؟")) return;
                                try {
                                    let content = "📢 *لیست قیمت محصولات*\n\n";
                                    // Tree logic for broadcast
                                    const allGroups = Object.keys(groupedProducts).sort();
                                    allGroups.forEach(g => {
                                        content += `📁 *${g}*\n`;
                                        const subGroups = Object.keys(groupedProducts[g]).sort();
                                        subGroups.forEach(sg => {
                                            content += `  🔹 *${sg}*\n`;
                                            groupedProducts[g][sg].forEach(p => {
                                                const priceTxt = p.hidePrice ? "تماس با فروش" : `${Number(p.price).toLocaleString()} ریال`;
                                                const stockTxt = p.hideStock ? "تماس با فروش" : `${p.stock} ${p.unit}`;
                                                content += `      ◽️ ${p.name}: ${priceTxt} (${stockTxt})\n`;
                                            });
                                        });
                                        content += "\n";
                                    });
                                    const res: any = await apiCall('/bot/broadcast', 'POST', { message: content });
                                    alert(`ارسال با موفقیت به ${res.count} کاربر انجام شد.`);
                                } catch (e) {
                                    alert("خطا در ارسال پیام");
                                }
                            }}
                            className="bg-green-100 text-green-700 font-bold px-4 py-2 border border-green-200 rounded-xl hover:bg-green-200 flex items-center gap-2 text-xs"
                        >
                            ارسال لیست هرمی قیمت به بات
                        </button>
                    </div>

                    <div className="p-4 bg-gray-50/30">
                        {Object.keys(groupedProducts).sort().map(group => (
                            <div key={group} className="mb-4 last:mb-0">
                                <button 
                                    onClick={() => toggleGroup(group)}
                                    className="w-full flex items-center gap-2 p-3 glass-panel border border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-black text-gray-800 shadow-sm"
                                >
                                    {expandedGroups[group] || isSearching ? <ChevronDown className="w-5 h-5 text-blue-600" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                                    <Tag className="w-4 h-4 text-blue-500" />
                                    {group}
                                    <span className="mr-auto text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                        {Object.values(groupedProducts[group]).flat().length} کالا
                                    </span>
                                </button>

                                {(expandedGroups[group] || isSearching) && (
                                    <div className="mr-6 mt-2 space-y-2 border-r-2 border-blue-100 pr-4">
                                        {Object.keys(groupedProducts[group]).sort().map(subgroup => (
                                            <div key={subgroup}>
                                                <div className="flex items-center gap-2 p-2 text-sm font-bold text-gray-600 border-b border-gray-100">
                                                    <Filter className="w-3 h-3 text-gray-400" />
                                                    {subgroup}
                                                </div>
                                                <div className="space-y-2 mt-2">
                                                    {groupedProducts[group][subgroup].map(p => (
                                                        <div key={p.id} className="glass-panel border border-gray-100 p-3 rounded-xl flex flex-wrap items-center justify-between gap-4 hover:shadow-md transition-shadow">
                                                            <div className="flex-1 min-w-[200px]">
                                                                <div className="font-bold text-gray-800 flex items-center gap-2">
                                                                    {p.name}
                                                                    {(p.hidePrice || p.hideStock) && (
                                                                        <span title="مخفی در بات">
                                                                            <EyeOff className="w-3 h-3 text-orange-400" />
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-[10px] text-gray-400 font-mono">{p.code || 'بدون کد'}</div>
                                                            </div>
                                                            <div className="flex items-center gap-6">
                                                                <div className="text-left">
                                                                    <div className="text-[9px] text-gray-400">قیمت (ریال)</div>
                                                                    <div className={`font-mono font-black ${p.hidePrice ? 'text-orange-500' : 'text-green-700'}`}>
                                                                        {p.hidePrice ? 'تماس با فروش' : (p.price > 0 ? p.price.toLocaleString() : '-')}
                                                                    </div>
                                                                </div>
                                                                <div className="text-left">
                                                                    <div className="text-[9px] text-gray-400">موجودی</div>
                                                                    <div className={`font-bold ${p.hideStock ? 'text-orange-500' : (p.stock > 0 ? 'text-emerald-700' : 'text-red-700')}`}>
                                                                        {p.hideStock ? 'تماس با فروش' : `${p.stock} ${p.unit}`}
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-1 border-r pr-4">
                                                                    <button onClick={() => { 
                                                                        setEditingProduct(p); 
                                                                        setFormData({ 
                                                                            code: p.code, name: p.name, group: p.group || '', subgroup: p.subgroup || '', 
                                                                            price: p.price.toString(), stock: p.stock.toString(), unit: p.unit || 'عدد',
                                                                            hidePrice: !!p.hidePrice, hideStock: !!p.hideStock
                                                                        }); 
                                                                        setShowProductModal(true); 
                                                                    }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                                    <button onClick={() => handleDelete(p.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {view === 'orders' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {orders.slice().reverse().map(order => (
                        <div key={order.id} className="glass-panel rounded-2xl p-5 shadow-sm border border-gray-200 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded-lg shadow-sm">
                                        {order.date}
                                    </span>
                                    <span className={`text-xs font-bold px-2 py-1 rounded-lg
                                        ${order.status === 'pending' ? 'bg-orange-100 text-orange-700' : 
                                          order.status === 'processing' ? 'bg-blue-100 text-blue-700' : 
                                          order.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {order.status === 'pending' ? 'جدید' : order.status === 'processing' ? 'در حال بررسی' : order.status === 'done' ? 'انجام شد' : 'رد شد'}
                                    </span>
                                </div>
                                <div className="bg-gray-50 border-2 border-gray-100 p-4 rounded-xl text-sm leading-relaxed text-gray-700 whitespace-pre-wrap font-medium h-32 overflow-y-auto mb-4">
                                    {order.text}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-1 mb-4">
                                    <MessageSquare className="w-3 h-3" /> آیدی مشتری: {order.customerChatId}
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t-2 border-gray-100 flex flex-wrap gap-2 justify-between">
                                {order.status === 'pending' && <button onClick={() => handleUpdateOrder(order.id, 'processing')} className="flex-1 bg-blue-100 text-blue-700 py-2 rounded-xl text-sm font-bold hover:bg-blue-200 transition-colors">بررسی</button>}
                                {(order.status === 'pending' || order.status === 'processing') && <button onClick={() => handleUpdateOrder(order.id, 'done')} className="flex-1 bg-green-100 text-green-700 py-2 rounded-xl text-sm font-bold hover:bg-green-200 transition-colors flex items-center justify-center gap-1"><Check className="w-4 h-4"/> تایید و انجام</button>}
                                {(order.status === 'pending' || order.status === 'processing') && <button onClick={() => handleUpdateOrder(order.id, 'rejected')} className="flex-1 bg-red-100 text-red-700 py-2 rounded-xl text-sm font-bold hover:bg-red-200 transition-colors flex items-center justify-center gap-1"><X className="w-4 h-4"/> رد</button>}
                                <button onClick={() => deleteOrder(order.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"><Trash2 className="w-5 h-5"/></button>
                            </div>
                        </div>
                    ))}
                    {orders.length === 0 && <div className="col-span-full py-12 text-center text-gray-400 text-sm font-bold glass-panel border border-dashed border-gray-200 rounded-xl">هیچ سفارشی یافت نشد.</div>}
                </div>
            )}

            {showProductModal && (
                <div className="fixed inset-0 z-50 flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="glass-panel rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-in">
                        <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg">{editingProduct ? 'ویرایش محصول' : 'محصول جدید'}</h3>
                            <button onClick={() => setShowProductModal(false)} className="bg-white/20 hover:bg-white/30 rounded-lg p-1 transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">نام کالا * / پلاک</label>
                                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-gray-50 border-2 border-gray-200 focus:glass-panel focus:border-blue-500 rounded-xl outline-none transition-all font-bold" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">گروه اصلی</label>
                                    <input type="text" value={formData.group} list="groups-list" onChange={e => setFormData({...formData, group: e.target.value})} className="w-full p-3 bg-gray-50 border-2 border-gray-200 focus:glass-panel focus:border-blue-500 rounded-xl outline-none transition-all font-bold" />
                                    <datalist id="groups-list">
                                        {[...new Set(products.map(p => p.group))].map(g => <option key={String(g)} value={String(g)} />)}
                                    </datalist>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">زیرگروه</label>
                                    <input type="text" value={formData.subgroup} list="subgroups-list" onChange={e => setFormData({...formData, subgroup: e.target.value})} className="w-full p-3 bg-gray-50 border-2 border-gray-200 focus:glass-panel focus:border-blue-500 rounded-xl outline-none transition-all font-bold" />
                                    <datalist id="subgroups-list">
                                        {[...new Set(products.map(p => p.subgroup))].filter(Boolean).map(sg => <option key={String(sg)} value={String(sg)} />)}
                                    </datalist>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">کد کالا</label>
                                    <input type="text" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="w-full p-3 bg-gray-50 border-2 border-gray-200 focus:glass-panel focus:border-blue-500 rounded-xl outline-none transition-all text-left font-mono" dir="ltr" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">واحد</label>
                                    <input type="text" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full p-3 bg-gray-50 border-2 border-gray-200 focus:glass-panel focus:border-blue-500 rounded-xl outline-none transition-all font-bold" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">قیمت (ریال)</label>
                                    <input type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full p-3 bg-gray-50 border-2 border-gray-200 focus:glass-panel focus:border-blue-500 rounded-xl outline-none transition-all font-mono font-bold" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">موجودی</label>
                                    <input type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} className="w-full p-3 bg-gray-50 border-2 border-gray-200 focus:glass-panel focus:border-blue-500 rounded-xl outline-none transition-all font-mono font-bold" />
                                </div>
                            </div>

                            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input type="checkbox" checked={formData.hidePrice} onChange={e => setFormData({...formData, hidePrice: e.target.checked})} className="w-4 h-4 rounded border-orange-300 text-orange-600 focus:ring-orange-500" />
                                    <span className="text-xs font-bold text-orange-800">مخفی کردن قیمت در بات (نمایش "تماس با فروش")</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input type="checkbox" checked={formData.hideStock} onChange={e => setFormData({...formData, hideStock: e.target.checked})} className="w-4 h-4 rounded border-orange-300 text-orange-600 focus:ring-orange-500" />
                                    <span className="text-xs font-bold text-orange-800">مخفی کردن موجودی در بات (نمایش "تماس با فروش")</span>
                                </label>
                            </div>
                            
                            <div className="pt-4 flex gap-3">
                                <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
                                    ذخیره محصول
                                </button>
                                <button type="button" onClick={() => setShowProductModal(false)} className="px-6 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all">
                                    انصراف
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductsModule;
