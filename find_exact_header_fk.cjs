const axios = require('axios');

async function run() {
    const url = 'http://80.210.31.176:5000/api/external/v1/query';
    const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };

    try {
        // Fetch 1 header document
        const hRes = await axios.post(url, { query: "SELECT * FROM STR_TBL_010 WHERE Field_001 = '479333'" }, { headers });
        const h = hRes.data.data[0];
        console.log("Header Document '479333':");
        console.log(h);

        // Fetch detail lines in STR_TBL_011 that belong to header 479333.
        // Let's search STR_TBL_011 for any column that contains '479333' or matches header keys
        const dAll = await axios.post(url, { 
            query: `SELECT TOP 20 * FROM STR_TBL_011 WHERE Field_004 = '${h.Field_005}' AND Field_003 = '${h.Field_004}'` 
        }, { headers });
        
        console.log("\nInspecting candidate detail rows in STR_TBL_011:");
        dAll.data.data.forEach((row, idx) => {
            console.log(`Row ${idx}:`, JSON.stringify(row));
        });

    } catch (e) {
        console.error(e.message);
    }
}
run();
