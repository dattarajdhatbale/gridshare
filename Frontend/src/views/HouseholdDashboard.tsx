import { useState, useMemo, useRef, useEffect } from 'react';
import { Header, TopologyGraph, SimulationControls, EnergyWalletCard, DemandSupplyCurve } from '../components';
import { Meter, Trade, PublicMeter } from '../simulation/model';
import { useSession } from '../auth/SessionContext';
import { Sun, Zap, TrendingUp, HelpCircle, ArrowUpRight, ArrowDownLeft, Info, Landmark, RotateCcw, Gauge } from 'lucide-react';

interface HouseholdDashboardProps {
  theme: 'dark' | 'light';
  setTheme: React.Dispatch<React.SetStateAction<'dark' | 'light'>>;
  setInfo: (val: boolean) => void;
  tick: number;
  playing: boolean;
  speed: string;
  meters: (Meter | PublicMeter)[];
  trades: Trade[];
  ledger: Record<string, number>;
  sharedPartners: Record<string, string[]>;
  cumulativeBaseline: number;
  secondsSinceUpdate: number;
  supplyDemandHistory: { tick: number; supply: number; demand: number }[];
  handleSetPlaying: (val: boolean) => void;
  handleSetSpeed: (val: string) => void;
  handleSetTick: (val: number) => void;
  handleReset: () => void;
}

export function HouseholdDashboard({
  theme,
  setTheme,
  setInfo,
  tick,
  playing,
  speed,
  meters,
  trades,
  ledger,
  sharedPartners,
  cumulativeBaseline,
  secondsSinceUpdate,
  supplyDemandHistory,
  handleSetPlaying,
  handleSetSpeed,
  handleSetTick,
  handleReset,
}: HouseholdDashboardProps) {
  const { meter, logout } = useSession();
  
  // Find active simulated/scoped meter for ourselves
  const liveMyMeter = useMemo(() => {
    return (meters.find(m => m.id === meter?.id) || meter) as Meter;
  }, [meters, meter]);

  const stats = useMemo(() => {
    if (!liveMyMeter || liveMyMeter.role === 'consumer') {
      return { peakKW: 0, peakTime: '—', avgKW: 0 };
    }
    const i = meters.findIndex(m => m.id === liveMyMeter.id);
    if (i === -1) return { peakKW: 0, peakTime: '—', avgKW: 0 };

    let totalGen = 0;
    let maxGen = 0;
    let maxTick = 0;

    const hash = (x: number) => {
      const s = Math.sin(x) * 10000;
      return s - Math.floor(s);
    };

    for (let t = 0; t < 96; t++) {
      const hour = (9 + t / 4) % 24;
      const daylight = Math.max(0, Math.min(1, Math.sin(((hour - 6) / 12) * Math.PI)));
      const r1 = hash(t * 13 + i * 37);
      const cloud = 0.72 + r1 * 0.33;
      const genKW = liveMyMeter.pv * daylight * cloud;
      totalGen += genKW;
      if (genKW > maxGen) {
        maxGen = genKW;
        maxTick = t;
      }
    }

    const avgKW = totalGen / 96;
    const peakHourVal = (9 + maxTick / 4) % 24;
    const hourPart = Math.floor(peakHourVal);
    const minPart = Math.floor((peakHourVal % 1) * 60);
    const timeString = `${hourPart.toString().padStart(2, '0')}:${minPart.toString().padStart(2, '0')}`;

    return {
      peakKW: maxGen,
      peakTime: timeString,
      avgKW: avgKW,
    };
  }, [liveMyMeter, meters]);

  // Clicked neighbour detail sidebar/state
  const [selectedNeighbour, setSelectedNeighbour] = useState<Meter | PublicMeter | null>(null);

  const supply = useMemo(() => {
    // Only count full meters we can read (usually we don't calculate global supply if scoped, but we can compute active scoped supply or fallback)
    const fullMeters = meters.filter(m => !('isCounterparty' in m)) as Meter[];
    if (fullMeters.length > 1) {
      return fullMeters.reduce((sum, m) => sum + m.generation, 0);
    }
    // Fallback based on history or seeds
    return supplyDemandHistory[supplyDemandHistory.length - 1]?.supply || 0;
  }, [meters, supplyDemandHistory]);

  const demand = useMemo(() => {
    const fullMeters = meters.filter(m => !('isCounterparty' in m)) as Meter[];
    if (fullMeters.length > 1) {
      return fullMeters.reduce((sum, m) => sum + m.load, 0);
    }
    return supplyDemandHistory[supplyDemandHistory.length - 1]?.demand || 0;
  }, [meters, supplyDemandHistory]);

  const lmp = useMemo(() => {
    const totalDelivered = trades.reduce((sum, t) => sum + t.delivered, 0);
    if (totalDelivered > 1e-6) {
      return trades.reduce((sum, t) => sum + t.buyerUnitPrice * t.delivered, 0) / totalDelivered;
    }
    if (supply === 0 && demand === 0) return 5.50;
    return Math.max(4.00, Math.min(7.00, (supply * 4.00 + demand * 7.00) / (supply + demand)));
  }, [trades, supply, demand]);

  // Active trade partner IDs in the current tick
  const activePartners = useMemo(() => {
    const list: string[] = [];
    trades.forEach(t => {
      if (t.seller === liveMyMeter.id || t.seller === liveMyMeter.name) {
        // We sold, so buyer is partner
        const partner = meters.find(m => m.name === t.buyer || m.id === t.buyer);
        if (partner) list.push(partner.id);
      } else if (t.buyer === liveMyMeter.id || t.buyer === liveMyMeter.name) {
        // We bought, so seller is partner
        const partner = meters.find(m => m.name === t.seller || m.id === t.seller);
        if (partner) list.push(partner.id);
      }
    });
    return list;
  }, [trades, liveMyMeter, meters]);

  // Total benefits
  const myEarned = ledger[liveMyMeter.id] || 0;

  const recovered = useMemo(() => {
    return Object.values(ledger).reduce((sum, value) => sum + value, 0);
  }, [ledger]);

  const uplift = useMemo(() => {
    return cumulativeBaseline ? (recovered / cumulativeBaseline) * 100 : 0;
  }, [recovered, cumulativeBaseline]);

  const previousFlow = useRef<{ supply: number; demand: number } | null>(null);
  const supplyDelta = previousFlow.current ? ((supply - previousFlow.current.supply) / previousFlow.current.supply) * 100 : null;
  const demandDelta = previousFlow.current ? ((demand - previousFlow.current.demand) / previousFlow.current.demand) * 100 : null;

  useEffect(() => {
    previousFlow.current = { supply, demand };
  }, [supply, demand]);

  // Plain-English trade sentences
  const tradeSentences = useMemo(() => {
    return trades.map(t => {
      const isSeller = t.seller === liveMyMeter.id || t.seller === liveMyMeter.name;
      const partnerName = isSeller ? t.buyer : t.seller;
      const partnerMeter = meters.find(m => m.name === partnerName || m.id === partnerName);
      const partnerLabel = partnerMeter ? partnerMeter.id : partnerName;

      const amt = t.delivered.toFixed(2);
      const rate = t.energyPrice.toFixed(2);
      const loss = (t.lossFrac * 100).toFixed(1);

      if (isSeller) {
        return {
          id: t.id,
          type: 'sell',
          text: `${amt} kWh to [${partnerLabel}]`,
          value: `+₹${t.sellerRevenue.toFixed(2)}`,
        };
      } else {
        return {
          id: t.id,
          type: 'buy',
          text: `${amt} kWh from [${partnerLabel}]`,
          value: `-₹${t.buyerPayment.toFixed(2)}`,
        };
      }
    });
  }, [trades, liveMyMeter, meters]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        onInfo={() => setInfo(true)}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        selectedMeter={liveMyMeter}
        lifetimeSavings={1248.50 + myEarned}
        trades={trades}
        sharedPartners={sharedPartners[liveMyMeter.id] || []}
      />
      <main className="w-full px-4 sm:px-6 my-0 py-3 pb-3 flex-1">
        

        {/* Section 1: Hero Home Analytics & Demand Supply Curve */}
        <section className="grid grid-cols-[1fr_2fr] gap-6 items-stretch mb-9 max-[850px]:flex max-[850px]:flex-col max-[850px]:gap-5">
          {/* My Home Hero Card */}
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[16px] p-6 shadow-[var(--card-shadow)] flex flex-col gap-3 min-w-[320px] max-w-full">
            <div className="flex justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--text-primary)] shadow-[0_0_8px_var(--lime-glow)]" />
                <span className="font-mono font-semibold text-[10px] tracking-[0.1em] text-[var(--text-secondary)]">SELECTED SMART METER</span>
              </div>
              <span className="inline-flex items-center gap-1.5 bg-[rgba(45,45,45,0.08)] border border-[rgba(45,45,45,0.18)] text-[var(--text-primary)] py-1 px-2.5 rounded-full font-sans font-bold text-[10px] tracking-[0.05em] uppercase leading-none dark:bg-[rgba(215,201,174,0.12)] dark:border-[rgba(215,201,174,0.22)] dark:text-[#D7C9AE]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-primary)] dark:bg-[#D7C9AE]" /> LIVE
              </span>
            </div>
            <div className="grid grid-cols-[1fr_1.15fr] gap-x-6 gap-y-4">
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[9px] font-medium text-[var(--text-muted)] tracking-[0.08em] uppercase">METER ID</label>
                <span className="font-semibold text-[20px] font-title text-[var(--text-primary)]">{liveMyMeter.id}</span>
              </div>
              <div className="flex flex-col gap-1 items-end justify-start">
                <span className="inline-flex items-center gap-1.25 font-mono text-[11px] text-[var(--text-muted)] mt-1">
                  <RotateCcw size={11} /> Updated {secondsSinceUpdate}s ago
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-mono text-[9px] font-medium text-[var(--text-muted)] tracking-[0.08em] uppercase">NET CURRENT LOAD</label>
                <div className="flex flex-col items-start gap-1.5 mt-1.5">
                  <Zap size={16} className="flex-shrink-0 opacity-85 text-[#C06B22] dark:text-[#E09852]" />
                  <span className="font-semibold text-[20px] font-title text-[var(--text-primary)]">{liveMyMeter.load.toFixed(2)} kW</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 items-end justify-start">
                <label className="font-mono text-[9px] font-medium text-[var(--text-muted)] tracking-[0.08em] uppercase">PEAK GENERATION</label>
                <div className="flex flex-col items-end gap-1.5 mt-1.5">
                  <TrendingUp size={16} className="flex-shrink-0 opacity-85 text-[var(--text-primary)] dark:text-[#D7C9AE]" />
                  <span className="font-semibold text-[20px] font-title text-[var(--text-primary)]">
                    {stats.peakKW.toFixed(2)} kW <i className="not-italic text-[11px] font-mono text-[var(--text-muted)] font-medium ml-0.5">@ {stats.peakTime}</i>
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-mono text-[9px] font-medium text-[var(--text-muted)] tracking-[0.08em] uppercase">NET CURRENT GENERATION</label>
                <div className="flex flex-col items-start gap-1.5 mt-1.5">
                  <Sun size={16} className="flex-shrink-0 opacity-85 text-[#C06B22] dark:text-[#E5C378]" />
                  <span className="font-semibold text-[20px] font-title text-[var(--text-primary)]">{liveMyMeter.generation.toFixed(2)} kW</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 items-end justify-start">
                <label className="font-mono text-[9px] font-medium text-[var(--text-muted)] tracking-[0.08em] uppercase">AVG GENERATION</label>
                <div className="flex flex-col items-end gap-1.5 mt-1.5">
                  <Gauge size={16} className="flex-shrink-0 opacity-85 text-[var(--text-secondary)]" />
                  <span className="font-semibold text-[20px] font-title text-[var(--text-primary)]">{stats.avgKW.toFixed(2)} kW</span>
                </div>
              </div>
            </div>
          </div>

          <DemandSupplyCurve supply={supply} demand={demand} history={supplyDemandHistory} />
        </section>

        <div className="grid grid-cols-4 bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow)] backdrop-blur-md rounded-[20px] mb-6 overflow-hidden max-[850px]:grid-cols-2 max-[520px]:grid-cols-1">
          <div className="p-5 px-6 border-r border-[var(--line)] flex flex-col justify-center max-[520px]:border-r-0 max-[520px]:border-b max-[520px]:border-[var(--line)]">
            <small className="flex gap-1.5 items-center font-semibold text-[10px] font-mono text-[var(--text-secondary)] uppercase">LOCAL SUPPLY</small>
            <strong className="block text-[28px] font-semibold font-title mt-1 mb-1 mx-0 text-[var(--text-primary)] tracking-[-0.02em]">{supply.toFixed(1)} <i className="font-mono font-medium text-[12px] text-[var(--text-secondary)] not-italic ml-1">kW</i></strong>
            <span className={supplyDelta === null ? 'font-mono text-[11px] flex gap-1 items-center font-medium text-[var(--text-secondary)]' : supplyDelta >= 0 ? 'font-mono text-[11px] flex gap-1 items-center font-medium text-[var(--text-primary)] dark:text-[#D7C9AE]' : 'font-mono text-[11px] flex gap-1 items-center font-medium text-[#C06B22] dark:text-[#E09852]'}>
              {supplyDelta === null ? '—' : `${supplyDelta >= 0 ? '↑' : '↓'} ${Math.abs(supplyDelta).toFixed(1)}%`}
            </span>
          </div>
          <div className="p-5 px-6 border-r border-[var(--line)] flex flex-col justify-center max-[850px]:border-r-0 max-[520px]:border-b max-[520px]:border-[var(--line)]">
            <small className="flex gap-1.5 items-center font-semibold text-[10px] font-mono text-[var(--text-secondary)] uppercase">LOCAL DEMAND</small>
            <strong className="block text-[28px] font-semibold font-title mt-1 mb-1 mx-0 text-[var(--text-primary)] tracking-[-0.02em]">{demand.toFixed(1)} <i className="font-mono font-medium text-[12px] text-[var(--text-secondary)] not-italic ml-1">kW</i></strong>
            <span className={demandDelta === null ? 'font-mono text-[11px] flex gap-1 items-center font-medium text-[var(--text-secondary)]' : demandDelta >= 0 ? 'font-mono text-[11px] flex gap-1 items-center font-medium text-[var(--text-primary)] dark:text-[#D7C9AE]' : 'font-mono text-[11px] flex gap-1 items-center font-medium text-[#C06B22] dark:text-[#E09852]'}>
              {demandDelta === null ? '—' : `${demandDelta >= 0 ? '↑' : '↓'} ${Math.abs(demandDelta).toFixed(1)}%`}
            </span>
          </div>
          <div className="p-5 px-6 border-r border-[var(--line)] flex flex-col justify-center bg-mint max-[850px]:border-t max-[850px]:border-[var(--line)] max-[520px]:border-r-0 max-[520px]:border-b max-[520px]:border-[var(--line)]">
            <small className="flex gap-1.5 items-center font-semibold text-[10px] font-mono text-[var(--text-secondary)] uppercase">LOCAL MARGINAL PRICE</small>
            <strong className="block text-[28px] font-semibold font-title mt-1 mb-1 mx-0 text-[var(--text-primary)] tracking-[-0.02em]">₹{lmp.toFixed(2)} <i className="font-mono font-medium text-[12px] text-[var(--text-secondary)] not-italic ml-1">/ kWh</i></strong>
            <span className="font-mono text-[11px] flex gap-1 items-center font-medium text-[var(--text-primary)] dark:text-[#D7C9AE]">Both sides beat the grid default</span>
          </div>
          <div className="p-5 px-6 flex flex-col justify-center max-[850px]:border-t max-[850px]:border-[var(--line)] max-[850px]:border-r-0">
            <small className="flex gap-1.5 items-center font-semibold text-[10px] font-mono text-[var(--text-secondary)] uppercase">COMMUNITY BENEFIT TODAY</small>
            <strong className="block text-[28px] font-semibold font-title mt-1 mb-1 mx-0 text-[var(--text-primary)] tracking-[-0.02em]">₹{recovered.toFixed(2)}</strong>
            <span className={uplift >= 0 ? 'font-mono text-[11px] flex gap-1 items-center font-medium text-[var(--text-primary)] dark:text-[#D7C9AE]' : 'font-mono text-[11px] flex gap-1 items-center font-medium text-[#C06B22] dark:text-[#E09852]'}>
              {cumulativeBaseline ? `${uplift >= 0 ? '↑' : '↓'} ${Math.abs(uplift).toFixed(0)}% vs FiT baseline` : '— vs FiT baseline'}
            </span>
          </div>
        </div>


        {/* Section 2: Topology Graph & Energy Wallet */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch mb-6">
          <TopologyGraph
            meters={meters}
            selected={liveMyMeter}
            onSelect={setSelectedNeighbour}
            sharedPartners={sharedPartners[liveMyMeter.id] || []}
            activePartners={activePartners}
          />
          <EnergyWalletCard
            meter={liveMyMeter}
            meters={meters as Meter[]}
            trades={trades}
            ledger={ledger}
            lmp={lmp}
            cumulativeBaseline={cumulativeBaseline}
          />
        </div>

        {/* Section 3: My Trades (Bilateral Energy Exchanges) */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[20px] p-6 shadow-[var(--card-shadow)] backdrop-blur-md relative overflow-hidden transition-all duration-300">
          <div className="flex justify-between items-center mb-4">
            <div>
              <label className="font-mono text-[10px] font-medium tracking-[0.12em] text-[var(--text-secondary)] uppercase">P2P EXCHANGE CONTRACTS</label>
              <h2 className="font-semibold text-[20px] font-title mt-1.5 mb-0 mx-0 tracking-[-0.02em] text-[var(--text-primary)]">My Energy Trades</h2>
            </div>
            <span className="font-mono text-[11px] font-bold text-[var(--text-secondary)] bg-[rgba(45,45,45,0.06)] dark:bg-[rgba(215,201,174,0.12)] py-1 px-3 rounded-full border border-[var(--line)]">
              {trades.length} Active Trades
            </span>
          </div>

          {tradeSentences.length > 0 ? (
            <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
              {tradeSentences.map((ts) => (
                <div 
                  key={ts.id} 
                  className="flex items-center justify-between bg-mint p-3.5 rounded-[14px] border border-[var(--card-border)] text-[13px] hover:bg-[rgba(45,45,45,0.02)] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      ts.type === 'sell' 
                        ? 'bg-[rgba(229,195,120,0.12)] text-[#E5C378]' 
                        : 'bg-[rgba(192,107,34,0.12)] text-[#C06B22]'
                    }`}>
                      {ts.type === 'sell' ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                    </div>
                    <span className="text-[var(--text-primary)] font-medium leading-relaxed">{ts.text}</span>
                  </div>
                  <strong className={`font-mono font-bold text-[14px] ml-4 ${
                    ts.type === 'sell' ? 'text-[#E5C378]' : 'text-[#C06B22]'
                  }`}>
                    {ts.value}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 bg-[rgba(0,0,0,0.01)] dark:bg-[rgba(255,255,255,0.01)] rounded-[14px] text-[13px] text-[var(--text-muted)] text-center border border-dashed border-[var(--line)]">
              No active P2P energy trades cleared in this simulation interval.
            </div>
          )}
        </div>

        {/* Section 4: Simulation Controls (ReadOnly state) */}
        <SimulationControls
          playing={playing}
          setPlaying={handleSetPlaying}
          speed={speed}
          setSpeed={handleSetSpeed}
          tick={tick}
          setTick={handleSetTick}
          reset={handleReset}
          disabled={true}
        />

        {/* Footer */}
        <footer className="mt-12 pt-6 pb-8 border-t border-[var(--line)] flex flex-col gap-4 text-[var(--text-muted)] font-mono text-[11px]">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
            <span>© {new Date().getFullYear()} GridShare. Decentralized local energy exchange protocol.</span>
            <span className="text-[var(--text-secondary)]">Local marginal pricing &amp; continuous double auction matching.</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
