import net from 'net';
import type { HamlibConfig, HamlibStatus } from '@orbitdeck/shared';

export class HamlibService {
  private config: HamlibConfig = {
    enabled: process.env.FEATURE_HAMLIB === 'true',
    rigHost: process.env.HAMLIB_RIG_HOST || 'localhost',
    rigPort: Number(process.env.HAMLIB_RIG_PORT) || 4532,
    rotHost: process.env.HAMLIB_ROT_HOST || 'localhost',
    rotPort: Number(process.env.HAMLIB_ROT_PORT) || 4533,
    updateIntervalMs: 1000,
  };

  private status: HamlibStatus = {
    connectedRig: false,
    connectedRot: false,
    lastUpdated: Date.now(),
  };

  getConfig(): HamlibConfig {
    return { ...this.config };
  }

  getStatus(): HamlibStatus {
    return { ...this.status };
  }

  updateConfig(newConfig: Partial<HamlibConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Sets rotator azimuth and elevation via TCP connection to rotctld.
   * Command format: "P <azimuth> <elevation>\n"
   */
  async setRotatorPosition(azimuthDeg: number, elevationDeg: number): Promise<boolean> {
    if (!this.config.enabled) return false;

    return new Promise((resolve) => {
      const client = new net.Socket();
      client.setTimeout(2000);

      client.connect(this.config.rotPort, this.config.rotHost, () => {
        this.status.connectedRot = true;
        this.status.targetAzimuth = azimuthDeg;
        this.status.targetElevation = elevationDeg;
        // Clamp elevation to [0, 90] for most rotators
        const clampedEl = Math.max(0, elevationDeg);
        client.write(`P ${azimuthDeg.toFixed(1)} ${clampedEl.toFixed(1)}\n`);
      });

      client.on('data', () => {
        client.destroy();
        resolve(true);
      });

      client.on('error', () => {
        this.status.connectedRot = false;
        client.destroy();
        resolve(false);
      });

      client.on('timeout', () => {
        client.destroy();
        resolve(false);
      });
    });
  }

  /**
   * Sets radio frequency in Hz via TCP connection to rigctld.
   * Command format: "F <frequency_hz>\n"
   */
  async setRadioFrequency(frequencyHz: number): Promise<boolean> {
    if (!this.config.enabled) return false;

    return new Promise((resolve) => {
      const client = new net.Socket();
      client.setTimeout(2000);

      client.connect(this.config.rigPort, this.config.rigHost, () => {
        this.status.connectedRig = true;
        this.status.rigFrequencyHz = frequencyHz;
        client.write(`F ${Math.round(frequencyHz)}\n`);
      });

      client.on('data', () => {
        client.destroy();
        resolve(true);
      });

      client.on('error', () => {
        this.status.connectedRig = false;
        client.destroy();
        resolve(false);
      });

      client.on('timeout', () => {
        client.destroy();
        resolve(false);
      });
    });
  }
}
