import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import { Reorder } from 'framer-motion';
import { GripVertical, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';

export default function Vote() {
  const [stateData, setStateData] = useState({ songs: [], isCalculated: false, isVotingOpen: false, judgeCodes: [] });
  const [orderedSongs, setOrderedSongs] = useState([]);
  const [voted, setVoted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const navigate = useNavigate();

  const type = localStorage.getItem('purivision_type');
  const storedGroup = localStorage.getItem('purivision_group') || '';
  const uuid = localStorage.getItem('purivision_uuid');

  // Step 1 vs Step 2 Judge Authentication State
  const [isJudgeVerified, setIsJudgeVerified] = useState(() => {
    return sessionStorage.getItem('purivision_judge_verified') === 'true' && !!storedGroup.trim();
  });
  const [judgeCodeInput, setJudgeCodeInput] = useState(() => storedGroup.trim().toUpperCase());
  const [judgeLoginError, setJudgeLoginError] = useState('');

  useEffect(() => {
    if (!type || !storedGroup || !uuid) {
      navigate('/');
      return;
    }

    // Request source of truth from server
    socket.emit('request_initial_state', uuid);

    const onInitialState = (data) => {
      const codes = data.judgeCodes || [];
      setStateData(prev => ({
        ...prev,
        isVotingOpen: data.isVotingOpen,
        songs: data.songs || [],
        judgeCodes: codes.length > 0 ? codes : prev.judgeCodes
      }));

      // If judge arrived with a code in localStorage, validate it immediately
      if (type === 'judge') {
        const clean = (localStorage.getItem('purivision_group') || '').trim().toUpperCase();
        if (clean && codes.includes(clean)) {
          sessionStorage.setItem('purivision_judge_verified', 'true');
          setIsJudgeVerified(true);
        } else if (clean && codes.length > 0 && !codes.includes(clean)) {
          sessionStorage.removeItem('purivision_judge_verified');
          setIsJudgeVerified(false);
          setJudgeLoginError('קוד שופט אינו תקין. אנא הזן קוד מורשה מחדש.');
        }
      }

      setVoted(data.hasVoted);
      setIsLoaded(true);
    };

    const onStateUpdate = (data) => {
      setStateData(prev => ({ ...prev, ...data }));
    };

    const onConfigUpdate = (data) => {
      const codes = data.judgeCodes || [];
      setStateData(prev => ({
        ...prev,
        isVotingOpen: data.isVotingOpen,
        songs: data.songs || prev.songs || [],
        judgeCodes: codes.length > 0 ? codes : prev.judgeCodes
      }));

      // Validate stored code on config updates (e.g., if admin regenerates judge codes)
      if (type === 'judge') {
        const clean = (localStorage.getItem('purivision_group') || '').trim().toUpperCase();
        if (clean && codes.length > 0 && !codes.includes(clean)) {
          sessionStorage.removeItem('purivision_judge_verified');
          setIsJudgeVerified(false);
          setJudgeLoginError('קודי השופטים עודכנו על ידי המנהל. אנא הזן את הקוד החדש שלך.');
        }
      }

      setIsLoaded(true);
    };

    const onVotesReset = () => {
      sessionStorage.clear();
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
  }, [navigate, type, storedGroup, uuid]);

  // Synchronize orderedSongs safely without resetting user-dragged ordering on unrelated re-renders
  useEffect(() => {
    if (stateData.songs && stateData.songs.length > 0) {
      setOrderedSongs(prev => {
        if (prev.length === 0) return stateData.songs;
        const prevIds = prev.map(s => s.id).sort().join(',');
        const nextIds = stateData.songs.map(s => s.id).sort().join(',');
        if (prevIds !== nextIds) {
          return stateData.songs;
        }
        return prev;
      });
    }
  }, [stateData.songs]);

  // Step 1: Handle Judge Login Submission
  const handleJudgeLogin = (e) => {
    e.preventDefault();
    setJudgeLoginError('');

    const clean = judgeCodeInput.trim().toUpperCase();
    if (!clean) {
      setJudgeLoginError('אנא הזן קוד שופט');
      return;
    }

    if (!stateData.judgeCodes || stateData.judgeCodes.length === 0) {
      setJudgeLoginError('טוען נתונים מהשרת... אנא נסה שוב בעוד מספר שניות.');
      return;
    }

    if (!stateData.judgeCodes.includes(clean)) {
      setJudgeLoginError('קוד שופט אינו תקין (Invalid Judge Code). ודא שהזנת את הקוד המדויק.');
      return;
    }

    // Success: code verified! Transition to Step 2
    localStorage.setItem('purivision_group', clean);
    sessionStorage.setItem('purivision_judge_verified', 'true');
    setIsJudgeVerified(true);
  };

  const submitAudienceVote = (songId) => {
    socket.emit('submit_vote', { uuid, type, groupId: storedGroup, songId });
  };

  const handleVoteSubmit = () => {
    const cleanJudgeCode = (localStorage.getItem('purivision_group') || judgeCodeInput).trim().toUpperCase();

    if (type === 'judge') {
      if (!isJudgeVerified || !stateData.judgeCodes.includes(cleanJudgeCode)) {
        alert('קוד שופט אינו תקין או שפג תוקפו. לא ניתן לשלוח הצבעה.');
        setIsJudgeVerified(false);
        return;
      }
    }

    if (orderedSongs.length !== stateData.songs.length) {
      alert('שגיאה: רשימת השירים לא תואמת. נסה לרענן את העמוד.');
      return;
    }

    socket.emit('submit_vote', {
      uuid,
      type,
      groupId: cleanJudgeCode,
      order: orderedSongs.map(s => s.id)
    });
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-xl font-semibold">מתחבר לשרת...</div>
      </div>
    );
  }

  if (!stateData.isVotingOpen || stateData.isCalculated) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-center p-4">
        <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-4">
          ההצבעה טרם נפתחה או שהסתיימה
        </div>
        <div className="text-xl text-slate-400">אנא המתן להוראות.</div>
      </div>
    );
  }

  if (voted) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-center p-4">
        <div className="text-4xl font-black text-green-400 mb-4">ההצבעה נקלטה</div>
        <div className="text-xl text-slate-400">תודה שהצבעת!</div>
      </div>
    );
  }

  const activeJudgeCode = (localStorage.getItem('purivision_group') || judgeCodeInput).trim().toUpperCase();

  return (
    <div className="min-h-screen bg-slate-900 p-4 max-w-lg mx-auto text-white font-sans" dir="rtl">
      <h1 className="text-3xl font-black mb-2 text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
        purivision 2027
      </h1>
      
      {/* Voter Subtitle */}
      <p className="text-center text-slate-400 mb-6 font-semibold uppercase tracking-wider text-sm">
        {type === 'audience' ? `הצבעת קהל - כיתה: ${storedGroup}` : `פאנל שיפוט רשמי`}
      </p>

      {type === 'audience' ? (
        /* Audience Voting View */
        <div className="space-y-4">
          {stateData.songs && stateData.songs.map(song => (
            <button
              key={song.id}
              onClick={() => submitAudienceVote(song.id)}
              className="w-full bg-slate-800 hover:bg-slate-700 hover:scale-[1.02] active:scale-95 transition-all p-6 rounded-2xl flex flex-col items-center shadow-xl border border-slate-700 cursor-pointer"
            >
              <span className="text-2xl font-bold mb-1">{song.name}</span>
              <span className="text-slate-400 font-medium" dir="ltr">{song.artist}</span>
            </button>
          ))}
        </div>
      ) : !isJudgeVerified ? (
        /* Step 1: Clean, Dedicated Judge Login View */
        <div className="bg-slate-800/90 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-slate-700/80 my-4">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/30 text-purple-400 mb-3 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
              <KeyRound className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white">כניסת שופט לתחרות</h2>
            <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
              הזן את קוד השיפוט האישי בן 6 התווים שנמסר לך על מנת לפתוח את ממשק הדירוג
            </p>
          </div>

          {judgeLoginError && (
            <div className="mb-5 p-4 bg-red-950/70 border border-red-800/80 rounded-xl flex items-center gap-3 text-red-200 text-sm shadow">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
              <span>{judgeLoginError}</span>
            </div>
          )}

          <form onSubmit={handleJudgeLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-300">
                קוד שופט
              </label>
              <input
                type="text"
                required
                autoFocus
                value={judgeCodeInput}
                onChange={(e) => {
                  setJudgeCodeInput(e.target.value.toUpperCase());
                  setJudgeLoginError('');
                }}
                placeholder="לדוגמה: Z4FQCI"
                dir="ltr"
                maxLength={10}
                className="w-full bg-slate-900/90 border border-slate-600/80 focus:border-purple-500 py-3.5 px-4 rounded-xl outline-none font-mono text-center text-2xl tracking-widest text-purple-300 uppercase shadow-inner"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition py-3.5 px-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>אמת קוד והמשך לדירוג</span>
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-700/60 text-center">
            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem('purivision_judge_verified');
                localStorage.removeItem('purivision_type');
                localStorage.removeItem('purivision_group');
                navigate('/');
              }}
              className="text-xs text-slate-400 hover:text-purple-400 transition cursor-pointer"
            >
              ← חזרה למסך הראשי (בחירת קהל / כיתה)
            </button>
          </div>
        </div>
      ) : (
        /* Step 2: Dedicated Song Ranking Interface (Unlocked and Clean) */
        <div className="space-y-5">
          {/* Verified Judge Status Header */}
          <div className="flex items-center justify-between bg-slate-800/80 border border-slate-700/80 px-4 py-3 rounded-xl shadow-md">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div className="text-xs">
                <span className="text-slate-400">שופט מורשה: </span>
                <span className="font-mono text-emerald-300 font-bold tracking-widest text-sm">{activeJudgeCode}</span>
              </div>
            </div>
            <button
              onClick={() => {
                setIsJudgeVerified(false);
                sessionStorage.removeItem('purivision_judge_verified');
              }}
              className="text-xs text-slate-400 hover:text-purple-400 transition underline underline-offset-2 cursor-pointer"
            >
              החלף קוד
            </button>
          </div>

          <p className="text-slate-300 text-center bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 text-sm leading-relaxed">
            גרור ושחרר כדי לדרג את השירים. השיר העליון (מקום 1) מקבל את מירב הנקודות.
          </p>

          {/* Fluid Framer Motion Reordering List */}
          <Reorder.Group
            axis="y"
            values={orderedSongs}
            onReorder={setOrderedSongs}
            className="space-y-3 select-none"
          >
            {orderedSongs.map((song, index) => (
              <Reorder.Item
                key={song.id}
                value={song}
                id={song.id}
                whileDrag={{
                  scale: 1.025,
                  zIndex: 50,
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 10px 10px -5px rgba(0, 0, 0, 0.4)"
                }}
                transition={{
                  type: "spring",
                  stiffness: 450,
                  damping: 35
                }}
                className="bg-slate-800 p-4 rounded-xl flex items-center shadow-lg border border-slate-700 cursor-grab active:cursor-grabbing select-none touch-none"
              >
                <div className="ml-4 text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-purple-400 to-pink-500 w-8 text-center flex-shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  <div className="text-lg font-bold text-white truncate">{song.name}</div>
                  <div className="text-slate-400 text-sm truncate" dir="ltr">{song.artist}</div>
                </div>
                <div className="text-slate-500 p-1 flex-shrink-0">
                  <GripVertical className="w-5 h-5" />
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>

          <button
            onClick={handleVoteSubmit}
            className="w-full mt-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition py-4 px-4 rounded-xl font-bold text-xl shadow-lg cursor-pointer"
          >
            שלח דירוג
          </button>
        </div>
      )}
    </div>
  );
}
