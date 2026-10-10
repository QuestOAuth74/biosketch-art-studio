import { useEffect, useState } from 'react';

export function AppSplash() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setFading(true), 700);
    const hideTimer = window.setTimeout(() => setVisible(false), 1100);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'linear-gradient(135deg, hsl(220 55% 20%) 0%, hsl(220 65% 12%) 100%)',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'opacity 400ms ease-out',
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? 'none' : 'auto',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
        Biosketch<span style={{ opacity: 0.6 }}>.Art</span>
      </div>
      <div style={{ fontSize: '0.9rem', letterSpacing: '0.1em', opacity: 0.7, marginTop: 4, textTransform: 'uppercase' }}>
        Studio
      </div>
      <div
        style={{
          marginTop: '2rem',
          width: 160,
          height: 2,
          background: 'rgba(255,255,255,0.1)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: '40%',
            height: '100%',
            background: 'rgba(255,255,255,0.6)',
            borderRadius: 2,
            animation: 'biosketch-splash-slide 1.1s ease-in-out infinite',
          }}
        />
      </div>
      <style>{`
        @keyframes biosketch-splash-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(260%); }
        }
      `}</style>
    </div>
  );
}
