const axios = require('axios');
const fs = require('fs');

// Load environment variables if any
require('dotenv').config();

const db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
const url = db.settings?.sayanApiUrl || process.env.SAYAN_API_URL || "https://ais-dev-wjlf3a3s2y7mgngiaxufff-97484218589.us-east1.run.app/api/sayan-proxy"; // fallback or proxy
const key = db.settings?.sayanApiKey || process.env.SAYAN_API_KEY;

console.log("URL:", url);
console.log("Has Key:", !!key);

async function run() {
    const query = `
        SELECT TOP 10
            t11.Field_005 as ItemCode,
            COALESCE(s04.Field_003, t22.Field_004, t11.Field_005) as ItemName,
            SUM(CASE 
                WHEN RTRIM(LTRIM(t10.Field_009)) IN ('10', '13') THEN t11.Field_006 
                WHEN RTRIM(LTRIM(t10.Field_009)) IN ('3', '12', '23') THEN -t11.Field_006 
                ELSE 0 
            END) as StockQty
        FROM STR_TBL_011 t11
        INNER JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004 AND t11.Field_012 = t10.Field_018
        LEFT JOIN STR_TBL_004 s04 ON RTRIM(LTRIM(s04.Field_004)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
        GROUP BY t11.Field_005, s04.Field_003, t22.Field_004
        HAVING SUM(CASE 
            WHEN RTRIM(LTRIM(t10.Field_009)) IN ('10', '13') THEN t11.Field_006 
            WHEN RTRIM(LTRIM(t10.Field_009)) IN ('3', '12', '23') THEN -t11.Field_006 
            ELSE 0 
        END) > 0
    `;

    try {
        const response = await axios.post('http://localhost:3000/api/sayan-proxy', {
            path: '/query',
            method: 'POST',
            body: { query }
        });
        console.log("Results count:", response.data.data?.length);
        console.log("Samples:", response.data.data?.slice(0, 5));
    } catch (e) {
        console.error("Error running query:", e.response?.data || e.message);
    }
}

run();
