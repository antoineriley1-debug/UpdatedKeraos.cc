'use client';
import { useState, useEffect } from 'react';
import { Bell, BellOff, X, Check, AlertCircle } from 'lucide-react';

const T = {
  bg: '#1a1815',
  surface: '#221f1a',
  surfaceElev: '#2a2620',
  border: '#3a342d',
  borderHi: '#4a443c',
  bronze: '#c39248',
  bronzeDim: '#a87938',
  amber: '#c47e3f',
  sage: '#5a8d68',
  text: '#e8e4dc',
  textMute: '#a89e90',
  textDim: '#6b6358',
  red: '#c95a5a',
};

const STORAGE_KEY = 'priority-tasks-reminders';

const DAYS = [
  { key: 'MO', label: 'Mon' },
  { key: 'TU', label: 'Tue' },
  { key: 'WE', label: 'Wed' },
  { key: 'TH', label: 'Thu' },
  { key: 'FR', label: 'Fri' },
  { key: 'SA', label: 'Sat' },
  { key: 'SU', label: 'Sun' },
];

const PRESETS = [
  { label: 'Weekday mornings (8 AM)',          times: ['08:00'],          days: ['MO','TU','WE','TH','FR'] },
  { label: 'Twice daily — 8 AM & 2 PM',        times: ['08:00','14:00'],  days: ['MO','TU','WE','TH','FR'] },
  { label: 'Mornings (every day)',             times: ['08:00'],          days: ['MO','TU','WE','TH','FR','SA','SU'] },
  { label: 'Monday only',                      times: ['08:00'],          days: ['MO'] },
];

function defaultSettings() {
  return { enabled: false, days: ['MO','TU','WE','TH','FR'], times: ['08:00','14:00'] };
}

export default function ReminderSettings({ onClose, userName }) {
  const [settings, setSettings] = useState(defaultSettings());
  const [permission, setPermission] = useState('default');
  const [supported, setSupported] = useState(true);
  const [savedHint, setSavedHint] = useState(false);

  // Load stored settings + check support on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) {
      setSupported(false);
      return;
    }
    setPermission(Notification.permission);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...defaultSettings(), ...JSON.parse(raw) });
    } catch {}
  }, []);

  const persist = (next) => {
    setSettings(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSavedHint(true);
      setTimeout(() => setSavedHint(false), 1500);
    } catch {}
  };

  const requestPerm = async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      // Show a test notification right away so user sees it works
      new Notification('Priority Tasks reminders are on', {
        body: 'You\'ll get a ping at your scheduled times.',
        icon: '/icon.png',
      });
      // Enable by default once permission granted
      persist({ ...settings, enabled: true });
    }
  };

  const toggleDay = (dayKey) => {
    const days = settings.days.includes(dayKey)
      ? settings.days.filter(d => d !== dayKey)
      : [...settings.days, dayKey];
    persist({ ...settings, days });
  };

  const updateTime = (idx, value) => {
    const times = [...settings.times];
    times[idx] = value;
    persist({ ...settings, times });
  };

  const addTime = () => {
    if (settings.times.length >= 4) return;
    persist({ ...settings, times: [...settings.times, '12:00'] });
  };

  const removeTime = (idx) => {
    if (settings.times.length <= 1) return;
    persist({ ...settings, times: settings.times.filter((_, i) => i !== idx) });
  };

  const applyPreset = (preset) => {
    persist({ enabled: true, days: preset.days, times: preset.times });
  };

  const toggleEnabled = () => {
    if (!settings.enabled && permission !== 'granted') {
      requestPerm();
      return;
    }
    persist({ ...settings, enabled: !settings.enabled });
  };

  const labelStyle = {
    display: 'block', fontSize: 10, letterSpacing: '0.14em',
    textTransform: 'uppercase', color: T.textMute, marginBottom: 10, fontWeight: 500,
  };

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        zIndex: 50, backdropFilter: 'blur(3px)',
      }} />
      <div className="fade-in scrollbar" style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(520px, 94vw)', maxHeight: '90vh', overflowY: 'auto',
        background: T.surface, border: `1px solid ${T.borderHi}`,
        borderRadius: 12, zIndex: 51,
        boxShadow: '0 24px 80px -16px rgba(0,0,0,0.7)',
      }}>
        <div style={{
          padding: '20px 28px', borderBottom: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.bronze, marginBottom: 6 }}>
              Personal Reminders
            </div>
            <h2 className="display" style={{ fontSize: 20, fontWeight: 500, color: T.text, margin: 0 }}>
              Notification schedule
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 6,
            color: T.textMute, padding: 8, cursor: 'pointer',
          }}><X size={16} /></button>
        </div>

        <div style={{ padding: '20px 28px' }}>

          {/* SUPPORT / PERMISSION STATE */}
          {!supported && (
            <div style={{
              padding: '12px 14px', borderRadius: 7,
              background: T.amber + '15', border: `1px solid ${T.amber}40`,
              color: T.amber, fontSize: 12, marginBottom: 16,
              display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Your browser doesn't support web notifications. Try Chrome, Edge, or Safari 16.4+.</span>
            </div>
          )}

          {supported && permission === 'denied' && (
            <div style={{
              padding: '12px 14px', borderRadius: 7,
              background: T.red + '15', border: `1px solid ${T.red}40`,
              color: T.red, fontSize: 12, marginBottom: 16,
              display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Notifications are blocked. Enable them in your browser settings for this site, then reload.</span>
            </div>
          )}

          {supported && permission === 'default' && (
            <button
              onClick={requestPerm}
              style={{
                width: '100%', padding: '14px',
                background: T.bronze, color: T.bg,
                border: 'none', borderRadius: 8, cursor: 'pointer',
                fontSize: 13, fontWeight: 600, marginBottom: 20,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: `0 4px 16px -4px ${T.bronze}80`,
              }}
            >
              <Bell size={15} strokeWidth={2.5} /> Turn on notifications
            </button>
          )}

          {supported && permission === 'granted' && (
            <>
              {/* MASTER TOGGLE */}
              <div style={{
                padding: '14px 16px', borderRadius: 8,
                background: settings.enabled ? T.sage + '15' : T.surfaceElev,
                border: `1px solid ${settings.enabled ? T.sage + '40' : T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 24,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {settings.enabled
                    ? <Bell size={16} color={T.sage} />
                    : <BellOff size={16} color={T.textMute} />}
                  <span style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>
                    {settings.enabled ? 'Reminders on' : 'Reminders off'}
                  </span>
                </div>
                <button onClick={toggleEnabled} style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: settings.enabled ? T.sage : T.border,
                  border: 'none', cursor: 'pointer', position: 'relative',
                  transition: 'background 0.15s ease',
                }}>
                  <span style={{
                    position: 'absolute', top: 2,
                    left: settings.enabled ? 22 : 2,
                    width: 20, height: 20, borderRadius: 10,
                    background: T.text, transition: 'left 0.15s ease',
                  }} />
                </button>
              </div>

              {/* PRESETS */}
              <label style={labelStyle}>Quick presets</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
                {PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p)}
                    style={{
                      padding: '10px 14px', borderRadius: 7,
                      background: T.bg, border: `1px solid ${T.border}`,
                      color: T.text, fontSize: 12, cursor: 'pointer',
                      textAlign: 'left', fontFamily: 'inherit',
                      transition: 'background 0.1s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = T.surfaceElev}
                    onMouseLeave={e => e.currentTarget.style.background = T.bg}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* DAYS */}
              <label style={labelStyle}>Days</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
                {DAYS.map(d => {
                  const on = settings.days.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      onClick={() => toggleDay(d.key)}
                      style={{
                        padding: '7px 12px', borderRadius: 6,
                        background: on ? T.bronze : T.bg,
                        color: on ? T.bg : T.textMute,
                        border: `1px solid ${on ? T.bronze : T.border}`,
                        cursor: 'pointer', fontSize: 11, fontWeight: 600,
                        fontFamily: 'inherit',
                        transition: 'all 0.1s ease',
                      }}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>

              {/* TIMES */}
              <label style={labelStyle}>Times</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                {settings.times.map((time, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="time"
                      value={time}
                      onChange={e => updateTime(idx, e.target.value)}
                      style={{
                        flex: 1, padding: '9px 12px',
                        background: T.bg, border: `1px solid ${T.border}`,
                        borderRadius: 7, color: T.text, fontSize: 13,
                        fontFamily: 'inherit', outline: 'none',
                        colorScheme: 'dark',
                      }}
                    />
                    {settings.times.length > 1 && (
                      <button onClick={() => removeTime(idx)} style={{
                        padding: 8, background: 'transparent',
                        border: `1px solid ${T.border}`, borderRadius: 6,
                        color: T.textMute, cursor: 'pointer',
                      }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {settings.times.length < 4 && (
                <button onClick={addTime} style={{
                  padding: '8px 14px', background: 'transparent',
                  border: `1px dashed ${T.border}`, borderRadius: 7,
                  color: T.textMute, fontSize: 12, cursor: 'pointer',
                  fontFamily: 'inherit', marginBottom: 16,
                }}>
                  + Add another time
                </button>
              )}
            </>
          )}

          {/* SAVED HINT */}
          {savedHint && (
            <div style={{
              padding: '8px 12px', borderRadius: 6,
              background: T.sage + '15', color: T.sage,
              fontSize: 11, display: 'flex', alignItems: 'center', gap: 6,
              marginTop: 8,
            }}>
              <Check size={12} /> Saved
            </div>
          )}

          {/* HELP COPY */}
          <div style={{
            marginTop: 20, padding: '12px 14px',
            background: T.bg, border: `1px solid ${T.border}`,
            borderRadius: 7, fontSize: 11, color: T.textMute, lineHeight: 1.6,
          }}>
            <strong style={{ color: T.text }}>Tip:</strong> for reminders to fire when the browser is closed,
            add this site to your home screen (Share → Add to Home Screen on iPhone, or Install button on Android/desktop Chrome).
            Otherwise, reminders fire whenever a tab is open.
          </div>
        </div>
      </div>
    </>
  );
}
