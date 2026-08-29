import { useState, useRef, useEffect } from 'react';
import { CircleHelp, Sun, Moon, Bell, BellOff, Sparkles, TrendingUp, ShieldCheck, User, Edit3, Check, X, LogOut, History, Download } from 'lucide-react';
import logo from '../assets/logo.svg';
import { Meter } from '../simulation/model';
import { useSession } from '../auth/SessionContext';
import { authFetch } from '../auth/api';

interface HeaderProps {
  onInfo: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  selectedMeter?: Meter;
  lifetimeSavings?: number;
  trades?: any[];
  sharedPartners?: string[];
  // Current simulated tick. Used to give each cleared trade a stable,
  // per-interval identity for the notification feed below — trade ids
  // returned by the matching engine are only guaranteed unique *within*
  // a single tick, not across ticks, so `tick` is required to tell two
  // different intervals' trades apart.
  tick?: number;
}

export function Header({
  onInfo,
  theme,
  onToggleTheme,
  selectedMeter,
  lifetimeSavings = 1248.50,
  trades = [],
  sharedPartners = [],
  tick,
}: HeaderProps) {
  const { role, meter, setMeter, logout } = useSession();

  const userName = role === 'operator'
    ? 'Grid Operator'
    : (meter?.displayName || meter?.name || selectedMeter?.name || 'Resident');
  const meterId = role === 'operator' ? 'SYSTEM' : (meter?.id || selectedMeter?.id || 'M-XX');
  const roleName = role === 'operator' ? 'operator' : (meter?.role || selectedMeter?.role || 'household');

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [tradesHistory, setTradesHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(false);
  // Tracks which *specific cleared trades* (not which counterparties) we've
  // already surfaced a notification for. See the effect below for why this
  // is keyed by tick+buyer+seller rather than by partner id or trade.id.
  const notifiedTradeKeysRef = useRef<Set<string>>(new Set());

  // Renaming states
  const [isRenaming, setIsRenaming] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const dayNum = today.getDate();
  const monthName = today.toLocaleDateString('en-US', { month: 'long' });
  const yearNum = today.getFullYear();
  const formattedDate = `${dayName}, ${dayNum} ${monthName} ${yearNum}`;

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfile(false);
        setIsRenaming(false);
      }
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Detect newly cleared trades for this household and surface a notification
  // for each one.
  //
  // THE FIX: this used to dedupe on `partnerId` alone, so a household got
  // notified the FIRST time it ever traded with a given neighbour and then
  // never again for the rest of the session — even though the matching
  // engine clears a brand new trade with that same (usually nearest) neighbour
  // on almost every subsequent interval. That made the Notifications panel go
  // silent almost immediately, which read as "not receiving updates".
  //
  // The fix identifies a cleared trade by `tick + buyer + seller`, which is
  // stable and unique per interval (a given buyer/seller pair can clear at
  // most once per tick in this matching engine), instead of by the matching
  // engine's `trade.id`, which only resets to the same sequence every tick
  // and is therefore not safe to use as a cross-tick identity.
  useEffect(() => {
    if (role !== 'household' || !trades || !meterId || tick === undefined) return;

    trades.forEach((trade) => {
      const isSeller = trade.seller === meterId;
      const partnerId = isSeller ? trade.buyer : trade.seller;
      const tradeKey = `${tick}-${trade.buyer}-${trade.seller}`;

      if (!notifiedTradeKeysRef.current.has(tradeKey)) {
        notifiedTradeKeysRef.current.add(tradeKey);

        const newNotif = {
          id: `${tradeKey}-${Date.now()}`,
          partnerId,
          amt: trade.delivered.toFixed(2),
          type: isSeller ? 'sell' : 'buy',
          timestamp: new Date(),
        };

        setNotifications((prev) => [newNotif, ...prev]);
        setUnreadNotifications(true);
      }
    });

    // Keep the dedupe set from growing unbounded over a long-running session.
    if (notifiedTradeKeysRef.current.size > 500) {
      const trimmed = Array.from(notifiedTradeKeysRef.current).slice(-250);
      notifiedTradeKeysRef.current = new Set(trimmed);
    }
  }, [trades, role, meterId, tick]);

  // Sync renaming input when profile changes or opens
  useEffect(() => {
    if (showProfile) {
      setNewDisplayName(meter?.displayName || meter?.name || selectedMeter?.name || '');
      setRenameError(null);
    }
  }, [showProfile, meter, selectedMeter]);

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    setRenameError(null);
    try {
      const res = await authFetch('/api/auth/me/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ displayName: newDisplayName }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update display name');
      }

      const updatedMeter = await res.json();
      setMeter(updatedMeter);
      setIsRenaming(false);
    } catch (err: any) {
      console.error('Rename display name error:', err);
      setRenameError(err.message || 'Error updating profile.');
    }
  };

  // Helper functions

  const fetchTradesHistory = async () => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const res = await authFetch('/api/simulation/history/trades');
      if (!res.ok) throw new Error('Failed to load transaction history');
      const data = await res.json();
      setTradesHistory(data);
    } catch (err: any) {
      console.error('Error fetching trade history:', err);
      setHistoryError(err.message || 'Error loading transaction history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const res = await authFetch('/api/simulation/history/trades?limit=all');
      if (!res.ok) throw new Error('Failed to fetch trades for export');
      const allTrades = await res.json();

      const headers = [
        'id', 'tick', 'buyer', 'seller', 'sent', 'delivered', 'lossKWh', 'distance',
        'lossFrac', 'nCharge', 'energyPrice', 'buyerUnitPrice', 'buyerPayment',
        'sellerRevenue', 'networkRevenue', 'createdAt', 'role'
      ];

      const csvRows = [headers.join(',')];

      for (const trade of allTrades) {
        let computedRole = 'operator';
        if (role === 'household') {
          computedRole = (trade.buyer === meterId) ? 'buyer' : 'seller';
        }

        const rowValues = [
          trade.id,
          trade.tick,
          trade.buyer,
          trade.seller,
          trade.sent,
          trade.delivered,
          trade.lossKWh,
          trade.distance,
          trade.lossFrac,
          trade.nCharge,
          trade.energyPrice,
          trade.buyerUnitPrice,
          trade.buyerPayment,
          trade.sellerRevenue,
          trade.networkRevenue,
          trade.createdAt,
          computedRole
        ];

        const escapedRow = rowValues.map(val => {
          const s = String(val === null || val === undefined ? '' : val);
          if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        }).join(',');

        csvRows.push(escapedRow);
      }

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const todayDate = new Date().toISOString().split('T')[0];
      link.setAttribute('href', url);
      link.setAttribute('download', `gridshare-transactions-${todayDate}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Error exporting trades:', err);
      alert(err.message || 'Failed to export transaction history CSV');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <header className="h-[76px] bg-[var(--header-bg)] border-b border-[var(--header-border)] flex items-center px-4 sm:px-6 justify-between sticky top-0 z-[100] transition-all duration-300">
      <div className="flex items-center gap-[28px]">
        <div
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex gap-3 items-center cursor-pointer select-none group transition-transform active:scale-95"
          title="Scroll to top"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
        >
          <div className="bg-[#2D2D2D] w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.12)] group-hover:scale-105 transition-transform border border-[rgba(215,201,174,0.2)]">
            <img src={logo} alt="gridshare logo" className="w-5 h-5 object-contain" />
          </div>
          <div>
            <b className="block text-[20px] font-bold font-title tracking-[-0.03em] text-[var(--text-primary)] group-hover:opacity-80 transition-opacity">gridshare</b>
          </div>
        </div>
      </div>

      <div className="font-mono text-[11px] text-[var(--text-secondary)] flex gap-3 items-center max-[850px]:hidden">
        <span className="inline-block w-2 h-2 bg-[#2D2D2D] dark:bg-[#D7C9AE] rounded-full shadow-[0_0_0_4px_var(--lime-glow)] animate-pulse" /> SIMULATION LIVE <i className="h-4 border-l border-[var(--line)]" /> <b className="text-[var(--text-primary)] font-semibold">{formattedDate}</b>
      </div>

      <div className="flex items-center gap-[10px]">
        {/* Theme Toggle */}
        <button
          className="bg-[var(--button-outline-bg)] border border-[var(--button-outline-border)] text-[var(--text-secondary)] w-[38px] h-[38px] rounded-full grid place-items-center cursor-pointer relative transition-all duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:border-lime hover:text-lime hover:bg-[var(--button-outline-hover)] hover:-translate-y-[1px]"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Info Modal Button */}
        <button
          className="bg-[var(--button-outline-bg)] border border-[var(--button-outline-border)] text-[var(--text-secondary)] w-[38px] h-[38px] rounded-full grid place-items-center cursor-pointer relative transition-all duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:border-lime hover:text-lime hover:bg-[var(--button-outline-hover)] hover:-translate-y-[1px]"
          onClick={onInfo}
          title="How it works"
        >
          <CircleHelp size={18} />
        </button>

        {/* History Dropdown Container */}
        <div className="relative" ref={historyRef}>
          <button
            className={`bg-[var(--button-outline-bg)] border ${showHistory ? 'border-[var(--text-primary)] text-[var(--text-primary)]' : 'border-[var(--button-outline-border)] text-[var(--text-secondary)]'} w-[38px] h-[38px] rounded-full grid place-items-center cursor-pointer relative transition-all duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] hover:bg-[var(--button-outline-hover)] hover:-translate-y-[1px]`}
            onClick={() => {
              const next = !showHistory;
              setShowHistory(next);
              setShowNotifications(false);
              setShowProfile(false);
              if (next) {
                fetchTradesHistory();
              }
            }}
            title="Transaction History"
            aria-label="Transaction History"
          >
            <History size={18} />
          </button>

          {showHistory && (
            <div className="absolute right-0 mt-3 w-[320px] sm:w-[360px] border border-[var(--card-border)] rounded-[24px] shadow-[0_16px_48px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.38)] p-5 z-[150] animate-[scaleUp_0.2s_cubic-bezier(0.16,1,0.3,1)]" style={{ backgroundColor: theme === 'light' ? '#FFFFFF' : '#282828' }}>

              {/* Header */}
              <div className="flex justify-between items-center pb-3 border-b border-[var(--line)]">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-[#C06B22] dark:text-[#E5C378]" />
                  <span className="font-semibold font-title text-[15px] text-[var(--text-primary)]">History</span>
                </div>
                <button
                  onClick={handleExportCSV}
                  disabled={isExporting}
                  className="font-mono text-[9px] font-bold uppercase py-1 px-3 rounded-full bg-[rgba(45,45,45,0.08)] hover:bg-[rgba(45,45,45,0.15)] text-[var(--text-primary)] dark:bg-[rgba(215,201,174,0.12)] dark:hover:bg-[rgba(215,201,174,0.2)] dark:text-[#D7C9AE] border border-[var(--line)] cursor-pointer flex items-center gap-1 transition-all disabled:opacity-50"
                  title="Export to CSV"
                >
                  <Download size={10} />
                  <span>Export CSV</span>
                </button>
              </div>

              {/* Body */}
              <div className="my-4 max-h-[260px] overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
                {loadingHistory ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)] text-[12.5px]">
                    <span className="w-5 h-5 border-2 border-t-transparent border-[var(--text-primary)] rounded-full animate-spin" />
                    <span>Loading transactions...</span>
                  </div>
                ) : historyError ? (
                  <div className="py-6 text-center text-red-500 text-[12.5px]">
                    {historyError}
                  </div>
                ) : tradesHistory.length === 0 ? (
                  <div className="py-8 text-center text-[var(--text-muted)] text-[12.5px]">
                    No transactions recorded yet.
                  </div>
                ) : (
                  tradesHistory.map((trade) => {
                    const isBuyer = role === 'household' && (trade.buyer === meterId);
                    const isSeller = role === 'household' && (trade.seller === meterId);

                    const timeStr = new Date(trade.createdAt).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false
                    });
                    const dateStr = new Date(trade.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric'
                    });

                    return (
                      <div key={trade.id} className="flex justify-between items-center p-2.5 rounded-[12px] bg-[rgba(45,45,45,0.02)] dark:bg-[rgba(215,201,174,0.03)] border border-[var(--line)] text-[12px]">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-semibold text-[var(--text-primary)]">{trade.buyer}</span>
                            <span className="text-[var(--text-muted)] text-[10px]">→</span>
                            <span className="font-mono font-semibold text-[var(--text-primary)]">{trade.seller}</span>
                          </div>
                          <span className="text-[10px] text-[var(--text-muted)] font-mono">{dateStr} {timeStr}</span>
                        </div>

                        <div className="text-right flex flex-col items-end gap-0.5">
                          <span className="font-semibold text-[var(--text-primary)]">{trade.delivered.toFixed(2)} kWh</span>
                          {role === 'operator' ? (
                            <span className="text-[var(--text-secondary)] font-medium font-mono text-[11px]">
                              ₹{trade.buyerPayment.toFixed(2)}
                            </span>
                          ) : isBuyer ? (
                            <span className="text-[var(--red)] font-semibold font-mono text-[11px]">
                              -₹{trade.buyerPayment.toFixed(2)}
                            </span>
                          ) : isSeller ? (
                            <span className="text-green-500 dark:text-green-400 font-semibold font-mono text-[11px]">
                              +₹{trade.sellerRevenue.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-[var(--text-muted)] font-mono text-[11px]">
                              ₹{trade.buyerPayment.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="pt-2 border-t border-[var(--line)] flex justify-center items-center">
                <span className="font-mono text-[9px] text-[var(--text-muted)] flex items-center gap-1">
                  Showing last {tradesHistory.length} transactions
                </span>
              </div>

            </div>
          )}
        </div>

        {/* Notification Bell Dropdown Container */}
        <div className="relative" ref={notifRef}>
          <button
            className={`bg-[var(--button-outline-bg)] border ${showNotifications ? 'border-[var(--text-primary)] text-[var(--text-primary)]' : 'border-[var(--button-outline-border)] text-[var(--text-secondary)]'} w-[38px] h-[38px] rounded-full grid place-items-center cursor-pointer relative transition-all duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] hover:bg-[var(--button-outline-hover)] hover:-translate-y-[1px]`}
            onClick={() => {
              setShowNotifications(prev => !prev);
              setShowProfile(false);
              setShowHistory(false);
              setUnreadNotifications(false);
            }}
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unreadNotifications && (
              <span className="absolute top-[9px] right-[9px] w-[6.2px] h-[6.2px] bg-[var(--red)] rounded-full shadow-[0_0_6px_var(--red)] animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-3 w-[300px] sm:w-[340px] border border-[var(--card-border)] rounded-[24px] shadow-[0_16px_48px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.38)] p-6 sm:p-6.5 z-[150] animate-[scaleUp_0.2s_cubic-bezier(0.16,1,0.3,1)]" style={{ backgroundColor: theme === 'light' ? '#FFFFFF' : '#282828' }}>
              <div className="flex justify-between items-center pb-3.5 border-b border-[var(--line)]">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-[#C06B22] dark:text-[#E5C378]" />
                  <span className="font-semibold font-title text-[15px] text-[var(--text-primary)]">Notifications</span>
                </div>
                <span className="font-mono text-[9px] font-semibold uppercase py-0.5 px-2.5 rounded-full bg-[rgba(45,45,45,0.08)] text-[var(--text-primary)] dark:bg-[rgba(215,201,174,0.12)] dark:text-[#D7C9AE] border border-[var(--line)]">
                  Live Feed
                </span>
              </div>

              {notifications.length === 0 ? (
                <div className="py-7 px-3 flex flex-col items-center justify-center text-center">
                  <div className="w-13 h-13 rounded-full bg-[rgba(45,45,45,0.06)] dark:bg-[rgba(215,201,174,0.08)] text-[var(--text-primary)] dark:text-[#D7C9AE] flex items-center justify-center mb-3.5 shadow-inner">
                    <BellOff size={24} />
                  </div>
                  <h4 className="font-semibold font-title text-[16px] text-[var(--text-primary)] m-0 mb-1 leading-tight">
                    No notifications
                  </h4>
                  <p className="text-[12.5px] text-[var(--text-secondary)] m-0 leading-relaxed max-w-[230px]">
                    You're all caught up with energy trading updates.
                  </p>
                </div>
              ) : (
                <div className="my-4 max-h-[220px] overflow-y-auto pr-1 flex flex-col gap-2.5 custom-scrollbar">
                  {notifications.map((notif) => (
                    <div key={notif.id} className="flex gap-2.5 items-start p-2.5 rounded-[12px] bg-[rgba(45,45,45,0.02)] dark:bg-[rgba(215,201,174,0.03)] border border-[var(--line)] text-[12px]">
                      <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${notif.type === 'sell' ? 'bg-[#E5C378]' : 'bg-[#C06B22]'
                        }`} />
                      <div className="flex-1 flex flex-col gap-0.5">
                        <span className="text-[var(--text-primary)] font-medium leading-tight">
                          {notif.type === 'sell'
                            ? `Energy shared to [${notif.partnerId}]`
                            : `Energy drawn from [${notif.partnerId}]`
                          }
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                          {notif.amt} kWh · {notif.timestamp.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-[var(--line)] flex justify-center items-center">
                <span className="font-mono text-[10px] text-[var(--text-muted)] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-primary)] dark:bg-[#D7C9AE]" /> P2P Network Connected
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown Container */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => {
              setShowProfile(prev => !prev);
              setShowNotifications(false);
            }}
            className="relative w-[38px] h-[38px] flex items-center justify-center rounded-full cursor-pointer transition-transform duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-lime"
            title="User Profile"
            aria-label="User Profile"
          >
            <svg viewBox="0 0 32 32" width="32" height="32" className="w-full h-full rounded-full border-[1.5px] border-[#2D2D2D] dark:border-[#D7C9AE] shadow-[0_0_10px_var(--lime-glow)] bg-[var(--mint)]">
              <defs>
                <linearGradient id="avatar-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#E5C378" />
                  <stop offset="100%" stopColor="#C9A84C" />
                </linearGradient>
              </defs>
              <circle cx="16" cy="16" r="16" fill="url(#avatar-grad)" />
              <circle cx="16" cy="12" r="5" fill="#2D2D2D" />
              <path d="M6 25 C6 20, 10 18, 16 18 C22 18, 26 20, 26 25" fill="#2D2D2D" />
            </svg>
            <div className="absolute bottom-[1px] right-[1px] w-2 h-2 bg-[#E5C378] border-[1.5px] border-[var(--card-bg)] rounded-full shadow-[0_0_6px_#E5C378]" />
          </button>

          {showProfile && (
            <div className="absolute right-0 mt-3 w-[310px] sm:w-[350px] border border-[var(--card-border)] rounded-[24px] shadow-[0_16px_48px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.38)] p-6 sm:p-6.5 z-[150] animate-[scaleUp_0.2s_cubic-bezier(0.16,1,0.3,1)]" style={{ backgroundColor: theme === 'light' ? '#FFFFFF' : '#282828' }}>
              {/* Profile Card Header */}
              <div className="flex items-center gap-3.5 pb-4 border-b border-[var(--line)]">
                <div className="w-12 h-12 rounded-full border-[1.5px] border-[#2D2D2D] dark:border-[#D7C9AE] bg-[#E5C378] text-[#2D2D2D] flex items-center justify-center shadow-sm flex-shrink-0 font-bold">
                  <User size={22} />
                </div>
                <div className="overflow-hidden flex-1 flex flex-col justify-center">
                  {isRenaming ? (
                    <form onSubmit={handleRename} className="flex flex-col gap-1.5 w-full">
                      <div className="flex items-center gap-1.5 w-full">
                        <input
                          type="text"
                          value={newDisplayName}
                          onChange={(e) => setNewDisplayName(e.target.value)}
                          maxLength={25}
                          className="flex-1 text-[13.5px] font-sans font-semibold py-1 px-2 border border-[var(--card-border)] bg-[rgba(0,0,0,0.02)] dark:bg-[rgba(255,255,255,0.02)] text-[var(--text-primary)] rounded focus:outline-none"
                          autoFocus
                        />
                        <button type="submit" className="p-1 text-green-500 hover:opacity-85 cursor-pointer bg-transparent border-none">
                          <Check size={16} />
                        </button>
                        <button type="button" onClick={() => setIsRenaming(false)} className="p-1 text-red-500 hover:opacity-85 cursor-pointer bg-transparent border-none">
                          <X size={16} />
                        </button>
                      </div>
                      {renameError && <span className="text-[10px] text-red-500 leading-none">{renameError}</span>}
                    </form>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold font-title text-[17px] text-[var(--text-primary)] m-0 truncate leading-tight">
                        {userName}
                      </h3>
                      {role === 'household' && (
                        <button
                          onClick={() => {
                            setIsRenaming(true);
                            setRenameError(null);
                          }}
                          className="p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer bg-transparent border-none flex-shrink-0"
                          title="Rename Display Name"
                        >
                          <Edit3 size={13} />
                        </button>
                      )}
                      <ShieldCheck size={16} className="text-[#C06B22] dark:text-[#E5C378] flex-shrink-0" />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-[rgba(45,45,45,0.08)] dark:bg-[rgba(215,201,174,0.15)] text-[var(--text-primary)] border border-[var(--line)] leading-none">
                      {meterId}
                    </span>
                    <span className="font-mono text-[11px] text-[var(--text-secondary)] capitalize leading-none">
                      {roleName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lifetime Savings vs Grid Card */}
              <div className="my-4 p-4 bg-[#F5EFE6] dark:bg-[rgba(215,201,174,0.06)] border border-[var(--line)] rounded-[18px]">
                <div className="flex justify-between items-center mb-1">
                  <label className="font-mono text-[9px] font-bold text-[var(--text-secondary)] tracking-[0.08em] uppercase flex items-center gap-1">
                    <Sparkles size={11} className="text-[#C06B22] dark:text-[#E5C378]" />
                    {role === 'operator' ? 'TOTAL COMMUNITY BENEFIT' : 'LIFETIME SAVINGS VS GRID'}
                  </label>
                  <span className="font-mono text-[10px] text-[var(--text-primary)] font-bold bg-[rgba(45,45,45,0.08)] dark:bg-[rgba(215,201,174,0.15)] px-1.5 py-0.5 rounded">
                    +24.6%
                  </span>
                </div>
                <div className="text-[28px] font-bold font-title text-[var(--text-primary)] tracking-[-0.02em] leading-tight my-1">
                  ₹{lifetimeSavings.toFixed(2)}
                </div>
                <span className="text-[11.5px] text-[var(--text-secondary)] block leading-snug">
                  {role === 'operator'
                    ? 'Aggregate economic benefit across all local households'
                    : 'Total capital retained vs standard utility tariff'}
                </span>
              </div>

              {/* Account Quick Details */}
              <div className="grid grid-cols-2 gap-3 pt-1 text-[11px]">
                <div className="bg-[rgba(45,45,45,0.04)] dark:bg-[rgba(215,201,174,0.04)] p-3 rounded-[14px] border border-[var(--line)] flex flex-col justify-center">
                  <span className="text(--text-muted) block text-[9px] font-mono uppercase tracking-[0.05em] mb-0.5">GRID DEFAULT</span>
                  <strong className="text-[var(--text-primary)] font-semibold text-[13px]">₹7.00/kWh</strong>
                </div>
                <div className="bg-[rgba(45,45,45,0.04)] dark:bg-[rgba(215,201,174,0.04)] p-3 rounded-[14px] border border-[var(--line)] flex flex-col justify-center">
                  <span className="text(--text-muted) block text-[9px] font-mono uppercase tracking-[0.05em] mb-0.5">STATUS</span>
                  <strong className="text-[var(--text-primary)] font-semibold text-[13px] flex items-center gap-1.5">
                    {role === 'operator' ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E5C378] animate-pulse" /> Control Node
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse" /> Active Node
                      </>
                    )}
                  </strong>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={logout}
                className="w-full mt-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[12.5px] font-semibold rounded-[14px] transition-all border border-red-500/20 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.99] hover:scale-[1.01]"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}