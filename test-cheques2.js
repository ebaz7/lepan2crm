import fetch from 'node-fetch';
async function test() {
    const res = await fetch('http://localhost:3000/api/sayan-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            path: '/query',
            method: 'POST',
            body: {
                query: "SELECT DISTINCT Field_015 as StatusDesc FROM BUR_TBL_012",
                parameters: []
            }
        })
    });
    const data = await res.json();
    console.log(data);
}
test();
