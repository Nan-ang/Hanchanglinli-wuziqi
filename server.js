// 使用 import 语法来代替 require
import express from 'express';
import http from 'http';
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // 允许所有来源的连接，方便开发
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

let players = {}; // 存储玩家信息
let waitingPlayer = null; // 等待匹配的玩家

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  players[socket.id] = { id: socket.id };

  // 匹配逻辑
  if (waitingPlayer) {
    const player1 = players[waitingPlayer];
    const player2 = players[socket.id];
    
    player1.opponent = socket.id;
    player2.opponent = waitingPlayer;

    // 随机分配黑白棋
    const isPlayer1Black = Math.random() < 0.5;
    player1.color = isPlayer1Black ? 1 : 2; // 1: black, 2: white
    player2.color = isPlayer1Black ? 2 : 1;

    io.to(player1.id).emit('gameStart', { color: player1.color, opponentId: player2.id });
    io.to(player2.id).emit('gameStart', { color: player2.color, opponentId: player1.id });

    waitingPlayer = null;
  } else {
    waitingPlayer = socket.id;
    socket.emit('waitingForPlayer');
  }
  
  // 监听玩家落子
  socket.on('makeMove', (move) => {
    const opponentId = players[socket.id]?.opponent;
    if (opponentId) {
      io.to(opponentId).emit('opponentMove', move);
    }
  });
  
  // 监听重新开始请求
  socket.on('restartRequest', () => {
    const opponentId = players[socket.id]?.opponent;
    if (opponentId) {
      io.to(opponentId).emit('restartApproval');
    }
  });

  // 监听断开连接
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const opponentId = players[socket.id]?.opponent;
    if (opponentId) {
      io.to(opponentId).emit('opponentDisconnected');
    }
    if (waitingPlayer === socket.id) {
      waitingPlayer = null;
    }
    delete players[socket.id];
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});