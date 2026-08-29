import React, { useState, useEffect } from 'react';
import { useSession } from '../auth/SessionContext';
import { API_BASE_URL } from '../config';
import { Sun, Moon, Key, User, ShieldAlert, Sparkles } from 'lucide-react';
import logo from '../assets/logo.svg';

interface LoginScreenProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

interface MeterItem {
  id: string;
  name: string;
  role: 'solar' | 'consumer' | 'prosumer';
}

export function LoginScreen({ theme, onToggleTheme }: LoginScreenProps) {
  const { login, loginOperator } = useSession();
  const [activeTab, setActiveTab] = useState<'household' | 'operator'>('household');

  // Household list states
  const [meters, setMeters] = useState<MeterItem[]>([]);
  const [loadingMeters, setLoadingMeters] = useState(true);
  const [metersError, setMetersError] = useState<string | null>(null);

  // Selection & form states
  const [selectedMeter, setSelectedMeter] = useState<MeterItem | null>(null);
  const [pin, setPin] = useState('');
  const [operatorCode, setOperatorCode] = useState('');

  // Submission states
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // Fetch meters list on mount
  useEffect(() => {
    async function fetchMeters() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/meters`);
        if (!res.ok) throw new Error('Failed to load meters');
        const data = await res.json();
        setMeters(data);
      } catch (err) {
        console.error('Error loading meters list:', err);
        setMetersError('Could not load neighborhood meters. Please check connection.');
      } finally {
        setLoadingMeters(false);
      }
    }
    fetchMeters();
  }, []);

  // Track submission timer for cold start check (3 seconds threshold)
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (submitting) {
      timer = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      setSecondsElapsed(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [submitting]);

  const handleHouseholdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeter || pin.length < 4) return;

    setSubmitting(true);
    setLoginError(null);

    try {
      await login(selectedMeter.id, pin);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Invalid PIN.');
      setSubmitting(false);
    }
  };

  const handleOperatorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorCode) return;

    setSubmitting(true);
    setLoginError(null);

    try {
      await loginOperator(operatorCode);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Invalid operator credentials.');
      setSubmitting(false);
    }
  };

  const selectRoleColor = (role: 'solar' | 'consumer' | 'prosumer') => {
    switch (role) {
      case 'solar':
        return 'bg-[rgba(229,195,120,0.12)] text-[#E5C378] border-[rgba(229,195,120,0.22)]';
      case 'prosumer':
        return 'bg-[rgba(192,107,34,0.12)] text-[#C06B22] border-[rgba(192,107,34,0.22)]';
      case 'consumer':
        default:
        return 'bg-[rgba(90,84,74,0.12)] text-[#847B6D] border-[rgba(90,84,74,0.22)]';
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-color)] bg-[var(--bg-gradient)] text-[var(--text-primary)] flex flex-col items-center justify-center p-4 transition-all duration-300 font-sans">
      
      {/* Top Header Controls */}
      <div className="absolute top-6 right-6 flex items-center gap-3">
        <button
          onClick={onToggleTheme}
          className="w-10 h-10 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-primary)] flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-105 shadow-sm"
          title="Toggle Light/Dark Theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-[500px] bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[24px] p-8 shadow-[var(--card-shadow)] backdrop-blur-md relative overflow-hidden transition-all duration-300 flex flex-col">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-7">
          <img src={logo} alt="GridShare Logo" className="h-10 w-auto mb-3" style={{ filter: 'brightness(1)' }} />
          <h1 className="font-semibold text-[26px] font-title tracking-[-0.03em] leading-none m-0">
            GridShare Login
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1.5 mb-0 max-w-[320px]">
            Access peer-to-peer microgrid energy trading dashboard.
          </p>
        </div>

        {/* Form Error Banner */}
        {loginError && (
          <div className="mb-5 p-3.5 bg-red-500/10 text-red-500 rounded-[14px] border border-red-500/20 text-[12.5px] font-medium flex items-center gap-2">
            <ShieldAlert size={16} className="flex-shrink-0" />
            <span>{loginError}</span>
          </div>
        )}

        {/* Tab Buttons (Hide if meter selected for pin entry) */}
        {!selectedMeter && (
          <div className="flex bg-[rgba(45,45,45,0.04)] dark:bg-[rgba(215,201,174,0.04)] p-1 rounded-full border border-[var(--line)] mb-6">
            <button
              onClick={() => {
                setActiveTab('household');
                setLoginError(null);
              }}
              className={`flex-1 py-2 px-4 rounded-full font-title font-semibold text-[14px] cursor-pointer transition-all duration-200 ${
                activeTab === 'household'
                  ? 'bg-[#2D2D2D] text-[#E5C378] dark:bg-[#232323] dark:text-[#E5C378] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Household Resident
            </button>
            <button
              onClick={() => {
                setActiveTab('operator');
                setLoginError(null);
              }}
              className={`flex-1 py-2 px-4 rounded-full font-title font-semibold text-[14px] cursor-pointer transition-all duration-200 ${
                activeTab === 'operator'
                  ? 'bg-[#2D2D2D] text-[#E5C378] dark:bg-[#232323] dark:text-[#E5C378] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Grid Operator
            </button>
          </div>
        )}

        {/* Tabs Content */}
        {activeTab === 'household' ? (
          /* Household Selection / Form */
          selectedMeter ? (
            /* Selected Meter PIN Entry Form */
            <form onSubmit={handleHouseholdSubmit} className="flex flex-col gap-4">
              <div className="flex justify-between items-center mb-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMeter(null);
                    setPin('');
                    setLoginError(null);
                  }}
                  className="font-mono text-[10px] font-bold text-[#C06B22] dark:text-[#E5C378] tracking-[0.05em] uppercase hover:underline cursor-pointer bg-transparent border-none p-0"
                >
                  ← BACK TO GRID
                </button>
                <span className="font-mono text-[9px] font-semibold uppercase px-2 py-0.5 rounded bg-[rgba(45,45,45,0.08)] dark:bg-[rgba(215,201,174,0.15)] text-[var(--text-primary)] border border-[var(--line)]">
                  {selectedMeter.id}
                </span>
              </div>

              <div className="p-4 bg-[rgba(45,45,45,0.02)] dark:bg-[rgba(215,201,174,0.02)] rounded-[18px] border border-[var(--line)] mb-2 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[16px] text-[var(--text-primary)] m-0">{selectedMeter.name}</h3>
                  <span className="text-[11.5px] text-[var(--text-secondary)]">Selected Household</span>
                </div>
                <span className={`text-[10px] font-bold font-mono tracking-[0.05em] uppercase border py-0.5 px-2 rounded-full capitalize ${selectRoleColor(selectedMeter.role)}`}>
                  {selectedMeter.role}
                </span>
              </div>

              {/* Secure 4-Digit PIN Input */}
              <div className="flex flex-col">
                <label className="font-mono text-[9px] font-bold text-[var(--text-secondary)] tracking-[0.08em] uppercase mb-1.5">
                  ENTER 4-DIGIT PIN
                </label>
                <div className="relative">
                  <Key className="absolute left-3.5 top-3 text-[var(--text-muted)]" size={16} />
                  <input
                    type="password"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    required
                    disabled={submitting}
                    className="w-full pl-10 pr-4 py-2.5 rounded-[14px] border border-[var(--card-border)] bg-[rgba(0,0,0,0.02)] dark:bg-[rgba(255,255,255,0.02)] text-[var(--text-primary)] font-bold text-center tracking-[1em] text-[18px] focus:outline-none focus:ring-2 focus:ring-lime"
                  />
                </div>
              </div>

              {/* Demo Hint Banner (Dismissible/Helpful) */}
              <div className="p-3 bg-[rgba(229,195,120,0.08)] border border-[rgba(229,195,120,0.18)] rounded-[14px] text-[11px] text-[var(--text-secondary)] leading-relaxed mt-1 flex items-start gap-2">
                <Sparkles size={14} className="text-[#C06B22] dark:text-[#E5C378] flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Demo Mode Help:</strong> PIN is 1000 + meter index number (e.g., M-01 PIN is <strong>1001</strong>, M-03 PIN is <strong>1003</strong>).
                </div>
              </div>

              {/* Submit Button with Cold Start Awareness */}
              <button
                type="submit"
                disabled={submitting || pin.length < 4}
                className="w-full py-3 px-4 rounded-full font-title font-semibold text-[15px] cursor-pointer bg-[#2D2D2D] text-[#E5C378] dark:bg-[#232323] dark:text-[#E5C378] shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 mt-2"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-t-transparent border-[#E5C378] rounded-full animate-spin" />
                    <span>{secondsElapsed >= 3 ? 'Waking the microgrid...' : 'Verifying PIN...'}</span>
                  </>
                ) : (
                  'Login'
                )}
              </button>
            </form>
          ) : (
            /* Selectable Grid of 12 Meters */
            <div className="flex flex-col">
              <label className="font-mono text-[9px] font-bold text-[var(--text-secondary)] tracking-[0.08em] uppercase mb-2.5">
                SELECT YOUR HOUSEHOLD METER
              </label>

              {loadingMeters ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)] text-[13px]">
                  <span className="w-6 h-6 border-2 border-t-transparent border-[var(--text-primary)] rounded-full animate-spin" />
                  <span>Loading grid meters...</span>
                </div>
              ) : metersError ? (
                <div className="py-8 text-center text-red-500 text-[13px]">{metersError}</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {meters.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => {
                        setSelectedMeter(m);
                        setLoginError(null);
                      }}
                      className="bg-[rgba(45,45,45,0.04)] dark:bg-[rgba(215,201,174,0.04)] border border-[var(--card-border)] rounded-[16px] p-3 cursor-pointer flex justify-between items-center transition-all hover:bg-[rgba(45,45,45,0.08)] hover:scale-[1.01] active:scale-[0.99]"
                    >
                      <div className="overflow-hidden pr-2">
                        <strong className="text-[13.5px] text-[var(--text-primary)] truncate block">{m.name}</strong>
                        <span className="font-mono text-[10px] text-[var(--text-secondary)] uppercase">{m.id}</span>
                      </div>
                      <span className={`text-[8.5px] font-bold font-mono tracking-[0.05em] uppercase border py-0.5 px-1.5 rounded-full capitalize flex-shrink-0 ${selectRoleColor(m.role)}`}>
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        ) : (
          /* Operator Tab Credentials Input */
          <form onSubmit={handleOperatorSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col">
              <label className="font-mono text-[9px] font-bold text-[var(--text-secondary)] tracking-[0.08em] uppercase mb-1.5">
                GRID OPERATOR SYSTEM CODE
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 text-[var(--text-muted)]" size={16} />
                <input
                  type="password"
                  value={operatorCode}
                  onChange={(e) => setOperatorCode(e.target.value)}
                  placeholder="Enter administrator code"
                  required
                  disabled={submitting}
                  className="w-full pl-10 pr-4 py-3 rounded-[14px] border border-[var(--card-border)] bg-[rgba(0,0,0,0.02)] dark:bg-[rgba(255,255,255,0.02)] text-[var(--text-primary)] text-[14px] focus:outline-none focus:ring-2 focus:ring-lime"
                />
              </div>
            </div>

            <div className="p-3 bg-[rgba(45,45,45,0.04)] dark:bg-[rgba(215,201,174,0.04)] rounded-[14px] text-[11px] text-[var(--text-secondary)] leading-relaxed mt-1 flex items-start gap-2 border border-[var(--line)]">
              <ShieldAlert size={14} className="text-[#C06B22] dark:text-[#E5C378] flex-shrink-0 mt-0.5" />
              <div>
                Operator login authorizes global control metrics, including play/pause and reset rules.
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !operatorCode}
              className="w-full py-3 px-4 rounded-full font-title font-semibold text-[15px] cursor-pointer bg-[#2D2D2D] text-[#E5C378] dark:bg-[#232323] dark:text-[#E5C378] shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 mt-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-t-transparent border-[#E5C378] rounded-full animate-spin" />
                  <span>{secondsElapsed >= 3 ? 'Waking the microgrid...' : 'Authenticating...'}</span>
                </>
              ) : (
                'Login as Operator'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
