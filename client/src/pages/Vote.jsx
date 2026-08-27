import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import { Reorder } from 'framer-motion';
import { GripVertical } from 'lucide-react';

export default function Vote() {
  const [stateData, setStateData] = useState({ songs: [], isCalculated: false });
  const [judgeOrder, setJudgeOrder] = useState([]);
  const [voted, setVoted] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const type = localStorage.getItem('purimvision_type');
  const groupId = localStorage.getItem('purimvision_group');
  const uuid = localStorage.getItem('purimvision_uuid');

  useEffect(() => {
    if (!type || !groupId || !uuid) {
      navigate('/');
      return;
    }
    
    if (localStorage.getItem(`purimvision_voted_${uuid}`)) {
      setVoted(true);
    }

    const onStateUpdate = (data) => {
      setStateData(data);
      if (type === 'judge' && judgeOrder.length === 0 && data.songs && data.songs.length > 0) {
        setJudgeOrder(data.songs);
      }
    };

    socket.on('stateUpdate', onStateUpdate);
    return () => socket.off('stateUpdate', onStateUpdate);
  }, [navigate, type, groupId, uuid, judgeOrder.length]);

  const submitAudienceVote = (songId) => {
    socket.emit('submitVote', { uuid, type, groupId, songId }, (res) => {
      if (res.success) {
        setVoted(true);
        localStorage.setItem(`purimvision_voted_${uuid}`, 'true');
      } else {
        setError(res.error);
      }
    });
  };

  const submitJudgeVote = () => {
    socket.emit('submitVote', { uuid, type, groupId, order: judgeOrder.map(s => s.id) }, (res) => {
      if (res.success) {
        setVoted(true);
        localStorage.setItem(`purimvision_voted_${uuid}`, 'true');
      } else {
        setError(res.error);
      }
    });
  };

  if (stateData.isCalculated) {
    return <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-center p-4">
        <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-4">VOTING HAS ENDED</div>
        <div className="text-xl text-slate-400">Look at the big screen!</div>
    </div>;
  }

  if (voted) {
    return <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-center p-4">
        <div className="text-4xl font-black text-green-400 mb-4">VOTE RECORDED</div>
        <div className="text-xl text-slate-400">Thanks for voting!</div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4 max-w-lg mx-auto text-white">
      <h2 className="text-3xl font-bold mb-2 text-center text-purple-400">Vote for your favorite</h2>
      <p className="text-center text-slate-400 mb-6 font-semibold uppercase tracking-wider">{type === 'audience' ? `Class: ${groupId}` : `Judge: ${groupId}`}</p>
      
      {error && <div className="bg-red-500/20 border border-red-500 text-red-400 p-4 rounded-xl mb-6 text-center font-semibold">{error}</div>}

      {type === 'audience' ? (
        <div className="space-y-4">
          {stateData.songs.map(song => (
            <button
              key={song.id}
              onClick={() => submitAudienceVote(song.id)}
              className="w-full bg-slate-800 hover:bg-slate-700 hover:scale-[1.02] active:scale-95 transition-all p-6 rounded-2xl flex flex-col items-center shadow-xl border border-slate-700"
            >
              <span className="text-2xl font-bold mb-1">{song.name}</span>
              <span className="text-slate-400 font-medium">{song.artist}</span>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <p className="text-slate-300 mb-6 text-center bg-slate-800 p-4 rounded-xl border border-slate-700">Drag and drop to rank the songs. Top song gets the highest points.</p>
          <Reorder.Group axis="y" values={judgeOrder} onReorder={setJudgeOrder} className="space-y-3">
            {judgeOrder.map((song, index) => (
              <Reorder.Item key={song.id} value={song} className="bg-slate-800 p-4 rounded-xl flex items-center shadow-lg border border-slate-700 cursor-grab active:cursor-grabbing">
                <div className="mr-4 text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-purple-400 to-pink-500 w-8 text-center">{index + 1}</div>
                <div className="flex-1">
                  <div className="text-lg font-bold">{song.name}</div>
                  <div className="text-slate-400 text-sm">{song.artist}</div>
                </div>
                <GripVertical className="text-slate-500" />
              </Reorder.Item>
            ))}
          </Reorder.Group>
          <button 
            onClick={submitJudgeVote}
            className="w-full mt-8 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition p-4 rounded-xl font-bold text-xl shadow-lg"
          >
            Submit Rankings
          </button>
        </div>
      )}
    </div>
  );
}
