import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import { Reorder } from 'framer-motion';
import { GripVertical } from 'lucide-react';

export default function Vote() {
  const [stateData, setStateData] = useState({ songs: [], isCalculated: false, isVotingOpen: false });
  const [orderedSongs, setOrderedSongs] = useState([]);
  const [voted, setVoted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const navigate = useNavigate();

  const type = localStorage.getItem('purivision_type');
  const groupId = localStorage.getItem('purivision_group');
  const uuid = localStorage.getItem('purivision_uuid');

  useEffect(() => {
    if (!type || !groupId || !uuid) {
      navigate('/');
      return;
    }
    
    // Request source of truth from server
    socket.emit('request_initial_state', uuid);

    const onInitialState = (data) => {
      setStateData(prev => ({ ...prev, isVotingOpen: data.isVotingOpen, songs: data.songs }));
      setVoted(data.hasVoted);
      setIsLoaded(true);
    };

    const onStateUpdate = (data) => {
      setStateData(prev => ({ ...prev, ...data }));
    };

    const onConfigUpdate = (data) => {
      setStateData(prev => ({ ...prev, isVotingOpen: data.isVotingOpen, songs: data.songs }));
      setIsLoaded(true);
    };

    const onVotesReset = () => {
      // Hard reset the client session
      localStorage.clear();
      navigate('/');
    };

    const onVoteSuccess = () => {
      setVoted(true);
    };

    const onVoteError = (msg) => {
      alert(msg);
    };

    socket.on('initial_state', onInitialState);
    socket.on('stateUpdate', onStateUpdate);
    socket.on('config_update', onConfigUpdate);
    socket.on('votes_reset', onVotesReset);
    socket.on('vote_success', onVoteSuccess);
    socket.on('vote_error', onVoteError);
    
    return () => {
      socket.off('initial_state', onInitialState);
      socket.off('stateUpdate', onStateUpdate);
      socket.off('config_update', onConfigUpdate);
      socket.off('votes_reset', onVotesReset);
      socket.off('vote_success', onVoteSuccess);
      socket.off('vote_error', onVoteError);
    };
  }, [navigate, type, groupId, uuid]);

  // Synchronize orderedSongs strictly with the socket's songs list
  useEffect(() => {
    if (stateData.songs && stateData.songs.length > 0) {
      setOrderedSongs(stateData.songs);
    }
  }, [stateData.songs]);

  const submitAudienceVote = (songId) => {
    socket.emit('submit_vote', { uuid, type, groupId, songId });
  };

  const handleVoteSubmit = () => {
    if (orderedSongs.length !== stateData.songs.length) {
      alert('שגיאה: רשימת השירים לא תואמת. נסה לרענן את העמוד.');
      return;
    }

    socket.emit('submit_vote', { uuid, type, groupId, order: orderedSongs.map(s => s.id) });
  };

  if (!isLoaded) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><div className="text-xl font-semibold">מתחבר לשרת...</div></div>;
  }

  if (!stateData.isVotingOpen || stateData.isCalculated) {
    return <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-center p-4">
        <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-4">
          ההצבעה טרם נפתחה או שהסתיימה
        </div>
        <div className="text-xl text-slate-400">אנא המתן להוראות.</div>
    </div>;
  }

  if (voted) {
    return <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-center p-4">
        <div className="text-4xl font-black text-green-400 mb-4">ההצבעה נקלטה</div>
        <div className="text-xl text-slate-400">תודה שהצבעת!</div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4 max-w-lg mx-auto text-white font-sans">
      <h2 className="text-3xl font-bold mb-2 text-center text-purple-400">הצבע לשיר המועדף עליך</h2>
      <p className="text-center text-slate-400 mb-6 font-semibold uppercase tracking-wider">{type === 'audience' ? `כיתה: ${groupId}` : `שופט: ${groupId}`}</p>

      {type === 'audience' ? (
        <div className="space-y-4">
          {stateData.songs && stateData.songs.map(song => (
            <button
              key={song.id}
              onClick={() => submitAudienceVote(song.id)}
              className="w-full bg-slate-800 hover:bg-slate-700 hover:scale-[1.02] active:scale-95 transition-all p-6 rounded-2xl flex flex-col items-center shadow-xl border border-slate-700"
            >
              <span className="text-2xl font-bold mb-1">{song.name}</span>
              <span className="text-slate-400 font-medium" dir="ltr">{song.artist}</span>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <p className="text-slate-300 mb-6 text-center bg-slate-800 p-4 rounded-xl border border-slate-700">
            גרור ושחרר כדי לדרג את השירים. השיר העליון מקבל את מירב הנקודות.
          </p>
          <Reorder.Group axis="y" values={orderedSongs} onReorder={setOrderedSongs} className="space-y-3">
            {orderedSongs.map((song, index) => (
              <Reorder.Item key={song.id} value={song} className="bg-slate-800 p-4 rounded-xl flex items-center shadow-lg border border-slate-700 cursor-grab active:cursor-grabbing">
                <div className="ml-4 text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-purple-400 to-pink-500 w-8 text-center">{index + 1}</div>
                <div className="flex-1">
                  <div className="text-lg font-bold">{song.name}</div>
                  <div className="text-slate-400 text-sm" dir="ltr">{song.artist}</div>
                </div>
                <GripVertical className="text-slate-500" />
              </Reorder.Item>
            ))}
          </Reorder.Group>
          <button 
            onClick={handleVoteSubmit}
            className="w-full mt-8 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition p-4 rounded-xl font-bold text-xl shadow-lg cursor-pointer"
          >
            שלח דירוג
          </button>
        </div>
      )}
    </div>
  );
}
