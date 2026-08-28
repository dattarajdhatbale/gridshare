import { Pause, Play, RefreshCw } from 'lucide-react';

interface SimulationControlsProps {
  playing: boolean;
  setPlaying: (v: boolean) => void;
  speed: string;
  setSpeed: (v: string) => void;
  tick: number;
  setTick: (v: number) => void;
  reset: () => void;
}

export function SimulationControls({
  playing,
  setPlaying,
  speed,
  setSpeed,
  tick,
  setTick,
  reset,
}: SimulationControlsProps) {
  const totalMinutes = 9 * 60 + tick * 15;
  const hour = Math.floor(totalMinutes / 60) % 24;
  const day = totalMinutes >= 1440 ? 'Wednesday' : 'Tuesday';

  const btnBaseClass = "border border-[var(--button-outline-border)] bg-[var(--button-outline-bg)] rounded-[6px] py-2 px-3 font-mono font-semibold text-[11px] text-[var(--text-secondary)] cursor-pointer flex items-center justify-center transition-all duration-200 hover:border-lime hover:text-lime";
  const btnActiveClass = "bg-lime border-lime text-[var(--button-primary-text)] rounded-[6px] py-2 px-3 font-mono font-semibold text-[11px] cursor-pointer flex items-center justify-center transition-all duration-200";

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[20px] shadow-[var(--card-shadow)] backdrop-blur-md relative overflow-hidden transition-all duration-300 mt-[22px] flex items-center gap-6 p-4 px-6 max-[520px]:block">
      <div>
        <small className="font-mono text-[10px] font-medium tracking-[0.12em] text-[var(--text-secondary)] uppercase block">SIMULATED TIME</small>
        <b className="font-mono text-[13px] font-bold block mt-1 text-[var(--text-primary)]">
          {day} · {String(hour).padStart(2, '0')}:{String(totalMinutes % 60).padStart(2, '0')}
        </b>
      </div>
      <input
        type="range"
        min="0"
        max="95"
        value={tick}
        onChange={(e) => setTick(+e.target.value)}
        className="accent-lime h-[6px] rounded-[3px] bg-[var(--line)] cursor-pointer flex-1 max-[520px]:w-full max-[520px]:my-4"
      />
      <div className="flex gap-1.5 max-[520px]:justify-end">
        <button className={btnBaseClass} onClick={() => setPlaying(!playing)}>
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        {['1x', '2x', '4x'].map((s) => (
          <button
            className={speed === s ? btnActiveClass : btnBaseClass}
            onClick={() => setSpeed(s)}
            key={s}
          >
            {s}
          </button>
        ))}
        <button className={btnBaseClass} onClick={reset}>
          <RefreshCw size={14} />
        </button>
      </div>
    </div>
  );
}
