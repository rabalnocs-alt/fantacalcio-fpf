const fs = require('fs');

async function extract() {
    const res = await fetch('https://leghe.fantacalcio.it/bundesalassa-25-26/formazioni');
    const html = await res.text();
    
    // We can use regex to find the teams in the HTML
    // Usually they are in a dropdown or list of teams:
    // <img src="https://...squadra_2025/..." alt="Team Name" />
    
    const regex = /<img[^>]*src="([^"]*squadra_\d+[^"]*)"[^>]*alt="([^"]+)"/ig;
    const teamsMap = new Map();
    let match;
    while ((match = regex.exec(html)) !== null) {
        const logoUrl = match[1];
        const teamName = match[2];
        if (!teamsMap.has(teamName)) {
            teamsMap.set(teamName, logoUrl);
        }
    }
    
    // Sometimes alt might be empty or different. Let's see if we found any:
    console.log("Teams found with regex 1:", teamsMap.size);
    if (teamsMap.size > 0) {
        for (let [name, url] of teamsMap) {
            console.log(`- ${name}: ${url}`);
        }
    } else {
        // Fallback: look for <span class="team-name">...</span>
        // or just match all team names if they are printed in a JS object
        const jsRegex = /"squadre":\[(.*?)\]/i;
        const jsMatch = jsRegex.exec(html);
        if (jsMatch) {
            console.log("Found JS array of squadre, but it might not have names...");
        }
    }
}
extract();
