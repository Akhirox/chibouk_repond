// backend/server.js

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // --- MODIFICATION ICI ---
  cors: {
    // On autorise maintenant une liste de domaines
    origin: [
      "https://chbk.fun", 
      "https://www.chbk.fun", 
      "https://akhirox.github.io"
    ],
    methods: ["GET", "POST"]
  }
  // --- FIN DE LA MODIFICATION ---
});

const PORT = 3001;
const rooms = {};

// --- FONCTION UTILITAIRE POUR ENVOYER LES STATUTS ---
const updateAndEmitStatuses = (roomCode) => {
  const room = rooms[roomCode];
  if (!room || !room.questions) return;

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

  // Le joueur soumet son vote ET son commentaire
  socket.on('submit_vote', ({ roomCode, questionIndex, ranking, comment }) => {
    const room = rooms[roomCode];
    if (!room || !room.answers || !room.answers[questionIndex]) return;

    // On stocke le classement ET le commentaire dans un objet
    room.answers[questionIndex][socket.id] = { ranking, comment };

    // Mettre à jour la progression du joueur (inchangé)
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.progress = questionIndex + 1;
    }
    
    // Envoyer le nouveau statut (inchangé)
    updateAndEmitStatuses(roomCode);
  });
  
  // L'hôte demande les résultats pour une question
  socket.on('reveal_results_for_question', ({ roomCode, questionIndex }) => {
    const room = rooms[roomCode];
    if (!room || room.players[0].id !== socket.id || !room.answers[questionIndex]) return;

    const playersInRoom = room.players;
    const votesForThisQuestion = room.answers[questionIndex];

    const scores = {};
    playersInRoom.forEach(p => scores[p.id] = 0);
    const comments = []; // On prépare un tableau pour collecter les commentaires

    for (const voterId in votesForThisQuestion) {
      // On déstructure l'objet pour récupérer le ranking et le commentaire
      const { ranking, comment } = votesForThisQuestion[voterId];
      
      // Si un commentaire existe et n'est pas vide, on l'ajoute à la liste
      if (comment && comment.trim() !== '') {
        comments.push(comment);
      }
      
      // La logique de calcul des scores reste la même, mais utilise "ranking"
      const maxPoints = ranking.length;
      ranking.forEach((rankedPlayerId, index) => {
        if (scores.hasOwnProperty(rankedPlayerId)) {
          scores[rankedPlayerId] += maxPoints - index;
        }
      });
    }

    const results = playersInRoom
      .map(p => ({ id: p.id, pseudo: p.pseudo, score: scores[p.id] || 0 }))
      .sort((a, b) => b.score - a.score);
    
    // On envoie les résultats ET la liste des commentaires anonymes
    io.to(roomCode).emit('show_question_results', { questionIndex, results, comments });
  });

  socket.on('disconnect', () => {
    console.log(`L'utilisateur ${socket.id} s'est déconnecté`);
    // Logique de déconnexion à améliorer plus tard
  });
});

server.listen(PORT, () => {
  console.log(`Le serveur écoute sur le port ${PORT}`);
});