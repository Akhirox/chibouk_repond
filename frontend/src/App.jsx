// frontend/src/App.jsx

import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const SOCKET_URL = "https://potential-goldfish-qjrxgxp9prpc94qx-3001.app.github.dev/"; 
const socket = io(SOCKET_URL);

// --- COMPOSANTS SÉPARÉS ---

function WelcomeScreen({ handleCreateRoom, handleJoinRoom, setPseudo, setRoomCode }) {
  return (
    <div>
      <h1>Chibouk Répond</h1>
      <div style={{ marginBottom: '20px' }}>
        <h2>Créer une Room</h2>
        <form onSubmit={handleCreateRoom}>
          <input type="text" placeholder="Ton pseudo" onChange={(e) => setPseudo(e.target.value)} required />
          <button type="submit">Créer</button>
        </form>
      </div>
      <hr />
      <div>
        <h2>Rejoindre une Room</h2>
        <form onSubmit={handleJoinRoom}>
          <input type="text" placeholder="Ton pseudo" onChange={(e) => setPseudo(e.target.value)} required />
          <input type="text" placeholder="Code de la room" onChange={(e) => setRoomCode(e.target.value.toUpperCase())} required />
          <button type="submit">Rejoindre</button>
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
  const otherPlayers = players.filter(p => p.id !== socket.id);
  const [rankedPlayers, setRankedPlayers] = useState(otherPlayers);
  const [hasVoted, setHasVoted] = useState(false);

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
    setHasVoted(true);
  };

  if (hasVoted) {
    return <h3>Merci pour ton vote ! En attente des autres joueurs...</h3>;
  }

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
                      style={{ padding: '10px', margin: '0 0 8px 0', backgroundColor: '#f0f0f0', ...provided.draggableProps.style }}
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
  const currentQuestion = questions[0];

  const handleVoteSubmit = (ranking) => {
    socket.emit('submit_vote', { roomCode, ranking });
  };

  return (
    <div>
      <h1>Partie en cours !</h1>
      <h2>Question : {currentQuestion}</h2>
      <p>Classe les joueurs du plus... au moins... :</p>
      <RankingList players={players} onVoteSubmit={handleVoteSubmit} />
    </div>
  );
}

// NOUVEAU COMPOSANT
function ResultsScreen({ results, questions, roomCode }) {
  const isHost = results.length > 0 && results[0].id === socket.id;
  const currentQuestion = questions[0];

  const handleNextQuestion = () => {
    // Cette logique sera implémentée dans la prochaine étape
    console.log("Demande pour passer à la question suivante");
    // socket.emit('next_question', { roomCode });
  };

  return (
    <div>
      <h1>Résultats pour : "{currentQuestion}"</h1>
      <ol style={{ paddingLeft: '20px' }}>
        {results.map((player) => (
          <li key={player.id} style={{ fontSize: '1.2em', margin: '10px 0' }}>
            <strong>{player.pseudo}</strong> - {player.score} points
          </li>
        ))}
      </ol>

      {isHost && (
        <button onClick={handleNextQuestion}>Question Suivante</button>
      )}
    </div>
  );
}

// --- COMPOSANT PRINCIPAL ---

function App() {
  const [gameState, setGameState] = useState('welcome');
  const [roomCode, setRoomCode] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [players, setPlayers] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [csvData, setCsvData] = useState('');
  const [results, setResults] = useState([]); // Nouvel état pour les résultats

  useEffect(() => {
    socket.on('room_created', (code) => {
      setRoomCode(code);
      setGameState('lobby');
    });

    socket.on('update_players', (playerList) => {
      setPlayers(playerList);
      setGameState('lobby'); 
    });
    
    socket.on('game_started', ({ players, questions }) => {
      setPlayers(players);
      setQuestions(questions);
      setGameState('game');
    });

    socket.on('vote_received', () => {
      console.log("Le serveur a bien reçu notre vote.");
    });
    
    // NOUVEL ÉVÉNEMENT
    socket.on('show_results', (calculatedResults) => {
      setResults(calculatedResults);
      setGameState('results');
    });

    socket.on('error', (message) => alert(message));

    return () => {
      socket.off('room_created');
      socket.off('update_players');
      socket.off('game_started');
      socket.off('vote_received');
      socket.off('show_results');
      socket.off('error');
    };
  }, []);

  const handleCreateRoom = (e) => { e.preventDefault(); if (pseudo) socket.emit('create_room', { pseudo }); };
  const handleJoinRoom = (e) => { e.preventDefault(); if (pseudo && roomCode) socket.emit('join_room', { roomCode, pseudo }); };
  const handleStartGame = () => { if (csvData) socket.emit('start_game', { roomCode, csvData }); };

  if (gameState === 'welcome') {
    return <WelcomeScreen {...{ handleCreateRoom, handleJoinRoom, setPseudo, setRoomCode }} />;
  }
  
  if (gameState === 'lobby') {
    return <LobbyScreen {...{ roomCode, players, handleStartGame, csvData, setCsvData }} />;
  }

  if (gameState === 'game') {
    return <GameScreen {...{ roomCode, players, questions }} />;
  }
  
  // NOUVEL AFFICHAGE
  if (gameState === 'results') {
    return <ResultsScreen {...{ results, questions, roomCode }} />;
  }
}

export default App;