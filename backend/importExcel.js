const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const FILE_PATH = 'C:\\Users\\Utente\\OneDrive\\MANU\\FANTA\\proposta nuova\\file excel\\con macro\\FILE ASTA.xlsm';

function importTeams() {
    try {
        console.log('Lettura file Excel in corso...');
        const wb = xlsx.readFile(FILE_PATH);
        
        // 1. Read 'tabellone amministrativo ' for team names and balances
        const tabSheet = wb.Sheets['tabellone amministrativo '];
        if (!tabSheet) {
            console.error('Foglio tabellone amministrativo non trovato!');
            return;
        }
        const tabData = xlsx.utils.sheet_to_json(tabSheet, { header: 1 });
        
        const teamsMap = new Map();
        
        // Skip header (row 0), read next 10 rows
        for (let i = 1; i <= 10; i++) {
            const row = tabData[i];
            if (!row || !row[0]) continue;
            
            const teamName = row[0].trim();
            const balance = typeof row[1] === 'number' ? row[1] : parseInt(row[1]) || 0;
            const slots = typeof row[2] === 'number' ? row[2] : parseInt(row[2]) || 30;
            
            let fascia = 1;
            if (balance >= 0) fascia = 1;
            else if (balance >= -100) fascia = 2;
            else if (balance >= -200) fascia = 3;
            else if (balance >= -300) fascia = 4;
            else if (balance >= -400) fascia = 5;
            else fascia = 6;
            
            teamsMap.set(teamName, {
                name: teamName,
                balance: balance,
                roster: [],
                fpf: {
                    fascia: fascia,
                    slot: slots,
                    label: `Fascia ${fascia}`
                }
            });
        }
        
        // 2. Read each team's sheet for their roster
        for (const [teamName, teamObj] of teamsMap.entries()) {
            // Some sheet names might have a trailing space (like 'FC Aglientus ')
            let sheetName = teamName;
            if (!wb.Sheets[sheetName]) {
                sheetName = teamName + ' '; // Try adding a space
                if (!wb.Sheets[sheetName]) {
                    console.log('Foglio non trovato per:', teamName);
                    continue;
                }
            }
            
            const teamData = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
            
            // Rosters start from row 6 (0-indexed)
            for (let i = 6; i < teamData.length; i++) {
                const row = teamData[i];
                if (!row || !row[1]) continue; // If no player name, skip
                
                const playerName = String(row[1]).trim();
                const role = row[3] ? String(row[3]).split(':')[0].trim() : '?'; // "POR: Portiere" -> "POR"
                const cost = typeof row[6] === 'number' ? row[6] : parseInt(row[6]) || 0;
                
                if (playerName) {
                    teamObj.roster.push({
                        name: playerName,
                        role: role,
                        cost: cost,
                        oldRinnovo: cost
                    });
                }
            }
        }
        
        const teamsArray = Array.from(teamsMap.values());
        fs.writeFileSync(path.join(__dirname, 'teams.json'), JSON.stringify(teamsArray, null, 2));
        console.log('✅ Importazione completata! teams.json è stato aggiornato con le rose di partenza.');
        
    } catch (err) {
        console.error('Errore durante l\'importazione:', err);
    }
}

importTeams();
