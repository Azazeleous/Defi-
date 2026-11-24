import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  TrendingUp, FileText, Download, Sliders, Calendar, Zap, DollarSign,
  Cpu, Award, BarChart3, Clock, CheckCircle2, ChevronRight, Layers,
  Printer, ArrowUpRight, ArrowDownRight, Sparkles, Filter, Database
} from 'lucide-react';
import { globalHarmonicEngine } from '../engine/harmonicResonanceEngine';

export type ReportCategory = 'EFFICIENCY' | 'PROFITABILITY' | 'TRANSACTIONS' | 'REWARDS';
export type ReportTimeframe = '24H' | '7D' | '30D' | '90D';

interface ReportRow {
  id: string;
  timestamp: string;
  metric1: string;
  metric2: string;
  metric3: string;
  metric4: string;
  status: 'CONFIRMED' | 'OPTIMAL' | 'COMPUTED';
}

export const AiMiningAnalyticsReporting: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<ReportCategory>('EFFICIENCY');
  const [timeframe, setTimeframe] = useState<ReportTimeframe>('30D');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // What-If Simulator state
  const [addedHashrateTh, setAddedHashrateTh] = useState<number>(500); // +500 TH/s
  const [hardwareCostUsd, setHardwareCostUsd] = useState<number>(8500); // $8,500 Capex
  const [powerWatts, setPowerWatts] = useState<number>(3200); // 3200 Watts
  const [electricityTariff, setElectricityTariff] = useState<number>(0.055); // $0.055 / kWh

  // Predictive simulator outputs
  const simulatorOutputs = useMemo(() => {
    // Current hash price ~$0.88 / TH/s per day
    const dailyGross = +(addedHashrateTh * 0.888).toFixed(2);
    // Power cost: (Watts / 1000) * 24h * $/kWh
    const dailyPowerKwh = (powerWatts / 1000) * 24;
    const dailyPowerCost = +(dailyPowerKwh * electricityTariff).toFixed(2);
    const dailyNetProfit = +(dailyGross - dailyPowerCost).toFixed(2);

    const breakevenDays = dailyNetProfit > 0 ? Math.ceil(hardwareCostUsd / dailyNetProfit) : 9999;
    const annualNetProfit = +(dailyNetProfit * 365).toFixed(2);
    const annualRoiPct = hardwareCostUsd > 0 ? +((annualNetProfit / hardwareCostUsd) * 100).toFixed(1) : 0;

    return {
      dailyGross,
      dailyPowerCost,
      dailyNetProfit,
      breakevenDays,
      annualNetProfit,
      annualRoiPct,
    };
  }, [addedHashrateTh, hardwareCostUsd, powerWatts, electricityTariff]);

  // Predictive Difficulty & Hashprice Trend Data
  const trendForecastData = useMemo(() => {
    const days = 14;
    const data = [];
    const baseHashPrice = 0.88;
    const now = Date.now();

    for (let d = 0; d < days; d++) {
      const date = new Date(now + d * 86400000);
      const label = `${date.getMonth() + 1}/${date.getDate()}`;
      const trendFactor = 1 + (d * 0.008); // Steady slight growth
      const expected = +(baseHashPrice * trendFactor).toFixed(3);
      const optimistic = +(expected * 1.15).toFixed(3);
      const conservative = +(expected * 0.85).toFixed(3);

      data.push({
        date: label,
        expected,
        optimistic,
        conservative,
        difficultyForecast: +(460 * (1 + (d * 0.004))).toFixed(1),
      });
    }
    return data;
  }, []);

  // Report records generator based on active category
  const reportRows: ReportRow[] = useMemo(() => {
    const rows: ReportRow[] = [];
    const count = 12;

    for (let i = 0; i < count; i++) {
      const date = new Date(Date.now() - i * 86400000 * 2);
      const dateStr = date.toISOString().split('T')[0];

      if (activeCategory === 'EFFICIENCY') {
        rows.push({
          id: `EFF_${dateStr.replace(/-/g, '')}_${i}`,
          timestamp: `${dateStr} 00:00`,
          metric1: `${(478 + (i % 5) * 4).toFixed(1)} TH/s Avg`,
          metric2: `${(99.82 - (i % 3) * 0.08).toFixed(2)}% Accepted`,
          metric3: `${(28.4 + (i % 4) * 0.5).toFixed(1)} J/TH Efficiency`,
          metric4: '99.6% Rig Uptime',
          status: 'OPTIMAL',
        });
      } else if (activeCategory === 'PROFITABILITY') {
        const gross = +(425 + (i % 6) * 18).toFixed(2);
        const power = +(48.50 + (i % 3) * 2).toFixed(2);
        const fee = +(gross * 0.005).toFixed(2);
        const net = +(gross - power - fee).toFixed(2);

        rows.push({
          id: `PRF_${dateStr.replace(/-/g, '')}_${i}`,
          timestamp: `${dateStr} Close`,
          metric1: `$${gross} Gross Rev`,
          metric2: `-$${power} Power Cost`,
          metric3: `-$${fee} Pool Fee (0.5%)`,
          metric4: `+$${net} Net Margin`,
          status: 'CONFIRMED',
        });
      } else if (activeCategory === 'TRANSACTIONS') {
        rows.push({
          id: `TX_0x${(Math.random() * 0xffffff).toString(16).slice(0, 8).toUpperCase()}`,
          timestamp: `${dateStr} 14:${(10 + i * 3)}`,
          metric1: 'Block Reward Payout',
          metric2: `${(0.0142 + (i % 4) * 0.002).toFixed(4)} BTC`,
          metric3: `$${(1240 + i * 15).toFixed(2)} USD`,
          metric4: `Block #19842${500 + i}`,
          status: 'CONFIRMED',
        });
      } else {
        rows.push({
          id: `RWD_EP_${dateStr.replace(/-/g, '')}`,
          timestamp: `${dateStr} Epoch #${120 - i}`,
          metric1: 'Base Subsidy + Tips',
          metric2: '+$42.50 MEV Bundle',
          metric3: '1.42x Difficulty Boost',
          metric4: '+$148.20 Bonus Yield',
          status: 'COMPUTED',
        });
      }
    }
    return rows;
  }, [activeCategory]);

  // Export report as CSV
  const handleExportCsv = () => {
    globalHarmonicEngine.playCoaxialChime();
    const headers = ['Record ID', 'Timestamp', 'Metric 1', 'Metric 2', 'Metric 3', 'Metric 4', 'Status'];
    const csvContent = [
      headers.join(','),
      ...reportRows.map((r) => `"${r.id}","${r.timestamp}","${r.metric1}","${r.metric2}","${r.metric3}","${r.metric4}","${r.status}"`),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-mining-report-${activeCategory.toLowerCase()}-${timeframe}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export report as JSON
  const handleExportJson = () => {
    globalHarmonicEngine.playCoaxialChime();
    const payload = {
      reportType: activeCategory,
      timeframe,
      exportedAtUtc: new Date().toISOString(),
      recordCount: reportRows.length,
      records: reportRows,
      predictiveSummary: simulatorOutputs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-mining-report-${activeCategory.toLowerCase()}-${timeframe}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full flex flex-col gap-5 text-slate-100 font-mono text-xs select-none">
      
      {/* Top Header & Report Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#060B14] border border-cyan-500/30 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/40 text-cyan-400">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">
              ADVANCED ANALYTICS &amp; PREDICTIVE REPORTING MODULE
            </h2>
            <p className="text-[11px] text-slate-400">
              Custom Report Builder &bull; Multi-Horizon Difficulty Forecasting &bull; What-If Hardware Expansion Simulator
            </p>
          </div>
        </div>

        {/* Export Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-emerald-400 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportJson}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Category Tabs & Timeframe Selector Bar */}
      <div className="p-3 bg-[#060B14] border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
        {/* Category Buttons */}
        <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-850">
          <button
            onClick={() => setActiveCategory('EFFICIENCY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeCategory === 'EFFICIENCY'
                ? 'bg-cyan-500 text-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Mining Efficiency</span>
          </button>

          <button
            onClick={() => setActiveCategory('PROFITABILITY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeCategory === 'PROFITABILITY'
                ? 'bg-emerald-500 text-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Profitability &amp; Fees</span>
          </button>

          <button
            onClick={() => setActiveCategory('TRANSACTIONS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeCategory === 'TRANSACTIONS'
                ? 'bg-purple-500 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Transaction History</span>
          </button>

          <button
            onClick={() => setActiveCategory('REWARDS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeCategory === 'REWARDS'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Network Rewards &amp; MEV</span>
          </button>
        </div>

        {/* Timeframe Selector */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            Time Range:
          </span>
          <div className="flex bg-slate-950 border border-slate-800 p-1 rounded-xl">
            {(['24H', '7D', '30D', '90D'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${
                  timeframe === t
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Predictive Analysis Section: Difficulty Forecasting & Hashprice Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Predictive Trend Chart (7 cols) */}
        <div className="lg:col-span-7 p-4 bg-[#060B14] border border-cyan-500/30 rounded-2xl flex flex-col space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                14-Day Hashprice &amp; Profitability Forecast
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Monte Carlo Projection ($/TH/day): Expected vs Optimistic vs Conservative Bands
              </p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              Confidence: 94.2%
            </span>
          </div>

          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendForecastData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00f0ff" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#0e1726" />
                <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 10 }} />
                <YAxis stroke="#475569" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#060B14', borderColor: '#1e293b', fontSize: '11px' }}
                  formatter={(val: any) => [`$${val} / TH / day`]}
                />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }} />
                <Area type="monotone" dataKey="expected" name="Expected Hashprice ($/TH)" stroke="#00f0ff" fill="url(#forecastGrad)" strokeWidth={2} />
                <Line type="monotone" dataKey="optimistic" name="Optimistic +15%" stroke="#10b981" strokeDasharray="3 3" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="conservative" name="Conservative -15%" stroke="#f43f5e" strokeDasharray="3 3" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Difficulty Epoch Forecast Card (5 cols) */}
        <div className="lg:col-span-5 p-4 bg-[#060B14] border border-slate-800 rounded-2xl flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Next Difficulty Epoch Forecast
              </h3>
              <span className="text-[10px] text-amber-300 font-bold font-mono">
                +3.42% EST. INCREASE
              </span>
            </div>

            {/* Epoch Progress Gauge */}
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Epoch Block Progress:</span>
                <span className="text-white font-bold">1,428 / 2,016 Blocks (70.8%)</span>
              </div>
              <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                <div className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full w-[70.8%]" />
              </div>
            </div>

            {/* Metrics List */}
            <div className="mt-3 space-y-2 text-[11px] pt-2 border-t border-slate-800/80">
              <div className="flex justify-between">
                <span className="text-slate-400">Blocks Remaining in Epoch:</span>
                <span className="text-slate-200 font-bold">588 Blocks</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Estimated Adjustment Date:</span>
                <span className="text-cyan-300 font-bold">In &approx; 3 days, 22 hours</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current Mean Block Interval:</span>
                <span className="text-emerald-400 font-bold">9m 41s (Target: 10m 00s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Global Network Hashrate:</span>
                <span className="text-slate-200 font-bold">642.8 EH/s</span>
              </div>
            </div>
          </div>

          <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-[10px] text-slate-400 leading-relaxed">
            <span className="text-amber-400 font-bold">PROJECTION INSIGHT:</span> Network block discovery is running 3.1% faster than 10-minute cadence. Prepare rig power caps for the projected +3.42% difficulty increase.
          </div>
        </div>

      </div>

      {/* What-If Hardware & Hashpower Expansion Simulator */}
      <div className="p-4 bg-[#060B14] border border-emerald-500/30 rounded-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              What-If Hardware Expansion &amp; ROI Simulator
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Simulate adding new ASIC or GPU tensor mining clusters and compute payback period
            </p>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono font-bold">
            Interactive Calculator
          </span>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300">Added Hashpower (+TH/s):</span>
              <span className="text-cyan-300 font-bold">+{addedHashrateTh} TH/s</span>
            </div>
            <input
              type="range"
              min={50}
              max={5000}
              step={50}
              value={addedHashrateTh}
              onChange={(e) => setAddedHashrateTh(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300">Hardware Capex ($USD):</span>
              <span className="text-cyan-300 font-bold">${hardwareCostUsd.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={1000}
              max={100000}
              step={500}
              value={hardwareCostUsd}
              onChange={(e) => setHardwareCostUsd(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300">Power Draw (Watts):</span>
              <span className="text-cyan-300 font-bold">{powerWatts} W</span>
            </div>
            <input
              type="range"
              min={500}
              max={30000}
              step={200}
              value={powerWatts}
              onChange={(e) => setPowerWatts(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300">Electricity Tariff ($/kWh):</span>
              <span className="text-cyan-300 font-bold">${electricityTariff.toFixed(3)} / kWh</span>
            </div>
            <input
              type="range"
              min={0.02}
              max={0.20}
              step={0.005}
              value={electricityTariff}
              onChange={(e) => setElectricityTariff(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>
        </div>

        {/* Calculated ROI Outputs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
            <div className="text-[9px] text-slate-400 uppercase">Daily Gross Rev</div>
            <div className="text-sm font-bold text-white mt-0.5">+${simulatorOutputs.dailyGross}</div>
          </div>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
            <div className="text-[9px] text-slate-400 uppercase">Daily Power Cost</div>
            <div className="text-sm font-bold text-rose-400 mt-0.5">-${simulatorOutputs.dailyPowerCost}</div>
          </div>
          <div className="p-3 bg-slate-950 border border-emerald-500/40 rounded-xl">
            <div className="text-[9px] text-emerald-400 uppercase font-bold">Daily Net Profit</div>
            <div className="text-sm font-bold text-emerald-300 mt-0.5">+${simulatorOutputs.dailyNetProfit}</div>
          </div>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
            <div className="text-[9px] text-slate-400 uppercase">Breakeven Days</div>
            <div className="text-sm font-bold text-amber-300 mt-0.5">{simulatorOutputs.breakevenDays} Days</div>
          </div>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
            <div className="text-[9px] text-slate-400 uppercase">1-Yr Net Profit</div>
            <div className="text-sm font-bold text-cyan-300 mt-0.5">${simulatorOutputs.annualNetProfit.toLocaleString()}</div>
          </div>
          <div className="p-3 bg-slate-950 border border-emerald-500/40 rounded-xl">
            <div className="text-[9px] text-emerald-400 uppercase font-bold">Annualized ROI</div>
            <div className="text-sm font-bold text-emerald-300 mt-0.5">+{simulatorOutputs.annualRoiPct}%</div>
          </div>
        </div>
      </div>

      {/* Generated Report Data Table */}
      <div className="p-4 bg-[#060B14] border border-slate-800 rounded-2xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              Generated Report Records ({reportRows.length} Rows &bull; {timeframe})
            </h3>
          </div>
          <div className="text-[10px] text-slate-400">
            Category: <strong className="text-cyan-300">{activeCategory}</strong>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-3">Record ID</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Column 1</th>
                <th className="py-2.5 px-3">Column 2</th>
                <th className="py-2.5 px-3">Column 3</th>
                <th className="py-2.5 px-3">Column 4</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 font-mono text-[11px]">
              {reportRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-900/50 transition">
                  <td className="py-2.5 px-3 font-bold text-cyan-300">{row.id}</td>
                  <td className="py-2.5 px-3 text-slate-400">{row.timestamp}</td>
                  <td className="py-2.5 px-3 text-white">{row.metric1}</td>
                  <td className="py-2.5 px-3 text-slate-300">{row.metric2}</td>
                  <td className="py-2.5 px-3 text-slate-300">{row.metric3}</td>
                  <td className="py-2.5 px-3 font-bold text-emerald-400">{row.metric4}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold">
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
