fetch('http://localhost:3000/api/sayan-proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ path: 'sql', method: 'POST', body: { query: 'SELECT TOP 1 * FROM ACT_TBL_003' } })
}).then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2)));
