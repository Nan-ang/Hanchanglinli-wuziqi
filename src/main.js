import './style.css';
import { io } from "socket.io-client";

// --- DOM 元素 ---
const canvas = document.getElementById('chessboard');
const ctx = canvas.getContext('2d');
const statusText = document.getElementById('status-text');
const restartButton = document.getElementById('restart-button');

// --- 游戏常量 ---
const BOARD_SIZE = 15;
const GRID_SIZE = canvas.width / (BOARD_SIZE + 1);
const PIECE_RADIUS = GRID_SIZE / 2 * 0.85;

// --- 游戏状态变量 ---
let boardState = [];
let currentPlayer = 1;
let gameOver = true; // 游戏开始时是结束状态，等待连接
let myColor = null; // 我是黑棋还是白棋

// --- 连接后端服务器 ---
// !!! 重要：部署后需要改成你服务器的URL
const socket = io("http://localhost:3000");

// --- Socket.IO 事件监听 ---
socket.on('connect', () => {
  console.log('Connected to server with ID:', socket.id);
  statusText.textContent = "连接成功，正在匹配对手...";
});

socket.on('waitingForPlayer', () => {
  statusText.textContent = "等待另一位玩家加入...";
});

socket.on('gameStart', ({ color, opponentId }) => {
  myColor = color;
  gameOver = false;
  restartGame(); // 重置棋盘
  statusText.textContent = `游戏开始！你是 ${myColor === 1 ? '黑棋' : '白棋'}。`;
  if (myColor !== currentPlayer) {
    statusText.textContent += " 等待对手落子...";
  }
});

socket.on('opponentMove', (move) => {
  if (gameOver) return;
  const { x, y, player } = move;
  boardState[y][x] = player;
  drawPiece(x, y, player);

  if (checkWin(x, y)) {
    gameOver = true;
    statusText.textContent = `你输了！`;
    return;
  }

  currentPlayer = myColor; // 现在轮到我了
  statusText.textContent = '轮到你了';
});

socket.on('restartApproval', () => {
  restartGame();
  statusText.textContent = `对手同意重新开始。你是 ${myColor === 1 ? '黑棋' : '白棋'}。`;
  if (myColor !== currentPlayer) {
     statusText.textContent += " 等待对手落子...";
  }
  gameOver = false;
});

socket.on('opponentDisconnected', () => {
  gameOver = true;
  statusText.textContent = '对手已断开连接！';
});

// --- 函数 ---
function initAndDrawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#5a442a';
  ctx.lineWidth = 1;
  for (let i = 0; i < BOARD_SIZE; i++) {
    const pos = GRID_SIZE * (i + 1);
    ctx.beginPath(); ctx.moveTo(pos, GRID_SIZE); ctx.lineTo(pos, canvas.height - GRID_SIZE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(GRID_SIZE, pos); ctx.lineTo(canvas.width - GRID_SIZE, pos); ctx.stroke();
  }
}

function drawPiece(x, y, player) {
  const canvasX = GRID_SIZE * (x + 1);
  const canvasY = GRID_SIZE * (y + 1);
  ctx.beginPath();
  ctx.arc(canvasX, canvasY, PIECE_RADIUS, 0, 2 * Math.PI);
  ctx.fillStyle = player === 1 ? '#000' : '#fff';
  ctx.fill();
}

function restartGame() {
  boardState = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0));
  currentPlayer = 1;
  gameOver = false; // 在联机模式下，由服务器决定何时可以开始
  initAndDrawBoard();
}

function checkWin(x, y) {
  const player = boardState[y][x];
  if (player === 0) return false;
  const directions = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }];
  for (const dir of directions) {
    let count = 1;
    for (let i = 1; i < 5; i++) { const newX = x + i * dir.x, newY = y + i * dir.y; if (newX >= 0 && newX < BOARD_SIZE && newY >= 0 && newY < BOARD_SIZE && boardState[newY][newX] === player) { count++; } else { break; } }
    for (let i = 1; i < 5; i++) { const newX = x - i * dir.x, newY = y - i * dir.y; if (newX >= 0 && newX < BOARD_SIZE && newY >= 0 && newY < BOARD_SIZE && boardState[newY][newX] === player) { count++; } else { break; } }
    if (count >= 5) return true;
  }
  return false;
}

// --- 事件监听 ---
canvas.addEventListener('click', (event) => {
  // 游戏结束、不是我的回合、我还没被分配颜色时，不能落子
  if (gameOver || currentPlayer !== myColor) return;

  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;
  const gridX = Math.round(mouseX / GRID_SIZE) - 1;
  const gridY = Math.round(mouseY / GRID_SIZE) - 1;

  if (gridX >= 0 && gridX < BOARD_SIZE && gridY >= 0 && gridY < BOARD_SIZE && boardState[gridY][gridX] === 0) {
    boardState[gridY][gridX] = currentPlayer;
    drawPiece(gridX, gridY, currentPlayer);

    const move = { x: gridX, y: gridY, player: currentPlayer };
    socket.emit('makeMove', move); // 把我的棋步发给服务器

    if (checkWin(gridX, gridY)) {
      gameOver = true;
      statusText.textContent = '你胜利了！';
      return;
    }

    currentPlayer = currentPlayer === 1 ? 2 : 1; // 切换回合
    statusText.textContent = '等待对手落子...';
  }
});

restartButton.addEventListener('click', () => {
  socket.emit('restartRequest');
  restartGame();
  statusText.textContent = `已发送重开请求。你是 ${myColor === 1 ? '黑棋' : '白棋'}。`;
  if (myColor !== currentPlayer) {
     statusText.textContent += " 等待对手落子...";
  }
   gameOver = false;
});

// --- 游戏启动 ---
initAndDrawBoard();