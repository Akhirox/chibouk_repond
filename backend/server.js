// backend/server.js

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = 3001;
const rooms = {};

// --- FONCTION UTILITAIRE POUR ENVOYER LES STATUTS ---
const updateAndEmitStatuses = (roomCode) => {
  const room = rooms[roomCode];
  if (!room) return;

  const playerStatuses = room.players.map(p => ({
    id: p.id,
    pseudo: p.pseudo,
    progress: p.progress, // Le nombre de questions répondues
    isFinished: p.progress === room.questions.length
  }));

  io.to(roomCode).emit('update_statuses', playerStatuses);

  // Vérifier si tout le monde a terminé
  const allFinished = playerStatuses.every(p => p.isFinished);
  if (allFinished) {
    io.to(roomCode).emit('all_players_finished');
    room.gameState = 'revealing'; // Le jeu passe en mode "révélation"
  }
};

io.on('connection', (socket) => {
  console.log(`Un utilisateur est connecté : ${socket.id}`);

  socket.on('create_room', ({ pseudo }) => {
    const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    socket.join(roomCode);
    rooms[roomCode] = {
      players: [{ id: socket.id, pseudo: pseudo, progress: 0 }], // On ajoute la progression
      gameState: 'lobby'
    };
    io.to(roomCode).emit('update_players', rooms[roomCode].players);
    socket.emit('room_created', roomCode);
  });

  socket.on('join_room', ({ roomCode, pseudo }) => {
    if (rooms[roomCode] && rooms[roomCode].gameState === 'lobby') {
      socket.join(roomCode);
      rooms[roomCode].players.push({ id: socket.id, pseudo: pseudo, progress: 0 }); // On ajoute la progression
      io.to(roomCode).emit('update_players', rooms[roomCode].players);
    } else {
      socket.emit('error', 'Room non trouvée ou partie déjà commencée.');
    }
  });

  socket.on('start_game', ({ roomCode, csvData }) => {
    const room = rooms[roomCode];
    if (room && room.players[0].id === socket.id) {
      const questions = csvData.split('\n').filter(q => q.trim() !== '');
      if (questions.length === 0) {
        return socket.emit('error', 'CSV vide ou mal formaté.');
      }
      room.questions = questions;
      room.gameState = 'in_game';
      room.answers = Array(questions.length).fill(null).map(() => ({})); // Prépare le stockage des réponses
      io.to(roomCode).emit('game_started', { players: room.players, questions: room.questions });
    }
  });

  // MODIFIÉ : Le joueur soumet son vote pour une question spécifique
  socket.on('submit_vote', ({ roomCode, questionIndex, ranking }) => {
    const room = rooms[roomCode];
    if (!room || !room.answers[questionIndex]) return;

    room.answers[questionIndex][socket.id] = ranking;

    // Mettre à jour la progression du joueur
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.progress = questionIndex + 1;
    }
    
    // Envoyer le nouveau statut de tout le monde à tout le monde
    updateAndEmitStatuses(roomCode);
  });
  
  // NOUVEAU : L'hôte demande les résultats pour une question
  socket.on('reveal_results_for_question', ({ roomCode, questionIndex }) => {
    const room = rooms[roomCode];
    if (!room || room.players[0].id !== socket.id || !room.answers[questionIndex]) return;

    const playersInRoom = room.players;
    const votesForThisQuestion = room.answers[questionIndex];

    const scores = {};
    playersInRoom.forEach(p => scores[p.id] = 0);

    for (const voterId in votesForThisQuestion) {
      const currentRanking = votesForThisQuestion[voterId];
      const maxPoints = currentRanking.length;
      currentRanking.forEach((rankedPlayerId, index) => {
        scores[rankedPlayerId] += maxPoints - index;
      });
    }

    const results = playersInRoom
      .map(p => ({ id: p.id, pseudo: p.pseudo, score: scores[p.id] || 0 }))
      .sort((a, b) => b.score - a.score);
    
    io.to(roomCode).emit('show_question_results', { questionIndex, results });
  });

  socket.on('disconnect', () => {
    console.log(`L'utilisateur ${socket.id} s'est déconnecté`);
    // Logique de déconnexion à améliorer plus tard
  });
});

server.listen(PORT, () => {
  console.log(`Le serveur écoute sur le port ${PORT}`);
});