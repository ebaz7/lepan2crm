const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `
                SELECT TOP 5 
                    t9.Field_001 as ItemID,
                    t9.Field_004 as SanadID,
                    t10.Field_001 as T10ID,
                    t10.Field_006 as SanadNo
                FROM ACT_TBL_009 t9
                LEFT JOIN ACT_TBL_010 t10 ON t9.Field_004 = t10.Field_001
                WHERE t9.Field_015 LIKE '%11:112237%'
            `
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Statement with join t10:", res.data.data);
    } catch(e) { console.error(e.response?.data || e.message); }
}
run();
