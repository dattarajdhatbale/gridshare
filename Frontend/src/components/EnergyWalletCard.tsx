import { useMemo } from 'react';
import { Wallet, Zap, TrendingUp, PiggyBank, Award, ArrowUp } from 'lucide-react';
import { Meter, Trade } from '../simulation/model';

interface EnergyWalletCardProps {
  meter?: Meter;
  meters?: Meter[];
  trades?: Trade[];
  ledger?: Record<string, number>;
  lmp?: number;
  cumulativeBaseline?: number;
}

export function EnergyWalletCard({
  meter,
  trades = [],
  ledger = {},
  lmp = 5.08,
}: EnergyWalletCardProps) {
  // Compute reactive stats for the current meter / community
  const meterEarned = meter ? (ledger[meter.id] || 0) : 0;
  
  // Base values matching reference design with reactive additions from simulation
  const walletBalance = 284.60 + meterEarned;
  const todayEarnings = 42.30 + meterEarned;
  const earningsTrendPercent = 17.4;

  // 4 Bottom metrics
  const totalTradedKWh = useMemo(() => {
    const activeVol = trades.reduce((sum, t) => sum + (t.delivered || t.kwh || 0), 0);
    return (18.4 + activeVol).toFixed(1);
  }, [trades]);

  const avgTradePrice = useMemo(() => {
    if (lmp && lmp > 0) return lmp.toFixed(2);
    return '5.08';
  }, [lmp]);

  const savedVsGrid = useMemo(() => {
    const savings = 96.20 + (meterEarned * 0.75);
    return savings.toFixed(2);
  }, [meterEarned]);

  const successfulTradesCount = useMemo(() => {
    return 142 + trades.length;
  }, [trades]);

  return (
    <section className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[20px] p-6 shadow-[var(--card-shadow)] backdrop-blur-md relative overflow-hidden transition-all duration-300 flex flex-col justify-between energy-wallet-card h-full">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-[#114b3f] text-[#00ff88] dark:bg-[#0c382f] dark:text-[#00ff88] flex items-center justify-center shadow-sm flex-shrink-0">
            <Wallet size={20} strokeWidth={2.2} />
          </div>
          <div>
            <h2 className="font-semibold text-[20px] font-title tracking-[-0.02em] text-[var(--text-primary)] m-0 leading-tight">
              Energy Wallet
            </h2>
            <p className="text-[12px] text-[var(--text-secondary)] m-0 mt-0.5">
              Your earnings from local energy trades
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.15)] text-lime py-1 px-2.5 rounded-full font-sans font-bold text-[10px] tracking-[0.05em] uppercase leading-none dark:bg-[rgba(0,255,136,0.08)] dark:border-[rgba(0,255,136,0.18)] dark:text-[#00ff88]">
          <span className="w-1.5 h-1.5 rounded-full bg-lime dark:bg-[#00ff88] animate-pulse" />
          LIVE
        </span>
      </div>

      {/* Main Balance & Earnings Area */}
      <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_auto_1.1fr_auto] items-center gap-4 sm:gap-5 my-auto py-3">
        {/* Wallet Balance */}
        <div className="flex flex-col">
          <label className="font-mono text-[9px] font-semibold text-[var(--text-muted)] tracking-[0.1em] uppercase mb-0.5">
            WALLET BALANCE
          </label>
          <div className="text-[32px] sm:text-[36px] font-bold font-title text-[#064e3b] dark:text-[#00ff88] tracking-[-0.03em] leading-none my-1">
            ₹{walletBalance.toFixed(2)}
          </div>
          <span className="text-[12px] font-medium text-[var(--text-secondary)]">
            Available Balance
          </span>
        </div>

        {/* Vertical Divider */}
        <div className="hidden sm:block w-[1px] h-[64px] bg-[var(--line)] self-center" />

        {/* Today's Earnings */}
        <div className="flex flex-col">
          <label className="font-mono text-[9px] font-semibold text-[var(--text-muted)] tracking-[0.1em] uppercase mb-0.5">
            TODAY'S EARNINGS
          </label>
          <div className="text-[28px] sm:text-[32px] font-bold font-title text-[#10b981] dark:text-[#00ff88] tracking-[-0.03em] leading-none my-1">
            +₹{todayEarnings.toFixed(2)}
          </div>
          <div className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#10b981] dark:text-[#00ff88]">
            <ArrowUp size={13} strokeWidth={2.5} />
            <span>{earningsTrendPercent}% vs yesterday</span>
          </div>
        </div>

        {/* Illustration Graphic */}
        <div className="hidden md:flex justify-end items-center relative">
          <div className="relative w-[95px] h-[80px] flex items-center justify-center">
            {/* Sparkles */}
            <span className="absolute top-0 left-1 text-[#10b981] dark:text-[#00ff88] opacity-60 text-xs font-bold">+</span>
            <span className="absolute bottom-1 right-0 text-[#10b981] dark:text-[#00ff88] opacity-50 text-[10px] font-bold">✦</span>

            {/* Custom SVG Wallet + Lightning + Coin Graphic */}
            <svg width="95" height="80" viewBox="0 0 105 90" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-10 drop-shadow-sm">
              {/* Back Green Bill 2 */}
              <rect x="36" y="8" width="56" height="34" rx="5" fill="#34d399" fillOpacity="0.85" transform="rotate(-6 36 8)" />
              {/* Back Green Bill 1 */}
              <rect x="42" y="12" width="54" height="34" rx="5" fill="#10b981" fillOpacity="0.9" transform="rotate(3 42 12)" />
              <rect x="46" y="16" width="46" height="26" rx="3" stroke="#a7f3d0" strokeWidth="1.2" strokeDasharray="3 2" transform="rotate(3 46 16)" />

              {/* Main Dark Emerald Wallet Body */}
              <rect x="22" y="24" width="76" height="52" rx="10" fill="#064e3b" />
              <rect x="22" y="24" width="76" height="52" rx="10" stroke="#047857" strokeWidth="1.5" />

              {/* Wallet Closure Flap */}
              <path d="M74 40H96C97.1046 40 98 40.8954 98 42V58C98 59.1046 97.1046 60 96 60H74C72.8954 60 72 59.1046 72 58V42C72 40.8954 72.8954 40 74 40Z" fill="#04392b" />
              <circle cx="88" cy="50" r="3.5" fill="#10b981" />

              {/* Lightning Bolt Symbol on Wallet */}
              <path d="M46 36L38 52H48L44 66L56 48H46L49 36H46Z" fill="#00ff88" />

              {/* Floating Rupee (₹) Token Badge */}
              <g>
                <circle cx="20" cy="62" r="16" fill="#a7f3d0" stroke="#059669" strokeWidth="2.5" />
                <text x="20" y="68" textAnchor="middle" fill="#064e3b" fontSize="16" fontWeight="bold" fontFamily="sans-serif">₹</text>
              </g>
            </svg>
          </div>
        </div>
      </div>

      {/* 4 Metrics Bottom Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-[var(--line)] mt-3">
        {/* 1. Total Traded */}
        <div className="bg-[rgba(16,185,129,0.04)] dark:bg-[rgba(0,255,136,0.03)] border border-[rgba(16,185,129,0.08)] dark:border-[rgba(0,255,136,0.08)] rounded-[14px] p-2.5 flex flex-col items-center text-center transition-all hover:bg-[rgba(16,185,129,0.07)]">
          <div className="w-7 h-7 rounded-full bg-[#e8fbf3] dark:bg-[rgba(0,255,136,0.12)] text-[#059669] dark:text-[#00ff88] flex items-center justify-center mb-1.5">
            <Zap size={14} strokeWidth={2.2} />
          </div>
          <div className="font-bold text-[15px] font-title text-[var(--text-primary)] leading-tight">
            {totalTradedKWh} kWh
          </div>
          <div className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
            Total Traded
          </div>
        </div>

        {/* 2. Avg. Trade Price */}
        <div className="bg-[rgba(16,185,129,0.04)] dark:bg-[rgba(0,255,136,0.03)] border border-[rgba(16,185,129,0.08)] dark:border-[rgba(0,255,136,0.08)] rounded-[14px] p-2.5 flex flex-col items-center text-center transition-all hover:bg-[rgba(16,185,129,0.07)]">
          <div className="w-7 h-7 rounded-full bg-[#e8fbf3] dark:bg-[rgba(0,255,136,0.12)] text-[#059669] dark:text-[#00ff88] flex items-center justify-center mb-1.5">
            <TrendingUp size={14} strokeWidth={2.2} />
          </div>
          <div className="font-bold text-[15px] font-title text-[var(--text-primary)] leading-tight">
            ₹{avgTradePrice} /kWh
          </div>
          <div className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
            Avg. Trade Price
          </div>
        </div>

        {/* 3. Saved vs Grid */}
        <div className="bg-[rgba(16,185,129,0.04)] dark:bg-[rgba(0,255,136,0.03)] border border-[rgba(16,185,129,0.08)] dark:border-[rgba(0,255,136,0.08)] rounded-[14px] p-2.5 flex flex-col items-center text-center transition-all hover:bg-[rgba(16,185,129,0.07)]">
          <div className="w-7 h-7 rounded-full bg-[#e8fbf3] dark:bg-[rgba(0,255,136,0.12)] text-[#059669] dark:text-[#00ff88] flex items-center justify-center mb-1.5">
            <PiggyBank size={14} strokeWidth={2.2} />
          </div>
          <div className="font-bold text-[15px] font-title text-[var(--text-primary)] leading-tight">
            ₹{savedVsGrid}
          </div>
          <div className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
            Saved vs Grid
          </div>
        </div>

        {/* 4. Successful Trades */}
        <div className="bg-[rgba(16,185,129,0.04)] dark:bg-[rgba(0,255,136,0.03)] border border-[rgba(16,185,129,0.08)] dark:border-[rgba(0,255,136,0.08)] rounded-[14px] p-2.5 flex flex-col items-center text-center transition-all hover:bg-[rgba(16,185,129,0.07)]">
          <div className="w-7 h-7 rounded-full bg-[#e8fbf3] dark:bg-[rgba(0,255,136,0.12)] text-[#059669] dark:text-[#00ff88] flex items-center justify-center mb-1.5">
            <Award size={14} strokeWidth={2.2} />
          </div>
          <div className="font-bold text-[15px] font-title text-[var(--text-primary)] leading-tight">
            {successfulTradesCount}
          </div>
          <div className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
            Successful Trades
          </div>
        </div>
      </div>
    </section>
  );
}
