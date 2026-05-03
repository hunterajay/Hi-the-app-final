import { Compass, Users, LogOut, Power } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { usePower } from '../contexts/PowerContext';

export function Navigation() {
  const { turnOff } = usePower();

  return (
    <nav className="fixed bottom-0 left-0 right-0 p-4 pb-6 bg-white border-t-4 border-retro-dark z-50">
      <div className="max-w-md mx-auto flex justify-around items-center">
        <NavLink
          to="/"
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center p-2 rounded-xl transition-all",
              isActive ? "text-retro-pink scale-110 drop-shadow-[2px_2px_0_#374151]" : "text-gray-400 hover:text-retro-dark"
            )
          }
        >
          <Compass size={28} strokeWidth={2.5} />
          <span className="text-xs font-display mt-1">HI</span>
        </NavLink>
        
        <NavLink
          to="/friends"
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center p-2 rounded-xl transition-all",
              isActive ? "text-retro-cyan scale-110 drop-shadow-[2px_2px_0_#374151]" : "text-gray-400 hover:text-retro-dark"
            )
          }
        >
          <Users size={28} strokeWidth={2.5} />
          <span className="text-xs font-display mt-1">PALS</span>
        </NavLink>

        <NavLink
          to="/bye"
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center p-2 rounded-xl transition-all",
              isActive ? "text-yellow-500 scale-110 drop-shadow-[2px_2px_0_#374151]" : "text-gray-400 hover:text-yellow-600"
            )
          }
        >
          <span className="font-display text-2xl leading-none">✌️</span>
          <span className="text-xs font-display mt-1 tracking-widest text-[#D4AF37]">BYE</span>
        </NavLink>
        
        <button
          onClick={() => auth.signOut()}
          className="flex flex-col items-center p-2 text-gray-400 hover:text-red-400 transition-all rounded-xl"
          title="Sign Out"
        >
          <LogOut size={28} strokeWidth={2.5} />
          <span className="text-xs font-display mt-1">BAIL</span>
        </button>

        <button
          onClick={turnOff}
          className="flex flex-col items-center p-2 text-gray-400 hover:text-retro-dark transition-all rounded-xl"
          title="Power Off"
        >
          <Power size={28} strokeWidth={2.5} />
          <span className="text-xs font-display mt-1">OFF</span>
        </button>
      </div>
    </nav>
  );
}
