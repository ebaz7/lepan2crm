const axios = require('axios');

const url = 'http://80.210.31.176:5000/api/external/v1/query';
const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa', 'Content-Type': 'application/json' };

async function run() {
    const sql = `
        SELECT 
            RTRIM(LTRIM(t10.Field_009)) as DocType,
            t11.Field_006 as Quantity
        FROM STR_TBL_011 t11
        INNER JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004 
                                  AND t11.Field_012 = t10.Field_018
        WHERE t10.Field_008 >= '2025-03-21T00:00:00.000Z'
          AND t10.Field_008 <= '2026-03-20T23:59:59.000Z'
          AND t11.Field_005 LIKE '0104%'
    `;

    try {
        const response = await axios.post(url, { query: sql }, { headers });
        const rows = response.data.data || [];
        console.log("Total rows:", rows.length);
        
        const sumByDocType = {};
        rows.forEach(r => {
            const dt = r.DocType || 'UNKNOWN';
            const qty = parseFloat(r.Quantity) || 0;
            sumByDocType[dt] = (sumByDocType[dt] || 0) + qty;
        });
        
        console.log("Sums by DocType:");
        console.log(sumByDocType);

        // Let's print out some equations
        // Receipt: 10
        // Issue: 23, 3, 12, 13 etc
        const r10 = sumByDocType['10'] || 0;
        const r13 = sumByDocType['13'] || 0;
        const r23 = sumByDocType['23'] || 0;
        const r3 = sumByDocType['3'] || 0;
        const r12 = sumByDocType['12'] || 0;

        console.log(`10 (رسید انبار): ${r10}`);
        console.log(`13 (برگشت از فروش): ${r13}`);
        console.log(`23 (حواله فروش): ${r23}`);
        console.log(`3 (حواله انبار): ${r3}`);
        console.log(`12 (سایر حواله ها): ${r12}`);

        // Try some calculations
        console.log("--- Standard Stock Equation (10 + 13 - 3 - 12 - 23) ---");
        console.log(r10 + r13 - r3 - r12 - r23);

        console.log("--- Only Receipts - Sales Remittances (10 - 23) ---");
        console.log(r10 - r23);

        console.log("--- Receipts - Sales Remittances + Sales Returns (10 - 23 + 13) ---");
        console.log(r10 - r23 + r13);

        console.log("--- Inflows (10) - Outflows (3 + 12 + 23) ---");
        console.log(r10 - (r3 + r12 + r23));

        console.log("--- Receipts (10 + 13) - Outflows (3 + 23) ---");
        console.log((r10 + r13) - (r3 + r23));

    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
