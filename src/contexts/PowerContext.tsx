import React, { createContext, useContext, useState } from 'react';

type PowerState = 'off' | 'turning-on' | 'on' | 'turning-off';

interface PowerContextType {
  powerState: PowerState;
  turnOn: () => void;
  turnOff: () => void;
}

const PowerContext = createContext<PowerContextType>({
  powerState: 'off',
  turnOn: () => {},
  turnOff: () => {}
});

export function PowerProvider({ children }: { children: React.ReactNode }) {
  const [powerState, setPowerState] = useState<PowerState>('off');

  const turnOn = () => {
    setPowerState('turning-on');
    setTimeout(() => setPowerState('on'), 600);
  };

  const turnOff = () => {
    setPowerState('turning-off');
    setTimeout(() => setPowerState('off'), 600);
  };

  return (
    <PowerContext.Provider value={{ powerState, turnOn, turnOff }}>
      {children}
    </PowerContext.Provider>
  );
}

export const usePower = () => useContext(PowerContext);
