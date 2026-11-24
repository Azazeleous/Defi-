export interface CableStation {
  id: string;
  name: string;
  country: string;
  coordinates: [number, number]; // [lon, lat]
}

export interface SubseaCablePath {
  id: string;
  name: string;
  stations: [string, string]; // [stationA_id, stationB_id]
  coordinates: [number, number][]; // Array of lon/lat points along path
  status: 'OPTIMAL' | 'DEGRADED' | 'SEVERED' | 'REROUTED';
  lengthKm: number;
  rttMs: number;
  capacityTbps: number;
  activePackets: number;
  color: string;
}

export interface LostDeviceTarget {
  id: string;
  hashSignature: string;
  coordinates: [number, number]; // [lon, lat]
  sector: string;
  depthMeters: number;
  pingFrequencyHz: number;
  signalStrengthDbm: number;
  nearestLandingStation: string;
}

export interface TelemetryPacketStream {
  id: string;
  pathId: string;
  source: string;
  destination: string;
  parityMetric: string;
  parityStatus: 'SECURE' | 'GAP_ENCOUNTERED' | 'REROUTED';
  timestamp: string;
  bytesPerSec: string;
}

export interface CalculusTensorState {
  internalTimer: number;
  centralDifferenceError: number; // O(h^2) error
  curvatureKappa: number;
  torsionTau: number;
  frenetTangent: [number, number, number];
  frenetNormal: [number, number, number];
  frenetBinormal: [number, number, number];
  koopmanSingularValues: [number, number, number, number];
  trenchDepthMeters: number;
  dynamicFrictionCoeff: number;
}
