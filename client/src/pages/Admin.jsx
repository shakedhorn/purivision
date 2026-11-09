import { useState, useEffect, useCallback } from 'react';
import { socket } from '../socket';
import AdminLogin from '../components/AdminLogin';
import { LogOut, ShieldCheck, RefreshCw } from 'lucide-react';

export default function Admin() {
  const [token, setToken] = useState(() => sessionStorage.getItem('purivision_admin_token'));
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!sessionStorage.getItem('purivision_admin_token'));
  const [adminUsername, setAdminUsername] = useState(() => sessionStorage.getItem('purivision_admin_username') || 'מנהל');

  const [adminData, setAdminData] = useState({ judgeCodes: [], totalVotes: 0, classes: [], points: [], songs: [], isVotingOpen: false });
  const [liveStats, setLiveStats] = useState({ totalVotes: 0 });
  const [songs, setSongs] = useState([]);
  const [pointsStr, setPointsStr] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('purivision_admin_token');
    sessionStorage.removeItem('purivision_admin_username');
    setToken(null);
    setIsAuthenticated(false);
  }, []);

  const loadAdminData = useCallback((authToken) => {
    const currentToken = authToken || token;
    if (!currentToken) return;

    setIsLoading(true);

    // Authenticate socket connection
    socket.emit('admin_authenticate', { token: currentToken }, (authRes) => {
      if (authRes && !authRes.success) {
        alert('פג תוקף החיבור למערכת. אנא התחבר מחדש.');
        handleLogout();
        setIsLoading(false);
        return;
      }

      // Fetch dashboard data
      socket.emit('getAdminData', { token: currentToken }, (data) => {
        setIsLoading(false);
        if (data && data.error) {
          alert('שגיאת הרשאה: ' + data.error);
          handleLogout();
          return;
        }

        if (data) {
          setAdminData(data);
          setLiveStats({ totalVotes: data.totalVotes || 0 });
          setSongs(data.songs || []);
          setPointsStr(data.points ? data.points.join(', ') : '');
        }
      });
    });
  }, [token, handleLogout]);

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    loadAdminData(token);

    const onStats = (data) => setLiveStats(data);
    const onStateUpdate = (data) => {
      setAdminData(prev => ({ ...prev, isVotingOpen: data.isVotingOpen !== undefined ? data.isVotingOpen : prev.isVotingOpen }));
    };

    const onConfigUpdate = (data) => {
      if (data.judgeCodes) {
        setAdminData(prev => ({ ...prev, judgeCodes: data.judgeCodes }));
      }
    };

    const onConnect = () => {
      if (token) {
        socket.emit('admin_authenticate', { token });
      }
    };

    socket.on('connect', onConnect);
    socket.on('statsUpdate', onStats);
    socket.on('stateUpdate', onStateUpdate);
    socket.on('config_update', onConfigUpdate);

    return () => {
      socket.off('connect', onConnect);
      socket.off('statsUpdate', onStats);
      socket.off('stateUpdate', onStateUpdate);
      socket.off('config_update', onConfigUpdate);
    };
  }, [isAuthenticated, token, loadAdminData]);

  const handleLoginSuccess = (newToken) => {
    setToken(newToken);
    setAdminUsername(sessionStorage.getItem('purivision_admin_username') || 'מנהל');
    setIsAuthenticated(true);
    loadAdminData(newToken);
  };

  const generateCodes = () => {
    socket.emit('adminAction', { type: 'generateJudgeCodes', token }, (res) => {
      if (res && res.error) {
        alert('שגיאת הרשאה: ' + res.error);
        return;
      }
      if (res && res.success) {
        setAdminData(prev => ({ ...prev, judgeCodes: res.codes }));
        const pts = pointsStr.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
        socket.emit('admin_update_config', { songs, points: pts, judgeCodes: res.codes, token }, () => {});
      }
    });
  };

  const calculate = () => {
    if (window.confirm('האם אתה בטוח? פעולה זו תסיים את ההצבעה ותחשב תוצאות!')) {
      socket.emit('adminAction', { type: 'calculateResults', token }, (res) => {
        if (res && res.error) {
          alert('שגיאת הרשאה: ' + res.error);
          return;
        }
        alert('התוצאות חושבו! מסך התוצאות יציג אותן כעת.');
      });
    }
  };

  const reset = () => {
    if (window.confirm('סכנה! פעולה זו תמחק את כל ההצבעות ותייצר קודי שופטים חדשים! האם אתה בטוח?')) {
      socket.emit('adminAction', { type: 'reset', token }, (res) => {
        if (res && res.error) {
          alert('שגיאת הרשאה: ' + res.error);
          return;
        }
        alert('איפוס הושלם. קודים חדשים נוצרו והשחקנים נותקו.');
        setLiveStats({ totalVotes: 0 });
      });
    }
  };

  const toggleVoting = () => {
    socket.emit('admin_toggle_voting', { token }, (res) => {
      if (res && res.error) {
        alert('שגיאת הרשאה: ' + res.error);
        return;
      }
      if (res && res.success) {
        setAdminData(prev => ({ ...prev, isVotingOpen: res.isVotingOpen }));
      }
    });
  };

  const updateConfig = () => {
    const pts = pointsStr.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
    socket.emit('admin_update_config', { songs, points: pts, judgeCodes: adminData.judgeCodes, token }, (res) => {
      if (res && res.error) {
        alert('שגיאת הרשאה: ' + res.error);
        return;
      }
      if (res && res.success) alert('הגדרות עודכנו בהצלחה!');
    });
  };

  const addSong = () => setSongs([...songs, { id: 's' + Date.now(), name: '', artist: '' }]);

  const updateSong = (index, field, value) => {
    const newSongs = [...songs];
    newSongs[index][field] = value;
    setSongs(newSongs);
  };

  const removeSong = (index) => {
    const newSongs = [...songs];
    newSongs.splice(index, 1);
    setSongs(newSongs);
  };

  // If not authenticated, present the protected Admin Login form
  if (!isAuthenticated) {
    return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8 text-slate-200 font-sans" dir="rtl">
      
      {/* Top Navigation & Status Bar */}
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center mb-8 bg-slate-800/90 border border-slate-700/80 p-4 rounded-2xl shadow-xl gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-600/20 border border-purple-500/30 rounded-xl text-purple-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">לוח בקרה למנהל - purivision 2027</h1>
            <p className="text-xs text-slate-400 font-mono">מחובר כ: <span className="text-purple-300 font-semibold">{adminUsername}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadAdminData(token)}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700/80 hover:bg-slate-600 text-slate-200 rounded-xl text-sm font-semibold transition"
            title="רענן נתונים"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>רענן</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-950/60 hover:bg-red-900/80 border border-red-800/80 text-red-200 rounded-xl text-sm font-semibold transition shadow"
          >
            <LogOut className="w-4 h-4" />
            <span>התנתק</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto flex flex-col space-y-8">
        
        {/* Voting State & Live Stats Card */}
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl flex flex-col space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-4">ניהול הצבעה</h2>
            <div className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-700">
              <span className="text-xl font-semibold">
                סטטוס: {adminData.isVotingOpen ? <span className="text-green-400">פתוח להצבעה</span> : <span className="text-red-400">סגור</span>}
              </span>
              <button
                onClick={toggleVoting}
                className={`px-6 py-2.5 rounded-xl font-bold text-white transition shadow-lg cursor-pointer ${adminData.isVotingOpen ? 'bg-red-600 hover:bg-red-500 shadow-red-600/30' : 'bg-green-600 hover:bg-green-500 shadow-green-600/30'}`}
              >
                {adminData.isVotingOpen ? 'סגור הצבעה' : 'פתח הצבעה'}
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-2">נתונים חיים</h2>
            <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-2">
              {liveStats.totalVotes}
            </div>
            <div className="text-slate-400 font-bold">סך קולות שהתקבלו</div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-700">
            <button
              onClick={calculate}
              className="w-full bg-blue-600 hover:bg-blue-500 p-4 rounded-xl font-bold text-white transition text-lg shadow-lg cursor-pointer"
            >
              חשב תוצאות וסיים הצבעה
            </button>
            <button
              onClick={reset}
              className="w-full bg-red-900/50 hover:bg-red-800 border border-red-900 p-4 rounded-xl font-bold text-red-200 transition text-lg cursor-pointer"
            >
              אפס את כל ההצבעות והתוצאות
            </button>
          </div>
        </div>

        {/* Competition Settings Card */}
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl flex flex-col">
          <h2 className="text-2xl font-bold mb-4">הגדרות תחרות</h2>

          <div className="mb-6">
            <label className="block text-sm font-bold mb-2">מערך נקודות (מופרד בפסיקים)</label>
            <input
              type="text"
              className="w-full bg-slate-900 border border-slate-600 p-3 rounded-lg outline-none focus:border-purple-500 text-left"
              dir="ltr"
              value={pointsStr}
              onChange={e => setPointsStr(e.target.value)}
              placeholder="12, 10, 8, 7, 6"
            />
          </div>

          <div className="mb-6 flex-grow">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-bold">שירים מועמדים</label>
              <button
                onClick={addSong}
                className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-sm font-semibold transition cursor-pointer"
              >
                + הוסף שיר
              </button>
            </div>
            <div className="space-y-2">
              {songs.map((song, i) => (
                <div key={song.id} className="flex gap-2 bg-slate-900 p-2 rounded-lg border border-slate-700 items-center">
                  <input
                    placeholder="שם השיר"
                    className="flex-1 bg-transparent p-2 outline-none"
                    value={song.name}
                    onChange={e => updateSong(i, 'name', e.target.value)}
                  />
                  <input
                    placeholder="אמן"
                    className="flex-1 bg-transparent p-2 outline-none"
                    value={song.artist}
                    onChange={e => updateSong(i, 'artist', e.target.value)}
                  />
                  <button
                    onClick={() => removeSong(i)}
                    className="text-red-400 hover:text-red-300 px-2 font-bold cursor-pointer"
                  >
                    X
                  </button>
                </div>
              ))}
              {songs.length === 0 && <div className="text-slate-500 text-sm py-2">אין שירים מוגדרים.</div>}
            </div>
          </div>

          <button
            onClick={updateConfig}
            className="w-full bg-purple-600 hover:bg-purple-500 p-3 rounded-xl font-bold text-white transition mt-4 cursor-pointer"
          >
            שמור הגדרות
          </button>
        </div>

        {/* Judge Codes Card */}
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">קודי שופטים ({adminData.judgeCodes.length})</h2>
            <button
              onClick={generateCodes}
              className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg font-bold text-sm transition shadow cursor-pointer"
            >
              צור 10 קודים חדשים
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {adminData.judgeCodes.map(c => (
              <div
                key={c}
                className="bg-slate-900 border border-slate-700 p-3 text-center rounded-lg font-mono text-xl font-bold tracking-wider text-purple-300"
              >
                {c}
              </div>
            ))}
            {adminData.judgeCodes.length === 0 && (
              <div className="col-span-full text-slate-500 text-center py-4">לא נוצרו קודי שופטים עדיין.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
