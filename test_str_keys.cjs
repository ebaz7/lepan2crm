const axios = require('axios');

async function run() {
    const url = 'http://80.210.31.176:5000/api/external/v1/query';
    const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };

    try {
        // Check if t10.Field_005 has duplicate values across different documents
        const check05 = await axios.post(url, { 
            query: `SELECT Field_005, COUNT(*) as cnt FROM STR_TBL_010 GROUP BY Field_005 HAVING COUNT(*) > 1` 
        }, { headers });
        console.log("=== Duplicate Field_005 in STR_TBL_010 ===");
        console.log("Number of non-unique Field_005 values:", check05.data.data.length);
        if (check05.data.data.length > 0) {
            console.log("Sample duplicates:", check05.data.data.slice(0, 5));
        }

        // Check if t10.Field_001 is unique
        const check01 = await axios.post(url, { 
            query: `SELECT Field_001, COUNT(*) as cnt FROM STR_TBL_010 GROUP BY Field_001 HAVING COUNT(*) > 1` 
        }, { headers });
        console.log("=== Duplicate Field_001 in STR_TBL_010 ===");
        console.log("Number of non-unique Field_001 values:", check01.data.data.length);

        // For a specific document, show Field_001 vs Field_005 in STR_TBL_010 and how STR_TBL_011 links to it
        const sample10 = await axios.post(url, { 
            query: `SELECT TOP 5 Field_001, Field_004, Field_005, Field_006, Field_008, Field_009 FROM STR_TBL_010 WHERE Field_009 = '12' ORDER BY Field_001 DESC` 
        }, { headers });
        console.log("\n=== Latest Sales Header Documents (STR_TBL_010) ===");
        console.log(sample10.data.data);

        for (const doc of sample10.data.data) {
            const rowsBy05 = await axios.post(url, {
                query: `SELECT Field_001, Field_003, Field_004, Field_005, Field_006, Field_007, Field_036 FROM STR_TBL_011 WHERE Field_004 = '${doc.Field_005}' AND Field_003 = '${doc.Field_004}'`
            }, { headers });
            const rowsBy01 = await axios.post(url, {
                query: `SELECT Field_001, Field_003, Field_004, Field_005, Field_006, Field_007, Field_036 FROM STR_TBL_011 WHERE Field_004 = '${doc.Field_001}' AND Field_003 = '${doc.Field_004}'`
            }, { headers });
            console.log(`Doc Header Field_001=${doc.Field_001}, Field_005=${doc.Field_005}, OpCode=${doc.Field_009}:`);
            console.log(` - Rows matching Field_004 = t10.Field_005: ${rowsBy05.data.data.length}`);
            console.log(` - Rows matching Field_004 = t10.Field_001: ${rowsBy01.data.data.length}`);
        }

    } catch (e) {
        console.error(e.message);
    }
}
run();
