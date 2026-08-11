const axios = require('axios');

async function run() {
    const url = 'http://80.210.31.176:5000/api/external/v1/query';
    const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };

    // Exact query for Sales (OpCode 12) & Returns (OpCode 13) in Farvardin 1405
    const sql = `
        SELECT 
            t10.Field_001 as DocId,
            t10.Field_006 as InvoiceNum,
            t10.Field_008 as Date,
            t10.Field_009 as OpCode,
            t10.Field_029 as Notes,
            t10.Field_037 as HeaderPayable,
            t11.Field_005 as ItemCode,
            COALESCE(t22.Field_004, t_name.ItemName, t11.Field_005, 'کالای بدون نام') as ItemName,
            t_group.GroupName,
            t11.Field_006 as Quantity,
            t11.Field_031 as ItemNotes,
            t11.Field_007 as Amount
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004
                                  AND t11.Field_012 = t10.Field_018
                                  AND t11.Field_036 = t10.Field_009
        LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN (
            SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, MIN(t02_sub.Field_003) as ItemName
            FROM IND_TBL_021 t21_sub
            LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
            GROUP BY t21_sub.Field_004
        ) t_name ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t_name.ItemCode))
        LEFT JOIN (
            SELECT t21_sub.Field_004 as ItemCode, MIN(COALESCE(t02_grandparent.Field_003, t02_parent.Field_003, t02_sub.Field_003)) as GroupName
            FROM IND_TBL_021 t21_sub
            LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
            LEFT JOIN IND_TBL_002 t02_parent ON RTRIM(LTRIM(t02_sub.Field_009)) = RTRIM(LTRIM(t02_parent.Field_008))
            LEFT JOIN IND_TBL_002 t02_grandparent ON RTRIM(LTRIM(t02_parent.Field_009)) = RTRIM(LTRIM(t02_grandparent.Field_008))
            GROUP BY t21_sub.Field_004
        ) t_group ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t_group.ItemCode))
        WHERE t10.Field_009 IN ('12', '13')
          AND t10.Field_008 >= '2026-03-21 00:00:00'
          AND t10.Field_008 <= '2026-04-20 23:59:59'
    `;

    try {
        const res = await axios.post(url, { query: sql }, { headers });
        const rows = res.data.data || [];
        console.log(`Fetched ${rows.length} total rows for Farvardin 1405 (Sales + Returns).`);

        // Separate Sales (OpCode 12) vs Returns (OpCode 13)
        const salesRows = rows.filter(r => String(r.OpCode).trim() === '12');
        const returnRows = rows.filter(r => String(r.OpCode).trim() === '13');

        console.log(`Sales Rows: ${salesRows.length}, Return Rows: ${returnRows.length}`);

        // Calculate Header Payable allocation for Sales
        const allocateRows = (rawRows) => {
            const invMap = new Map();
            rawRows.forEach(row => {
                const docId = row.DocId || 'unknown';
                if (!invMap.has(docId)) invMap.set(docId, []);
                invMap.get(docId).push(row);
            });

            const processed = [];
            invMap.forEach((docRows) => {
                const headerPayable = parseFloat(docRows[0].HeaderPayable || docRows[0].Amount || 0);
                const sumItemAmt = docRows.reduce((s, r) => s + parseFloat(r.Amount || 0), 0);
                const sumItemQty = docRows.reduce((s, r) => s + parseFloat(r.Quantity || 0), 0);

                docRows.forEach(r => {
                    const itemAmt = parseFloat(r.Amount || 0);
                    const itemQty = parseFloat(r.Quantity || 0);
                    let allocatedAmt = 0;
                    if (headerPayable > 0) {
                        if (sumItemAmt > 0) {
                            allocatedAmt = headerPayable * (itemAmt / sumItemAmt);
                        } else if (sumItemQty > 0) {
                            allocatedAmt = headerPayable * (itemQty / sumItemQty);
                        } else {
                            allocatedAmt = headerPayable / docRows.length;
                        }
                    } else {
                        allocatedAmt = itemAmt;
                    }

                    processed.push({
                        ...r,
                        AllocatedAmount: allocatedAmt
                    });
                });
            });
            return { processed, invCount: invMap.size };
        };

        const { processed: processedSales, invCount: salesInvCount } = allocateRows(salesRows);
        const { processed: processedReturns, invCount: returnInvCount } = allocateRows(returnRows);

        // Product filter helper
        const isActualProduct = (row) => {
            if (!row) return false;
            const code = String(row.ItemCode || '').trim();
            const name = String(row.ItemName || '').trim();
            const group = String(row.GroupName || '').trim();

            const lowerName = name.toLowerCase();
            const lowerGroup = group.toLowerCase();
            const keywordsToExclude = [
                'کارتن', 'پالت', 'جعبه', 'حمل', 'کرایه', 'خدمات', 'هزینه', 'دوک خالی', 'کیسه خالی', 'بسته بندی', 'پلاستیک'
            ];

            for (const keyword of keywordsToExclude) {
                if (lowerName.includes(keyword) || lowerGroup.includes(keyword)) {
                    return false;
                }
            }

            const isProductPrefix = /^(01|02|04|05)/.test(code);
            if (isProductPrefix) {
                return true;
            }

            if (!group && (!name || name === code || /^\d+$/.test(name))) {
                return false;
            }

            return true;
        };

        let grossSalesQty = 0;
        let grossSalesAmt = 0;
        processedSales.forEach(r => {
            if (isActualProduct(r)) {
                grossSalesQty += parseFloat(r.Quantity || 0);
                grossSalesAmt += r.AllocatedAmount || 0;
            }
        });

        let returnQty = 0;
        let returnAmt = 0;
        processedReturns.forEach(r => {
            if (isActualProduct(r)) {
                returnQty += parseFloat(r.Quantity || 0);
                returnAmt += r.AllocatedAmount || 0;
            }
        });

        const netQty = grossSalesQty - returnQty;
        const netAmt = grossSalesAmt - returnAmt;

        console.log(`=======================================================`);
        console.log(`FARVARDIN 1405 EXACT FINANCIAL & WEIGHT SUMMARY`);
        console.log(`=======================================================`);
        console.log(`- Sales Invoices Count   : ${salesInvCount}`);
        console.log(`- Gross Sales Quantity   : ${(grossSalesQty / 1000).toFixed(2)} tons (${grossSalesQty.toFixed(2)} kg)`);
        console.log(`- Gross Sales Amount     : ${(grossSalesAmt / 1e9).toFixed(3)} Billion Rials (${grossSalesAmt.toLocaleString()} Rials)`);
        console.log(`-------------------------------------------------------`);
        console.log(`- Return Invoices Count  : ${returnInvCount}`);
        console.log(`- Return Quantity        : ${(returnQty / 1000).toFixed(2)} tons (${returnQty.toFixed(2)} kg)`);
        console.log(`- Return Amount          : ${(returnAmt / 1e9).toFixed(3)} Billion Rials (${returnAmt.toLocaleString()} Rials)`);
        console.log(`-------------------------------------------------------`);
        console.log(`- NET SALES QUANTITY     : ${(netQty / 1000).toFixed(2)} tons (${netQty.toFixed(2)} kg)`);
        console.log(`- NET SALES AMOUNT       : ${(netAmt / 1e9).toFixed(3)} Billion Rials (${netAmt.toLocaleString()} Rials)`);
        console.log(`=======================================================`);

    } catch (e) {
        console.error(e.message);
    }
}
run();
