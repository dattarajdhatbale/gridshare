import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Play, Pause, RotateCcw, Zap, Sun, TrendingUp, Gauge } from 'lucide-react';
import { Header, TopologyGraph, SimulationControls, MeterRoleCard, DemandSupplyCurve } from './components';
import { Meter, Trade, seedMeters } from './simulation/model';
import './styles.css';

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
        fetch('/api/simulation/state')
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

        // Connect WebSocket (using relative path proxied by Vite config)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        const ws = new WebSocket(wsUrl);

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
        fetch('/api/simulation/history')
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
        fetch('/api/simulation/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playing: nextVal })
        }).catch(err => console.error("Failed to update play/pause state:", err));
    };

    const handleSetSpeed = (val: string | ((s: string) => string)) => {
        const nextVal = typeof val === 'function' ? val(speed) : val;
        fetch('/api/simulation/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ speed: nextVal })
        }).catch(err => console.error("Failed to update speed state:", err));
    };

    const handleSetTick = (val: number | ((t: number) => number)) => {
        const nextVal = typeof val === 'function' ? val(tick) : val;
        fetch('/api/simulation/tick', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tick: nextVal })
        }).catch(err => console.error("Failed to force tick value:", err));
    };

    const handleReset = () => {
        fetch('/api/simulation/reset', { method: 'POST' })
            .catch(err => console.error("Failed to reset simulation:", err));
    };

    return (
        <div className="app">
            <Header onInfo={() => setInfo(true)} theme={theme} onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />
            <main>
                <section className="hero">
                    <div className="hero-stat-card">
                        <div className="stat-header">
                            <div className="stat-header-left">
                                <span className="stat-dot green" />
                                <span className="stat-title">SELECTED SMART METER</span>
                            </div>
                            <span className="live-badge">
                                <span className="live-dot-small" /> LIVE
                            </span>
                        </div>
                        <div className="stat-body">
                            {/* Row 1: Meter ID and Relative Updated indicator */}
                            <div className="stat-item">
                                <label>METER ID</label>
                                <span className="stat-val">{liveSelected.id}</span>
                            </div>
                            <div className="stat-item text-right">
                                <span className="update-status-inline">
                                    <RotateCcw size={11} /> Updated {secondsSinceUpdate}s ago
                                </span>
                            </div>

                            {/* Row 2: Net Current Load and Peak Generation */}
                            <div className="stat-item">
                                <label>NET CURRENT LOAD</label>
                                <div className="stat-value-block">
                                    <Zap size={16} className="stat-icon load-icon" />
                                    <span className="stat-val">{liveSelected.load.toFixed(2)} kW</span>
                                </div>
                            </div>
                            <div className="stat-item text-right">
                                <label>PEAK GENERATION</label>
                                <div className="stat-value-block">
                                    <TrendingUp size={16} className="stat-icon peak-icon" />
                                    <span className="stat-val">
                                        {stats.peakKW.toFixed(2)} kW <i className="peak-time-val">@ {stats.peakTime}</i>
                                    </span>
                                </div>
                            </div>

                            {/* Row 3: Net Current Generation and Average Generation */}
                            <div className="stat-item">
                                <label>NET CURRENT GENERATION</label>
                                <div className="stat-value-block">
                                    <Sun size={16} className="stat-icon gen-icon" />
                                    <span className="stat-val">{liveSelected.generation.toFixed(2)} kW</span>
                                </div>
                            </div>
                            <div className="stat-item text-right">
                                <label>AVG GENERATION</label>
                                <div className="stat-value-block">
                                    <Gauge size={16} className="stat-icon avg-icon" />
                                    <span className="stat-val">{stats.avgKW.toFixed(2)} kW</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DemandSupplyCurve supply={supply} demand={demand} history={supplyDemandHistory} />
                </section>

                <div className="ticker">
                    <div>
                        <small>LOCAL SUPPLY</small>
                        <strong>{supply.toFixed(1)} <i>kW</i></strong>
                        <span className={supplyDelta === null ? 'muted' : supplyDelta >= 0 ? 'up' : 'down'}>
                            {supplyDelta === null ? '—' : `${supplyDelta >= 0 ? '↑' : '↓'} ${Math.abs(supplyDelta).toFixed(1)}%`}
                        </span>
                    </div>
                    <div>
                        <small>LOCAL DEMAND</small>
                        <strong>{demand.toFixed(1)} <i>kW</i></strong>
                        <span className={demandDelta === null ? 'muted' : demandDelta >= 0 ? 'up' : 'down'}>
                            {demandDelta === null ? '—' : `${demandDelta >= 0 ? '↑' : '↓'} ${Math.abs(demandDelta).toFixed(1)}%`}
                        </span>
                    </div>
                    <div className="lmp">
                        <small>LOCAL MARGINAL PRICE</small>
                        <strong>₹{lmp.toFixed(2)} <i>/ kWh</i></strong>
                        <span className="good">Both sides beat the grid default</span>
                    </div>
                    <div>
                        <small>COMMUNITY BENEFIT TODAY</small>
                        <strong>₹{recovered.toFixed(2)}</strong>
                        <span className={uplift >= 0 ? 'up' : 'down'}>
                            {cumulativeBaseline ? `${uplift >= 0 ? '↑' : '↓'} ${Math.abs(uplift).toFixed(0)}% vs FiT baseline` : '— vs FiT baseline'}
                        </span>
                    </div>
                </div>

                <TopologyGraph
                    meters={meters}
                    selected={liveSelected}
                    onSelect={setSelected}
                    sharedPartners={sharedPartners[liveSelected.id] || []}
                    activePartners={activePartners}
                />

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

                <footer>
                    <span><span className="live-dot" /> SIMULATED DATA · SEE HOW IT WORKS</span>
                    <span>GridShare prototype · Built for AVINYA 2026</span>
                </footer>
            </main>

            {info && (
                <div className="modal-backdrop" onClick={() => setInfo(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setInfo(false)}>×</button>
                        <label>HOW THIS WORKS</label>
                        <h2>A small, honest simulation.</h2>
                        <p>GridShare uses seeded, database-backed models of rooftop solar generation, household demand, bids, asks, and local matching. Nothing here connects to live meters, weather, utility systems, or external APIs.</p>
                        <p>Supply and demand feed the transparent Local Marginal Price. Compatible orders clear at that price, keeping more value in the neighbourhood.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

createRoot(document.getElementById('root')!).render(<App />);
