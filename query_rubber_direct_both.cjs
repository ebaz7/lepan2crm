const axios = require('axios');

const url = 'http://80.210.31.176:5000/api/external/v1/query';
const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa', 'Content-Type': 'application/json' };

async function run() {
    // 1. Calculate rubber with from/to bounds for 1404
    const sql1404WithBounds = `
        SELECT 
            t11.Field_005 as ItemCode,
            COALESCE(s04.Field_003, t22.Field_004, N'کالای بدون نام') as ItemName,
            SUM(CASE 
                WHEN RTRIM(LTRIM(t10.Field_009)) IN ('10', '13') THEN t11.Field_006 
                WHEN RTRIM(LTRIM(t10.Field_009)) IN ('3', '12', '23') THEN -t11.Field_006 
                ELSE 0 
            END) as StockQty
        FROM STR_TBL_011 t11
        INNER JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004 
                                  AND t11.Field_012 = t10.Field_018
        LEFT JOIN STR_TBL_004 s04 ON RTRIM(LTRIM(s04.Field_004)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
        WHERE t10.Field_008 >= '2025-03-21T00:00:00.000Z'
          AND t10.Field_008 <= '2026-03-20T23:59:59.000Z'
          AND t11.Field_005 LIKE '0104%'
        GROUP BY t11.Field_005, s04.Field_003, t22.Field_004
    `;

    // 2. Calculate rubber without from bounds (cumulative from beginning of time) up to 2026-03-20
    const sql1404Cumulative = `
        SELECT 
            t11.Field_005 as ItemCode,
            COALESCE(s04.Field_003, t22.Field_004, N'کالای بدون نام') as ItemName,
            SUM(CASE 
                WHEN RTRIM(LTRIM(t10.Field_009)) IN ('10', '13') THEN t11.Field_006 
                WHEN RTRIM(LTRIM(t10.Field_009)) IN ('3', '12', '23') THEN -t11.Field_006 
                ELSE 0 
            END) as StockQty
        FROM STR_TBL_011 t11
        INNER JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004 
                                  AND t11.Field_012 = t10.Field_018
        LEFT JOIN STR_TBL_004 s04 ON RTRIM(LTRIM(s04.Field_004)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
        WHERE t10.Field_008 <= '2026-03-20T23:59:59.000Z'
          AND t11.Field_005 LIKE '0104%'
        GROUP BY t11.Field_005, s04.Field_003, t22.Field_004
    `;

    try {
        console.log("---- 1. BOUNDED 1404 (2025-03-21 to 2026-03-20) ----");
        const resBounded = await axios.post(url, { query: sql1404WithBounds }, { headers });
        const rowsBounded = resBounded.data.data || [];
        console.log("Bounded Rows Count:", rowsBounded.length);
        console.log("Bounded Rows Sum:", rowsBounded.reduce((acc, r) => acc + (r.StockQty || 0), 0));
        console.log("Bounded Rows Details:", rowsBounded);
        
        console.log("\n---- 2. CUMULATIVE 1404 (Up to 2026-03-20) ----");
        const resCumulative = await axios.post(url, { query: sql1404Cumulative }, { headers });
        const rowsCumulative = resCumulative.data.data || [];
        console.log("Cumulative Rows Count:", rowsCumulative.length);
        console.log("Cumulative Rows Sum:", rowsCumulative.reduce((acc, r) => acc + (r.StockQty || 0), 0));
        console.log("Cumulative Rows Details:", rowsCumulative);
    } catch(e) {
        console.error("Query failed:", e.message);
    }
}

run();
