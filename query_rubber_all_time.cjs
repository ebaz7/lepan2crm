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
        WHERE t11.Field_005 LIKE '0104%'
    `;

    try {
        const response = await axios.post(url, { query: sql }, { headers });
        const rows = response.data.data || [];
        console.log("Total rows found all-time:", rows.length);
        
        const sumByDocType = {};
        rows.forEach(r => {
            const dt = r.DocType || 'UNKNOWN';
            const qty = parseFloat(r.Quantity) || 0;
            sumByDocType[dt] = (sumByDocType[dt] || 0) + qty;
        });
        
        console.log("Sums by DocType all-time:");
        console.log(sumByDocType);

    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
