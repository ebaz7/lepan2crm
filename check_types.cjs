fetch('http://localhost:3000/api/sayan-proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ path: 'sql', method: 'POST', body: { query: 'SELECT Field_004, COUNT(*) as cnt, SUM(CAST(Field_025 AS FLOAT)) as total FROM BUR_TBL_008 GROUP BY Field_004' } })
}).then(r => r.text()).then(console.log);
