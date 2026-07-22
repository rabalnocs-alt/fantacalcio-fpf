import React from 'react';
import { Users } from 'lucide-react';

const formatPlayerNameForUrl = (name) => {
  if (!name) return '';
  let normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  if (normalized === 'ADAMS C.') return 'ADAMS';
  if (normalized === 'ESPOSITO F.P.') return 'ESPOSITOFP';
  return normalized.replace(/\./g, '').replace(/['\s]+/g, '-').replace(/[^A-Z0-9-]/g, '');
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

export default function MiniDashboard({ auction }) {
  if (!auction || auction.status === 'IDLE' || !auction.currentPlayer) {
    return (
      <div style={{
        background: 'rgba(0,20,77,0.8)', backdropFilter: 'blur(10px)',
        borderRadius: '16px', padding: '1.5rem', textAlign: 'center', color: '#b3c6ff',
        boxShadow: '0 4px 15px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)',
        marginBottom: '1rem', minHeight: '150px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center'
      }}>
        <Users size={40} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Nessun giocatore all'asta</h3>
      </div>
    );
  }

  const { currentPlayer, status, timerSeconds, currentBid, currentBidder, lastDecision } = auction;
  const roleColor = getMantraColor(currentPlayer.role);
  const timerColor = timerSeconds <= 3 ? '#e60000' : timerSeconds <= 5 ? '#f59e0b' : '#22c55e';

  return (
    <div style={{
      background: 'rgba(0,20,77,0.8)', backdropFilter: 'blur(10px)',
      borderRadius: '16px', padding: '1rem', color: 'white',
      boxShadow: '0 4px 15px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)',
      borderLeft: `6px solid ${roleColor}`,
      marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem'
    }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <img 
          src={`https://content.fantacalcio.it/web/campioncini/small/${formatPlayerNameForUrl(currentPlayer.name)}.png`}
          alt={currentPlayer.name} 
          referrerPolicy="no-referrer"
          style={{ width: '80px', height: '80px', filter: 'drop-shadow(0 5px 10px rgba(0,0,0,0.5))' }}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <span style={{ background: roleColor, padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
              {currentPlayer.role}
            </span>
            <span style={{ fontWeight: 'bold', fontSize: '1.3rem', lineHeight: 1.1 }}>{currentPlayer.name}</span>
          </div>
          
          {currentPlayer.currentOwner && (
            <div style={{ fontSize: '0.8rem', color: '#fbbf24', marginBottom: '0.5rem' }}>
              Di: {currentPlayer.currentOwner} ({currentPlayer.oldRinnovo} cr)
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', textAlign: 'center', fontSize: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '4px' }}>
            <div><div style={{color: '#b3c6ff'}}>FM</div><div>{currentPlayer.stats?.fm || '-'}</div></div>
            <div><div style={{color: '#b3c6ff'}}>Gol</div><div>{currentPlayer.stats?.gol || '-'}</div></div>
            <div><div style={{color: '#b3c6ff'}}>Ass</div><div>{currentPlayer.stats?.ass || '-'}</div></div>
            <div><div style={{color: '#b3c6ff'}}>Quot</div><div style={{color: '#3b82f6', fontWeight: 'bold'}}>{currentPlayer.quot || '-'}</div></div>
          </div>
        </div>
      </div>

      {(status === 'ACTIVE' || status === 'WAITING' || status === 'BIVIO') && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#b3c6ff' }}>Offerta attuale</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fbbf24' }}>
              {currentBid} cr <span style={{fontSize: '0.9rem', fontWeight: 'normal', color: 'white'}}>- {currentBidder || 'Nessuno'}</span>
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: timerColor, background: 'rgba(0,0,0,0.3)', padding: '0 10px', borderRadius: '8px', minWidth: '50px', textAlign: 'center' }}>
            {timerSeconds}
          </div>
        </div>
      )}

      {status === 'ASSIGNED' && (
        <div style={{ marginTop: '0.5rem', textAlign: 'center', padding: '0.5rem', background: 'rgba(0,0,0,0.4)', borderRadius: '8px' }}>
          {lastDecision === 'PROTEGGI' ? (
             <div style={{ color: '#3b82f6', fontWeight: 'bold', fontSize: '1.1rem' }}>MANTENUTO IN ROSA da {currentPlayer.currentOwner}</div>
          ) : lastDecision === 'UNSOLD' ? (
             <div style={{ color: '#e60000', fontWeight: 'bold', fontSize: '1.1rem' }}>SVINCOLATO</div>
          ) : (
             <div style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '1.1rem' }}>ACQUISTATO da {currentBidder || currentPlayer.currentOwner}</div>
          )}
        </div>
      )}
    </div>
  );
}
