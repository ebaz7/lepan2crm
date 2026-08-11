const axios = require('axios');

async function run() {
    const url = 'http://80.210.31.176:5000/api/external/v1/query';
    const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };

    try {
        // Fetch 5 headers for Farvardin 1405
        const resH = await axios.post(url, {
            query: `
                SELECT TOP 5 Field_001, Field_004, Field_005, Field_006, Field_008, Field_009, Field_026, Field_037 
                FROM STR_TBL_010 
                WHERE Field_009 = '12'
                  AND Field_008 >= '2026-03-21 00:00:00'
                  AND Field_008 <= '2026-04-20 23:59:59'
                ORDER BY Field_001
            `
        }, { headers });

        const headersList = resH.data.data;
        console.log("Headers:");
        headersList.forEach(h => console.log(`Header DocId (Field_001): ${h.Field_001}, SubSystem (Field_004): ${h.Field_004}, DocNum (Field_005): ${h.Field_005}, Serial (Field_006): ${h.Field_006}, Payable: ${h.Field_037}`));

        // Search STR_TBL_011 for any rows that contain Field_001 value (e.g. '479333') in ANY string or number column!
        const h0 = headersList[0]; // e.g. 479333
        const matchCol = await axios.post(url, {
            query: `
                SELECT TOP 10 * FROM STR_TBL_011 
                WHERE Field_001 = '${h0.Field_001}'
                   OR Field_003 = '${h0.Field_001}'
                   OR Field_004 = '${h0.Field_001}'
                   OR Field_008 = '${h0.Field_001}'
                   OR Field_010 LIKE '%${h0.Field_001}%'
                   OR Field_013 = '${h0.Field_001}'
                   OR Field_018 = '${h0.Field_001}'
                   OR Field_037 = '${h0.Field_001}'
                   OR Field_038 = '${h0.Field_001}'
            `
        }, { headers });

        console.log(`\nDirect match in STR_TBL_011 for Header Field_001='${h0.Field_001}':`);
        console.log("Count:", matchCol.data.data.length);

        // Let's also check if Field_004 in STR_TBL_011 is DocNum (Field_005 in STR_TBL_010) AND what else distinguishes it!
        // Is Fiscal Year / Store / SubSystem part of the composite primary key in STR_TBL_010?
        // Let's check STR_TBL_010 columns again!
        const cols10All = await axios.post(url, {
            query: `SELECT * FROM STR_TBL_010 WHERE Field_001 = '${h0.Field_001}'`
        }, { headers });
        console.log(`\nALL columns of Header Document '${h0.Field_001}':`);
        console.log(cols10All.data.data[0]);

    } catch (e) {
        console.error(e.message);
    }
}
run();
