import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Play, Pause, RotateCcw, Zap, Sun, TrendingUp, Gauge } from 'lucide-react';
import { Header, TopologyGraph, SimulationControls, MeterRoleCard, DemandSupplyCurve, EnergyWalletCard } from './components';
import { Meter, Trade, seedMeters } from './simulation/model';
import './styles.css';

const API_BASE_URL = 'https://gridshare.onrender.com';
const WS_BASE_URL = 'wss://gridshare.onrender.com/ws';

export default function App() {
    const [theme, setTheme] = useState<'dark' | 'light'>(() => {
        return (localStorage.getItem('gridshare-theme') as 'dark' | 'light') || 'dark';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('gridshare-theme', theme);
    }, [theme]);

    const [tick, setTick] = useState(62);
    const [playing, setPlaying] = useState(true);
    const [speed, setSpeed] = useState('1x');
    const [selected, setSelected] = useState<Meter>(seedMeters[0]);
    const [info, setInfo] = useState(false);
    const [pulse, setPulse] = useState(false);

    // States driven by backend
    const [meters, setMeters] = useState<Meter[]>(seedMeters);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [ledger, setLedger] = useState<Record<string, number>>({});
    const [sharedPartners, setSharedPartners] = useState<Record<string, string[]>>({});
    const [cumulativeBaseline, setCumulativeBaseline] = useState(0);
    const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
    const [supplyDemandHistory, setSupplyDemandHistory] = useState<{ tick: number; supply: number; demand: number }[]>([]);

    // Update real-time elapsed seconds since last simulation tick
    useEffect(() => {
        setSecondsSinceUpdate(0);
        const interval = setInterval(() => {
            setSecondsSinceUpdate(s => s + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [tick]);

    useEffect(() => {
        setPulse(true);
        const id = window.setTimeout(() => setPulse(false), 450);
        return () => clearTimeout(id);
    }, [tick]);

    // WebSocket / REST API sync connection
    useEffect(() => {
        // Fetch initial state first
        fetch(`${API_BASE_URL}/api/simulation/state`)
            .then(res => res.json())
            .then(data => {
                if (data.tick !== undefined) {
                    setTick(data.tick);
                    setPlaying(data.playing);
                    setSpeed(data.speed);
                    setCumulativeBaseline(data.cumulativeBaseline);
                    setMeters(data.meters);
                    setTrades(data.trades);
                    setLedger(data.ledger);
                    setSharedPartners(data.sharedPartners);
                }
            })
            .catch(err => console.error("Failed to load initial simulation state:", err));

        // Connect WebSocket to remote Render backend
        const ws = new WebSocket(WS_BASE_URL);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.tick !== undefined) {
                    setTick(data.tick);
                    setPlaying(data.playing);
                    setSpeed(data.speed);
                    setCumulativeBaseline(data.cumulativeBaseline);
                    setMeters(data.meters);
                    setTrades(data.trades);
                    setLedger(data.ledger);
                    setSharedPartners(data.sharedPartners);
                }
            } catch (e) {
                console.error("Error parsing socket broadcast payload:", e);
            }
        };

        ws.onerror = (err) => console.error("WebSocket connection error:", err);

        return () => ws.close();
    }, []);

    // Load supply-demand historical curve entries from backend
    useEffect(() => {
        fetch(`${API_BASE_URL}/api/simulation/history`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setSupplyDemandHistory(data);
                }
            })
            .catch(err => console.error("Failed to fetch simulation history:", err));
    }, [tick]);

    // Update frontend selection reference when meters update
    useEffect(() => {
        const current = meters.find(m => m.id === selected.id);
        if (current) setSelected(current);
    }, [meters]);

    const liveSelected = meters.find(m => m.id === selected.id) || meters[0];

    const stats = useMemo(() => {
        if (!liveSelected || liveSelected.role === 'consumer') {
            return { peakKW: 0, peakTime: '—', avgKW: 0 };
        }
        const i = meters.findIndex(m => m.id === liveSelected.id);
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
            const genKW = liveSelected.pv * daylight * cloud;
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
    }, [liveSelected, meters]);
    const supply = meters.reduce((sum, m) => sum + m.generation, 0);
    const demand = meters.reduce((sum, m) => sum + m.load, 0);

    const lmp = useMemo(() => {
        const totalDelivered = trades.reduce((sum, t) => sum + t.delivered, 0);
        if (totalDelivered > 1e-6) {
            return trades.reduce((sum, t) => sum + t.buyerUnitPrice * t.delivered, 0) / totalDelivered;
        }
        if (supply === 0 && demand === 0) return 5.50;
        return Math.max(4.00, Math.min(7.00, (supply * 4.00 + demand * 7.00) / (supply + demand)));
    }, [trades, supply, demand]);

    const previousFlow = useRef<{ supply: number; demand: number } | null>(null);
    const supplyDelta = previousFlow.current ? ((supply - previousFlow.current.supply) / previousFlow.current.supply) * 100 : null;
    const demandDelta = previousFlow.current ? ((demand - previousFlow.current.demand) / previousFlow.current.demand) * 100 : null;

    useEffect(() => {
        previousFlow.current = { supply, demand };
    }, [supply, demand]);

    // Active trade partners for the selected meter in the current tick
    const activePartners = useMemo(() => {
        const list: string[] = [];
        trades.forEach(t => {
            const seller = meters.find(m => m.name === t.seller || m.id === t.seller);
            const buyer = meters.find(m => m.name === t.buyer || m.id === t.buyer);
            if (seller && buyer) {
                if (seller.id === liveSelected.id) {
                    list.push(buyer.id);
                } else if (buyer.id === liveSelected.id) {
                    list.push(seller.id);
                }
            }
        });
        return list;
    }, [trades, liveSelected, meters]);

    const recovered = Object.values(ledger).reduce((sum, value) => sum + value, 0);
    const uplift = cumulativeBaseline ? (recovered / cumulativeBaseline) * 100 : 0;

    // Control Handlers communicating to server APIs
    const handleSetPlaying = (val: boolean | ((p: boolean) => boolean)) => {
        const nextVal = typeof val === 'function' ? val(playing) : val;
        fetch(`${API_BASE_URL}/api/simulation/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playing: nextVal })
        }).catch(err => console.error("Failed to update play/pause state:", err));
    };

    const handleSetSpeed = (val: string | ((s: string) => string)) => {
        const nextVal = typeof val === 'function' ? val(speed) : val;
        fetch(`${API_BASE_URL}/api/simulation/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ speed: nextVal })
        }).catch(err => console.error("Failed to update speed state:", err));
    };

    const handleSetTick = (val: number | ((t: number) => number)) => {
        const nextVal = typeof val === 'function' ? val(tick) : val;
        fetch(`${API_BASE_URL}/api/simulation/tick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tick: nextVal })
        }).catch(err => console.error("Failed to force tick value:", err));
    };

    const handleReset = () => {
        fetch(`${API_BASE_URL}/api/simulation/reset`, { method: 'POST' })
            .catch(err => console.error("Failed to reset simulation:", err));
    };

    return (
        <div className="min-h-screen flex flex-col">
            <Header
                onInfo={() => setInfo(true)}
                theme={theme}
                onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                selectedMeter={liveSelected}
                lifetimeSavings={1248.50 + (ledger[liveSelected.id] || 0)}
            />
            <main className="max-w-[1260px] w-full mx-auto my-0 py-10 px-2 sm:px-4 pb-[30px] flex-1">
                <section className="grid grid-cols-[1fr_2fr] gap-6 items-stretch mb-9 max-[850px]:flex max-[850px]:flex-col max-[850px]:gap-5">
                    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[16px] p-6 shadow-[var(--card-shadow)] flex flex-col gap-3 min-w-[320px] max-w-full">
                        <div className="flex justify-between items-center gap-2">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-lime shadow-[0_0_8px_var(--lime-glow)]" />
                                <span className="font-mono font-semibold text-[10px] tracking-[0.1em] text-[var(--text-secondary)]">SELECTED SMART METER</span>
                            </div>
                            <span className="inline-flex items-center gap-1.5 bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.15)] text-lime py-1 px-2.5 rounded-full font-sans font-bold text-[10px] tracking-[0.05em] uppercase leading-none dark:bg-[rgba(0,255,136,0.08)] dark:border-[rgba(0,255,136,0.18)] dark:text-[#00ff88]">
                                <span className="w-1.5 h-1.5 rounded-full bg-lime dark:bg-[#00ff88]" /> LIVE
                            </span>
                        </div>
                        <div className="grid grid-cols-[1fr_1.15fr] gap-x-6 gap-y-4">
                            {/* Row 1: Meter ID and Relative Updated indicator */}
                            <div className="flex flex-col gap-1">
                                <label className="font-mono text-[9px] font-medium text-[var(--text-muted)] tracking-[0.08em] uppercase">METER ID</label>
                                <span className="font-semibold text-[20px] font-title text-[var(--text-primary)]">{liveSelected.id}</span>
                            </div>
                            <div className="flex flex-col gap-1 items-end justify-start">
                                <span className="inline-flex items-center gap-1.25 font-mono text-[11px] text-[var(--text-muted)] mt-1">
                                    <RotateCcw size={11} /> Updated {secondsSinceUpdate}s ago
                                </span>
                            </div>

                            {/* Row 2: Net Current Load and Peak Generation */}
                            <div className="flex flex-col gap-1">
                                <label className="font-mono text-[9px] font-medium text-[var(--text-muted)] tracking-[0.08em] uppercase">NET CURRENT LOAD</label>
                                <div className="flex flex-col items-start gap-1.5 mt-1.5">
                                    <Zap size={16} className="flex-shrink-0 opacity-85 text-orange" />
                                    <span className="font-semibold text-[20px] font-title text-[var(--text-primary)]">{liveSelected.load.toFixed(2)} kW</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1 items-end justify-start">
                                <label className="font-mono text-[9px] font-medium text-[var(--text-muted)] tracking-[0.08em] uppercase">PEAK GENERATION</label>
                                <div className="flex flex-col items-end gap-1.5 mt-1.5">
                                    <TrendingUp size={16} className="flex-shrink-0 opacity-85 text-lime" />
                                    <span className="font-semibold text-[20px] font-title text-[var(--text-primary)]">
                                        {stats.peakKW.toFixed(2)} kW <i className="not-italic text-[11px] font-mono text-[var(--text-muted)] font-medium ml-0.5">@ {stats.peakTime}</i>
                                    </span>
                                </div>
                            </div>

                            {/* Row 3: Net Current Generation and Average Generation */}
                            <div className="flex flex-col gap-1">
                                <label className="font-mono text-[9px] font-medium text-[var(--text-muted)] tracking-[0.08em] uppercase">NET CURRENT GENERATION</label>
                                <div className="flex flex-col items-start gap-1.5 mt-1.5">
                                    <Sun size={16} className="flex-shrink-0 opacity-85 text-lime" />
                                    <span className="font-semibold text-[20px] font-title text-[var(--text-primary)]">{liveSelected.generation.toFixed(2)} kW</span>
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
                        <span className={supplyDelta === null ? 'font-mono text-[11px] flex gap-1 items-center font-medium text-[var(--text-secondary)]' : supplyDelta >= 0 ? 'font-mono text-[11px] flex gap-1 items-center font-medium text-[#10b981]' : 'font-mono text-[11px] flex gap-1 items-center font-medium text-[var(--orange)]'}>
                            {supplyDelta === null ? '—' : `${supplyDelta >= 0 ? '↑' : '↓'} ${Math.abs(supplyDelta).toFixed(1)}%`}
                        </span>
                    </div>
                    <div className="p-5 px-6 border-r border-[var(--line)] flex flex-col justify-center max-[850px]:border-r-0 max-[520px]:border-b max-[520px]:border-[var(--line)]">
                        <small className="flex gap-1.5 items-center font-semibold text-[10px] font-mono text-[var(--text-secondary)] uppercase">LOCAL DEMAND</small>
                        <strong className="block text-[28px] font-semibold font-title mt-1 mb-1 mx-0 text-[var(--text-primary)] tracking-[-0.02em]">{demand.toFixed(1)} <i className="font-mono font-medium text-[12px] text-[var(--text-secondary)] not-italic ml-1">kW</i></strong>
                        <span className={demandDelta === null ? 'font-mono text-[11px] flex gap-1 items-center font-medium text-[var(--text-secondary)]' : demandDelta >= 0 ? 'font-mono text-[11px] flex gap-1 items-center font-medium text-[#10b981]' : 'font-mono text-[11px] flex gap-1 items-center font-medium text-[var(--orange)]'}>
                            {demandDelta === null ? '—' : `${demandDelta >= 0 ? '↑' : '↓'} ${Math.abs(demandDelta).toFixed(1)}%`}
                        </span>
                    </div>
                    <div className="p-5 px-6 border-r border-[var(--line)] flex flex-col justify-center bg-mint max-[850px]:border-t max-[850px]:border-[var(--line)] max-[520px]:border-r-0 max-[520px]:border-b max-[520px]:border-[var(--line)]">
                        <small className="flex gap-1.5 items-center font-semibold text-[10px] font-mono text-[var(--text-secondary)] uppercase">LOCAL MARGINAL PRICE</small>
                        <strong className="block text-[28px] font-semibold font-title mt-1 mb-1 mx-0 text-lime tracking-[-0.02em]">₹{lmp.toFixed(2)} <i className="font-mono font-medium text-[12px] text-[var(--text-secondary)] not-italic ml-1">/ kWh</i></strong>
                        <span className="font-mono text-[11px] flex gap-1 items-center font-medium text-[#10b981]">Both sides beat the grid default</span>
                    </div>
                    <div className="p-5 px-6 flex flex-col justify-center max-[850px]:border-t max-[850px]:border-[var(--line)] max-[850px]:border-r-0">
                        <small className="flex gap-1.5 items-center font-semibold text-[10px] font-mono text-[var(--text-secondary)] uppercase">COMMUNITY BENEFIT TODAY</small>
                        <strong className="block text-[28px] font-semibold font-title mt-1 mb-1 mx-0 text-[var(--text-primary)] tracking-[-0.02em]">₹{recovered.toFixed(2)}</strong>
                        <span className={uplift >= 0 ? 'font-mono text-[11px] flex gap-1 items-center font-medium text-[#10b981]' : 'font-mono text-[11px] flex gap-1 items-center font-medium text-[var(--orange)]'}>
                            {cumulativeBaseline ? `${uplift >= 0 ? '↑' : '↓'} ${Math.abs(uplift).toFixed(0)}% vs FiT baseline` : '— vs FiT baseline'}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch mb-6">
                    <TopologyGraph
                        meters={meters}
                        selected={liveSelected}
                        onSelect={setSelected}
                        sharedPartners={sharedPartners[liveSelected.id] || []}
                        activePartners={activePartners}
                    />
                    <EnergyWalletCard
                        meter={liveSelected}
                        meters={meters}
                        trades={trades}
                        ledger={ledger}
                        lmp={lmp}
                        cumulativeBaseline={cumulativeBaseline}
                    />
                </div>

                <MeterRoleCard
                    meter={liveSelected}
                    meters={meters}
                    lmp={lmp}
                    trades={trades}
                    earned={ledger[liveSelected.id] || 0}
                />

                <SimulationControls
                    playing={playing}
                    setPlaying={handleSetPlaying}
                    speed={speed}
                    setSpeed={handleSetSpeed}
                    tick={tick}
                    setTick={handleSetTick}
                    reset={handleReset}
                />

                <footer className="flex justify-between text-[var(--text-muted)] font-mono text-[11px] pt-6 px-1 pb-3 border-t border-[var(--line)] mt-10 max-[520px]:block max-[520px]:leading-[2]">
                    <span className="flex items-center gap-2"><span className="inline-block w-2 h-2 bg-[#10b981] rounded-full shadow-[0_0_0_4px_var(--lime-glow)] animate-pulse" /> SIMULATED DATA · SEE HOW IT WORKS</span>
                    <span>GridShare prototype · Built for AVINYA 2026</span>
                </footer>
            </main>

            {info && (
                <div className="fixed inset-0 bg-[rgba(4,12,10,0.7)] backdrop-blur-[8px] z-[200] grid place-items-center p-5" onClick={() => setInfo(false)}>
                    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[20px] max-w-[460px] w-full p-8 relative shadow-[var(--card-shadow)] backdrop-blur-[24px] animate-[scaleUp_0.3s_cubic-bezier(0.16,1,0.3,1)]" onClick={e => e.stopPropagation()}>
                        <button className="absolute right-[18px] top-[14px] border-0 bg-transparent text-[26px] text-[var(--text-secondary)] cursor-pointer transition-colors duration-200 hover:text-[var(--red)]" onClick={() => setInfo(false)}>×</button>
                        <label className="font-mono text-[10px] font-medium tracking-[0.12em] text-[var(--text-secondary)] uppercase">HOW THIS WORKS</label>
                        <h2 className="font-semibold text-[24px] font-title my-3 mx-0 text-[var(--text-primary)]">A small, honest simulation.</h2>
                        <p className="text-[var(--text-secondary)] text-[14px] leading-[1.6]">GridShare uses seeded, database-backed models of rooftop solar generation, household demand, bids, asks, and local matching. Nothing here connects to live meters, weather, utility systems, or external APIs.</p>
                        <p className="text-[var(--text-secondary)] text-[14px] leading-[1.6] mt-4">Supply and demand feed the transparent Local Marginal Price. Compatible orders clear at that price, keeping more value in the neighbourhood.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

createRoot(document.getElementById('root')!).render(<App />);
