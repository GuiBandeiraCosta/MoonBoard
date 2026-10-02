import { Buffer } from 'buffer';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device, State, type Subscription } from 'react-native-ble-plx';
import {
  CHUNK_DELAY_MS,
  CLEAR_FRAME,
  NUS_SERVICE,
  NUS_WRITE,
  RBL_SERVICE,
  RBL_WRITE,
  chunk,
  encodeFrame,
  type EncodeOptions,
  type LitHold,
} from './protocol';

export type ConnectionStatus = 'off' | 'idle' | 'scanning' | 'connecting' | 'connected';

export interface FoundDevice {
  id: string;
  name: string;
  rssi: number | null;
}

type Listener = () => void;

/**
 * Single shared BLE session for the app. Keeps one connection to one board
 * (v1 boxes only accept one central at a time) and exposes a small
 * observable surface for the UI.
 */
class BoardConnection {
  private manager: BleManager | null = null;
  private device: Device | null = null;
  private writeService = NUS_SERVICE;
  private writeChar = NUS_WRITE;
  private withResponse = false;
  private disconnectSub: Subscription | null = null;
  private listeners = new Set<Listener>();
  private writeQueue: Promise<void> = Promise.resolve();

  status: ConnectionStatus = 'idle';
  found: FoundDevice[] = [];
  deviceName: string | null = null;
  lastError: string | null = null;

  private get ble(): BleManager {
    if (!this.manager) {
      this.manager = new BleManager();
      this.manager.onStateChange((state) => {
        if (state !== State.PoweredOn) {
          this.setStatus('off');
        } else if (this.status === 'off') {
          this.setStatus('idle');
        }
      }, true);
    }
    return this.manager;
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

  private async ensurePermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    const api = Platform.Version as number;
    if (api >= 31) {
      const res = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return Object.values(res).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
    }
    const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return res === PermissionsAndroid.RESULTS.GRANTED;
  }

  async startScan(): Promise<void> {
    this.lastError = null;
    if (!(await this.ensurePermissions())) {
      this.lastError = 'Bluetooth permission denied';
      this.emit();
      return;
    }
    const state = await this.ble.state();
    if (state !== State.PoweredOn) {
      this.setStatus('off');
      return;
    }
    this.found = [];
    this.setStatus('scanning');
    // Scan everything: the official box advertises the NUS service, the 2016
    // box advertises the RedBearLab one, and some DIY boards advertise nothing.
    this.ble.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        this.lastError = error.message;
        this.stopScan();
        return;
      }
      if (!device) return;
      const name = device.name ?? device.localName;
      if (!name) return;
      const looksLikeBoard = /moon/i.test(name);
      if (!looksLikeBoard) return;
      if (this.found.some((d) => d.id === device.id)) return;
      this.found = [...this.found, { id: device.id, name, rssi: device.rssi }];
      this.emit();
    });
    setTimeout(() => {
      if (this.status === 'scanning') this.stopScan();
    }, 12_000);
  }

  stopScan(): void {
    this.manager?.stopDeviceScan();
    if (this.status === 'scanning') this.setStatus('idle');
    else this.emit();
  }

  async connect(id: string): Promise<void> {
    this.stopScan();
    this.lastError = null;
    this.setStatus('connecting');
    try {
      const device = await this.ble.connectToDevice(id, { timeout: 10_000 });
      await device.discoverAllServicesAndCharacteristics();
      const services = await device.services();
      const hasNus = services.some((s) => s.uuid.toLowerCase() === NUS_SERVICE);
      const hasRbl = services.some((s) => s.uuid.toLowerCase() === RBL_SERVICE);
      if (hasNus) {
        this.writeService = NUS_SERVICE;
        this.writeChar = NUS_WRITE;
        this.withResponse = false;
      } else if (hasRbl) {
        this.writeService = RBL_SERVICE;
        this.writeChar = RBL_WRITE;
        this.withResponse = true;
      } else {
        throw new Error('This device does not look like a MoonBoard LED box.');
      }
      this.device = device;
      this.deviceName = device.name ?? device.localName ?? 'MoonBoard';
      this.disconnectSub?.remove();
      this.disconnectSub = this.ble.onDeviceDisconnected(id, () => {
        this.device = null;
        this.setStatus('idle');
      });
      this.setStatus('connected');
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e);
      this.device = null;
      this.setStatus('idle');
    }
  }

  async disconnect(): Promise<void> {
    const d = this.device;
    this.device = null;
    this.disconnectSub?.remove();
    this.disconnectSub = null;
    if (d) {
      try {
        await d.cancelConnection();
      } catch {
        // already gone
      }
    }
    this.setStatus('idle');
  }

  get isConnected(): boolean {
    return this.status === 'connected' && this.device !== null;
  }

  async lightHolds(holds: LitHold[], opts: EncodeOptions): Promise<void> {
    await this.sendFrame(encodeFrame(holds, opts));
  }

  async clear(): Promise<void> {
    await this.sendFrame(CLEAR_FRAME);
  }

  private sendFrame(frame: string): Promise<void> {
    // Serialise writes: two problems lit in quick succession must not interleave.
    this.writeQueue = this.writeQueue
      .then(() => this.writeNow(frame))
      .catch((e) => {
        this.lastError = e instanceof Error ? e.message : String(e);
        this.emit();
      });
    return this.writeQueue;
  }

  private async writeNow(frame: string): Promise<void> {
    const device = this.device;
    if (!device) throw new Error('Not connected to a board.');
    for (const part of chunk(frame)) {
      const b64 = Buffer.from(part, 'ascii').toString('base64');
      if (this.withResponse) {
        await device.writeCharacteristicWithResponseForService(this.writeService, this.writeChar, b64);
      } else {
        await device.writeCharacteristicWithoutResponseForService(this.writeService, this.writeChar, b64);
      }
      await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
    }
  }
}

export const board = new BoardConnection();
