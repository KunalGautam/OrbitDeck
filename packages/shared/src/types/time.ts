export interface TimeControlState {
  mode: 'realtime' | 'simulated';
  isPaused: boolean;
  speedMultiplier: number; // 1, 2, 5, 10, 60, 300, etc.
  timestamp: number; // epoch ms of current simulation/real time
  lastWallClockSync: number;
}

export type TimeControlAction =
  | { type: 'SET_MODE'; payload: 'realtime' | 'simulated' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'SET_SPEED'; payload: number }
  | { type: 'SET_TIME'; payload: number }
  | { type: 'RESET_TO_NOW' };
