'use client';

import { useEffect } from 'react';
import { useMapStore } from '@/stores/useMapStore';

const LOW_BATTERY_THRESHOLD = 0.2;

declare global {
  interface Navigator {
    getBattery?: () => Promise<BatteryManager>;
  }
  interface BatteryManager extends EventTarget {
    level: number;
    charging: boolean;
  }
}

export function useBatteryEco() {
  const ecoMode = useMapStore((s) => s.ecoMode);
  const toggleEcoMode = useMapStore((s) => s.toggleEcoMode);

  useEffect(() => {
    if (!navigator.getBattery) return;

    let battery: BatteryManager | null = null;

    function handleLevelChange() {
      if (!battery) return;
      const isLow = !battery.charging && battery.level < LOW_BATTERY_THRESHOLD;
      const currentEco = useMapStore.getState().ecoMode;
      if (isLow && !currentEco) toggleEcoMode();
    }

    navigator.getBattery().then((b) => {
      battery = b;
      handleLevelChange();
      b.addEventListener('levelchange', handleLevelChange);
      b.addEventListener('chargingchange', handleLevelChange);
    });

    return () => {
      if (battery) {
        battery.removeEventListener('levelchange', handleLevelChange);
        battery.removeEventListener('chargingchange', handleLevelChange);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  void ecoMode;
}
