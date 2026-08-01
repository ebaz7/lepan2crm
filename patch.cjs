const fs = require('fs');
let code = fs.readFileSync('components/AccountingReports.tsx', 'utf8');

const startMarker = "    const fetchStatement = async () => {";
const endMarker = "    // TAB 3: SALES & COMPARISONS (گزارش فروش و مقایسه فصلی)";

const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
    const newCode = code.substring(0, startIndex) + `    const fetchStatement = async () => {
        if (!selectedTafsili) {
            // ...
            return;
        }
        setIsLoading(true);
        try {
            const sql = \\\`
                SELECT 
                    t9.Field_004 as SanadNo,
                    t9.Field_009 as Bed,
                    t9.Field_010 as Bes,
                    t9.Field_011 as Description,
                    t8.Field_008 as Date
                FROM ACT_TBL_009 t9
                LEFT JOIN ACT_TBL_008 t8 ON t9.Field_004 = t8.Field_006 AND t9.Field_003 = t8.Field_004
                WHERE t9.Field_015 LIKE '%11:\\\${selectedTafsili}%' AND t9.Field_007 NOT IN ('103', '107', '109', '114', '116', '117')
                  AND t8.Field_008 >= '\\\${dateFrom}T00:00:00.000Z'
                  AND t8.Field_008 <= '\\\${dateTo}T23:59:59.000Z'
                ORDER BY t8.Field_008 ASC, CAST(t9.Field_001 AS INT) ASC
            \\\`;
            const data = await runSayanQuery(sql);
            
            let balanceAccumulator = 0;
            const processed = data.map((row: any) => {
                const bed = parseFloat(row.Bed || 0);
                const bes = parseFloat(row.Bes || 0);
                balanceAccumulator += (bed - bes);
                return {
                    ...row,
                    bed,
                    bes,
                    balance: balanceAccumulator
                };
            });
            setStatementData(processed);
        } catch (err: any) {
            console.error(\\\`خطا در واکشی صورتحساب: \\\${err.message}\\\`);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredStatementData = statementData.filter(row => !statementSearch || (row.Description || '').includes(statementSearch) || String(row.SanadNo).includes(statementSearch));

    const handlePrintStatement = () => {
        if (filteredStatementData.length === 0) return;

        const tafsiliInfo = tafsilis.find(t => t.Code === selectedTafsili);
        const name = tafsiliInfo ? tafsiliInfo.Name : selectedTafsili;
        
        const docHtml = \\\`
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="utf-8">
                <title>ریز صورتحساب - \\\${name}</title>
                <style>
                    body { font-family: 'Tahoma', sans-serif; padding: 25px; background: #fff; }
                    .header { border-bottom: 2px solid #334155; padding-bottom: 10px; margin-bottom: 20px; }
                    .header h1 { font-size: 18px; margin: 0; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: right; font-size: 11px; }
                    th { background-color: #f1f5f9; }
                    .total { font-weight: bold; background: #f8fafc; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>ریز صورتحساب تراکنش‌ها</h1>
                    <p>شخص: <strong>\\\${name} (کد: \\\${selectedTafsili})</strong></p>
                    <p>بازه گزارش: از \\\${formatDateToJalali(dateFrom)} تا \\\${formatDateToJalali(dateTo)}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>ردیف</th>
                            <th>تاریخ</th>
                            <th>شماره سند</th>
                            <th>شرح تراکنش</th>
                            <th>بدهکار (ریال)</th>
                            <th>بستانکار (ریال)</th>
                            <th>مانده (ریال)</th>
                        </tr>
                    </thead>
                    <tbody>
                        \\\${filteredStatementData.map((row, idx) => \\\`
                            <tr>
                                <td>\\\${idx + 1}</td>
                                <td>\\\${formatDateToJalali(row.Date)}</td>
                                <td>\\\${row.SanadNo}</td>
                                <td>\\\${row.Description || ''}</td>
                                <td>\\\${row.bed > 0 ? formatMoney(row.bed) : '۰'}</td>
                                <td>\\\${row.bes > 0 ? formatMoney(row.bes) : '۰'}</td>
                                <td>\\\${formatMoney(row.balance)} (\\\${row.balance > 0 ? 'بدهکار' : row.balance < 0 ? 'بستانکار' : 'بی‌حساب'})</td>
                            </tr>
                        \\\`).join('')}
                        <tr class="total">
                            <td colspan="4" style="text-align: left;">جمع کل:</td>
                            <td>\\\${formatMoney(filteredStatementData.reduce((sum, r) => sum + r.bed, 0))}</td>
                            <td>\\\${formatMoney(filteredStatementData.reduce((sum, r) => sum + r.bes, 0))}</td>
                            <td>\\\${formatMoney(filteredStatementData[filteredStatementData.length - 1]?.balance || 0)}</td>
                        </tr>
                    </tbody>
                </table>
            </body>
            </html>
        \\\`;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(docHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    // ==========================================
\` + code.substring(endIndex);

    fs.writeFileSync('components/AccountingReports.tsx', newCode);
    console.log("Patched successfully");
} else {
    console.log("Could not find markers", startIndex, endIndex);
}
