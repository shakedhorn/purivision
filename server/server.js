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

let state = {
  songs: [],
  points: [],
  judgeCodes: [],
  classes: [],
  votes: {},
  results: null,
  isCalculated: false
};

// Load state on startup
if (fs.existsSync(dataPath)) {
  try {
    const rawData = fs.readFileSync(dataPath);
    state = JSON.parse(rawData);
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
  const { songs, points, votes, classes, judgeCodes } = state;
  let scores = {}; // songId -> { total: 0, frequencies: {12: 0, 10: 0}, groups: new Set() }

  songs.forEach(s => {
    scores[s.id] = { total: 0, frequencies: {}, groups: new Set() };
    points.forEach(p => scores[s.id].frequencies[p] = 0);
  });

  // Process judges
  Object.values(votes).forEach(vote => {
    if (vote.type === 'judge') {
      const order = vote.order; // array of songIds
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
  classes.forEach(className => {
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
      let groupedByVotes = {}; // count -> [songIds]
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
    classes: state.classes,
    results: state.results,
    isCalculated: state.isCalculated
  });

  socket.on('submitVote', (voteData, callback) => {
    if (state.isCalculated) {
      return callback({ success: false, error: 'Voting has ended' });
    }
    const { uuid, type, groupId, songId, order } = voteData;
    
    if (type === 'judge') {
      if (!state.judgeCodes.includes(groupId)) {
        return callback({ success: false, error: 'Invalid judge code' });
      }
      state.votes[uuid] = { type, groupId, order };
    } else if (type === 'audience') {
      if (!state.classes.includes(groupId)) {
        return callback({ success: false, error: 'Invalid class' });
      }
      state.votes[uuid] = { type, groupId, songId };
    } else {
      return callback({ success: false, error: 'Invalid vote type' });
    }

    saveState();
    callback({ success: true });
    
    io.emit('statsUpdate', {
      totalVotes: Object.keys(state.votes).length
    });
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
      saveState();
      io.emit('stateUpdate', { results: state.results, isCalculated: true });
      callback({ success: true });
    } else if (action.type === 'reset') {
      state.votes = {};
      state.results = null;
      state.isCalculated = false;
      saveState();
      io.emit('stateUpdate', { results: null, isCalculated: false });
      io.emit('statsUpdate', { totalVotes: 0 });
      callback({ success: true });
    }
  });

  socket.on('getAdminData', (data, callback) => {
      callback({
          judgeCodes: state.judgeCodes,
          totalVotes: Object.keys(state.votes).length,
          classes: state.classes,
          points: state.points,
          songs: state.songs
      })
  });
});

server.listen(3001, '0.0.0.0', () => {
  console.log('Server is running on http://0.0.0.0:3001');
});
