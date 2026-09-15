'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { applyTheme, getStoredTheme } from '../lib/theme';

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export default function AppHeader() {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState('light');
  const panelRef = useRef(null);

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setSettingsOpen(false);
      }
    }
    if (settingsOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [settingsOpen]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  }

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <button
        onClick={() => router.back()}
        aria-label="Retour"
        className="secondary"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, padding: 0, borderRadius: 999 }}
      >
        <BackIcon />
      </button>

      <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', height: 28 }}>
        <img src="/logo/logo-horizontal-light.svg" alt="REVIO" className="logo-light" style={{ height: 28 }} />
        <img src="/logo/logo-horizontal-dark.svg" alt="REVIO" className="logo-dark" style={{ height: 28 }} />
      </Link>

      <div style={{ position: 'relative' }} ref={panelRef}>
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          aria-label="Réglages"
          className="secondary"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, padding: 0, borderRadius: 999 }}
        >
          <SettingsIcon />
        </button>

        {settingsOpen && (
          <div
            className="card"
            style={{
              position: 'absolute',
              right: 0,
              top: 46,
              width: 220,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            }}
          >
            <p style={{ fontWeight: 600, marginTop: 0, marginBottom: 12 }}>Réglages</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Mode sombre</span>
              <button
                onClick={toggleTheme}
                aria-pressed={theme === 'dark'}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 999,
                  padding: 2,
                  background: theme === 'dark' ? 'var(--color-primary)' : 'var(--color-border)',
                  display: 'flex',
                  justifyContent: theme === 'dark' ? 'flex-end' : 'flex-start',
                }}
              >
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'white', display: 'block' }} />
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
