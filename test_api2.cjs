const axios = require('axios');

async function testApi() {
  try {
    const response = await axios.post('http://80.210.31.176:5000/api/external/v1', {
      query: 'SELECT * FROM STR_TBL_006'
    }, {
      headers: {
        'x-api-key': 's_gate_live_vgr182bwtpoa'
      }
    });
    console.log("Success POST:", response.data);
  } catch (error) {
    console.error("POST Error:", error.message);
  }
}
testApi();
