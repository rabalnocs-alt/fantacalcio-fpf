const https = require('https');

const urls = [
  'https://content.fantacalcio.it/web/campioncini/small/barella.png',
  'https://content.fantacalcio.it/web/campioncini/large/barella.png',
  'https://content.fantacalcio.it/web/campioncini/card/barella.png',
  'https://content.fantacalcio.it/web/campioncini/barella.png',
  'https://content.fantacalcio.it/web/calciatori/small/barella.png'
];

urls.forEach(url => {
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Referer': 'https://leghe.fantacalcio.it/', 'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' } }, (res) => {
    console.log(`${url} -> ${res.statusCode}`);
  }).on('error', (e) => {
    console.error(e);
  });
});
