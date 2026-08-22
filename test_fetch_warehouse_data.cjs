const axios = require('axios');

async function test() {
    try {
        const url = "http://localhost:3000/api/warehouse-overview/data";
        const res = await axios.get(url);
        console.log("Success! Data keys:", Object.keys(res.data));
        console.log("Full data:", JSON.stringify(res.data));
    } catch (e) {
        console.error("Failed:", e.message);
    }
}

test();
