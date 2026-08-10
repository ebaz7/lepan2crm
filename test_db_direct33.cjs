const axios = require('axios');
async function run() {
  const query = `
    SELECT 
      t10.Field_001, t10.Field_006, t10.Field_009, t10.Field_010, t10.Field_014, t10.Field_015, t10.Field_016, t10.Field_017, t10.Field_018, t10.Field_019, t10.Field_020, t10.Field_021, t10.Field_023, t10.Field_024, t10.Field_025, t10.Field_026, t10.Field_027, t10.Field_028, t10.Field_030, t10.Field_031, t10.Field_032, t10.Field_033, t10.Field_034, t10.Field_036, t10.Field_037, t10.Field_038, t10.Field_039, t10.Field_040, t10.Field_041
    FROM STR_TBL_010 t10
    WHERE t10.Field_001 IN ('433091', '435193', '441022')
  `;
  try {
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query }, {
        headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
    });
    console.log(res.data.data);
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
run();
