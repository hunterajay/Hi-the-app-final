import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDocs, collection, query, where, onSnapshot, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { calculateBearing, calculateDistance, isPointingAt } from '../lib/geo';
import { Compass as CompassIcon, Navigation as NavIcon } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function CompassWave() {
  const { user } = useAuth();
  const [heading, setHeading] = useState<number | null>(null);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [started, setStarted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  // Track location in db
  useEffect(() => {
    if (!user || !location) return;
    const interval = setInterval(() => {
      setDoc(doc(db, 'locations', user.uid), {
        lat: location.lat,
        lng: location.lng,
        heading: heading,
        updatedAt: Date.now()
      }).catch(err => {
         console.warn("Location update failed", err);
      });
    }, 10000); // update every 10 secs
    
    // initial set
    setDoc(doc(db, 'locations', user.uid), {
        lat: location.lat,
        lng: location.lng,
        heading: heading,
        updatedAt: Date.now()
    }).catch(err => console.warn(err));
    
    return () => clearInterval(interval);
  }, [location, user, heading]);

  // Load accepted friends
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'friendships'),
      where('userIds', 'array-contains', user.uid),
      where('status', '==', 'accepted')
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      let friendsList: any[] = [];
      for (const d of snap.docs) {
        const fId = d.data().user1 === user.uid ? d.data().user2 : d.data().user1;
        
        try {
          const uSnap = await getDocs(query(collection(db, 'users'), where('__name__', '==', fId)));
          if (!uSnap.empty) {
             friendsList.push({
               id: fId,
               ...uSnap.docs[0].data(),
               lat: null,
               lng: null,
               lastUpdated: 0
             });
          }
        } catch(e) { }
      }
      setFriends(friendsList);
    }, err => {
       handleFirestoreError(err, OperationType.LIST, 'friendships', { currentUser: user });
    });

    return () => unsubscribe();
  }, [user]);

  // Listen to friends' locations
  useEffect(() => {
    if (!user || friends.length === 0) return;
    
    const unsubs = friends.map(f => {
      return onSnapshot(doc(db, 'locations', f.id), (docSnap) => {
        if (docSnap.exists()) {
          const locData = docSnap.data();
          setFriends(prev => prev.map(p => p.id === f.id ? { ...p, lat: locData.lat, lng: locData.lng, lastUpdated: locData.updatedAt } : p));
        }
      }, err => {
        // Ignored. some friends might not have location data yet
      });
    });

    return () => unsubs.forEach(un => un());
  }, [user, friends.length]);


  const startSensors = async () => {
    setErrorMsg('');
    
    // 1. Geolocation
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          setErrorMsg('Location blocked or unavailable.');
        },
        { enableHighAccuracy: true, maximumAge: 0 }
      );
    } else {
      setErrorMsg('Geolocation not supported');
    }

    // 2. Device Orientation
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation);
          setStarted(true);
        } else {
          setErrorMsg('Compass permission denied. Try opening in a new tab.');
        }
      } catch (e) {
        setErrorMsg('Error requesting compass permission. Try opening in a new tab.');
      }
    } else {
      // Non-iOS 13+ devices
      window.addEventListener('deviceorientationabsolute', handleOrientation);
      window.addEventListener('deviceorientation', handleOrientation);
      setStarted(true);
    }
    
    // 3. Device Motion
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const motionPerm = await (DeviceMotionEvent as any).requestPermission();
        if (motionPerm === 'granted') {
          window.addEventListener('devicemotion', handleMotion);
        }
      } catch (e) {
        console.error('Motion permission error', e);
      }
    } else {
      window.addEventListener('devicemotion', handleMotion);
    }
  };

  const [isGyroFrozen, setIsGyroFrozen] = useState(false);
  const isGyroFrozenRef = React.useRef(false);
  useEffect(() => { isGyroFrozenRef.current = isGyroFrozen; }, [isGyroFrozen]);

  const handleOrientation = (event: any) => {
    if (isGyroFrozenRef.current) return; // Stop gyroscope updates when frozen
    let _heading = null;
    if (event.webkitCompassHeading) {
      _heading = event.webkitCompassHeading;
    } else if (event.type === 'deviceorientationabsolute' && event.alpha !== null) {
      _heading = 360 - event.alpha;
    } else if (event.type === 'deviceorientation' && event.absolute === true && event.alpha !== null) {
      _heading = 360 - event.alpha;
    } else if (event.type === 'deviceorientation' && event.alpha !== null && !event.absolute) {
      if (!(window as any).hasAbsoluteOrientation) {
        _heading = 360 - event.alpha; // Fallback to relative if absolute isn't firing
      }
    }
    
    if (event.type === 'deviceorientationabsolute' || (event.type === 'deviceorientation' && event.absolute === true)) {
       (window as any).hasAbsoluteOrientation = true;
    }

    if (_heading !== null) {
      setHeading(Math.round(_heading));
    }
  };

  const [wavingFriendId, setWavingFriendId] = useState<string | null>(null);
  const [waveStartTime, setWaveStartTime] = useState<number | null>(null);
  const [currentDuration, setCurrentDuration] = useState<number>(0);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);

  const isLockedOnRef = React.useRef(false);
  const wavingFriendIdRef = React.useRef<string | null>(null);
  const selectedFriendIdRef = React.useRef<string | null>(null);

  useEffect(() => { wavingFriendIdRef.current = wavingFriendId; }, [wavingFriendId]);
  useEffect(() => { selectedFriendIdRef.current = selectedFriendId; }, [selectedFriendId]);

  const handleMotion = (event: DeviceMotionEvent) => {
    if (!isLockedOnRef.current || wavingFriendIdRef.current || !selectedFriendIdRef.current) return;

    const acc = event.acceleration || event.accelerationIncludingGravity;
    if (acc) {
      // Need to discount gravity if accelerationIncludingGravity is used, but for a shake threshold
      // 12 for acceleration (without gravity) or around 20 with gravity is a good heuristic.
      const mag = Math.sqrt((acc.x || 0)**2 + (acc.y || 0)**2 + (acc.z || 0)**2);
      // Let's use > 15 as it handles both adequately for a shake
      if (mag > 15) { 
        setWavingFriendId(selectedFriendIdRef.current);
        setWaveStartTime(Date.now());
      }
    }
  };


  useEffect(() => {
    let interval: any;
    if (wavingFriendId && waveStartTime) {
      interval = setInterval(() => {
        setCurrentDuration(Date.now() - waveStartTime);
      }, 50);
    } else {
      setCurrentDuration(0);
    }
    return () => clearInterval(interval);
  }, [wavingFriendId, waveStartTime]);

  const handlePointerUp = async () => {
    if (wavingFriendId && waveStartTime && user) {
      const duration = Date.now() - waveStartTime;
      if (duration > 200) { // minimum duration to send
        try {
          await setDoc(doc(db, 'waves', `${user.uid}_${Date.now()}`), {
            fromId: user.uid,
            toId: wavingFriendId,
            createdAt: Date.now(),
            viewed: false,
            duration: duration
          });
        } catch(err) {
          handleFirestoreError(err, OperationType.CREATE, 'waves', { currentUser: user });
        }
      }
    }
    setWavingFriendId(null);
    setWaveStartTime(null);
    setIsGyroFrozen(false);
  };

  const selectedFriend = React.useMemo(() => {
    if (!friends || !location || !selectedFriendId) return null;
    const f = friends.find(f => f.id === selectedFriendId);
    if (f && f.lat && f.lng) {
      return { ...f, bearing: calculateBearing(location.lat, location.lng, f.lat, f.lng) };
    }
    return null;
  }, [friends, location, selectedFriendId]);

  const targetAngle = selectedFriend ? selectedFriend.bearing - (heading || 0) : - (heading || 0);
  const isLockedOn = selectedFriend && heading !== null ? isPointingAt(heading, selectedFriend.bearing, 30) : false;

  useEffect(() => {
    isLockedOnRef.current = isLockedOn;
    if (isLockedOn && !isGyroFrozen) {
      setIsGyroFrozen(true);
    }
  }, [isLockedOn, isGyroFrozen]);

  if (!started) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <CompassIcon size={80} className="text-retro-pink mb-8 drop-shadow-[0_0_8px_rgba(255,183,178,0.8)] animate-pulse" />
        <h1 className="font-display text-5xl mb-4 text-center text-retro-dark drop-shadow-[2px_2px_0_#B2EBF2]">READY TO SAY HI?</h1>
        <p className="text-center mb-8 px-4 font-mono font-bold text-gray-500">
          We need access to your compass and GPS to point you at your friends. If it fails, open this app in a new tab!
        </p>
        {errorMsg && <div className="text-red-600 mb-4 font-bold border-2 border-red-400 p-3 rounded-xl bg-red-100">{errorMsg}</div>}
        <button 
          onClick={startSensors}
          className="bg-retro-yellow text-retro-dark font-display text-3xl py-4 px-10 rounded-full border-4 border-retro-dark transition-all transform hover:scale-105 shadow-[6px_6px_0_0_#374151]"
        >
          START COMPASS
        </button>
      </div>
    );
  }

  return (
    <div className="pb-32 px-4 pt-8 max-w-md mx-auto">
      <div className={`bg-white rounded-3xl p-6 border-4 mb-8 relative flex flex-col items-center transition-all ${
        isLockedOn ? 'border-retro-pink shadow-[8px_8px_0_0_#FFB7B2]' : 'border-retro-dark shadow-[8px_8px_0_0_#B2EBF2]'
      }`}>
        <div className={`absolute top-0 right-[-4px] border-b-4 border-l-4 border-retro-dark px-3 py-1 font-mono text-xs font-bold rounded-bl-xl text-retro-dark z-20 ${
          isLockedOn ? 'bg-retro-yellow' : 'bg-retro-pink'
        }`}>
          {isLockedOn ? 'LOCKED ON!' : 'RADAR ACTIVE'}
        </div>
        
        <div className={`relative w-48 h-48 flex items-center justify-center rounded-full border-4 border-retro-dark shadow-inner mt-4 transition-colors ${
          isLockedOn ? 'bg-retro-yellow' : 'bg-retro-bg'
        }`}>
           {selectedFriend ? (
             <svg 
               viewBox="0 0 100 100" 
               className="w-32 h-32 transition-transform duration-300 filter drop-shadow-lg z-10"
               style={{ transform: `rotate(${targetAngle}deg)` }}
             >
               {/* Just a big red arrow pointing at target */}
               <path d="M50 10 L80 90 L50 75 L20 90 Z" fill={isLockedOn ? "#ffb7b2" : "#ef4444"} stroke="#374151" strokeWidth="4" strokeLinejoin="round" />
             </svg>
           ) : (
             <div className="font-mono text-gray-400 font-bold text-center p-4 text-sm animate-pulse">SELECT <br/> A TARGET</div>
           )}
        </div>

        <div className="mt-6 font-mono font-bold text-sm text-center bg-white px-4 py-2 rounded-xl border-4 border-retro-purple z-10 w-full relative">
            {selectedFriend && heading !== null ? `TARGET: ${selectedFriend.displayName.toUpperCase()}` : (heading !== null ? `HEADING: ${heading}°` : 'CALIBRATING...')}
        </div>
      </div>

      <h2 className="font-display text-3xl text-retro-dark mb-4 ml-2 drop-shadow-[2px_2px_0_#FFF9C4]">TARGETS</h2>
      
      <div className="space-y-4">
        {friends.length === 0 && (
          <div className="text-center font-mono font-bold text-gray-400 p-8">No friends acquired yet. Head to PALS to add someone.</div>
        )}

        {friends.map(f => {
          if (!location || !f.lat || !f.lng) return (
             <div key={f.id} className="bg-white border-2 border-gray-200 p-4 rounded-2xl flex items-center gap-3">
               <div className="w-14 h-14 rounded-full bg-gray-200 border-2 border-gray-300"></div>
               <div>
                  <div className="font-bold text-xl text-gray-400">{f.displayName}</div>
                  <div className="text-xs font-mono text-gray-400">Location unknown...</div>
               </div>
             </div>
          );

          const bearing = calculateBearing(location.lat, location.lng, f.lat, f.lng);
          const distance = calculateDistance(location.lat, location.lng, f.lat, f.lng);
          const isSelected = selectedFriendId === f.id;
          const isPointing = heading !== null ? isPointingAt(heading, bearing, 30) : false;
          
          return (
            <div 
              key={f.id} 
              onClick={(e) => {
                if ((e.target as HTMLElement).tagName !== 'BUTTON') {
                  const newSelection = isSelected ? null : f.id;
                  setSelectedFriendId(newSelection);
                  if (!newSelection) setIsGyroFrozen(false);
                }
              }}
              className={`border-4 p-4 mb-4 rounded-2xl flex items-center justify-between transition-all duration-300 cursor-pointer ${
                isSelected ? 'border-retro-dark bg-retro-purple/20' : 'bg-white border-retro-purple hover:bg-gray-50'
              } ${
                isSelected && isPointing ? 'bg-retro-yellow shadow-[4px_4px_0_0_#374151] scale-[1.02]' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                 <div 
                  className={`w-14 h-14 rounded-full border-4 flex items-center justify-center font-bold text-xl text-retro-dark ${
                    isSelected ? 'border-retro-dark' : 'border-retro-purple'
                  }`}
                  style={{ backgroundColor: f.color }}
                >
                  {f.username.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-xl text-retro-dark">{f.displayName}</div>
                  <div className="text-xs font-mono font-bold text-gray-500 flex items-center gap-1">
                    <NavIcon size={12} className={isSelected && isPointing ? "text-retro-dark" : "text-gray-400"} style={{ transform: `rotate(${bearing - (heading || 0)}deg)` }} />
                    {distance < 1 ? '<1 km' : `${Math.round(distance)} km`} away
                  </div>
                </div>
              </div>

              {isSelected && isPointing && (
                <button
                  disabled={wavingFriendId !== f.id}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePointerUp(); }}
                  className={`font-display text-lg w-40 px-4 py-2 rounded-xl border-4 border-retro-dark transition-all select-none ${
                    wavingFriendId === f.id ? 'bg-retro-cyan shadow-[2px_2px_0_0_#374151] hover:scale-105 active:scale-95' : 'bg-gray-300 text-gray-500 opacity-70 border-gray-400'
                  }`}
                >
                  {wavingFriendId === f.id ? `END: ${(currentDuration / 1000).toFixed(1)}s` : 'SHAKE TO SAY HI'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
