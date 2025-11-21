import React, { useEffect, useRef } from 'react';

interface VoiceVisualizerProps {
  isActive: boolean;
  modeColor: string;
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ isActive, modeColor }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      
      ctx.clearRect(0, 0, width, height);
      
      if (!isActive) {
        // Flat line
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
      }

      ctx.beginPath();
      ctx.lineWidth = 2;
      // Map tailwind class to hex for canvas (simple approximation)
      ctx.strokeStyle = modeColor.includes('emerald') ? '#10b981' : 
                        modeColor.includes('blue') ? '#3b82f6' : '#8b5cf6';

      for (let i = 0; i < width; i++) {
        // Create a waveform effect
        const amplitude = isActive ? 20 : 2;
        const frequency = 0.05;
        const y = height / 2 + Math.sin(i * frequency + time) * amplitude * Math.sin(i * 0.02);
        
        if (i === 0) {
          ctx.moveTo(i, y);
        } else {
          ctx.lineTo(i, y);
        }
      }
      ctx.stroke();
      
      time += 0.2;
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isActive, modeColor]);

  return (
    <canvas 
      ref={canvasRef} 
      width={300} 
      height={60} 
      className="w-full h-[60px] rounded-md bg-slate-900/50 border border-slate-700"
    />
  );
};
