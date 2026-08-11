const axios = require('axios');

async function run() {
    const url = 'http://80.210.31.176:5000/api/external/v1/query';
    const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };

    try {
        const cols10 = await axios.post(url, { query: "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'STR_TBL_010'" }, { headers });
        console.log("=== STR_TBL_010 Columns ===");
        console.log(cols10.data.data);

        const cols11 = await axios.post(url, { query: "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'STR_TBL_011'" }, { headers });
        console.log("=== STR_TBL_011 Columns ===");
        console.log(cols11.data.data);

    } catch (e) {
        console.error(e.message);
    }
}
run();
