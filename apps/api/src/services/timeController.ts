import type { TimeControlAction, TimeControlState } from '@orbitdeck/shared';

export class TimeController {
  private mode: 'realtime' | 'simulated' = 'realtime';
  private isPaused: boolean = false;
  private speedMultiplier: number = 1.0;
  private simulatedTime: number = Date.now();
  private lastWallClockSync: number = Date.now();

  /**
   * Returns current time in epoch ms, accounting for real-time or simulated clock and speed multiplier.
   */
  getCurrentTime(): number {
    if (this.mode === 'realtime') {
      return Date.now();
    }

    if (this.isPaused) {
      return this.simulatedTime;
    }

    const elapsedWallMs = Date.now() - this.lastWallClockSync;
    return this.simulatedTime + elapsedWallMs * this.speedMultiplier;
  }

  getState(): TimeControlState {
    return {
      mode: this.mode,
      isPaused: this.isPaused,
      speedMultiplier: this.speedMultiplier,
      timestamp: this.getCurrentTime(),
      lastWallClockSync: this.lastWallClockSync,
    };
  }

  handleAction(action: TimeControlAction): TimeControlState {
    const currentSimTime = this.getCurrentTime();

    switch (action.type) {
      case 'SET_MODE':
        this.mode = action.payload;
        if (action.payload === 'simulated') {
          this.simulatedTime = currentSimTime;
          this.lastWallClockSync = Date.now();
        }
        break;

      case 'PAUSE':
        this.simulatedTime = currentSimTime;
        this.lastWallClockSync = Date.now();
        this.isPaused = true;
        this.mode = 'simulated';
        break;

      case 'RESUME':
        this.lastWallClockSync = Date.now();
        this.isPaused = false;
        break;

      case 'SET_SPEED':
        this.simulatedTime = currentSimTime;
        this.lastWallClockSync = Date.now();
        this.speedMultiplier = Math.max(0.1, Math.min(3600, action.payload));
        if (this.speedMultiplier !== 1.0) {
          this.mode = 'simulated';
        }
        break;

      case 'SET_TIME':
        this.simulatedTime = action.payload;
        this.lastWallClockSync = Date.now();
        this.mode = 'simulated';
        break;

      case 'RESET_TO_NOW':
        this.mode = 'realtime';
        this.isPaused = false;
        this.speedMultiplier = 1.0;
        this.simulatedTime = Date.now();
        this.lastWallClockSync = Date.now();
        break;
    }

    return this.getState();
  }
}
