const http = require('http');

// Let's find all rows in ACT_TBL_009 containing '2447'
const queryStr = `
  SELECT TOP 50 
    t9.Field_001, 
    t9.Field_003, 
    t9.Field_004, 
    t9.Field_005, 
    t9.Field_006, 
    t9.Field_007, 
    t9.Field_008, 
    t9.Field_009, 
    t9.Field_010, 
    t9.Field_011, 
    t9.Field_014, 
    t9.Field_015,
    t8.Field_008 as DocDate
  FROM ACT_TBL_009 t9
  LEFT JOIN ACT_TBL_008 t8 ON t9.Field_004 = t8.Field_006 AND t9.Field_003 = t8.Field_004
  WHERE t9.Field_015 LIKE '%2447%'
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
