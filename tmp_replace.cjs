const fs = require('fs');
let code = fs.readFileSync('components/AccountingReports.tsx', 'utf8');

const blobToBase64Str = `
// Function to convert Blob to Base64
const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};
`;

// Inject blobToBase64
if (!code.includes('const blobToBase64')) {
    code = code.replace(
        'export const AccountingReports: React.FC = () => {', 
        blobToBase64Str + '\nexport const AccountingReports: React.FC = () => {'
    );
}

// Replace handleSendSalesBotReport
const newHandleSendSalesBotReport = `
    const handleSendSalesBotReport = async (mode?: 'current' | 'today' | 'yesterday') => {
        let label = '';
        if (mode === 'today' || (salesViewMode === 'today' && !compareMode)) {
            label = 'امروز';
        } else if (mode === 'yesterday') {
            label = 'دیروز';
        } else {
            const fromD = dateFrom || formatDateToJalali(new Date().toISOString());
            const toD = dateTo || fromD;
            label = fromD === toD ? fromD : \`از \${fromD} تا \${toD}\`;
        }

        if (!confirm(\`آیا از تولید PDF و ارسال گزارش فروش (\${label}) به ربات تلگرام / بله اطمینان دارید؟\`)) return;
        setIsSendingSalesBot(true);
        const loadingToast = toast.loading('در حال تولید PDF و ارسال...');
        try {
            const htmlContent = handlePrintTodaySales(true) as string;
            const pdfFilename = \`Sales_Report_\${Date.now()}.pdf\`;
            const blob = await generatePdfFromHtml(htmlContent, pdfFilename);
            if (!blob) throw new Error('PDF generation failed');
            
            const base64Data = await blobToBase64(blob);
            
            const res = await fetch(getEffectiveApiUrl('/api/bot/send-document'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    base64Data,
                    filename: pdfFilename,
                    caption: \`📊 گزارش رسمی فروش سایان ERP\\n📅 \${label}\`,
                    platforms: ['telegram', 'bale']
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('گزارش فروش با موفقیت به ربات ارسال شد.', { id: loadingToast });
            } else {
                toast.error(data.error || 'خطا در ارسال گزارش.', { id: loadingToast });
            }
        } catch (e: any) {
            toast.error("خطا: " + e.message, { id: loadingToast });
        } finally {
            setIsSendingSalesBot(false);
        }
    };
`;

const oldSalesRegex = /const handleSendSalesBotReport = async \([\s\S]*?setIsSendingSalesBot\(false\);\s*\n\s*\};/;
code = code.replace(oldSalesRegex, newHandleSendSalesBotReport.trim());

// We also need to add a handleSendTrazBotReport for customer balances!
const newHandleSendTrazBotReport = `
    const handleSendTrazBotReport = async () => {
        const isBed = window.confirm('ارسال گزارش بدهکاران؟\\n(OK برای بدهکاران، Cancel برای بستانکاران)');
        const dateFromStr = dateFrom || 'ابتدا';
        const dateToStr = dateTo || 'امروز';
        
        setIsLoading(true);
        const loadingToast = toast.loading('در حال تولید PDF و ارسال به بات...');
        try {
            const htmlContent = handlePrintTrazReport(isBed ? 'bed' : 'bes', true) as string;
            const pdfFilename = \`Traz_\${isBed ? 'Debtors' : 'Creditors'}_\${Date.now()}.pdf\`;
            
            const blob = await generatePdfFromHtml(htmlContent, pdfFilename);
            if (!blob) throw new Error('PDF generation failed');
            
            const base64Data = await blobToBase64(blob);
            
            const res = await fetch(getEffectiveApiUrl('/api/bot/send-document'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    base64Data,
                    filename: pdfFilename,
                    caption: \`📊 گزارش مانده \${isBed ? 'بدهکاران' : 'بستانکاران'}\\n📅 بازه: \${dateFromStr} تا \${dateToStr}\`,
                    platforms: ['telegram', 'bale']
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('گزارش با موفقیت به ربات ارسال شد.', { id: loadingToast });
            } else {
                toast.error(data.error || 'خطا در ارسال.', { id: loadingToast });
            }
        } catch (e: any) {
            toast.error("خطا: " + e.message, { id: loadingToast });
        } finally {
            setIsLoading(false);
        }
    };
`;

if (!code.includes('handleSendTrazBotReport')) {
    code = code.replace('const handlePrintTrazReport', newHandleSendTrazBotReport + '\n    const handlePrintTrazReport');
}

const trazTabButtonHTML = `
                                    <button 
                                        onClick={handleSendTrazBotReport}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs px-4 py-2 font-bold transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Bot size={14} />
                                        <span>ارسال به بات</span>
                                    </button>
                                </div>
                            </div>
                        </div>
`;
code = code.replace(
    'className="bg-blue-600 hover:bg-blue-700 text-white rounded text-xs px-4 py-2 font-bold transition-colors flex items-center justify-center gap-2"\n                                    >\n                                        <Printer size={14} />\n                                        <span>چاپ / PDF</span>\n                                    </button>\n                                </div>\n                            </div>\n                        </div>',
    'className="bg-blue-600 hover:bg-blue-700 text-white rounded text-xs px-4 py-2 font-bold transition-colors flex items-center justify-center gap-2"\n                                    >\n                                        <Printer size={14} />\n                                        <span>چاپ / PDF</span>\n                                    </button>\n' + trazTabButtonHTML
);

const headerChatButtonRegex = /<button\s+onClick=\{handleShareReportToChat\}[\s\S]*?<span>ارسال به گفتگو<\/span>\s*<\/button>/;
code = code.replace(headerChatButtonRegex, '');

fs.writeFileSync('components/AccountingReports.tsx', code);
console.log('AccountingReports modified!');
