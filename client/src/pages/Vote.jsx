import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import { Reorder } from 'framer-motion';
import { GripVertical, AlertCircle, CheckCircle2, Lock } from 'lucide-react';

export default function Vote() {
  const [stateData, setStateData] = useState({ songs: [], isCalculated: false, isVotingOpen: false, judgeCodes: [] });
  const [orderedSongs, setOrderedSongs] = useState([]);
  const [voted, setVoted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const navigate = useNavigate();

  const type = localStorage.getItem('purivision_type');
  const storedGroup = localStorage.getItem('purivision_group') || '';
  const uuid = localStorage.getItem('purivision_uuid');

  // Real-time Judge Code state
  const [judgeCode, setJudgeCode] = useState(() => storedGroup.trim().toUpperCase());

  useEffect(() => {
    if (!type || !storedGroup || !uuid) {
      navigate('/');
      return;
    }

    // Request source of truth from server
    socket.emit('request_initial_state', uuid);

    const onInitialState = (data) => {
      setStateData(prev => ({
        ...prev,
        isVotingOpen: data.isVotingOpen,
        songs: data.songs || [],
        judgeCodes: data.judgeCodes || prev.judgeCodes || []
      }));
      setVoted(data.hasVoted);
      setIsLoaded(true);
    };

    const onStateUpdate = (data) => {
      setStateData(prev => ({ ...prev, ...data }));
    };

    const onConfigUpdate = (data) => {
      setStateData(prev => ({
        ...prev,
        isVotingOpen: data.isVotingOpen,
        songs: data.songs || prev.songs || [],
        judgeCodes: data.judgeCodes || prev.judgeCodes || []
      }));
      setIsLoaded(true);
    };

    const onVotesReset = () => {
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

  // Synchronize orderedSongs strictly with the socket's songs list
  useEffect(() => {
    if (stateData.songs && stateData.songs.length > 0) {
      setOrderedSongs(stateData.songs);
    }
  }, [stateData.songs]);

  // Validate Judge Code in real-time against server-provided valid codes
  const cleanJudgeCode = judgeCode.trim().toUpperCase();
  const hasJudgeCodes = Array.isArray(stateData.judgeCodes) && stateData.judgeCodes.length > 0;
  const isJudgeCodeValid = type === 'judge'
    ? (hasJudgeCodes && cleanJudgeCode.length > 0 && stateData.judgeCodes.includes(cleanJudgeCode))
    : true;

  const handleJudgeCodeChange = (e) => {
    const value = e.target.value.toUpperCase();
    setJudgeCode(value);
    const clean = value.trim();
    if (clean) {
      localStorage.setItem('purivision_group', clean);
    }
  };

  const submitAudienceVote = (songId) => {
    socket.emit('submit_vote', { uuid, type, groupId: storedGroup, songId });
  };

  const handleVoteSubmit = () => {
    if (type === 'judge' && !isJudgeCodeValid) {
      alert('קוד שופט אינו תקין (Invalid Judge Code). לא ניתן לשלוח הצבעה.');
      return;
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

  return (
    <div className="min-h-screen bg-slate-900 p-4 max-w-lg mx-auto text-white font-sans" dir="rtl">
      <h2 className="text-3xl font-bold mb-2 text-center text-purple-400">הצבע לשיר המועדף עליך</h2>
      
      {/* Voter Type / Status Indicator */}
      <p className="text-center text-slate-400 mb-6 font-semibold uppercase tracking-wider">
        {type === 'audience' ? `כיתה: ${storedGroup}` : `שופט רשמי`}
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
      ) : (
        /* Judge Voting View with Real-time Validation */
        <div className="space-y-6">
          {/* Judge Code Input & Real-time Validation Card */}
          <div className="bg-slate-800/90 border border-slate-700/80 p-5 rounded-2xl shadow-xl">
            <label className="block text-sm font-semibold mb-2 text-slate-300">
              קוד שופט (Judge Code)
            </label>
            <div className="relative">
              <input
                type="text"
                value={judgeCode}
                onChange={handleJudgeCodeChange}
                placeholder="הזן קוד שופט (לדוגמה: 6 אותיות/ספרות)"
                dir="ltr"
                className={`w-full bg-slate-900/90 border p-3.5 rounded-xl outline-none font-mono text-center tracking-widest text-lg transition uppercase ${
                  isJudgeCodeValid
                    ? 'border-emerald-500/80 text-emerald-300 focus:border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                    : 'border-red-500/80 text-red-200 focus:border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                }`}
              />
            </div>

            {/* Validation Feedback Banner */}
            <div className="mt-3">
              {isJudgeCodeValid ? (
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <span>קוד שופט מאומת בהצלחה ✓</span>
                </div>
              ) : (
                <div className="p-3.5 bg-red-950/70 border border-red-800/80 rounded-xl flex items-center gap-3 text-red-200 text-sm shadow">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
                  <div>
                    <div className="font-bold">קוד שופט אינו תקין (Invalid Judge Code)</div>
                    <div className="text-xs text-red-300 mt-0.5">
                      הקוד שהוזן אינו מופיע ברשימת השופטים המורשים. לוח הדירוג נותר חסום עד להזנת קוד תקין.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Conditional Voting Interface: Only Enabled When Code is Valid */}
          {isJudgeCodeValid ? (
            <div>
              <p className="text-slate-300 mb-6 text-center bg-slate-800/80 p-4 rounded-xl border border-slate-700 text-sm">
                גרור ושחרר כדי לדרג את השירים. השיר העליון מקבל את מירב הנקודות.
              </p>
              <Reorder.Group axis="y" values={orderedSongs} onReorder={setOrderedSongs} className="space-y-3">
                {orderedSongs.map((song, index) => (
                  <Reorder.Item
                    key={song.id}
                    value={song}
                    className="bg-slate-800 p-4 rounded-xl flex items-center shadow-lg border border-slate-700 cursor-grab active:cursor-grabbing hover:border-slate-600 transition"
                  >
                    <div className="ml-4 text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-purple-400 to-pink-500 w-8 text-center">
                      {index + 1}
                    </div>
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
          ) : (
            /* Blocked/Locked Placeholder when Judge Code is Invalid */
            <div className="bg-slate-800/50 border border-slate-700/60 p-8 rounded-2xl text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-800 border border-slate-700 text-slate-500 shadow-inner">
                <Lock className="w-7 h-7 text-slate-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-300">לוח הדירוג חסום להצבעה</h3>
                <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">
                  אנא הזן קוד שופט חוקי באורך 6 תווים בשדה שלמעלה על מנת לפתוח את ממשק הדירוג.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
