import React, { useEffect, useState, useRef } from 'react';
import { Shield, DollarSign, AlertTriangle, Users } from 'lucide-react';
import { socket } from '../utils/socket';

// Helper per i beep del timer (ansia)
const playBeep = (freq, duration, vol) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.error('AudioContext error', e);
  }
};

// Genera un suono di fiche da poker/click metallico in tempo reale
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
    console.error('AudioContext error', e);
  }
};

const getMantraColor = (roleStr) => {
  if (!roleStr) return 'rgba(255,255,255,0.3)';
  const r = roleStr.toLowerCase();
  if (r.includes('por')) return '#f59e0b';
  if (/\b(ds|dc|dd|b)\b/.test(r)) return '#22c55e';
  if (/\b(e|m|c)\b/.test(r) && !r.includes('dc') && !r.includes('pc')) return '#3b82f6';
  if (/\b(w|t)\b/.test(r)) return '#d946ef';
  if (/\b(a|pc)\b/.test(r)) return '#ef4444';
  return 'rgba(255,255,255,0.3)';
};

export default function HostDashboard() {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [introPlaying, setIntroPlaying] = useState(false);
  const [teams, setTeams] = useState([]);
  const [auction, setAuction] = useState({
    status: 'IDLE',
    currentPlayer: null,
    currentBid: 0,
    currentBidder: null,
    timerSeconds: 0
  });

  const prevTimerRef = useRef(0);
  const prevStatusRef = useRef('IDLE');
  const hasPlayedResolutionRef = useRef(false);

  const [showBidGif, setShowBidGif] = useState(false);
  const [bidGifUrl, setBidGifUrl] = useState(null);
  const prevBidRef = useRef(0);
  const bidGifTimerRef = useRef(null);

  useEffect(() => {
    if (!auction) return;
    if (auction.status === 'ACTIVE' && auction.currentBid > prevBidRef.current && auction.currentBidder) {
       const bidder = auction.currentBidder;
       setBidGifUrl(`/img/gif/${encodeURIComponent(bidder)}.gif`);
       setShowBidGif(true);

       const bidAudio = new Audio(`/audio/rilancio/${encodeURIComponent(bidder)}.mp3`);
       bidAudio.play().catch(() => {
          // Riproduce il suono fiches di default se non trova il file mp3 della squadra
          playDefaultBidSound();
       });

       if (bidGifTimerRef.current) clearTimeout(bidGifTimerRef.current);
       bidGifTimerRef.current = setTimeout(() => {
          setShowBidGif(false);
       }, 2500); 
    }
    prevBidRef.current = auction.currentBid;
  }, [auction?.currentBid, auction?.currentBidder, auction?.status]);

  useEffect(() => {
    socket.on('teams_update', (data) => setTeams(data));
    socket.on('auction_update', (data) => {
      setAuction(data);
    });

    return () => {
      socket.off('teams_update');
      socket.off('auction_update');
    };
  }, []);

  const auctionRef = useRef(auction);
  useEffect(() => {
    auctionRef.current = auction;
  }, [auction]);

  useEffect(() => {
    if (!auction) return;
    // 1. Tick during ACTIVE countdown
    if (auction.status === 'ACTIVE' && auction.timerSeconds > 0 && prevTimerRef.current !== auction.timerSeconds) {
      if (auction.timerSeconds <= 3) {
        playBeep(800, 0.2, 0.5); // Ansia
      }
    }

    const playResolutionAudio = (resolvedDecision) => {
       if (hasPlayedResolutionRef.current) return;
       hasPlayedResolutionRef.current = true;

       const actualWinner = resolvedDecision === 'PROTEGGI' 
            ? auctionRef.current.currentPlayer.currentOwner 
            : auctionRef.current.currentBidder;

       if (resolvedDecision === 'UNSOLD') return;

       if (resolvedDecision === 'PROTEGGI') {
         const lose = new Audio('/sounds/lose.mp3');
         lose.play().catch(() => {});
         lose.onended = () => {
            if (auctionRef.current.status === 'ASSIGNED') {
                if (actualWinner) {
                   const customWin = new Audio(`/audio/vittoria/${encodeURIComponent(actualWinner)}.mp3`);
                   customWin.play().catch(() => {
                       new Audio('/sounds/applause.mp3').play().catch(() => {});
                   });
                } else {
                   new Audio('/sounds/applause.mp3').play().catch(() => {});
                }
            }
         };
       } else if (resolvedDecision === 'ACQUISTO' || resolvedDecision === 'VENDI') {
         if (actualWinner) {
            const customWin = new Audio(`/audio/vittoria/${encodeURIComponent(actualWinner)}.mp3`);
            customWin.play().catch(() => {
                new Audio('/sounds/goal.mp3').play().catch(() => {});
            });
         } else {
            new Audio('/sounds/goal.mp3').play().catch(() => {});
         }
       }
    };

    // 2. Transizioni da ACTIVE (Fine timer o Assegnazione diretta)
    if (prevStatusRef.current === 'ACTIVE' && (auction.status === 'ASSIGNED' || auction.status === 'BIVIO')) {
      const whistle = new Audio('/sounds/whistle.mp3');
      whistle.play().catch(() => {});
      whistle.onended = () => {
         const currentStatus = auctionRef.current.status;
         if (currentStatus === 'BIVIO') {
             if (window.tickAudio) window.tickAudio.pause();
             window.tickAudio = new Audio('/sounds/tick.mp3');
             window.tickAudio.play().catch(() => {});
         } else if (currentStatus === 'ASSIGNED') {
             playResolutionAudio(auctionRef.current.lastDecision);
         }
      };
    }

    // 3. Transizioni da BIVIO (Decisione presa)
    if (prevStatusRef.current === 'BIVIO' && auction.status !== 'BIVIO') {
      if (window.tickAudio) {
        window.tickAudio.pause();
        window.tickAudio = null;
      }
      if (auction.status === 'ASSIGNED') {
          playResolutionAudio(auction.lastDecision);
      }
    }

    // 4. Force stop everything if IDLE
    if (auction.status === 'IDLE' && prevStatusRef.current !== 'IDLE') {
       hasPlayedResolutionRef.current = false;
       if (window.tickAudio) {
          window.tickAudio.pause();
          window.tickAudio = null;
       }
    }

    prevTimerRef.current = auction.timerSeconds;
    prevStatusRef.current = auction.status;
  }, [auction]);

  const getFpfColor = (fascia) => {
    return `var(--fpf-f${fascia})`;
  };

  const getMissingCreditsToNextTier = (balance, fascia) => {
    if (fascia === 1 || balance >= 0) return 0;
    const nextTierThreshold = -(fascia - 2) * 100; 
    return Math.abs(balance - nextTierThreshold);
  };

  const timerColor = auction?.timerSeconds <= 3 ? '#ef4444' : auction?.timerSeconds <= 5 ? '#f59e0b' : '#22c55e';

  if (!audioEnabled || introPlaying) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)', color: 'white', flexDirection: 'column', background: 'linear-gradient(135deg, #020914 0%, #0c2b5e 100%)' }}>
        <h1 style={{ fontSize: '4rem', marginBottom: '2rem', fontStyle: 'italic', letterSpacing: '4px', textShadow: '0 5px 15px rgba(0,0,0,0.8)' }}>
          <span style={{ color: '#0055ff' }}>SKY</span> <span style={{ color: '#e60000' }}>SPORT</span> FANTABUNDES
        </h1>
        
        {!audioEnabled ? (
          <>
            <p style={{ fontSize: '1.5rem', marginBottom: '2rem', color: 'var(--text-muted)' }}>Clicca sul pulsante per abilitare l'audio e avviare il maxischermo</p>
            <button 
              onClick={() => {
                setAudioEnabled(true);
                setIntroPlaying(true);
                const audio = new Audio('/sounds/champions.mp3');
                audio.play().catch(e => console.error(e));
                audio.onended = () => setIntroPlaying(false);
                window.introAudio = audio;
              }} 
              style={{ padding: '20px 40px', fontSize: '2rem', background: '#0055ff', color: 'white', border: 'none', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 10px 20px rgba(0,85,255,0.4)', transition: 'all 0.2s', animation: 'pulse 2s infinite' }}
            >
              AVVIA MAXISCHERMO
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', animation: 'fadeIn 1s' }}>
            <h2 style={{ color: 'white', fontSize: '2.5rem', marginBottom: '2rem' }}>Caricamento in corso...</h2>
            <button 
              onClick={() => {
                if (window.introAudio) window.introAudio.pause();
                setIntroPlaying(false);
              }}
              style={{ padding: '15px 30px', fontSize: '1.2rem', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid white', borderRadius: '30px', cursor: 'pointer' }}
            >
              Salta Intro (Skip)
            </button>
          </div>
        )}
      </div>
    );
  }

  const formatPlayerNameForUrl = (name) => {
    if (!name) return '';
    let normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    
    // Fantacalcio ora usa esattamente il nome del listone in MAIUSCOLO
    // con gli spazi sostituiti da trattini e senza punti.
    
    // Rarissime eccezioni in cui Fantacalcio ha tagliato il nome
    if (normalized === 'ADAMS C.') return 'ADAMS';
    if (normalized === 'ESPOSITO F.P.') return 'ESPOSITOFP'; // Testato, Esposito FP è spesso problematico
    
    return normalized
      .replace(/\./g, '')
      .replace(/['\s]+/g, '-')
      .replace(/[^A-Z0-9-]/g, '');
  };

  return (
    <div className="page-container skysport-container" style={{ maxWidth: '100vw', padding: 0, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      
      {/* HEADER & TICKER (Top Banner) */}
      <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(90deg, rgba(2,9,20,1) 0%, rgba(12,43,94,1) 50%, rgba(2,9,20,1) 100%)' }}>
          <h1 style={{ margin: 0, color: 'white', fontStyle: 'italic', fontWeight: '900', letterSpacing: '2px', display: 'flex', alignItems: 'center', gap: '15px' }}>
            {/* Authentic Sky Sport Logo */}
            <div style={{ display: 'flex', height: '36px', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.5)' }}>
              <div style={{ background: 'linear-gradient(180deg, #1f3b73 0%, #061942 100%)', padding: '0 12px', display: 'flex', alignItems: 'center' }}>
                <span style={{ color: 'white', fontFamily: 'sans-serif', fontWeight: 'bold', fontSize: '22px', letterSpacing: '-1px' }}>sky</span>
              </div>
              <div style={{ background: 'linear-gradient(180deg, #e60000 0%, #b30000 100%)', padding: '0 12px', display: 'flex', alignItems: 'center' }}>
                <span style={{ color: 'white', fontFamily: 'sans-serif', fontWeight: 'normal', fontSize: '22px', letterSpacing: '0px' }}>sport</span>
              </div>
            </div>
            FANTABUNDE SALASSA 26/27
          </h1>
          {auction?.status === 'IDLE' && <div style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>ATTESA SEGRETERIA...</div>}
        </div>
        
        {/* SkySport Ticker */}
        <div className="skysport-ticker" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', backgroundImage: 'linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url("/stadium.jpg")', backgroundSize: '100% 100%', backgroundPosition: 'center center', backgroundRepeat: 'no-repeat', padding: '15px 0', borderTop: '1px solid rgba(255,255,255,0.1)', borderBottom: '2px solid rgba(255,0,0,0.8)' }}>
          {teams.map((team, index) => {
            const fpfColor = getFpfColor(team.fpf?.fascia || 1);
            const defaultLogo = `https://ui-avatars.com/api/?name=${encodeURIComponent(team.name)}&background=random&color=fff&bold=true`;
            
            const isSalassuolo = team.name.toLowerCase() === 'salassuolo';
            const isPertusio = team.name.toLowerCase() === 'pertusio' || team.name.toLowerCase().includes('pertusio');
            
            // Layout logic: 5 items per row to make them all equal size and not too long
            const itemWidth = 'calc(20% - 8px)';

            return (
              <div key={team.name} className="skysport-ticker-item" style={{ '--fpf-color': fpfColor, display: 'flex', alignItems: 'center', width: itemWidth, padding: '5px 10px', boxSizing: 'border-box', background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', margin: '4px' }}>
                <div style={{ position: 'relative', marginRight: '10px' }}>
                  <img src={team.logoUrl || defaultLogo} alt={team.name} style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', paddingRight: '5px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '1rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{team.name}</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {isSalassuolo && (
                        <>
                          <img src="/scudetto.svg" alt="Scudetto" style={{ height: '20px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                          <img src="/coppa.svg" alt="Supercoppa" style={{ height: '20px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                        </>
                      )}
                      {isPertusio && (
                        <img src="/coppa.svg" alt="Coppa" style={{ height: '20px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.85rem', color: fpfColor, marginTop: '4px', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold' }}>Fascia {team.fpf?.fascia || 1}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>•</span>
                    <span>FPF: <strong style={{ color: 'white' }}>{team.balance} cr</strong></span>
                    {team.fpf?.fascia > 1 && (
                      <span style={{ color: '#aaa', fontSize: '0.75rem', fontStyle: 'italic' }}>(a {getMissingCreditsToNextTier(team.balance, team.fpf.fascia)} cr da F{team.fpf.fascia - 1})</span>
                    )}
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>•</span>
                    <span>Slot: <strong style={{ color: 'white' }}>{team.roster?.length || 0}/{team.fpf?.slot || 25}</strong></span>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>•</span>
                    <span style={{ background: 'rgba(255,255,255,0.15)', padding: '2px 6px', borderRadius: '4px', color: '#ffb703', fontWeight: 'bold', border: '1px solid rgba(255,183,3,0.3)', fontSize: '0.9rem' }}>
                      Bonus: +{team.fpf?.bonusCasa || 0} / +{team.fpf?.bonusTrasferta || 0}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="dashboard-grid" style={{ flex: 1, overflow: 'hidden' }}>
        
        {/* Left Column: TV Broadcast / Player Card */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {auction?.currentPlayer ? (
            <div className="skysport-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', margin: '20px', padding: '20px', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 20, left: 20, display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ background: getMantraColor(auction.currentPlayer.role), padding: '10px 30px', borderRadius: 25, fontWeight: '900', border: '3px solid rgba(255,255,255,0.4)', fontSize: '2rem', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', color: 'white', textTransform: 'uppercase' }}>
                  {auction.currentPlayer.role}
                </div>
                {auction.currentPlayer.currentOwner && teams.find(t => t.name === auction.currentPlayer.currentOwner)?.logoUrl && (
                  <img src={teams.find(t => t.name === auction.currentPlayer.currentOwner).logoUrl} alt="Owner Logo" style={{ width: '60px', height: '60px', borderRadius: '50%', border: '3px solid white', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }} />
                )}
              </div>
              <img 
                src={`https://content.fantacalcio.it/web/campioncini/small/${formatPlayerNameForUrl(auction.currentPlayer.name)}.png`}
                alt={auction.currentPlayer.name} 
                referrerPolicy="no-referrer"
                className="campioncino-img"
                style={{ width: '250px', height: '250px', margin: '0 auto', filter: 'drop-shadow(0 15px 25px rgba(0,0,0,0.8))' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div className="player-name skysport-text-glow" style={{ fontSize: '4.5rem', textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>{auction.currentPlayer.name}</div>
              {auction.currentPlayer.currentOwner && (
                <div style={{ color: '#fbbf24', marginTop: '10px', fontSize: '1.2rem', fontWeight: 'bold' }}>
                  <AlertTriangle size={20} style={{ display: 'inline', verticalAlign: 'middle' }}/> Di proprietà di: {auction.currentPlayer.currentOwner} (Rinnovo: {auction.currentPlayer.oldRinnovo} cr)
                </div>
              )}

              <div className="player-stats-grid" style={{ marginTop: '2rem', gap: '2rem' }}>
                <div className="stat-box" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span className="stat-label">FM</span>
                  <span className="stat-val">{auction.currentPlayer.stats?.fm || '-'}</span>
                </div>
                <div className="stat-box" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span className="stat-label">Gol</span>
                  <span className="stat-val">{auction.currentPlayer.stats?.gol || '-'}</span>
                </div>
                <div className="stat-box" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span className="stat-label">Ass</span>
                  <span className="stat-val">{auction.currentPlayer.stats?.ass || '-'}</span>
                </div>
                <div className="stat-box" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span className="stat-label">Quot</span>
                  <span className="stat-val" style={{ color: '#3b82f6' }}>{auction.currentPlayer.quot || '-'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="player-tv-card" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
              <div style={{ textAlign: 'center' }}>
                <Users size={64} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                <h2 style={{ fontSize: '2rem' }}>Nessun giocatore all'asta</h2>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Action / Bivio */}
        <div className="fpf-panel" style={{ justifyContent: 'center', position: 'relative' }}>
          {auction?.status === 'ACTIVE' && (
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '1.5rem', textTransform: 'uppercase', letterSpacing: '2px' }}>Asta in Corso</h2>
              
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '4rem 0', position: 'relative' }}>
                <div className="timer-container" style={{ '--timer-color': timerColor, transform: 'scale(1.5)' }}>
                  {auction.timerSeconds}
                </div>
                {showBidGif && (
                  <div style={{ position: 'absolute', right: '0', top: '50%', transform: 'translateY(-50%)', width: '220px', height: '160px', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.8)', border: '4px solid #ef4444', background: 'rgba(0,0,0,0.5)' }}>
                      <img 
                        src={bidGifUrl} 
                        alt="Rilancio GIF" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.target.parentElement.style.display = 'none'; }}
                      />
                  </div>
                )}
              </div>

              {auction.currentBidder ? (
                 <div className="skysport-card" style={{ padding: '2rem', marginTop: '2rem', position: 'relative' }}>
                     <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Miglior Offerta</p>
                     <p className="skysport-price" style={{ margin: '1rem 0' }}>{auction.currentBid} <span style={{fontSize: '2rem'}}>cr</span></p>
                     <p style={{ fontSize: '1.8rem', margin: 0 }}>Offerta da: <strong>{auction.currentBidder}</strong></p>
                     
                   {/* EASTER EGG AGLIENTUS / LOGhi */}
                   {auction.currentBidder === 'FC Aglientus' && (
                     <div style={{ position: 'absolute', top: '50%', right: '40px', marginTop: '-90px', zIndex: 100 }}>
                       <img src="/aglientus.png" alt="Aglientus" style={{ width: '180px', height: '180px', filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))', animation: 'bounce 2s infinite alternate' }} />
                     </div>
                   )}
                   {auction.currentBidder !== 'FC Aglientus' && (
                     <div style={{ position: 'absolute', top: '50%', right: '40px', marginTop: '-60px', zIndex: 100 }}>
                       {(() => {
                         const bTeam = teams.find(t => t.name === auction.currentBidder);
                         if (!bTeam) return null;
                         const defaultLogo = `https://ui-avatars.com/api/?name=${encodeURIComponent(bTeam.name)}&background=random&color=fff&bold=true`;
                         return <img src={bTeam.logoUrl || defaultLogo} alt="Logo" style={{ width: '120px', height: '120px', filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))', borderRadius: '50%', border: '3px solid var(--accent-blue)' }} />
                       })()}
                     </div>
                   )}
                 </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '1.5rem', marginTop: '2rem' }}>In attesa di offerte... Base d'asta: 1 cr</div>
              )}
            </div>
          )}

          {auction?.status === 'BIVIO' && (() => {
            const ownerTeam = teams.find(t => t.name === auction.currentPlayer.currentOwner);
            const balance = ownerTeam ? ownerTeam.balance : 0;
            const fpfInfo = ownerTeam ? ownerTeam.fpf : { fascia: 1, slot: 25, bonusCasa: 0, bonusTrasferta: 0 };
            
            const getFpfTierInfoLocal = (bal) => {
              if (bal >= 0) return { fascia: 1, slot: 30, bonusCasa: 3, bonusTrasferta: 2 };
              if (bal >= -100) return { fascia: 2, slot: 29, bonusCasa: 3, bonusTrasferta: 1 };
              if (bal >= -200) return { fascia: 3, slot: 28, bonusCasa: 3, bonusTrasferta: 0 };
              if (bal >= -300) return { fascia: 4, slot: 27, bonusCasa: 2, bonusTrasferta: 0 };
              if (bal >= -400) return { fascia: 5, slot: 26, bonusCasa: 1, bonusTrasferta: 0 };
              if (bal >= -500) return { fascia: 6, slot: 25, bonusCasa: 0, bonusTrasferta: 0 };
              if (bal >= -600) return { fascia: 7, slot: 24, bonusCasa: 0, bonusTrasferta: 0 };
              return { fascia: 8, slot: 23, bonusCasa: 0, bonusTrasferta: 0 };
            };
            
            const getDiscountedPriceLocal = (pfa) => {
              if (pfa >= 1 && pfa <= 17) return Math.floor(pfa * 0.90);
              if (pfa >= 18 && pfa <= 46) return Math.floor(pfa * 0.80);
              if (pfa >= 47 && pfa <= 92) return Math.floor(pfa * 0.70);
              return Math.floor(pfa * 0.55);
            };
            
            const costProteggi = getDiscountedPriceLocal(auction.currentBid);
            const newBalProteggi = balance - costProteggi;
            const infoProteggi = getFpfTierInfoLocal(newBalProteggi);

            const incassoVendi = auction.currentBid;
            const newBalVendi = balance + incassoVendi;
            const infoVendi = getFpfTierInfoLocal(newBalVendi);

            return (
              <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease-out', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <h2 style={{ color: '#fbbf24', fontSize: '2.5rem', textTransform: 'uppercase', marginBottom: '0', textShadow: '0 0 20px rgba(251,191,36,0.5)' }}>
                  BIVIO DECISIONALE
                </h2>
                
                <div className="timer-container" style={{ '--timer-color': timerColor, transform: 'scale(1.2)', margin: '1rem auto' }}>
                  {auction.timerSeconds}
                </div>

                <p style={{ fontSize: '1.5rem', color: 'var(--text-light)', margin: 0 }}>
                  Attesa decisione del proprietario: <strong>{auction.currentPlayer.currentOwner}</strong>
                </p>
                
                <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center' }}>
                  
                  {/* SE PROTEGGI */}
                  <div style={{ flex: 1, background: '#1e81b0', color: 'white', border: '4px solid black', borderRadius: '1rem', padding: '2rem', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      <Shield size={32} /> SE PROTEGGI (TIENE)
                    </h3>
                    <p style={{ margin: '10px 0', fontSize: '1.3rem', fontWeight: 'bold' }}>Costo Effettivo: {costProteggi} cr</p>
                    <p style={{ margin: '10px 0', fontSize: '1.3rem', fontWeight: 'bold' }}>Nuovo Saldo Reale: {newBalProteggi}</p>
                    <p style={{ margin: '10px 0', fontSize: '1.3rem', fontWeight: 'bold' }}>Fascia FPF: {infoProteggi.fascia}</p>
                    <p style={{ margin: '10px 0', fontSize: '1.3rem', fontWeight: 'bold' }}>Slot Max consentiti: {infoProteggi.slot}</p>
                    <p style={{ margin: '10px 0', fontSize: '1.3rem', fontWeight: 'bold' }}>Bonus Campo: +{infoProteggi.bonusCasa} / +{infoProteggi.bonusTrasferta}</p>
                  </div>

                  {/* SE VENDI */}
                  <div style={{ flex: 1, background: '#802a70', color: 'white', border: '4px solid black', borderRadius: '1rem', padding: '2rem', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      <DollarSign size={32} /> SE VENDI (LASCIA)
                    </h3>
                    <p style={{ margin: '10px 0', fontSize: '1.3rem', fontWeight: 'bold' }}>Incasso Reale: +{incassoVendi} cr</p>
                    <p style={{ margin: '10px 0', fontSize: '1.3rem', fontWeight: 'bold' }}>Nuovo Saldo: {newBalVendi}</p>
                    <p style={{ margin: '10px 0', fontSize: '1.3rem', fontWeight: 'bold' }}>Fascia FPF: {infoVendi.fascia}</p>
                    <p style={{ margin: '10px 0', fontSize: '1.3rem', fontWeight: 'bold' }}>Slot Max consentiti: {infoVendi.slot}</p>
                    <p style={{ margin: '10px 0', fontSize: '1.3rem', fontWeight: 'bold' }}>Bonus Campo: +{infoVendi.bonusCasa} / +{infoVendi.bonusTrasferta}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {auction?.status === 'ASSIGNED' && (
            <div style={{ textAlign: 'center', animation: 'zoomIn 0.5s ease-out' }}>
              {auction.lastDecision === 'PROTEGGI' ? (
                <>
                  <div style={{ color: '#3b82f6', fontSize: '3.5rem', fontWeight: '900', textShadow: '0 0 30px rgba(59, 130, 246, 0.5)' }}>
                    MANTENUTO IN ROSA
                  </div>
                  <p style={{ fontSize: '2rem', marginTop: '2rem' }}>da <strong>{auction.currentPlayer.currentOwner}</strong></p>
                </>
              ) : auction.lastDecision === 'UNSOLD' ? (
                <>
                  <div style={{ color: '#ef4444', fontSize: '4rem', fontWeight: '900', textShadow: '0 0 30px rgba(239, 68, 68, 0.5)' }}>
                    SVINCOLATO
                  </div>
                  <p style={{ fontSize: '2rem', marginTop: '2rem', color: 'var(--text-muted)' }}>Nessuna offerta</p>
                </>
              ) : (
                <>
                  <div style={{ color: '#22c55e', fontSize: '4rem', fontWeight: '900', textShadow: '0 0 30px rgba(34, 197, 94, 0.5)' }}>
                    ASSEGNATO!
                  </div>
                  <p style={{ fontSize: '2rem', marginTop: '2rem' }}>a <strong>{auction.currentBidder || auction.currentPlayer.currentOwner}</strong></p>
                </>
              )}
            </div>
          )}

          {auction?.status === 'IDLE' && (
             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.3 }}>
                <AlertTriangle size={100} style={{ marginBottom: '2rem' }} />
                <h2>Standby Segreteria</h2>
             </div>
          )}
        </div>

      </div>
    </div>
  );
}
