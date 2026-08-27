import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';

const CLASSES = ['ט1', 'ט2', 'י1', 'י2', 'יא1', 'יא2', 'יב', 'רמים', 'הנהלה'];

export default function Login() {
  const [role, setRole] = useState('audience');
  const [code, setCode] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    let uuid = localStorage.getItem('purivision_uuid');
    if (!uuid) {
      uuid = crypto.randomUUID();
      localStorage.setItem('purivision_uuid', uuid);
    }
    
    if (role === 'audience') {
      if (!selectedClass || selectedClass === 'בחר כיתה...') {
        alert('אנא בחר כיתה או הכנס קוד שופט');
        return;
      }
      localStorage.setItem('purivision_type', 'audience');
      localStorage.setItem('purivision_group', selectedClass);
    } else {
      if (!code || code.trim() === '') {
        alert('אנא בחר כיתה או הכנס קוד שופט');
        return;
      }
      localStorage.setItem('purivision_type', 'judge');
      localStorage.setItem('purivision_group', code.trim());
    }
    navigate('/vote');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4 font-sans">
      <h1 className="text-4xl font-bold mb-8 text-purple-400">purivision 2027</h1>
      <form onSubmit={handleLogin} className="bg-slate-800 p-8 rounded-xl shadow-lg w-full max-w-md border border-slate-700 z-10 relative">
        <div className="flex space-x-4 mb-6">
          <button 
            type="button"
            className={`flex-1 py-2 rounded-lg font-semibold transition mx-2 ${role === 'audience' ? 'bg-purple-600 shadow-[0_0_15px_rgba(147,51,234,0.5)]' : 'bg-slate-700 hover:bg-slate-600'}`}
            onClick={() => setRole('audience')}
          >
            קהל
          </button>
          <button 
            type="button"
            className={`flex-1 py-2 rounded-lg font-semibold transition mx-2 ${role === 'judge' ? 'bg-purple-600 shadow-[0_0_15px_rgba(147,51,234,0.5)]' : 'bg-slate-700 hover:bg-slate-600'}`}
            onClick={() => setRole('judge')}
          >
            שופט
          </button>
        </div>
        
        {role === 'audience' ? (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-slate-300">בחר כיתה</label>
            <select 
              className="w-full bg-slate-900 border border-slate-600 p-3 rounded-lg outline-none focus:border-purple-500 transition"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              dir="rtl"
            >
              <option value="" disabled>בחר כיתה...</option>
              {CLASSES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-slate-300">קוד שופט</label>
            <input 
              type="text"
              className="w-full bg-slate-900 border border-slate-600 p-3 rounded-lg outline-none focus:border-purple-500 transition uppercase text-left"
              placeholder="הזן קוד"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              dir="ltr"
            />
          </div>
        )}

        <button 
          type="submit"
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-colors p-3 rounded-lg font-bold text-lg shadow-lg mt-2 cursor-pointer z-20 relative"
        >
          היכנס
        </button>
      </form>
    </div>
  );
}
