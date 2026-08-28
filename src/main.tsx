import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CloudSun, Play, Pause } from 'lucide-react';
import { Header, TopologyGraph, SimulationControls, MeterRoleCard, DemandSupplyCurve } from './components';
import { lmpFor, optimizeTrades, seedMeters, simulateMetersForTick } from './simulation/model';
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
    const [selected, setSelected] = useState(seedMeters[0]);
    const [info, setInfo] = useState(false);
    const [pulse, setPulse] = useState(false);
    const [ledger, setLedger] = useState<Record<string, number>>({});
    const [sharedPartners, setSharedPartners] = useState<Record<string, string[]>>({});
    const [cumulativeBaseline, setCumulativeBaseline] = useState(0);
    const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);

    // Update real-time elapsed seconds since last simulation tick
    useEffect(() => {
        setSecondsSinceUpdate(0);
        const interval = setInterval(() => {
            setSecondsSinceUpdate(s => s + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [tick]);

    useEffect(() => {
        if (!playing) return;
        const ms = speed === '4x' ? 250 : speed === '2x' ? 500 : 1000;
        const id = window.setInterval(() => setTick(t => (t + 1) % 96), ms);
        return () => clearInterval(id);
    }, [playing, speed]);

    useEffect(() => {
        setPulse(true);
        const id = window.setTimeout(() => setPulse(false), 450);
        return () => clearTimeout(id);
    }, [tick]);

    const meters = useMemo(() => simulateMetersForTick(tick), [tick]);

    useEffect(() => {
        const current = meters.find(m => m.id === selected.id);
        if (current) setSelected(current);
    }, [meters]);

    const liveSelected = meters.find(m => m.id === selected.id) || meters[0];
    const supply = meters.reduce((sum, m) => sum + m.generation, 0);
    const demand = meters.reduce((sum, m) => sum + m.load, 0);

    const trades = useMemo(() => optimizeTrades(meters), [meters]);
    const lmp = useMemo(() => {
        // Average buyer unit price of current P2P trades, or dynamic lmpFor as fallback
        const totalDelivered = trades.reduce((sum, t) => sum + t.delivered, 0);
        if (totalDelivered > 1e-6) {
            return trades.reduce((sum, t) => sum + t.buyerUnitPrice * t.delivered, 0) / totalDelivered;
        }
        return lmpFor(supply, demand);
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

    useEffect(() => {
        if (!trades.length) return;
        setLedger(previous => {
            const next = { ...previous };
            trades.forEach(t => {
                const seller = meters.find(m => m.name === t.seller || m.id === t.seller);
                const buyer = meters.find(m => m.name === t.buyer || m.id === t.buyer);
                if (seller) {
                    const gain = t.sent * (t.energyPrice - 4.00);
                    next[seller.id] = (next[seller.id] || 0) + gain;
                }
                if (buyer) {
                    const saving = t.delivered * (7.00 - t.buyerUnitPrice);
                    next[buyer.id] = (next[buyer.id] || 0) + saving;
                }
            });
            return next;
        });

        // Track historical counterparties shared throughout the day
        setSharedPartners(prev => {
            const next = { ...prev };
            trades.forEach(t => {
                const seller = meters.find(m => m.name === t.seller || m.id === t.seller);
                const buyer = meters.find(m => m.name === t.buyer || m.id === t.buyer);
                if (seller && buyer) {
                    const sellerList = next[seller.id] || [];
                    if (!sellerList.includes(buyer.id)) {
                        next[seller.id] = [...sellerList, buyer.id];
                    }
                    const buyerList = next[buyer.id] || [];
                    if (!buyerList.includes(seller.id)) {
                        next[buyer.id] = [...buyerList, seller.id];
                    }
                }
            });
            return next;
        });

        const tickBaseline = trades.reduce((sum, t) => sum + t.kwh * 4.00, 0);
        setCumulativeBaseline(prev => prev + tickBaseline);
    }, [trades]);

    const recovered = Object.values(ledger).reduce((sum, value) => sum + value, 0);
    const uplift = cumulativeBaseline ? (recovered / cumulativeBaseline) * 100 : 0;

    // Generate historical data for 15 intervals to draw a smooth Supply-Demand curve
    const supplyDemandHistory = useMemo(() => {
        const history = [];
        for (let i = 14; i >= 0; i--) {
            const t = (tick - i + 96) % 96;
            const tickMeters = simulateMetersForTick(t);
            const s = tickMeters.reduce((sum, m) => sum + m.generation, 0);
            const d = tickMeters.reduce((sum, m) => sum + m.load, 0);
            history.push({ tick: t, supply: s, demand: d });
        }
        return history;
    }, [tick]);

    const reset = () => {
        setTick(62);
        setPlaying(true);
        setLedger({});
        setSharedPartners({});
        setCumulativeBaseline(0);
    };

    return (
        <div className="app">
            <Header onInfo={() => setInfo(true)} theme={theme} onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />
            <main>
                <section className="hero">
                    <div className="hero-stat-card">
                        <div className="stat-header">
                            <span className="stat-dot green" />
                            <span className="stat-title">SELECTED SMART METER</span>
                        </div>
                        <div className="stat-body">
                            <div className="stat-item">
                                <label>METER ID</label>
                                <span className="stat-val">{liveSelected.id}</span>
                            </div>
                            <div className="stat-item">
                                <label>NET CURRENT LOAD</label>
                                <span className="stat-val">{liveSelected.load.toFixed(2)} kW</span>
                            </div>
                            <div className="stat-item">
                                <label>NET CURRENT GENERATION</label>
                                <span className="stat-val">{liveSelected.generation.toFixed(2)} kW</span>
                            </div>
                        </div>
                        <div className="stat-footer">
                            <span className="updated-time">
                                Updated {secondsSinceUpdate}s ago (updated every 15 minutes)
                            </span>
                        </div>
                    </div>
                    <div className="hero-actions">
                        <button className="outline" onClick={() => setTick(30)}><CloudSun size={16} />Simulate cloud cover</button>
                        <button className="primary" onClick={() => setPlaying(!playing)}>
                            {playing ? <Pause size={16} /> : <Play size={16} />} {playing ? 'Pause demo' : 'Resume demo'}
                        </button>
                    </div>
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

                <div className="grid bottom" style={{ gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
                    <TopologyGraph
                        meters={meters}
                        selected={liveSelected}
                        onSelect={setSelected}
                        sharedPartners={sharedPartners[liveSelected.id] || []}
                        activePartners={activePartners}
                    />
                    <DemandSupplyCurve supply={supply} demand={demand} history={supplyDemandHistory} />
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
                    setPlaying={setPlaying}
                    speed={speed}
                    setSpeed={setSpeed}
                    tick={tick}
                    setTick={setTick}
                    reset={reset}
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
                        <p>GridShare uses seeded, client-side models of rooftop solar generation, household demand, bids, asks, and local matching. Nothing here connects to live meters, weather, utility systems, or external APIs.</p>
                        <p>Supply and demand feed the transparent Local Marginal Price. Compatible orders clear at that price, keeping more value in the neighbourhood.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

createRoot(document.getElementById('root')!).render(<App />);
