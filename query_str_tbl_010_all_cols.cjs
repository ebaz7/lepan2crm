const axios = require('axios');
async function run() {
    const sql = `
        SELECT TOP 2 Field_001, Field_002, Field_003, Field_007 FROM STR_TBL_010 WHERE Field_009 IN ('3', '12', '23')
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Sample Rows (Field_001..007):", res.data.data);
    } catch(e) {
        console.error("Error:", e.message);
    }
}
run();
