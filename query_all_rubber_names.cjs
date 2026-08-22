const axios = require('axios');

const url = 'http://80.210.31.176:5000/api/external/v1/query';
const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa', 'Content-Type': 'application/json' };

async function run() {
    const sql = `
        SELECT DISTINCT 
            t11.Field_005 as ItemCode,
            COALESCE(s04.Field_003, t22.Field_004, N'کالای بدون نام') as ItemName
        FROM STR_TBL_011 t11
        LEFT JOIN STR_TBL_004 s04 ON RTRIM(LTRIM(s04.Field_004)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
        WHERE (s04.Field_003 LIKE N'%لاستیک%' 
           OR t22.Field_004 LIKE N'%لاستیک%'
           OR s04.Field_003 LIKE '%rubber%'
           OR t22.Field_004 LIKE '%rubber%'
           OR t11.Field_005 LIKE '0104%')
    `;

    try {
        const response = await axios.post(url, { query: sql }, { headers });
        const rows = response.data.data || [];
        console.log("Matching rubber items found in Sayan:");
        rows.forEach(r => {
            console.log(`Code: ${r.ItemCode} - Name: ${r.ItemName}`);
        });
    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
