import { CircleHelp, Sun, Moon, Bell } from 'lucide-react';
import logo from '../assets/logo.svg';

interface HeaderProps {
  onInfo: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export function Header({ onInfo, theme, onToggleTheme }: HeaderProps) {
  const today = new Date();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const dayNum = today.getDate();
  const monthName = today.toLocaleDateString('en-US', { month: 'long' });
  const yearNum = today.getFullYear();
  const formattedDate = `${dayName}, ${dayNum} ${monthName} ${yearNum}`;

  return (
    <header className="h-[76px] bg-[var(--header-bg)] border-b border-[var(--header-border)] backdrop-blur-md flex items-center px-[4.5vw] justify-between sticky top-0 z-[100] transition-all duration-300">
      <div className="flex items-center gap-[28px]">
        <div className="flex gap-3 items-center">
          <div className="bg-transparent w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
            <img src={logo} alt="gridshare logo" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <b className="block text-[20px] font-bold font-title tracking-[-0.03em] text-[var(--text-primary)]">gridshare</b>
          </div>
        </div>
      </div>

      <div className="font-mono text-[11px] text-[var(--text-secondary)] flex gap-3 items-center max-[850px]:hidden">
        <span className="inline-block w-2 h-2 bg-[#10b981] rounded-full shadow-[0_0_0_4px_var(--lime-glow)] animate-pulse" /> SIMULATION LIVE <i className="h-4 border-l border-[var(--line)]" /> <b className="text-[var(--text-primary)] font-semibold">{formattedDate}</b>
      </div>

      <div className="flex items-center gap-[10px]">
        <button
          className="bg-[var(--button-outline-bg)] border border-[var(--button-outline-border)] text-[var(--text-secondary)] w-[38px] h-[38px] rounded-full grid place-items-center cursor-pointer relative transition-all duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:border-lime hover:text-lime hover:bg-[var(--button-outline-hover)] hover:-translate-y-[1px]"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button
          className="bg-[var(--button-outline-bg)] border border-[var(--button-outline-border)] text-[var(--text-secondary)] w-[38px] h-[38px] rounded-full grid place-items-center cursor-pointer relative transition-all duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:border-lime hover:text-lime hover:bg-[var(--button-outline-hover)] hover:-translate-y-[1px]"
          onClick={onInfo}
          title="How it works"
        >
          <CircleHelp size={18} />
        </button>

        <button
          className="bg-[var(--button-outline-bg)] border border-[var(--button-outline-border)] text-[var(--text-secondary)] w-[38px] h-[38px] rounded-full grid place-items-center cursor-pointer relative transition-all duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:border-lime hover:text-lime hover:bg-[var(--button-outline-hover)] hover:-translate-y-[1px]"
          title="Notifications"
        >
          <Bell size={18} />
          <span className="absolute top-[9px] right-[9px] w-[6.2px] h-[6.2px] bg-[var(--red)] rounded-full shadow-[0_0_6px_var(--red)]" />
        </button>

        <div className="relative w-[38px] h-[38px] flex items-center justify-center">
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
        </div>
      </div>
    </header>
  );
}
