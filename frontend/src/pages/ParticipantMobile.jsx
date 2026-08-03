import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, Shield, ArrowRight, LogOut } from 'lucide-react';
import { socket, BACKEND_URL } from '../utils/socket';
import { useAuth } from '../components/AuthContext';
import MiniDashboard from '../components/MiniDashboard';

const playDefaultBidSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    const playTone = (freq, delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.12);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.12);
    };

    playTone(1800, 0);
    playTone(2400, 0.06);
  } catch (err) {
    console.error('Audio play error:', err);
  }
};

export default function ParticipantMobile() {
  const { auth, logout } = useAuth();
  const [myTeamName, setMyTeamName] = useState('');
  const [teams, setTeams] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [auction, setAuction] = useState(null);
  const [activeTab, setActiveTab] = useState('live'); // 'live', 'roster', 'listone', 'formazione', 'altre-rose', 'movimenti', 'scambi'
  const [bidAmount, setBidAmount] = useState('');
  const prevBidRef = useRef(0);

  // Self-call states
  const [selfCallSearch, setSelfCallSearch] = useState('');
  const [selfCallPlayer, setSelfCallPlayer] = useState(null);
  const [selfCallPrice, setSelfCallPrice] = useState(1);

  // Trades states
  const [trades, setTrades] = useState([]);
  const [tradeTargetTeam, setTradeTargetTeam] = useState('');
  const [tradeOfferedPlayers, setTradeOfferedPlayers] = useState([]);
  const [tradeRequestedPlayers, setTradeRequestedPlayers] = useState([]);
  const [tradeCreditOffset, setTradeCreditOffset] = useState(0);
  const [tradeStep, setTradeStep] = useState(1); // 1=choose team, 2=choose players, 3=confirm

  // Listone Tab States
  const [listone, setListone] = useState([]);
  const [listoneFilterType, setListoneFilterType] = useState('svincolati'); // 'svincolati' | 'altre' | 'tutti'
  const [listoneSearch, setListoneSearch] = useState('');
  const [listoneRoleFilter, setListoneRoleFilter] = useState('TUTTI');
  const [listoneTeamFilter, setListoneTeamFilter] = useState('TUTTE');
  const [listoneFantaTeamFilter, setListoneFantaTeamFilter] = useState('TUTTE');
  const [onlyAstabiliInAltreRose, setOnlyAstabiliInAltreRose] = useState(false);
  const [listoneSortBy, setListoneSortBy] = useState('qtA'); // 'qtA' | 'fvm' | 'nome'
  const [listoneVisibleCount, setListoneVisibleCount] = useState(40);

  useEffect(() => {
    if (auth?.role === 'participant' && auth.teamName) {
      setMyTeamName(auth.teamName);
    }
  }, [auth]);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/teams`)
      .then(res => res.ok ? res.json() : [])
      .then(data => { if (Array.isArray(data)) setTeams(data); })
      .catch(err => console.error('teams fetch error:', err));

    fetch(`${BACKEND_URL}/api/transactions`)
      .then(res => res.ok ? res.json() : [])
      .then(data => { if (Array.isArray(data)) setTransactions(data); })
      .catch(err => console.error('transactions fetch error:', err));

    fetch(`${BACKEND_URL}/api/listone`)
      .then(res => res.ok ? res.json() : [])
      .then(data => { if (Array.isArray(data)) setListone(data); })
      .catch(err => console.error('listone fetch error:', err));

    socket.on('teams_update', (data) => setTeams(data));
    socket.on('transactions_update', (data) => setTransactions(data));
    socket.on('players_list', (data) => setListone(data));
    socket.on('trades_update', (data) => setTrades(Array.isArray(data) ? data : []));
    socket.on('bid_error', ({ message }) => {
      alert(message || 'Offerta non valida!');
    });
    socket.on('auction_update', (data) => {
      setAuction(data);
      if (data && data.status !== 'ACTIVE') setBidAmount('');
    });
    socket.on('force_reload', () => {
      console.log('Master requested a forced reload');
      window.location.reload();
    });
    return () => {
      socket.off('teams_update');
      socket.off('transactions_update');
      socket.off('players_list');
      socket.off('auction_update');
      socket.off('bid_error');
      socket.off('force_reload');
      socket.off('trades_update');
    };
  }, []);

  const getPlayerName = React.useCallback((item) => {
    if (!item) return '';
    if (typeof item === 'string') return item.trim();
    if (typeof item === 'object') {
      return (item.name || item.Nome || item.player || '').toString().trim();
    }
    return String(item).trim();
  }, []);

  const assignedMap = React.useMemo(() => {
    const map = {};
    teams.forEach(t => {
      (t.roster || []).forEach(p => {
        const cleanName = getPlayerName(p).toLowerCase();
        if (cleanName) {
          map[cleanName] = { owner: t.name, cost: p.cost, role: p.role };
        }
      });
    });
    return map;
  }, [teams, getPlayerName]);

  const auctionedSet = React.useMemo(() => {
    const set = new Set();
    (transactions || []).forEach(tx => {
      const txName = getPlayerName(tx.player || tx.name || tx).toLowerCase();
      if (txName && ['ACQUISTO', 'VENDUTO', 'TENUTO'].includes(tx.type)) {
        set.add(txName);
      }
    });
    return set;
  }, [transactions, getPlayerName]);

  const serieATeams = React.useMemo(() => {
    const defaultSerieA = [
      'Atalanta', 'Bologna', 'Cagliari', 'Como', 'Empoli', 'Fiorentina', 
      'Genoa', 'Inter', 'Juventus', 'Lazio', 'Lecce', 'Milan', 
      'Monza', 'Napoli', 'Parma', 'Roma', 'Torino', 'Udinese', 'Venezia', 'Verona'
    ];
    const setSq = new Set(defaultSerieA);
    listone.forEach(p => {
      const sq = p.Squadra || p.squadra;
      if (sq && typeof sq === 'string') {
        setSq.add(sq.trim());
      }
    });
    return Array.from(setSq).sort();
  }, [listone]);

  const fantaTeamsList = React.useMemo(() => {
    return teams.map(t => t.name).sort();
  }, [teams]);

  const countsInfo = React.useMemo(() => {
    let svincolatiCount = 0;
    let assignedCount = 0;
    listone.forEach(p => {
      const cleanName = (p.Nome || '').trim().toLowerCase();
      if (assignedMap[cleanName]) assignedCount++;
      else svincolatiCount++;
    });
    return { svincolatiCount, assignedCount, totalCount: listone.length };
  }, [listone, assignedMap]);

  const filteredListone = React.useMemo(() => {
    return listone.filter(p => {
      const cleanName = (p.Nome || '').trim().toLowerCase();
      const assignedInfo = assignedMap[cleanName];

      if (listoneFilterType === 'svincolati' && assignedInfo) return false;
      if (listoneFilterType === 'altre' && !assignedInfo) return false;

      // Filter by Fanta Squadra (e.g. Salassuolo, Pertusio, etc.)
      if (listoneFantaTeamFilter && listoneFantaTeamFilter !== 'TUTTE') {
        if (!assignedInfo || assignedInfo.owner !== listoneFantaTeamFilter) return false;
      }

      // Filter: Solo Astabili (nasconde già astati)
      if (onlyAstabiliInAltreRose) {
        if (auctionedSet.has(cleanName)) return false;
      }

      if (listoneSearch && !cleanName.includes(listoneSearch.toLowerCase().trim())) return false;

      if (listoneRoleFilter && listoneRoleFilter !== 'TUTTI') {
        const pRoleUpper = (p.Ruolo || p.role || '').toUpperCase();
        const filterUpper = listoneRoleFilter.toUpperCase();

        if (filterUpper === 'POR' && !pRoleUpper.includes('POR')) return false;
        if (filterUpper === 'DEF' && !(pRoleUpper.includes('DC') || pRoleUpper.includes('DD') || pRoleUpper.includes('DS') || pRoleUpper.includes('E') || pRoleUpper.includes('B') || pRoleUpper.includes('D'))) return false;
        if (filterUpper === 'MED' && !(pRoleUpper.includes('M') || pRoleUpper.includes('C'))) return false;
        if (filterUpper === 'FAN' && !(pRoleUpper.includes('W') || pRoleUpper.includes('T') || pRoleUpper.includes('A'))) return false;
        if (filterUpper === 'ATT' && !(pRoleUpper.includes('PC') || pRoleUpper.includes('A'))) return false;

        if (!['POR','DEF','MED','FAN','ATT'].includes(filterUpper)) {
          if (!pRoleUpper.includes(filterUpper)) return false;
        }
      }

      if (listoneTeamFilter && listoneTeamFilter !== 'TUTTE') {
        const playerSq = (p.Squadra || p.squadra || '').toLowerCase();
        if (playerSq !== listoneTeamFilter.toLowerCase()) return false;
      }

      return true;
    }).sort((a, b) => {
      if (listoneSortBy === 'qtA') return (b.Quotazione || 0) - (a.Quotazione || 0);
      if (listoneSortBy === 'fvm') return (b.FVM || 0) - (a.FVM || 0);
      if (listoneSortBy === 'nome') return a.Nome.localeCompare(b.Nome);
      return 0;
    });
  }, [listone, assignedMap, auctionedSet, listoneFilterType, listoneFantaTeamFilter, onlyAstabiliInAltreRose, listoneSearch, listoneRoleFilter, listoneTeamFilter, listoneSortBy]);

  const formatPlayerNameForUrl = (name) => {
    if (!name) return '';
    let normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    if (normalized === 'ADAMS C.') return 'ADAMS';
    if (normalized === 'ESPOSITO F.P.') return 'ESPOSITOFP';
    return normalized.replace(/\./g, '').replace(/['\s]+/g, '-').replace(/[^A-Z0-9-]/g, '');
  };

  useEffect(() => {
    if (auction && auction.status === 'ACTIVE' && auction.currentBid > prevBidRef.current && auction.currentBidder) {
      playDefaultBidSound();
    }
    if (auction) {
      prevBidRef.current = auction.currentBid;
    }
  }, [auction?.currentBid, auction?.status]);

  const myTeam = teams.find(t => 
    t.name === myTeamName || 
    t.name.toLowerCase().trim() === (myTeamName || '').toLowerCase().trim() ||
    t.name.toLowerCase().replace(/[^a-z0-9]/g, '') === (myTeamName || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  );
  
  const myTransactions = transactions.filter(tx => tx.oldOwner === myTeamName || tx.newOwner === myTeamName);

  const handleBid = () => {
    if (!myTeamName) return alert("Seleziona prima la tua squadra!");
    let parsedBid = parseInt(bidAmount);
    if (!bidAmount || isNaN(parsedBid)) {
      parsedBid = auction.currentBid + 1;
    }
    if (parsedBid <= auction.currentBid) {
      alert(`L'offerta deve essere maggiore di ${auction.currentBid} cr!`);
      return;
    }
    socket.emit('place_bid', { teamName: myTeamName, amount: parsedBid });
    setBidAmount(''); // Clear after bid
  };

  const handleBivio = (option) => {
    socket.emit('bivio_decision', { option });
  };

  const [notes, setNotes] = useState(() => localStorage.getItem(`notes_${myTeamName}`) || '');
  
  const [selectedModule, setSelectedModule] = useState(() => localStorage.getItem(`module_${myTeamName}`) || '4-3-3');
  const [formazione, setFormazione] = useState(() => {
    const saved = localStorage.getItem(`formazione_${myTeamName}`);
    return saved ? JSON.parse(saved) : {};
  });

  const [selectingForPos, setSelectingForPos] = useState(null); // Which position on the pitch is being selected

  const mantraModules = {
    '3-4-3': [ {id:'POR',y:'90%',x:'50%'}, {id:'Dc-1',y:'75%',x:'20%'}, {id:'Dc-2',y:'75%',x:'50%'}, {id:'Dc/B',y:'75%',x:'80%'}, {id:'E-1',y:'55%',x:'15%'}, {id:'M/C',y:'55%',x:'38%'}, {id:'C',y:'55%',x:'62%'}, {id:'E-2',y:'55%',x:'85%'}, {id:'W/A-1',y:'30%',x:'20%'}, {id:'A/Pc',y:'30%',x:'50%'}, {id:'W/A-2',y:'30%',x:'80%'} ],
    '3-4-1-2': [ {id:'POR',y:'90%',x:'50%'}, {id:'Dc-1',y:'75%',x:'20%'}, {id:'Dc-2',y:'75%',x:'50%'}, {id:'Dc/B',y:'75%',x:'80%'}, {id:'E-1',y:'55%',x:'15%'}, {id:'M/C',y:'55%',x:'38%'}, {id:'C',y:'55%',x:'62%'}, {id:'E-2',y:'55%',x:'85%'}, {id:'T',y:'40%',x:'50%'}, {id:'A/Pc-1',y:'25%',x:'35%'}, {id:'A/Pc-2',y:'25%',x:'65%'} ],
    '3-4-2-1': [ {id:'POR',y:'90%',x:'50%'}, {id:'Dc-1',y:'75%',x:'20%'}, {id:'Dc-2',y:'75%',x:'50%'}, {id:'Dc/B',y:'75%',x:'80%'}, {id:'E/W-1',y:'55%',x:'15%'}, {id:'M/C-1',y:'55%',x:'38%'}, {id:'M/C-2',y:'55%',x:'62%'}, {id:'E/W-2',y:'55%',x:'85%'}, {id:'W/T',y:'40%',x:'35%'}, {id:'T/A',y:'40%',x:'65%'}, {id:'A/Pc',y:'25%',x:'50%'} ],
    '3-5-2': [ {id:'POR',y:'90%',x:'50%'}, {id:'Dc-1',y:'75%',x:'20%'}, {id:'Dc-2',y:'75%',x:'50%'}, {id:'Dc/B',y:'75%',x:'80%'}, {id:'E/W',y:'55%',x:'10%'}, {id:'M/C',y:'55%',x:'30%'}, {id:'M',y:'55%',x:'50%'}, {id:'C',y:'55%',x:'70%'}, {id:'E',y:'55%',x:'90%'}, {id:'A/Pc-1',y:'30%',x:'35%'}, {id:'A/Pc-2',y:'30%',x:'65%'} ],
    '3-5-1-1': [ {id:'POR',y:'90%',x:'50%'}, {id:'Dc-1',y:'75%',x:'20%'}, {id:'Dc-2',y:'75%',x:'50%'}, {id:'Dc/B',y:'75%',x:'80%'}, {id:'E/W-1',y:'60%',x:'10%'}, {id:'M/C',y:'60%',x:'30%'}, {id:'C',y:'60%',x:'50%'}, {id:'M',y:'60%',x:'70%'}, {id:'E/W-2',y:'60%',x:'90%'}, {id:'T/A',y:'40%',x:'50%'}, {id:'A/Pc',y:'20%',x:'50%'} ],
    '4-3-3': [ {id:'POR',y:'90%',x:'50%'}, {id:'Dd',y:'75%',x:'15%'}, {id:'Dc-1',y:'75%',x:'38%'}, {id:'Dc-2',y:'75%',x:'62%'}, {id:'Ds',y:'75%',x:'85%'}, {id:'M/C',y:'55%',x:'25%'}, {id:'M',y:'55%',x:'50%'}, {id:'C',y:'55%',x:'75%'}, {id:'W/A-1',y:'30%',x:'20%'}, {id:'A/Pc',y:'30%',x:'50%'}, {id:'W/A-2',y:'30%',x:'80%'} ],
    '4-3-1-2': [ {id:'POR',y:'90%',x:'50%'}, {id:'Dd',y:'75%',x:'15%'}, {id:'Dc-1',y:'75%',x:'38%'}, {id:'Dc-2',y:'75%',x:'62%'}, {id:'Ds',y:'75%',x:'85%'}, {id:'M/C',y:'55%',x:'25%'}, {id:'M',y:'55%',x:'50%'}, {id:'C',y:'55%',x:'75%'}, {id:'T',y:'40%',x:'50%'}, {id:'A/Pc-1',y:'25%',x:'35%'}, {id:'A/Pc-2',y:'25%',x:'65%'} ],
    '4-4-2': [ {id:'POR',y:'90%',x:'50%'}, {id:'Dd',y:'75%',x:'15%'}, {id:'Dc-1',y:'75%',x:'38%'}, {id:'Dc-2',y:'75%',x:'62%'}, {id:'Ds',y:'75%',x:'85%'}, {id:'E/W',y:'55%',x:'15%'}, {id:'M/C',y:'55%',x:'38%'}, {id:'C',y:'55%',x:'62%'}, {id:'E',y:'55%',x:'85%'}, {id:'A/Pc-1',y:'30%',x:'35%'}, {id:'A/Pc-2',y:'30%',x:'65%'} ],
    '4-1-4-1': [ {id:'POR',y:'90%',x:'50%'}, {id:'Dd',y:'75%',x:'15%'}, {id:'Dc-1',y:'75%',x:'38%'}, {id:'Dc-2',y:'75%',x:'62%'}, {id:'Ds',y:'75%',x:'85%'}, {id:'M',y:'60%',x:'50%'}, {id:'E/W',y:'45%',x:'15%'}, {id:'C/T',y:'45%',x:'38%'}, {id:'T',y:'45%',x:'62%'}, {id:'W',y:'45%',x:'85%'}, {id:'A/Pc',y:'25%',x:'50%'} ],
    '4-4-1-1': [ {id:'POR',y:'90%',x:'50%'}, {id:'Dd',y:'75%',x:'15%'}, {id:'Dc-1',y:'75%',x:'38%'}, {id:'Dc-2',y:'75%',x:'62%'}, {id:'Ds',y:'75%',x:'85%'}, {id:'E/W-1',y:'55%',x:'15%'}, {id:'M/C',y:'55%',x:'38%'}, {id:'C',y:'55%',x:'62%'}, {id:'E/W-2',y:'55%',x:'85%'}, {id:'T/A',y:'40%',x:'50%'}, {id:'A/Pc',y:'25%',x:'50%'} ],
    '4-2-3-1': [ {id:'POR',y:'90%',x:'50%'}, {id:'Dd',y:'75%',x:'15%'}, {id:'Dc-1',y:'75%',x:'38%'}, {id:'Dc-2',y:'75%',x:'62%'}, {id:'Ds',y:'75%',x:'85%'}, {id:'M',y:'55%',x:'35%'}, {id:'M/C',y:'55%',x:'65%'}, {id:'W/T',y:'35%',x:'20%'}, {id:'T',y:'35%',x:'50%'}, {id:'W/A',y:'35%',x:'80%'}, {id:'A/Pc',y:'20%',x:'50%'} ],
  };

  const saveNotes = (e) => {
    setNotes(e.target.value);
    localStorage.setItem(`notes_${myTeamName}`, e.target.value);
  };

  const handleModuleChange = (e) => {
    const mod = e.target.value;
    setSelectedModule(mod);
    localStorage.setItem(`module_${myTeamName}`, mod);
    // Optional: clear out formation when changing module
    // setFormazione({});
  };

  const confirmPlayerSelection = (player) => {
    if (selectingForPos) {
      const newFormazione = { ...formazione, [selectingForPos]: player };
      setFormazione(newFormazione);
      localStorage.setItem(`formazione_${myTeamName}`, JSON.stringify(newFormazione));
      setSelectingForPos(null);
    }
  };

  const getMantraColor = (roleStr) => {
    if (!roleStr) return 'rgba(255,255,255,0.3)';
    const r = roleStr.toLowerCase();
    
    // Exact mapping logic for Mantra roles
    if (r.includes('por')) return '#f59e0b'; // Portiere: Orange
    if (/\b(ds|dc|dd|b)\b/.test(r)) return '#22c55e'; // Difensori base (DS, DC, DD, B): Green
    if (/\b(e|m|c)\b/.test(r) && !r.includes('dc') && !r.includes('pc')) return '#3b82f6'; // Centrocampisti base (E, M, C): Blue
    if (/\b(w|t)\b/.test(r)) return '#d946ef'; // Trequartisti base (W, T): Fuchsia/Magenta
    if (/\b(a|pc)\b/.test(r)) return '#ef4444'; // Attaccanti base (A, PC): Red
    
    return 'rgba(255,255,255,0.3)';
  };

  const renderPitchPlayer = (pos, top, left) => {
    const player = formazione[pos];
    const displayPos = pos.split('-')[0];
    const roleForColor = player ? player.role : displayPos;
    const bgColor = getMantraColor(roleForColor);
    
    return (
      <div 
        key={pos}
        onClick={() => setSelectingForPos(pos)}
        style={{ position: 'absolute', top, left, transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', zIndex: 10 }}
      >
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: bgColor, border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold', color: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
          {player ? player.role.substring(0, 3) : displayPos}
        </div>
        {player && (
          <div style={{ background: 'rgba(0,0,0,0.8)', padding: '2px 5px', borderRadius: '4px', fontSize: '0.7rem', marginTop: '5px', whiteSpace: 'nowrap', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}>
            {player.name}
          </div>
        )}
      </div>
    );
  };

  const getFpfTierInfo = (balance) => {
    if (balance >= 0) return { fascia: 1, slot: 30, bonusCasa: 3, bonusTrasferta: 1 };
    if (balance >= -100) return { fascia: 2, slot: 29, bonusCasa: 3, bonusTrasferta: 1 };
    if (balance >= -200) return { fascia: 3, slot: 28, bonusCasa: 3, bonusTrasferta: 0 };
    if (balance >= -300) return { fascia: 4, slot: 27, bonusCasa: 2, bonusTrasferta: 0 };
    if (balance >= -400) return { fascia: 5, slot: 26, bonusCasa: 1, bonusTrasferta: 0 };
    return { fascia: 6, slot: 25, bonusCasa: 0, bonusTrasferta: 0 };
  };

  const getDiscountedPrice = (pfa) => {
    if (pfa >= 1 && pfa <= 17) return Math.floor(pfa * 0.90);
    if (pfa >= 18 && pfa <= 46) return Math.floor(pfa * 0.80);
    if (pfa >= 47 && pfa <= 92) return Math.floor(pfa * 0.70);
    return Math.floor(pfa * 0.55);
  };

  const getFpfColor = (fascia) => {
    const colors = {
      1: 'var(--fpf-f1)',
      2: 'var(--fpf-f2)',
      3: 'var(--fpf-f3)',
      4: 'var(--fpf-f4)',
    };
    return colors[fascia] || 'var(--text-muted)';
  };

  const getMacroRole = (role) => {
    // If the role is already a macro role name (e.g. from the roleOrder loop)
    const roleColors = {
      'PORTIERI': '#ffc107',
      'DIFENSORI VARI': '#10b981',
      'CENTROCAMPISTI': '#0ea5e9',
      'T E W': '#8b5cf6',
      'A E PC': '#ef4444'
    };
    if (roleColors[role]) {
      return { name: role, color: roleColors[role] };
    }

    // Otherwise, parse the raw player role string
    const r = role.toLowerCase();
    if (r.includes('por')) return { name: 'PORTIERI', color: roleColors['PORTIERI'] }; 
    if (/\b(dc|dd|ds)\b/i.test(r) || r.includes('e')) return { name: 'DIFENSORI VARI', color: roleColors['DIFENSORI VARI'] }; 
    if (/\b(m|c)\b/i.test(r) && !r.includes('pc') && !r.includes('dc')) return { name: 'CENTROCAMPISTI', color: roleColors['CENTROCAMPISTI'] }; 
    if (/\b(t|w)\b/i.test(r)) return { name: 'T E W', color: roleColors['T E W'] }; 
    if (/\b(a|pc)\b/i.test(r)) return { name: 'A E PC', color: roleColors['A E PC'] }; 
    return { name: 'ALTRO', color: '#6b7280' };
  };

  if (!myTeamName) {
    if (auth?.role === 'participant') {
      return <div style={{ color: 'white', textAlign: 'center', marginTop: '20vh' }}>Caricamento squadra... se l'errore persiste fai logout. <button onClick={logout}>Esci</button></div>;
    }
    return (
      <div className="page-container" style={{ textAlign: 'center', marginTop: '20vh' }}>
        <h2>Chi sei? (Master View)</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
          {teams.map(t => (
            <button key={t.name} onClick={() => setMyTeamName(t.name)} style={{ padding: '1rem', fontSize: '1.2rem' }}>
              {t.name}
            </button>
          ))}
        </div>
        <button onClick={logout} style={{ marginTop: '2rem', padding: '1rem', background: '#e60000', color: 'white', border: 'none', borderRadius: '8px' }}>Esci</button>
      </div>
    );
  }
  
  if (!myTeam) {
    return (
      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'white', textAlign: 'center', padding: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Caricamento dati squadra...</h2>
        <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '2rem' }}>
          {teams.length === 0 ? 'Connessione al server in corso...' : `Recupero rosa e dati della squadra "${myTeamName}"...`}
        </p>
        <button 
          onClick={logout} 
          style={{ padding: '0.8rem 1.5rem', background: '#e60000', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Esci e Riavvia Accesso
        </button>
      </div>
    );
  }

  const isMyPlayerAtBivio = auction?.status === 'BIVIO' && auction?.currentPlayer?.currentOwner === myTeamName;

  const groupedRoster = myTeam.roster.reduce((acc, p) => {
    const macro = getMacroRole(p.role);
    if (!acc[macro.name]) acc[macro.name] = { color: macro.color, players: [] };
    acc[macro.name].players.push(p);
    return acc;
  }, {});

  const roleOrder = ['PORTIERI', 'DIFENSORI VARI', 'CENTROCAMPISTI', 'T E W', 'A E PC', 'ALTRO'];

  return (
    <div className="page-container" style={{ paddingBottom: '80px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
        {/* SkySport Style Header */}
      <div style={{ background: 'linear-gradient(180deg, var(--bg-dark) 0%, rgba(0, 10, 41, 1) 100%)', borderBottom: '3px solid var(--accent-red)', padding: '15px', marginBottom: '1rem', borderRadius: '0 0 15px 15px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <img src={myTeam.logoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(myTeam.name)}&background=random&color=fff&bold=true`} alt="logo" style={{ width: '50px', height: '50px', borderRadius: '50%', border: `3px solid ${getFpfColor(myTeam.fpf?.fascia || 1)}`, objectFit: 'cover' }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, color: 'white', fontSize: '1.2rem', fontWeight: 'bold' }}>{myTeam.name}</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {myTeam.name.toLowerCase() === 'salassuolo' && (
                  <>
                    <img src="/scudetto.svg" alt="Scudetto" style={{ height: '24px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                    <img src="/coppa.svg" alt="Supercoppa" style={{ height: '24px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                  </>
                )}
                {(myTeam.name.toLowerCase() === 'pertusio' || myTeam.name.toLowerCase().includes('pertusio')) && (
                  <img src="/coppa.svg" alt="Coppa" style={{ height: '24px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                )}
                <button 
                  onClick={() => window.location.reload(true)} 
                  title="Forza Ricarica" 
                  style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid #3b82f6', color: '#60a5fa', borderRadius: '6px', cursor: 'pointer', padding: '4px 8px', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  🔄 Aggiorna App
                </button>
                <button onClick={logout} style={{ background: 'transparent', border: 'none', color: '#e60000', cursor: 'pointer', padding: '4px' }}><LogOut size={20} /></button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
              <span style={{ fontSize: '0.9rem', color: getFpfColor(myTeam.fpf?.fascia || 1), fontWeight: 'bold' }}>Fascia {myTeam.fpf?.fascia || 1}</span>
              <span style={{ fontSize: '1.1rem', color: myTeam.balance >= 0 ? '#10b981' : '#ef4444', fontWeight: '900' }}>{myTeam.balance} cr</span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Giocatori: <strong style={{color: 'white'}}>{myTeam.roster.length} / {myTeam.fpf?.slot || 25}</strong></span>
          <span style={{ color: 'var(--text-muted)' }}>Bonus Campo: <strong style={{color: '#3b82f6'}}>+{myTeam.fpf?.bonusCasa || 0} / +{myTeam.fpf?.bonusTrasferta || 0}</strong></span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'live' && (
          <div className="tab-content">
            <MiniDashboard auction={auction} />
            {/* Active Auction */}
            <div className="fpf-panel" style={{ textAlign: 'center', position: 'relative' }}>
              {auction?.status === 'ACTIVE' || auction?.status === 'BIVIO' ? (
                <>
                  <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--fpf-f1)' }}>{auction.currentPlayer.name}</h3>
                  <span style={{ background: 'var(--bg-dark)', padding: '0.2rem 0.8rem', borderRadius: '1rem', fontSize: '0.9rem' }}>{auction.currentPlayer.role}</span>
                  
                  <div style={{ margin: '2rem 0' }}>
                    <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>Offerta attuale</p>
                    <p style={{ fontSize: '4rem', fontWeight: '900', margin: '0.5rem 0', color: '#fbbf24' }}>
                      {auction.currentBid} <span style={{ fontSize: '1.5rem' }}>cr</span>
                    </p>
                    <p>Miglior offerente: <strong>{auction.currentBidder || 'Nessuno'}</strong></p>
                  </div>

                  {auction.status === 'ACTIVE' && (
                    <>
                      {myTeam.roster.length >= (myTeam.fpf?.slot || 25) ? (
                        <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.2)', border: '2px solid #ef4444', borderRadius: '10px' }}>
                          <h4 style={{ color: '#ef4444', margin: '0 0 10px 0', textTransform: 'uppercase' }}>Operazione Negata</h4>
                          <p style={{ color: 'white', fontWeight: 'bold' }}>Hai raggiunto il limite massimo di slot consentiti per la tua fascia ({myTeam.fpf?.slot || 25}). Non puoi partecipare a questa asta.</p>
                        </div>
                      ) : auction.currentPlayer?.currentOwner === myTeamName ? (
                        <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.2)', border: '2px solid #3b82f6', borderRadius: '10px' }}>
                          <h4 style={{ color: '#3b82f6', margin: '0 0 10px 0', textTransform: 'uppercase' }}>Sei il Proprietario</h4>
                          <p style={{ color: 'white', fontWeight: 'bold' }}>Attendi le offerte degli altri. Se l'asta andrà a buon fine, deciderai al bivio se venderlo o trattenerlo.</p>
                        </div>
                      ) : (
                        <>
                          <div style={{ marginBottom: '1rem' }}>
                        <input 
                          type="number"
                          value={bidAmount}
                          onChange={e => setBidAmount(e.target.value)}
                          placeholder={`Punta min. ${auction.currentBid + 1}`}
                          style={{
                            width: '100%', padding: '1rem', fontSize: '1.5rem', textAlign: 'center',
                            borderRadius: '10px', border: '2px solid #3b82f6', background: 'white', color: 'black'
                          }}
                        />
                      </div>

                      <button 
                        className="btn-bid" 
                        onClick={handleBid}
                        disabled={auction.currentBidder === myTeamName || (bidAmount !== '' && parseInt(bidAmount) <= auction.currentBid)}
                        style={{
                          background: auction.currentBidder === myTeamName ? 'rgba(34, 197, 94, 0.2)' : bidAmount ? 'linear-gradient(135deg, #fbbf24, #d97706)' : 'linear-gradient(135deg, #10b981, #059669)',
                          color: 'white',
                          border: auction.currentBidder === myTeamName ? '2px solid #22c55e' : 'none'
                        }}
                      >
                        <DollarSign size={24} style={{ marginRight: '10px' }} />
                        {auction.currentBidder === myTeamName 
                          ? 'SEI IN VANTAGGIO' 
                          : bidAmount 
                            ? `RILANCIA A ${bidAmount} cr` 
                            : `RILANCIA +1 cr (${auction.currentBid + 1} cr)`}
                      </button>

                      <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', border: '2px solid #3b82f6', borderRadius: '10px' }}>
                        <h4 style={{ color: '#3b82f6', margin: '0 0 10px 0', textTransform: 'uppercase' }}>
                          La tua proiezione se vinci a {bidAmount || auction.currentBid} cr
                        </h4>
                        {(() => {
                          const projectedCost = parseInt(bidAmount) || auction.currentBid;
                          const projectedBal = myTeam.balance - projectedCost;
                          const projectedInfo = getFpfTierInfo(projectedBal);
                          return (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.9rem', textAlign: 'left' }}>
                              <div><strong style={{color:'var(--text-muted)'}}>Nuovo Saldo:</strong> <span style={{color: projectedBal >= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold'}}>{projectedBal} cr</span></div>
                              <div><strong style={{color:'var(--text-muted)'}}>Fascia FPF:</strong> <span style={{fontWeight: 'bold', color: getFpfColor(projectedInfo.fascia)}}>{projectedInfo.fascia}</span></div>
                              <div><strong style={{color:'var(--text-muted)'}}>Slot Max:</strong> <span style={{fontWeight: 'bold'}}>{projectedInfo.slot}</span></div>
                              <div><strong style={{color:'var(--text-muted)'}}>Bonus Campo:</strong> <span style={{fontWeight: 'bold'}}>+{projectedInfo.bonusCasa} / +{projectedInfo.bonusTrasferta}</span></div>
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  )}
                  </>
                )}

                  {auction.status === 'BIVIO' && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.2)', borderRadius: '10px' }}>
                      <p style={{ color: '#ef4444', fontWeight: 'bold' }}>Asta chiusa!</p>
                      {isMyPlayerAtBivio ? (
                        <p>Guarda il monitor principale e dichiara VENDO o PROTEGGI al segretario!</p>
                      ) : (
                        <p>In attesa della decisione di <strong>{auction.currentPlayer.currentOwner}</strong>...</p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                 <p style={{ color: 'var(--text-muted)' }}>Nessuna asta in corso. Attendi la prossima chiamata.</p>
              )}

              {/* SELF-CALL section - only when no auction running and allowSelfCall is on */}
              {auction?.allowSelfCall && (!auction?.status || auction?.status === 'IDLE') && (
                <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(59,130,246,0.1)', border: '2px solid #3b82f6', borderRadius: '12px', textAlign: 'left' }}>
                  <h4 style={{ color: '#3b82f6', margin: '0 0 12px 0', textAlign: 'center' }}>📣 Chiama un Giocatore all'Asta</h4>
                  
                  {/* Search player */}
                  <input
                    type="text"
                    placeholder="Cerca giocatore nel listone..."
                    value={selfCallSearch}
                    onChange={e => { setSelfCallSearch(e.target.value); setSelfCallPlayer(null); }}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #3b82f6', background: 'rgba(0,0,0,0.5)', color: 'white', marginBottom: '8px', boxSizing: 'border-box' }}
                  />
                  
                  {/* Autocomplete results */}
                  {selfCallSearch.length >= 2 && !selfCallPlayer && (
                    <div style={{ background: '#1e293b', borderRadius: '8px', maxHeight: '180px', overflowY: 'auto', marginBottom: '8px' }}>
                      {listone.filter(p => {
                        const name = (p.Nome || p.name || '').toLowerCase();
                        const isOwned = teams.some(t => (t.roster || []).some(r => (r.name || r.Nome || '').toLowerCase() === name));
                        return !isOwned && name.includes(selfCallSearch.toLowerCase());
                      }).slice(0, 20).map((p, idx) => (
                        <div
                          key={idx}
                          onClick={() => { setSelfCallPlayer(p); setSelfCallSearch(p.Nome || p.name || ''); setSelfCallPrice(p.Quotazione || 1); }}
                          style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', color: 'white', display: 'flex', justifyContent: 'space-between' }}
                        >
                          <span><strong style={{ color: '#3b82f6' }}>{p.Ruolo || p.role}</strong> {p.Nome || p.name}</span>
                          <span style={{ color: '#fbbf24' }}>{p.Quotazione || 0} cr</span>
                        </div>
                      ))}
                      {listone.filter(p => {
                        const name = (p.Nome || p.name || '').toLowerCase();
                        const isOwned = teams.some(t => (t.roster || []).some(r => (r.name || r.Nome || '').toLowerCase() === name));
                        return !isOwned && name.includes(selfCallSearch.toLowerCase());
                      }).length === 0 && (
                        <div style={{ padding: '10px', color: '#aaa', textAlign: 'center' }}>Nessun giocatore trovato</div>
                      )}
                    </div>
                  )}

                  {/* Non-listed player option */}
                  <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '8px', textAlign: 'center' }}>oppure chiama un giocatore non in lista</div>

                  {/* Starting price */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ color: 'white', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>Base d'asta:</span>
                    <input
                      type="number"
                      value={selfCallPrice}
                      onChange={e => setSelfCallPrice(Math.max(1, parseInt(e.target.value) || 1))}
                      min={1}
                      style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #fbbf24', background: 'rgba(0,0,0,0.5)', color: 'white', textAlign: 'center', fontSize: '1.1rem' }}
                    />
                    <span style={{ color: '#fbbf24' }}>cr</span>
                  </div>

                  <button
                    onClick={() => {
                      const playerName = selfCallPlayer ? (selfCallPlayer.Nome || selfCallPlayer.name) : selfCallSearch.trim();
                      if (!playerName) { alert('Seleziona o scrivi un giocatore!'); return; }
                      const playerObj = selfCallPlayer ? {
                        name: playerName,
                        role: selfCallPlayer.Ruolo || selfCallPlayer.role || 'Pc',
                        oldRinnovo: null,
                        currentOwner: null,
                        stats: {},
                        imgUrl: selfCallPlayer.imgUrl || null,
                        Quotazione: selfCallPlayer.Quotazione || selfCallPrice,
                        calledByTeam: myTeamName
                      } : {
                        name: playerName,
                        role: 'Pc',
                        oldRinnovo: null,
                        currentOwner: null,
                        stats: {},
                        imgUrl: null,
                        Quotazione: selfCallPrice,
                        calledByTeam: myTeamName
                      };
                      if (window.confirm(`Chiami ${playerName} all'asta con base d'asta ${selfCallPrice} cr?`)) {
                        socket.emit('start_auction', playerObj);
                        setSelfCallSearch('');
                        setSelfCallPlayer(null);
                        setSelfCallPrice(1);
                      }
                    }}
                    style={{ width: '100%', padding: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}
                  >
                    📣 Manda in Asta
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'roster' && (
          <div className="tab-content">
            <div className="fpf-panel" style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '15px' }}>
              <h2 style={{ marginBottom: '1rem' }}>La Mia Rosa</h2>
              
              {/* Contatore Macro Ruoli */}
              <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', marginBottom: '1.5rem', border: '1px solid #ccc' }}>
                {roleOrder.filter(r => r !== 'ALTRO').map((roleName) => {
                  const group = groupedRoster[roleName] || { players: [] };
                  const roleConfig = getMacroRole(roleName);
                  return (
                    <div key={roleName} style={{ display: 'flex', borderBottom: '1px solid #ccc' }}>
                      <div style={{ flex: 1, background: roleConfig.color, color: roleName === 'PORTIERI' ? 'black' : 'white', fontWeight: 'bold', padding: '8px', textAlign: 'center', textTransform: 'uppercase' }}>
                        {roleName}
                      </div>
                      <div style={{ width: '50px', background: 'white', color: 'black', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>
                        {group.players.length}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 30 Slot Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {(() => {
                  const sortedRoster = [...(myTeam.roster || [])].sort((a, b) => {
                    const roleA = getMacroRole(a.role).name;
                    const roleB = getMacroRole(b.role).name;
                    return roleOrder.indexOf(roleA) - roleOrder.indexOf(roleB);
                  });
                  
                  return Array.from({ length: 30 }).map((_, idx) => {
                    const player = sortedRoster[idx];
                  const slotAllowed = (myTeam.fpf?.slot || 25);
                  const isBlocked = idx >= slotAllowed;

                  if (player) {
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: '10px', background: 'white', borderRadius: '4px', border: '1px solid #ccc' }}>
                        <div style={{ width: '25px', color: '#666', fontWeight: 'bold', fontSize: '0.8rem' }}>{idx + 1}</div>
                        <div style={{ width: '40px', background: getMantraColor(player.role), color: 'white', textAlign: 'center', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.8rem', marginRight: '10px' }}>{player.role}</div>
                        <div style={{ flex: 1, color: 'black', fontWeight: 'bold' }}>
                          {player.name}
                          {player.oldRinnovo ? <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: 'normal', marginLeft: '5px' }}>(Rinnovo: {player.oldRinnovo} cr)</span> : ''}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ color: '#666', fontWeight: 'bold' }}>{player.cost} cr</div>
                          {auction?.allowFreeRelease && (
                            <button 
                              onClick={() => {
                                if (window.confirm(`Vuoi davvero svincolare ${player.name} a 0 crediti?\n\nNon riavrai indietro i crediti spesi, ma libererai uno slot in rosa.`)) {
                                  socket.emit('release_player', { playerName: player.name, teamName: myTeamName, refundAmount: 0 });
                                }
                              }}
                              style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              🗑️ Svincola a 0 cr
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  } else if (!isBlocked) {
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: '10px', background: '#f5f5f5', borderRadius: '4px', border: '1px dashed #ccc' }}>
                        <div style={{ width: '25px', color: '#999', fontSize: '0.8rem' }}>{idx + 1}</div>
                        <div style={{ flex: 1, color: '#999', fontStyle: 'italic' }}>Slot Libero</div>
                      </div>
                    );
                  } else {
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: '10px', background: '#000', borderRadius: '4px' }}>
                        <div style={{ width: '25px', color: '#555', fontSize: '0.8rem' }}>{idx + 1}</div>
                        <div style={{ flex: 1, color: '#555', fontStyle: 'italic' }}>Slot Bloccato (Fascia FPF)</div>
                      </div>
                    );
                  }
                });
              })()}
              </div>
            </div>
          </div>
        )}

      {/* 6. TAB LISTONE SVINCOLATI & MERCATO */}
      {activeTab === 'listone' && (
        <div style={{ paddingBottom: '70px' }}>
          {/* Sub-Header Pills */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '1rem', background: 'rgba(0,0,0,0.4)', padding: '4px', borderRadius: '12px' }}>
            <button 
              onClick={() => { setListoneFilterType('svincolati'); setListoneVisibleCount(40); }}
              style={{ flex: 1, padding: '8px 2px', borderRadius: '8px', border: 'none', background: listoneFilterType === 'svincolati' && !onlyAstabiliInAltreRose ? 'var(--fpf-f1)' : 'transparent', color: 'white', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }}
            >
              🟢 Svincolati
            </button>
            <button 
              onClick={() => { setListoneFilterType('altre'); setListoneVisibleCount(40); }}
              style={{ flex: 1, padding: '8px 2px', borderRadius: '8px', border: 'none', background: listoneFilterType === 'altre' && !onlyAstabiliInAltreRose ? '#3b82f6' : 'transparent', color: 'white', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }}
            >
              📌 Altre Rose
            </button>
            <button 
              onClick={() => { setOnlyAstabiliInAltreRose(prev => !prev); setListoneVisibleCount(40); }}
              style={{ flex: 1, padding: '8px 2px', borderRadius: '8px', border: onlyAstabiliInAltreRose ? '2px solid #22c55e' : 'none', background: onlyAstabiliInAltreRose ? '#22c55e' : 'rgba(34, 197, 94, 0.2)', color: 'white', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }}
            >
              {onlyAstabiliInAltreRose ? '🟢 Solo Astabili: ON' : '⚡ Solo Astabili'}
            </button>
            <button 
              onClick={() => { setListoneFilterType('tutti'); setListoneVisibleCount(40); }}
              style={{ flex: 1, padding: '8px 2px', borderRadius: '8px', border: 'none', background: listoneFilterType === 'tutti' && !onlyAstabiliInAltreRose ? '#8b5cf6' : 'transparent', color: 'white', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }}
            >
              🌐 Tutti
            </button>
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <input 
              type="text" 
              placeholder="🔍 Cerca calciatore per nome..." 
              value={listoneSearch}
              onChange={(e) => { setListoneSearch(e.target.value); setListoneVisibleCount(40); }}
              style={{ width: '100%', padding: '12px 15px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.4)', color: 'white', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>

          {/* Filters Grid (2x2 Layout) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: '#aaa', marginBottom: '4px' }}>Ruolo Mantra</label>
              <select 
                value={listoneRoleFilter}
                onChange={(e) => { setListoneRoleFilter(e.target.value); setListoneVisibleCount(40); }}
                style={{ width: '100%', padding: '8px 4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: '#00154d', color: 'white', fontSize: '0.8rem' }}
              >
                <option value="TUTTI">Tutti i ruoli</option>
                <option value="POR">Portieri (POR)</option>
                <option value="DEF">Difensori (DEF)</option>
                <option value="MED">Mediana (MED)</option>
                <option value="FAN">Fantasisti (FAN)</option>
                <option value="ATT">Attaccanti (ATT)</option>
                <option value="Pc">Pc (Punta centrale)</option>
                <option value="Dc">Dc (Difensore centrale)</option>
                <option value="Dd">Dd (Terzino destro)</option>
                <option value="Ds">Ds (Terzino sinistro)</option>
                <option value="E">E (Esterno)</option>
                <option value="M">M (Mediano)</option>
                <option value="C">C (Centrocampista)</option>
                <option value="T">T (Trequartista)</option>
                <option value="W">W (Wing/Ala)</option>
                <option value="A">A (Attaccante angolare)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: '#aaa', marginBottom: '4px' }}>Ordina per</label>
              <select 
                value={listoneSortBy}
                onChange={(e) => setListoneSortBy(e.target.value)}
                style={{ width: '100%', padding: '8px 4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: '#00154d', color: 'white', fontSize: '0.8rem' }}
              >
                <option value="qtA">Qt.A (Decrescente)</option>
                <option value="fvm">FVM (Decrescente)</option>
                <option value="nome">Nome (A-Z)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: '#aaa', marginBottom: '4px' }}>Squadra Serie A</label>
              <select 
                value={listoneTeamFilter}
                onChange={(e) => { setListoneTeamFilter(e.target.value); setListoneVisibleCount(40); }}
                style={{ width: '100%', padding: '8px 4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: '#00154d', color: 'white', fontSize: '0.8rem' }}
              >
                <option value="TUTTE">Tutte le squadre Serie A</option>
                {serieATeams.map(sq => (
                  <option key={sq} value={sq}>{sq}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: '#fbbf24', marginBottom: '4px' }}>Fanta Squadra (Partecipanti)</label>
              <select 
                value={listoneFantaTeamFilter}
                onChange={(e) => { setListoneFantaTeamFilter(e.target.value); setListoneVisibleCount(40); }}
                style={{ width: '100%', padding: '8px 4px', borderRadius: '8px', border: '1px solid #fbbf24', background: '#00154d', color: 'white', fontSize: '0.8rem', fontWeight: 'bold' }}
              >
                <option value="TUTTE">Tutte le Fanta Squadre</option>
                {fantaTeamsList.map(sq => (
                  <option key={sq} value={sq}>📌 {sq}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Toggle Switch: Solo Calciatori Astabili */}
          <div 
            onClick={() => {
              setOnlyAstabiliInAltreRose(prev => !prev);
              setListoneVisibleCount(40);
            }}
            style={{
              margin: '0.5rem 0 1rem 0', 
              padding: '10px 14px',
              background: onlyAstabiliInAltreRose 
                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.1))' 
                : 'rgba(255,255,255,0.05)',
              border: `1.5px solid ${onlyAstabiliInAltreRose ? '#22c55e' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: '12px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer',
              boxShadow: onlyAstabiliInAltreRose ? '0 4px 12px rgba(34, 197, 94, 0.25)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.3rem' }}>{onlyAstabiliInAltreRose ? '🟢' : '📋'}</span>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: onlyAstabiliInAltreRose ? '#22c55e' : 'white' }}>
                  {onlyAstabiliInAltreRose ? '🟢 Solo Astabili (Chiamabili)' : '📋 Tutti i Calciatori'}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#b3c6ff' }}>
                  {onlyAstabiliInAltreRose 
                    ? 'Nasconde i calciatori già aggiudicati' 
                    : 'Tocca qui per nascondere i calciatori già astati'}
                </div>
              </div>
            </div>

            <div style={{
              width: '44px',
              height: '24px',
              borderRadius: '12px',
              background: onlyAstabiliInAltreRose ? '#22c55e' : 'rgba(255,255,255,0.2)',
              position: 'relative',
              transition: 'background 0.3s'
            }}>
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: 'white',
                position: 'absolute',
                top: '3px',
                left: onlyAstabiliInAltreRose ? '23px' : '3px',
                transition: 'left 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
              }} />
            </div>
          </div>

          {/* Counter info */}
          <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '0.8rem', textAlign: 'right' }}>
            Risultati: <strong style={{ color: 'white' }}>{filteredListone.length}</strong> calciatori
          </div>

          {/* Cards List */}
          {filteredListone.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#aaa' }}>
              Nessun calciatore trovato con i filtri selezionati.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredListone.slice(0, listoneVisibleCount).map((p, idx) => {
                const cleanName = (p.Nome || '').trim().toLowerCase();
                const assignedInfo = assignedMap[cleanName];

                return (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: `4px solid ${getMantraColor(p.Ruolo)}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img 
                        src={`https://content.fantacalcio.it/web/campioncini/small/${formatPlayerNameForUrl(p.Nome)}.png`}
                        alt={p.Nome}
                        onError={(e) => { e.target.style.display = 'none'; }}
                        style={{ width: '38px', height: '38px', objectFit: 'contain', borderRadius: '4px', background: 'rgba(0,0,0,0.2)' }}
                      />
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'white' }}>
                          {p.Nome}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                          <span style={{ fontSize: '0.7rem', background: getMantraColor(p.Ruolo), color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                            {p.Ruolo}
                          </span>
                          {p.Squadra && (
                            <span style={{ fontSize: '0.75rem', color: '#aaa' }}>
                              {p.Squadra}
                            </span>
                          )}
                        </div>
                        {(p.Titolarita > 0 || p.MV > 0 || p.Presenze > 0 || p.FM > 0) && (
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap', background: 'rgba(0,0,0,0.2)', padding: '4px 6px', borderRadius: '4px' }}>
                            {p.Titolarita > 0 && <span style={{ fontSize: '0.65rem', color: '#cbd5e1' }}>🎯 Tit: <strong>{p.Titolarita}</strong></span>}
                            {p.Affidabilita > 0 && <span style={{ fontSize: '0.65rem', color: '#cbd5e1' }}>🛡️ Aff: <strong>{p.Affidabilita}</strong></span>}
                            {p.Integrita > 0 && <span style={{ fontSize: '0.65rem', color: '#cbd5e1' }}>🩹 Int: <strong>{p.Integrita}</strong></span>}
                            {p.Presenze > 0 && <span style={{ fontSize: '0.65rem', color: '#cbd5e1' }}>🏃 Pres: <strong>{p.Presenze}</strong></span>}
                            {p.MV > 0 && <span style={{ fontSize: '0.65rem', color: '#cbd5e1' }}>📊 MV: <strong>{p.MV}</strong></span>}
                            {p.FM > 0 && (
                              <>
                                <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
                                <span style={{ fontSize: '0.65rem', color: '#cbd5e1' }}>FM: <strong style={{ color: '#10b981' }}>{p.FM}</strong></span>
                                <span style={{ fontSize: '0.65rem', color: '#cbd5e1' }}>Gol: <strong style={{ color: '#ef4444' }}>{p.GOL ?? p.gol ?? 0}</strong></span>
                                <span style={{ fontSize: '0.65rem', color: '#cbd5e1' }}>Ass: <strong style={{ color: '#8b5cf6' }}>{p.ASS ?? p.ass ?? 0}</strong></span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      {auctionedSet.has(cleanName) ? (
                        <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          🔴 Non Astabile {assignedInfo ? `— ${assignedInfo.owner}` : ''}
                        </span>
                      ) : assignedInfo ? (
                        <span style={{ fontSize: '0.75rem', background: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', border: '1px solid #fbbf24', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          📌 {assignedInfo.owner} (In Bivio — 🟢 Astabile)
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', border: '1px solid #22c55e', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          🟢 Svincolato (Astabile)
                        </span>
                      )}

                      <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '2px' }}>
                        Qt.A: <strong style={{ color: '#fbbf24' }}>{p.Quotazione || 1} cr</strong>
                        {p.FVM > 0 && <span> | FVM: <strong style={{ color: '#3b82f6' }}>{p.FVM}</strong></span>}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredListone.length > listoneVisibleCount && (
                <button 
                  onClick={() => setListoneVisibleCount(prev => prev + 50)}
                  style={{ marginTop: '1rem', width: '100%', padding: '12px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Mostra altri 50 calciatori ({filteredListone.length - listoneVisibleCount} rimanenti)
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Formazione Tab */}
      {activeTab === 'formazione' && (
        <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0 }}>Modulo</h2>
            <select 
              value={selectedModule} 
              onChange={handleModuleChange}
              style={{ padding: '5px 10px', borderRadius: '5px', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--text-muted)' }}
            >
              {Object.keys(mantraModules).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div style={{ position: 'relative', width: '100%', maxWidth: '400px', margin: '0 auto', aspectRatio: '2/3', background: '#2e7d32', borderRadius: '10px', border: '2px solid white', overflow: 'hidden' }}>
            {/* Pitch lines */}
            <div style={{ position: 'absolute', top: '50%', width: '100%', height: '2px', background: 'rgba(255,255,255,0.5)' }}></div>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '60px', height: '60px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.5)' }}></div>
            <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '120px', height: '60px', borderTop: '2px solid rgba(255,255,255,0.5)', borderLeft: '2px solid rgba(255,255,255,0.5)', borderRight: '2px solid rgba(255,255,255,0.5)' }}></div>

            {/* Dynamic Players */}
            {mantraModules[selectedModule]?.map(pos => renderPitchPlayer(pos.id, pos.y, pos.x))}
          </div>
          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '10px' }}>Tocca un pallino per assegnare un giocatore dalla tua rosa.</p>
        </div>
      )}

      {/* Altre Rose Tab */}
      {activeTab === 'altre-rose' && (
        <div className="tab-content" style={{ padding: '15px', paddingBottom: '80px' }}>
          <h2 style={{ marginBottom: '1rem', color: '#fbbf24' }}>👥 Rose degli Altri</h2>
          {teams.filter(t => t.name !== myTeamName).map(team => {
            const sortedRoster = [...(team.roster || [])].sort((a, b) => {
              const roleA = (() => {
                const r = (a.role || '').toLowerCase();
                if (r.includes('por')) return 0;
                if (/\b(dc|dd|ds)\b/i.test(r) || r.includes('e')) return 1;
                if (/\b(m|c)\b/i.test(r) && !r.includes('pc') && !r.includes('dc')) return 2;
                if (/\b(t|w)\b/i.test(r)) return 3;
                if (/\b(a|pc)\b/i.test(r)) return 4;
                return 5;
              })();
              const roleB = (() => {
                const r = (b.role || '').toLowerCase();
                if (r.includes('por')) return 0;
                if (/\b(dc|dd|ds)\b/i.test(r) || r.includes('e')) return 1;
                if (/\b(m|c)\b/i.test(r) && !r.includes('pc') && !r.includes('dc')) return 2;
                if (/\b(t|w)\b/i.test(r)) return 3;
                if (/\b(a|pc)\b/i.test(r)) return 4;
                return 5;
              })();
              return roleA - roleB;
            });
            const roleGroupColors = ['#ffc107','#10b981','#0ea5e9','#8b5cf6','#ef4444','#6b7280'];
            const roleGroupLabels = ['PORTIERI','DIFENSORI VARI','CENTROCAMPISTI','T E W','A E PC','ALTRO'];
            const getRoleGroup = (role) => {
              const r = (role || '').toLowerCase();
              if (r.includes('por')) return 0;
              if (/\b(dc|dd|ds)\b/i.test(r) || r.includes('e')) return 1;
              if (/\b(m|c)\b/i.test(r) && !r.includes('pc') && !r.includes('dc')) return 2;
              if (/\b(t|w)\b/i.test(r)) return 3;
              if (/\b(a|pc)\b/i.test(r)) return 4;
              return 5;
            };
            let lastGroup = -1;
            return (
              <div key={team.name} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h3 style={{ margin: 0, color: '#fbbf24' }}>{team.name}</h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: '#aaa', fontSize: '0.85rem' }}>{team.roster?.length || 0} giocatori</span>
                    <span style={{ color: team.balance >= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold', fontSize: '0.85rem' }}>{team.balance || 0} cr FPF</span>
                  </div>
                </div>
                {sortedRoster.map((p, idx) => {
                  const group = getRoleGroup(p.role);
                  const showHeader = group !== lastGroup;
                  lastGroup = group;
                  return (
                    <React.Fragment key={idx}>
                      {showHeader && (
                        <div style={{ background: roleGroupColors[group], color: group === 0 ? 'black' : 'white', padding: '3px 8px', fontSize: '0.75rem', fontWeight: 'bold', borderRadius: '4px', marginTop: idx > 0 ? '6px' : '0', marginBottom: '3px' }}>
                          {roleGroupLabels[group]}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', marginBottom: '2px' }}>
                        <span style={{ background: getMantraColor(p.role), color: 'white', padding: '2px 5px', borderRadius: '3px', fontSize: '0.75rem', fontWeight: 'bold', marginRight: '8px', minWidth: '28px', textAlign: 'center' }}>{p.role}</span>
                        <span style={{ flex: 1, color: 'white', fontSize: '0.9rem' }}>{p.name || p.Nome}</span>
                        <span style={{ color: '#aaa', fontSize: '0.8rem' }}>{p.cost} cr</span>
                      </div>
                    </React.Fragment>
                  );
                })}
                {sortedRoster.length === 0 && <div style={{ color: '#aaa', textAlign: 'center', fontStyle: 'italic', padding: '10px' }}>Rosa vuota</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Scambi Tab */}
      {activeTab === 'scambi' && (
        <div className="tab-content" style={{ padding: '15px', paddingBottom: '80px' }}>
          {!auction?.allowTrades ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#aaa' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
              <h3 style={{ color: 'white' }}>Scambi non attivi</h3>
              <p>Il master deve attivare la funzione scambi dalla Console.</p>
            </div>
          ) : (
            <>
              {/* Incoming trade proposals */}
              {(() => {
                const myIncoming = trades.filter(t => t.toTeam === myTeamName && t.status === 'PENDING');
                return myIncoming.length > 0 ? (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ color: '#ef4444', marginBottom: '10px' }}>⚠️ Proposte Ricevute ({myIncoming.length})</h3>
                    {myIncoming.map(trade => (
                      <div key={trade.id} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
                        <p style={{ color: 'white', margin: '0 0 8px 0', fontWeight: 'bold' }}>Da: {trade.fromTeam}</p>
                        <p style={{ color: '#aaa', fontSize: '0.85rem', margin: '0 0 4px 0' }}>Ti offrono: <strong style={{ color: 'white' }}>{(trade.offeredPlayers || []).map(p => p.name || p.Nome).join(', ')}</strong></p>
                        <p style={{ color: '#aaa', fontSize: '0.85rem', margin: '0 0 8px 0' }}>Vogliono: <strong style={{ color: 'white' }}>{(trade.requestedPlayers || []).map(p => p.name || p.Nome).join(', ')}</strong></p>
                        {trade.creditOffset !== 0 && <p style={{ color: '#fbbf24', fontSize: '0.85rem', margin: '0 0 8px 0' }}>{trade.creditOffset > 0 ? `+${trade.creditOffset} cr conguaglio a te` : `${trade.creditOffset} cr conguaglio a loro`}</p>}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <button onClick={() => socket.emit('respond_trade', { tradeId: trade.id, action: 'ACCEPT' })} style={{ flex: 1, padding: '10px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>✅ Accetta</button>
                          <button onClick={() => socket.emit('respond_trade', { tradeId: trade.id, action: 'REJECT' })} style={{ flex: 1, padding: '10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>❌ Rifiuta</button>
                        </div>
                        <button
                          onClick={() => {
                            const counterCredit = parseInt(window.prompt('Conguaglio crediti (positivo = ricevi, negativo = dai):', '0') || '0');
                            socket.emit('respond_trade', { tradeId: trade.id, action: 'COUNTER', counterOffer: {
                              offeredPlayers: trade.requestedPlayers,
                              requestedPlayers: trade.offeredPlayers,
                              creditOffset: counterCredit
                            }});
                          }}
                          style={{ width: '100%', marginTop: '6px', padding: '8px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                        >↩️ Controproposta</button>
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}

              {/* Outgoing proposals */}
              {(() => {
                const myOutgoing = trades.filter(t => t.fromTeam === myTeamName && t.status === 'PENDING');
                return myOutgoing.length > 0 ? (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ color: '#fbbf24', marginBottom: '10px' }}>📤 Proposte Inviate</h3>
                    {myOutgoing.map(trade => (
                      <div key={trade.id} style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid #fbbf24', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
                        <p style={{ color: 'white', margin: '0 0 4px 0' }}>➡️ A: {trade.toTeam} — <span style={{ color: '#aaa', fontSize: '0.85rem' }}>In attesa risposta</span></p>
                        <p style={{ color: '#aaa', fontSize: '0.8rem', margin: 0 }}>Offri: {(trade.offeredPlayers || []).map(p => p.name || p.Nome).join(', ')} | Vuoi: {(trade.requestedPlayers || []).map(p => p.name || p.Nome).join(', ')}</p>
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}

              {/* New trade proposal */}
              <div style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid #8b5cf6', borderRadius: '12px', padding: '15px' }}>
                <h3 style={{ color: '#8b5cf6', margin: '0 0 15px 0' }}>🔄 Nuova Proposta di Scambio</h3>
                
                {/* Step 1: Choose target team */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ color: 'white', fontSize: '0.9rem', display: 'block', marginBottom: '6px' }}>1. Squadra con cui vuoi trattare:</label>
                  <select value={tradeTargetTeam} onChange={e => { setTradeTargetTeam(e.target.value); setTradeOfferedPlayers([]); setTradeRequestedPlayers([]); }} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', color: 'white', border: '1px solid #8b5cf6' }}>
                    <option value="">-- Seleziona squadra --</option>
                    {teams.filter(t => t.name !== myTeamName).map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                  </select>
                </div>

                {tradeTargetTeam && (() => {
                  const myTeamObj = teams.find(t => t.name === myTeamName);
                  const targetTeamObj = teams.find(t => t.name === tradeTargetTeam);
                  if (!myTeamObj || !targetTeamObj) return null;

                  return (
                    <>
                      {/* Step 2: My players to offer */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ color: 'white', fontSize: '0.9rem', display: 'block', marginBottom: '6px' }}>2. Tuoi giocatori da offrire (seleziona):</label>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '8px' }}>
                          {([...( myTeamObj.roster || [])].sort((a,b) => getMacroRole(a.role).name > getMacroRole(b.role).name ? 1 : -1)).map((p, idx) => {
                            const pName = p.name || p.Nome;
                            const isSelected = tradeOfferedPlayers.some(op => (op.name || op.Nome) === pName);
                            return (
                              <div key={idx} onClick={() => setTradeOfferedPlayers(prev => isSelected ? prev.filter(op => (op.name || op.Nome) !== pName) : [...prev, p])}
                                style={{ display: 'flex', alignItems: 'center', padding: '8px', borderRadius: '6px', cursor: 'pointer', background: isSelected ? 'rgba(139,92,246,0.3)' : 'transparent', marginBottom: '2px', border: isSelected ? '1px solid #8b5cf6' : '1px solid transparent' }}>
                                <span style={{ marginRight: '8px', fontSize: '1.2rem' }}>{isSelected ? '✅' : '⬜'}</span>
                                <span style={{ background: getMantraColor(p.role), color: 'white', padding: '2px 5px', borderRadius: '3px', fontSize: '0.75rem', marginRight: '8px' }}>{p.role}</span>
                                <span style={{ color: 'white', flex: 1 }}>{pName}</span>
                                <span style={{ color: '#aaa', fontSize: '0.8rem' }}>{p.cost} cr</span>
                              </div>
                            );
                          })}
                        </div>
                        {tradeOfferedPlayers.length > 0 && <p style={{ color: '#8b5cf6', fontSize: '0.8rem', marginTop: '4px' }}>Selezionati: {tradeOfferedPlayers.map(p=>p.name||p.Nome).join(', ')}</p>}
                      </div>

                      {/* Step 3: Target players to request */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ color: 'white', fontSize: '0.9rem', display: 'block', marginBottom: '6px' }}>3. Giocatori da richiedere a {tradeTargetTeam}:</label>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '8px' }}>
                          {([...(targetTeamObj.roster || [])].sort((a,b) => getMacroRole(a.role).name > getMacroRole(b.role).name ? 1 : -1)).map((p, idx) => {
                            const pName = p.name || p.Nome;
                            const isSelected = tradeRequestedPlayers.some(rp => (rp.name || rp.Nome) === pName);
                            return (
                              <div key={idx} onClick={() => setTradeRequestedPlayers(prev => isSelected ? prev.filter(rp => (rp.name || rp.Nome) !== pName) : [...prev, p])}
                                style={{ display: 'flex', alignItems: 'center', padding: '8px', borderRadius: '6px', cursor: 'pointer', background: isSelected ? 'rgba(139,92,246,0.3)' : 'transparent', marginBottom: '2px', border: isSelected ? '1px solid #8b5cf6' : '1px solid transparent' }}>
                                <span style={{ marginRight: '8px', fontSize: '1.2rem' }}>{isSelected ? '✅' : '⬜'}</span>
                                <span style={{ background: getMantraColor(p.role), color: 'white', padding: '2px 5px', borderRadius: '3px', fontSize: '0.75rem', marginRight: '8px' }}>{p.role}</span>
                                <span style={{ color: 'white', flex: 1 }}>{pName}</span>
                                <span style={{ color: '#aaa', fontSize: '0.8rem' }}>{p.cost} cr</span>
                              </div>
                            );
                          })}
                        </div>
                        {tradeRequestedPlayers.length > 0 && <p style={{ color: '#8b5cf6', fontSize: '0.8rem', marginTop: '4px' }}>Richiesti: {tradeRequestedPlayers.map(p=>p.name||p.Nome).join(', ')}</p>}
                      </div>

                      {/* Credit offset */}
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ color: 'white', fontSize: '0.9rem', display: 'block', marginBottom: '6px' }}>4. Conguaglio crediti FPF (+ se paghi tu, - se pagano loro):</label>
                        <input type="number" value={tradeCreditOffset} onChange={e => setTradeCreditOffset(parseInt(e.target.value) || 0)}
                          style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', color: 'white', border: '1px solid #8b5cf6', textAlign: 'center', fontSize: '1.1rem', boxSizing: 'border-box' }} />
                        {tradeCreditOffset !== 0 && <p style={{ color: '#fbbf24', fontSize: '0.8rem', margin: '4px 0 0 0' }}>{tradeCreditOffset > 0 ? `Paghi ${tradeCreditOffset} cr a ${tradeTargetTeam}` : `Ricevi ${Math.abs(tradeCreditOffset)} cr da ${tradeTargetTeam}`}</p>}
                      </div>

                      {/* FPF Impact preview */}
                      {(tradeOfferedPlayers.length > 0 || tradeRequestedPlayers.length > 0) && (() => {
                        const myNewSlots = (myTeamObj.roster?.length || 0) - tradeOfferedPlayers.length + tradeRequestedPlayers.length;
                        const theirNewSlots = (targetTeamObj.roster?.length || 0) - tradeRequestedPlayers.length + tradeOfferedPlayers.length;
                        const myNewBalance = (myTeamObj.balance || 0) - tradeCreditOffset;
                        const theirNewBalance = (targetTeamObj.balance || 0) + tradeCreditOffset;
                        return (
                          <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '10px', marginBottom: '12px' }}>
                            <p style={{ color: '#aaa', fontSize: '0.8rem', margin: '0 0 6px 0', textAlign: 'center' }}>📊 Impatto FPF</p>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <div style={{ flex: 1, textAlign: 'center' }}>
                                <p style={{ color: 'white', fontWeight: 'bold', margin: '0 0 3px 0', fontSize: '0.85rem' }}>La Tua Squadra</p>
                                <p style={{ color: myNewSlots > (myTeamObj.fpf?.slot || 25) ? '#ef4444' : '#10b981', margin: 0, fontSize: '0.8rem' }}>Slot: {myTeamObj.roster?.length || 0} → {myNewSlots}</p>
                                <p style={{ color: myNewBalance < myTeamObj.balance ? '#ef4444' : '#10b981', margin: 0, fontSize: '0.8rem' }}>FPF: {myTeamObj.balance} → {myNewBalance}</p>
                              </div>
                              <div style={{ flex: 1, textAlign: 'center' }}>
                                <p style={{ color: 'white', fontWeight: 'bold', margin: '0 0 3px 0', fontSize: '0.85rem' }}>{tradeTargetTeam}</p>
                                <p style={{ color: theirNewSlots > (targetTeamObj.fpf?.slot || 25) ? '#ef4444' : '#10b981', margin: 0, fontSize: '0.8rem' }}>Slot: {targetTeamObj.roster?.length || 0} → {theirNewSlots}</p>
                                <p style={{ color: theirNewBalance < targetTeamObj.balance ? '#ef4444' : '#10b981', margin: 0, fontSize: '0.8rem' }}>FPF: {targetTeamObj.balance} → {theirNewBalance}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      <button
                        disabled={tradeOfferedPlayers.length === 0 && tradeRequestedPlayers.length === 0}
                        onClick={() => {
                          if (!tradeTargetTeam) { alert('Scegli una squadra!'); return; }
                          if (tradeOfferedPlayers.length === 0 && tradeRequestedPlayers.length === 0) { alert('Seleziona almeno un giocatore da offrire o richiedere!'); return; }
                          if (window.confirm(`Confermi la proposta di scambio a ${tradeTargetTeam}?\n\nOffri: ${tradeOfferedPlayers.map(p=>p.name||p.Nome).join(', ') || 'nessuno'}\nVuoi: ${tradeRequestedPlayers.map(p=>p.name||p.Nome).join(', ') || 'nessuno'}\nConguaglio: ${tradeCreditOffset} cr`)) {
                            socket.emit('propose_trade', { fromTeam: myTeamName, toTeam: tradeTargetTeam, offeredPlayers: tradeOfferedPlayers, requestedPlayers: tradeRequestedPlayers, creditOffset: tradeCreditOffset });
                            setTradeTargetTeam('');
                            setTradeOfferedPlayers([]);
                            setTradeRequestedPlayers([]);
                            setTradeCreditOffset(0);
                            alert('Proposta inviata! Attendi la risposta.');
                          }
                        }}
                        style={{ width: '100%', padding: '14px', background: tradeOfferedPlayers.length === 0 && tradeRequestedPlayers.length === 0 ? '#374151' : '#8b5cf6', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '1rem', cursor: tradeOfferedPlayers.length === 0 && tradeRequestedPlayers.length === 0 ? 'not-allowed' : 'pointer' }}
                      >🔄 Invia Proposta di Scambio</button>
                    </>
                  );
                })()}
              </div>

              {/* Storico Generale Scambi (Tutte le squadre) */}
              <div style={{ marginTop: '25px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '15px', border: '1px solid rgba(139,92,246,0.3)' }}>
                <h3 style={{ margin: '0 0 15px 0', color: '#a78bfa', fontSize: '1.1rem', textAlign: 'center' }}>Storico Generale Scambi</h3>
                {trades.filter(t => t.status === 'ACCEPTED').length === 0 ? (
                  <div style={{ color: '#aaa', fontStyle: 'italic', textAlign: 'center', fontSize: '0.9rem' }}>Nessuno scambio concluso finora nell'intera lega.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {trades.filter(t => t.status === 'ACCEPTED').map(trade => (
                      <div key={trade.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px', borderLeft: '4px solid #8b5cf6' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#aaa' }}>{new Date(trade.timestamp).toLocaleString('it-IT')}</span>
                          <span style={{ fontSize: '0.75rem', background: '#10b981', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>COMPLETATO</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div>
                            <div style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: '0.9rem' }}>Da: {trade.fromTeam}</div>
                            {trade.offeredPlayers.map(p => (
                              <div key={p.name} style={{ fontSize: '0.85rem' }}>• {p.name} <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>({p.role})</span></div>
                            ))}
                            {trade.balanceTransfer > 0 && <div style={{ fontSize: '0.85rem', color: '#10b981', marginTop: '2px' }}>+ {trade.balanceTransfer} cr</div>}
                          </div>
                          <div style={{ borderTop: '1px dashed rgba(255,255,255,0.2)', paddingTop: '8px' }}>
                            <div style={{ color: '#60a5fa', fontWeight: 'bold', fontSize: '0.9rem' }}>A: {trade.toTeam}</div>
                            {trade.requestedPlayers.map(p => (
                              <div key={p.name} style={{ fontSize: '0.85rem' }}>• {p.name} <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>({p.role})</span></div>
                            ))}
                            {trade.balanceTransfer < 0 && <div style={{ fontSize: '0.85rem', color: '#10b981', marginTop: '2px' }}>+ {Math.abs(trade.balanceTransfer)} cr</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </>
          )}
        </div>
      )}

      {/* Movimenti Tab */}
      {activeTab === 'movimenti' && (
        <div className="tab-content" style={{ padding: '15px' }}>
          <div className="fpf-panel" style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '10px', padding: '15px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Riepilogo Movimenti
            </h3>
            
            {myTransactions.length === 0 ? (
              <div style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '20px' }}>
                Nessun movimento registrato.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {myTransactions.map(tx => {
                  let isEntrata = false;
                  let isUscita = false;
                  let isTenuto = false;
                  
                  if (tx.type === 'TENUTO') isTenuto = true;
                  else if (tx.newOwner === myTeamName) isEntrata = true;
                  else if (tx.oldOwner === myTeamName) isUscita = true;

                  const badgeColor = isEntrata ? '#22c55e' : isUscita ? '#ef4444' : '#3b82f6';
                  const badgeText = isEntrata ? 'ENTRATA' : isUscita ? 'USCITA' : 'TENUTO';
                  const otherTeam = isEntrata ? tx.oldOwner : isUscita ? tx.newOwner : null;

                  return (
                    <div key={tx.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `4px solid ${badgeColor}` }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{tx.player.name} <span style={{ fontSize: '0.8rem', background: getMantraColor(tx.player.role), padding: '2px 4px', borderRadius: '4px' }}>{tx.player.role}</span></span>
                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
                          {isTenuto && 'Rinnovato e mantenuto in rosa'}
                          {isEntrata && (otherTeam ? `Acquistato da ${otherTeam}` : 'Acquistato (Svincolato)')}
                          {isUscita && (otherTeam ? `Ceduto a ${otherTeam}` : 'Svincolato')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <div style={{ background: badgeColor, padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
                          {badgeText}
                        </div>
                        <span style={{ fontWeight: 'bold' }}>{tx.price} cr</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      </div> {/* Closing flex: 1 div */}

      {/* Bivio Modal (Tengo / Vendo) */}
      {isMyPlayerAtBivio && (() => {
        const costProteggi = getDiscountedPrice(auction.currentBid);
        const newBalProteggi = myTeam.balance - costProteggi;
        const infoProteggi = getFpfTierInfo ? getFpfTierInfo(newBalProteggi) : { fascia: myTeam.fpf?.fascia, slot: myTeam.fpf?.slot, bonusCasa: myTeam.fpf?.bonusCasa, bonusTrasferta: myTeam.fpf?.bonusTrasferta };

        const incassoVendi = auction.currentBid;
        const newBalVendi = myTeam.balance + incassoVendi;
        const infoVendi = getFpfTierInfo ? getFpfTierInfo(newBalVendi) : { fascia: myTeam.fpf?.fascia, slot: myTeam.fpf?.slot, bonusCasa: myTeam.fpf?.bonusCasa, bonusTrasferta: myTeam.fpf?.bonusTrasferta };

        return (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '400px', width: '90%', padding: '1rem', background: 'transparent', boxShadow: 'none' }}>
              <div style={{ background: '#1e81b0', color: 'white', border: '3px solid black', borderRadius: '4px', padding: '15px', marginBottom: '20px', textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Shield size={20} /> SE PROTEGGI (TIENE)
                </h3>
                <p style={{ margin: '5px 0', fontWeight: 'bold' }}>Costo Effettivo: {costProteggi} cr</p>
                <p style={{ margin: '5px 0', fontWeight: 'bold' }}>Nuovo Saldo Reale: {newBalProteggi}</p>
                <p style={{ margin: '5px 0', fontWeight: 'bold' }}>Fascia FPF: {infoProteggi.fascia || 1}</p>
                <p style={{ margin: '5px 0', fontWeight: 'bold' }}>Slot Max consentiti: {infoProteggi.slot || 25}</p>
                <p style={{ margin: '5px 0', fontWeight: 'bold' }}>Bonus Campo: +{infoProteggi.bonusCasa || 0} / +{infoProteggi.bonusTrasferta || 0}</p>
                
                <button 
                  onClick={() => handleBivio('PROTEGGI')}
                  style={{ width: '100%', padding: '10px', marginTop: '10px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '2px solid white', borderRadius: '4px', fontWeight: 'bold', fontSize: '1.1rem' }}
                >
                  CONFERMA PROTEGGI
                </button>
              </div>

              <div style={{ background: '#802a70', color: 'white', border: '3px solid black', borderRadius: '4px', padding: '15px', textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <DollarSign size={20} /> SE VENDI (LASCIA)
                </h3>
                <p style={{ margin: '5px 0', fontWeight: 'bold' }}>Incasso Reale: +{incassoVendi} cr</p>
                <p style={{ margin: '5px 0', fontWeight: 'bold' }}>Nuovo Saldo: {newBalVendi}</p>
                <p style={{ margin: '5px 0', fontWeight: 'bold' }}>Fascia FPF: {infoVendi.fascia || 1}</p>
                <p style={{ margin: '5px 0', fontWeight: 'bold' }}>Slot Max consentiti: {infoVendi.slot || 25}</p>
                <p style={{ margin: '5px 0', fontWeight: 'bold' }}>Bonus Campo: +{infoVendi.bonusCasa || 0} / +{infoVendi.bonusTrasferta || 0}</p>
                
                <button 
                  onClick={() => handleBivio('VENDI')}
                  style={{ width: '100%', padding: '10px', marginTop: '10px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '2px solid white', borderRadius: '4px', fontWeight: 'bold', fontSize: '1.1rem' }}
                >
                  CONFERMA VENDI
                </button>
              </div>
              
              <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'white', textAlign: 'center', textShadow: '1px 1px 2px black' }}>
                Attenzione: la decisione è irreversibile e il bilancio FPF verrà aggiornato all'istante.
              </p>
            </div>
          </div>
        );
      })()}
      {/* Player Selection Modal */}
      {selectingForPos && (
        <div className="modal-overlay" onClick={() => setSelectingForPos(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '1.5rem 1rem', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ marginBottom: '1rem' }}>Seleziona per {selectingForPos}</h2>
            <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '10px' }}>
              <div 
                onClick={() => confirmPlayerSelection(null)}
                style={{ padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#ef4444', textAlign: 'center', fontWeight: 'bold' }}
              >
                Rimuovi Giocatore
              </div>
              {([...(myTeam.roster || [])].sort((a, b) => roleOrder.indexOf(getMacroRole(a.role).name) - roleOrder.indexOf(getMacroRole(b.role).name))).map((p, idx) => (
                <div 
                  key={idx} 
                  onClick={() => confirmPlayerSelection(p)}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div>
                    <span style={{ background: getMantraColor(p.role), color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', marginRight: '10px', fontWeight: 'bold' }}>{p.role}</span>
                    {p.name}
                  </div>
                </div>
              ))}
              {myTeam.roster.length === 0 && <p style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text-muted)' }}>Nessun giocatore in rosa.</p>}
            </div>
            <button onClick={() => setSelectingForPos(null)} style={{ marginTop: '1rem', background: 'var(--bg-dark)', padding: '10px', borderRadius: '8px', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>Chiudi</button>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, 
        background: 'var(--bg-dark)', 
        display: 'flex', 
        borderTop: '1px solid rgba(255,255,255,0.1)',
        padding: '0.4rem 0.2rem',
        zIndex: 1000
      }}>
        <button 
          onClick={() => setActiveTab('live')}
          style={{ flex: 1, padding: '0.4rem 0.1rem', background: activeTab === 'live' ? 'var(--fpf-f1)' : 'transparent', border: 'none', color: 'white', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.7rem' }}
        >
          ⚡ Asta
        </button>
        <button 
          onClick={() => setActiveTab('roster')}
          style={{ flex: 1, padding: '0.4rem 0.1rem', background: activeTab === 'roster' ? 'var(--fpf-f1)' : 'transparent', border: 'none', color: 'white', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.7rem' }}
        >
          📋 Rosa
        </button>
        <button 
          onClick={() => setActiveTab('listone')}
          style={{ flex: 1, padding: '0.4rem 0.1rem', background: activeTab === 'listone' ? 'var(--fpf-f1)' : 'transparent', border: 'none', color: 'white', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.7rem' }}
        >
          🔍 Listone
        </button>
        <button 
          onClick={() => setActiveTab('formazione')}
          style={{ flex: 1, padding: '0.4rem 0.1rem', background: activeTab === 'formazione' ? 'var(--fpf-f1)' : 'transparent', border: 'none', color: 'white', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.7rem' }}
        >
          ⚽ Campo
        </button>
        <button 
          onClick={() => setActiveTab('altre-rose')}
          style={{ flex: 1, padding: '0.4rem 0.1rem', background: activeTab === 'altre-rose' ? 'var(--fpf-f1)' : 'transparent', border: 'none', color: 'white', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.7rem' }}
        >
          👥 Rose
        </button>
        <button 
          onClick={() => setActiveTab('scambi')}
          style={{ flex: 1, padding: '0.4rem 0.1rem', background: activeTab === 'scambi' ? '#8b5cf6' : 'transparent', border: 'none', color: activeTab === 'scambi' ? 'white' : (trades.filter(t => t.toTeam === myTeamName && t.status === 'PENDING').length > 0 ? '#f59e0b' : 'white'), borderRadius: '8px', fontWeight: 'bold', fontSize: '0.7rem', position: 'relative' }}
        >
          🔄 Scambi{trades.filter(t => t.toTeam === myTeamName && t.status === 'PENDING').length > 0 ? ` (${trades.filter(t => t.toTeam === myTeamName && t.status === 'PENDING').length})` : ''}
        </button>
        <button 
          onClick={() => setActiveTab('movimenti')}
          style={{ flex: 1, padding: '0.4rem 0.1rem', background: activeTab === 'movimenti' ? 'var(--fpf-f1)' : 'transparent', border: 'none', color: 'white', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.7rem' }}
        >
          📜 Storico
        </button>
      </div>

    </div>
  );
}
