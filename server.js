import { createServer } from 'http';
import { Server } from 'socket.io';

const server = createServer();
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const players = {}; // Store player data

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  const startX = Math.floor(Math.random() * 500);
  const startY = Math.floor(Math.random() * 500);

  players[socket.id] = { x: startX, y: startY };

  socket.emit('newStar', { x: startX, y: startY, id: socket.id });
  socket.emit('currentPlayers', players);

  socket.broadcast.emit('newPlayer', { id: socket.id, x: startX, y: startY });

  socket.on('updateStar', (data) => {
    players[socket.id] = { x: data.x, y: data.y };
    socket.broadcast.emit('starMoved', { id: socket.id, x: data.x, y: data.y });
  });

  socket.on('offer', (data) => {
    socket.to(data.to).emit('offer', { id: socket.id, offer: data.offer });
  });

  socket.on('answer', (data) => {
    socket.to(data.to).emit('answer', { id: socket.id, answer: data.answer });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.to).emit('ice-candidate', { to: data.to, candidate: data.candidate });
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
    delete players[socket.id];
    socket.broadcast.emit('playerDisconnected', { id: socket.id });
  });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`WebSocket server running on ws://0.0.0.0:${PORT}`);
});
