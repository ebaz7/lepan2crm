const axios = require('axios');

async function run() {
    const url = 'http://80.210.31.176:5000/api/external/v1/query';
    const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };

    try {
        // Query 1 header from STR_TBL_010
        const resH = await axios.post(url, {
            query: "SELECT TOP 1 * FROM STR_TBL_010 WHERE Field_009 = '12' AND Field_008 >= '2026-03-21 00:00:00' AND Field_008 <= '2026-04-20 23:59:59' ORDER BY Field_001"
        }, { headers });

        const h = resH.data.data[0];
        console.log("=== HEADER ROW ===");
        console.log(h);

        // Query all STR_TBL_011 rows where Field_004 = h.Field_005 (which is '3' or similar)
        const resD = await axios.post(url, {
            query: `SELECT * FROM STR_TBL_011 WHERE Field_004 = '${h.Field_005}' AND Field_003 = '${h.Field_004}'`
        }, { headers });

        console.log(`\n=== DETAIL ROWS matching Field_004='${h.Field_005}' and Field_003='${h.Field_004}' (${resD.data.data.length} rows) ===`);
        
        // Find which detail rows actually belong to THIS header document h!
        // Notice in detail row: Field_010 is formatted like "4-2-3-2269011" or "4-3-1-2268811" or "4-4-3-2267460"
        // Let's check Field_010, Field_012, Field_018, Field_034, Field_036, Field_037, Field_038 in STR_TBL_011 vs STR_TBL_010!
        resD.data.data.forEach(d => {
            console.log(`Detail Line PK (Field_001): ${d.Field_001} | SubSys(003): ${d.Field_003} | HeaderFK(004): ${d.Field_004} | Field_010: ${d.Field_010} | Field_012: ${d.Field_012} | Field_018: ${d.Field_018} | Field_034: ${d.Field_034} | Field_036: ${d.Field_036} | Item: ${d.Field_005} | Qty: ${d.Field_006} | Amt: ${d.Field_007}`);
        });

    } catch (e) {
        console.error(e.message);
    }
}
run();
