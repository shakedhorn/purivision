import { useState, useEffect } from 'react';
import { socket } from '../socket';
import { motion, AnimatePresence } from 'framer-motion';

export default function Results() {
  const [results, setResults] = useState(null);

  useEffect(() => {
    socket.on('stateUpdate', (data) => {
      if (data.isCalculated && data.results) {
        setResults(data.results);
      } else {
        setResults(null);
      }
    });
    return () => socket.off('stateUpdate');
  }, []);

  if (!results) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex flex-col items-center justify-center text-white overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="text-7xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-purple-400 mb-8"
        >
          purivision 2027
        </motion.div>
        <p className="text-3xl text-slate-500 font-light uppercase tracking-widest" dir="rtl">ממתינים לתוצאות הסופיות...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white p-8 font-sans overflow-x-hidden" dir="rtl">
      <h1 className="text-6xl font-black text-center mb-16 tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mt-8">
        תוצאות סופיות
      </h1>
      
      <div className="max-w-5xl mx-auto space-y-5">
        <AnimatePresence>
          {results.map((song, index) => (
            <motion.div
              key={song.id}
              layout
              initial={{ opacity: 0, x: -50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ 
                type: "spring", 
                stiffness: 400, 
                damping: 40,
                layout: { duration: 1, type: "spring", bounce: 0.2 }
              }}
              className="flex items-center bg-slate-800/80 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-slate-700/50 relative overflow-hidden"
            >
              {index === 0 && (
                  <div className="absolute inset-0 bg-gradient-to-l from-yellow-500/20 to-transparent pointer-events-none" />
              )}
              <div className={`flex-shrink-0 w-20 text-5xl font-black ml-6 text-center ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-amber-600' : 'text-slate-600'}`}>
                {index + 1}
              </div>
              <div className="flex-grow z-10">
                <div className="text-4xl font-bold mb-1">{song.name}</div>
                <div className="text-2xl text-slate-400 font-medium" dir="ltr" style={{textAlign: "right"}}>{song.artist}</div>
              </div>
              <div className="flex-shrink-0 text-left z-10">
                <motion.div 
                  className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-purple-400 to-pink-500"
                  key={song.score}
                  initial={{ scale: 1.5, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  {song.score}
                </motion.div>
                <div className="text-sm text-slate-500 uppercase tracking-widest font-bold mt-1">נקודות</div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
