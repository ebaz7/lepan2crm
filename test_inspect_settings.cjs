const axios = require('axios');

async function test() {
    try {
        const url = "https://ais-dev-wjlf3a3s2y7mgngiaxufff-97484218589.us-east1.run.app/api/settings";
        const res = await axios.get(url);
        const data = res.data;
        console.log("Is array:", Array.isArray(data));
        console.log("Length:", data.length);
        if (Array.isArray(data) && data.length > 0) {
            console.log("First item:", JSON.stringify(data[0]).substring(0, 500));
        } else {
            console.log("Object keys:", Object.keys(data));
            console.log("Data sample:", JSON.stringify(data).substring(0, 500));
        }
    } catch (e) {
        console.error(e.message);
    }
}

test();
