fetch('http://localhost:3000/api/sayan-proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ path: 'sql', method: 'POST', body: { query: 'SELECT TOP 10 * FROM ACT_TBL_004' } })
}).then(r => r.text()).then(d => console.log(d));
