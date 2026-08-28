import { CircleHelp, Sun, Moon, Bell } from 'lucide-react';
import logo from '../assets/logo.svg';

interface HeaderProps {
  onInfo: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export function Header({ onInfo, theme, onToggleTheme }: HeaderProps) {
  return (
    <header>
      <div className="header-left">
        <div className="brand">
          <div className="logo">
            <img src={logo} alt="gridshare logo" className="logo-svg-icon" />
          </div>
          <div>
            <b>gridshare</b>
          </div>
        </div>
      </div>

      <div className="sim">
        <span className="live-dot" /> SIMULATION LIVE <i /> <b>Tuesday, 14 May 2024</b>
        <span className="clock">LIVE</span>
      </div>

      <div className="header-actions-group">
        <button
          className="icon-btn theme-toggle-btn"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button className="icon-btn" onClick={onInfo} title="How it works">
          <CircleHelp size={18} />
        </button>

        <button className="icon-btn notification-btn" title="Notifications">
          <Bell size={18} />
          <span className="notification-badge" />
        </button>

        <div className="avatar">
          <svg viewBox="0 0 32 32" width="32" height="32" className="avatar-svg">
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
          <div className="avatar-active-dot" />
        </div>
      </div>
    </header>
  );
}
