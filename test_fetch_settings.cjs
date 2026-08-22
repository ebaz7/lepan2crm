const axios = require('axios');

async function test() {
    const urls = [
        "http://localhost:3000/api/settings",
        "https://ais-dev-wjlf3a3s2y7mgngiaxufff-97484218589.us-east1.run.app/api/settings",
        "https://ais-pre-wjlf3a3s2y7mgngiaxufff-97484218589.us-east1.run.app/api/settings"
    ];

    for (const url of urls) {
        try {
            console.log("Fetching:", url);
            const res = await axios.get(url, { timeout: 5000 });
            console.log("Success! Data keys:", Object.keys(res.data));
            if (res.data.settings) {
                console.log("Settings keys:", Object.keys(res.data.settings));
                if (res.data.settings.sayanApiUrl) {
                    console.log("FOUND SayanApiUrl:", res.data.settings.sayanApiUrl);
                    console.log("FOUND SayanApiKey:", res.data.settings.sayanApiKey ? "YES" : "NO");
                }
            }
        } catch (e) {
            console.error("Failed:", url, e.message);
        }
    }
}

test();
