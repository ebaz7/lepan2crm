const http = require('http');
const data = JSON.stringify({ query: "SELECT * FROM STR_TBL_011 WHERE Field_004 = '420981'" });
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/sayan-proxy',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
};
const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log(JSON.stringify(JSON.parse(body), null, 2)));
});
req.write(data);
req.end();
