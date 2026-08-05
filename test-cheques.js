import fetch from 'node-fetch';
async function test() {
    const res = await fetch('http://localhost:3000/api/sayan/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'SELECT DISTINCT Field_015 as StatusDesc FROM BUR_TBL_012' })
    });
    const data = await res.json();
    console.log(data);
}
test();
