const fs = require('fs');
const path = require('path');

const teamsFile = path.join(__dirname, 'data', 'teams.json');
const teams = JSON.parse(fs.readFileSync(teamsFile, 'utf8'));

const logoMap = {
    "Pertusio Club de Futbol": "https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/squadra_2025/14959577_01975842.png",
    "Salassuolo": "https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/squadra_2025/14951654_03387686.png",
    "Dinamo Zafavria": "https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/squadra_2025/14951989_0826998.png",
    "Partizan Beijing": "https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/squadra_2025/14952058_009386557.png",
    "PONTefice": "https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/squadra_2025/14952818_007149065.png",
    "Error-Systema-104": "https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/squadra_2025/14952987_01952661.png",
    "Cwtch Sporting": "https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/squadra_2025/14953197_02288477.png",
    "Al Nanoh FC": "https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/squadra_2025/14953682_03890613.png",
    "FC Aglientus": "https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/squadra_2025/14954190_02390271.png"
};

teams.forEach(team => {
    if (logoMap[team.name]) {
        team.logoUrl = logoMap[team.name];
    }
});

fs.writeFileSync(teamsFile, JSON.stringify(teams, null, 4));
console.log("Updated teams.json with logoUrls");
