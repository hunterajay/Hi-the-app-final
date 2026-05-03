import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, setDoc, doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function FriendsScreen() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friendships, setFriendships] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    // Listen to friendships where the user is involved
    const q = query(
      collection(db, 'friendships'),
      where('userIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const friendsData: any[] = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        const otherId = data.user1 === user.uid ? data.user2 : data.user1;
        try {
          // get other user's profile
          const userSnap = await getDocs(query(collection(db, 'users'), where('__name__', '==', otherId)));
          if (!userSnap.empty) {
            friendsData.push({
              friendshipId: d.id,
              ...data,
              friend: { id: otherId, ...userSnap.docs[0].data() }
            });
          }
        } catch (err) {
          console.error(err);
        }
      }
      setFriendships(friendsData);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'friendships', { currentUser: user });
    });

    return () => unsubscribe();
  }, [user]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    setLoading(true);

    try {
      const q = query(
        collection(db, 'users'),
        where('username', '==', search.toLowerCase())
      );
      const snapshot = await getDocs(q);
      setSearchResults(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'users', { currentUser: user });
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async (targetId: string) => {
    if (!user) return;
    const minId = user.uid < targetId ? user.uid : targetId;
    const maxId = user.uid < targetId ? targetId : user.uid;
    const fId = `${minId}_${maxId}`;

    try {
      await setDoc(doc(db, 'friendships', fId), {
        userIds: [user.uid, targetId],
        user1: minId,
        user2: maxId,
        status: 'pending',
        initiatorId: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      setSearchResults([]);
      setSearch('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `friendships/${fId}`, { currentUser: user });
    }
  };

  return (
    <div className="pb-32 px-4 pt-8 max-w-md mx-auto">
      <h1 className="font-display text-5xl text-retro-pink mb-8 text-center drop-shadow-[3px_3px_0_#374151]">YOUR PALS</h1>

      <form onSubmit={handleSearch} className="mb-8 flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exact username..."
          className="flex-1 bg-white border-4 border-retro-purple rounded-xl p-3 text-retro-dark placeholder-gray-400 focus:border-retro-pink outline-none font-mono font-bold"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-retro-cyan hover:bg-retro-yellow text-retro-dark font-bold px-6 rounded-xl border-4 border-retro-dark transition-colors shadow-[4px_4px_0_0_#374151]"
        >
          FIND
        </button>
      </form>

      {searchResults.length > 0 && (
        <div className="mb-8 bg-white p-4 rounded-xl border-4 border-retro-cyan shadow-[4px_4px_0_0_#374151]">
          <h2 className="text-retro-dark font-black mb-4">Found Player:</h2>
          {searchResults.map(u => (
            <div key={u.id} className="flex justify-between items-center bg-retro-bg p-3 rounded-xl border-2 border-retro-purple">
              <span className="font-bold">{u.username}</span>
              {u.id !== user?.uid && (
                <button
                  onClick={() => sendRequest(u.id)}
                  className="bg-retro-pink text-retro-dark border-2 border-retro-dark shadow-[2px_2px_0_0_#374151] px-4 py-1 flex items-center justify-center font-bold text-sm rounded-lg hover:bg-retro-yellow transition-all"
                >
                  ADD
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {friendships.map(f => {
          const isPending = f.status === 'pending';
          const iAmInitiator = f.initiatorId === user?.uid;

          return (
            <div key={f.friendshipId} className="bg-white border-4 border-retro-purple shadow-[4px_4px_0_0_#D1C4E9] p-4 rounded-xl flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-full border-4 border-retro-dark flex items-center justify-center font-bold text-xl text-retro-dark"
                  style={{ backgroundColor: f.friend.color }}
                >
                  {f.friend.username.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-lg">{f.friend.displayName}</div>
                  <div className="text-xs font-mono opacity-60">@{f.friend.username}</div>
                </div>
              </div>

              <div>
                {isPending ? (
                  iAmInitiator ? (
                    <span className="text-xs bg-retro-bg border-2 border-retro-dark px-2 py-1 rounded-lg font-bold">SENT</span>
                  ) : (
                    <button
                      onClick={async () => {
                        const { updateDoc } = await import('firebase/firestore');
                        try {
                          await updateDoc(doc(db, 'friendships', f.friendshipId), {
                            status: 'accepted',
                            updatedAt: Date.now()
                          });
                        } catch(err) {
                          handleFirestoreError(err, OperationType.UPDATE, `friendships/${f.friendshipId}`, { currentUser: user });
                        }
                      }}
                      className="bg-retro-pink text-retro-dark border-2 border-retro-dark shadow-[2px_2px_0_0_#374151] text-xs font-bold px-3 py-2 rounded-lg hover:bg-retro-yellow transition-all"
                    >
                      ACCEPT
                    </button>
                  )
                ) : (
                  <span className="text-xs bg-retro-cyan border-2 border-retro-dark px-2 py-1 rounded-lg font-bold">
                    PALS
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
