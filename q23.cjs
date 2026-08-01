const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `
                SELECT TOP 5 
                    t9.Field_001 as ItemID,
                    t9.Field_004 as SanadNoIn9,
                    t8.Field_006 as SanadNoIn8,
                    t8.Field_008 as DateFrom8,
                    t9.Field_014 as DateFrom9
                FROM ACT_TBL_009 t9
                LEFT JOIN ACT_TBL_008 t8 ON t9.Field_004 = t8.Field_006 AND t9.Field_003 = t8.Field_004
                WHERE t9.Field_015 LIKE '%11:112237%'
            `
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Match check:", res.data.data);
    } catch(e) { console.error(e.response?.data || e.message); }
}
run();
