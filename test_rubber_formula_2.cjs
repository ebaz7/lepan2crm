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
            t10.Field_008 as DocDate
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
        
        // Let's test two variations of formula:
        // Formula A: 10 + 12 - 23 (where 12 is positive inflow)
        // Formula B: 10 + 13 - 3 - 23 (excluding 12 completely)
        // Formula C: 10 + 13 - 3 - 12 - 23 (standard)
        
        let sumA_1404 = 0;
        let sumA_cumulative = 0;

        let sumB_1404 = 0;
        let sumB_cumulative = 0;

        let sumC_1404 = 0;
        let sumC_cumulative = 0;

        rows.forEach(r => {
            const dt = r.DocType;
            const qty = parseFloat(r.Quantity) || 0;
            const is1404 = r.DocDate >= '2025-03-21T00:00:00.000Z' && r.DocDate <= '2026-03-20T23:59:59.000Z';

            // Formula A: 10 + 12 - 23
            let valA = 0;
            if (dt === '10') valA = qty;
            else if (dt === '12') valA = qty;
            else if (dt === '23') valA = -qty;

            // Formula B: 10 + 13 - 3 - 23
            let valB = 0;
            if (['10', '13'].includes(dt)) valB = qty;
            else if (['3', '23'].includes(dt)) valB = -qty;

            // Formula C: 10 + 13 - 3 - 12 - 23
            let valC = 0;
            if (['10', '13'].includes(dt)) valC = qty;
            else if (['3', '12', '23'].includes(dt)) valC = -qty;

            if (is1404) {
                sumA_1404 += valA;
                sumB_1404 += valB;
                sumC_1404 += valC;
            }
            sumA_cumulative += valA;
            sumB_cumulative += valB;
            sumC_cumulative += valC;
        });

        console.log("Formula A (10 + 12 - 23):");
        console.log("  During 1404:", sumA_1404);
        console.log("  Cumulative up to end of 1404:", sumA_cumulative);

        console.log("\nFormula B (10 + 13 - 3 - 23):");
        console.log("  During 1404:", sumB_1404);
        console.log("  Cumulative up to end of 1404:", sumB_cumulative);

        console.log("\nFormula C (10 + 13 - 3 - 12 - 23):");
        console.log("  During 1404:", sumC_1404);
        console.log("  Cumulative up to end of 1404:", sumC_cumulative);

    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
