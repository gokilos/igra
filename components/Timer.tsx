import React, { useEffect, useState } from 'react';

interface TimerProps {
  duration: number; // in seconds
  onTimeUp: () => void;
  isActive: boolean;
  resetKey: number; // Increment to reset
}

const Timer: React.FC<TimerProps> = ({ duration, onTimeUp, isActive, resetKey }) => {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    setTimeLeft(duration);
  }, [duration, resetKey]);

  useEffect(() => {
    if (!isActive || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, timeLeft, onTimeUp]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isCritical = timeLeft <= 10;

  return (
    <div className="flex justify-center">
      <div className={`px-6 py-3 rounded-2xl font-mono font-bold text-lg transition-all ${
        isCritical
          ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white animate-pulse shadow-lg shadow-red-500/50'
          : 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black shadow-lg shadow-yellow-500/30'
      }`}>
        ⏱ {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
      </div>
    </div>
  );
};

export default Timer;