const axios = require('axios');
async function run() {
  try {
    const q = "SELECT COUNT(*) as c FROM STR_TBL_011 WHERE Field_031 LIKE N'%تعداد کارتن:%'";
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: q }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } });
    console.log("Rows with 'تعداد کارتن:':", res.data.data);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
