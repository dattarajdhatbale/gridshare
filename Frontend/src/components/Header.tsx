import { useState, useRef, useEffect } from 'react';
import { CircleHelp, Sun, Moon, Bell, BellOff, Sparkles, TrendingUp, ShieldCheck, User } from 'lucide-react';
import logo from '../assets/logo.svg';
import { Meter } from '../simulation/model';

interface HeaderProps {
  onInfo: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  selectedMeter?: Meter;
  lifetimeSavings?: number;
}

export function Header({
  onInfo,
  theme,
  onToggleTheme,
  selectedMeter,
  lifetimeSavings = 1248.50,
}: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

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
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userName = selectedMeter?.name || 'Asha Sharma';
  const meterId = selectedMeter?.id || 'M-01';
  const roleName = selectedMeter?.role || 'prosumer';

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
          <div className="bg-transparent w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.08)] group-hover:scale-105 transition-transform">
            <img src={logo} alt="gridshare logo" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <b className="block text-[20px] font-bold font-title tracking-[-0.03em] text-[var(--text-primary)] group-hover:text-lime transition-colors">gridshare</b>
          </div>
        </div>
      </div>

      <div className="font-mono text-[11px] text-[var(--text-secondary)] flex gap-3 items-center max-[850px]:hidden">
        <span className="inline-block w-2 h-2 bg-[#10b981] rounded-full shadow-[0_0_0_4px_var(--lime-glow)] animate-pulse" /> SIMULATION LIVE <i className="h-4 border-l border-[var(--line)]" /> <b className="text-[var(--text-primary)] font-semibold">{formattedDate}</b>
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

        {/* Notification Bell Dropdown Container */}
        <div className="relative" ref={notifRef}>
          <button
            className={`bg-[var(--button-outline-bg)] border ${showNotifications ? 'border-lime text-lime' : 'border-[var(--button-outline-border)] text-[var(--text-secondary)]'} w-[38px] h-[38px] rounded-full grid place-items-center cursor-pointer relative transition-all duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:border-lime hover:text-lime hover:bg-[var(--button-outline-hover)] hover:-translate-y-[1px]`}
            onClick={() => {
              setShowNotifications(prev => !prev);
              setShowProfile(false);
            }}
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell size={18} />
            <span className="absolute top-[9px] right-[9px] w-[6.2px] h-[6.2px] bg-[var(--red)] rounded-full shadow-[0_0_6px_var(--red)]" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-3 w-[300px] sm:w-[340px] bg-white dark:bg-[#071915] border border-[rgba(16,185,129,0.25)] dark:border-[rgba(0,255,136,0.25)] rounded-[24px] shadow-[0_16px_48px_rgba(0,0,0,0.38)] p-6 sm:p-6.5 z-[150] animate-[scaleUp_0.2s_cubic-bezier(0.16,1,0.3,1)]">
              <div className="flex justify-between items-center pb-3.5 border-b border-[var(--line)]">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-lime" />
                  <span className="font-semibold font-title text-[15px] text-[var(--text-primary)]">Notifications</span>
                </div>
                <span className="font-mono text-[9px] font-semibold uppercase py-0.5 px-2.5 rounded-full bg-[rgba(16,185,129,0.1)] text-lime border border-[rgba(16,185,129,0.2)]">
                  Live Feed
                </span>
              </div>

              <div className="py-7 px-3 flex flex-col items-center justify-center text-center">
                <div className="w-13 h-13 rounded-full bg-[rgba(16,185,129,0.1)] dark:bg-[rgba(0,255,136,0.12)] text-lime flex items-center justify-center mb-3.5 shadow-inner">
                  <BellOff size={24} className="text-lime" />
                </div>
                <h4 className="font-semibold font-title text-[16px] text-[var(--text-primary)] m-0 mb-1 leading-tight">
                  No notifications
                </h4>
                <p className="text-[12.5px] text-[var(--text-secondary)] m-0 leading-relaxed max-w-[230px]">
                  You're all caught up with energy trading updates.
                </p>
              </div>

              <div className="pt-3 border-t border-[var(--line)] flex justify-center items-center">
                <span className="font-mono text-[10px] text-[var(--text-muted)] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] dark:bg-[#00ff88]" /> P2P Network Connected
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
            <svg viewBox="0 0 32 32" width="32" height="32" className="w-full h-full rounded-full border-[1.5px] border-lime shadow-[0_0_10px_var(--lime-glow)] bg-[var(--mint)]">
              <defs>
                <linearGradient id="avatar-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00ff88" />
                  <stop offset="100%" stopColor="#00a86b" />
                </linearGradient>
              </defs>
              <circle cx="16" cy="16" r="16" fill="url(#avatar-grad)" />
              <circle cx="16" cy="12" r="5" fill="#0c241f" />
              <path d="M6 25 C6 20, 10 18, 16 18 C22 18, 26 20, 26 25" fill="#0c241f" />
            </svg>
            <div className="absolute bottom-[1px] right-[1px] w-2 h-2 bg-[#00ff88] border-[1.5px] border-[var(--card-bg)] rounded-full shadow-[0_0_6px_#00ff88]" />
          </button>

          {showProfile && (
            <div className="absolute right-0 mt-3 w-[310px] sm:w-[350px] bg-white dark:bg-[#071915] border border-[rgba(16,185,129,0.25)] dark:border-[rgba(0,255,136,0.25)] rounded-[24px] shadow-[0_16px_48px_rgba(0,0,0,0.38)] p-6 sm:p-6.5 z-[150] animate-[scaleUp_0.2s_cubic-bezier(0.16,1,0.3,1)]">
              {/* Profile Card Header */}
              <div className="flex items-center gap-3.5 pb-4 border-b border-[var(--line)]">
                <div className="w-12 h-12 rounded-full border-[1.5px] border-lime bg-[#e8fbf3] dark:bg-[rgba(0,255,136,0.12)] flex items-center justify-center text-lime shadow-sm flex-shrink-0">
                  <User size={22} />
                </div>
                <div className="overflow-hidden flex flex-col justify-center">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold font-title text-[17px] text-[var(--text-primary)] m-0 truncate leading-tight">
                      {userName}
                    </h3>
                    <ShieldCheck size={16} className="text-lime flex-shrink-0" />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-[rgba(81,150,200,0.12)] text-[#3b82f6] border border-[rgba(81,150,200,0.15)] leading-none">
                      {meterId}
                    </span>
                    <span className="font-mono text-[11px] text-[var(--text-secondary)] capitalize leading-none">
                      {roleName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lifetime Savings vs Grid Card */}
              <div className="my-4 p-4 bg-[#f0fdf4] dark:bg-[rgba(0,255,136,0.06)] border border-[rgba(16,185,129,0.18)] dark:border-[rgba(0,255,136,0.18)] rounded-[18px]">
                <div className="flex justify-between items-center mb-1">
                  <label className="font-mono text-[9px] font-bold text-[var(--text-secondary)] tracking-[0.08em] uppercase flex items-center gap-1">
                    <Sparkles size={11} className="text-lime" /> LIFETIME SAVINGS VS GRID
                  </label>
                  <span className="font-mono text-[10px] text-lime font-bold bg-[rgba(16,185,129,0.1)] dark:bg-[rgba(0,255,136,0.12)] px-1.5 py-0.5 rounded">
                    +24.6%
                  </span>
                </div>
                <div className="text-[28px] font-bold font-title text-[#10b981] dark:text-[#00ff88] tracking-[-0.02em] leading-tight my-1">
                  ₹{lifetimeSavings.toFixed(2)}
                </div>
                <span className="text-[11.5px] text-[var(--text-secondary)] block leading-snug">
                  Total capital retained vs standard utility tariff
                </span>
              </div>

              {/* Account Quick Details */}
              <div className="grid grid-cols-2 gap-3 pt-1 text-[11px]">
                <div className="bg-[rgba(16,185,129,0.04)] dark:bg-[rgba(0,255,136,0.04)] p-3 rounded-[14px] border border-[var(--line)] flex flex-col justify-center">
                  <span className="text-[var(--text-muted)] block text-[9px] font-mono uppercase tracking-[0.05em] mb-0.5">GRID DEFAULT</span>
                  <strong className="text-[var(--text-primary)] font-semibold text-[13px]">₹7.00/kWh</strong>
                </div>
                <div className="bg-[rgba(16,185,129,0.04)] dark:bg-[rgba(0,255,136,0.04)] p-3 rounded-[14px] border border-[var(--line)] flex flex-col justify-center">
                  <span className="text-[var(--text-muted)] block text-[9px] font-mono uppercase tracking-[0.05em] mb-0.5">STATUS</span>
                  <strong className="text-lime font-semibold text-[13px] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse" /> Active Node
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>


      </div>
    </header>
  );
}
