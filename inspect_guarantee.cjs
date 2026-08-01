const http = require('http');

const queryStr = `
  SELECT Field_001, Field_005, Field_006 
  FROM ACT_TBL_003 
  WHERE Field_006 LIKE N'%تضمین%' OR Field_006 LIKE N'%انتظامی%'
`;

const data = JSON.stringify({
    path: '/query',
    method: 'POST',
    body: { query: queryStr }
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/sayan-proxy',
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json', 
    'Content-Length': Buffer.byteLength(data) 
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      console.log('QueryResult:', JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('Raw output:', body);
    }
  });
});
req.on('error', err => console.error('Error:', err));
req.write(data);
req.end();
