const axios = require('axios');
async function run() {
    for(let i=1; i<=30; i++) {
        let t = i < 10 ? '0' + i : '' + i;
        try {
            const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
                query: `SELECT * FROM STR_TBL_0${t} WHERE Field_004 = '415182' OR Field_003 = '415182'`
            }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
            if (res.data.data && res.data.data.length > 0) console.log("STR_TBL_0"+t, res.data.data.slice(0,1));
        } catch(e) { }
    }
}
run();
