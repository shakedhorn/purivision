import { useState } from 'react';
import { BACKEND_URL } from '../socket';
import { Lock, Shield, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminLogin({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('אנא הזן שם משתמש וסיסמה');
      return;
    }

    setIsLoading(true);

    try {
      // Authenticate against the backend using both JSON body and HTTP Basic Auth headers
      const response = await fetch(`${BACKEND_URL}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa(`${username.trim()}:${password}`)
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password
        })
      });

      const data = await response.json();

      if (response.ok && data.success && data.token) {
        sessionStorage.setItem('purivision_admin_token', data.token);
        sessionStorage.setItem('purivision_admin_username', data.username || username.trim());
        if (typeof onLoginSuccess === 'function') {
          onLoginSuccess(data.token);
        }
      } else {
        setError(data.message || 'פרטי התחברות שגויים. גישה נדחתה.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('שגיאת תקשורת עם השרת. אנא ודא שהשרת פעיל ונסה שוב.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4 font-sans" dir="rtl">
      <div className="w-full max-w-md">
        
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/30 text-purple-400 mb-4 shadow-[0_0_25px_rgba(168,85,247,0.3)]">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
            כניסת מנהל - purivision
          </h1>
          <p className="text-slate-400 text-sm mt-2 font-medium">
            אזור מאובטח לצוות ההפקה והשיפוט בלבד
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-800/90 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-slate-700/80">
          {error && (
            <div className="mb-6 p-4 bg-red-950/60 border border-red-800/80 rounded-xl flex items-center gap-3 text-red-200 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-300">
                שם משתמש
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="הזן שם משתמש מנהל"
                  dir="ltr"
                  className="w-full bg-slate-900/90 border border-slate-600/80 focus:border-purple-500 py-3.5 pl-3.5 pr-3.5 rounded-xl outline-none transition text-white placeholder-slate-500 text-left font-mono leading-normal"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-300">
                סיסמה
              </label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  dir="ltr"
                  className="w-full bg-slate-900/90 border border-slate-600/80 focus:border-purple-500 py-3.5 pl-11 pr-3.5 rounded-xl outline-none transition text-white placeholder-slate-500 text-left font-mono leading-normal"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 text-slate-400 hover:text-slate-200 transition focus:outline-none cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5 block" /> : <Eye className="w-5 h-5 block" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all py-3.5 px-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isLoading ? (
                <span>מאמת נתונים...</span>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>התחבר למערכת</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
            <Link to="/" className="hover:text-purple-400 transition flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>מסך הצבעה לקהל</span>
            </Link>
            <Link to="/results" className="hover:text-purple-400 transition">
              לוח תוצאות פומבי 🏆
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
