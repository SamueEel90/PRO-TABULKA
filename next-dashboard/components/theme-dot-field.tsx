'use client';

import { useEffect, useState } from 'react';

import DotField from './dot-field';

const LIGHT_PALETTE = {
  gradientFrom: '#154c79',
  gradientTo: '#207e77',
  glowColor: '#12212e',
};

const DARK_PALETTE = {
  gradientFrom: '#3a6f9c',
  gradientTo: '#c84f40',
  glowColor: '#0a0d12',
};

export default function ThemeDotField() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.body;
    const sync = () => setIsDark(root.classList.contains('theme-dark'));
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  return (
    <DotField
      className="app-background__dots"
      dotRadius={1.5}
      dotSpacing={14}
      bulgeStrength={67}
      glowRadius={160}
      sparkle={false}
      waveAmplitude={0}
      cursorRadius={500}
      cursorForce={0.1}
      bulgeOnly
      gradientFrom={palette.gradientFrom}
      gradientTo={palette.gradientTo}
      glowColor={palette.glowColor}
    />
  );
}
