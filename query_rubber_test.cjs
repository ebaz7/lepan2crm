const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
const url = db.settings?.sayanApiUrl || process.env.SAYAN_API_URL;
const apiKey = db.settings?.sayanApiKey || process.env.SAYAN_API_KEY;

if (!url) {
    console.error("SAYAN_API_URL is missing!");
    process.exit(1);
}
const targetUrl = `${url.replace(/\/$/, '')}/query`;

async function executeQuery(queryStr) {
    const response = await axios.post(targetUrl, { query: queryStr }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    });
    return response.data.data || [];
}

async function run() {
    console.log("Using Sayan URL:", targetUrl);
    
    // 1. Calculate rubber with from/to bounds for 1404
    const sql1404WithBounds = `
        SELECT 
            t11.Field_005 as ItemCode,
            COALESCE(s04.Field_003, t22.Field_004, N'کالای بدون نام') as ItemName,
            SUM(CASE 
                WHEN t10.Field_009 IN ('10', '13') THEN t11.Field_006 
                WHEN t10.Field_009 IN ('3', '12', '23') THEN -t11.Field_006 
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
                WHEN t10.Field_009 IN ('10', '13') THEN t11.Field_006 
                WHEN t10.Field_009 IN ('3', '12', '23') THEN -t11.Field_006 
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
        const rowsBounded = await executeQuery(sql1404WithBounds);
        console.log(rowsBounded);
        
        console.log("---- 2. CUMULATIVE 1404 (Up to 2026-03-20) ----");
        const rowsCumulative = await executeQuery(sql1404Cumulative);
        console.log(rowsCumulative);
    } catch(e) {
        console.error("Query failed:", e.message);
    }
}

run();
