const axios = require('axios');
async function run() {
    const sql = `
        SELECT 
            t11.Field_005 as ItemCode,
            t11.Field_006 as Quantity,
            t11.Field_031 as ItemNotes,
            t11.Field_037 as Amount
        FROM STR_TBL_011 t11
        WHERE t11.Field_004 = '438' AND t11.Field_003 = '4'
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        if (res.data.data) {
            console.log("Invoice 438 rows:");
            res.data.data.forEach((r, idx) => {
                if (r.ItemNotes && (r.ItemNotes.includes('فی') || r.ItemNotes.includes('تخفیف') || r.ItemNotes.includes('ارزش افزوده'))) {
                    console.log(`Row ${idx+1}: Item: ${r.ItemCode}, Qty: ${r.Quantity}, Amt: ${r.Amount}, Notes: ${r.ItemNotes}`);
                }
            });
        }
    } catch(e) {
        console.error("Error:", e.message);
    }
}
run();
