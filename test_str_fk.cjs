const axios = require('axios');

async function run() {
    const url = 'http://80.210.31.176:5000/api/external/v1/query';
    const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };

    // 1. Inspect top rows of STR_TBL_010 and STR_TBL_011 to see primary keys & foreign keys
    try {
        const res10 = await axios.post(url, { query: "SELECT TOP 3 * FROM STR_TBL_010 WHERE Field_009 = '12'" }, { headers });
        console.log("=== STR_TBL_010 Sample ===");
        console.log(res10.data.data);

        const doc10 = res10.data.data[0];
        console.log("Header DocId (Field_001):", doc10.Field_001, "Field_002:", doc10.Field_002, "Field_003:", doc10.Field_003, "Field_004:", doc10.Field_004, "Field_005:", doc10.Field_005);

        // Find matching rows in STR_TBL_011 for this specific header!
        const res11_all = await axios.post(url, { 
            query: `SELECT TOP 10 * FROM STR_TBL_011 WHERE Field_004 = '${doc10.Field_005}' AND Field_003 = '${doc10.Field_004}'` 
        }, { headers });
        console.log(`\n=== STR_TBL_011 matching Field_004='${doc10.Field_005}' AND Field_003='${doc10.Field_004}' ===`);
        console.log("Count returned by current join (without DocId match):", res11_all.data.data.length);

        // How does STR_TBL_011 link back to STR_TBL_010.Field_001 or Field_005/Field_002/Field_006?
        const res11_exact = await axios.post(url, { 
            query: `SELECT * FROM STR_TBL_011 WHERE Field_001 = '${doc10.Field_001}' OR Field_002 = '${doc10.Field_001}' OR Field_001 = '${doc10.Field_005}'` 
        }, { headers });
        console.log("\n=== STR_TBL_011 matching exact header keys ===");
        console.log(res11_exact.data.data);

    } catch (e) {
        console.error(e.message);
    }
}
run();
