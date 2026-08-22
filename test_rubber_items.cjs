const axios = require('axios');

const url = 'http://80.210.31.176:5000/api/external/v1/query';
const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa', 'Content-Type': 'application/json' };

async function run() {
    const sql = `
        SELECT 
            t11.Field_005 as ItemCode,
            COALESCE(s04.Field_003, t22.Field_004, N'کالای بدون نام') as ItemName,
            RTRIM(LTRIM(t10.Field_009)) as DocType,
            t11.Field_006 as Quantity,
            t10.Field_008 as DocDate,
            t11.Field_031 as DetailNote
        FROM STR_TBL_011 t11
        INNER JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004 
                                  AND t11.Field_012 = t10.Field_018
        LEFT JOIN STR_TBL_004 s04 ON RTRIM(LTRIM(s04.Field_004)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
        WHERE t10.Field_008 >= '2025-03-21T00:00:00.000Z'
          AND t10.Field_008 <= '2026-03-20T23:59:59.000Z'
          AND t11.Field_005 LIKE '0104%'
    `;

    try {
        const response = await axios.post(url, { query: sql }, { headers });
        const rows = response.data.data || [];
        console.log("Total rows:", rows.length);
        
        // Group by ItemCode and see each item's details
        const items = {};
        rows.forEach(r => {
            const code = r.ItemCode;
            if (!items[code]) {
                items[code] = { name: r.ItemName, docTypes: {}, totalQty: 0 };
            }
            const dt = r.DocType;
            const qty = parseFloat(r.Quantity) || 0;
            items[code].docTypes[dt] = (items[code].docTypes[dt] || 0) + qty;
        });

        console.log("Items and their sums:");
        for (const [code, info] of Object.entries(items)) {
            console.log(`\nItem: ${code} - ${info.name}`);
            console.log("  Sums:", info.docTypes);
            // Calculate different formulas
            const r10 = info.docTypes['10'] || 0;
            const r12 = info.docTypes['12'] || 0;
            const r23 = info.docTypes['23'] || 0;
            console.log(`  10 - 23 - 12: ${r10 - r23 - r12}`);
            console.log(`  10 - 23 + 12: ${r10 - r23 + r12}`);
            console.log(`  10 + 12 - 23: ${r10 + r12 - r23}`);
            console.log(`  10 - 23: ${r10 - r23}`);
            console.log(`  10 - 12: ${r10 - r12}`);
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
