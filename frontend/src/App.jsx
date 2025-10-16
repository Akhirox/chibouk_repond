// frontend/src/App.jsx

import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const SOCKET_URL = "https://chibouk-repond-server.onrender.com/";
const socket = io(SOCKET_URL, {
  reconnection: true,
  reconnectionAttempts: 15,
  reconnectionDelay: 2000,
});

// --- COMPOSANT DE STYLE (NOUVEAU) ---
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
      
      :root {
        --background: #121212;
        --surface: #1E1E1E;
        --primary: #BB86FC;
        --primary-variant: #3700B3;
        --secondary: #03DAC6;
        --on-background: #FFFFFF;
        --on-surface: #E0E0E0;
        --border-radius: 8px;
        --error: #CF6679;
      }

      body {
        margin: 0;
        font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
        background-color: var(--background);
        color: var(--on-background);
        display: flex;
        justify-content: center;
        align-items: flex-start;
        min-height: 100vh;
        padding: 20px;
        box-sizing: border-box;
      }

      #root {
        width: 100%;
        max-width: 500px;
        background: var(--surface);
        padding: 2rem;
        border-radius: var(--border-radius);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      }

      h1, h2, h3 { color: var(--on-background); font-weight: 600; }
      h1 { text-align: center; color: var(--primary); font-size: 2.5rem; margin-top: 0; }
      h2 { border-bottom: 2px solid var(--primary); padding-bottom: 8px; }

      input, textarea, button {
        font-family: 'Poppins', sans-serif;
        width: 100%;
        padding: 12px;
        margin: 8px 0;
        border-radius: var(--border-radius);
        border: 1px solid #333;
        background: #2C2C2C;
        color: var(--on-surface);
        box-sizing: border-box;
        font-size: 1rem;
      }
      
      textarea { resize: vertical; min-height: 80px; }

      button {
        background-color: var(--primary);
        color: #000;
        font-weight: 700;
        border: none;
        cursor: pointer;
        transition: background-color 0.2s;
        text-transform: uppercase;
      }
      button:hover { background-color: var(--secondary); }
      button:disabled { background-color: #333; cursor: not-allowed; color: #666; }

      ul { list-style: none; padding: 0; }
      li { background: #2C2C2C; padding: 1rem; margin-bottom: 8px; border-radius: var(--border-radius); }

      hr { border-color: #333; }
      p { color: var(--on-surface); }
    `}</style>
  );
}

// --- COMPOSANTS DE L'APPLICATION ---

function ConnectionStatus({ isConnected }) {
  if (isConnected) {
    return <p style={{ color: 'lightgreen', textAlign: 'center' }}>✅ Connecté</p>;
  }
  return <p style={{ color: 'orange', textAlign: 'center' }}>⏳ Réveil du serveur en cours, veuillez patienter...</p>;
}

function WelcomeScreen({ handleCreateRoom, handleJoinRoom, setPseudo, setRoomCode, isConnected }) {
  return (
    <div>
      <h1>Chibouk Répond</h1>
      <div style={{ marginBottom: '20px' }}>
        <h2>Créer une Room</h2>
        <form onSubmit={handleCreateRoom}>
          <input type="text" placeholder="Ton pseudo" onChange={(e) => setPseudo(e.target.value)} required />
          <button type="submit" disabled={!isConnected}>Créer</button>
        </form>
      </div>
      <hr />
      <div>
        <h2>Rejoindre une Room</h2>
        <form onSubmit={handleJoinRoom}>
          <input type="text" placeholder="Ton pseudo" onChange={(e) => setPseudo(e.target.value)} required />
          <input type="text" placeholder="Code de la room" onChange={(e) => setRoomCode(e.target.value.toUpperCase())} required />
          <button type="submit" disabled={!isConnected}>Rejoindre</button>
        </form>
      </div>
    </div>
  );
}

function LobbyScreen({ roomCode, players, handleStartGame, csvData, setCsvData }) {
  const isHost = players.length > 0 && players[0].id === socket.id;
  return (
    <div>
      <h1>Lobby</h1>
      <h2>Room : <strong style={{ color: 'var(--secondary)' }}>{roomCode}</strong></h2>
      <h3>Joueurs connectés :</h3>
      <ul>
        {players.map((player) => (
          <li key={player.id}>{player.id === socket.id ? '👑 ' : ''}{player.pseudo} {player.id === socket.id ? '(Toi)' : ''}</li>
        ))}
      </ul>
      {isHost && (
        <div>
          <hr/>
          <h3>Prêt à commencer ?</h3>
          <p>Colle tes questions ici (une par ligne) :</p>
          <textarea
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
          ></textarea>
          <br/>
          <button onClick={handleStartGame} disabled={!csvData.trim()}>Lancer la partie</button>
        </div>
      )}
    </div>
  );
}

// MODIFIÉ : Ajout du champ commentaire
function RankingList({ players, onVoteSubmit }) {
  const [rankedPlayers, setRankedPlayers] = useState(players);
  const [comment, setComment] = useState("");

  const handleOnDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(rankedPlayers);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setRankedPlayers(items);
  };

  const handleSubmit = () => {
    const rankingIds = rankedPlayers.map(p => p.id);
    onVoteSubmit(rankingIds, comment);
  };

  return (
    <div>
      <DragDropContext onDragEnd={handleOnDragEnd}>
        <Droppable droppableId="players">
          {(provided) => (
            <ul {...provided.droppableProps} ref={provided.innerRef}>
              {rankedPlayers.map((player, index) => (
                <Draggable key={player.id} draggableId={player.id} index={index}>
                  {(provided) => (
                    <li
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      style={{ ...provided.draggableProps.style }}
                    >
                      {player.pseudo}
                    </li>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </ul>
          )}
        </Droppable>
      </DragDropContext>
      <textarea
        placeholder="Ajouter un commentaire (optionnel)..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <button onClick={handleSubmit}>Valider mon vote</button>
    </div>
  );
}

function GameScreen({ roomCode, players, questions }) {
  const [questionIndex, setQuestionIndex] = useState(0);

  // MODIFIÉ : onVoteSubmit envoie maintenant le commentaire
  const handleVoteSubmit = (ranking, comment) => {
    socket.emit('submit_vote', { roomCode, questionIndex, ranking, comment });
    setQuestionIndex(prevIndex => prevIndex + 1);
  };

  if (questionIndex >= questions.length) {
    return null;
  }

  const currentQuestion = questions[questionIndex];

  return (
    <div>
      <h3>Question {questionIndex + 1}/{questions.length}</h3>
      <h2>{currentQuestion}</h2>
      <RankingList key={questionIndex} players={players} onVoteSubmit={handleVoteSubmit} />
    </div>
  );
}

function WaitingScreen({ statuses, totalQuestions }) {
  return (
    <div>
      <h1>En attente...</h1>
      <p>Les autres joueurs sont en train de terminer leurs réponses.</p>
      <ul>
        {statuses.map(player => (
          <li key={player.id}>
            <strong>{player.pseudo}</strong> - 
            {player.isFinished
              ? " ✅ A terminé !"
              : ` Question ${player.progress + 1}/${totalQuestions}`
            }
          </li>
        ))}
      </ul>
    </div>
  );
}

// MODIFIÉ : Affiche maintenant les commentaires
function RevealScreen({ roomCode, questions, players }) {
  const [revealedData, setRevealedData] = useState(null);
  const [revealedQuestionIndex, setRevealedQuestionIndex] = useState(-1);
  const isHost = players.length > 0 && players[0].id === socket.id;

  useEffect(() => {
    const handleResults = ({ questionIndex, results, comments }) => {
      setRevealedQuestionIndex(questionIndex);
      setRevealedData({ results, comments });
    };
    socket.on('show_question_results', handleResults);
    return () => socket.off('show_question_results', handleResults);
  }, []);

  const handleRevealClick = (index) => {
    socket.emit('reveal_results_for_question', { roomCode, questionIndex: index });
  };
  
  return (
    <div>
      <h1>Révélation</h1>
      {isHost && (
        <div style={{ marginBottom: '20px' }}>
          <p>Cliquez sur une question pour révéler les résultats :</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {questions.map((q, i) => (
              <button key={i} onClick={() => handleRevealClick(i)} disabled={revealedQuestionIndex === i} style={{ flexGrow: 1 }}>
                {i + 1}
              </button>
            ))}
          </div>
          <hr/>
        </div>
      )}

      {revealedData ? (
        <div>
          <h2>Résultats pour : "{questions[revealedQuestionIndex]}"</h2>
          <ol>{revealedData.results.map(p => <li key={p.id}><strong>{p.pseudo}</strong> - {p.score} points</li>)}</ol>
          
          {revealedData.comments.length > 0 && (
            <div>
              <h3>Commentaires Anonymes :</h3>
              <ul>
                {revealedData.comments.map((c, i) => <li key={i}>"{c}"</li>)}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <h2>{isHost ? "À vous de jouer." : "En attente que l'hôte révèle les résultats."}</h2>
      )}
    </div>
  );
}

// --- COMPOSANT PRINCIPAL ---
function App() {
  const [gameState, setGameState] = useState('welcome');
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [roomCode, setRoomCode] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [players, setPlayers] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [csvData, setCsvData] = useState('');
  const [playerStatuses, setPlayerStatuses] = useState([]);

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room_created', code => { setRoomCode(code); setGameState('lobby'); });
    socket.on('update_players', playerList => { setPlayers(playerList); setGameState('lobby'); });
    socket.on('game_started', ({ players, questions }) => {
      setPlayers(players);
      setQuestions(questions);
      setGameState('game');
    });
    socket.on('update_statuses', statuses => setPlayerStatuses(statuses));
    socket.on('all_players_finished', () => setGameState('reveal'));
    socket.on('error', message => alert(message));
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room_created');
      socket.off('update_players');
      socket.off('game_started');
      socket.off('update_statuses');
      socket.off('all_players_finished');
      socket.off('error');
    };
  }, []);

  const handleCreateRoom = (e) => { e.preventDefault(); if (pseudo) socket.emit('create_room', { pseudo }); };
  const handleJoinRoom = (e) => { e.preventDefault(); if (pseudo && roomCode) socket.emit('join_room', { roomCode, pseudo }); };
  const handleStartGame = () => { if (csvData) socket.emit('start_game', { roomCode, csvData }); };

  const myStatus = playerStatuses.find(p => p.id === socket.id);
  const amIFinished = myStatus && myStatus.isFinished;

  return (
    <>
      <GlobalStyles />
      <header>
        <ConnectionStatus isConnected={isConnected} />
      </header>
      <main>
        {gameState === 'welcome' && <WelcomeScreen {...{ handleCreateRoom, handleJoinRoom, setPseudo, setRoomCode, isConnected }} />}
        {gameState === 'lobby' && <LobbyScreen {...{ roomCode, players, handleStartGame, csvData, setCsvData }} />}
        {gameState === 'game' && (amIFinished ? <WaitingScreen statuses={playerStatuses} totalQuestions={questions.length} /> : <GameScreen {...{ roomCode, players, questions }} />)}
        {gameState === 'reveal' && <RevealScreen {...{ roomCode, questions, players }} />}
      </main>
    </>
  );
}

export default App;