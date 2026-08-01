const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `
                SELECT TOP 5 
                    Field_001 as ItemID,
                    Field_004 as SanadID,
                    Field_009 as Bed,
                    Field_010 as Bes,
                    Field_011 as Description,
                    Field_014 as Date,
                    Field_015 as TafsiliRaw
                FROM ACT_TBL_009
                WHERE Field_015 LIKE '%11:%'
            `
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("ACT_TBL_009 Statement:", res.data.data);
    } catch(e) { console.error(e.response?.data || e.message); }
}
run();
