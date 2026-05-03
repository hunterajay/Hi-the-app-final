import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PowerProvider, usePower } from './contexts/PowerContext';
import AuthScreen from './components/AuthScreen';
import WaveScreen from './components/WaveScreen';
import FriendsScreen from './components/FriendsScreen';
import ByeScreen from './components/ByeScreen';
import { Navigation } from './components/Navigation';
import { useEffect, useState } from 'react';
import { db } from './lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';
import { Power } from 'lucide-react';

function TVContainer({ children }: { children: React.ReactNode }) {
  const { powerState, turnOn } = usePower();

  return (
    <div className="fixed inset-0 bg-black overflow-hidden flex items-center justify-center">
      {/* Power button showing only when off */}
      <div 
        className={`absolute inset-0 flex items-center justify-center z-[10000] transition-opacity duration-300 ${powerState === 'off' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        <button 
          onClick={turnOn}
          className="text-gray-800 hover:text-retro-pink hover:drop-shadow-[0_0_15px_#FFB7B2] transition-all duration-300 transform hover:scale-110 active:scale-95"
        >
          <Power size={120} strokeWidth={2.5} />
        </button>
      </div>
      
      {/* Target wrapper for CRT anim */}
      <div 
        className={`w-full h-full bg-retro-bg overflow-y-auto overflow-x-hidden relative ${
          powerState === 'off' ? 'hidden' : ''
        } ${
          powerState === 'turning-on' ? 'crt-on' : powerState === 'turning-off' ? 'crt-off' : ''
        }`}
      >
        <div className="crt-overlay pointer-events-none mix-blend-overlay"></div>
        {children}
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const [waves, setWaves] = useState<any[]>([]);
  const [byes, setByes] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    
    // Listen to incoming waves that haven't been viewed
    const wavesQ = query(
      collection(db, 'waves'),
      where('toId', '==', user.uid),
      where('viewed', '==', false)
    );

    const unsubWaves = onSnapshot(wavesQ, async (snap) => {
      let incoming: any[] = [];
      for (const d of snap.docs) {
         try {
           const fromUser = await getDoc(doc(db, 'users', d.data().fromId));
           incoming.push({
             id: d.id,
             ...d.data(),
             fromName: fromUser.exists() ? fromUser.data().displayName : 'Someone'
           });
         } catch(e) {}
      }
      setWaves(incoming);
    }, err => handleFirestoreError(err, OperationType.LIST, 'waves', { currentUser: user }));

    // Listen to incoming byes that haven't been viewed
    const byesQ = query(
      collection(db, 'byes'),
      where('toId', '==', user.uid),
      where('viewed', '==', false)
    );

    const unsubByes = onSnapshot(byesQ, async (snap) => {
      let incoming: any[] = [];
      for (const d of snap.docs) {
         try {
           const fromUser = await getDoc(doc(db, 'users', d.data().fromId));
           incoming.push({
             id: d.id,
             ...d.data(),
             fromName: fromUser.exists() ? fromUser.data().displayName : 'Someone'
           });
         } catch(e) {}
      }
      setByes(incoming);
    }, err => handleFirestoreError(err, OperationType.LIST, 'byes', { currentUser: user }));

    return () => {
      unsubWaves();
      unsubByes();
    };
  }, [user]);

  const dismissWave = async (waveId: string) => {
    try {
      await updateDoc(doc(db, 'waves', waveId), {
        viewed: true
      });
      setWaves(prev => prev.filter(w => w.id !== waveId));
    } catch(err) {
      handleFirestoreError(err, OperationType.UPDATE, `waves/${waveId}`, { currentUser: user });
    }
  };

  const dismissBye = async (byeId: string) => {
    try {
      await updateDoc(doc(db, 'byes', byeId), {
        viewed: true
      });
      setByes(prev => prev.filter(b => b.id !== byeId));
    } catch(err) {
      handleFirestoreError(err, OperationType.UPDATE, `byes/${byeId}`, { currentUser: user });
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center font-display text-4xl text-retro-pink drop-shadow-[2px_2px_0_#374151] animate-pulse">LOADING...</div>;
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <>
      {/* Global Wave Notifications */}
      {waves.length > 0 && (
        <div className="fixed top-4 left-4 right-4 z-50 space-y-2">
          {waves.map(w => (
            <div key={w.id} className="bg-white border-4 border-retro-dark text-retro-dark p-4 rounded-2xl shadow-[6px_6px_0_0_#FFB7B2] flex items-center justify-between animate-[bounce_1s_infinite]">
              <div>
                <div className="font-display text-2xl text-retro-pink drop-shadow-[1px_1px_0_#374151]">HI!</div>
                <div className="font-mono text-sm font-bold">
                  {w.fromName} just said hi to you{w.duration ? ` for ${(w.duration / 1000).toFixed(1)}s` : ''}! 👋
                </div>
              </div>
              <button 
                onClick={() => dismissWave(w.id)}
                className="bg-retro-yellow text-retro-dark font-display text-lg px-3 py-2 rounded-xl border-2 border-retro-dark shadow-[2px_2px_0_0_#374151]"
              >
                GOT IT
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Global Bye Notifications */}
      {byes.length > 0 && (
        <div className="fixed top-4 left-4 right-4 z-[60] space-y-2">
          {byes.map(b => (
            <div key={b.id} className="bg-[#1A1A1A] border-4 border-[#D4AF37] text-white p-4 rounded-2xl shadow-[0_0_20px_rgba(212,175,55,0.4)] flex items-center justify-between animate-[pulse_2s_infinite]">
              <div>
                <div className="font-display text-2xl text-[#D4AF37] drop-shadow-[0_0_8px_#D4AF37]">PREMIUM BYE</div>
                <div className="font-mono text-xs text-purple-300 mt-1">
                  {b.fromName} bid you a luxurious farewell. ✌️
                </div>
              </div>
              <button 
                onClick={() => dismissBye(b.id)}
                className="bg-gradient-to-r from-[#D4AF37] to-[#AA8C2C] text-black font-display text-lg px-4 py-2 rounded-xl shadow-[0_0_10px_#D4AF37]"
              >
                ACCEPT
              </button>
            </div>
          ))}
        </div>
      )}

      <Routes>
        <Route path="/" element={<WaveScreen />} />
        <Route path="/friends" element={<FriendsScreen />} />
        <Route path="/bye" element={<ByeScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Navigation />
    </>
  );
}

export default function App() {
  return (
    <PowerProvider>
      <AuthProvider>
        <BrowserRouter>
          <TVContainer>
            <AppRoutes />
          </TVContainer>
        </BrowserRouter>
      </AuthProvider>
    </PowerProvider>
  );
}
