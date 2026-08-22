const axios = require('axios');

const url = 'http://80.210.31.176:5000/api/external/v1/query';
const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa', 'Content-Type': 'application/json' };

async function run() {
    const sql = `
        SELECT 
            t11.Field_005 as ItemCode,
            t10.Field_008 as DocDate,
            RTRIM(LTRIM(t10.Field_009)) as DocType,
            t11.Field_006 as Quantity
        FROM STR_TBL_011 t11
        INNER JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004 
                                  AND t11.Field_012 = t10.Field_018
        WHERE t10.Field_008 <= '2026-03-20T23:59:59.000Z'
          AND (t11.Field_005 LIKE '01%' OR t11.Field_005 LIKE '04%')
    `;

    try {
        console.log("Fetching transactions for 01% and 04% up to end of 1404...");
        const response = await axios.post(url, { query: sql }, { headers });
        const rows = response.data.data || [];
        console.log(`Fetched ${rows.length} rows.`);
        
        const items = {};
        rows.forEach(r => {
            const code = r.ItemCode;
            if (!items[code]) {
                items[code] = {
                    bounded1404: 0,
                    cumulative: 0,
                    receipts1404: 0,
                    otherIssues1404: 0,
                    salesIssues1404: 0
                };
            }
            
            const dt = r.DocType;
            const qty = parseFloat(r.Quantity) || 0;
            const is1404 = r.DocDate >= '2025-03-21T00:00:00.000Z';
            
            let coef = 0;
            if (['10', '13'].includes(dt)) coef = 1;
            else if (['3', '12', '23'].includes(dt)) coef = -1;
            
            if (is1404) {
                items[code].bounded1404 += coef * qty;
                if (dt === '10') items[code].receipts1404 += qty;
                if (dt === '12') items[code].otherIssues1404 += qty;
                if (dt === '23') items[code].salesIssues1404 += qty;
            }
            items[code].cumulative += coef * qty;
        });

        console.log("\nSearching for items with balance/movement close to 43924.26...");
        for (const [code, info] of Object.entries(items)) {
            const target = 43924.26;
            const checkVals = [
                { name: 'Bounded 1404', val: info.bounded1404 },
                { name: 'Cumulative', val: info.cumulative },
                { name: 'Receipts 1404', val: info.receipts1404 },
                { name: 'Receipts - OtherIssues', val: info.receipts1404 - info.otherIssues1404 },
                { name: 'Receipts - SalesIssues', val: info.receipts1404 - info.salesIssues1404 },
                { name: 'Receipts + OtherIssues', val: info.receipts1404 + info.otherIssues1404 },
                { name: 'Receipts + SalesIssues', val: info.receipts1404 + info.salesIssues1404 },
                { name: 'Receipts + OtherIssues + SalesIssues', val: info.receipts1404 + info.otherIssues1404 + info.salesIssues1404 }
            ];

            checkVals.forEach(c => {
                if (Math.abs(c.val - target) < 10) {
                    console.log(`[MATCH] Code: ${code} | Metric: ${c.name} | Value: ${c.val.toFixed(2)} (diff: ${(c.val - target).toFixed(2)})`);
                }
            });
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
