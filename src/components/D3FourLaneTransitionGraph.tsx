import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { LaneState, FourLaneCycleResult } from '../engine/cuboctahedralTraceEngine';
import { 
  Activity, 
  Layers, 
  Compass, 
  Zap, 
  RotateCw, 
  Maximize2,
  TrendingUp,
  Cpu,
  ShieldCheck
} from 'lucide-react';

export interface TransitionPoint {
  step: number;
  timeMs: number;
  lane1Val: number;
  lane2Val: number;
  lane3Val: number;
  lane4Val: number;
  coaxialLocked: boolean;
  sudostep: boolean;
  powerOhm: number;
}

interface Props {
  cycleResult: FourLaneCycleResult;
  historyLimit?: number;
}

export const D3FourLaneTransitionGraph: React.FC<Props> = ({
  cycleResult,
  historyLimit = 60,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const historyRef = useRef<TransitionPoint[]>([]);

  const [activeView, setActiveView] = useState<'FOUR_LANE' | 'OPPOSING_PAIR' | 'PHASE_SPACE'>('FOUR_LANE');
  const [hoveredPoint, setHoveredPoint] = useState<TransitionPoint | null>(null);
  const [visibleLanes, setVisibleLanes] = useState({
    lane1: true,
    lane2: true,
    lane3: true,
    lane4: true,
  });

  // Maintain sliding window history of coordinates
  useEffect(() => {
    if (!cycleResult || !cycleResult.lanes || cycleResult.lanes.length < 4) return;

    const newPt: TransitionPoint = {
      step: cycleResult.latestBlock.cycleStep || Date.now() % 10000,
      timeMs: Date.now(),
      lane1Val: cycleResult.lanes[0].coordinateValue,
      lane2Val: cycleResult.lanes[1].coordinateValue,
      lane3Val: cycleResult.lanes[2].coordinateValue,
      lane4Val: cycleResult.lanes[3].coordinateValue,
      coaxialLocked: cycleResult.centerCoaxialLocked,
      sudostep: cycleResult.sudostepActive,
      powerOhm: cycleResult.powerDrawModulationOhm,
    };

    historyRef.current.push(newPt);
    if (historyRef.current.length > historyLimit) {
      historyRef.current.shift();
    }
  }, [cycleResult, historyLimit]);

  // Render D3 Visualization
  useEffect(() => {
    const svgEl = svgRef.current;
    const container = containerRef.current;
    if (!svgEl || !container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.max(320, rect.width || 600);
    const height = Math.max(220, rect.height || 260);

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const margin = { top: 20, right: 30, bottom: 30, left: 45 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const data = historyRef.current;
    if (data.length < 2) return;

    // Define gradients
    const defs = svg.append('defs');

    // Lane 1 Gradient (Green)
    const grad1 = defs.append('linearGradient').attr('id', 'grad-lane-1').attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
    grad1.append('stop').attr('offset', '0%').attr('stop-color', '#39ff14').attr('stop-opacity', 0.25);
    grad1.append('stop').attr('offset', '100%').attr('stop-color', '#39ff14').attr('stop-opacity', 0.0);

    // Lane 2 Gradient (Amber)
    const grad2 = defs.append('linearGradient').attr('id', 'grad-lane-2').attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
    grad2.append('stop').attr('offset', '0%').attr('stop-color', '#ffb700').attr('stop-opacity', 0.25);
    grad2.append('stop').attr('offset', '100%').attr('stop-color', '#ffb700').attr('stop-opacity', 0.0);

    if (activeView === 'PHASE_SPACE') {
      // 2D Phase Portrait (Lane 1 vs Lane 2 Lissajous)
      const xScale = d3.scaleLinear().domain([0, 1]).range([0, innerWidth]);
      const yScale = d3.scaleLinear().domain([0, 1]).range([innerHeight, 0]);

      // Grid
      g.append('g')
        .attr('class', 'grid')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale).ticks(5).tickSize(-innerHeight).tickFormat(() => ''))
        .attr('stroke', '#101d2a')
        .attr('stroke-opacity', 0.3);

      g.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(yScale).ticks(5).tickSize(-innerWidth).tickFormat(() => ''))
        .attr('stroke', '#101d2a')
        .attr('stroke-opacity', 0.3);

      // Axes
      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale).ticks(5))
        .attr('color', '#4b5563')
        .selectAll('text')
        .attr('fill', '#9ca3af')
        .attr('font-size', '10px')
        .attr('font-family', 'monospace');

      g.append('g')
        .call(d3.axisLeft(yScale).ticks(5))
        .attr('color', '#4b5563')
        .selectAll('text')
        .attr('fill', '#9ca3af')
        .attr('font-size', '10px')
        .attr('font-family', 'monospace');

      // Center lock point (0.5, 0.5)
      g.append('circle')
        .attr('cx', xScale(0.5))
        .attr('cy', yScale(0.5))
        .attr('r', 4)
        .attr('fill', '#ffb700')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5);

      // Phase curve
      const phaseLine = d3
        .line<TransitionPoint>()
        .x((d) => xScale(d.lane1Val % 1.0))
        .y((d) => yScale(d.lane2Val % 1.0))
        .curve(d3.curveCatmullRom);

      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#00f0ff')
        .attr('stroke-width', 2)
        .attr('d', phaseLine);

      // Current head
      const latest = data[data.length - 1];
      g.append('circle')
        .attr('cx', xScale(latest.lane1Val % 1.0))
        .attr('cy', yScale(latest.lane2Val % 1.0))
        .attr('r', 6)
        .attr('fill', '#39ff14')
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .style('filter', 'drop-shadow(0 0 8px #39ff14)');

      return;
    }

    // Standard Multi-Lane Time Series
    const xDomain = [0, data.length - 1];
    const xScale = d3.scaleLinear().domain(xDomain).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain([0, 1.05]).range([innerHeight, 0]);

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(6).tickSize(-innerHeight).tickFormat(() => ''))
      .attr('stroke', '#0f172a')
      .attr('stroke-opacity', 0.5);

    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(yScale).ticks(5).tickSize(-innerWidth).tickFormat(() => ''))
      .attr('stroke', '#0f172a')
      .attr('stroke-opacity', 0.5);

    // Central Coaxial Line reference at 0.5
    const coaxialY = yScale(0.5);
    g.append('line')
      .attr('x1', 0)
      .attr('y1', coaxialY)
      .attr('x2', innerWidth)
      .attr('y2', coaxialY)
      .attr('stroke', cycleResult.centerCoaxialLocked ? '#ffb700' : '#334155')
      .attr('stroke-width', cycleResult.centerCoaxialLocked ? 1.8 : 1)
      .attr('stroke-dasharray', '4,4');

    g.append('text')
      .attr('x', innerWidth - 6)
      .attr('y', coaxialY - 6)
      .attr('text-anchor', 'end')
      .attr('fill', cycleResult.centerCoaxialLocked ? '#ffb700' : '#64748b')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .text(cycleResult.centerCoaxialLocked ? 'COAXIAL FUSED @ 0.5' : 'COAXIAL BASELINE (0.5)');

    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(6).tickFormat((d) => `t-${data.length - 1 - Number(d)}`);
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr('color', '#334155')
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace');

    const yAxis = d3.axisLeft(yScale).ticks(5);
    g.append('g')
      .call(yAxis)
      .attr('color', '#334155')
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace');

    // Line generators
    const createLineGen = (valKey: 'lane1Val' | 'lane2Val' | 'lane3Val' | 'lane4Val') =>
      d3
        .line<TransitionPoint>()
        .x((_, i) => xScale(i))
        .y((d) => yScale(d[valKey] % 1.0))
        .curve(d3.curveMonotoneX);

    // Draw Lane 4 (Purple)
    if (visibleLanes.lane4 && activeView === 'FOUR_LANE') {
      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#c084fc')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.8)
        .attr('d', createLineGen('lane4Val'));
    }

    // Draw Lane 3 (Cyan)
    if (visibleLanes.lane3 && activeView === 'FOUR_LANE') {
      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#00f0ff')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.85)
        .attr('d', createLineGen('lane3Val'));
    }

    // Draw Lane 2 (Amber / Shadow)
    if (visibleLanes.lane2) {
      // Area under curve
      const areaGen2 = d3
        .area<TransitionPoint>()
        .x((_, i) => xScale(i))
        .y0(innerHeight)
        .y1((d) => yScale(d.lane2Val % 1.0))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(data)
        .attr('fill', 'url(#grad-lane-2)')
        .attr('d', areaGen2);

      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', cycleResult.sudostepActive ? '#ff0055' : '#ffb700')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', activeView === 'OPPOSING_PAIR' ? '4,2' : null)
        .attr('d', createLineGen('lane2Val'));
    }

    // Draw Lane 1 (Green / Automation)
    if (visibleLanes.lane1) {
      const areaGen1 = d3
        .area<TransitionPoint>()
        .x((_, i) => xScale(i))
        .y0(innerHeight)
        .y1((d) => yScale(d.lane1Val % 1.0))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(data)
        .attr('fill', 'url(#grad-lane-1)')
        .attr('d', areaGen1);

      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#39ff14')
        .attr('stroke-width', 2.2)
        .style('filter', 'drop-shadow(0 0 6px #39ff1455)')
        .attr('d', createLineGen('lane1Val'));
    }

    // Current transition indicators
    const lastIdx = data.length - 1;
    const latest = data[lastIdx];
    const lx = xScale(lastIdx);

    // Lane 1 Indicator Point
    if (visibleLanes.lane1) {
      const l1y = yScale(latest.lane1Val % 1.0);
      g.append('circle')
        .attr('cx', lx)
        .attr('cy', l1y)
        .attr('r', 4.5)
        .attr('fill', '#39ff14')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .style('filter', 'drop-shadow(0 0 8px #39ff14)');
    }

    // Lane 2 Indicator Point
    if (visibleLanes.lane2) {
      const l2y = yScale(latest.lane2Val % 1.0);
      g.append('circle')
        .attr('cx', lx)
        .attr('cy', l2y)
        .attr('r', 4.5)
        .attr('fill', cycleResult.sudostepActive ? '#ff0055' : '#ffb700')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .style('filter', 'drop-shadow(0 0 8px #ffb700)');
    }

    // Hover interactive crosshair overlay
    const overlay = g
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair');

    overlay.on('mousemove', (event) => {
      const [mx] = d3.pointer(event);
      const index = Math.round(xScale.invert(mx));
      if (index >= 0 && index < data.length) {
        setHoveredPoint(data[index]);
      }
    });

    overlay.on('mouseleave', () => setHoveredPoint(null));
  }, [cycleResult, activeView, visibleLanes]);

  const latestLanes = cycleResult.lanes;

  return (
    <div className="w-full flex flex-col bg-[#020407] border border-[#101d2a] rounded-xl overflow-hidden font-mono select-none">
      {/* Graph Toolbar */}
      <div className="p-3 bg-[#060a10] border-b border-[#101d2a] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff]">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-xs">
                REAL-TIME D3 FOUR-LANE TRANSITION GRAPH
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#39ff14]/10 text-[#39ff14] border border-[#39ff14]/30">
                0.1ms SYNC
              </span>
            </div>
            <span className="text-[10px] text-gray-400">
              Visualizing live coordinate curves, phase drift, and coaxial lock transitions
            </span>
          </div>
        </div>

        {/* View Selectors & Lane Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Buttons */}
          <div className="flex items-center bg-[#07121d] border border-gray-800 p-0.5 rounded-lg text-[10px]">
            <button
              onClick={() => setActiveView('FOUR_LANE')}
              className={`px-2 py-1 rounded font-bold transition-all ${
                activeView === 'FOUR_LANE'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              4-Lane Stream
            </button>
            <button
              onClick={() => setActiveView('OPPOSING_PAIR')}
              className={`px-2 py-1 rounded font-bold transition-all ${
                activeView === 'OPPOSING_PAIR'
                  ? 'bg-[#ffb700] text-black shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Opposing Pair
            </button>
            <button
              onClick={() => setActiveView('PHASE_SPACE')}
              className={`px-2 py-1 rounded font-bold transition-all ${
                activeView === 'PHASE_SPACE'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Phase Orbit
            </button>
          </div>

          {/* Toggle Individual Lanes */}
          <div className="hidden sm:flex items-center gap-1.5 text-[10px]">
            <button
              onClick={() => setVisibleLanes((p) => ({ ...p, lane1: !p.lane1 }))}
              className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
                visibleLanes.lane1
                  ? 'bg-[#39ff14]/15 border-[#39ff14]/40 text-[#39ff14] font-bold'
                  : 'bg-transparent border-gray-800 text-gray-500'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#39ff14]" />
              <span>L1 Auto</span>
            </button>

            <button
              onClick={() => setVisibleLanes((p) => ({ ...p, lane2: !p.lane2 }))}
              className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
                visibleLanes.lane2
                  ? 'bg-[#ffb700]/15 border-[#ffb700]/40 text-[#ffb700] font-bold'
                  : 'bg-transparent border-gray-800 text-gray-500'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffb700]" />
              <span>L2 Shadow</span>
            </button>

            <button
              onClick={() => setVisibleLanes((p) => ({ ...p, lane3: !p.lane3 }))}
              className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
                visibleLanes.lane3
                  ? 'bg-[#00f0ff]/15 border-[#00f0ff]/40 text-[#00f0ff] font-bold'
                  : 'bg-transparent border-gray-800 text-gray-500'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff]" />
              <span>L3 Whole</span>
            </button>

            <button
              onClick={() => setVisibleLanes((p) => ({ ...p, lane4: !p.lane4 }))}
              className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
                visibleLanes.lane4
                  ? 'bg-purple-500/15 border-purple-500/40 text-purple-300 font-bold'
                  : 'bg-transparent border-gray-800 text-gray-500'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span>L4 Inter</span>
            </button>
          </div>
        </div>
      </div>

      {/* D3 SVG Canvas Mount */}
      <div ref={containerRef} className="w-full h-56 sm:h-64 relative bg-[#010204]">
        <svg ref={svgRef} className="w-full h-full block" />

        {/* Hover Coordinate Overlay */}
        {hoveredPoint && (
          <div className="absolute top-2 left-2 bg-[#060a10]/95 backdrop-blur border border-[#101d2a] p-2 rounded text-[10px] space-y-0.5 pointer-events-none shadow-xl z-20">
            <div className="text-gray-400 font-bold">Step #{hoveredPoint.step}</div>
            <div className="text-[#39ff14]">Lane 1 (Auto): {(hoveredPoint.lane1Val % 1.0).toFixed(4)}</div>
            <div className="text-[#ffb700]">Lane 2 (Shadow): {(hoveredPoint.lane2Val % 1.0).toFixed(4)}</div>
            <div className="text-cyan-400">Lane 3: {(hoveredPoint.lane3Val % 1.0).toFixed(4)}</div>
            <div className="text-purple-400">Lane 4: {(hoveredPoint.lane4Val % 1.0).toFixed(4)}</div>
            <div className="text-amber-400 text-[9px] pt-1 border-t border-gray-800">
              Coaxial Lock: {hoveredPoint.coaxialLocked ? 'YES' : 'NO'} &bull; Power: {hoveredPoint.powerOhm}&Omega;
            </div>
          </div>
        )}
      </div>

      {/* Real-time Transition HUD Telemetry Ribbon */}
      <div className="p-2.5 bg-[#060a10] border-t border-[#101d2a] grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
        <div className="p-1.5 rounded bg-[#020407] border border-[#101d2a]">
          <span className="text-gray-500 block text-[9px]">L1 Auto Coord:</span>
          <span className="text-[#39ff14] font-bold">
            {(latestLanes[0].coordinateValue % 1.0).toFixed(4)}
          </span>
          <span className="text-gray-400 block text-[9px]">t={latestLanes[0].fractionalTimingIncrement}</span>
        </div>

        <div className="p-1.5 rounded bg-[#020407] border border-[#101d2a]">
          <span className="text-gray-500 block text-[9px]">L2 Shadow Coord:</span>
          <span className="text-[#ffb700] font-bold">
            {(latestLanes[1].coordinateValue % 1.0).toFixed(4)}
          </span>
          <span className="text-gray-400 block text-[9px]">t={latestLanes[1].fractionalTimingIncrement}</span>
        </div>

        <div className="p-1.5 rounded bg-[#020407] border border-[#101d2a]">
          <span className="text-gray-500 block text-[9px]">Coaxial Lock Phase:</span>
          <span
            className={`font-bold ${
              cycleResult.centerCoaxialLocked ? 'text-amber-400' : 'text-cyan-400'
            }`}
          >
            {cycleResult.centerCoaxialLocked ? 'FUSED (0.5)' : 'FREE ROTATION'}
          </span>
          <span className="text-gray-400 block text-[9px]">LU/RD Parity Intact</span>
        </div>

        <div className="p-1.5 rounded bg-[#020407] border border-[#101d2a]">
          <span className="text-gray-500 block text-[9px]">CMOS Permission:</span>
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400 inline" />
            AUTHORIZED
          </span>
          <span className="text-gray-400 block text-[9px]">Tethered at Source</span>
        </div>
      </div>
    </div>
  );
};
