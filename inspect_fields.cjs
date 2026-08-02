const axios = require('axios');
async function run() {
    const sql = `
        SELECT TOP 10
            Field_001 as DocId,
            Field_004 as Field4,
            Field_005 as Field5,
            Field_006 as Field6,
            Field_008 as Date,
            Field_009 as OpCode
        FROM STR_TBL_010
        WHERE Field_005 <> Field_006 AND Field_008 >= '2025-03-21T00:00:00.000Z'
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Field5 <> Field6 rows:", res.data.data);
    } catch(e) {
        console.error(e.message);
    }
}
run();
