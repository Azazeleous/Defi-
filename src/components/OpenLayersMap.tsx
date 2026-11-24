import React, { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import { fromLonLat, toLonLat } from 'ol/proj';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import Feature from 'ol/Feature';
import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import Fill from 'ol/style/Fill';
import CircleStyle from 'ol/style/Circle';
import Text from 'ol/style/Text';
import { SubseaCablePath } from '../types/subsea';
import { CABLE_STATIONS, LOST_DEVICE_TARGET } from '../data/subseaData';
import { Compass, Globe, Layers, Navigation, Radio, Shield, ZoomIn, ZoomOut } from 'lucide-react';

interface Props {
  cables: SubseaCablePath[];
  isLossEventActive: boolean;
  isBgpRerouted: boolean;
  selectedCableId: string | null;
  onSelectCable: (cableId: string) => void;
}

export const OpenLayersMap: React.FC<Props> = ({
  cables,
  isLossEventActive,
  isBgpRerouted,
  selectedCableId,
  onSelectCable,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);

  // Layer references
  const satLayerRef = useRef<TileLayer<XYZ> | null>(null);
  const cableVectorLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const deviceVectorLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const stationVectorLayerRef = useRef<VectorLayer<VectorSource> | null>(null);

  // Layer toggles
  const [showSatellite, setShowSatellite] = useState<boolean>(true);
  const [showCables, setShowCables] = useState<boolean>(true);
  const [showDevice, setShowDevice] = useState<boolean>(true);
  const [showAnchorLine, setShowAnchorLine] = useState<boolean>(true);
  const [mouseCoords, setMouseCoords] = useState<string>('Lon -35.0000° | Lat 30.0000°');

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // 1. Basemap Layer: Esri World Imagery Satellite
    const satLayer = new TileLayer({
      source: new XYZ({
        url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attributions: 'Esri Satellite Data Engine Layer',
        maxZoom: 19,
      }),
      visible: true,
    });
    satLayerRef.current = satLayer;

    // 2. Vector Layer: Subsea Cables
    const cableSource = new VectorSource();
    const cableLayer = new VectorLayer({
      source: cableSource,
      style: (feature) => {
        const cableId = feature.get('cableId');
        const isSevered = feature.get('isSevered');
        const isReroute = feature.get('isReroute');

        if (isSevered) {
          return new Style({
            stroke: new Stroke({
              color: '#ff0055',
              width: 3.5,
              lineDash: [8, 6],
            }),
          });
        }

        if (isReroute) {
          return new Style({
            stroke: new Stroke({
              color: '#39ff14',
              width: 3,
              lineDash: [4, 4],
            }),
          });
        }

        const color = feature.get('color') || '#00f0ff';
        const isSelected = cableId === selectedCableId;

        return new Style({
          stroke: new Stroke({
            color: color,
            width: isSelected ? 3.5 : 2,
          }),
        });
      },
    });
    cableVectorLayerRef.current = cableLayer;

    // 3. Vector Layer: Landing Stations
    const stationSource = new VectorSource();
    const stationLayer = new VectorLayer({
      source: stationSource,
      style: (feature) => {
        const name = feature.get('name');
        return new Style({
          image: new CircleStyle({
            radius: 5,
            fill: new Fill({ color: '#ffffff' }),
            stroke: new Stroke({ color: '#00f0ff', width: 2 }),
          }),
          text: new Text({
            text: name,
            offsetY: -12,
            font: '10px monospace',
            fill: new Fill({ color: '#b8daf7' }),
            stroke: new Stroke({ color: '#060a10', width: 3 }),
          }),
        });
      },
    });
    stationVectorLayerRef.current = stationLayer;

    // 4. Vector Layer: Lost Device Target Ping
    const deviceSource = new VectorSource();
    const deviceLayer = new VectorLayer({
      source: deviceSource,
      style: (feature) => {
        const type = feature.get('type');
        if (type === 'anchorLine') {
          return new Style({
            stroke: new Stroke({
              color: '#ffb700',
              width: 1.5,
              lineDash: [6, 4],
            }),
          });
        }

        return new Style({
          image: new CircleStyle({
            radius: 7,
            fill: new Fill({ color: '#ff0055' }),
            stroke: new Stroke({ color: '#ffffff', width: 2 }),
          }),
          text: new Text({
            text: 'LOST DEV 137451921129154222 [-5420m]',
            offsetY: 14,
            font: 'bold 10px monospace',
            fill: new Fill({ color: '#ff0055' }),
            stroke: new Stroke({ color: '#010306', width: 3 }),
          }),
        });
      },
    });
    deviceVectorLayerRef.current = deviceLayer;

    // 5. Instantiate Map
    const map = new Map({
      target: mapContainerRef.current,
      layers: [satLayer, cableLayer, stationLayer, deviceLayer],
      view: new View({
        center: fromLonLat([-35.0, 30.0]), // Transatlantic pivot center
        zoom: 2.5,
        minZoom: 1.8,
        maxZoom: 12,
      }),
      controls: [], // custom HUD controls
    });
    mapInstanceRef.current = map;

    // Pointer move listener for coordinate readout
    map.on('pointermove', (evt) => {
      const lonLat = toLonLat(evt.coordinate);
      setMouseCoords(
        `Lon ${lonLat[0].toFixed(4)}° | Lat ${lonLat[1].toFixed(4)}°`
      );
    });

    // Click handler to select cable
    map.on('click', (evt) => {
      const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f);
      if (feature) {
        const cableId = feature.get('cableId');
        if (cableId) onSelectCable(cableId);
      }
    });

    // Populate stations
    Object.values(CABLE_STATIONS).forEach((station) => {
      const feat = new Feature({
        geometry: new Point(fromLonLat(station.coordinates)),
        name: station.name,
        stationId: station.id,
      });
      stationSource.addFeature(feat);
    });

    return () => {
      map.setTarget(undefined);
      mapInstanceRef.current = null;
    };
  }, []);

  // Update cable geometries when cables, loss events, or BGP reroute states change
  useEffect(() => {
    if (!cableVectorLayerRef.current) return;
    const source = cableVectorLayerRef.current.getSource();
    if (!source) return;

    source.clear();

    cables.forEach((cable) => {
      const projectedCoords = cable.coordinates.map((coord) => fromLonLat(coord));
      const geom = new LineString(projectedCoords);

      const isSevered = isLossEventActive && cable.id === 'c-marea';

      const feat = new Feature({
        geometry: geom,
        cableId: cable.id,
        name: cable.name,
        color: cable.color,
        isSevered: isSevered,
      });
      source.addFeature(feat);
    });

    // If BGP deflection reroute is active, render active secondary bypass through Mediterranean SEA-ME-WE 5 corridor
    if (isBgpRerouted) {
      const reroutePath = [
        fromLonLat(CABLE_STATIONS.virginiaBeach.coordinates),
        fromLonLat([-40.0, 28.0]),
        fromLonLat([-10.0, 34.0]),
        fromLonLat(CABLE_STATIONS.marseilleFrance.coordinates),
        fromLonLat(CABLE_STATIONS.bilbaoSpain.coordinates),
      ];
      const rerouteFeat = new Feature({
        geometry: new LineString(reroutePath),
        name: 'BGP Deflection Bypass',
        isReroute: true,
      });
      source.addFeature(rerouteFeat);
    }
  }, [cables, isLossEventActive, isBgpRerouted, selectedCableId]);

  // Update lost device & coastline anchor vector
  useEffect(() => {
    if (!deviceVectorLayerRef.current) return;
    const source = deviceVectorLayerRef.current.getSource();
    if (!source) return;

    source.clear();

    // Lost device point
    const devPoint = new Feature({
      geometry: new Point(fromLonLat(LOST_DEVICE_TARGET.coordinates)),
      type: 'device',
      name: LOST_DEVICE_TARGET.id,
    });
    source.addFeature(devPoint);

    // Coastline anchor vector line directly to Virginia Beach landing station
    if (showAnchorLine) {
      const anchorGeom = new LineString([
        fromLonLat(LOST_DEVICE_TARGET.coordinates),
        fromLonLat(CABLE_STATIONS.virginiaBeach.coordinates),
      ]);
      const anchorLineFeat = new Feature({
        geometry: anchorGeom,
        type: 'anchorLine',
        name: 'Coastline Anchor Vector',
      });
      source.addFeature(anchorLineFeat);
    }
  }, [showAnchorLine]);

  // Update layer visibility toggles
  useEffect(() => {
    if (satLayerRef.current) satLayerRef.current.setVisible(showSatellite);
    if (cableVectorLayerRef.current) cableVectorLayerRef.current.setVisible(showCables);
    if (deviceVectorLayerRef.current) deviceVectorLayerRef.current.setVisible(showDevice);
  }, [showSatellite, showCables, showDevice]);

  // Navigation pivot helpers
  const handlePivot = (lon: number, lat: number, zoom: number) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.getView().animate({
      center: fromLonLat([lon, lat]),
      zoom: zoom,
      duration: 800,
    });
  };

  const handleZoom = (delta: number) => {
    if (!mapInstanceRef.current) return;
    const view = mapInstanceRef.current.getView();
    const currZoom = view.getZoom() || 3;
    view.animate({ zoom: currZoom + delta, duration: 250 });
  };

  return (
    <div className="relative w-full h-full min-h-[460px] bg-black overflow-hidden flex flex-col rounded-none select-none">
      {/* Top Banner Tag */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-[#060a10]/90 backdrop-blur border border-[#101d2a] px-3 py-1.5 rounded text-[11px] font-mono tracking-wider text-[#00f0ff] uppercase shadow-lg">
        <Globe className="w-3.5 h-3.5 text-[#00f0ff] animate-spin" style={{ animationDuration: '24s' }} />
        <span>RealVisuals Geographic Map &bull; NODE_09 Synapticsonar</span>
      </div>

      {/* Top-Right Geographic Readout */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2 bg-[#060a10]/90 backdrop-blur border border-[#101d2a] px-3 py-1.5 rounded text-[10px] font-mono text-[#b8daf7]">
        <Compass className="w-3.5 h-3.5 text-[#ffb700]" />
        <span>{mouseCoords}</span>
      </div>

      {/* Map Target Canvas */}
      <div ref={mapContainerRef} className="w-full h-full flex-1" />

      {/* Bottom-Left HUD Control Box */}
      <div className="absolute bottom-3 left-3 z-20 bg-[#060a10]/95 backdrop-blur border border-[#101d2a] p-3 rounded-lg shadow-2xl flex flex-col gap-2 text-[11px] font-mono max-w-[280px]">
        <div className="flex items-center justify-between border-b border-[#101d2a] pb-1.5 text-[#ffb700] font-bold tracking-wider">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            MAP OVERLAYS
          </span>
          <span className="text-[9px] text-[#39ff14] font-normal">WGS84 EPSG:3857</span>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-[#b8daf7] hover:text-white transition-colors">
          <input
            type="checkbox"
            checked={showSatellite}
            onChange={(e) => setShowSatellite(e.target.checked)}
            className="rounded border-[#101d2a] bg-black text-[#00f0ff] focus:ring-0 cursor-pointer"
          />
          <span>Esri Satellite Imagery Basemap</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer text-[#b8daf7] hover:text-white transition-colors">
          <input
            type="checkbox"
            checked={showCables}
            onChange={(e) => setShowCables(e.target.checked)}
            className="rounded border-[#101d2a] bg-black text-[#00f0ff] focus:ring-0 cursor-pointer"
          />
          <span>Subsea Fiber Cable Vectors</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer text-[#b8daf7] hover:text-white transition-colors">
          <input
            type="checkbox"
            checked={showDevice}
            onChange={(e) => setShowDevice(e.target.checked)}
            className="rounded border-[#101d2a] bg-black text-[#00f0ff] focus:ring-0 cursor-pointer"
          />
          <span>Lost Device Ping Locator</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer text-[#b8daf7] hover:text-white transition-colors">
          <input
            type="checkbox"
            checked={showAnchorLine}
            onChange={(e) => setShowAnchorLine(e.target.checked)}
            className="rounded border-[#101d2a] bg-black text-[#00f0ff] focus:ring-0 cursor-pointer"
          />
          <span>Coastline Anchor Vector Trace</span>
        </label>

        {/* Pivot Presets */}
        <div className="pt-2 border-t border-[#101d2a] flex flex-wrap gap-1">
          <button
            onClick={() => handlePivot(-35.0, 30.0, 2.8)}
            className="px-2 py-0.5 rounded bg-[#07121d] hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/30 text-[10px] transition-colors"
          >
            MAREA (Atlantic)
          </button>
          <button
            onClick={() => handlePivot(55.0, 25.0, 2.5)}
            className="px-2 py-0.5 rounded bg-[#07121d] hover:bg-[#ffb700]/20 text-[#ffb700] border border-[#ffb700]/30 text-[10px] transition-colors"
          >
            SMW5 (Eurasia)
          </button>
          <button
            onClick={() => handlePivot(-160.0, 26.0, 2.3)}
            className="px-2 py-0.5 rounded bg-[#07121d] hover:bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30 text-[10px] transition-colors"
          >
            PLCN (Pacific)
          </button>
        </div>
      </div>

      {/* Bottom-Right Zoom & Tool Controls */}
      <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-1.5">
        <button
          onClick={() => handleZoom(1)}
          className="p-2 rounded bg-[#060a10]/90 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#101d2a] hover:border-[#00f0ff]/40 shadow-lg transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom(-1)}
          className="p-2 rounded bg-[#060a10]/90 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#101d2a] hover:border-[#00f0ff]/40 shadow-lg transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => handlePivot(-35.0, 30.0, 2.5)}
          className="p-2 rounded bg-[#060a10]/90 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#101d2a] hover:border-[#00f0ff]/40 shadow-lg transition-colors"
          title="Reset to Center"
        >
          <Navigation className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
