/// <reference types="web-bluetooth" />
import { CHUNK_DELAY_MS, CLEAR_FRAME, NUS_SERVICE, NUS_WRITE, RBL_SERVICE, RBL_WRITE, chunk, encodeFrame, type EncodeOptions, type LitHold } from './protocol';
import type { ConnectionStatus, FoundDevice } from './manager';

export type { ConnectionStatus, FoundDevice } from './manager';

type Listener = () => void;

/**
 * Web Bluetooth version of the board connection. Works in Chrome and Edge on
 * desktop and Android; iOS Safari has no Web Bluetooth (use Bluefy there).
 * The browser shows its own device picker, so "scan" opens that chooser.
 */
class WebBoardConnection {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private withResponse = false;
  private listeners = new Set<Listener>();
  private writeQueue: Promise<void> = Promise.resolve();

  status: ConnectionStatus = 'idle';
  found: FoundDevice[] = [];
  deviceName: string | null = null;
  lastError: string | null = null;

  constructor() {
    if (typeof navigator === 'undefined' || !navigator.bluetooth) this.status = 'off';
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private setStatus(s: ConnectionStatus) {
    this.status = s;
    this.emit();
  }

  async startScan(): Promise<void> {
    this.lastError = null;
    if (!navigator.bluetooth) {
      this.lastError = 'This browser has no Web Bluetooth. Use Chrome or Edge, or the phone app.';
      this.setStatus('off');
      return;
    }
    this.setStatus('scanning');
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'Moon' }, { namePrefix: 'MOON' }, { services: [NUS_SERVICE] }, { services: [RBL_SERVICE] }],
        optionalServices: [NUS_SERVICE, RBL_SERVICE],
      });
      this.found = [{ id: device.id, name: device.name ?? 'MoonBoard', rssi: null }];
      this.device = device;
      this.setStatus('idle');
      await this.connect(device.id);
    } catch (e) {
      // User cancelled the chooser or no device.
      if (!(e instanceof DOMException && e.name === 'NotFoundError')) this.lastError = e instanceof Error ? e.message : String(e);
      this.setStatus('idle');
    }
  }

  stopScan(): void {
    if (this.status === 'scanning') this.setStatus('idle');
  }

  async connect(id: string): Promise<void> {
    const device = this.device && this.device.id === id ? this.device : null;
    if (!device?.gatt) {
      this.lastError = 'Pick the board from the browser chooser first.';
      this.emit();
      return;
    }
    this.lastError = null;
    this.setStatus('connecting');
    try {
      const server = await device.gatt.connect();
      let service: BluetoothRemoteGATTService;
      try {
        service = await server.getPrimaryService(NUS_SERVICE);
        this.characteristic = await service.getCharacteristic(NUS_WRITE);
        this.withResponse = false;
      } catch {
        service = await server.getPrimaryService(RBL_SERVICE);
        this.characteristic = await service.getCharacteristic(RBL_WRITE);
        this.withResponse = true;
      }
      device.addEventListener('gattserverdisconnected', () => {
        this.characteristic = null;
        this.setStatus('idle');
      });
      this.deviceName = device.name ?? 'MoonBoard';
      this.setStatus('connected');
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e);
      this.characteristic = null;
      this.setStatus('idle');
    }
  }

  async disconnect(): Promise<void> {
    this.device?.gatt?.disconnect();
    this.characteristic = null;
    this.setStatus('idle');
  }

  get isConnected(): boolean {
    return this.status === 'connected' && this.characteristic !== null;
  }

  async lightHolds(holds: LitHold[], opts: EncodeOptions): Promise<void> {
    await this.sendFrame(encodeFrame(holds, opts));
  }

  async clear(): Promise<void> {
    await this.sendFrame(CLEAR_FRAME);
  }

  private sendFrame(frame: string): Promise<void> {
    this.writeQueue = this.writeQueue.then(() => this.writeNow(frame)).catch((e) => {
      this.lastError = e instanceof Error ? e.message : String(e);
      this.emit();
    });
    return this.writeQueue;
  }

  private async writeNow(frame: string): Promise<void> {
    const c = this.characteristic;
    if (!c) throw new Error('Not connected to a board.');
    const enc = new TextEncoder();
    for (const part of chunk(frame)) {
      const bytes = enc.encode(part);
      if (this.withResponse) await c.writeValueWithResponse(bytes);
      else await c.writeValueWithoutResponse(bytes);
      await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
    }
  }
}

export const board = new WebBoardConnection();
