export interface DiscoveredDevice {
  readonly deviceId: string;
  readonly subsystem: 'block' | 'net' | 'pci' | 'usb' | 'fiber';
  readonly sysPath: string;
  readonly devNode: string;
  readonly vendor?: string;
  readonly model?: string;
  readonly status: 'online' | 'offline' | 'degraded';
  readonly attributes: Record<string, string>;
}

export interface DeviceDiscovery {
  scanDevices(): Promise<readonly DiscoveredDevice[]>;
  getDevice(deviceId: string): Promise<DiscoveredDevice | null>;
  onDeviceAdded(listener: (device: DiscoveredDevice) => void): () => void;
  onDeviceRemoved(listener: (deviceId: string) => void): () => void;
}
