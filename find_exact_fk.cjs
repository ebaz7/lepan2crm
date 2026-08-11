const axios = require('axios');

async function run() {
    const url = 'http://80.210.31.176:5000/api/external/v1/query';
    const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };

    // Get all 42 header documents in Farvardin 1405 for OpCode 12
    const resHeaders = await axios.post(url, {
        query: `
            SELECT Field_001, Field_004, Field_005, Field_006, Field_008, Field_009, Field_029, Field_037 
            FROM STR_TBL_010 
            WHERE Field_009 = '12'
              AND Field_008 >= '2026-03-21 00:00:00'
              AND Field_008 <= '2026-04-20 23:59:59'
            ORDER BY Field_001
        `
    }, { headers });

    const headersList = resHeaders.data.data;
    console.log(`Fetched ${headersList.length} header documents in Farvardin 1405.`);
    console.log("Sample Header Document 1:", headersList[0]);

    const doc1 = headersList[0];

    // Let's check STR_TBL_011 for doc1 using different potential join keys:
    // A) Field_001 in STR_TBL_011
    const t11_f1 = await axios.post(url, { query: `SELECT * FROM STR_TBL_011 WHERE Field_001 = '${doc1.Field_001}'` }, { headers });
    console.log(`\nSTR_TBL_011 rows where Field_001 = '${doc1.Field_001}': ${t11_f1.data.data.length}`);
    if (t11_f1.data.data.length > 0) console.log("Sample row:", t11_f1.data.data[0]);

    // B) Field_004 in STR_TBL_011
    const t11_f4 = await axios.post(url, { query: `SELECT * FROM STR_TBL_011 WHERE Field_004 = '${doc1.Field_005}' AND Field_003 = '${doc1.Field_004}'` }, { headers });
    console.log(`STR_TBL_011 rows where Field_004 = '${doc1.Field_005}' AND Field_003 = '${doc1.Field_004}': ${t11_f4.data.data.length}`);
    if (t11_f4.data.data.length > 0) {
        console.log("Sample rows with Field_004=", doc1.Field_005);
        t11_f4.data.data.forEach(r => console.log("   Line ID Field_001:", r.Field_001, "Header FK Field_004:", r.Field_004, "Subsys Field_003:", r.Field_003, "OpCode Field_036:", r.Field_036, "Item:", r.Field_005, "Qty:", r.Field_006));
    }

}
run();
