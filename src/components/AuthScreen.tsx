import React, { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = () => {
    setInfoMessage("If you set a recovery email, please contact support to manually reset your password. (A custom backend is needed to automate username-based password resets).");
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setLoading(true);

    const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanUsername) {
      setError("Invalid username. Use letters and numbers.");
      setLoading(false);
      return;
    }
    const fakeEmail = `${cleanUsername}@hiapp.local`;

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, fakeEmail, password);
      } else {
        const { user } = await createUserWithEmailAndPassword(auth, fakeEmail, password);
        
        const colors = ['#FFB7B2', '#B2EBF2', '#FFF9C4', '#D1C4E9'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        try {
          await setDoc(doc(db, 'users', user.uid), {
            username: cleanUsername,
            displayName: username,
            color: randomColor,
            createdAt: Date.now()
          });
        } catch (dbErr) {
          handleFirestoreError(dbErr, OperationType.CREATE, 'users', auth);
          throw dbErr; // stop execution if first fails
        }

        try {
          await setDoc(doc(db, 'users', user.uid, 'private', 'info'), {
            email: fakeEmail,
            ...(recoveryEmail ? { recoveryEmail } : {})
          });
        } catch (dbErr) {
          handleFirestoreError(dbErr, OperationType.CREATE, 'users/private/info', auth);
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Username is already taken!');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('DEV ERROR: Please enable "Email/Password" in Firebase Console > Authentication > Sign-in method.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your connection or disable ad-blockers.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Incorrect username or password.');
      } else {
        try {
          const parsed = JSON.parse(err.message);
          setError(`DB Error: ${parsed.error} on ${parsed.operationType}`);
        } catch {
          setError(err.message);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl border-4 border-retro-dark w-full max-w-sm shadow-[8px_8px_0_0_#374151]">
        <h1 className="font-display text-5xl text-center mb-8 text-retro-pink filter drop-shadow-[3px_3px_0_#374151]">
          HI THE APP
        </h1>
        
        {error && (
          <div className="bg-red-100 border-2 border-red-400 text-red-600 p-3 rounded-xl mb-6 text-sm font-bold">
            {error}
          </div>
        )}
        
        {infoMessage && (
          <div className="bg-blue-100 border-2 border-blue-400 text-blue-600 p-3 rounded-xl mb-6 text-sm font-bold">
            {infoMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-retro-dark font-bold mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              maxLength={30}
              className="w-full bg-retro-bg border-4 border-retro-purple rounded-xl p-3 text-retro-dark focus:outline-none focus:border-retro-pink transition-colors font-mono font-bold"
              placeholder="cool_kid_88"
            />
          </div>
          
          <div>
            <label className="block text-retro-dark font-bold mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-retro-bg border-4 border-retro-purple rounded-xl p-3 text-retro-dark focus:outline-none focus:border-retro-pink transition-colors font-mono font-bold"
              placeholder="••••••••"
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-retro-dark font-bold mb-1">Recovery Email (Optional)</label>
              <input
                type="email"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                className="w-full bg-retro-bg border-4 border-retro-purple rounded-xl p-3 text-retro-dark focus:outline-none focus:border-retro-pink transition-colors font-mono font-bold"
                placeholder="you@example.com"
              />
              <p className="text-xs font-mono mt-1 text-gray-500">Only used if you lose your password.</p>
            </div>
          )}

          {isLogin && (
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm text-retro-pink hover:text-retro-dark font-bold underline transition-colors"
            >
              Forgot Password?
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-retro-cyan hover:bg-retro-yellow text-retro-dark font-display text-2xl py-3 rounded-xl border-4 border-retro-dark transition-all transform hover:-translate-y-1 shadow-[4px_4px_0_0_#374151] mt-6"
          >
            {loading ? 'WAIT...' : isLogin ? 'LOG IN' : 'SIGN UP'}
          </button>
        </form>

        <button
          onClick={() => setIsLogin(!isLogin)}
          className="w-full text-center mt-6 text-retro-dark hover:text-retro-pink font-bold transition-colors"
        >
          {isLogin ? 'Need an account? Sign up!' : 'Already playin? Log in!'}
        </button>
      </div>
    </div>
  );
}
