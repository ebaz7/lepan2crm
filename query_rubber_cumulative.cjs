const axios = require('axios');

const url = 'http://80.210.31.176:5000/api/external/v1/query';
const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa', 'Content-Type': 'application/json' };

async function run() {
    // Cumulative up to 2026-03-20
    const sql = `
        SELECT 
            t11.Field_005 as ItemCode,
            COALESCE(s04.Field_003, t22.Field_004, N'کالای بدون نام') as ItemName,
            RTRIM(LTRIM(t10.Field_009)) as DocType,
            t11.Field_006 as Quantity
        FROM STR_TBL_011 t11
        INNER JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004 
                                  AND t11.Field_012 = t10.Field_018
        LEFT JOIN STR_TBL_004 s04 ON RTRIM(LTRIM(s04.Field_004)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
        WHERE t10.Field_008 <= '2026-03-20T23:59:59.000Z'
          AND t11.Field_005 LIKE '0104%'
    `;

    try {
        const response = await axios.post(url, { query: sql }, { headers });
        const rows = response.data.data || [];
        console.log("Total cumulative rows up to end of 1404:", rows.length);
        
        let sumStandard = 0;
        let sumOnly10_13 = 0;
        
        rows.forEach(r => {
            const dt = r.DocType;
            const qty = parseFloat(r.Quantity) || 0;
            if (['10', '13'].includes(dt)) {
                sumStandard += qty;
                sumOnly10_13 += qty;
            } else if (['3', '12', '23'].includes(dt)) {
                sumStandard -= qty;
            }
        });

        console.log("Cumulative Stock (Standard Formula 10+13 - 3-12-23):", sumStandard);
        console.log("Cumulative Stock (Only Inflows):", sumOnly10_13);

        // Group by ItemCode and see each item's cumulative balance
        const items = {};
        rows.forEach(r => {
            const code = r.ItemCode;
            if (!items[code]) {
                items[code] = { name: r.ItemName, qty: 0 };
            }
            const dt = r.DocType;
            const qty = parseFloat(r.Quantity) || 0;
            if (['10', '13'].includes(dt)) {
                items[code].qty += qty;
            } else if (['3', '12', '23'].includes(dt)) {
                items[code].qty -= qty;
            }
        });

        console.log("\nItems and their cumulative stock:");
        let totalGrouped = 0;
        for (const [code, info] of Object.entries(items)) {
            console.log(`  Item: ${code} - ${info.name}: ${info.qty}`);
            totalGrouped += info.qty;
        }
        console.log("Total Grouped:", totalGrouped);

    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
