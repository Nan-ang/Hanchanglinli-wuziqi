import express from 'express';
import http from 'http';
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;

let rooms = {}; // 用 rooms 对象代替之前的 players 和 waitingPlayer

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // 创建房间
  socket.on('createRoom', () => {
    let roomId;
    do {
      roomId = Math.random().toString(36).substring(2, 6).toUpperCase(); // 生成一个4位随机码
    } while (rooms[roomId]); // 确保房间号不重复

    socket.join(roomId);
    rooms[roomId] = { players: [{ id: socket.id }] };
    socket.emit('roomCreated', roomId);
  });

  // 加入房间
  socket.on('joinRoom', (roomId) => {
    if (!rooms[roomId]) {
      return socket.emit('errorMsg', '房间不存在！');
    }
    if (rooms[roomId].players.length >= 2) {
      return socket.emit('errorMsg', '房间已满！');
    }

    socket.join(roomId);
    rooms[roomId].players.push({ id: socket.id });

    // 两个玩家都已就绪，开始游戏
    const player1 = rooms[roomId].players[0];
    const player2 = rooms[roomId].players[1];

    // 随机分配颜色
    const isPlayer1Black = Math.random() < 0.5;
    player1.color = isPlayer1Black ? 1 : 2;
    player2.color = isPlayer1Black ? 2 : 1;

    io.to(player1.id).emit('gameStart', { color: player1.color });
    io.to(player2.id).emit('gameStart', { color: player2.color });
  });

  // 转发棋步 (只发给房间里的另一个人)
  socket.on('makeMove', (move) => {
    const roomId = Array.from(socket.rooms)[1]; // 获取玩家所在的房间号
    socket.to(roomId).emit('opponentMove', move);
  });

  // 转发重开请求
  socket.on('restartRequest', () => {
    const roomId = Array.from(socket.rooms)[1];
    socket.to(roomId).emit('restartApproval');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // 找到玩家所在的房间并通知对手
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        socket.to(roomId).emit('opponentDisconnected');
        // 清理房间
        delete rooms[roomId];
        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});