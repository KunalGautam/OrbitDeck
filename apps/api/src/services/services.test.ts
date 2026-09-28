import { describe, expect, it } from 'vitest';
import { RadioService } from './radioService.js';
import { TimeController } from './timeController.js';

describe('RadioService & TimeController', () => {
  describe('RadioService', () => {
    const radioService = new RadioService();

    it('should retrieve transponders for ISS (25544) from fallback catalogue', async () => {
      const transponders = await radioService.getTransponders(25544);
      expect(transponders.length).toBeGreaterThan(0);

      const voice = transponders.find((t) => t.id === 'iss-fm-voice');
      expect(voice).toBeDefined();
      expect(voice?.downlinkLowHz).toBe(437800000);
      expect(voice?.uplinkLowHz).toBe(145990000);
    });

    it('should calculate live Doppler shift for satellite closing in (-5 km/s)', () => {
      const transponder = {
        id: 'test',
        noradId: 25544,
        description: 'Test',
        downlinkLowHz: 437800000,
        uplinkLowHz: 145990000,
      };

      const live = radioService.calculateDopplerState(transponder, -5.0);

      // Downlink should be received at higher frequency
      expect(live.downlinkShiftHz).toBeGreaterThan(0);
      expect(live.downlinkCorrectedHz).toBeGreaterThan(437800000);

      // Uplink transmitter must transmit at lower frequency so it shifts up to nominal
      expect(live.uplinkShiftHz).toBeLessThan(0);
      expect(live.uplinkCorrectedHz).toBeLessThan(145990000);
    });
  });

  describe('TimeController', () => {
    it('should handle pause, resume, and speed multipliers', async () => {
      const controller = new TimeController();

      const state0 = controller.getState();
      expect(state0.mode).toBe('realtime');
      expect(state0.isPaused).toBe(false);
      expect(state0.speedMultiplier).toBe(1.0);

      // Pause
      controller.handleAction({ type: 'PAUSE' });
      const statePaused = controller.getState();
      expect(statePaused.isPaused).toBe(true);
      expect(statePaused.mode).toBe('simulated');
      const frozenTime = controller.getCurrentTime();

      // Ensure time does not advance while paused
      await new Promise((r) => setTimeout(r, 50));
      expect(controller.getCurrentTime()).toBe(frozenTime);

      // Set speed multiplier
      controller.handleAction({ type: 'RESUME' });
      controller.handleAction({ type: 'SET_SPEED', payload: 10 });
      expect(controller.getState().speedMultiplier).toBe(10);
      expect(controller.getState().isPaused).toBe(false);

      // Reset to now
      controller.handleAction({ type: 'RESET_TO_NOW' });
      expect(controller.getState().mode).toBe('realtime');
      expect(controller.getState().speedMultiplier).toBe(1.0);
    });
  });
});
