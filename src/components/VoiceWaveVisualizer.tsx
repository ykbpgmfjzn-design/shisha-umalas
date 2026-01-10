import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface VoiceWaveVisualizerProps {
  isActive: boolean;
  variant?: 'listening' | 'speaking';
  audioLevel?: number;
}

export const VoiceWaveVisualizer = ({ 
  isActive, 
  variant = 'listening',
  audioLevel = 0.5 
}: VoiceWaveVisualizerProps) => {
  const [bars, setBars] = useState<number[]>([]);
  const animationRef = useRef<number>();
  const barsCount = 24;

  useEffect(() => {
    if (!isActive) {
      setBars(Array(barsCount).fill(4));
      return;
    }

    const animate = () => {
      setBars(prev => prev.map((_, i) => {
        const centerDistance = Math.abs(i - barsCount / 2) / (barsCount / 2);
        const baseHeight = variant === 'speaking' ? 30 : 20;
        const variation = variant === 'speaking' ? 25 : 15;
        const randomFactor = Math.random() * variation * audioLevel;
        const centerFactor = (1 - centerDistance * 0.5);
        return Math.max(4, (baseHeight - centerDistance * 15 + randomFactor) * centerFactor);
      }));
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, variant, audioLevel]);

  // Initialize bars
  useEffect(() => {
    setBars(Array(barsCount).fill(4));
  }, []);

  const getBarColor = (index: number) => {
    const centerDistance = Math.abs(index - barsCount / 2) / (barsCount / 2);
    if (variant === 'speaking') {
      return `hsl(var(--primary) / ${1 - centerDistance * 0.4})`;
    }
    return `hsl(var(--golden) / ${1 - centerDistance * 0.4})`;
  };

  return (
    <div className="flex items-center justify-center gap-[3px] h-16 px-4">
      {bars.map((height, i) => (
        <motion.div
          key={i}
          animate={{ height }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 20,
            mass: 0.5,
          }}
          className="w-1 rounded-full"
          style={{ 
            backgroundColor: getBarColor(i),
            minHeight: 4,
          }}
        />
      ))}
    </div>
  );
};
