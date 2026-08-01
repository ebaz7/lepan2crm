const axios = require('axios');

async function testApi() {
  try {
    const response = await axios.post('http://80.210.31.176:5000/api/external/v1', {
      query: 'SELECT * FROM STR_TBL_006'
    }, {
      headers: {
        'Authorization': 'Bearer s_gate_live_vgr182bwtpoa'
      }
    });
    console.log("Success:", response.data.slice(0, 5));
  } catch (error) {
    console.error("Error:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
  }
}
testApi();
