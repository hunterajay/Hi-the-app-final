import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, getDoc, doc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { motion, AnimatePresence } from 'motion/react';

export default function ByeScreen() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [byesThisMonth, setByesThisMonth] = useState(0);
  const [eligableFriends, setEligableFriends] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [curtainsOpen, setCurtainsOpen] = useState(false);

  const BYE_LIMIT = 7;

  useEffect(() => {
    if (!loading) {
      // Open curtains slightly after loading finishes
      const timer = setTimeout(() => setCurtainsOpen(true), 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  useEffect(() => {
    if (!user) return;

    const fetchPremiumData = async () => {
      try {
        setLoading(true);

        // 1. Fetch user's friends
        const q = query(
          collection(db, 'friendships'),
          where('userIds', 'array-contains', user.uid),
          where('status', '==', 'accepted')
        );

        const snap = await getDocs(q);
        const friendIds = snap.docs.map(d => {
          const data = d.data();
          return data.user1 === user.uid ? data.user2 : data.user1;
        });

        const friendsData = [];
        for (const fId of friendIds) {
           const fDoc = await getDoc(doc(db, 'users', fId));
           if (fDoc.exists()) {
             friendsData.push({ id: fId, ...fDoc.data() });
           }
        }

        // 2. Determine eligible friends (we must have waved at them at least once)
        const eligible = [];
        // We have to check if there is a wave from us to them
        // In a real app we might optimize this, but here we can check for each friend
        for (const f of friendsData) {
          const waveQ = query(
            collection(db, 'waves'),
            where('fromId', '==', user.uid),
            where('toId', '==', f.id)
          );
          const waveSnap = await getDocs(waveQ);
          if (!waveSnap.empty) {
            eligible.push(f);
          }
        }
        setEligableFriends(eligible);

        // 3. Check Byes quota for this month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        
        const byesQ = query(
          collection(db, 'byes'),
          where('fromId', '==', user.uid),
          where('createdAt', '>=', startOfMonth)
        );
        const byesSnap = await getDocs(byesQ);
        setByesThisMonth(byesSnap.size);

      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'premium_data', { currentUser: user });
        setErrorMsg('Failed to load premium data.');
      } finally {
        setLoading(false);
      }
    };

    fetchPremiumData();
  }, [user]);

  const handleSendBye = async (friendId: string) => {
    if (byesThisMonth >= BYE_LIMIT) {
      setErrorMsg('Monthly quota exceeded.');
      return;
    }
    try {
      await addDoc(collection(db, 'byes'), {
        fromId: user!.uid,
        toId: friendId,
        createdAt: Date.now(),
        viewed: false
      });
      setByesThisMonth(prev => prev + 1);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'byes', { currentUser: user });
      setErrorMsg('Failed to send bye.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] overflow-hidden relative">
      <AnimatePresence>
        {!curtainsOpen && (
          <motion.div
            key="curtains"
            exit={{ opacity: 0, transition: { duration: 1.5, delay: 0.5 } }}
            className="fixed inset-0 z-[100] pointer-events-none flex"
          >
            {/* Left Curtain */}
            <motion.div
              initial={{ x: '0%' }}
              exit={{ x: '-100%' }}
              transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
              className="w-1/2 h-full border-r-[12px] border-[#D4AF37] shadow-[20px_0_50px_rgba(0,0,0,0.8)] relative"
              style={{
                background: 'linear-gradient(90deg, #1A0D23 0%, #351C4D 20%, #2A143D 40%, #4A236B 60%, #351C4D 80%, #2A143D 100%)',
                backgroundSize: '40px 100%'
              }}
            >
              {/* Velvet folds overlay */}
              <div className="absolute inset-0 opacity-30 bg-[repeating-linear-gradient(90deg,transparent,rgba(0,0,0,0.4)_10px,transparent_20px)]"></div>
            </motion.div>

            {/* Right Curtain */}
            <motion.div
               initial={{ x: '0%' }}
               exit={{ x: '100%' }}
               transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
               className="w-1/2 h-full border-l-[12px] border-[#D4AF37] shadow-[-20px_0_50px_rgba(0,0,0,0.8)] relative"
               style={{
                background: 'linear-gradient(90deg, #2A143D 0%, #351C4D 20%, #4A236B 40%, #2A143D 60%, #351C4D 80%, #1A0D23 100%)',
                backgroundSize: '40px 100%'
               }}
            >
              {/* Velvet folds overlay */}
              <div className="absolute inset-0 opacity-30 bg-[repeating-linear-gradient(90deg,transparent,rgba(0,0,0,0.4)_10px,transparent_20px)]"></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pb-32 px-4 pt-8 text-white relative z-0">
        <div className="max-w-md mx-auto">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={curtainsOpen ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="font-display text-5xl mb-2 text-center text-[#D4AF37] tracking-widest drop-shadow-[0_0_15px_rgba(212,175,55,0.6)]"
          >
            THE BYE LOUNGE
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={curtainsOpen ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="text-center mb-8 font-mono text-purple-400 text-sm tracking-wide"
          >
            PREMIUM FAREWELLS. LUXURY EXITS.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={curtainsOpen ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.8, delay: 1 }}
            className="bg-[#1A1A1A] rounded-3xl p-6 border-2 border-[#D4AF37] mb-8 relative shadow-[0_0_20px_#D4AF3740]"
          >
            <div className="absolute top-0 right-0 bg-[#D4AF37] text-black px-4 py-1 font-mono text-sm font-bold rounded-bl-xl rounded-tr-3xl">QUOTA</div>
            
            <div className="flex flex-col items-center justify-center py-4">
              <div className="font-display text-6xl text-[#D4AF37] drop-shadow-[0_0_10px_#D4AF37]">
                {BYE_LIMIT - byesThisMonth}
              </div>
              <div className="font-mono text-purple-300 mt-2 text-sm">BYES REMAINING THIS MONTH</div>
            </div>
            
            {errorMsg && (
              <div className="mt-4 text-red-400 border border-red-500 bg-red-900/30 p-3 rounded-lg font-mono text-sm text-center">
                {errorMsg}
              </div>
            )}
          </motion.div>

          <motion.h2 
            initial={{ opacity: 0, x: -20 }}
            animate={curtainsOpen ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
            transition={{ duration: 0.8, delay: 1.2 }}
            className="font-display text-2xl mb-4 text-purple-300 ml-2"
          >
            ELIGIBLE TARGETS
          </motion.h2>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={curtainsOpen ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.8, delay: 1.4 }}
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="font-display text-4xl text-[#D4AF37] animate-pulse drop-shadow-[0_0_15px_#D4AF37]">LOADING...</div>
              </div>
            ) : eligableFriends.length === 0 ? (
              <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-purple-900 border-opacity-50 text-center font-mono text-gray-400">
                You haven't said hi to anyone yet. Say hi first to unlock our luxury farewells.
              </div>
            ) : (
              eligableFriends.map(f => (
                <div 
                  key={f.id}
                  className="bg-[#1A1A1A] border border-purple-800 p-4 mb-4 rounded-2xl flex items-center justify-between transition-all hover:border-[#D4AF37] hover:shadow-[0_0_15px_rgba(212,175,55,0.2)]"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-full border-2 border-[#D4AF37] flex items-center justify-center font-bold text-lg text-black bg-[#D4AF37]"
                    >
                      {f.displayName.substring(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-display text-xl text-gray-200">{f.displayName}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSendBye(f.id)}
                    disabled={byesThisMonth >= BYE_LIMIT}
                    className={`font-display text-lg px-6 py-2 rounded-xl border-2 transition-all shadow-[0_0_10px_rgba(0,0,0,0.5)] ${
                      byesThisMonth >= BYE_LIMIT 
                      ? 'border-gray-700 text-gray-600 bg-[#111] cursor-not-allowed' 
                      : 'border-[#D4AF37] text-black bg-gradient-to-r from-[#D4AF37] to-[#AA8C2C] hover:scale-105 active:scale-95 hover:shadow-[0_0_15px_#D4AF37]'
                    }`}
                  >
                    BYE
                  </button>
                </div>
              ))
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
