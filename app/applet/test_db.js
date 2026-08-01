const http = require('http');

const data = JSON.stringify({ query: 'SELECT Field_001, Field_004, Field_005 FROM STR_TBL_004' });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/sayan-proxy',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log(body.substring(0, 500)));
});

req.write(data);
req.end();
