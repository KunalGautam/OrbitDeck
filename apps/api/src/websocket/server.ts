import type { Server as HttpServer } from 'http';
import type {
  CelestialPosition,
  GroundStation,
  LiveTrackingFrame,
  Satellite,
  TimeControlAction,
} from '@orbitdeck/shared';
import { WebSocket, WebSocketServer } from 'ws';
import type { ISatelliteRepository } from '../db/repositories/satelliteRepository.js';
import type { IGroundStationRepository } from '../db/repositories/stationRepository.js';
import type { PropagationService } from '../services/propagationService.js';
import type { TimeController } from '../services/timeController.js';

interface ClientSession {
  ws: WebSocket;
  subscribedNoradIds: Set<number>;
  stationId?: string;
  isAlive: boolean;
}

export interface WsServerOptions {
  updateIntervalMs?: number;
}

export class OrbitDeckWebSocketServer {
  private wss: WebSocketServer | null = null;
  private readonly clients = new Map<WebSocket, ClientSession>();
  private intervalTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly satRepo: ISatelliteRepository,
    private readonly stationRepo: IGroundStationRepository,
    private readonly propService: PropagationService,
    private readonly timeController: TimeController,
    private readonly options: WsServerOptions = {},
  ) {}

  attach(server: HttpServer): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', async (ws: WebSocket) => {
      const defaultStation = await this.stationRepo.findDefault();
      const session: ClientSession = {
        ws,
        subscribedNoradIds: new Set<number>(),
        stationId: defaultStation?.id,
        isAlive: true,
      };

      this.clients.set(ws, session);

      // Send initial hello with time state and default station
      const timeState = this.timeController.getState();
      ws.send(
        JSON.stringify({
          type: 'CONNECTED',
          timeState,
          defaultStationId: defaultStation?.id,
        }),
      );

      ws.on('pong', () => {
        session.isAlive = true;
      });

      ws.on('message', async (raw: string) => {
        try {
          const msg = JSON.parse(raw.toString());
          await this.handleClientMessage(session, msg);
        } catch {
          // ignore invalid message
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });

    this.startHeartbeat();
    this.startBroadcastLoop();
  }

  private async handleClientMessage(session: ClientSession, msg: any): Promise<void> {
    switch (msg.type) {
      case 'SUBSCRIBE':
        if (Array.isArray(msg.noradIds)) {
          session.subscribedNoradIds = new Set(msg.noradIds);
        }
        break;

      case 'SET_STATION':
        if (typeof msg.stationId === 'string') {
          session.stationId = msg.stationId;
        }
        break;

      case 'TIME_CONTROL':
        if (msg.action) {
          const newState = this.timeController.handleAction(msg.action as TimeControlAction);
          this.broadcastAll({
            type: 'TIME_STATE_CHANGED',
            timeState: newState,
          });
        }
        break;

      case 'PING':
        session.ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        break;
    }
  }

  private startHeartbeat(): void {
    this.pingTimer = setInterval(() => {
      for (const [ws, session] of this.clients.entries()) {
        if (!session.isAlive) {
          ws.terminate();
          this.clients.delete(ws);
          continue;
        }
        session.isAlive = false;
        ws.ping();
      }
    }, 30000);
  }

  private startBroadcastLoop(): void {
    const intervalMs = this.options.updateIntervalMs ?? 1000;

    this.intervalTimer = setInterval(async () => {
      if (this.clients.size === 0) return;

      const currentTime = this.timeController.getCurrentTime();
      const timeState = this.timeController.getState();

      // Collect all NORAD IDs subscribed across clients
      const allSubscribedIds = new Set<number>();
      for (const session of this.clients.values()) {
        if (session.subscribedNoradIds.size > 0) {
          for (const id of session.subscribedNoradIds) {
            allSubscribedIds.add(id);
          }
        }
      }

      // If no explicit subscriptions, track all active satellites
      let satellites: Satellite[] = [];
      if (allSubscribedIds.size === 0) {
        satellites = await this.satRepo.getAllActive();
      } else {
        const satPromises = Array.from(allSubscribedIds).map((id) => this.satRepo.findById(id));
        const resolved = await Promise.all(satPromises);
        satellites = resolved.filter((s): s is Satellite => s !== null);
      }

      if (satellites.length === 0) return;

      // Group clients by their observer station to minimize propagation look angles overhead
      const clientsByStation = new Map<string, ClientSession[]>();
      for (const session of this.clients.values()) {
        const stId = session.stationId || 'none';
        const list = clientsByStation.get(stId) || [];
        list.push(session);
        clientsByStation.set(stId, list);
      }

      for (const [stationId, sessions] of clientsByStation.entries()) {
        let station: GroundStation | null = null;
        if (stationId !== 'none') {
          station = await this.stationRepo.findById(stationId);
        }

        const frames: LiveTrackingFrame[] = [];
        for (const sat of satellites) {
          const frame = this.propService.propagate(sat, currentTime, station);
          if (frame) frames.push(frame);
        }

        const celestial: CelestialPosition[] = this.propService.getCelestialPositions(
          currentTime,
          station,
        );

        const payload = JSON.stringify({
          type: 'TRACKING_UPDATE',
          timestamp: currentTime,
          frames,
          celestial,
          timeState,
        });

        for (const session of sessions) {
          if (session.ws.readyState === WebSocket.OPEN) {
            session.ws.send(payload);
          }
        }
      }
    }, intervalMs);
  }

  public broadcastAll(message: unknown): void {
    const payload = JSON.stringify(message);
    for (const session of this.clients.values()) {
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(payload);
      }
    }
  }

  close(): void {
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    this.clients.clear();
  }
}
