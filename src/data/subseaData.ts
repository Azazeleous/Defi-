import { CableStation, SubseaCablePath, LostDeviceTarget, TelemetryPacketStream } from '../types/subsea';

export const CABLE_STATIONS: Record<string, CableStation> = {
  virginiaBeach: {
    id: 'virginiaBeach',
    name: 'Virginia Beach Landing Station',
    country: 'United States',
    coordinates: [-75.9779, 36.8529],
  },
  bilbaoSpain: {
    id: 'bilbaoSpain',
    name: 'Bilbao Sopelana CLS',
    country: 'Spain',
    coordinates: [-2.935, 43.263],
  },
  marseilleFrance: {
    id: 'marseilleFrance',
    name: 'Marseille Mediterranean CLS',
    country: 'France',
    coordinates: [5.3698, 43.2965],
  },
  singaporeCore: {
    id: 'singaporeCore',
    name: 'Tuas Cable Landing Station',
    country: 'Singapore',
    coordinates: [103.8198, 1.3521],
  },
  losAngeles: {
    id: 'losAngeles',
    name: 'El Segundo / Los Angeles CLS',
    country: 'United States',
    coordinates: [-118.2437, 34.0522],
  },
  hongKong: {
    id: 'hongKong',
    name: 'Tseung Kwan O CLS',
    country: 'Hong Kong SAR',
    coordinates: [114.1694, 22.3193],
  },
  stHilaireFrance: {
    id: 'stHilaireFrance',
    name: 'Saint-Hilaire-de-Riez CLS',
    country: 'France',
    coordinates: [-1.9489, 46.7214],
  },
};

export const INITIAL_SUBSEA_CABLES: SubseaCablePath[] = [
  {
    id: 'c-marea',
    name: 'MAREA Transatlantic',
    stations: ['virginiaBeach', 'bilbaoSpain'],
    coordinates: [
      [-75.9779, 36.8529],
      [-65.0, 38.5],
      [-52.0, 40.0],
      [-40.0, 41.2],
      [-25.0, 42.0],
      [-12.0, 43.0],
      [-2.935, 43.263],
    ],
    status: 'OPTIMAL',
    lengthKm: 6605,
    rttMs: 64.2,
    capacityTbps: 200,
    activePackets: 184200,
    color: '#00f0ff',
  },
  {
    id: 'c-smw5',
    name: 'SEA-ME-WE 5 Gateway',
    stations: ['marseilleFrance', 'singaporeCore'],
    coordinates: [
      [5.3698, 43.2965],
      [14.5, 36.0],
      [32.5, 31.0], // Suez canal maritime pipeline
      [42.0, 15.0], // Red Sea
      [55.0, 12.0], // Arabian Sea
      [78.0, 6.0],  // Indian Ocean south of Sri Lanka
      [95.0, 4.0],  // Malacca Strait
      [103.8198, 1.3521],
    ],
    status: 'OPTIMAL',
    lengthKm: 20000,
    rttMs: 148.5,
    capacityTbps: 24,
    activePackets: 92450,
    color: '#ffb700',
  },
  {
    id: 'c-dunant',
    name: 'Dunant High-Density',
    stations: ['virginiaBeach', 'stHilaireFrance'],
    coordinates: [
      [-75.9779, 36.8529],
      [-60.0, 39.5],
      [-42.0, 42.5],
      [-22.0, 45.0],
      [-1.9489, 46.7214],
    ],
    status: 'OPTIMAL',
    lengthKm: 6400,
    rttMs: 62.8,
    capacityTbps: 250,
    activePackets: 215000,
    color: '#a855f7',
  },
  {
    id: 'c-plcn',
    name: 'Pacific Light Network (PLCN)',
    stations: ['losAngeles', 'hongKong'],
    coordinates: [
      [-118.2437, 34.0522],
      [-140.0, 30.0],
      [-170.0, 26.0],
      [165.0, 23.0],
      [135.0, 22.0],
      [114.1694, 22.3193],
    ],
    status: 'OPTIMAL',
    lengthKm: 12800,
    rttMs: 112.4,
    capacityTbps: 144,
    activePackets: 145000,
    color: '#10b981',
  },
];

export const LOST_DEVICE_TARGET: LostDeviceTarget = {
  id: 'dev-137451921129154222',
  hashSignature: '137451921129154222',
  coordinates: [-45.0, 39.5], // Sector 4 Mid-Atlantic
  sector: 'Sector 4 Mid-Atlantic Fracture Trench',
  depthMeters: -5420,
  pingFrequencyHz: 42.8,
  signalStrengthDbm: -84.2,
  nearestLandingStation: 'Virginia Beach CLS (2,680 km)',
};

export const INITIAL_TELEMETRY_STREAMS: TelemetryPacketStream[] = [
  {
    id: 'stream-1',
    pathId: 'c-marea',
    source: 'Virginia Beach CLS',
    destination: 'Bilbao Sopelana',
    parityMetric: '100% SECURE',
    parityStatus: 'SECURE',
    timestamp: 'SYNCED',
    bytesPerSec: '82.4 Tbps',
  },
  {
    id: 'stream-2',
    pathId: 'c-smw5',
    source: 'Marseille CLS',
    destination: 'Tuas Singapore',
    parityMetric: '100% SECURE',
    parityStatus: 'SECURE',
    timestamp: 'SYNCED',
    bytesPerSec: '18.9 Tbps',
  },
  {
    id: 'stream-3',
    pathId: 'c-dunant',
    source: 'Virginia Beach CLS',
    destination: 'Saint-Hilaire-de-Riez',
    parityMetric: '100% SECURE',
    parityStatus: 'SECURE',
    timestamp: 'SYNCED',
    bytesPerSec: '142.1 Tbps',
  },
  {
    id: 'stream-4',
    pathId: 'dev-137451921129154222',
    source: 'Target: 137451921129154222',
    destination: 'Mid-Atlantic Trench Beacon',
    parityMetric: 'ACOUSTIC LOCK',
    parityStatus: 'SECURE',
    timestamp: 'PINPOINTED',
    bytesPerSec: '42.8 bps (Sonar)',
  },
];
