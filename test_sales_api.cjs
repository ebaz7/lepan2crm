const axios = require('axios');
async function run() {
  try {
    const res = await axios.post('http://localhost:3000/api/sayan/sales-report/send-manual', { targetDate: 'today' });
    console.log(res.data);
  } catch (e) {
    console.log(e.response ? e.response.data : e.message);
  }
}
run();
