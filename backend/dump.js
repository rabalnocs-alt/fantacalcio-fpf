const fs = require('fs');

async function extract() {
    const res = await fetch('https://leghe.fantacalcio.it/bundesalassa-25-26/formazioni');
    const html = await res.text();
    fs.writeFileSync('page.html', html);
    console.log("Saved page.html");
}
extract();
