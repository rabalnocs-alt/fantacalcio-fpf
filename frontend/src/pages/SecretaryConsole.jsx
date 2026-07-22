import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Upload, Play, DollarSign, StopCircle } from 'lucide-react';
import { socket, BACKEND_URL } from '../utils/socket';

export default function SecretaryConsole() {
  const [file, setFile] = useState(null);
  const [players, setPlayers] = useState([]);
  const [auction, setAuction] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [manualBid, setManualBid] = useState('');
  const [bidder, setBidder] = useState('');
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    socket.on('auction_update', (data) => setAuction(data));
    socket.on('teams_update', (data) => setTeams(data));
    socket.on('players_list', (data) => setPlayers(data));
    return () => {
      socket.off('auction_update');
      socket.off('teams_update');
      socket.off('players_list');
    };
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${BACKEND_URL}/api/upload-listone`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
         alert('Listone caricato con successo! ' + data.count + ' giocatori trovati.');
      } else {
         alert('Errore caricamento: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Errore di connessione');
    }
  };

  const handleStartAuction = () => {
    if (!selectedPlayer) return;
    // For now, let's create a mock player object based on name if no CSV loaded
    // If CSV is loaded, find the player
    let p = players.find(x => x.Nome === selectedPlayer);
    
    // Fallback if not using CSV yet
    if (!p) {
      p = {
        name: selectedPlayer,
        role: 'C',
        quot: 15,
        stats: { fm: 6.5, gol: 3, ass: 4 },
        currentOwner: selectedPlayer === 'Nico Paz' ? 'Salassuolo' : null,
        oldRinnovo: selectedPlayer === 'Nico Paz' ? 9 : 0
      };
    } else {
      p = {
        name: p.Nome,
        role: p.Ruolo,
        quot: p.Quotazione,
        stats: { fm: p.FM || '-', gol: p.GOL || '-', ass: p.ASS || '-' },
        currentOwner: null,
        oldRinnovo: 0
      };
    }

    socket.emit('start_auction', p);
  };

  const handlePlaceBid = () => {
    if (manualBid && bidder) {
      socket.emit('place_bid', { teamName: bidder, amount: parseInt(manualBid) });
      setManualBid('');
    }
  };

  const handleUploadStats = async (statsFile) => {
    if (!statsFile) return;
    const formData = new FormData();
    formData.append('file', statsFile);
    try {
      const res = await fetch(`${BACKEND_URL}/api/upload-stats`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
         alert(`Statistiche aggiornate per ${data.count} giocatori!`);
      } else {
         alert('Errore caricamento statistiche: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Errore di connessione');
    }
  };

  return (
    <div className="page-container">
      <header className="header-row">
        <h1 className="main-title" style={{marginBottom: 0}}>Console Segretario</h1>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        
        {/* Setup Panel */}
        <div className="fpf-panel">
          <h2>1. Importa Listone & Statistiche</h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{flex: 1}}>
              <label style={{display: 'block', marginBottom: '5px', fontSize: '0.8rem', color: '#aaa'}}>Listone Quotazioni</label>
              <input type="file" accept=".xlsx, .xls" onChange={(e) => setFile(e.target.files[0])} />
            </div>
            <button onClick={handleUpload} style={{ display: 'flex', alignItems: 'center', gap: '5px', alignSelf: 'flex-end' }}>
              <Upload size={18} /> Carica
            </button>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{flex: 1}}>
              <label style={{display: 'block', marginBottom: '5px', fontSize: '0.8rem', color: '#aaa'}}>Statistiche (FM, GOL, ASS)</label>
              <input type="file" accept=".xlsx, .xls" onChange={(e) => handleUploadStats(e.target.files[0])} />
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Carica il file CSV ufficiale scaricato da Fantacalcio.it
          </p>

          <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '1rem 0' }} />

          <h2>2. Avvia Chiamata</h2>
          <div style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input 
                type="text" 
                placeholder="Nome giocatore..." 
                value={selectedPlayer}
                onChange={(e) => {
                  setSelectedPlayer(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                style={{ width: '100%' }}
              />
              {showSuggestions && selectedPlayer && selectedPlayer.length >= 2 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  background: '#02144d', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '12px', zIndex: 1000, maxHeight: '200px', overflowY: 'auto',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.8)', marginTop: '5px'
                }}>
                  {players
                    .filter(p => p.Nome && p.Nome.toLowerCase().includes(selectedPlayer.toLowerCase()))
                    .slice(0, 15)
                    .map((p, idx) => (
                      <div 
                        key={idx}
                        onClick={() => {
                          setSelectedPlayer(p.Nome);
                          setShowSuggestions(false);
                        }}
                        style={{
                          padding: '10px', cursor: 'pointer', color: 'white',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          background: 'transparent', transition: 'background 0.2s',
                          display: 'flex', justifyContent: 'space-between',
                          textAlign: 'left'
                        }}
                        onMouseDown={() => {
                          // Prevent input blur before onClick
                          setSelectedPlayer(p.Nome);
                          setShowSuggestions(false);
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <strong style={{ color: 'white' }}>{p.Nome}</strong>
                        <span style={{ fontSize: '0.85rem', color: '#fbbf24', fontWeight: 'bold' }}>
                          {p.Ruolo} - {p.Quotazione} cr
                        </span>
                      </div>
                    ))
                  }
                  {players.filter(p => p.Nome && p.Nome.toLowerCase().includes(selectedPlayer.toLowerCase())).length === 0 && (
                    <div style={{ padding: '10px', color: '#b3c6ff', fontSize: '0.9rem' }}>
                      Nessun risultato
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={handleStartAuction} style={{ background: 'var(--fpf-f1)', display: 'flex', alignItems: 'center', gap: '5px', height: '42px', alignSelf: 'flex-start' }}>
              <Play size={18} /> Mostra a Schermo
            </button>
          </div>
        </div>

        {/* Live Auction Control */}
        <div className="fpf-panel" style={{ border: '2px solid var(--accent-blue)' }}>
          <h2>Gestione Asta Live</h2>
          
          {auction?.status === 'IDLE' && <p>Nessuna asta attiva.</p>}
          
          {auction?.currentPlayer && (
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '0.5rem' }}>
              <h3>In asta: {auction.currentPlayer.name}</h3>
              <p>Offerta attuale: <strong>{auction.currentBid} cr</strong> ({auction.currentBidder || 'Nessuno'})</p>
              <p>Stato: {auction.status} | Timer: {auction.timerSeconds}s</p>
              
              {auction.status !== 'ASSIGNED' && auction.status !== 'BIVIO' && (
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <select value={bidder} onChange={(e) => setBidder(e.target.value)}>
                    <option value="">Seleziona Squadra...</option>
                    {teams.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                  </select>
                  <input 
                    type="number" 
                    placeholder="Cifra rilancio" 
                    value={manualBid}
                    onChange={(e) => setManualBid(e.target.value)}
                    style={{ width: '120px' }}
                  />
                  <button onClick={handlePlaceBid} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <DollarSign size={18} /> Rilancia (7s)
                  </button>
                </div>
              )}

              {auction.status === 'WAITING' && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.2)', borderRadius: '0.5rem', border: '1px solid #3b82f6' }}>
                  Giocatore in attesa. Avvia i primi 10 secondi per aprire le offerte!
                  <div style={{ marginTop: '1rem' }}>
                    <button onClick={() => socket.emit('start_initial_timer')} style={{ background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Play size={18} /> Avvia Conto alla Rovescia (10s)
                    </button>
                  </div>
                </div>
              )}

              {auction.status === 'BIVIO' && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(245, 158, 11, 0.2)', borderRadius: '0.5rem', border: '1px solid #f59e0b' }}>
                  Asta chiusa a {auction.currentBid} cr. 
                  In attesa che <strong>{auction.currentPlayer.currentOwner}</strong> scelga se Proteggere o Vendere dal suo smartphone...
                  <div style={{ marginTop: '1rem' }}>
                    <button onClick={() => socket.emit('start_bivio_timer')} style={{ background: '#f59e0b', color: 'white', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Play size={18} /> Avvia Timer Pressione (60s)
                    </button>
                  </div>
                </div>
              )}

              <div style={{ marginTop: '2rem' }}>
                <button onClick={() => socket.emit('reset_auction')} style={{ background: 'var(--fpf-f6)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <StopCircle size={18} /> Annulla/Resetta Asta
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
