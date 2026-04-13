import { useState, useEffect } from 'react';
import { HouseScene } from './HouseScene';
import './App.css';

const API_URL = 'http://127.0.0.1:8000';

function App() {
  const [currentPage, setCurrentPage] = useState('home'); // 'home' or 'viewer'
  const [description, setDescription] = useState('');
  const [houseData, setHouseData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [backendStatus, setBackendStatus] = useState({
    backend: false,
    ollama: false,
  });
  const [selectedRoom, setSelectedRoom] = useState(null);

  // Vérifier le statut du backend
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(`${API_URL}/health`);
        if (response.ok) {
          const data = await response.json();
          setBackendStatus(data);
        }
      } catch (err) {
        setBackendStatus({ backend: false, ollama: false });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  // Générer la maison
  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Veuillez entrer une description de votre maison');
      return;
    }

    if (!backendStatus.ollama) {
      setError('Ollama n\'est pas disponible.');
      return;
    }

    setIsLoading(true);
    setError('');
    
    console.log('[APP] handleGenerate started, description:', description);

    try {
      console.log('[APP] Calling /generate endpoint...');
      const response = await fetch(`${API_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });

      console.log('[APP] Response received, status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erreur lors de la génération');
      }

      const data = await response.json();
      console.log('[APP] Data received from backend:', data);
      const normalizedHouse = data.house || data;
      console.log('[APP] Rooms count:', normalizedHouse.rooms?.length || 0);
      if (normalizedHouse.rooms?.length > 0) {
        console.log('[APP] First room:', normalizedHouse.rooms[0]);
        console.log('[APP] First room furniture:', normalizedHouse.rooms[0].furniture);
      }
      
      setHouseData(normalizedHouse);
      setCurrentPage('viewer');
      setSelectedRoom(null);
      setError('');
      console.log('[APP] HouseData set, page switched to viewer');
    } catch (err) {
      setError(`Erreur: ${err.message}`);
      console.error('[APP] Error occurred:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleGenerate();
    }
  };

  return (
    <div className="app">
      {currentPage === 'home' ? (
        // PAGE D'ACCUEIL
        <div className="home-page">
          <div className="home-container">
            <div className="home-header">
              <h1>🏠 3D House Generator</h1>
              <p className="home-subtitle">Décrivez votre maison idéale et voyez-la en 3D</p>
            </div>

            {/* STATUS */}
            <div className="home-status">
              <div className={`status-badge ${backendStatus.backend ? 'online' : 'offline'}`}>
                <span className="status-dot"></span>
                Backend: {backendStatus.backend ? 'En ligne' : 'Hors ligne'}
              </div>
              <div className={`status-badge ${backendStatus.ollama ? 'online' : 'offline'}`}>
                <span className="status-dot"></span>
                Ollama: {backendStatus.ollama ? 'En ligne' : 'Hors ligne'}
              </div>
            </div>

            {/* MAIN INPUT FORM */}
            <div className="home-form">
              <div className="form-group">
                <label htmlFor="description">📝 Décrivez votre maison:</label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ex: Je veux une maison moderne avec 2 chambres, un grand salon avec canapé et télévision, une cuisine ouverte et une salle de bain..."
                  className="input-textarea"
                  rows="6"
                />
              </div>

              {/* ERROR MESSAGE */}
              {error && <div className="error-box">{error}</div>}

              {/* GENERATE BUTTON */}
              <button
                onClick={handleGenerate}
                disabled={isLoading || !backendStatus.ollama}
                className="btn-generate"
              >
                {isLoading ? (
                  <>
                    <span className="spinner"></span> Génération en cours...
                  </>
                ) : (
                  <>✨ Générer ma maison 3D</>
                )}
              </button>

              {/* KEYBOARD HINT */}
              <p className="hint">💡 Astuce: Ctrl+Entrée pour générer</p>
            </div>

            {/* EXAMPLES */}
            <div className="examples-section">
              <h3>📖 Exemples:</h3>
              <div className="examples-grid">
                <div 
                  className="example-card"
                  onClick={() => setDescription('Un petit appartement avec un salon ouvert sur la cuisine, une chambre avec salle de bain attenante.')}
                >
                  <h4>🏢 Petit appartement</h4>
                  <p>Salon + cuisine + 1 chambre</p>
                </div>
                <div 
                  className="example-card"
                  onClick={() => setDescription('Une maison familiale avec 3 chambres à l\'étage, un grand salon, cuisine américaine, et 2 salles de bain.')}
                >
                  <h4>🏠 Maison familiale</h4>
                  <p>3 chambres + salon + cuisine</p>
                </div>
                <div 
                  className="example-card"
                  onClick={() => setDescription('Une villa moderne et spacieuse avec 4 chambres, 2 salles de bain, un grand salon avec vue, et une cuisine intégrée.')}
                >
                  <h4>🏡 Villa moderne</h4>
                  <p>4 chambres + 2 salles de bain</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // PAGE VIEWER 3D
        <div className="viewer-page">
          {/* SIDEBAR */}
          <div className="sidebar">
            <div className="sidebar-header">
              <button 
                className="btn-back"
                onClick={() => setCurrentPage('home')}
              >
                ← Retour
              </button>
              <h2>📐 Maison</h2>
            </div>

            {/* ROOMS LIST */}
            <div className="sidebar-section">
              <h3>Pièces</h3>
              <div className="items-list">
                {houseData?.rooms?.map((room, idx) => (
                  <div
                    key={idx}
                    className={`item-card ${selectedRoom?.name === room.name ? 'selected' : ''}`}
                    onClick={() => setSelectedRoom(room)}
                  >
                    <div className="item-header">
                      <h4>{room.name.replace(/_/g, ' ').toUpperCase()}</h4>
                    </div>
                    <div className="item-info">
                      <span>📏 {room.width.toFixed(1)}m × {room.depth.toFixed(1)}m</span>
                      <span>🪑 {room.furniture?.length || 0} meubles</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SELECTED ROOM DETAILS */}
            {selectedRoom && (
              <div className="sidebar-section">
                <h3>Détails</h3>
                <div className="details-box">
                  <p><strong>Pièce:</strong> {selectedRoom.name.replace(/_/g, ' ')}</p>
                  <p><strong>Dimensions:</strong> {selectedRoom.width.toFixed(1)}m × {selectedRoom.depth.toFixed(1)}m</p>
                  <p><strong>Surface:</strong> {(selectedRoom.width * selectedRoom.depth).toFixed(1)}m²</p>
                  
                  {selectedRoom.furniture?.length > 0 && (
                    <div className="furniture-list">
                      <h4>Meubles:</h4>
                      {selectedRoom.furniture.map((furn, idx) => (
                        <div key={idx} className="furniture-item">
                          <span>{furn.type}</span>
                          <span className="coords">({furn.x.toFixed(1)}, {furn.z.toFixed(1)})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STATISTICS */}
            <div className="sidebar-section">
              <h3>📊 Stats</h3>
              <div className="stats-box">
                <p><strong>Pièces:</strong> {houseData?.rooms?.length || 0}</p>
                <p><strong>Meubles:</strong> {houseData?.rooms?.reduce((acc, r) => acc + (r.furniture?.length || 0), 0) || 0}</p>
                <p><strong>Étages:</strong> {houseData?.floors || 1}</p>
              </div>
            </div>
          </div>

          {/* 3D SCENE */}
          <div className="viewer-container">
            <HouseScene 
              houseData={houseData} 
              isLoading={isLoading}
              selectedRoom={selectedRoom}
            />
            
            {/* NAVIGATION HINT */}
            <div className="navigation-hint">
              <p>🖱️ <strong>Click droit</strong> + mouvement = Rotation</p>
              <p>🔍 <strong>Scroll</strong> = Zoom</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
