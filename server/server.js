const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const basicAuth = require('express-basic-auth');

// Load environment variables (.env in cwd or server directory)
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Configuration & Environment Variables
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'purivision-secret-key-change-in-production';
const CLIENT_URL = process.env.CLIENT_URL || '*';

// Parse allowed CORS origins
const allowedOrigins = CLIENT_URL === '*'
  ? ['*']
  : CLIENT_URL.split(',').map(s => s.trim().replace(/\/$/, ''));

// CORS handler for Express and Socket.IO
const corsOriginHandler = (origin, callback) => {
  // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  // Allow localhost during development
  if (process.env.NODE_ENV !== 'production' && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    return callback(null, true);
  }
  // Allow dynamic origin to prevent cloud deployment blocking issues
  return callback(null, true);
};

const app = express();
app.use(cors({
  origin: corsOriginHandler,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOriginHandler,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Authentication Helpers
function verifyAdminCredentials(username, password) {
  if (!username || !password) return false;
  const userBuf = Buffer.from(String(username));
  const expUserBuf = Buffer.from(String(ADMIN_USERNAME));
  const passBuf = Buffer.from(String(password));
  const expPassBuf = Buffer.from(String(ADMIN_PASSWORD));

  const isUserMatch = userBuf.length === expUserBuf.length && crypto.timingSafeEqual(userBuf, expUserBuf);
  const isPassMatch = passBuf.length === expPassBuf.length && crypto.timingSafeEqual(passBuf, expPassBuf);
  return isUserMatch && isPassMatch;
}

function generateAdminToken(username) {
  const payload = JSON.stringify({
    username,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours validity
  });
  const b64Payload = Buffer.from(payload).toString('base64url');
  const signature = crypto
    .createHmac('sha256', ADMIN_SECRET_KEY)
    .update(b64Payload)
    .digest('base64url');
  return `${b64Payload}.${signature}`;
}

function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [b64Payload, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', ADMIN_SECRET_KEY)
    .update(b64Payload)
    .digest('base64url');

  if (signature.length !== expectedSignature.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

// HTTP Basic Auth Middleware for Express
const basicAuthMiddleware = basicAuth({
  authorizer: (username, password) => verifyAdminCredentials(username, password),
  challenge: true,
  realm: 'PuriVision Admin'
});

// Admin Protection Middleware (supports Bearer token or HTTP Basic Auth)
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (verifyAdminToken(token)) {
      return next();
    }
    return res.status(401).json({ success: false, message: 'Invalid or expired admin token' });
  }

  if (authHeader.startsWith('Basic ')) {
    return basicAuthMiddleware(req, res, next);
  }

  return res.status(401).json({ success: false, message: 'Unsupported authorization format' });
}

// Socket Authorization Helper
function isSocketAuthorized(socket, payload) {
  if (socket.data && socket.data.isAdmin) return true;

  // Check handshake auth
  const handshakeToken = socket.handshake.auth && socket.handshake.auth.token;
  if (handshakeToken && verifyAdminToken(handshakeToken)) {
    socket.data.isAdmin = true;
    return true;
  }

  // Check payload token
  const payloadToken = payload && (payload.token || payload.adminToken);
  if (payloadToken && verifyAdminToken(payloadToken)) {
    socket.data.isAdmin = true;
    return true;
  }

  return false;
}

// REST API Endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Admin Login Route (verifies credentials from .env)
app.post('/api/admin/login', (req, res) => {
  let { username, password } = req.body || {};

  // Support Basic Auth header as fallback
  const authHeader = req.headers.authorization;
  if ((!username || !password) && authHeader && authHeader.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf8');
      const [u, p] = decoded.split(':');
      username = u;
      password = p;
    } catch (err) {}
  }

  if (verifyAdminCredentials(username, password)) {
    const token = generateAdminToken(username);
    return res.json({ success: true, token, username });
  }

  return res.status(401).json({ success: false, message: 'Invalid admin username or password' });
});

// Admin Token Verification Route
app.get('/api/admin/verify', requireAdminAuth, (req, res) => {
  res.json({ success: true, message: 'Admin authenticated' });
});

// Admin Data REST Route (Protected)
app.get('/api/admin/data', requireAdminAuth, (req, res) => {
  let actualVotesCount = 0;
  Object.values(state.votes).forEach(v => {
    if (v && v.type) actualVotesCount++;
  });
  res.json({
    judgeCodes: state.judgeCodes,
    totalVotes: actualVotesCount,
    points: state.points,
    songs: state.songs,
    isVotingOpen: state.isVotingOpen
  });
});

// Public Results REST Route
app.get('/api/results', (req, res) => {
  res.json({
    isCalculated: state.isCalculated,
    results: state.results
  });
});

// Serve static files from the React client build directory
const clientDistPath = path.join(__dirname, '../client/dist');
const indexPath = path.join(clientDistPath, 'index.html');

app.use(express.static(clientDistPath));

// Catch-all route to serve React's index.html for any unrecognized routes (React Router)
const serveIndexHtml = (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'API endpoint not found' });
  }
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send('PuriVision Server is running, but client/dist/index.html was not found. Please build the client using "npm run build".');
  }
};

try {
  // Express 5 wildcard syntax
  app.get('{*path}', serveIndexHtml);
} catch (e) {
  // Fallback for Express 4
  app.get('*', serveIndexHtml);
}

// Voting Logic & State Management
const dataPath = path.join(__dirname, 'data.json');
const VALID_CLASSES = ['ט1', 'ט2', 'י1', 'י2', 'יא1', 'יא2', 'יב', 'רמים', 'הנהלה'];

let state = {
  isVotingOpen: false,
  songs: [],
  points: [],
  judgeCodes: [],
  votes: {},
  results: null,
  isCalculated: false
};

// Load state on startup
if (fs.existsSync(dataPath)) {
  try {
    const rawData = fs.readFileSync(dataPath);
    const parsed = JSON.parse(rawData);
    delete parsed.classes;
    state = { ...state, ...parsed };
    if (state.isVotingOpen === undefined) state.isVotingOpen = false;
    console.log('State loaded from data.json');
  } catch (err) {
    console.error('Error reading data.json', err);
  }
}

// Save state to disk
function saveState() {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('Error saving data.json', err);
  }
}

function calculateResults() {
  const { songs, points, votes } = state;
  let scores = {};

  songs.forEach(s => {
    scores[s.id] = { total: 0, frequencies: {}, groups: new Set() };
    points.forEach(p => (scores[s.id].frequencies[p] = 0));
  });

  // Process judges
  Object.values(votes).forEach(vote => {
    if (vote && vote.type === 'judge') {
      const order = vote.order;
      order.forEach((songId, index) => {
        if (index < points.length && scores[songId]) {
          const p = points[index];
          if (p > 0) {
            scores[songId].total += p;
            scores[songId].frequencies[p] = (scores[songId].frequencies[p] || 0) + 1;
            scores[songId].groups.add(vote.groupId);
          }
        }
      });
    }
  });

  // Process classes
  VALID_CLASSES.forEach(className => {
    let classVotes = {};
    songs.forEach(s => (classVotes[s.id] = 0));

    let votersInClass = 0;
    Object.values(votes).forEach(vote => {
      if (vote && vote.type === 'audience' && vote.groupId === className) {
        if (classVotes[vote.songId] !== undefined) {
          classVotes[vote.songId]++;
          votersInClass++;
        }
      }
    });

    if (votersInClass > 0) {
      let groupedByVotes = {};
      Object.entries(classVotes).forEach(([songId, count]) => {
        if (count > 0) {
          if (!groupedByVotes[count]) groupedByVotes[count] = [];
          groupedByVotes[count].push(songId);
        }
      });

      let counts = Object.keys(groupedByVotes).map(Number).sort((a, b) => b - a);

      let rankIndex = 0;
      counts.forEach(count => {
        const tiedSongs = groupedByVotes[count];
        if (rankIndex < points.length) {
          const p = points[rankIndex];
          tiedSongs.forEach(songId => {
            if (scores[songId]) {
              if (p > 0) {
                scores[songId].total += p;
                scores[songId].frequencies[p] = (scores[songId].frequencies[p] || 0) + 1;
                scores[songId].groups.add(className);
              }
            }
          });
        }
        rankIndex += tiedSongs.length;
      });
    }
  });

  let finalResults = songs.map(s => {
    return {
      id: s.id,
      name: s.name,
      artist: s.artist,
      score: scores[s.id].total,
      groupsCount: scores[s.id].groups.size,
      frequencies: scores[s.id].frequencies
    };
  });

  finalResults.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.groupsCount !== b.groupsCount) return b.groupsCount - a.groupsCount;
    const sortedPoints = [...points].sort((x, y) => y - x);
    for (let p of sortedPoints) {
      const freqA = a.frequencies[p] || 0;
      const freqB = b.frequencies[p] || 0;
      if (freqA !== freqB) return freqB - freqA;
    }
    return 0;
  });

  return finalResults;
}

// Socket.IO Handling
io.on('connection', (socket) => {
  // Public State updates for clients & results screen
  socket.emit('stateUpdate', {
    songs: state.songs,
    points: state.points,
    results: state.results,
    isCalculated: state.isCalculated,
    isVotingOpen: state.isVotingOpen
  });

  socket.emit('config_update', {
    isVotingOpen: state.isVotingOpen,
    songs: state.songs,
    pointsArray: state.points,
    judgeCodes: state.judgeCodes
  });

  // Public Voter initial state request
  socket.on('request_initial_state', (userId) => {
    socket.emit('initial_state', {
      isVotingOpen: state.isVotingOpen,
      songs: state.songs,
      pointsArray: state.points,
      judgeCodes: state.judgeCodes,
      hasVoted: !!state.votes[userId]
    });
  });

  // Public Voter submit vote
  socket.on('submit_vote', (voteData) => {
    if (state.isCalculated) {
      return socket.emit('vote_error', 'ההצבעה הסתיימה');
    }
    if (!state.isVotingOpen) {
      return socket.emit('vote_error', 'ההצבעה סגורה');
    }
    if (state.songs.length === 0) {
      return socket.emit('vote_error', 'אין שירים מוגדרים');
    }

    const { uuid, type, groupId, songId, order } = voteData;

    if (type === 'judge') {
      const cleanCode = groupId.trim().toUpperCase();

      if (!state.judgeCodes.includes(cleanCode)) {
        return socket.emit('vote_error', 'קוד שופט אינו תקין');
      }

      if (state.votes[cleanCode] || state.votes[uuid]) {
        return socket.emit('vote_error', 'מכשיר זה או שופט זה כבר הצביעו');
      }

      if (!order || order.length !== state.songs.length) {
        return socket.emit('vote_error', 'רשימת השירים חסרה או פגומה');
      }

      state.votes[uuid] = { type, groupId: cleanCode, order };
      state.votes[cleanCode] = true;
    } else if (type === 'audience') {
      if (!VALID_CLASSES.includes(groupId)) {
        return socket.emit('vote_error', 'כיתה לא חוקית');
      }
      if (state.votes[uuid]) {
        return socket.emit('vote_error', 'מכשיר זה כבר הצביע');
      }
      state.votes[uuid] = { type, groupId, songId };
    } else {
      return socket.emit('vote_error', 'סוג הצבעה לא חוקי');
    }

    saveState();
    socket.emit('vote_success');

    let actualVotesCount = 0;
    Object.values(state.votes).forEach(v => {
      if (v && v.type) actualVotesCount++;
    });

    io.emit('statsUpdate', {
      totalVotes: actualVotesCount
    });
  });

  // Admin Authentication via Socket
  socket.on('admin_authenticate', (data, callback) => {
    const token = data && (data.token || data.adminToken);
    if (token && verifyAdminToken(token)) {
      socket.data.isAdmin = true;
      if (typeof callback === 'function') callback({ success: true });
    } else {
      if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized: Invalid token' });
    }
  });

  // Protected Admin: Get dashboard data
  socket.on('getAdminData', (data, callback) => {
    if (!isSocketAuthorized(socket, data)) {
      if (typeof callback === 'function') callback({ error: 'Unauthorized: Admin access required' });
      return;
    }

    let actualVotesCount = 0;
    Object.values(state.votes).forEach(v => {
      if (v && v.type) actualVotesCount++;
    });

    if (typeof callback === 'function') {
      callback({
        judgeCodes: state.judgeCodes,
        totalVotes: actualVotesCount,
        points: state.points,
        songs: state.songs,
        isVotingOpen: state.isVotingOpen
      });
    }
  });

  // Protected Admin: Update songs, points, judge codes
  socket.on('admin_update_config', (data, callback) => {
    if (!isSocketAuthorized(socket, data)) {
      if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized: Admin access required' });
      return;
    }

    state.songs = data.songs;
    state.points = data.points;
    if (data.judgeCodes) state.judgeCodes = data.judgeCodes;
    saveState();

    io.emit('stateUpdate', { songs: state.songs, points: state.points });
    io.emit('config_update', {
      isVotingOpen: state.isVotingOpen,
      songs: state.songs,
      pointsArray: state.points,
      judgeCodes: state.judgeCodes
    });

    if (typeof callback === 'function') callback({ success: true });
  });

  // Protected Admin: Toggle voting open/closed
  socket.on('admin_toggle_voting', (data, callback) => {
    if (!isSocketAuthorized(socket, data)) {
      if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized: Admin access required' });
      return;
    }

    state.isVotingOpen = !state.isVotingOpen;
    saveState();

    io.emit('stateUpdate', { isVotingOpen: state.isVotingOpen });
    io.emit('config_update', {
      isVotingOpen: state.isVotingOpen,
      songs: state.songs,
      pointsArray: state.points,
      judgeCodes: state.judgeCodes
    });

    if (typeof callback === 'function') callback({ success: true, isVotingOpen: state.isVotingOpen });
  });

  // Protected Admin: Perform critical actions (generate codes, calculate results, reset)
  socket.on('adminAction', (action, callback) => {
    if (!isSocketAuthorized(socket, action)) {
      if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized: Admin access required' });
      return;
    }

    if (action.type === 'generateJudgeCodes') {
      const codes = Array.from({ length: 10 }, () => Math.random().toString(36).substring(2, 8).toUpperCase());
      state.judgeCodes = codes;
      saveState();
      if (typeof callback === 'function') callback({ success: true, codes });
    } else if (action.type === 'calculateResults') {
      state.results = calculateResults();
      state.isCalculated = true;
      state.isVotingOpen = false;
      saveState();

      io.emit('stateUpdate', { results: state.results, isCalculated: true, isVotingOpen: false });
      io.emit('config_update', {
        isVotingOpen: false,
        songs: state.songs,
        pointsArray: state.points,
        judgeCodes: state.judgeCodes
      });

      if (typeof callback === 'function') callback({ success: true });
    } else if (action.type === 'reset') {
      state.votes = {};
      state.results = null;
      state.isCalculated = false;
      state.isVotingOpen = false;

      const codes = Array.from({ length: 10 }, () => Math.random().toString(36).substring(2, 8).toUpperCase());
      state.judgeCodes = codes;

      saveState();
      io.emit('stateUpdate', { results: null, isCalculated: false, isVotingOpen: false });
      io.emit('config_update', {
        isVotingOpen: false,
        songs: state.songs,
        pointsArray: state.points,
        judgeCodes: state.judgeCodes
      });

      io.emit('statsUpdate', { totalVotes: 0 });
      io.emit('votes_reset');

      if (typeof callback === 'function') callback({ success: true });
    }
  });
});

// Bind to HOST (0.0.0.0) and listen to PORT environment variable
server.listen(PORT, HOST, () => {
  console.log(`========================================`);
  console.log(`🎉 PuriVision Server running at http://${HOST}:${PORT}`);
  console.log(`🔒 Admin Username configured: ${ADMIN_USERNAME}`);
  if (ADMIN_PASSWORD === 'admin123') {
    console.warn(`⚠️  WARNING: Using default password 'admin123'. Set ADMIN_PASSWORD in .env for production!`);
  }
  console.log(`🌐 CORS Allowed Origins: ${allowedOrigins.join(', ')}`);
  console.log(`========================================`);
});
