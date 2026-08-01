fetch('http://localhost:3000/api/sayan-proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: "SELECT TOP 1 * FROM STR_TBL_008" })
})
.then(res => res.json())
.then(data => console.log('STR_TBL_008 (Products):', JSON.stringify(data, null, 2)))
.catch(err => console.error(err));
