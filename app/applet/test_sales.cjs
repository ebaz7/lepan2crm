const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testQuery(query) {
    try {
        const res = await fetch('http://localhost:3000/api/sayan-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: 'sql', method: 'POST', body: { query } })
        });
        const data = await res.json();
        console.log("Query:", query);
        if (Array.isArray(data)) {
            console.log("Rows:", data.length);
            if (data.length > 0) {
                console.log("First row data:", data[0]);
            }
        } else {
            console.log("Response:", data);
        }
    } catch (e) {
        console.error(e.message);
    }
}

async function run() {
    await testQuery('SELECT TOP 2 * FROM [فروش]');
    await testQuery('SELECT TOP 2 * FROM COM_TBL_001');
    await testQuery('SELECT TOP 2 * FROM STR_TBL_010');
}
run();
