const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

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
    delete parsed.classes; // Ensure classes are removed from state
    state = { ...state, ...parsed };
    if(state.isVotingOpen === undefined) state.isVotingOpen = false;
    console.log("State loaded from data.json");
  } catch (err) {
    console.error("Error reading data.json", err);
  }
}

// Save state to disk
function saveState() {
  fs.writeFileSync(dataPath, JSON.stringify(state, null, 2));
}

function calculateResults() {
  const { songs, points, votes, judgeCodes } = state;
  let scores = {};

  songs.forEach(s => {
    scores[s.id] = { total: 0, frequencies: {}, groups: new Set() };
    points.forEach(p => scores[s.id].frequencies[p] = 0);
  });

  // Process judges
  Object.values(votes).forEach(vote => {
    if (vote.type === 'judge') {
      const order = vote.order;
      order.forEach((songId, index) => {
        if (index < points.length && scores[songId]) {
          const p = points[index];
          scores[songId].total += p;
          scores[songId].frequencies[p] = (scores[songId].frequencies[p] || 0) + 1;
          scores[songId].groups.add(vote.groupId);
        }
      });
    }
  });

  // Process classes
  VALID_CLASSES.forEach(className => {
    let classVotes = {}; 
    songs.forEach(s => classVotes[s.id] = 0);

    let votersInClass = 0;
    Object.values(votes).forEach(vote => {
      if (vote.type === 'audience' && vote.groupId === className) {
        if(classVotes[vote.songId] !== undefined) {
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
            if(scores[songId]) {
                scores[songId].total += p;
                scores[songId].frequencies[p] = (scores[songId].frequencies[p] || 0) + 1;
                scores[songId].groups.add(className);
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

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

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
    pointsArray: state.points
  });

  socket.on('submitVote', (voteData, callback) => {
    if (state.isCalculated) {
      return callback({ success: false, error: 'ההצבעה הסתיימה' });
    }
    if (!state.isVotingOpen) {
      return callback({ success: false, error: 'ההצבעה טרם נפתחה' });
    }
    if (state.songs.length === 0) {
      return callback({ success: false, error: 'אין שירים מוגדרים' });
    }

    const { uuid, type, groupId, songId, order } = voteData;
    
    if (type === 'judge') {
      if (!state.judgeCodes.includes(groupId)) {
        return callback({ success: false, error: 'קוד שופט לא חוקי' });
      }
      state.votes[uuid] = { type, groupId, order };
    } else if (type === 'audience') {
      if (!VALID_CLASSES.includes(groupId)) {
        return callback({ success: false, error: 'כיתה לא חוקית' });
      }
      state.votes[uuid] = { type, groupId, songId };
    } else {
      return callback({ success: false, error: 'סוג הצבעה לא חוקי' });
    }

    saveState();
    callback({ success: true });
    
    io.emit('statsUpdate', {
      totalVotes: Object.keys(state.votes).length
    });
  });

  socket.on('admin_update_config', (data, callback) => {
    state.songs = data.songs;
    state.points = data.points;
    saveState();
    io.emit('stateUpdate', { songs: state.songs, points: state.points });
    io.emit('config_update', { isVotingOpen: state.isVotingOpen, songs: state.songs, pointsArray: state.points });
    callback({ success: true });
  });

  socket.on('admin_toggle_voting', (data, callback) => {
    state.isVotingOpen = !state.isVotingOpen;
    saveState();
    io.emit('stateUpdate', { isVotingOpen: state.isVotingOpen });
    io.emit('config_update', { isVotingOpen: state.isVotingOpen, songs: state.songs, pointsArray: state.points });
    callback({ success: true, isVotingOpen: state.isVotingOpen });
  });

  socket.on('adminAction', (action, callback) => {
    if (action.type === 'generateJudgeCodes') {
      const codes = Array.from({length: 10}, () => Math.random().toString(36).substring(2, 8).toUpperCase());
      state.judgeCodes = codes;
      saveState();
      callback({ success: true, codes });
    } else if (action.type === 'calculateResults') {
      state.results = calculateResults();
      state.isCalculated = true;
      state.isVotingOpen = false;
      saveState();
      io.emit('stateUpdate', { results: state.results, isCalculated: true, isVotingOpen: false });
      io.emit('config_update', { isVotingOpen: false, songs: state.songs, pointsArray: state.points });
      callback({ success: true });
    } else if (action.type === 'reset') {
      state.votes = {};
      state.results = null;
      state.isCalculated = false;
      state.isVotingOpen = false;
      saveState();
      io.emit('stateUpdate', { results: null, isCalculated: false, isVotingOpen: false });
      io.emit('config_update', { isVotingOpen: false, songs: state.songs, pointsArray: state.points });
      io.emit('statsUpdate', { totalVotes: 0 });
      callback({ success: true });
    }
  });

  socket.on('getAdminData', (data, callback) => {
      callback({
          judgeCodes: state.judgeCodes,
          totalVotes: Object.keys(state.votes).length,
          points: state.points,
          songs: state.songs,
          isVotingOpen: state.isVotingOpen
      })
  });
});

server.listen(3001, '0.0.0.0', () => {
  console.log('Server is running on http://0.0.0.0:3001');
});
