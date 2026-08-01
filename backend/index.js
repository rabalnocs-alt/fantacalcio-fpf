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
  origin: function (origin, callback) {
    const allowedOrigins = process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== '*' ? process.env.CORS_ORIGIN.split(',') : [];
    if (!origin || origin.includes('vercel.app') || origin.includes('netlify.app') || origin.includes('localhost') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
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
  timerSeconds: 0,
  allowFreeRelease: false
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

let lastAssignmentSnapshot = null;

async function saveSnapshotBeforeAssignment() {
  lastAssignmentSnapshot = {
    teams: JSON.parse(JSON.stringify(teams)),
    transactions: JSON.parse(JSON.stringify(transactions)),
    auctionState: JSON.parse(JSON.stringify(auctionState))
  };
  await db.saveSnapshot(lastAssignmentSnapshot);
}

async function resolveAuction() {
  const isFreeAgent = !auctionState.currentPlayer.currentOwner;
  if (isFreeAgent) {
    if (auctionState.currentBidder) {
      await saveSnapshotBeforeAssignment();
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

function getPlayerName(item) {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item === 'object') {
    return (item.name || item.Nome || item.player || '').toString().trim();
  }
  return String(item).trim();
}

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  socket.emit('teams_update', teams);
  socket.emit('auction_update', auctionState);
  socket.emit('players_list', listonePlayers);
  socket.emit('transactions_update', transactions);

  socket.on('start_auction', async (player) => {
    if (!player) return; // Previene crash
    const targetName = getPlayerName(player);
    const targetNameNorm = targetName.toLowerCase();

    if (!targetNameNorm) return;

    // Check if player has already had an auction movement (ACQUISTO, VENDUTO, TENUTO)
    const hasBeenAuctioned = transactions.some(tx => {
      const txName = getPlayerName(tx.player || tx.name || tx).toLowerCase();
      return txName === targetNameNorm && ['ACQUISTO', 'VENDUTO', 'TENUTO'].includes(tx.type);
    });

    if (hasBeenAuctioned) {
      socket.emit('start_auction_error', { 
        message: `🔴 IMPOSSIBILE! Il calciatore "${targetName}" è già stato aggiudicato in questa asta e non può più essere chiamato!` 
      });
      return;
    }

    let foundOwner = null;
    let foundCost = 0;
    teams.forEach(t => {
      const p = (t.roster || []).find(r => {
        return getPlayerName(r).toLowerCase() === targetNameNorm;
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
      startTimer(30);
      io.emit('auction_update', auctionState);
    }
  });

  socket.on('place_bid', async ({ teamName, amount }) => {
    const biddingTeam = teams.find(t => t.name === teamName);
    if (!biddingTeam) return;

    // Owner cannot bid on their own player
    if (auctionState.currentPlayer?.currentOwner === teamName) {
      socket.emit('bid_error', { message: 'Non puoi fare un\'offerta per un tuo calciatore!' });
      return;
    }

    const currentRosterCount = biddingTeam.roster ? biddingTeam.roster.length : 0;
    const newBalance = biddingTeam.balance - amount;

    // FPF Rule Check 1: (REMOVED - allow going below -600, FPF tier 8 will cap slots to 23 instead)

    const newFpf = fpf.getFpfTierInfo(newBalance);
    const newMaxSlots = newFpf.slot;

    // FPF Rule Check 2: If bid drops tier such that newMaxSlots < (currentRosterCount + 1), BLOCK BID!
    if ((currentRosterCount + 1) > newMaxSlots) {
      socket.emit('bid_error', { 
        message: `Offerta non consentita da FPF! Offrendo ${amount} cr scenderesti a bilancio ${newBalance} (${newFpf.label}), dov'è consentito un massimo di ${newMaxSlots} slot, ma avresti ${currentRosterCount + 1} giocatori in rosa.` 
      });
      return;
    }

    // FPF Rule Check 3: Minimum reserve budget for remaining slots
    const remainingSlots = Math.max(0, newMaxSlots - (currentRosterCount + 1));
    const finalBalance = newBalance - remainingSlots;
    const finalFpf = fpf.getFpfTierInfo(finalBalance);
    if ((currentRosterCount + 1) > finalFpf.slot) {
      socket.emit('bid_error', { 
        message: `Offerta non consentita da FPF! Con questa offerta non ti rimarrebbero abbastanza crediti per completare i ${remainingSlots} slot della rosa senza retrocedere di fascia.` 
      });
      return;
    }

    if (amount > auctionState.currentBid) {
      auctionState.currentBid = amount;
      auctionState.currentBidder = teamName;
      startTimer(15); // Restart 15s timer
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

  socket.on('force_end_timer', async () => {
    if (auctionState.status === 'ACTIVE' || auctionState.status === 'WAITING') {
      stopTimer();
      await resolveAuction();
    }
  });

  socket.on('bivio_decision', async ({ option }) => {
    if (auctionState.status !== 'BIVIO') return;
    stopTimer();

    await saveSnapshotBeforeAssignment();

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
    auctionState = { status: 'IDLE', currentPlayer: null, currentBid: 0, currentBidder: null, timerSeconds: 0, allowFreeRelease: auctionState.allowFreeRelease };
    await db.saveAuction(auctionState);
    io.emit('auction_update', auctionState);
  });

  socket.on('set_free_release', async (enabled) => {
    auctionState.allowFreeRelease = !!enabled;
    await db.saveAuction(auctionState);
    io.emit('auction_update', auctionState);
  });

  socket.on('release_player', async ({ playerName, teamName, refundAmount }) => {
    const team = teams.find(t => t.name === teamName);
    if (!team) return;

    const pIndex = (team.roster || []).findIndex(p => getPlayerName(p).toLowerCase() === playerName.toLowerCase());
    if (pIndex === -1) return;

    const playerToRelease = team.roster[pIndex];
    team.roster.splice(pIndex, 1);
    team.balance += (refundAmount || 0);
    team.fpf = fpf.getFpfTierInfo(team.balance);

    await db.saveTeams(teams);
    io.emit('teams_update', teams);

    const typeText = refundAmount > 0 ? 'Svincolo Rimborsato' : 'Svincolo Libero';
    await logTransaction(typeText, playerToRelease.Nome || playerToRelease.name || playerToRelease.player || playerName, teamName, 'SVINCOLATI', refundAmount || 0);
  });

  socket.on('undo_last_auction', async () => {
    if (!lastAssignmentSnapshot) {
      socket.emit('undo_error', { message: 'Nessuna asta precedente da annullare.' });
      return;
    }

    try {
      teams = JSON.parse(JSON.stringify(lastAssignmentSnapshot.teams));
      transactions = JSON.parse(JSON.stringify(lastAssignmentSnapshot.transactions));
      auctionState = { status: 'IDLE', currentPlayer: null, currentBid: 0, currentBidder: null, timerSeconds: 0 };

      stopTimer();
      await db.saveTeams(teams);
      await db.saveTransactions(transactions);
      await db.saveAuction(auctionState);

      io.emit('teams_update', teams);
      io.emit('transactions_update', transactions);
      io.emit('auction_update', auctionState);

      lastAssignmentSnapshot = null;
      await db.saveSnapshot(null);
      console.log('Ultima asta annullata con successo!');
    } catch (err) {
      console.error('Error undoing last auction:', err);
    }
  });

  socket.on('manual_fpf_update', async ({ teamName, newBalance }) => {
    const team = teams.find(t => t.name === teamName);
    if (!team) return;
    
    const oldBalance = team.balance;
    team.balance = newBalance;
    team.fpf = fpf.getFpfTierInfo(team.balance);
    
    await db.saveTeams(teams);
    io.emit('teams_update', teams);
    
    await logTransaction('MODIFICA MANUALE', 'Aggiustamento FPF', teamName, teamName, oldBalance - newBalance);
  });

  socket.on('trigger_force_reload', (pin) => {
    if (pin === '211287') {
      console.log('Master triggered force reload for all screens');
      io.emit('force_reload');
    }
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

// Data GET APIs
app.get('/api/teams', (req, res) => {
  res.json(teams || []);
});

app.get('/api/transactions', (req, res) => {
  res.json(transactions || []);
});

app.get('/api/players', (req, res) => {
  res.json(listonePlayers || []);
});

app.get('/api/listone', (req, res) => {
  res.json(listonePlayers || []);
});

app.get('/api/auction', (req, res) => {
  res.json(auctionState || {});
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

async function applyNewListone(newPlayers, sourceName) {
  const teamMapping = {
    'ATA': 'Atalanta', 'BOL': 'Bologna', 'CAG': 'Cagliari', 'COM': 'Como', 
    'EMP': 'Empoli', 'FIO': 'Fiorentina', 'GEN': 'Genoa', 'INT': 'Inter', 
    'JUV': 'Juventus', 'LAZ': 'Lazio', 'LEC': 'Lecce', 'MIL': 'Milan', 
    'MON': 'Monza', 'NAP': 'Napoli', 'PAR': 'Parma', 'ROM': 'Roma', 
    'TOR': 'Torino', 'UDI': 'Udinese', 'VEN': 'Venezia', 'VER': 'Verona',
    'SAS': 'Sassuolo', 'SAL': 'Salernitana', 'FRO': 'Frosinone', 
    'SAM': 'Sampdoria', 'SPE': 'Spezia', 'CRE': 'Cremonese'
  };

  const uniquePlayers = new Map();
  newPlayers.forEach(p => {
    const name = (p.Nome || p.nome || p.name || p.Player || p.player || '').trim();
    if (!name) return;
    const cleanName = name.toLowerCase();
    if (!uniquePlayers.has(cleanName)) {
      uniquePlayers.set(cleanName, p);
    }
  });
  const dedupedPlayers = Array.from(uniquePlayers.values());

  listonePlayers = dedupedPlayers.map((p, idx) => {
    let s = p.Squadra ? p.Squadra.trim() : '';
    if (s.length === 3 && teamMapping[s.toUpperCase()]) {
      s = teamMapping[s.toUpperCase()];
    }
    return { ...p, Id: idx + 1, Squadra: s };
  });

  await db.saveListone(listonePlayers);
  const listoneMap = new Map();
  listonePlayers.forEach(p => {
    const cleanName = getPlayerName(p).toLowerCase();
    if (cleanName) listoneMap.set(cleanName, p);
  });

  let teamsModified = false;
  teams.forEach(t => {
    (t.roster || []).forEach(r => {
      const cleanName = getPlayerName(r).toLowerCase();
      const matched = listoneMap.get(cleanName);
      if (matched) {
        if (matched.Ruolo && r.role !== matched.Ruolo) {
          r.role = matched.Ruolo;
          teamsModified = true;
        }
        if (matched.Squadra && r.squadra !== matched.Squadra) {
          r.squadra = matched.Squadra;
          teamsModified = true;
        }
      }
    });
  });

  if (teamsModified) {
    await db.saveTeams(teams);
  }

  if (auctionState.status !== 'IDLE') {
    stopTimer();
    auctionState = { status: 'IDLE', currentPlayer: null, currentBid: 0, currentBidder: null, timerSeconds: 0 };
    await db.saveAuction(auctionState);
  }

  io.emit('players_list', listonePlayers);
  io.emit('teams_update', teams);
  io.emit('auction_update', auctionState);
  io.emit('force_reload');

  console.log(`[Listone Switch] Applied clean listone (${newPlayers.length} players) from ${sourceName}. Emitted force_reload.`);
}

app.post('/api/upload-listone', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Seleziona prima un file Excel (.xlsx o .xls) da caricare!' });
    }

    const workbook = xlsx.readFile(req.file.path);
    let allResults = [];
    
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      if (!rawData || rawData.length === 0) continue;
      
      let headerIdx = rawData.findIndex(row => row && Array.isArray(row) && row.some(cell => {
        const s = typeof cell === 'string' ? cell.trim().toUpperCase() : '';
        return s === 'NOME' || s === 'GIOCATORE' || s === 'PLAYER';
      }));
      if (headerIdx === -1) headerIdx = 0;
      
      let headers = rawData[headerIdx].map(h => typeof h === 'string' ? h.toLowerCase().trim() : '');
      let nomeIdx = headers.findIndex(h => h === 'nome' || h === 'giocatore' || h.includes('nome') || h.includes('player'));
      if (nomeIdx === -1) nomeIdx = 1;

      let ruolIdx = headers.findIndex(h => h === 'rm' || h === 'r. mantra' || h === 'ruolo mantra' || h === 'rmantra' || h.includes('ruolo') || h === 'r');
      if (ruolIdx === -1) ruolIdx = 2;

      let sqIdx = headers.findIndex(h => h === 'squadra' || h === 'team' || h === 'club' || h.includes('squadra'));
      if (sqIdx === -1) sqIdx = 3;
      
      let idIdx = headers.indexOf('id');

      let qtIdx = headers.findIndex(h => h === 'qt. a' || h === 'quotazione' || h === 'qt' || h === 'q' || h === 'quo' || h.includes('quot'));
      if (qtIdx === -1) qtIdx = 4;

      let fvmIdx = headers.findIndex(h => h === 'fvm' || h === 'fvm m' || h === 'fvm mantra' || h.includes('fvm'));
      let titIdx = headers.findIndex(h => h === 'titolarità' || h === 'titolarita' || h === 'tit');
      let affIdx = headers.findIndex(h => h === 'affidabilità' || h === 'affidabilita' || h === 'aff');
      let intIdx = headers.findIndex(h => h === 'integrità' || h === 'integrita' || h === 'int');
      let mvIdx = headers.findIndex(h => h === 'mv');
      let presIdx = headers.findIndex(h => h === 'presenze' || h === 'pres');

      const results = rawData.slice(headerIdx + 1)
        .filter(row => row && row[nomeIdx] && String(row[nomeIdx]).trim() !== '' && String(row[nomeIdx]).trim().toUpperCase() !== 'NOME')
        .map((row, idx) => ({
          Id: idIdx !== -1 && row[idIdx] ? parseInt(row[idIdx]) || (allResults.length + idx + 1) : (allResults.length + idx + 1),
          Nome: String(row[nomeIdx]).trim(),
          Ruolo: ruolIdx !== -1 && row[ruolIdx] ? String(row[ruolIdx]).trim() : '',
          Squadra: sqIdx !== -1 && row[sqIdx] ? String(row[sqIdx]).trim() : '',
          Quotazione: qtIdx !== -1 && row[qtIdx] ? parseInt(row[qtIdx]) || 1 : 1,
          FVM: fvmIdx !== -1 && row[fvmIdx] ? parseInt(row[fvmIdx]) || 0 : 0,
          Titolarita: titIdx !== -1 && row[titIdx] ? parseInt(row[titIdx]) || 0 : 0,
          Affidabilita: affIdx !== -1 && row[affIdx] ? parseInt(row[affIdx]) || 0 : 0,
          Integrita: intIdx !== -1 && row[intIdx] ? parseInt(row[intIdx]) || 0 : 0,
          MV: mvIdx !== -1 && row[mvIdx] ? parseFloat(String(row[mvIdx]).replace(',', '.')) || 0 : 0,
          Presenze: presIdx !== -1 && row[presIdx] ? parseInt(row[presIdx]) || 0 : 0
        }));

      allResults = allResults.concat(results);
    }

    fs.unlinkSync(req.file.path);
    
    if (allResults.length === 0) {
      return res.status(400).json({ success: false, error: 'Nessun calciatore valido trovato nel file Excel.' });
    }

    await applyNewListone(allResults, 'Excel Upload');
    res.json({ success: true, count: allResults.length });
  } catch (error) {
    console.error('Error parsing Listone:', error);
    res.status(500).json({ success: false, error: 'File parsing error: ' + error.message });
  }
});

app.post('/api/reset-listone', async (req, res) => {
  try {
    await applyNewListone([], 'Reset');
    res.json({ success: true, message: 'Listone resettato con successo' });
  } catch (err) {
    console.error('Error resetting listone:', err);
    res.status(500).json({ success: false, error: 'Reset listone error' });
  }
});

app.post('/api/import-listone-json', async (req, res) => {
  try {
    const { players, rawText, source } = req.body;
    let newPlayers = [];

    if (Array.isArray(players) && players.length > 0) {
      newPlayers = players.map((p, idx) => ({
        Id: p.Id || p.id || (idx + 1),
        Nome: (p.Nome || p.nome || p.name || '').trim(),
        Ruolo: (p.Ruolo || p.ruolo || p.role || '').trim(),
        Squadra: (p.Squadra || p.squadra || p.team || '').trim(),
        Quotazione: parseInt(p.Quotazione || p.quotazione || p.qt || p.cost) || 1,
        FVM: parseInt(p.FVM || p.fvm) || 0
      })).filter(p => p.Nome !== '');
    } else if (rawText && typeof rawText === 'string') {
      const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const knownSerieA = [
        'Atalanta', 'Bologna', 'Cagliari', 'Como', 'Empoli', 'Fiorentina', 
        'Genoa', 'Inter', 'Juventus', 'Lazio', 'Lecce', 'Milan', 
        'Monza', 'Napoli', 'Parma', 'Roma', 'Torino', 'Udinese', 'Venezia', 'Verona'
      ];

      lines.forEach((line, idx) => {
        let tokens = line.split(/[\t,;]+/).map(p => p.trim()).filter(p => p !== '');
        if (tokens.length <= 1) {
          tokens = line.split(/\s{2,}/).map(p => p.trim()).filter(p => p !== '');
          if (tokens.length <= 1) {
            tokens = line.split(/\s+/).map(p => p.trim()).filter(p => p !== '');
          }
        }

        if (tokens.length >= 2) {
          if (tokens.some(t => t.toUpperCase() === 'NOME' || t.toUpperCase() === 'RUOLO')) return;

          let name = '';
          let role = '';
          let team = '';
          let quot = 1;
          let fvm = 0;

          const teamFoundIdx = tokens.findIndex(t => knownSerieA.some(k => k.toLowerCase() === t.toLowerCase()));
          if (teamFoundIdx !== -1) {
            team = knownSerieA.find(k => k.toLowerCase() === tokens[teamFoundIdx].toLowerCase()) || tokens[teamFoundIdx];
          }

          const mantraPattern = /^(POR|DC|DD|DS|E|M|C|T|W|A|PC|B)(;[A-Z;]+)?$/i;
          const roleFoundIdx = tokens.findIndex(t => mantraPattern.test(t));
          if (roleFoundIdx !== -1) {
            role = tokens[roleFoundIdx];
          }

          const numbers = tokens.filter(t => /^\d+$/.test(t)).map(t => parseInt(t));
          if (numbers.length >= 1) quot = numbers[0];
          if (numbers.length >= 2) fvm = numbers[1];

          const nameTokens = tokens.filter((t, i) => i !== teamFoundIdx && i !== roleFoundIdx && !/^\d+$/.test(t));
          if (nameTokens.length > 0) {
            name = nameTokens.join(' ');
          }

          if (name) {
            newPlayers.push({
              Id: idx + 1,
              Nome: name,
              Ruolo: role || 'C',
              Squadra: team || 'Serie A',
              Quotazione: quot || 1,
              FVM: fvm || 0
            });
          }
        }
      });
    }

    if (newPlayers.length === 0) {
      return res.status(400).json({ success: false, error: 'Nessun calciatore valido trovato nel testo o JSON fornito.' });
    }

    await applyNewListone(newPlayers, source || 'fantalab');
    res.json({ success: true, count: newPlayers.length, source: source || 'fantalab' });
  } catch (err) {
    console.error('Error importing listone json/text:', err);
    res.status(500).json({ success: false, error: 'Errore durante l\'importazione' });
  }
});

app.post('/api/import-listone-preset', async (req, res) => {
  try {
    const filePath = path.join(__dirname, 'data', 'listone.json');
    let presetData = [];
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      presetData = JSON.parse(raw);
    }
    if (!presetData || presetData.length === 0) {
      presetData = await db.loadListone();
    }
    if (presetData && presetData.length > 0) {
      await applyNewListone(presetData, 'Preset FantaLab 2026/27');
      return res.json({ success: true, count: presetData.length, message: 'Database FantaLab 2026/27 attivato con successo!' });
    }
    res.status(400).json({ success: false, error: 'Nessun listone pre-caricato trovato nel sistema.' });
  } catch (err) {
    console.error('Error loading preset:', err);
    res.status(500).json({ success: false, error: 'Errore durante il caricamento del preset' });
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
      let team = teams.find(t => {
        const dbNameNorm = t.name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        const sheetNameNorm = sheetName.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        return dbNameNorm === sheetNameNorm || dbNameNorm.includes(sheetNameNorm) || sheetNameNorm.includes(dbNameNorm);
      });
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
          if (team.name.toLowerCase().includes('pertusio')) {
            pNameTrim = 'Thuram K.';
          } else if (team.name.toLowerCase().includes('al nanoh')) {
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
      timerSeconds: 0,
      allowFreeRelease: false
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
      timerSeconds: 0,
      allowFreeRelease: false
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
    lastAssignmentSnapshot = await db.loadSnapshot();

    const defaultPins = {
      "Salassuolo": "1264",
      "Pertusio Club de Futbol": "5826",
      "Wormerhampton FFC": "2048",
      "Partizan Beijing": "3279",
      "Al Nanoh FC": "6967",
      "FC Aglientus": "4593",
      "Error-Systema-104": "2842",
      "Dinamo Zafavria": "9550",
      "PONTefice": "3832",
      "Cwtch Sporting": "8672"
    };

    if (!config.pins) {
      config.pins = {};
    }

    let pinsUpdated = false;
    for (const team of teams) {
      const targetPin = defaultPins[team.name] || config.pins[team.name] || Math.floor(1000 + Math.random() * 9000).toString();
      if (config.pins[team.name] !== targetPin) {
        config.pins[team.name] = targetPin;
        pinsUpdated = true;
      }
    }
    
    // Also ensure all default pins are in config.pins
    Object.keys(defaultPins).forEach(teamName => {
      if (config.pins[teamName] !== defaultPins[teamName]) {
        config.pins[teamName] = defaultPins[teamName];
        pinsUpdated = true;
      }
    });

    const defaultLogos = {
      "Salassuolo": "https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/squadra_2025/14951654_03387686.png",
      "Pertusio Club de Futbol": "https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/squadra_2025/14959577_01975842.png",
      "Partizan Beijing": "https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/squadra_2025/14952058_009386557.png",
      "Al Nanoh FC": "https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/squadra_2025/14953682_03890613.png",
      "FC Aglientus": "https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/squadra_2025/14954190_02390271.png",
      "Error-Systema-104": "https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/squadra_2025/14952987_01952661.png",
      "Dinamo Zafavria": "https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/squadra_2025/14951989_0826998.png",
      "PONTefice": "https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/squadra_2025/14952818_007149065.png",
      "Cwtch Sporting": "https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/squadra_2025/14953197_02288477.png"
    };

    let teamsUpdated = false;
    for (const team of teams) {
      if (defaultLogos[team.name] && team.logoUrl !== defaultLogos[team.name]) {
        team.logoUrl = defaultLogos[team.name];
        teamsUpdated = true;
      }
    }
    if (teamsUpdated) {
      await db.saveTeams(teams);
      console.log('Restored team logoUrls in DB.');
    }

    if (pinsUpdated || true) { // Always force save once on startup to sync Firestore
      await db.saveConfig(config);
      console.log('Restored default team PINs and saved config.');
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
