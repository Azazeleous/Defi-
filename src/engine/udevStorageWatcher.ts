/**
 * =============================================================================
 * PROJECT: GAIA EYES — HIGH-RATE QUANTUM GRID AUTOMATION
 * MODULE: udevStorageWatcher Simulation Engine
 * PURPOSE: Simulates low-level Linux udev storage monitoring events (block device
 *          hotplug, mount/unmount drops, and Sparsebundle memory-mapped integrity triggers).
 * =============================================================================
 */

export interface UdevStorageEvent {
  readonly id: string;
  readonly devicePath: string; // e.g. "/dev/mapper/plane_volume_0"
  readonly eventType: 'ADD' | 'REMOVE' | 'CHANGE' | 'CORRUPTION_DETECTED';
  readonly timestampMs: number;
  readonly message: string;
  readonly severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export type UdevEventListener = (event: UdevStorageEvent) => void;

export class UdevStorageWatcher {
  private listeners: Set<UdevEventListener> = new Set();
  private timerId: any = null;
  private eventCounter: number = 0;
  
  // Real-time device connectivity status tracking
  private connectivityStatus: Map<string, { status: 'CONNECTED' | 'DISCONNECTED'; lastSeen: number }> = new Map();

  constructor() {
    // Initialize devices
    const devices = [
      '/dev/mapper/plane_volume_0',
      '/dev/mapper/plane_volume_1',
      '/dev/mapper/plane_volume_2',
      '/dev/lan_streamed_bundle',
    ];
    devices.forEach(dev => this.connectivityStatus.set(dev, { status: 'CONNECTED', lastSeen: Date.now() }));
    this.startWatcher();
  }

  public startWatcher(): void {
    if (this.timerId) return;

    // Simulate periodic hardware udev storage monitoring signals (every 14-22 seconds)
    this.timerId = setInterval(() => {
      this.triggerSimulatedEvent();
    }, 18000);
  }

  public getConnectivityStatus(): Record<string, { status: 'CONNECTED' | 'DISCONNECTED'; lastSeen: number }> {
    return Object.fromEntries(this.connectivityStatus);
  }

  public stopWatcher(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public subscribe(listener: UdevEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private triggerSimulatedEvent(): void {
    this.eventCounter++;
    const devices = Array.from(this.connectivityStatus.keys());
    const dev = devices[Math.floor(Math.random() * devices.length)];
    const types: ('ADD' | 'REMOVE' | 'CHANGE' | 'CORRUPTION_DETECTED')[] = [
      'CHANGE',
      'CHANGE',
      'ADD',
      'CORRUPTION_DETECTED',
      'REMOVE',
    ];
    const type = types[Math.floor(Math.random() * types.length)];

    // Update connectivity status
    if (type === 'REMOVE') {
      this.connectivityStatus.set(dev, { status: 'DISCONNECTED', lastSeen: Date.now() });
    } else {
      this.connectivityStatus.set(dev, { status: 'CONNECTED', lastSeen: Date.now() });
    }

    let severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO';
    let message = `udev: block device ${dev} state changed - sparseband 8MB sync active.`;

    if (type === 'REMOVE') {
      severity = 'CRITICAL';
      message = `udev: STORAGE DROP DETECTED! ${dev} unmounted unexpectedly from initramfs loopback.`;
    } else if (type === 'CORRUPTION_DETECTED') {
      severity = 'WARNING';
      message = `udev: Sparsebundle integrity warning on ${dev}. FNV-1a checksum re-calibrated.`;
    }

    const event: UdevStorageEvent = {
      id: `udev-evt-${Date.now()}-${this.eventCounter}`,
      devicePath: dev,
      eventType: type,
      timestampMs: Date.now(),
      message,
      severity,
    };

    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('Udev listener callback error:', err);
      }
    });
  }

  public forceSimulateEvent(type: 'ADD' | 'REMOVE' | 'CHANGE' | 'CORRUPTION_DETECTED', devPath?: string): UdevStorageEvent {
    this.eventCounter++;
    const dev = devPath || '/dev/mapper/plane_volume_0';
    
    // Update status
    if (type === 'REMOVE') {
      this.connectivityStatus.set(dev, { status: 'DISCONNECTED', lastSeen: Date.now() });
    } else {
      this.connectivityStatus.set(dev, { status: 'CONNECTED', lastSeen: Date.now() });
    }

    let severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO';
    let message = `udev: Manual trigger on ${dev} (${type}).`;

    if (type === 'REMOVE') {
      severity = 'CRITICAL';
      message = `udev: HARDWARE STORAGE DROP! ${dev} disconnected from loopback bus.`;
    } else if (type === 'CORRUPTION_DETECTED') {
      severity = 'WARNING';
      message = `udev: Sparsebundle block corruption flagged on ${dev}.`;
    }

    const event: UdevStorageEvent = {
      id: `udev-evt-${Date.now()}-${this.eventCounter}`,
      devicePath: dev,
      eventType: type,
      timestampMs: Date.now(),
      message,
      severity,
    };

    this.listeners.forEach((l) => l(event));
    return event;
  }
}

export const globalUdevWatcher = new UdevStorageWatcher();
