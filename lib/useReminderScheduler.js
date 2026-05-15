'use client';
import { useEffect } from 'react';

const STORAGE_KEY = 'priority-tasks-reminders';
const LAST_FIRED_KEY = 'priority-tasks-reminders-fired';
const DAY_MAP = ['SU','MO','TU','WE','TH','FR','SA']; // JS getDay() index → our day codes

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function loadFired() {
  try {
    const raw = localStorage.getItem(LAST_FIRED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveFired(fired) {
  try { localStorage.setItem(LAST_FIRED_KEY, JSON.stringify(fired)); } catch {}
}

// Check every minute: is it time to fire any reminder?
function tick() {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const settings = loadSettings();
  if (!settings || !settings.enabled) return;

  const now = new Date();
  const dayCode = DAY_MAP[now.getDay()];
  if (!settings.days?.includes(dayCode)) return;

  // Today as YYYY-MM-DD
  const today = now.toISOString().slice(0, 10);
  const fired = loadFired();
  if (!fired[today]) fired[today] = [];

  // Current time as HH:MM
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const nowHHMM = `${hh}:${mm}`;

  for (const t of (settings.times || [])) {
    // Fire if scheduled time is now or up to 5 min ago, and hasn't fired today
    if (fired[today].includes(t)) continue;
    if (t > nowHHMM) continue;
    // Only fire if within 5 min of scheduled time (don't spam if user opens at 3 PM with 8 AM reminder)
    const [h, m] = t.split(':').map(Number);
    const scheduled = new Date(now);
    scheduled.setHours(h, m, 0, 0);
    const diffMin = (now - scheduled) / 60000;
    if (diffMin > 5) {
      // Mark as fired but don't actually notify — too late
      fired[today].push(t);
      continue;
    }

    // Fire it
    try {
      new Notification('Priority Tasks check-in', {
        body: 'Review overdue items, blockers, and recent updates.',
        icon: '/icon.png',
        tag: `priority-tasks-${today}-${t}`, // dedupes if multiple tabs
        requireInteraction: false,
      });
    } catch (e) {
      console.warn('Notification failed:', e);
    }
    fired[today].push(t);
  }

  // Clean up old days (keep last 7 days)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  for (const day of Object.keys(fired)) {
    if (day < cutoffStr) delete fired[day];
  }

  saveFired(fired);
}

export default function useReminderScheduler() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Tick immediately + every 60s
    tick();
    const interval = setInterval(tick, 60000);

    // Also tick when tab becomes visible (catches reminders missed while tab was hidden)
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}
