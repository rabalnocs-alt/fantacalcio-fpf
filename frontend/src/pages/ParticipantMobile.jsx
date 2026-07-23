import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, Shield, ArrowRight, LogOut } from 'lucide-react';
import { socket } from '../utils/socket';
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
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.08);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.08);
    };

    playTone(1800, 0);
    playTone(2200, 0.015);
  } catch (e) {
    console.error("Audio error:", e);
  }
};

export default function ParticipantMobile() {
  const { auth, logout } = useAuth();
  const [teams, setTeams] = useState([]);
  const [auction, setAuction] = useState(null);
  const [myTeamName, setMyTeamName] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [transactions, setTransactions] = useState([]);
  const prevBidRef = useRef(0);

  useEffect(() => {
    if (auth?.role === 'participant' && auth.teamName) {
      setMyTeamName(auth.teamName);
    }
  }, [auth]);

  useEffect(() => {
    socket.on('teams_update', (data) => setTeams(data));
    socket.on('transactions_update', (data) => setTransactions(data));
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
      socket.off('auction_update');
      socket.off('force_reload');
    };
  }, []);

  useEffect(() => {
    if (auction && auction.status === 'ACTIVE' && auction.currentBid > prevBidRef.current && auction.currentBidder) {
      playDefaultBidSound();
    }
    if (auction) {
      prevBidRef.current = auction.currentBid;
    }
  }, [auction?.currentBid, auction?.status]);

  const myTeam = teams.find(t => t.name === myTeamName);
  
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

  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'roster' | 'formazione' | 'note'
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
      'DIFENSORI': '#10b981',
      'MEDIANA': '#0ea5e9',
      'FANTASISTI': '#8b5cf6',
      'ATTACCANTI': '#ef4444'
    };
    if (roleColors[role]) {
      return { name: role, color: roleColors[role] };
    }

    // Otherwise, parse the raw player role string
    const r = role.toLowerCase();
    if (r.includes('por')) return { name: 'PORTIERI', color: roleColors['PORTIERI'] }; 
    if (/\b(dc|dd|ds)\b/i.test(r) || r.includes('e')) return { name: 'DIFENSORI', color: roleColors['DIFENSORI'] }; 
    if (/\b(m|c)\b/i.test(r) && !r.includes('pc') && !r.includes('dc')) return { name: 'MEDIANA', color: roleColors['MEDIANA'] }; 
    if (/\b(w|t|a)\b/i.test(r)) return { name: 'FANTASISTI', color: roleColors['FANTASISTI'] }; 
    if (/\b(pc)\b/i.test(r)) return { name: 'ATTACCANTI', color: roleColors['ATTACCANTI'] }; 
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
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'white' }}>
        <h2>Caricamento dati squadra...</h2>
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

  const roleOrder = ['PORTIERI', 'DIFENSORI', 'MEDIANA', 'FANTASISTI', 'ATTACCANTI', 'ALTRO'];

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
                {Array.from({ length: 30 }).map((_, idx) => {
                  const player = myTeam.roster[idx];
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
                        <div style={{ color: '#666', fontWeight: 'bold' }}>{player.cost} cr</div>
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
                })}
              </div>
            </div>
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

      {/* Note Tab */}
      {activeTab === 'note' && (
        <div className="tab-content">
          <div className="fpf-panel" style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '15px', height: '100%' }}>
            <h2 style={{ marginBottom: '1rem' }}>I Miei Obiettivi</h2>
            <textarea 
              value={notes}
              onChange={saveNotes}
              placeholder="Scrivi qui i tuoi appunti, obiettivi di mercato, ecc... (verranno salvati in automatico)"
              style={{ width: '100%', height: '300px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--text-muted)', borderRadius: '10px', padding: '10px', resize: 'none' }}
            />
          </div>
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
              {myTeam.roster.map((p, idx) => (
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
        padding: '0.5rem',
        zIndex: 1000
      }}>
        <button 
          onClick={() => setActiveTab('live')}
          style={{ flex: 1, padding: '0.5rem', background: activeTab === 'live' ? 'var(--fpf-f1)' : 'transparent', border: 'none', color: 'white', borderRadius: '10px', fontWeight: 'bold', fontSize: '0.9rem' }}
        >
          Asta Live
        </button>
        <button 
          onClick={() => setActiveTab('roster')}
          style={{ flex: 1, padding: '0.5rem', background: activeTab === 'roster' ? 'var(--fpf-f1)' : 'transparent', border: 'none', color: 'white', borderRadius: '10px', fontWeight: 'bold', fontSize: '0.9rem' }}
        >
          Rosa
        </button>
        <button 
          onClick={() => setActiveTab('formazione')}
          style={{ flex: 1, padding: '0.5rem', background: activeTab === 'formazione' ? 'var(--fpf-f1)' : 'transparent', border: 'none', color: 'white', borderRadius: '10px', fontWeight: 'bold', fontSize: '0.9rem' }}
        >
          Modulo
        </button>
        <button 
          onClick={() => setActiveTab('note')}
          style={{ flex: 1, padding: '0.5rem', background: activeTab === 'note' ? 'var(--fpf-f1)' : 'transparent', border: 'none', color: 'white', borderRadius: '10px', fontWeight: 'bold', fontSize: '0.9rem' }}
        >
          Note
        </button>
        <button 
          onClick={() => setActiveTab('movimenti')}
          style={{ flex: 1, padding: '0.5rem', background: activeTab === 'movimenti' ? 'var(--fpf-f1)' : 'transparent', border: 'none', color: 'white', borderRadius: '10px', fontWeight: 'bold', fontSize: '0.9rem' }}
        >
          Movimenti
        </button>
      </div>

    </div>
  );
}
