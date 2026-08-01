const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/settings',
  method: 'GET'
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      console.log('Settings:', JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('Raw output:', body);
    }
  });
});
req.on('error', err => console.error('Error:', err));
req.end();
