import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { API_BASE_URL, WS_BASE_URL } from './config';
import { SessionProvider, useSession } from './auth/SessionContext';
import { authFetch } from './auth/api';
import { LoginScreen, LoadingScreen } from './components';
import { OperatorDashboard } from './views/OperatorDashboard';
import { HouseholdDashboard } from './views/HouseholdDashboard';
import { Meter, Trade, seedMeters } from './simulation/model';
import './styles.css';

function DashboardContainer() {
  const { token, role, loading } = useSession();

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('gridshare-theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('gridshare-theme', theme);
  }, [theme]);

  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);

  const [tick, setTick] = useState(62);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState('1x');
  const [selected, setSelected] = useState<Meter>(seedMeters[0]);
  const [info, setInfo] = useState(false);
  const [pulse, setPulse] = useState(false);

  // States driven by backend
  const [meters, setMeters] = useState<(Meter | any)[]>(seedMeters);
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
      setSecondsSinceUpdate((s) => s + 1);
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
    if (!token) return;

    // Fetch initial state first
    authFetch('/api/simulation/state')
      .then((res) => res.json())
      .then((data) => {
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
      .catch((err) => console.error('Failed to load initial simulation state:', err));

    // Connect WebSocket to backend
    const ws = new WebSocket(WS_BASE_URL);

    ws.onopen = () => {
      // Authenticate socket connection
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

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
        console.error('Error parsing socket broadcast payload:', e);
      }
    };

    ws.onerror = (err) => console.error('WebSocket connection error:', err);

    return () => ws.close();
  }, [token]);

  // Load supply-demand historical curve entries from backend
  useEffect(() => {
    if (!token) return;

    authFetch('/api/simulation/history')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSupplyDemandHistory(data);
        }
      })
      .catch((err) => console.error('Failed to fetch simulation history:', err));
  }, [token, tick]);

  // Update frontend selection reference when meters update
  useEffect(() => {
    const current = meters.find((m) => m.id === selected.id);
    if (current) setSelected(current);
  }, [meters]);

  // Control Handlers communicating to server APIs
  const handleSetPlaying = (val: boolean) => {
    authFetch('/api/simulation/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playing: val }),
    }).catch((err) => console.error('Failed to update play/pause state:', err));
  };

  const handleSetSpeed = (val: string) => {
    authFetch('/api/simulation/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speed: val }),
    }).catch((err) => console.error('Failed to update speed state:', err));
  };

  const handleSetTick = (val: number) => {
    authFetch('/api/simulation/tick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tick: val }),
    }).catch((err) => console.error('Failed to force tick value:', err));
  };

  const handleReset = () => {
    authFetch('/api/simulation/reset', { method: 'POST' }).catch((err) =>
      console.error('Failed to reset simulation:', err)
    );
  };

  // Render Loader spinner to avoid flashing login on refresh
  // Render Loading Screen overlay if active, overlaying the main app view underneath when resolved
  return (
    <>
      {showLoadingOverlay && (
        <LoadingScreen
          isFinished={!loading}
          onFadeOutComplete={() => setShowLoadingOverlay(false)}
        />
      )}

      {!loading && (
        !token ? (
          <LoginScreen theme={theme} onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} />
        ) : role === 'operator' ? (
          <OperatorDashboard
            theme={theme}
            setTheme={setTheme}
            setInfo={setInfo}
            tick={tick}
            playing={playing}
            speed={speed}
            meters={meters}
            trades={trades}
            ledger={ledger}
            sharedPartners={sharedPartners}
            cumulativeBaseline={cumulativeBaseline}
            secondsSinceUpdate={secondsSinceUpdate}
            supplyDemandHistory={supplyDemandHistory}
            selected={selected}
            setSelected={setSelected}
            handleSetPlaying={handleSetPlaying}
            handleSetSpeed={handleSetSpeed}
            handleSetTick={handleSetTick}
            handleReset={handleReset}
          />
        ) : (
          <HouseholdDashboard
            theme={theme}
            setTheme={setTheme}
            setInfo={setInfo}
            tick={tick}
            playing={playing}
            speed={speed}
            meters={meters}
            trades={trades}
            ledger={ledger}
            sharedPartners={sharedPartners}
            cumulativeBaseline={cumulativeBaseline}
            secondsSinceUpdate={secondsSinceUpdate}
            supplyDemandHistory={supplyDemandHistory}
            handleSetPlaying={handleSetPlaying}
            handleSetSpeed={handleSetSpeed}
            handleSetTick={handleSetTick}
            handleReset={handleReset}
          />
        )
      )}

      {/* Global Info Modal Dialog */}
      {info && (
        <div
          className="fixed inset-0 bg-[rgba(4,12,10,0.7)] backdrop-blur-[8px] z-[200] grid place-items-center p-5"
          onClick={() => setInfo(false)}
        >
          <div
            className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[20px] max-w-[460px] w-full p-8 relative shadow-[var(--card-shadow)] backdrop-blur-[24px] animate-[scaleUp_0.3s_cubic-bezier(0.16,1,0.3,1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute right-[18px] top-[14px] border-0 bg-transparent text-[26px] text-[var(--text-secondary)] cursor-pointer transition-colors duration-200 hover:text-[var(--red)]"
              onClick={() => setInfo(false)}
            >
              ×
            </button>
            <label className="font-mono text-[10px] font-medium tracking-[0.12em] text-[var(--text-secondary)] uppercase">
              HOW THIS WORKS
            </label>
            <h2 className="font-semibold text-[24px] font-title my-3 mx-0 text-[var(--text-primary)]">
              A small, honest simulation.
            </h2>
            <p className="text-[var(--text-secondary)] text-[14px] leading-[1.6]">
              GridShare uses seeded, database-backed models of rooftop solar generation, household demand, bids, asks, and
              local matching. Nothing here connects to live meters, weather, utility systems, or external APIs.
            </p>
            <p className="text-[var(--text-secondary)] text-[14px] leading-[1.6] mt-4">
              Supply and demand feed the transparent Local Marginal Price. Compatible orders clear at that price, keeping
              more value in the neighbourhood.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <DashboardContainer />
    </SessionProvider>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
