fetch('http://localhost:3000/api/sayan-proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ path: 'sql', method: 'POST', body: { query: 'SELECT DISTINCT Field_004, Field_003 FROM BUR_TBL_008' } })
}).then(r => r.json()).then(console.log);
