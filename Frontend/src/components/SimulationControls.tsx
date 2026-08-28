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

  return (
    <div className="controls card">
      <div>
        <small>SIMULATED TIME</small>
        <b>
          {day} · {String(hour).padStart(2, '0')}:{String(totalMinutes % 60).padStart(2, '0')}
        </b>
      </div>
      <input
        type="range"
        min="0"
        max="95"
        value={tick}
        onChange={(e) => setTick(+e.target.value)}
      />
      <div className="speed">
        <button onClick={() => setPlaying(!playing)}>
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        {['1x', '2x', '4x'].map((s) => (
          <button
            className={speed === s ? 'active' : ''}
            onClick={() => setSpeed(s)}
            key={s}
          >
            {s}
          </button>
        ))}
        <button onClick={reset}>
          <RefreshCw size={14} />
        </button>
      </div>
    </div>
  );
}
