import React, { useState, useEffect } from 'react';
import { Upload, Download, RefreshCw, Database, Copy, Share2 } from 'lucide-react';
import { BACKEND_URL } from '../utils/socket';
import { useAuth } from '../components/AuthContext';

export default function AdminDashboard() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [networkIps, setNetworkIps] = useState([]);
  const [pins, setPins] = useState([]);
  const { auth, logout } = useAuth();

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
        if (data.success) setPins(data.pins);
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

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', color: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
          <Database size={32} /> Setup Iniziale (Admin)
        </h1>
        <button onClick={logout} style={{ background: '#e60000', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          Esci
        </button>
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

    </div>
  );
}
