import React, { useState, useEffect } from 'react';
import { Upload, Download, RefreshCw, Database, Copy, Share2 } from 'lucide-react';
import { BACKEND_URL, socket } from '../utils/socket';
import { useAuth } from '../components/AuthContext';

export default function AdminDashboard() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [networkIps, setNetworkIps] = useState([]);
  const [pins, setPins] = useState([]);
  const { auth, logout } = useAuth();

  const handleForceReload = () => {
    if (confirm("Vuoi forzare il ricaricamento di tutti i dispositivi dei partecipanti?")) {
      socket.emit('trigger_force_reload', '211287');
      alert("Comando di ricaricamento inviato con successo!");
    }
  };

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/network-info`)
      .then(res => res.json())
      .then(data => {
        if (data.ips && data.ips.length > 0) {
          setNetworkIps(data.ips);
        }
      })
      .catch(err => console.error("Could not fetch network info", err));

    fetch(`${BACKEND_URL}/api/pins`)
      .then(res => res.json())
      .then(data => {
        if (data.pins) {
          const pinsArray = Object.entries(data.pins).map(([teamName, pin]) => ({
            teamName,
            pin
          }));
          setPins(pinsArray);
        }
      })
      .catch(err => console.error("Could not fetch pins", err));
  }, []);

  const handleUploadRosters = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/upload-rosters`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        alert(`Importazione completata! Caricati ${data.count} giocatori nelle rose.`);
      } else {
        alert('Errore durante l\'importazione: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Errore di connessione al server.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetAll = async () => {
    const enteredPin = prompt("Inserisci la password (PIN Master) per confermare il reset completo:");
    if (!enteredPin) return;

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/reset-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pin: enteredPin })
      });
      const data = await res.json();
      if (data.success) {
        alert('Reset completato con successo! Le rose sono ora vuote.');
      } else {
        alert('Errore: ' + (data.error || 'PIN non valido'));
      }
    } catch (err) {
      console.error(err);
      alert('Errore di connessione al server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', color: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
          <Database size={32} /> Setup Iniziale (Admin)
        </h1>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button 
            onClick={handleForceReload}
            style={{ background: '#fbbf24', color: '#00154d', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={18} /> Forza Refresh Schermi
          </button>
          <button onClick={logout} style={{ background: '#e60000', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            Esci
          </button>
        </div>
      </div>

      <div style={{ background: 'rgba(34, 197, 94, 0.2)', border: '2px solid #22c55e', padding: '1.5rem', borderRadius: '10px', marginBottom: '2rem' }}>
        <h3 style={{ color: '#22c55e', margin: '0 0 10px 0' }}>🌐 Link Condivisione Partecipanti</h3>
        <p style={{ margin: '0 0 10px 0' }}>Invia questo link ai partecipanti per farli accedere all'app.</p>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'monospace', flex: 1 }}>
            https://bundesalassa.netlify.app
          </div>
          <button 
            onClick={() => { navigator.clipboard.writeText('https://bundesalassa.netlify.app'); alert('Copiato!'); }}
            style={{ background: '#22c55e', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}
          >
            <Copy size={20} />
          </button>
        </div>
      </div>

      <div className="fpf-panel" style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '15px', marginBottom: '2rem' }}>
        <h2>Gestione Accessi (PIN)</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {pins.map(p => (
            <div key={p.teamName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}>
              <strong style={{ fontSize: '1.1rem' }}>{p.teamName}</strong>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '1.2rem', letterSpacing: '2px' }}>{p.pin}</span>
                <button 
                  onClick={() => { navigator.clipboard.writeText(`Ciao! Accedi all'asta qui: https://bundesalassa.netlify.app\nIl tuo PIN personale è: ${p.pin}`); alert('PIN Copiato!'); }}
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <Copy size={16} /> Copia
                </button>
                <button 
                  onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Ciao! Accedi all'asta qui: https://bundesalassa.netlify.app\nIl tuo PIN personale è: ${p.pin}`)}`, '_blank')}
                  style={{ background: '#25D366', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <Share2 size={16} /> WhatsApp
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="fpf-panel" style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '15px' }}>
        <h2>Importa Rose da Excel & Reset</h2>
        <p style={{ color: '#ccc', marginBottom: '1.5rem' }}>
          Carica il file Excel (Fanta Continuativo) contenente i 10 fogli delle squadre per <strong>Inizializzare o Resettare</strong> l'ambiente. 
          Questa operazione cancella tutti i test in corso e riporta saldi, giocatori e fasce FPF esattamente a quelli del file!
        </p>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '10px' }}>
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            onChange={(e) => setFile(e.target.files[0])} 
            style={{ flex: 1 }}
          />
          <button 
            onClick={handleUploadRosters} 
            disabled={!file || loading}
            style={{ 
              background: loading ? 'gray' : 'var(--fpf-f1)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontWeight: 'bold',
              cursor: loading || !file ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? <RefreshCw className="spin" size={20} /> : <Upload size={20} />}
            {loading ? 'Importazione...' : 'Importa Rose'}
          </button>
        </div>
      </div>
      
      {/* Esportazione futura */}
      <div className="fpf-panel" style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '15px', marginTop: '2rem' }}>
        <h2>Esporta Dati Finali</h2>
        <p style={{ color: '#ccc', marginBottom: '1.5rem' }}>
          A fine asta potrai scaricare il file Excel contenente due fogli:
          <br/>- <strong>Rose Finali:</strong> Tutte le rose con riepilogo crediti spesi, slot occupati e Fascia/Bonus FPF.
          <br/>- <strong>Movimenti Asta:</strong> Cronologia completa (chi ha venduto, chi ha comprato, importo e tipo operazione).
        </p>
        <button 
          onClick={() => {
            window.location.href = `${BACKEND_URL}/api/export`;
          }}
          style={{ background: '#4CAF50', display: 'flex', alignItems: 'center', gap: '10px', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          <Download size={20} /> Scarica Excel Asta Finita
        </button>
      </div>

      {/* Reset di Emergenza */}
      <div className="fpf-panel" style={{ background: 'rgba(230,0,0,0.1)', border: '2px dashed #e60000', padding: '2rem', borderRadius: '15px', marginTop: '2rem' }}>
        <h2 style={{ color: '#e60000', margin: '0 0 10px 0' }}>🚨 Reset Totale delle Rose</h2>
        <p style={{ color: '#ccc', marginBottom: '1.5rem' }}>
          Questo comando svuota interamente le rose di tutti i partecipanti, azzera tutti i movimenti registrati, e ripristina lo stato dell'asta a inattivo. 
          <br/><strong>Nota:</strong> Questa operazione non tocca il listone dei giocatori né le statistiche di rendimento.
        </p>
        <button 
          onClick={handleResetAll}
          disabled={loading}
          style={{ background: '#e60000', display: 'flex', alignItems: 'center', gap: '10px', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          <RefreshCw size={20} /> Azzera Rose e Movimenti
        </button>
      </div>

    </div>
  );
}
