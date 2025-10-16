// frontend/src/App.jsx

import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

// CONFIGURATION DU SOCKET AVEC RECONNEXION AUTOMATIQUE
const SOCKET_URL = "https://chibouk-repond-server.onrender.com/"; 
const socket = io(SOCKET_URL, {
  reconnection: true,         // Active la reconnexion
  reconnectionAttempts: 15,   // Essaie de se reconnecter 15 fois (pendant 30s)
  reconnectionDelay: 2000,    // Attend 2 secondes entre chaque tentative
});

// --- COMPOSANTS ---

// NOUVEAU COMPOSANT POUR LE STATUT DE CONNEXION
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
          {/* Le bouton est désactivé tant que la connexion n'est pas établie */}
          <button type="submit" disabled={!isConnected}>Créer</button>
        </form>
      </div>
      <hr />
      <div>
        <h2>Rejoindre une Room</h2>
        <form onSubmit={handleJoinRoom}>
          <input type="text" placeholder="Ton pseudo" onChange={(e) => setPseudo(e.target.value)} required />
          <input type="text" placeholder="Code de la room" onChange={(e) => setRoomCode(e.target.value.toUpperCase())} required />
          {/* Le bouton est désactivé tant que la connexion n'est pas établie */}
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
      <h1>Lobby de la room : <strong>{roomCode}</strong></h1>
      <h2>Joueurs connectés :</h2>
      <ul>
        {players.map((player) => (
          <li key={player.id}>{player.pseudo} {player.id === socket.id ? '👑 (Hôte, Toi)' : ''}</li>
        ))}
      </ul>
      {isHost && (
        <div>
          <hr/>
          <h3>Prêt à commencer ?</h3>
          <p>Colle tes questions ici (une par ligne) :</p>
          <textarea
            rows="10"
            cols="50"
            placeholder="Qui est le plus drôle ?&#10;Qui est le plus susceptible de se perdre en ville ?&#10;..."
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

function RankingList({ players, onVoteSubmit }) {
  const [rankedPlayers, setRankedPlayers] = useState(players);

  const handleOnDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(rankedPlayers);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setRankedPlayers(items);
  };

  const handleSubmit = () => {
    const rankingIds = rankedPlayers.map(p => p.id);
    onVoteSubmit(rankingIds);
  };

  return (
    <div>
      <DragDropContext onDragEnd={handleOnDragEnd}>
        <Droppable droppableId="players">
          {(provided) => (
            <ul {...provided.droppableProps} ref={provided.innerRef} style={{ listStyle: 'none', padding: 0 }}>
              {rankedPlayers.map((player, index) => (
                <Draggable key={player.id} draggableId={player.id} index={index}>
                  {(provided) => (
                    <li
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      style={{ padding: '10px', margin: '0 0 8px 0', backgroundColor: '#f0f0f0', color: 'black', ...provided.draggableProps.style }}
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
      <button onClick={handleSubmit}>Valider mon vote</button>
    </div>
  );
}

function GameScreen({ roomCode, players, questions }) {
  const [questionIndex, setQuestionIndex] = useState(0);

  const handleVoteSubmit = (ranking) => {
    socket.emit('submit_vote', { roomCode, questionIndex, ranking });
    setQuestionIndex(prevIndex => prevIndex + 1);
  };

  if (questionIndex >= questions.length) {
    return null;
  }

  const currentQuestion = questions[questionIndex];

  return (
    <div>
      <h1>Question {questionIndex + 1}/{questions.length}</h1>
      <h2>{currentQuestion}</h2>
      <RankingList key={questionIndex} players={players} onVoteSubmit={handleVoteSubmit} />
    </div>
  );
}

function WaitingScreen({ statuses, totalQuestions }) {
  return (
    <div>
      <h1>En attente des autres joueurs...</h1>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {statuses.map(player => (
          <li key={player.id} style={{ margin: '10px 0', padding: '10px', backgroundColor: '#333' }}>
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

function RevealScreen({ roomCode, questions, players }) {
  const [revealedResults, setRevealedResults] = useState(null);
  const [revealedQuestionIndex, setRevealedQuestionIndex] = useState(-1);
  const isHost = players.length > 0 && players[0].id === socket.id;

  useEffect(() => {
    const handleResults = ({ questionIndex, results }) => {
      setRevealedQuestionIndex(questionIndex);
      setRevealedResults(results);
    };
    socket.on('show_question_results', handleResults);
    return () => socket.off('show_question_results', handleResults);
  }, []);

  const handleRevealClick = (index) => {
    socket.emit('reveal_results_for_question', { roomCode, questionIndex: index });
  };
  
  return (
    <div>
      <h1>Révélation des Résultats</h1>
      {isHost && (
        <div style={{ marginBottom: '20px' }}>
          <p>Clique sur une question pour révéler les résultats à tout le monde :</p>
          {questions.map((q, i) => (
            <button key={i} onClick={() => handleRevealClick(i)} disabled={revealedQuestionIndex === i} style={{ margin: '5px' }}>
              Question {i + 1}: {q}
            </button>
          ))}
          <hr/>
        </div>
      )}

      {revealedResults ? (
        <div>
          <h2>Résultats pour : "{questions[revealedQuestionIndex]}"</h2>
          <ol>{revealedResults.map(p => <li key={p.id} style={{ fontSize: '1.2em' }}>{p.pseudo} - {p.score} points</li>)}</ol>
        </div>
      ) : (
        <h2>{isHost ? "À vous de jouer, choisissez une question." : "En attente que l'hôte révèle les résultats."}</h2>
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
    // Événements pour suivre la connexion
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Événements du jeu
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
    <div>
      <header>
        <ConnectionStatus isConnected={isConnected} />
      </header>
      <main>
        {gameState === 'welcome' && <WelcomeScreen {...{ handleCreateRoom, handleJoinRoom, setPseudo, setRoomCode, isConnected }} />}
        {gameState === 'lobby' && <LobbyScreen {...{ roomCode, players, handleStartGame, csvData, setCsvData }} />}
        {gameState === 'game' && (amIFinished ? <WaitingScreen statuses={playerStatuses} totalQuestions={questions.length} /> : <GameScreen {...{ roomCode, players, questions }} />)}
        {gameState === 'reveal' && <RevealScreen {...{ roomCode, questions, players }} />}
      </main>
    </div>
  );
}

export default App;