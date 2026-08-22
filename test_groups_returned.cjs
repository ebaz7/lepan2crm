const axios = require('axios');
async function run() {
  try {
    const res = await axios.get('http://localhost:3000/api/sayan/warehouse-inventory');
    if (res.data.success) {
      const { lastYearStock, currentStock } = res.data;
      console.log("Total lastYearStock items:", lastYearStock.length);
      console.log("Total currentStock items:", currentStock.length);
      
      const sampleYarnLastYear = lastYearStock.filter(r => String(r.ItemCode || r.itemCode).startsWith('04')).slice(0, 5);
      const sampleYarnCurrent = currentStock.filter(r => String(r.ItemCode || r.itemCode).startsWith('04')).slice(0, 5);
      
      console.log("Sample Yarn Last Year:", JSON.stringify(sampleYarnLastYear, null, 2));
      console.log("Sample Yarn Current:", JSON.stringify(sampleYarnCurrent, null, 2));
    } else {
      console.log("Failed to fetch:", res.data.message);
    }
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
