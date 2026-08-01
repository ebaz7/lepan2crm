fetch('http://localhost:3000/api/sayan-proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    path: 'sql', 
    method: 'POST', 
    body: { query: 'SELECT TOP 10 Field_008 as [Date], Field_025 as [F25], Field_010 as [F10], Field_011 as [F11], Field_004 as [Type] FROM BUR_TBL_008' } 
  })
}).then(r => r.text()).then(console.log);
