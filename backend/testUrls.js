const https = require('https');

const urls = [
  'https://content.fantacalcio.it/web/campioncini/small/esposito-sebastiano.png',
  'https://content.fantacalcio.it/web/campioncini/small/esposito-pio.png',
  'https://content.fantacalcio.it/web/campioncini/small/esposito-francesco-pio.png',
  'https://content.fantacalcio.it/web/campioncini/small/adams.png',
  'https://content.fantacalcio.it/web/campioncini/small/adams-che.png',
  'https://content.fantacalcio.it/web/campioncini/small/adams-c.png'
];

urls.forEach(url => {
  https.get(url, (res) => {
    console.log(`${url} -> ${res.statusCode}`);
  }).on('error', (e) => {
    console.error(e);
  });
});
