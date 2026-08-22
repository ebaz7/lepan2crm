const axios = require('axios');

const url = 'http://80.210.31.176:5000/api/external/v1/query';
const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa', 'Content-Type': 'application/json' };

async function run() {
    const sql = `
        SELECT 
            SUM(CASE 
                WHEN RTRIM(LTRIM(t10.Field_009)) IN ('10', '24', '26', '29', '44', '46', '83') THEN t11.Field_006 
                WHEN RTRIM(LTRIM(t10.Field_009)) IN ('23', '25', '30', '84', '62', '68', '71', '74', '80') THEN -t11.Field_006 
                ELSE 0 
            END) as StockQty
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
        const result = response.data.data || [];
        console.log("New Formula Rubber Stock Quantity for 1404 (Bounded):");
        console.log(result[0]?.StockQty);
    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
