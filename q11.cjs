const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `
                SELECT 
                    Field_010 as TafsiliRaw,
                    Field_014 as TafsiliTitle,
                    SUM(CAST(Field_006 AS FLOAT)) as TotalBed,
                    SUM(CAST(Field_007 AS FLOAT)) as TotalBes
                FROM ACT_TBL_024
                WHERE Field_010 LIKE '11:%'
                GROUP BY Field_010, Field_014
                ORDER BY TotalBed DESC
            `
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("ACT_TBL_024 grouped:", res.data.data.slice(0, 10));
    } catch(e) { console.error(e.response?.data || e.message); }
}
run();
