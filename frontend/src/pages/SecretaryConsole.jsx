import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Upload, Play, DollarSign, StopCircle, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
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
  const [listoneSourceMode, setListoneSourceMode] = useState('fantalab_excel');
  const [pastedText, setPastedText] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [trades, setTrades] = useState([]);
  const [viewMode, setViewMode] = useState('sintetica');

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/transactions`)
      .then(res => {
        if (!res.ok) return [];
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return res.json();
        }
        return [];
      })
      .then(data => {
        if (Array.isArray(data)) setTransactions(data);
      })
      .catch(err => console.error('Error fetching transactions:', err));

    socket.on('auction_update', (data) => setAuction(data));
    socket.on('teams_update', (data) => setTeams(data));
    socket.on('players_list', (data) => setPlayers(data));
    socket.on('transactions_update', (data) => setTransactions(data));
    socket.on('trades_update', (data) => setTrades(data));
    socket.on('undo_error', ({ message }) => {
      alert('⚠️ Annulla Asta: ' + (message || 'Nessuna asta precedente da annullare.'));
    });
    socket.on('undo_success', ({ message }) => {
      alert(message || '↩️ Ultima asta annullata con successo!');
    });
    socket.on('force_reload', () => {
      console.log('Master requested a forced reload');
      window.location.reload();
    });
    return () => {
      socket.off('auction_update');
      socket.off('teams_update');
      socket.off('players_list');
      socket.off('transactions_update');
      socket.off('trades_update');
      socket.off('undo_error');
      socket.off('undo_success');
      socket.off('force_reload');
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
    const cleanName = selectedPlayer.trim().toLowerCase();

    if (auctionedSet.has(cleanName)) {
      alert(`🔴 IMPOSSIBILE! Il calciatore "${selectedPlayer}" è già stato aggiudicato in questa asta e non può più essere chiamato!`);
      return;
    }

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
        ...p,
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

  const handleResetListone = async () => {
    if (!window.confirm("Sei sicuro di voler svuotare il Listone? Tutti i calciatori nel listone verranno azzerati per consentirti di ricaricare un file pulito.")) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/reset-listone`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert("Listone svuotato con successo! Ora puoi ricaricare il nuovo file Excel.");
      }
    } catch (err) {
      console.error(err);
      alert("Errore durante il reset del listone");
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

  const handleImportPreset = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/import-listone-preset`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(`⚡ Fatto! Database FantaLab 2026/27 attivato con successo (${data.count} calciatori)!`);
      } else {
        alert(data.error || "Errore durante il caricamento del preset FantaLab");
      }
    } catch (err) {
      console.error(err);
      alert("Errore di connessione");
    }
  };

  const handleImportText = async () => {
    if (!pastedText.trim()) return alert("Incolla prima il testo della tabella copiata da FantaLab!");
    try {
      const res = await fetch(`${BACKEND_URL}/api/import-listone-json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: pastedText, source: 'fantalab' })
      });
      const data = await res.json();
      if (data.success) {
        alert(`🟣 Successo! Importati ${data.count} calciatori dal testo FantaLab!`);
        setPastedText('');
      } else {
        alert(data.error || "Errore durante l'importazione");
      }
    } catch (err) {
      console.error(err);
      alert("Errore di connessione");
    }
  };
  const handleUndoLastAuction = () => {
    if (!window.confirm("Sei sicuro di voler annullare l'ultima aggiudicazione e ripristinare il bilancio e la rosa al momento precedente?")) return;
    socket.emit('undo_last_auction');
    // Response is handled by 'undo_error' listener or teams_update/auction_update
    // If no error arrives within a moment, it succeeded.
    setTimeout(() => {
      // If we get here without an error alert, it worked
    }, 500);
  };

  const handleExportExcel = () => {
    // 1. Transactions Sheet
    const txData = transactions.map(tx => ({
      ID: tx.id,
      Data: new Date(tx.timestamp).toLocaleString('it-IT'),
      Tipo: tx.type,
      Giocatore: tx.player?.name || tx.player || '',
      Ruolo: tx.player?.role || '',
      Squadra: tx.newOwner || tx.oldOwner || '',
      Prezzo: tx.price
    }));
    const wsTransactions = XLSX.utils.json_to_sheet(txData);

    // 2. Trades Sheet
    const acceptedTrades = trades.filter(t => t.status === 'ACCEPTED');
    const tradesData = acceptedTrades.map(trade => ({
      ID: trade.id,
      Data: new Date(trade.timestamp).toLocaleString('it-IT'),
      'Da Squadra': trade.fromTeam,
      'A Squadra': trade.toTeam,
      'Giocatori Dati': trade.offeredPlayers.map(p => `${p.name} (${p.role})`).join(', '),
      'Giocatori Ricevuti': trade.requestedPlayers.map(p => `${p.name} (${p.role})`).join(', '),
      'Conguaglio (Da->A)': trade.balanceTransfer
    }));
    const wsTrades = XLSX.utils.json_to_sheet(tradesData);

    // 3. Teams Roster Sheet
    const rostersData = [];
    teams.forEach(team => {
      team.roster?.forEach(player => {
        rostersData.push({
          Squadra: team.name,
          Giocatore: player.name,
          Ruolo: player.role,
          Costo: player.cost
        });
      });
    });
    const wsRosters = XLSX.utils.json_to_sheet(rostersData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsTransactions, "Acquisti e Svincoli");
    XLSX.utils.book_append_sheet(wb, wsTrades, "Scambi");
    XLSX.utils.book_append_sheet(wb, wsRosters, "Rose Attuali");

    XLSX.writeFile(wb, "Riepilogo_Mercato_Fantacalcio.xlsx");
  };

  return (
    <div className="page-container">
      <header className="header-row">
        <h1 className="main-title" style={{marginBottom: 0}}>Console Segretario</h1>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        
        {/* Setup Panel */}
        <div className="fpf-panel" style={{ minHeight: '620px', overflow: 'visible' }}>
          <h2>1. Importa Listone & Statistiche</h2>
          
          {/* 3-Mode Source Selector */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '1.2rem', background: 'rgba(0,0,0,0.35)', padding: '6px', borderRadius: '12px' }}>
            <button 
              onClick={() => setListoneSourceMode('fantalab_excel')}
              style={{
                flex: 1, padding: '10px 4px', borderRadius: '8px', border: 'none',
                background: listoneSourceMode === 'fantalab_excel' ? '#8b5cf6' : 'transparent',
                color: 'white', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer',
                boxShadow: listoneSourceMode === 'fantalab_excel' ? '0 2px 8px rgba(139, 92, 246, 0.4)' : 'none'
              }}
            >
              📊 FantaLab (Excel)
            </button>
            <button 
              onClick={() => setListoneSourceMode('fantacalcio_excel')}
              style={{
                flex: 1, padding: '10px 4px', borderRadius: '8px', border: 'none',
                background: listoneSourceMode === 'fantacalcio_excel' ? 'var(--fpf-f1)' : 'transparent',
                color: 'white', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer',
                boxShadow: listoneSourceMode === 'fantacalcio_excel' ? '0 2px 8px rgba(0, 168, 255, 0.4)' : 'none'
              }}
            >
              ⚽ LegheFanta (Excel)
            </button>
            <button 
              onClick={() => setListoneSourceMode('fantalab_text')}
              style={{
                flex: 1, padding: '10px 4px', borderRadius: '8px', border: 'none',
                background: listoneSourceMode === 'fantalab_text' ? '#10b981' : 'transparent',
                color: 'white', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer'
              }}
            >
              📝 Testo / Preset
            </button>
          </div>

          {listoneSourceMode === 'fantalab_excel' && (
            <div style={{ background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.4)', padding: '16px', borderRadius: '12px', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 'bold', color: '#c4b5fd', marginBottom: '8px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📊 Importa File Excel FantaLab (.xlsx)
              </div>
              <p style={{ fontSize: '0.82rem', color: '#ddd', margin: '0 0 12px 0', lineHeight: '1.4' }}>
                Seleziona ed importa il file <strong>.xlsx / .xls</strong> scaricato da FantaLab. I ruoli Mantra, le squadre e le quotazioni verranno aggiornate per tutti.
              </p>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px' }}>
                <input type="file" accept=".xlsx, .xls" onChange={(e) => setFile(e.target.files[0])} style={{ flex: 1, color: 'white', fontSize: '0.85rem' }} />
                <button onClick={handleUpload} style={{ background: '#8b5cf6', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Upload size={18} /> Carica FantaLab Excel
                </button>
              </div>
              
              <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={handleResetListone} style={{ background: '#dc2626', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer' }}>
                  🗑️ Reset Listone
                </button>
              </div>
            </div>
          )}

          {listoneSourceMode === 'fantacalcio_excel' && (
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.4)', padding: '16px', borderRadius: '12px', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 'bold', color: '#93c5fd', marginBottom: '8px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚽ Importa File Excel LegheFantacalcio (.xlsx)
              </div>
              <p style={{ fontSize: '0.82rem', color: '#ddd', margin: '0 0 12px 0', lineHeight: '1.4' }}>
                Seleziona ed importa il file ufficiale <strong>.xlsx / .xls</strong> scaricato da LegheFantacalcio.
              </p>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px' }}>
                <input type="file" accept=".xlsx, .xls" onChange={(e) => setFile(e.target.files[0])} style={{ flex: 1, color: 'white', fontSize: '0.85rem' }} />
                <button onClick={handleUpload} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Upload size={18} /> Carica Fantacalcio Excel
                </button>
              </div>

              <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={handleResetListone} style={{ background: '#dc2626', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer' }}>
                  🗑️ Reset Listone
                </button>
              </div>
            </div>
          )}

          {listoneSourceMode === 'fantalab_text' && (
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '16px', borderRadius: '12px', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 'bold', color: '#6ee7b7', marginBottom: '8px', fontSize: '1rem' }}>
                📝 Importa Testo da FantaLab o Preset Pre-caricato
              </div>
              <p style={{ fontSize: '0.82rem', color: '#ddd', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                Incolla il testo copiato da <code>app.fantalab.it/listone</code> oppure carica il preset 2026/27.
              </p>
              
              <textarea 
                placeholder="Incolla qui il testo copiato da app.fantalab.it/listone (es. Turati POR Monza 12...)"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={4}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '0.85rem', boxSizing: 'border-box', fontFamily: 'monospace' }}
              />
              
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                {pastedText.trim() ? (
                  <button onClick={handleImportText} style={{ flex: 1, padding: '10px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' }}>
                    📥 Importa {pastedText.split('\n').filter(l => l.trim()).length} Giocatori Incollati
                  </button>
                ) : (
                  <button onClick={handleImportPreset} style={{ flex: 1, padding: '10px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' }}>
                    ⚡ Carica Preset FantaLab 2026/27
                  </button>
                )}
                <button onClick={handleResetListone} style={{ background: '#dc2626', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' }}>
                  🗑️ Reset
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{flex: 1}}>
              <label style={{display: 'block', marginBottom: '5px', fontSize: '0.8rem', color: '#aaa'}}>Statistiche Facoltative (FM, GOL, ASS)</label>
              <input type="file" accept=".xlsx, .xls" onChange={(e) => handleUploadStats(e.target.files[0])} />
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Carica il file CSV ufficiale scaricato da Fantacalcio.it
          </p>

          <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '1rem 0' }} />

          <h2>2. Avvia Chiamata</h2>
          <div style={{ display: 'flex', gap: '1rem', position: 'relative', alignItems: 'center' }}>
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
                style={{ width: '100%', padding: '12px 16px', fontSize: '1.2rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', boxSizing: 'border-box' }}
              />
              {showSuggestions && selectedPlayer && selectedPlayer.length >= 2 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  background: '#02144d', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '12px', zIndex: 1000, maxHeight: '300px', overflowY: 'auto',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.8)', marginTop: '5px'
                }}>
                  {players
                    .filter(p => p.Nome && p.Nome.toLowerCase().includes(selectedPlayer.toLowerCase()))
                    .slice(0, 15)
                    .map((p, idx) => {
                      const isAuctioned = auctionedSet.has((p.Nome || '').trim().toLowerCase());
                      return (
                        <div 
                          key={idx}
                          onClick={() => {
                            setSelectedPlayer(p.Nome);
                            setShowSuggestions(false);
                          }}
                          style={{
                            padding: '12px', cursor: 'pointer', color: 'white',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            background: 'transparent', transition: 'background 0.2s',
                            display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', textAlign: 'left',
                            opacity: isAuctioned ? 0.6 : 1
                          }}
                          onMouseDown={() => {
                            setSelectedPlayer(p.Nome);
                            setShowSuggestions(false);
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <div>
                            <strong style={{ color: 'white', fontSize: '1.05rem' }}>{p.Nome}</strong>
                            {isAuctioned && (
                              <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.2)', padding: '2px 6px', borderRadius: '4px', border: '1px solid #ef4444', fontWeight: 'bold' }}>
                                🔴 GIÀ AGGIUDICATO
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.9rem', color: isAuctioned ? '#ef4444' : '#fbbf24', fontWeight: 'bold' }}>
                            {p.Ruolo} - {p.Quotazione} cr
                          </span>
                        </div>
                      );
                    })
                  }
                  {players.filter(p => p.Nome && p.Nome.toLowerCase().includes(selectedPlayer.toLowerCase())).length === 0 && (
                    <div style={{ padding: '12px', color: '#b3c6ff', fontSize: '0.95rem' }}>
                      Nessun risultato - Puoi comunque chiamarlo usando l'opzione "Fuori Listone"
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={handleStartAuction} style={{ background: 'var(--fpf-f1)', display: 'flex', alignItems: 'center', gap: '5px', height: '48px', padding: '0 25px', fontSize: '1.1rem', alignSelf: 'center', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
              <Play size={18} /> Mostra a Schermo
            </button>
          </div>
          
          <div style={{ marginTop: '15px', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.2)' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#fbbf24' }}>Avvia Chiamata (Fuori Listone)</h4>
            <p style={{ fontSize: '0.85rem', color: '#aaa', margin: '0 0 10px 0' }}>Per giocatori appena arrivati in Serie A e non ancora nel file.</p>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input 
                type="text" 
                id="extraPlayerName"
                placeholder="Nome..." 
                style={{ flex: 2, padding: '8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
              />
              <input 
                type="text" 
                id="extraPlayerRole"
                placeholder="Ruolo (es. Pc)..." 
                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
              />
              <input 
                type="number" 
                id="extraPlayerQuot"
                placeholder="Quot. (es. 10)" 
                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
              />
              <button 
                onClick={() => {
                  const name = document.getElementById('extraPlayerName').value.trim();
                  const role = document.getElementById('extraPlayerRole').value.trim().toUpperCase() || 'N/A';
                  const quot = parseInt(document.getElementById('extraPlayerQuot').value) || 1;
                  
                  if (!name) return alert('Inserisci il nome del giocatore!');
                  if (auctionedSet.has(name.toLowerCase())) return alert(`Il giocatore ${name} è già stato aggiudicato!`);
                  
                  const p = {
                    name,
                    role,
                    quot,
                    stats: { fm: '-', gol: '-', ass: '-' },
                    currentOwner: null,
                    oldRinnovo: 0
                  };
                  socket.emit('start_auction', p);
                  
                  document.getElementById('extraPlayerName').value = '';
                  document.getElementById('extraPlayerRole').value = '';
                  document.getElementById('extraPlayerQuot').value = '';
                }} 
                style={{ background: '#10b981', display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 15px', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
              >
                <Play size={14} /> Fuori Listone
              </button>
            </div>
          </div>
        </div>
 
        {/* Live Auction Control */}
        <div className="fpf-panel" style={{ border: '2px solid var(--accent-blue)', minHeight: '620px' }}>
          <h2>Gestione Asta Live</h2>
          
          {auction?.status === 'IDLE' && <p>Nessuna asta attiva.</p>}
          
          {auction?.currentPlayer && (
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '0.5rem' }}>
              <h3>In asta: {auction.currentPlayer.name}</h3>
              <p>Offerta attuale: <strong>{auction.currentBid} cr</strong> ({auction.currentBidder || 'Nessuno'})</p>
              <p>Stato: {auction.status} | Timer: {auction.timerSeconds}s</p>
              
              {auction.status !== 'ASSIGNED' && auction.status !== 'BIVIO' && (
                 <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', alignItems: 'center' }}>
                  <select value={bidder} onChange={(e) => setBidder(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: '#00144d', color: 'white', fontSize: '1rem', flex: 1, height: '42px', cursor: 'pointer' }}>
                    <option value="">Seleziona Squadra...</option>
                    {teams.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                  </select>
                  <input 
                    type="number" 
                    placeholder="Cifra" 
                    value={manualBid}
                    onChange={(e) => setManualBid(e.target.value)}
                    style={{ width: '100px', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '1rem', height: '42px', boxSizing: 'border-box' }}
                  />
                  <button onClick={handlePlaceBid} style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '42px', padding: '0 15px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
                    <DollarSign size={18} /> Rilancia
                  </button>
                </div>
              )}

              {auction.status === 'WAITING' && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.2)', borderRadius: '0.5rem', border: '1px solid #3b82f6' }}>
                  Giocatore in attesa. Avvia i primi 30 secondi per aprire le offerte!
                  <div style={{ marginTop: '1rem' }}>
                    <button onClick={() => socket.emit('start_initial_timer')} style={{ background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 15px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                      <Play size={18} /> Avvia Conto alla Rovescia (30s)
                    </button>
                  </div>
                </div>
              )}

              {(auction.status === 'ACTIVE' || auction.status === 'WAITING') && (
                <div style={{ marginTop: '1rem' }}>
                  <button 
                    onClick={() => socket.emit('force_end_timer')} 
                    style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', width: '100%', justifyContent: 'center', fontSize: '0.95rem', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' }}
                  >
                    <StopCircle size={20} /> Termina Timer e Aggiudica Ora
                  </button>
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

              <div style={{ marginTop: '2rem', display: 'flex', gap: '10px' }}>
                <button onClick={() => socket.emit('reset_auction')} style={{ flex: 1, background: 'var(--fpf-f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', border: 'none', borderRadius: '8px', padding: '10px', cursor: 'pointer', color: 'white', fontWeight: 'bold' }}>
                  <StopCircle size={18} /> Resetta Asta Corrente
                </button>
                <button onClick={handleUndoLastAuction} style={{ flex: 1, background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer' }}>
                  ↩️ Annulla Ultima Asta
                </button>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* NEW: Gestione Rose & Svincoli */}
      <div className="fpf-panel" style={{ marginTop: '2rem', border: '2px solid var(--accent-purple)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
          <h2>3. Gestione Rose & Svincoli</h2>
          
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {/* Toggle: Svincoli Pre-Asta */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '8px' }}>
              <span style={{ color: 'white', fontWeight: 'bold', fontSize: '0.85rem' }}>🔓 Svincoli Pre-Asta:</span>
              <div style={{
                width: '44px', height: '22px', background: auction?.allowFreeRelease ? '#10b981' : '#4b5563',
                borderRadius: '11px', position: 'relative', transition: 'background 0.3s', cursor: 'pointer'
              }} onClick={() => socket.emit('set_free_release', !auction?.allowFreeRelease)}>
                <div style={{
                  width: '18px', height: '18px', background: 'white', borderRadius: '50%',
                  position: 'absolute', top: '2px', left: auction?.allowFreeRelease ? '24px' : '2px',
                  transition: 'left 0.3s'
                }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: auction?.allowFreeRelease ? '#10b981' : '#aaa' }}>
                {auction?.allowFreeRelease ? 'ON' : 'OFF'}
              </span>
            </div>

            {/* Toggle: Chiamata Autonoma */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '8px' }}>
              <span style={{ color: 'white', fontWeight: 'bold', fontSize: '0.85rem' }}>📣 Chiamata Autonoma:</span>
              <div style={{
                width: '44px', height: '22px', background: auction?.allowSelfCall ? '#3b82f6' : '#4b5563',
                borderRadius: '11px', position: 'relative', transition: 'background 0.3s', cursor: 'pointer'
              }} onClick={() => socket.emit('set_self_call', !auction?.allowSelfCall)}>
                <div style={{
                  width: '18px', height: '18px', background: 'white', borderRadius: '50%',
                  position: 'absolute', top: '2px', left: auction?.allowSelfCall ? '24px' : '2px',
                  transition: 'left 0.3s'
                }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: auction?.allowSelfCall ? '#3b82f6' : '#aaa' }}>
                {auction?.allowSelfCall ? 'ON' : 'OFF'}
              </span>
            </div>

            {/* Toggle: Scambi */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '8px' }}>
              <span style={{ color: 'white', fontWeight: 'bold', fontSize: '0.85rem' }}>🔄 Scambi:</span>
              <div style={{
                width: '44px', height: '22px', background: auction?.allowTrades ? '#8b5cf6' : '#4b5563',
                borderRadius: '11px', position: 'relative', transition: 'background 0.3s', cursor: 'pointer'
              }} onClick={() => socket.emit('set_trades_enabled', !auction?.allowTrades)}>
                <div style={{
                  width: '18px', height: '18px', background: 'white', borderRadius: '50%',
                  position: 'absolute', top: '2px', left: auction?.allowTrades ? '24px' : '2px',
                  transition: 'left 0.3s'
                }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: auction?.allowTrades ? '#8b5cf6' : '#aaa' }}>
                {auction?.allowTrades ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <button 
            onClick={() => setViewMode('sintetica')}
            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', fontWeight: 'bold', background: viewMode === 'sintetica' ? '#3b82f6' : 'rgba(255,255,255,0.1)', color: viewMode === 'sintetica' ? 'white' : '#aaa', cursor: 'pointer' }}
          >
            📱 Vista Sintetica (Riepilogo)
          </button>
          <button 
            onClick={() => setViewMode('completa')}
            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', fontWeight: 'bold', background: viewMode === 'completa' ? '#3b82f6' : 'rgba(255,255,255,0.1)', color: viewMode === 'completa' ? 'white' : '#aaa', cursor: 'pointer' }}
          >
            📋 Vista Completa (Svincoli)
          </button>
        </div>

        {viewMode === 'sintetica' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {teams.map(team => {
              const currentBalance = team.balance || 0;
              const fpfData = team.fpf || {};
              const slotUsati = team.roster?.length || 0;
              const maxSlot = fpfData.slot || 25;
              
              // Color coding for balance
              let balanceColor = '#10b981'; // green
              if (currentBalance < 0 && currentBalance >= -200) balanceColor = '#fbbf24'; // yellow
              else if (currentBalance < -200 && currentBalance >= -400) balanceColor = '#f97316'; // orange
              else if (currentBalance < -400) balanceColor = '#ef4444'; // red

              return (
                <div key={team.name} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '15px', borderLeft: `4px solid ${balanceColor}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, color: 'white', fontSize: '1.2rem' }}>{team.name}</h3>
                    <span style={{ fontSize: '0.75rem', padding: '3px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', color: '#aaa' }}>{fpfData.label || 'Sconosciuta'}</span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {/* FPF */}
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8rem', color: '#aaa', fontWeight: 'bold' }}>FPF</span>
                      <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: balanceColor }}>{currentBalance} cr</span>
                    </div>

                    {/* SLOT */}
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8rem', color: '#aaa', fontWeight: 'bold' }}>SLOT</span>
                      <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: slotUsati > maxSlot ? '#ef4444' : 'white' }}>{slotUsati} / {maxSlot}</span>
                    </div>
                  </div>

                  {/* BONUS */}
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: '#aaa', fontWeight: 'bold' }}>BONUS FPF</span>
                    <div style={{ display: 'flex', gap: '10px', fontSize: '0.9rem' }}>
                      <span style={{ color: '#60a5fa' }}>Casa +{fpfData.bonusCasa || 0}</span>
                      <span style={{ color: '#a78bfa' }}>Trasf +{fpfData.bonusTrasferta || 0}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      const input = window.prompt(`Modifica Bilancio FPF per ${team.name}\nAttuale: ${currentBalance} cr\n\nInserisci il nuovo bilancio FPF esatto:`, currentBalance);
                      if (input !== null) {
                        const newBalance = parseInt(input);
                        if (!isNaN(newBalance)) {
                          if (window.confirm(`Confermi di impostare il bilancio FPF di ${team.name} a ${newBalance} cr?`)) {
                            socket.emit('manual_fpf_update', { teamName: team.name, newBalance });
                          }
                        }
                      }
                    }}
                    style={{ background: 'linear-gradient(to right, #3b82f6, #2563eb)', color: 'white', border: 'none', borderRadius: '6px', padding: '8px', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 'bold', marginTop: '5px' }}
                  >
                    ✏️ Modifica FPF Manualmente
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === 'completa' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
          {teams.map(team => (
            <div key={team.name} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#fbbf24', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{team.name} <span style={{ fontSize: '0.8rem', color: '#aaa' }}>({team.roster?.length || 0}/25)</span></span>
                <button 
                  onClick={() => {
                    const currentBalance = team.balance || 0;
                    const input = window.prompt(`Modifica Bilancio FPF per ${team.name}\nAttuale: ${currentBalance} cr\n\nInserisci il nuovo bilancio FPF esatto:`, currentBalance);
                    if (input !== null) {
                      const newBalance = parseInt(input);
                      if (!isNaN(newBalance)) {
                        if (window.confirm(`Confermi di impostare il bilancio FPF di ${team.name} a ${newBalance} cr?`)) {
                          socket.emit('manual_fpf_update', { teamName: team.name, newBalance });
                        }
                      }
                    }
                  }}
                  style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                  title="Correggi FPF Manualmente"
                >
                  Modifica FPF
                </button>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {(team.roster || []).map((p, idx) => {
                  const pName = p.Nome || p.name || p.player || '';
                  const listonePlayer = players.find(lp => (lp.Nome || '').trim().toLowerCase() === pName.toLowerCase());
                  const qtA = listonePlayer?.Quotazione ?? p.cost ?? 0;
                  
                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '0.9rem', color: 'white' }}>
                        <span style={{ color: '#aaa', width: '20px', display: 'inline-block' }}>{p.Ruolo || p.role}</span>
                        {pName}
                      </div>
                      <button 
                        onClick={() => {
                          const input = window.prompt(`Svincolo di ${pName} da ${team.name}.\n\nInserisci il valore in crediti da rimborsare (default: Quotazione attuale se trovata, altrimenti Costo di acquisto):`, qtA);
                          if (input !== null) {
                            const finalRefund = parseInt(input) || 0;
                            if (window.confirm(`Confermi lo svincolo di ${pName} da ${team.name} con un rimborso di ${finalRefund} cr?`)) {
                              socket.emit('release_player', { playerName: pName, teamName: team.name, refundAmount: finalRefund });
                            }
                          }
                        }}
                        style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                        title={`Svincola e scegli rimborso (default ${qtA} cr)`}
                      >
                        Svincola e Rimborsa ({qtA}cr)
                      </button>
                    </div>
                  );
                })}
                {(!team.roster || team.roster.length === 0) && (
                  <div style={{ color: '#aaa', fontSize: '0.85rem', fontStyle: 'italic' }}>Rosa vuota</div>
                )}
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* NEW: Storico Scambi ed Esportazione */}
      <div className="fpf-panel" style={{ marginTop: '2rem', border: '2px solid var(--accent-blue)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
          <h2>4. Storico Scambi & Esportazione</h2>
          <button 
            onClick={handleExportExcel}
            style={{ background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            <FileSpreadsheet size={20} /> Esporta Riepilogo Excel
          </button>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '15px' }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#60a5fa' }}>Scambi Conclusi</h3>
          
          {trades.filter(t => t.status === 'ACCEPTED').length === 0 ? (
            <div style={{ color: '#aaa', fontStyle: 'italic' }}>Nessuno scambio concluso finora.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {trades.filter(t => t.status === 'ACCEPTED').map(trade => (
                <div key={trade.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px', borderLeft: '4px solid #8b5cf6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: '#aaa' }}>{new Date(trade.timestamp).toLocaleString('it-IT')}</span>
                    <span style={{ fontSize: '0.8rem', background: '#10b981', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>COMPLETATO</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                      <div style={{ color: '#fbbf24', fontWeight: 'bold', marginBottom: '5px' }}>Da: {trade.fromTeam}</div>
                      {trade.offeredPlayers.map(p => (
                        <div key={p.name} style={{ fontSize: '0.9rem' }}>• {p.name} <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>({p.role})</span></div>
                      ))}
                      {trade.balanceTransfer > 0 && <div style={{ fontSize: '0.9rem', color: '#10b981', marginTop: '4px' }}>+ {trade.balanceTransfer} cr</div>}
                    </div>
                    <div>
                      <div style={{ color: '#60a5fa', fontWeight: 'bold', marginBottom: '5px' }}>A: {trade.toTeam}</div>
                      {trade.requestedPlayers.map(p => (
                        <div key={p.name} style={{ fontSize: '0.9rem' }}>• {p.name} <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>({p.role})</span></div>
                      ))}
                      {trade.balanceTransfer < 0 && <div style={{ fontSize: '0.9rem', color: '#10b981', marginTop: '4px' }}>+ {Math.abs(trade.balanceTransfer)} cr</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
