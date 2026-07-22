const http = require('http');
const data = JSON.stringify({ pin: '211287' });
const options = {
  hostname: 'localhost', port: 3000, path: '/api/login',
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
};
const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Master login:', body);
    // Test team PINs
    const pinsReq = http.request({ hostname: 'localhost', port: 3000, path: '/api/pins', method: 'GET' }, (res2) => {
      let body2 = '';
      res2.on('data', (c) => body2 += c);
      res2.on('end', () => console.log('Pins:', body2));
    });
    pinsReq.end();
  });
});
req.write(data);
req.end();
