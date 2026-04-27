'use client';

import { useEffect, useRef } from 'react';

type DotFieldProps = {
  dotRadius?: number;
  dotSpacing?: number;
  bulgeStrength?: number;
  glowRadius?: number;
  sparkle?: boolean;
  waveAmplitude?: number;
  cursorRadius?: number;
  cursorForce?: number;
  bulgeOnly?: boolean;
  gradientFrom?: string;
  gradientTo?: string;
  glowColor?: string;
  className?: string;
};

type PointerState = {
  x: number;
  y: number;
  active: boolean;
};

function hexToRgb(color: string) {
  const normalized = String(color || '').trim().replace('#', '');
  const safe = normalized.length === 3
    ? normalized.split('').map((part) => part + part).join('')
    : normalized.padEnd(6, '0').slice(0, 6);

  return {
    r: parseInt(safe.slice(0, 2), 16),
    g: parseInt(safe.slice(2, 4), 16),
    b: parseInt(safe.slice(4, 6), 16),
  };
}

function mixColor(start: string, end: string, ratio: number) {
  const left = hexToRgb(start);
  const right = hexToRgb(end);
  const weight = Math.max(0, Math.min(1, ratio));
  const inverse = 1 - weight;

  return {
    r: Math.round(left.r * inverse + right.r * weight),
    g: Math.round(left.g * inverse + right.g * weight),
    b: Math.round(left.b * inverse + right.b * weight),
  };
}

function rgbaString(color: { r: number; g: number; b: number }, alpha: number) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

export default function DotField({
  dotRadius = 1.5,
  dotSpacing = 14,
  bulgeStrength = 67,
  glowRadius = 160,
  sparkle = false,
  waveAmplitude = 0,
  cursorRadius = 500,
  cursorForce = 0.1,
  bulgeOnly = true,
  gradientFrom = '#154c79',
  gradientTo = '#207e77',
  glowColor = '#12212e',
  className = '',
}: DotFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef<PointerState>({ x: -9999, y: -9999, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let devicePixelRatio = window.devicePixelRatio || 1;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      devicePixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * devicePixelRatio);
      canvas.height = Math.round(height * devicePixelRatio);
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };

    const render = (time: number) => {
      const pointer = pointerRef.current;
      context.clearRect(0, 0, width, height);

      const glow = hexToRgb(glowColor);
      const glowGradient = context.createRadialGradient(
        pointer.active ? pointer.x : width * 0.32,
        pointer.active ? pointer.y : height * 0.18,
        0,
        pointer.active ? pointer.x : width * 0.32,
        pointer.active ? pointer.y : height * 0.18,
        pointer.active ? glowRadius : glowRadius * 1.35,
      );
      glowGradient.addColorStop(0, rgbaString(glow, pointer.active ? 0.14 : 0.08));
      glowGradient.addColorStop(1, rgbaString(glow, 0));
      context.fillStyle = glowGradient;
      context.fillRect(0, 0, width, height);

      const cols = Math.ceil(width / dotSpacing) + 2;
      const rows = Math.ceil(height / dotSpacing) + 2;
      const waveOffset = waveAmplitude ? Math.sin(time / 1000) * waveAmplitude : 0;

      for (let row = -1; row < rows; row += 1) {
        for (let col = -1; col < cols; col += 1) {
          const baseX = col * dotSpacing;
          const baseY = row * dotSpacing;
          const dx = baseX - pointer.x;
          const dy = baseY - pointer.y;
          const distance = Math.hypot(dx, dy);
          const proximity = pointer.active ? Math.max(0, 1 - distance / cursorRadius) : 0;
          const bulge = proximity * bulgeStrength * cursorForce;
          const safeDistance = distance || 1;
          const offsetX = pointer.active ? (dx / safeDistance) * bulge : 0;
          const offsetY = pointer.active ? (dy / safeDistance) * bulge : 0;
          const x = baseX + (bulgeOnly ? offsetX : waveOffset + offsetX);
          const y = baseY + (bulgeOnly ? offsetY : waveOffset * 0.35 + offsetY);
          const mixRatio = height > 0 ? Math.max(0, Math.min(1, (y + x * 0.12) / (height + width * 0.12))) : 0;
          const dotColor = mixColor(gradientFrom, gradientTo, mixRatio);
          const alpha = 0.18 + proximity * 0.45;
          const radius = dotRadius + proximity * 1.6;

          context.beginPath();
          context.fillStyle = rgbaString(dotColor, alpha);
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fill();

          if (sparkle && pointer.active && proximity > 0.7) {
            context.beginPath();
            context.fillStyle = rgbaString(dotColor, 0.24 + proximity * 0.2);
            context.arc(x, y, radius * 1.9, 0, Math.PI * 2);
            context.fill();
          }
        }
      }

      animationFrame = window.requestAnimationFrame(render);
    };

    const updatePointer = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      pointerRef.current = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        active: true,
      };
    };

    const resetPointer = () => {
      pointerRef.current = { x: -9999, y: -9999, active: false };
    };

    resize();
    animationFrame = window.requestAnimationFrame(render);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', updatePointer);
    window.addEventListener('pointerleave', resetPointer);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', updatePointer);
      window.removeEventListener('pointerleave', resetPointer);
    };
  }, [bulgeOnly, bulgeStrength, cursorForce, cursorRadius, dotRadius, dotSpacing, glowColor, glowRadius, gradientFrom, gradientTo, sparkle, waveAmplitude]);

  return <canvas aria-hidden="true" className={className} ref={canvasRef} />;
}