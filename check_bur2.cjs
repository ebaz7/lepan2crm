const fetch = require('node-fetch');
fetch('http://localhost:3000/api/sayan-proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ path: 'sql', method: 'POST', body: { query: 'SELECT TOP 10 Field_004, Field_010, Field_011, Field_025, Field_008 FROM BUR_TBL_008' } })
}).then(r => r.text()).then(d => console.log('RESPONSE:', d)).catch(console.error);
