import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Create an Express app and HTTP server
const app = express();
const httpServer = createServer(app);

// Set up Socket.IO server with CORS handling
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:8080", // Frontend URL (replace with your production URL when needed)
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  },
});

const PORT = 3000;

// Serve a simple response to check if the server is running
app.get('/', (req, res) => {
  res.send('WebSocket server is running');
});

// Store player data in a Map
let players = new Map();

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Send new star data to the player
  const starData = { x: Math.random() * 800, y: Math.random() * 600, id: socket.id };
  socket.emit('newStar', starData);

  // Send existing players data to the new player
  socket.emit('existingPlayers', Array.from(players.values()));

  // Notify other players about the new player
  socket.broadcast.emit('newPlayer', starData);

  // Add the new player to the players map
  players.set(socket.id, starData);

  // Handle player movement (update star position)
  socket.on('updateStar', (data) => {
    // Update the player's position in the map
    players.set(socket.id, data);

    // Broadcast the updated position to other players
    socket.broadcast.emit('starMoved', data);
  });

  // Handle WebRTC signaling between players
  socket.on('webrtc-signal', ({ targetId, signal }) => {
    try {
      io.to(targetId).emit('webrtc-signal', { senderId: socket.id, signal });
    } catch (error) {
      console.error(`Error while sending WebRTC signal to ${targetId}: ${error.message}`);
    }
  });

  // Handle player disconnection
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);

    // Remove the player from the players map
    players.delete(socket.id);

    // Notify other players about the disconnection
    socket.broadcast.emit('playerDisconnected', { id: socket.id });
  });

  // Handle errors on the socket connection
  socket.on('error', (error) => {
    console.error(`Socket error on ${socket.id}: ${error.message}`);
  });
});

// Start the HTTP server on port 3000
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
