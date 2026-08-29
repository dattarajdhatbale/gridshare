import React, { useEffect, useState } from 'react';
import logo from '../assets/logo.svg';

interface LoadingScreenProps {
  isFinished: boolean;
  onFadeOutComplete: () => void;
}

export function LoadingScreen({ isFinished, onFadeOutComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [fade, setFade] = useState(false);

  // Handle simulated progress increment
  useEffect(() => {
    let intervalId: any = null;

    if (!isFinished) {
      // Smoothly approach 90% (asymmetric curve)
      intervalId = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev; // Hold at 90% until finished
          const increment = (90 - prev) * 0.08 + 0.5;
          return Math.min(prev + increment, 90);
        });
      }, 60);
    } else {
      // Rapidly complete to 100%
      intervalId = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            if (intervalId) clearInterval(intervalId);
            return 100;
          }
          return prev + 5;
        });
      }, 16);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isFinished]);

  // Handle fade out once 100% progress is achieved
  useEffect(() => {
    if (progress >= 100) {
      // Wait for visual completion before initiating fade out
      const fillDelay = setTimeout(() => {
        setFade(true);

        // Wait for CSS fade-out transition to finish (400ms) before unmounting
        const fadeDelay = setTimeout(() => {
          onFadeOutComplete();
        }, 400);

        return () => clearTimeout(fadeDelay);
      }, 200);

      return () => clearTimeout(fillDelay);
    }
  }, [progress, onFadeOutComplete]);

  return (
    <div
      className={`fixed inset-0 z-[500] bg-[var(--bg-color)] flex flex-col items-center justify-center p-6 loading-overlay ${
        fade ? 'fade-out' : ''
      }`}
      style={{ backgroundImage: 'var(--loading-bg-gradient)' }}
    >
      <div className="flex flex-col items-center gap-6 max-w-sm w-full select-none">
        
        {/* Brand Logo Container with Premium Pulsing Backglow */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-28 h-28 bg-[var(--text-secondary)]/10 rounded-full blur-2xl animate-glow-pulse" />
          <img
            src={logo}
            alt="GridShare Logo"
            className="h-20 w-auto relative animate-bounce-slow"
            style={{ filter: 'drop-shadow(0 4px 20px rgba(215, 201, 174, 0.25))' }}
          />
        </div>

        {/* Title */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-bold text-[34px] font-title tracking-[-0.03em] text-[var(--text-primary)] m-0 leading-none">
            gridshare
          </h1>
        </div>

        {/* Progress Bar Track and Fills */}
        <div className="w-52 h-1.5 bg-[var(--line)] rounded-full overflow-hidden relative shadow-inner mt-2">
          {/* Active progress color */}
          <div
            className="h-full bg-gradient-to-r from-[var(--text-muted)] to-[var(--text-secondary)] rounded-full transition-all duration-100 ease-out shadow-[0_0_8px_rgba(215,201,174,0.4)]"
            style={{ width: `${progress}%` }}
          />
          {/* Subtle loading shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
        </div>
      </div>
    </div>
  );
}
