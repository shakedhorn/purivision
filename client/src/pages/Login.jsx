import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';

export default function Login() {
  const [role, setRole] = useState('audience');
  const [code, setCode] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [classes, setClasses] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    socket.on('stateUpdate', (data) => {
      setClasses(data.classes || []);
      if(data.classes && data.classes.length > 0 && !selectedClass) {
          setSelectedClass(data.classes[0]);
      }
    });
    return () => socket.off('stateUpdate');
  }, [selectedClass]);

  const handleLogin = () => {
    let uuid = localStorage.getItem('purimvision_uuid');
    if (!uuid) {
      uuid = crypto.randomUUID();
      localStorage.setItem('purimvision_uuid', uuid);
    }
    
    if (role === 'audience') {
      localStorage.setItem('purimvision_type', 'audience');
      localStorage.setItem('purimvision_group', selectedClass);
    } else {
      localStorage.setItem('purimvision_type', 'judge');
      localStorage.setItem('purimvision_group', code);
    }
    navigate('/vote');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
      <h1 className="text-4xl font-bold mb-8 text-purple-400">Purimvision 🎭</h1>
      <div className="bg-slate-800 p-8 rounded-xl shadow-lg w-full max-w-md border border-slate-700">
        <div className="flex space-x-4 mb-6">
          <button 
            className={`flex-1 py-2 rounded-lg font-semibold transition ${role === 'audience' ? 'bg-purple-600 shadow-[0_0_15px_rgba(147,51,234,0.5)]' : 'bg-slate-700 hover:bg-slate-600'}`}
            onClick={() => setRole('audience')}
          >
            Audience
          </button>
          <button 
            className={`flex-1 py-2 rounded-lg font-semibold transition ${role === 'judge' ? 'bg-purple-600 shadow-[0_0_15px_rgba(147,51,234,0.5)]' : 'bg-slate-700 hover:bg-slate-600'}`}
            onClick={() => setRole('judge')}
          >
            Judge
          </button>
        </div>
        
        {role === 'audience' ? (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-slate-300">Select Your Class</label>
            <select 
              className="w-full bg-slate-900 border border-slate-600 p-3 rounded-lg outline-none focus:border-purple-500 transition"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              {classes.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-slate-300">Judge Code</label>
            <input 
              type="text"
              className="w-full bg-slate-900 border border-slate-600 p-3 rounded-lg outline-none focus:border-purple-500 transition uppercase"
              placeholder="Enter Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
        )}

        <button 
          onClick={handleLogin}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-colors p-3 rounded-lg font-bold text-lg shadow-lg"
        >
          Enter
        </button>
      </div>
    </div>
  );
}
