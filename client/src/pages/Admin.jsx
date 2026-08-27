import { useState, useEffect } from 'react';
import { socket } from '../socket';

export default function Admin() {
  const [adminData, setAdminData] = useState({ judgeCodes: [], totalVotes: 0, classes: [], points: [], songs: [] });
  const [liveStats, setLiveStats] = useState({ totalVotes: 0 });

  useEffect(() => {
    socket.emit('getAdminData', {}, (data) => {
      setAdminData(data);
      setLiveStats({ totalVotes: data.totalVotes });
    });

    socket.on('statsUpdate', (data) => {
      setLiveStats(data);
    });

    return () => socket.off('statsUpdate');
  }, []);

  const generateCodes = () => {
    socket.emit('adminAction', { type: 'generateJudgeCodes' }, (res) => {
      if (res.success) {
        setAdminData(prev => ({ ...prev, judgeCodes: res.codes }));
      }
    });
  };

  const calculate = () => {
    if(window.confirm('Are you sure? This will end voting and calculate final results!')) {
      socket.emit('adminAction', { type: 'calculateResults' }, () => {
        alert('Results calculated! The /results screen will now show them.');
      });
    }
  };

  const reset = () => {
    if(window.confirm('DANGER! This will delete all votes! Are you sure?')) {
      socket.emit('adminAction', { type: 'reset' }, () => {
        alert('Reset complete');
        setLiveStats({ totalVotes: 0 });
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8 text-slate-200">
      <h1 className="text-4xl font-black mb-8 text-white">Admin Dashboard</h1>
      
      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <h2 className="text-2xl font-bold mb-4">Live Stats</h2>
          <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-2">{liveStats.totalVotes}</div>
          <div className="text-slate-400 uppercase tracking-widest text-sm font-bold">Total Votes Cast</div>
          
          <div className="mt-8 space-y-4">
            <button onClick={calculate} className="w-full bg-green-600 hover:bg-green-500 p-4 rounded-xl font-bold text-white transition text-lg shadow-lg">
              Calculate & End Voting
            </button>
            <button onClick={reset} className="w-full bg-red-900/50 hover:bg-red-800 border border-red-900 p-4 rounded-xl font-bold text-red-200 transition text-lg">
              Reset All Votes & Results
            </button>
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Judge Codes ({adminData.judgeCodes.length})</h2>
            <button onClick={generateCodes} className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg font-bold text-sm transition shadow">
              Generate 10 New Codes
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 flex-grow content-start">
            {adminData.judgeCodes.map(c => (
              <div key={c} className="bg-slate-900 border border-slate-700 p-3 text-center rounded-lg font-mono text-xl font-bold tracking-wider text-purple-300">{c}</div>
            ))}
            {adminData.judgeCodes.length === 0 && (
                <div className="col-span-2 text-slate-500 text-center py-8">No judge codes generated yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
