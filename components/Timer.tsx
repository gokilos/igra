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

  const progress = (timeLeft / duration) * 100;
  const isCritical = timeLeft <= 10;

  return (
    <div className="w-full">
      <div className="h-1.5 w-full bg-squid-dark/50 rounded-full overflow-hidden relative">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${isCritical ? 'bg-squid-pink animate-pulse' : 'bg-squid-green'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default Timer;