import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, AlertCircle, ArrowRight, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { API_URL } from '../config';
import TrackyLogo from './TrackyLogo';

export default function LoginScreen({ onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Server warm-up state
  const [serverStatus, setServerStatus] = useState('waking'); // 'waking' | 'ready' | 'offline'
  const [loadingMsg, setLoadingMsg] = useState('Connecting to server...');

  // Ping backend health on mount to pre-warm the Render server
  useEffect(() => {
    let msgTimer;
    const warmUp = async () => {
      // After 3s, update message to show it's a cold start
      msgTimer = setTimeout(() => {
        setLoadingMsg('Server is waking up, please wait...');
      }, 3000);

      try {
        const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(60000) });
        if (res.ok) {
          setServerStatus('ready');
        } else {
          setServerStatus('offline');
        }
      } catch {
        setServerStatus('offline');
      } finally {
        clearTimeout(msgTimer);
      }
    };
    warmUp();
    return () => clearTimeout(msgTimer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const endpoint = isSignUp ? '/auth/signup' : '/auth/login';
      const body = isSignUp
        ? { email, password, business_name: businessName }
        : { email, password };

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async (credentialResponse) => {
    try {
      setLoading(true);
      setError('');

      const res = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Google Login failed');
      }

      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-slate-900 border border-slate-800 focus:border-slate-600 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-600 font-sans transition-all text-sm";
  const iconClass = "absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500";

  const isServerReady = serverStatus === 'ready';

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-dark-card border border-dark-border rounded-3xl p-8 shadow-2xl relative overflow-hidden transition-all duration-300">

        {/* Branding header */}
        <div className="flex flex-col items-center mb-8">
          <TrackyLogo textClassName="text-3xl" color="text-white" lineThickness="h-[2px]" className="mb-2" />
          <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-1.5">Your Workspace Portal</p>
        </div>

        {/* Server status banner */}
        {serverStatus === 'waking' && (
          <div className="p-3.5 bg-amber-950/30 border border-amber-800/30 text-amber-400 rounded-xl text-xs flex items-center space-x-2.5 font-semibold mb-5 animate-pulse">
            <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
            <span>{loadingMsg}</span>
          </div>
        )}

        {serverStatus === 'offline' && (
          <div className="p-3.5 bg-rose-950/30 border border-rose-900/30 text-rose-400 rounded-xl text-xs flex items-center space-x-2.5 font-semibold mb-5">
            <WifiOff className="h-4 w-4 flex-shrink-0" />
            <span>Backend offline. Check your server.</span>
          </div>
        )}

        {serverStatus === 'ready' && (
          <div className="p-3 bg-emerald-950/30 border border-emerald-800/30 text-emerald-400 rounded-xl text-xs flex items-center space-x-2.5 font-semibold mb-5">
            <Wifi className="h-4 w-4 flex-shrink-0" />
            <span>Server connected — ready to sign in</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 bg-rose-950/30 border border-rose-900/30 text-rose-400 rounded-xl text-xs flex items-center space-x-2 font-semibold mb-5">
            <AlertCircle className="h-4.5 w-4.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Business Name (Signup only) */}
          {isSignUp && (
            <div className="relative">
              <User className={iconClass} />
              <input
                type="text"
                placeholder="Business or Tracker Name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          {/* Email */}
          <div className="relative">
            <Mail className={iconClass} />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className={iconClass} />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-white text-black hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-all active:scale-98 shadow-md"
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /><span>AUTHENTICATING...</span></>
              : <><span>{isSignUp ? 'Create Workspace' : 'Sign In'}</span><ArrowRight className="h-4 w-4" /></>
            }
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#0d0d0f] px-2.5 text-slate-500 font-semibold tracking-wider">Or continue with</span>
          </div>
        </div>

        {/* Google Authentication button */}
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleGoogleAuth}
            onError={() => setError('Google Login Failed')}
            theme="filled_black"
            text={isSignUp ? "signup_with" : "signin_with"}
            shape="rectangular"
          />
        </div>

        {/* Switch mode */}
        <p className="text-center text-xs text-slate-500 font-medium mt-6">
          {isSignUp ? 'Already have an account?' : "Don't have a workspace?"}{' '}
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
            className="text-white hover:underline font-bold"
          >
            {isSignUp ? 'Sign In' : 'Create One'}
          </button>
        </p>

      </div>
    </div>
  );
}
