require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fpf = require('./fpfCalculator');
const db = require('./db');
const path = require('path');
const multer = require('multer');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const os = require('os');
const fs = require('fs');

const app = express();

const corsOptions = {
  origin: process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== '*' 
    ? process.env.CORS_ORIGIN.split(',') 
    : true,
  methods: ['GET', 'POST'],
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Setup multer for CSV uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: 'uploads/' });

// In-memory state for now
let teams = [];
let listonePlayers = [];
let transactions = [];
let config = {};
let auctionState = {
  status: 'IDLE', // IDLE, ACTIVE (Timer), BIVIO (Tengo/Vendo), ASSIGNED
  currentPlayer: null, // { name, role, oldRinnovo, currentOwner, stats, imgUrl }
  currentBid: 0,
  currentBidder: null,
  timerSeconds: 0
};

async function logTransaction(type, player, oldOwner, newOwner, price) {
  transactions.unshift({
    id: Date.now(),
    type,
    player,
    oldOwner,
    newOwner,
    price,
    timestamp: new Date().toISOString()
  });
  await db.saveTransactions(transactions);
  io.emit('transactions_update', transactions);
}

// Timer Logic
let auctionInterval = null;

function stopTimer() {
  if (auctionInterval) clearInterval(auctionInterval);
}

function startTimer(seconds, newStatus = 'ACTIVE') {
  stopTimer();
  auctionState.timerSeconds = seconds;
  auctionState.status = newStatus;
  
  // Save state but don't await blocking
  db.saveAuction(auctionState).catch(console.error);
  
  auctionInterval = setInterval(() => {
    auctionState.timerSeconds--;
    io.emit('auction_update', auctionState);

    // Save state on interval tick (optional, could be noisy, but keeps in sync if crash)
    // db.saveAuction(auctionState).catch(console.error);

    if (auctionState.timerSeconds <= 0) {
      stopTimer();
      resolveAuction();
    }
  }, 1000);
}

async function resolveAuction() {
  const isFreeAgent = !auctionState.currentPlayer.currentOwner;
  if (isFreeAgent) {
    if (auctionState.currentBidder) {
      auctionState.status = 'ASSIGNED';
      auctionState.lastDecision = 'ACQUISTO';
      assignPlayerToWinner(auctionState.currentBidder, auctionState.currentBid);
      logTransaction('ACQUISTO', auctionState.currentPlayer, null, auctionState.currentBidder, auctionState.currentBid);
    } else {
      auctionState.status = 'ASSIGNED';
      auctionState.lastDecision = 'UNSOLD';
    }
  } else {
    if (auctionState.currentBidder) {
      auctionState.status = 'BIVIO'; // Original owner must choose
      startTimer(60, 'BIVIO'); // Auto start the 60 seconds timer
    } else {
      auctionState.status = 'ASSIGNED';
      auctionState.lastDecision = 'UNSOLD';
    }
  }
  
  await db.saveAuction(auctionState);
  await db.saveTeams(teams);
  
  io.emit('auction_update', auctionState);
  io.emit('teams_update', teams);
}

function assignPlayerToWinner(teamName, price) {
  const team = teams.find(t => t.name === teamName);
  if(team) {
    team.balance -= price;
    team.fpf = fpf.getFpfTierInfo(team.balance);
    team.roster.push({
      name: auctionState.currentPlayer.name,
      role: auctionState.currentPlayer.role,
      cost: price
    });
    
    // Remove from old owner if they had the player
    const oldOwnerName = auctionState.currentPlayer.currentOwner;
    if (oldOwnerName && oldOwnerName !== teamName) {
      const oldTeam = teams.find(t => t.name === oldOwnerName);
      if (oldTeam) {
        oldTeam.roster = oldTeam.roster.filter(p => p.name !== auctionState.currentPlayer.name);
      }
    }
  }
}

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  socket.emit('teams_update', teams);
  socket.emit('auction_update', auctionState);
  socket.emit('players_list', listonePlayers);
  socket.emit('transactions_update', transactions);

  socket.on('start_auction', async (player) => {
    if (!player || !player.name) return; // Previene crash
    // Cerca se il giocatore appartiene già a qualcuno (per il bivio)
    let foundOwner = null;
    let foundCost = 0;
    teams.forEach(t => {
      const p = t.roster.find(r => {
        if (!r.name) return false;
        const rName = String(r.name).toLowerCase().trim();
        const pName = String(player.name).toLowerCase().trim();
        return rName === pName;
      });
      if (p) {
        foundOwner = t.name;
        foundCost = p.oldRinnovo || p.cost || 0;
      }
    });

    auctionState = {
      status: 'WAITING', // IDLE, WAITING, ACTIVE, BIVIO, ASSIGNED
      currentPlayer: {
        ...player,
        currentOwner: foundOwner,
        oldRinnovo: foundCost
      },
      currentBid: 0,
      currentBidder: null,
      timerSeconds: 10
    };
    stopTimer();
    
    await db.saveAuction(auctionState);
    io.emit('auction_update', auctionState);
  });

  socket.on('start_initial_timer', async () => {
    if (auctionState.status === 'WAITING') {
      startTimer(10);
      io.emit('auction_update', auctionState);
    }
  });

  socket.on('place_bid', async ({ teamName, amount }) => {
    const biddingTeam = teams.find(t => t.name === teamName);
    if (!biddingTeam) return;

    // Owner cannot bid on their own player
    if (auctionState.currentPlayer?.currentOwner === teamName) {
      return;
    }

    // Check slots: prevent bidding if roster is full
    const maxSlots = biddingTeam.fpf?.slot || 25;
    if (biddingTeam.roster.length >= maxSlots) {
      return; // Block bid
    }

    if (amount > auctionState.currentBid) {
      auctionState.currentBid = amount;
      auctionState.currentBidder = teamName;
      startTimer(10); // Restart 10s timer
      await db.saveAuction(auctionState);
      io.emit('auction_update', auctionState);
    }
  });
  
  socket.on('start_bivio_timer', async () => {
    if (auctionState.status === 'BIVIO') {
      startTimer(60, 'BIVIO'); // 60 seconds pressure timer
      await db.saveAuction(auctionState);
      io.emit('auction_update', auctionState);
    }
  });

  socket.on('bivio_decision', async ({ option }) => {
    // option: 'PROTEGGI' or 'VENDI'
    if (auctionState.status !== 'BIVIO') return;
    stopTimer();

    const ownerTeam = teams.find(t => t.name === auctionState.currentPlayer.currentOwner);
    
    if (option === 'PROTEGGI') {
      const newBalance = fpf.calculateFpfImpact(ownerTeam.balance, 'PROTEGGI', auctionState.currentBid);
      ownerTeam.balance = newBalance;
      ownerTeam.roster = ownerTeam.roster.filter(p => p.name !== auctionState.currentPlayer.name);
      const discounted = fpf.getDiscountedPrice(auctionState.currentBid);
      ownerTeam.roster.push({
        name: auctionState.currentPlayer.name,
        role: auctionState.currentPlayer.role,
        cost: discounted
      });
      logTransaction('TENUTO', auctionState.currentPlayer, ownerTeam.name, ownerTeam.name, discounted);
    } else if (option === 'VENDI') {
      const newBalance = fpf.calculateFpfImpact(ownerTeam.balance, 'VENDI', auctionState.currentBid);
      ownerTeam.balance = newBalance;
      assignPlayerToWinner(auctionState.currentBidder, auctionState.currentBid);
      logTransaction('VENDUTO', auctionState.currentPlayer, ownerTeam.name, auctionState.currentBidder, auctionState.currentBid);
    }
    
    ownerTeam.fpf = fpf.getFpfTierInfo(ownerTeam.balance);
    auctionState.status = 'ASSIGNED';
    auctionState.lastDecision = option;
    
    await db.saveAuction(auctionState);
    await db.saveTeams(teams);
    
    io.emit('auction_update', auctionState);
    io.emit('teams_update', teams);
  });
  
  socket.on('reset_auction', async () => {
    stopTimer();
    auctionState = { status: 'IDLE', currentPlayer: null, currentBid: 0, currentBidder: null, timerSeconds: 0 };
    await db.saveAuction(auctionState);
    io.emit('auction_update', auctionState);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// REST APIs
// Endpoint to get local network IP for mobile connections
app.get('/api/network-info', (req, res) => {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  res.json({ ips: results });
});

// Login API
app.post('/api/login', (req, res) => {
  const { pin } = req.body;
  if (!pin) {
    return res.json({ success: false, error: 'PIN richiesto' });
  }
  if (pin === config.masterCode) {
    return res.json({ success: true, role: 'master', teamName: null });
  }
  
  let userTeam = null;
  for (const [teamName, teamPin] of Object.entries(config.pins || {})) {
    if (teamPin === pin) {
      userTeam = teamName;
      break;
    }
  }
  
  if (userTeam) {
    return res.json({ success: true, role: 'participant', teamName: userTeam });
  }
  
  return res.json({ success: false, error: 'PIN non valido' });
});

// PINs management APIs
app.get('/api/pins', (req, res) => {
  res.json({ pins: config.pins || {} });
});

app.post('/api/pins', async (req, res) => {
  const { pins } = req.body;
  if (pins) {
    config.pins = pins;
    await db.saveConfig(config);
    res.json({ success: true, pins: config.pins });
  } else {
    res.status(400).json({ error: 'Missing pins data' });
  }
});

app.post('/api/upload-listone', upload.single('file'), async (req, res) => {
  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Skip header rows if necessary. Fantacalcio listone usually has 1 header row.
    const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    // Find header row (the one containing 'Nome')
    let headerIdx = rawData.findIndex(row => row && row.some(cell => typeof cell === 'string' && cell.trim().toUpperCase() === 'NOME'));
    if (headerIdx === -1) headerIdx = 0;
    
    let headers = rawData[headerIdx].map(h => typeof h === 'string' ? h.toLowerCase().trim() : '');
    let nomeIdx = headers.indexOf('nome');
    if (nomeIdx === -1) nomeIdx = headers.findIndex(h => h.includes('nome'));
    
    let ruolIdx = headers.indexOf('rm');
    if (ruolIdx === -1) ruolIdx = headers.indexOf('ruolo mantra');
    if (ruolIdx === -1) ruolIdx = headers.indexOf('r'); // classic fallback
    if (ruolIdx === -1) ruolIdx = headers.findIndex(h => h.includes('ruolo'));

    let qtIdx = headers.indexOf('qt. a');
    if (qtIdx === -1) qtIdx = headers.indexOf('quotazione');
    if (qtIdx === -1) qtIdx = headers.indexOf('fvm');
    if (qtIdx === -1) qtIdx = headers.findIndex(h => h.includes('qt') || h.includes('quotazione') || h.includes('fvm'));

    const results = rawData.slice(headerIdx + 1)
      .filter(row => row && row[nomeIdx] && String(row[nomeIdx]).trim() !== '' && String(row[nomeIdx]).trim().toUpperCase() !== 'NOME')
      .map(row => ({
        Nome: String(row[nomeIdx]).trim(),
        Ruolo: ruolIdx !== -1 && row[ruolIdx] ? String(row[ruolIdx]).trim() : '',
        Quotazione: parseInt(row[qtIdx]) || 1
      }));

    fs.unlinkSync(req.file.path);
    
    listonePlayers = results;
    await db.saveListone(listonePlayers);
    io.emit('players_list', listonePlayers);
    res.json({ success: true, count: results.length });
  } catch (error) {
    console.error('Error parsing Listone:', error);
    res.status(500).json({ success: false, error: 'File parsing error' });
  }
});

app.post('/api/upload-stats', upload.single('file'), async (req, res) => {
  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    let headerIdx = rawData.findIndex(row => row && row.some(cell => typeof cell === 'string' && cell.trim().toUpperCase() === 'NOME'));
    if (headerIdx === -1) headerIdx = 0;
    
    let headers = rawData[headerIdx].map(h => typeof h === 'string' ? h.toLowerCase().trim() : '');
    let nomeIdx = headers.indexOf('nome');
    if (nomeIdx === -1) nomeIdx = headers.findIndex(h => h.includes('nome'));
    
    let fmIdx = headers.indexOf('fm');
    if (fmIdx === -1) fmIdx = headers.indexOf('fvm');
    
    let golIdx = headers.indexOf('gf');
    if (golIdx === -1) golIdx = headers.indexOf('gol');
    if (golIdx === -1) golIdx = headers.findIndex(h => h === 'g');
    
    let assIdx = headers.indexOf('ass');
    if (assIdx === -1) assIdx = headers.indexOf('assist');

    let statsUpdated = 0;
    rawData.slice(headerIdx + 1).forEach(row => {
      if (row && row[nomeIdx]) {
        const pName = String(row[nomeIdx]).trim();
        const p = listonePlayers.find(pl => pl.Nome === pName);
        if (p) {
          p.FM = fmIdx !== -1 ? parseFloat(String(row[fmIdx]).replace(',','.')) || 0 : 0;
          p.GOL = golIdx !== -1 ? parseInt(row[golIdx]) || 0 : 0;
          p.ASS = assIdx !== -1 ? parseInt(row[assIdx]) || 0 : 0;
          statsUpdated++;
        }
      }
    });

    fs.unlinkSync(req.file.path);
    
    await db.saveListone(listonePlayers);
    io.emit('players_list', listonePlayers);
    res.json({ success: true, count: statsUpdated });
  } catch (error) {
    console.error('Error parsing Stats:', error);
    res.status(500).json({ success: false, error: 'File parsing error' });
  }
});

app.post('/api/upload-rosters', upload.single('file'), async (req, res) => {
  try {
    const workbook = xlsx.readFile(req.file.path);
    let updatedCount = 0;

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return;

      // Find matching team in our DB
      let team = teams.find(t => t.name.toLowerCase() === sheetName.trim().toLowerCase());
      if (!team) {
        console.log(`Squadra ${sheetName} ignorata perché non presente nel DB originale.`);
        return; // Skip sheets that are not actual teams
      }

      // D1 contains Partenza FPF
      const partenzaFpfCell = sheet['D1'];
      if (partenzaFpfCell && typeof partenzaFpfCell.v === 'number') {
        team.balance = partenzaFpfCell.v;
      }

      const rows = xlsx.utils.sheet_to_json(sheet, { range: 5 }); // Skip first 5 lines (header)
      
      let roster = [];
      // Parse only up to row 36 (i.e. first 30 players of the list, index 0 to 30)
      rows.forEach((row, index) => {
        if (index > 30) return;
        
        const playerName = row['GIOCATORE'];
        if (!playerName || typeof playerName !== 'string') return;
        
        let pNameTrim = playerName.trim();
        if (pNameTrim === '' || pNameTrim.toUpperCase().includes('CEDUTO') || pNameTrim.toUpperCase() === 'N/A') return;
        
        // --- Normalizzazione fissa per risolvere incongruenza Thuram ---
        if (pNameTrim.toUpperCase().includes('THURAM')) {
          if (team.name.toLowerCase() === 'pertusio') {
            pNameTrim = 'Thuram K.';
          } else if (team.name.toLowerCase() === 'al nanoh') {
            pNameTrim = 'Thuram';
          }
        }
        
        let cost = parseInt(row['COSTO']) || 0;
        let oldRinnovo = parseInt(row['COSTO']) || cost; // Default to COSTO if no specific column
        
        let ruoloMantra = row['1° RUOLO MANTRA'] || 'N/A';
        if (ruoloMantra === 'N/A' && listonePlayers.length > 0) {
          const cleanPName = pNameTrim.toLowerCase();
          const playerInList = listonePlayers.find(p => p.Nome && p.Nome.trim().toLowerCase() === cleanPName);
          if (playerInList && playerInList.Ruolo) {
            ruoloMantra = playerInList.Ruolo;
          } else {
            // Fallback: try partial match
            const partialMatch = listonePlayers.find(p => p.Nome && (p.Nome.trim().toLowerCase().includes(cleanPName) || cleanPName.includes(p.Nome.trim().toLowerCase())));
            if (partialMatch && partialMatch.Ruolo) ruoloMantra = partialMatch.Ruolo;
          }
        }

        roster.push({
          name: pNameTrim,
          role: ruoloMantra,
          cost: cost,
          oldRinnovo: oldRinnovo
        });
      });
      team.roster = roster;
      updatedCount++;

      // Ricalcola la fascia FPF in base al balance
      team.fpf = fpf.getFpfTierInfo(team.balance);
    });

    fs.unlinkSync(req.file.path);
    
    // Reset transazioni e stato asta al reset delle rose
    transactions = [];
    await db.saveTransactions([]);
    io.emit('transactions_update', []);

    auctionState = {
      status: 'IDLE',
      currentPlayer: null,
      currentBid: 0,
      currentBidder: null,
      timerSeconds: 0
    };
    await db.saveAuction(auctionState);
    io.emit('auction_update', auctionState);

    await db.saveTeams(teams);
    io.emit('teams_update', teams);
    
    res.json({ success: true, count: updatedCount });
  } catch (error) {
    console.error('Error parsing Excel:', error);
    res.status(500).json({ success: false, error: 'Excel parsing error' });
  }
});

app.post('/api/reset-all', async (req, res) => {
  try {
    const { pin } = req.body;
    if (pin !== '211287') {
      return res.status(401).json({ success: false, error: 'PIN master non valido' });
    }

    // Reset rose e budget di tutte le squadre
    teams.forEach(t => {
      t.roster = [];
      t.balance = 500; // Valore di default
      t.fpf = fpf.getFpfTierInfo(500);
    });
    await db.saveTeams(teams);
    io.emit('teams_update', teams);

    // Reset transazioni e stato asta
    transactions = [];
    await db.saveTransactions([]);
    io.emit('transactions_update', []);

    auctionState = {
      status: 'IDLE',
      currentPlayer: null,
      currentBid: 0,
      currentBidder: null,
      timerSeconds: 0
    };
    await db.saveAuction(auctionState);
    io.emit('auction_update', auctionState);

    res.json({ success: true, message: 'Reset completato con successo' });
  } catch (error) {
    console.error('Error during reset-all:', error);
    res.status(500).json({ success: false, error: 'Errore durante il reset' });
  }
});

app.get('/api/export', (req, res) => {
  try {
    const wb = xlsx.utils.book_new();

    // FOGLIO 1: ROSE
    const roseData = [];
    teams.forEach(t => {
      let spent = 0;
      t.roster.forEach(p => { spent += p.cost; });
      
      const fpfSummary = `Fascia ${t.fpf?.fascia || 1}`;
      const slotSummary = `${t.roster.length} / ${t.fpf?.slot || 25}`;
      const bonusSummary = `+${t.fpf?.bonusCasa || 0} / +${t.fpf?.bonusTrasferta || 0}`;

      if (t.roster.length === 0) {
        roseData.push({
          Squadra: t.name,
          'FPF Finale': fpfSummary,
          'SLOT Occupati': slotSummary,
          'BONUS Finale': bonusSummary,
          'Crediti Spesi': spent,
          Giocatore: '-',
          Ruolo: '-',
          'Costo Giocatore': '-'
        });
      } else {
        t.roster.forEach((p, idx) => {
          roseData.push({
            Squadra: idx === 0 ? t.name : t.name, // We put team name on every row for easy filtering
            'FPF Finale': fpfSummary,
            'SLOT Occupati': slotSummary,
            'BONUS Finale': bonusSummary,
            'Crediti Spesi': spent,
            Giocatore: p.name,
            Ruolo: p.role,
            'Costo Giocatore': p.cost
          });
        });
      }
    });
    const wsRose = xlsx.utils.json_to_sheet(roseData);
    // Adjust column widths
    wsRose['!cols'] = [
      {wch: 20}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 25}, {wch: 10}, {wch: 15}
    ];
    xlsx.utils.book_append_sheet(wb, wsRose, 'Rose Finali');

    // FOGLIO 2: MOVIMENTI
    const movData = transactions.map(tr => {
      let seller = tr.oldOwner || 'Svincolato';
      return {
        Data: new Date(tr.timestamp).toLocaleString('it-IT'),
        Giocatore: tr.player?.name || '',
        Ruolo: tr.player?.role || '',
        'Chi ha venduto': seller,
        'Chi ha comprato': tr.newOwner,
        'Importo Pagato': tr.price,
        'Tipo Operazione': tr.type
      };
    });
    const wsMov = xlsx.utils.json_to_sheet(movData);
    wsMov['!cols'] = [
      {wch: 20}, {wch: 25}, {wch: 10}, {wch: 20}, {wch: 20}, {wch: 15}, {wch: 15}
    ];
    xlsx.utils.book_append_sheet(wb, wsMov, 'Movimenti Asta');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="Export_Asta_FPF.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    console.error('Error generating Excel:', error);
    res.status(500).json({ success: false, error: 'Excel generation error' });
  }
});

// Initialization
async function init() {
  try {
    // Load all data
    teams = await db.loadTeams();
    listonePlayers = await db.loadListone();
    transactions = await db.loadTransactions();
    auctionState = await db.loadAuction();
    config = await db.loadConfig();

    // Ensure config.pins object exists
    if (!config.pins) {
      config.pins = {};
    }

    // Auto-generate PINs for any team that doesn't have one
    let pinsUpdated = false;
    for (const team of teams) {
      if (!config.pins[team.name]) {
        // Generate random 4-digit PIN
        const pin = Math.floor(1000 + Math.random() * 9000).toString();
        config.pins[team.name] = pin;
        pinsUpdated = true;
      }
    }
    
    if (pinsUpdated) {
      await db.saveConfig(config);
      console.log('Auto-generated new team PINs and saved config.');
    }

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on http://0.0.0.0:${PORT}`);
      console.log(`Firebase integration is ${db.isFirebaseEnabled ? 'ENABLED' : 'DISABLED'}`);
    });
  } catch (err) {
    console.error('Failed to initialize server:', err);
    process.exit(1);
  }
}

init();
