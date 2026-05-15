'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search, X, AlertCircle, Clock, CheckCircle2, Users, Calendar,
  ChevronRight, AlertTriangle, RefreshCw, FileText, MessageSquare,
  Paperclip, Tag, Building2, Layers, ArrowUpRight,
  Plus, RotateCcw, Edit2, Check, LogOut, User as UserIcon, Bell
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { canCreate, canEdit, canClose, canReopen } from '@/lib/permissions';
import ReminderSettings from './ReminderSettings';
import useReminderScheduler from '@/lib/useReminderScheduler';

const SHEET_NAME = process.env.NEXT_PUBLIC_DISPLAY_NAME || 'Priority Tasks';
const POLL_INTERVAL_MS = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS || 60000);
const TODAY = new Date();


// ============================================================
// THEME — operations console
// ============================================================

const T = {
  bg: '#0b0d12',
  surface: '#13161e',
  surfaceElev: '#1c2029',
  surfaceHi: '#252a34',
  border: '#272c37',
  borderHi: '#3a4150',
  text: '#ece9e0',
  textMute: '#8a93a3',
  textDim: '#5b6373',
  bronze: '#d4a574',
  bronzeDim: '#8a6d4a',
  sage: '#7eb872',
  amber: '#e8b54a',
  red: '#d96b6b',
  blue: '#7a9cc6',
  violet: '#a98fd1',
};

const STATUS_THEME = {
  completed: { color: T.sage, label: 'Completed' },
  in_progress: { color: T.bronze, label: 'In Progress' },
  nearing_completion: { color: T.amber, label: 'Nearing Completion' },
  to_develop: { color: T.blue, label: 'To Develop' },
  needs_discussion: { color: T.violet, label: 'Needs Discussion' },
  no_status: { color: T.textDim, label: 'No Status' },
  other: { color: T.textMute, label: 'Other' },
};

// ============================================================
// NORMALIZATION
// ============================================================

function normalizeStatus(raw) {
  if (!raw || !String(raw).trim()) return 'no_status';
  const s = String(raw).toLowerCase().trim();
  if (s.startsWith('complete')) return 'completed';
  if (s.includes('need to discuss') || s.includes('needs discussion')) return 'needs_discussion';
  if (s.includes('nearing')) return 'nearing_completion';
  if (s.startsWith('in progress') || s.includes('in progress')) return 'in_progress';
  if (s.includes('to develop') || s.includes('develop')) return 'to_develop';
  return 'other';
}

function dateInfo(endDate) {
  if (!endDate) return { hasDate: false };
  const d = new Date(endDate);
  d.setHours(0, 0, 0, 0);
  const t = new Date(TODAY);
  t.setHours(0, 0, 0, 0);
  const days = Math.round((d - t) / (1000 * 60 * 60 * 24));
  return {
    hasDate: true,
    iso: endDate,
    pretty: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    days,
    isOverdue: days < 0,
    isDueSoon: days >= 0 && days <= 7,
  };
}

function shortName(name) {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0];
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function relativeTime(date) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ============================================================
// MAIN
// ============================================================

export default function Dashboard({ initialUser }) {
  const user = initialUser; // server-rendered, always present here
  const [rows, setRows] = useState([]);
  const [comments, setComments] = useState({});
  const [attachments, setAttachments] = useState({});
  const [version, setVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [pulledAt, setPulledAt] = useState(new Date());

  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [quickFilter, setQuickFilter] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [tick, setTick] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [showReminders, setShowReminders] = useState(false);

  // Schedule personal browser reminders based on each user's localStorage settings
  useReminderScheduler();
  const [busy, setBusy] = useState(false);

  const pushToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };

  // Fetch full sheet from API
  const fetchSheet = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks', { cache: 'no-store' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setRows(data.rows || []);
      setComments(data.comments || {});
      setAttachments(data.attachments || {});
      setVersion(data.version);
      setPulledAt(new Date());
      setLoadError(null);
    } catch (e) {
      console.error('fetchSheet error:', e);
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSheet(); }, [fetchSheet]);

  useEffect(() => {
    if (version === null) return;
    const i = setInterval(async () => {
      try {
        const res = await fetch('/api/sheet/version', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.version !== version) await fetchSheet();
      } catch (e) {
        console.warn('polling error:', e);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(i);
  }, [version, fetchSheet]);

  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(i);
  }, []);

  // Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.reload();
    } catch (e) {
      pushToast('Logout failed', 'error');
    }
  };

  // Write handlers — real Smartsheet writes via API routes.
  // User identity comes from the auth cookie (no userName in body).
  const handleCreate = async (newTask) => {
    setBusy(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      pushToast(`Task created: "${newTask.Tasks.slice(0, 48)}${newTask.Tasks.length > 48 ? '…' : ''}"`);
      setShowAddModal(false);
      await fetchSheet();
    } catch (e) {
      pushToast(`Create failed: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (row_id, fields) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${row_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      pushToast('Task updated');
      await fetchSheet();
      return true;
    } catch (e) {
      pushToast(`Update failed: ${e.message}`, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async (row_id) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${row_id}/close`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Close failed');
      pushToast('Task closed');
      await fetchSheet();
    } catch (e) {
      pushToast(`Close failed: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleReopen = async (row_id) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${row_id}/reopen`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reopen failed');
      pushToast('Task reopened');
      await fetchSheet();
    } catch (e) {
      pushToast(`Reopen failed: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  // Enrich rows
  const enriched = useMemo(() => rows.map(r => {
    const sk = normalizeStatus(r.Status);
    const di = dateInfo(r.EndDate);
    return {
      ...r,
      statusKey: sk,
      statusTheme: STATUS_THEME[sk],
      isComplete: sk === 'completed',
      dateInfo: di,
      hasOwner: !!(r.Owner && r.Owner.trim()),
      commentCount: (comments[r.row_id] || []).length,
      attachmentCount: (attachments[r.row_id] || []).length,
    };
  }), [rows, comments, attachments]);

  const selected = selectedId ? enriched.find(r => r.row_id === selectedId) : null;

  const owners = useMemo(() => [...new Set(enriched.map(r => r.Owner).filter(Boolean))].sort(), [enriched]);
  const categories = useMemo(() => [...new Set(enriched.map(r => r.Category).filter(Boolean))].sort(), [enriched]);
  const statuses = useMemo(() => [...new Set(enriched.map(r => r.statusKey))], [enriched]);

  const filtered = useMemo(() => {
    return enriched.filter(r => {
      if (search) {
        const q = search.toLowerCase();
        const hay = [r.Tasks, r.Notes, r.Owner, r.Category, r.Barriers].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (ownerFilter !== 'all' && r.Owner !== ownerFilter) return false;
      if (statusFilter !== 'all' && r.statusKey !== statusFilter) return false;
      if (categoryFilter !== 'all' && r.Category !== categoryFilter) return false;
      if (quickFilter === 'overdue' && !r.dateInfo.isOverdue) return false;
      if (quickFilter === 'due_soon' && !r.dateInfo.isDueSoon) return false;
      if (quickFilter === 'no_date' && r.dateInfo.hasDate) return false;
      if (quickFilter === 'no_status' && r.statusKey !== 'no_status') return false;
      return true;
    });
  }, [enriched, search, ownerFilter, statusFilter, categoryFilter, quickFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const total = enriched.length;
    const completed = enriched.filter(r => r.isComplete).length;
    const open = total - completed;
    const overdue = enriched.filter(r => !r.isComplete && r.dateInfo.isOverdue).length;
    const dueSoon = enriched.filter(r => !r.isComplete && r.dateInfo.isDueSoon).length;
    const noDate = enriched.filter(r => !r.isComplete && !r.dateInfo.hasDate).length;
    const noStatus = enriched.filter(r => r.statusKey === 'no_status').length;
    return { total, open, completed, overdue, dueSoon, noDate, noStatus };
  }, [enriched]);

  // Chart data
  const workloadChart = useMemo(() => {
    const counts = {};
    enriched.forEach(r => {
      if (!r.Owner) return;
      if (!counts[r.Owner]) counts[r.Owner] = { name: r.Owner, open: 0, complete: 0 };
      if (r.isComplete) counts[r.Owner].complete += 1;
      else counts[r.Owner].open += 1;
    });
    return Object.values(counts).sort((a, b) => (b.open + b.complete) - (a.open + a.complete));
  }, [enriched]);

  const closedItems = useMemo(() => enriched.filter(r => r.isComplete), [enriched]);

  // Loading state
  if (loading) {
    return (
      <div style={{
        background: T.bg, color: T.textMute, minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
        fontFamily: '"Outfit", sans-serif',
      }}>
        <RefreshCw size={28} color={T.bronze} style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Loading Priority Tasks…
        </div>
      </div>
    );
  }

  // Hard error state (initial load failed)
  if (loadError && !rows.length) {
    return (
      <div style={{
        background: T.bg, color: T.text, minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        fontFamily: '"Outfit", sans-serif',
      }}>
        <div style={{
          background: T.surface, border: `1px solid ${T.red}40`, borderRadius: 10,
          padding: 28, maxWidth: 520,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.red, marginBottom: 12 }}>
            <AlertCircle size={18} />
            <span style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>
              Failed to load
            </span>
          </div>
          <div style={{ fontSize: 14, color: T.text, marginBottom: 16, lineHeight: 1.5 }}>
            Couldn't reach the Smartsheet API. Check that <span className="mono">SMARTSHEET_TOKEN</span> is set
            in your Vercel environment variables and that the token has access to sheet{' '}
            <span className="mono">{process.env.NEXT_PUBLIC_DISPLAY_NAME ? '(configured)' : '8870685098069892'}</span>.
          </div>
          <div className="mono" style={{ fontSize: 11, color: T.textDim, background: T.bg, padding: 10, borderRadius: 6, marginBottom: 16, wordBreak: 'break-all' }}>
            {loadError}
          </div>
          <button onClick={fetchSheet} style={{
            padding: '9px 18px', borderRadius: 7, background: T.bronze, color: T.bg,
            border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: T.bg, color: T.text, minHeight: '100vh', fontFamily: '"Outfit", -apple-system, system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        .display { font-family: 'Fraunces', Georgia, serif; font-feature-settings: 'ss01'; letter-spacing: -0.01em; }
        .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .scrollbar::-webkit-scrollbar-track { background: transparent; }
        .scrollbar::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; }
        .scrollbar::-webkit-scrollbar-thumb:hover { background: ${T.borderHi}; }
        .row-hover { transition: background 0.15s ease, transform 0.15s ease; }
        .row-hover:hover { background: ${T.surfaceElev}; }
        .pulse { animation: pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .slide-in { animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>

      {/* HEADER */}
      <header style={{
        borderBottom: `1px solid ${T.border}`,
        background: T.bg,
        position: 'sticky',
        top: 0,
        zIndex: 30,
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 8,
              background: `linear-gradient(135deg, ${T.bronze} 0%, ${T.bronzeDim} 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 0 1px ${T.border}, 0 8px 24px -8px ${T.bronze}40`,
            }}>
              <Layers size={20} color={T.bg} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.bronze, fontWeight: 500 }}>
                MedStar Facilities · Command Console
              </div>
              <div className="display" style={{ fontSize: 22, fontWeight: 500, color: T.text, marginTop: 2 }}>
                {SHEET_NAME}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              padding: '8px 14px', borderRadius: 999,
              background: T.surface, border: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 12, color: T.textMute,
            }}>
              <span className="pulse" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: T.sage }} />
              <span>Live</span>
              <span style={{ color: T.textDim }}>·</span>
              <span className="mono">{relativeTime(pulledAt) /* tick=${tick} */}</span>
            </div>

            {canCreate(user) && (
              <button
                onClick={() => setShowAddModal(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '9px 16px', borderRadius: 8,
                  background: T.bronze, color: T.bg,
                  border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  boxShadow: `0 4px 16px -4px ${T.bronze}80`,
                  transition: 'transform 0.1s ease, box-shadow 0.15s ease',
                }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <Plus size={15} strokeWidth={2.5} />
                New Task
              </button>
            )}

            {/* USER BADGE + LOGOUT */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 6px 6px 12px', borderRadius: 999,
              background: T.surface, border: `1px solid ${T.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 12,
                  background: T.surfaceHi, color: T.bronze,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 600,
                  border: `1px solid ${T.border}`,
                }}>
                  {shortName(user.name)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 12, color: T.text, fontWeight: 500, lineHeight: 1.2 }}>{user.name}</span>
                  <span style={{ fontSize: 9, color: T.bronze, letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1.2 }}>{user.role}</span>
                </div>
              </div>
              <button
                onClick={() => setShowReminders(true)}
                title="Reminder settings"
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: T.textMute, padding: 6, borderRadius: 999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => e.currentTarget.style.color = T.bronze}
                onMouseLeave={e => e.currentTarget.style.color = T.textMute}
              >
                <Bell size={14} />
              </button>
              <button
                onClick={handleLogout}
                title="Sign out"
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: T.textMute, padding: 6, borderRadius: 999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => e.currentTarget.style.color = T.red}
                onMouseLeave={e => e.currentTarget.style.color = T.textMute}
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '28px' }}>

        {/* KPI STRIP */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 32 }}>
          <KPI label="Total Tasks" value={kpis.total} accent={T.text} />
          <KPI label="Open" value={kpis.open} accent={T.bronze} onClick={() => setStatusFilter('all') || setQuickFilter(null)} />
          <KPI label="Completed" value={kpis.completed} accent={T.sage} onClick={() => setStatusFilter('completed') || setQuickFilter(null)} />
          <KPI label="Overdue" value={kpis.overdue} accent={kpis.overdue > 0 ? T.red : T.textDim} alert={kpis.overdue > 0}
               onClick={() => { setQuickFilter('overdue'); setStatusFilter('all'); }} />
          <KPI label="Due Soon" value={kpis.dueSoon} accent={T.amber}
               onClick={() => { setQuickFilter('due_soon'); setStatusFilter('all'); }} />
          <KPI label="No Due Date" value={kpis.noDate} accent={T.textMute} hint="Data gap"
               onClick={() => { setQuickFilter('no_date'); setStatusFilter('all'); }} />
        </section>

        {/* CHARTS ROW */}
        <section style={{ marginBottom: 32 }}>
          <Panel title="Workload by Owner" icon={<Users size={14} />}>
            <div style={{ height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={workloadChart} layout="vertical" margin={{ left: 0, right: 24, top: 4, bottom: 4 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={140}
                         tick={{ fill: T.textMute, fontSize: 12, fontFamily: 'Outfit' }}
                         axisLine={{ stroke: T.border }} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: T.surfaceElev }}
                    contentStyle={{ background: T.surfaceElev, border: `1px solid ${T.borderHi}`, borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: T.text }}
                    itemStyle={{ color: T.text }}
                  />
                  <Bar dataKey="open" stackId="a" fill={T.bronze} radius={[0, 0, 0, 0]} name="Open" />
                  <Bar dataKey="complete" stackId="a" fill={T.sage} radius={[0, 4, 4, 0]} name="Complete" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </section>

        {/* FILTER BAR */}
        <section style={{
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
          padding: 14, marginBottom: 16,
          display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) repeat(3, minmax(140px, 1fr))', gap: 10
        }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.textMute }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks, notes, owners…"
              style={{
                width: '100%', padding: '10px 12px 10px 36px',
                background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6,
                color: T.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', cursor: 'pointer', color: T.textMute, padding: 4,
              }}><X size={14} /></button>
            )}
          </div>
          <SelectInput value={ownerFilter} onChange={setOwnerFilter} options={[['all', 'All Owners'], ...owners.map(o => [o, o])]} />
          <SelectInput value={statusFilter} onChange={setStatusFilter} options={[['all', 'All Statuses'], ...statuses.map(s => [s, STATUS_THEME[s]?.label || s])]} />
          <SelectInput value={categoryFilter} onChange={setCategoryFilter} options={[['all', 'All Categories'], ...categories.map(c => [c, c])]} />
        </section>

        {/* QUICK CHIPS */}
        <section style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: T.textDim, letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: 4 }}>Quick</span>
          <Chip active={quickFilter === 'overdue'} onClick={() => setQuickFilter(quickFilter === 'overdue' ? null : 'overdue')} color={T.red}>
            Overdue ({kpis.overdue})
          </Chip>
          <Chip active={quickFilter === 'due_soon'} onClick={() => setQuickFilter(quickFilter === 'due_soon' ? null : 'due_soon')} color={T.amber}>
            Due Soon ({kpis.dueSoon})
          </Chip>
          <Chip active={quickFilter === 'no_date'} onClick={() => setQuickFilter(quickFilter === 'no_date' ? null : 'no_date')} color={T.textMute}>
            Missing Due Date ({kpis.noDate})
          </Chip>
          <Chip active={quickFilter === 'no_status'} onClick={() => setQuickFilter(quickFilter === 'no_status' ? null : 'no_status')} color={T.textMute}>
            No Status ({kpis.noStatus})
          </Chip>
          {(quickFilter || ownerFilter !== 'all' || statusFilter !== 'all' || categoryFilter !== 'all' || search) && (
            <button onClick={() => { setQuickFilter(null); setOwnerFilter('all'); setStatusFilter('all'); setCategoryFilter('all'); setSearch(''); }}
                    style={{ marginLeft: 'auto', padding: '6px 12px', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 999, color: T.textMute, fontSize: 12, cursor: 'pointer' }}>
              Reset filters
            </button>
          )}
        </section>

        {/* TASK LIST */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.textMute, fontWeight: 500, margin: 0 }}>
              Tasks
            </h2>
            <span className="mono" style={{ fontSize: 11, color: T.textDim }}>
              {filtered.length} of {enriched.length} rows
            </span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: T.textMute, border: `1px dashed ${T.border}`, borderRadius: 10 }}>
              No tasks match your filters.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map(r => <TaskRow key={r.row_id} row={r} onClick={() => setSelectedId(r.row_id)} />)}
            </div>
          )}
        </section>

        {/* CLOSED SUMMARY */}
        <section style={{ marginBottom: 48 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <CheckCircle2 size={14} color={T.sage} />
            <h2 style={{ fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.textMute, fontWeight: 500, margin: 0 }}>
              Closed Summary
            </h2>
            <span className="mono" style={{ fontSize: 11, color: T.textDim }}>
              {closedItems.length} completed
            </span>
          </div>

          {closedItems.length === 0 ? (
            <div style={{ padding: 24, color: T.textMute, border: `1px dashed ${T.border}`, borderRadius: 10, fontSize: 13 }}>
              No completed items yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {closedItems.map(r => (
                <div key={r.row_id} style={{
                  background: T.surface, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.sage}`,
                  borderRadius: 8, padding: 16, cursor: 'pointer',
                }} onClick={() => setSelectedId(r.row_id)} className="row-hover">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: T.text, marginBottom: 6, fontWeight: 500 }}>{r.Tasks}</div>
                      {r.Notes && <div style={{ fontSize: 12, color: T.textMute, lineHeight: 1.5 }}>{r.Notes}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: T.textDim }}>Closed</div>
                      <div className="mono" style={{ fontSize: 12, color: T.text, marginTop: 2 }}>
                        {r.dateInfo.hasDate ? r.dateInfo.pretty : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: T.textMute, marginTop: 4 }}>{r.Owner}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>

      {/* DRILL-DOWN PANEL */}
      {selected && (
        <DetailPanel
          row={selected}
          user={user}
          owners={owners}
          categories={categories}
          existingStatuses={[...new Set(rows.map(r => r.Status).filter(Boolean))]}
          comments={comments[selected.row_id] || []}
          attachments={attachments[selected.row_id] || []}
          busy={busy}
          onClose={() => setSelectedId(null)}
          onCloseTask={() => handleClose(selected.row_id)}
          onReopenTask={() => handleReopen(selected.row_id)}
          onUpdate={(fields) => handleUpdate(selected.row_id, fields)}
        />
      )}

      {/* ADD TASK MODAL */}
      {showAddModal && (
        <AddTaskModal
          owners={owners}
          categories={categories}
          existingStatuses={[...new Set(rows.map(r => r.Status).filter(Boolean))]}
          busy={busy}
          onCancel={() => setShowAddModal(false)}
          onCreate={handleCreate}
        />
      )}

      {/* REMINDER SETTINGS */}
      {showReminders && (
        <ReminderSettings
          userName={user.name}
          onClose={() => setShowReminders(false)}
        />
      )}

      {/* TOASTS */}
      <ToastStack toasts={toasts} />
    </div>
  );
}

// ============================================================
// COMPONENTS
// ============================================================

function KPI({ label, value, accent, alert, hint, onClick }) {
  return (
    <button onClick={onClick} disabled={!onClick} style={{
      textAlign: 'left',
      background: T.surface,
      border: `1px solid ${alert ? T.red + '60' : T.border}`,
      borderRadius: 10, padding: '16px 18px',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'border-color 0.15s ease, transform 0.15s ease',
      fontFamily: 'inherit', color: 'inherit', width: '100%',
    }}
    onMouseEnter={e => onClick && (e.currentTarget.style.borderColor = T.borderHi)}
    onMouseLeave={e => onClick && (e.currentTarget.style.borderColor = alert ? T.red + '60' : T.border)}>
      <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.textMute, fontWeight: 500 }}>
        {label}
      </div>
      <div className="display" style={{ fontSize: 38, fontWeight: 400, color: accent, lineHeight: 1.1, marginTop: 6 }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{hint}</div>}
    </button>
  );
}

function Panel({ title, icon, children }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.textMute, marginBottom: 14 }}>
        {icon}
        <span style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 500 }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function SelectInput({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      width: '100%', padding: '10px 12px',
      background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6,
      color: T.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
      cursor: 'pointer',
    }}>
      {options.map(([v, label]) => <option key={v} value={v} style={{ background: T.surface }}>{label}</option>)}
    </select>
  );
}

function Chip({ active, onClick, color, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 999,
      background: active ? color + '20' : T.surface,
      border: `1px solid ${active ? color : T.border}`,
      color: active ? color : T.textMute,
      fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
      transition: 'all 0.15s ease',
    }}>
      {children}
    </button>
  );
}

function StatusPill({ statusKey }) {
  const t = STATUS_THEME[statusKey] || STATUS_THEME.other;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 9px', borderRadius: 999,
      background: t.color + '15', color: t.color,
      fontSize: 11, fontWeight: 500,
      border: `1px solid ${t.color}30`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: t.color }} />
      {t.label}
    </span>
  );
}

function OwnerBadge({ name }) {
  if (!name) return <span style={{ fontSize: 11, color: T.textDim, fontStyle: 'italic' }}>unassigned</span>;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 22, height: 22, borderRadius: 11,
        background: T.surfaceHi, color: T.bronze,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 600,
        border: `1px solid ${T.border}`,
      }}>
        {shortName(name)}
      </div>
      <span style={{ fontSize: 12, color: T.text }}>{name}</span>
    </div>
  );
}

function TaskRow({ row, onClick }) {
  const di = row.dateInfo;
  let dateNode = null;
  if (di.hasDate) {
    const color = row.isComplete ? T.textMute : di.isOverdue ? T.red : di.isDueSoon ? T.amber : T.textMute;
    const lab = di.isOverdue ? `${Math.abs(di.days)}d overdue` : di.days === 0 ? 'Today' : di.days <= 7 ? `${di.days}d` : di.pretty;
    dateNode = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color, fontSize: 11 }}>
        <Calendar size={11} />
        <span className="mono">{lab}</span>
      </div>
    );
  }

  return (
    <div onClick={onClick} className="row-hover fade-in" style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 8, padding: '14px 16px', cursor: 'pointer',
      display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: 16, alignItems: 'center',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, color: T.text, fontWeight: 500, marginBottom: 4, lineHeight: 1.4 }}>
          {row.Tasks}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {row.Category && (
            <span style={{ fontSize: 11, color: T.textMute, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Tag size={10} /> {row.Category}
            </span>
          )}
          {row.commentCount > 0 && (
            <span style={{ fontSize: 11, color: T.textMute, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <MessageSquare size={10} /> {row.commentCount}
            </span>
          )}
          {row.attachmentCount > 0 && (
            <span style={{ fontSize: 11, color: T.textMute, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Paperclip size={10} /> {row.attachmentCount}
            </span>
          )}
          {row.Barriers && (
            <span style={{ fontSize: 11, color: T.amber, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={10} /> barrier
            </span>
          )}
        </div>
      </div>
      <OwnerBadge name={row.Owner} />
      <StatusPill statusKey={row.statusKey} />
      <div style={{ minWidth: 90, textAlign: 'right' }}>{dateNode}</div>
      <ChevronRight size={16} color={T.textDim} />
    </div>
  );
}

function DetailPanel({
  row, user, owners = [], categories = [], existingStatuses = [],
  comments = [], attachments = [], busy,
  onClose, onCloseTask, onReopenTask, onUpdate
}) {
  const di = row.dateInfo;
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState(null);

  // Reset edit state when the selected row changes
  useEffect(() => {
    setEditMode(false);
    setEditForm(null);
    setEditError(null);
  }, [row.row_id]);

  const allowEdit = canEdit(user, row.Owner);
  const allowClose = canClose(user, row.Owner);
  const allowReopen = canReopen(user);

  const CANONICAL = ['To Develop', 'In Progress', 'Nearing Completion', 'Completed'];
  const statusSuggestions = useMemo(() => {
    const seen = new Set(CANONICAL.map(s => s.toLowerCase()));
    const extras = (existingStatuses || []).filter(s => s && !seen.has(s.toLowerCase()));
    return [...CANONICAL, ...extras];
  }, [existingStatuses]);

  const startEdit = () => {
    setEditForm({
      Tasks:     row.Tasks || '',
      Owner:     row.Owner || '',
      Category:  row.Category || '',
      Status:    row.Status || '',
      StartDate: row.StartDate || '',
      EndDate:   row.EndDate || '',
      Notes:     row.Notes || '',
      Barriers:  row.Barriers || '',
    });
    setEditError(null);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditForm(null);
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editForm.Tasks || !editForm.Tasks.trim()) {
      setEditError('Task name is required');
      return;
    }
    if (editForm.StartDate && editForm.EndDate && editForm.EndDate < editForm.StartDate) {
      setEditError('End Date cannot be earlier than Start Date');
      return;
    }
    const success = await onUpdate(editForm);
    if (success) cancelEdit();
  };

  const updateField = (k, v) => setEditForm(f => ({ ...f, [k]: v }));

  const inputStyle = {
    width: '100%', padding: '9px 12px',
    background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6,
    color: T.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
  };
  const labelStyle = {
    display: 'block', fontSize: 10, letterSpacing: '0.14em',
    textTransform: 'uppercase', color: T.textDim, marginBottom: 6, fontWeight: 500,
  };

  return (
    <>
      <div onClick={editMode ? undefined : onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        zIndex: 40, backdropFilter: 'blur(2px)',
      }} />
      <aside className="slide-in scrollbar" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(560px, 92vw)',
        background: T.surface, borderLeft: `1px solid ${T.border}`,
        zIndex: 41, overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '20px 28px', borderBottom: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
          position: 'sticky', top: 0, background: T.surface, zIndex: 1,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.bronze, marginBottom: 8 }}>
              {editMode ? 'Editing Task' : 'Task Detail'}
            </div>
            {editMode ? (
              <textarea
                value={editForm.Tasks}
                onChange={e => updateField('Tasks', e.target.value)}
                rows={2}
                style={{
                  ...inputStyle, fontSize: 17, fontWeight: 500,
                  lineHeight: 1.3, resize: 'vertical', fontFamily: 'Fraunces, Georgia, serif',
                }}
              />
            ) : (
              <h2 className="display" style={{ fontSize: 22, fontWeight: 500, color: T.text, lineHeight: 1.25, margin: 0 }}>
                {row.Tasks}
              </h2>
            )}
            <div className="mono" style={{ fontSize: 10, color: T.textDim, marginTop: 8 }}>
              Row ID: {row.row_id}
            </div>
          </div>
          <button onClick={onClose} disabled={editMode} style={{
            background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 6,
            color: T.textMute, padding: 8, cursor: editMode ? 'not-allowed' : 'pointer',
            opacity: editMode ? 0.4 : 1,
          }}><X size={16} /></button>
        </div>

        {/* ACTION BAR */}
        <div style={{
          padding: '14px 28px', borderBottom: `1px solid ${T.border}`,
          display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
          background: T.bg,
        }}>
          {editMode ? (
            <>
              <button
                onClick={saveEdit}
                disabled={busy}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '8px 14px', borderRadius: 7,
                  background: T.bronze, color: T.bg,
                  border: 'none', cursor: busy ? 'wait' : 'pointer',
                  fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                  boxShadow: `0 2px 8px -2px ${T.bronze}80`,
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <Check size={13} strokeWidth={3} /> {busy ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                onClick={cancelEdit}
                disabled={busy}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '8px 14px', borderRadius: 7,
                  background: 'transparent', color: T.textMute,
                  border: `1px solid ${T.border}`, cursor: busy ? 'wait' : 'pointer',
                  fontSize: 12, fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {row.isComplete ? (
                allowReopen && (
                  <button
                    onClick={onReopenTask}
                    disabled={busy}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      padding: '8px 14px', borderRadius: 7,
                      background: 'transparent', color: T.amber,
                      border: `1px solid ${T.amber}50`, cursor: busy ? 'wait' : 'pointer',
                      fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    <RotateCcw size={13} /> Reopen Task
                  </button>
                )
              ) : (
                allowClose && (
                  <button
                    onClick={onCloseTask}
                    disabled={busy}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      padding: '8px 14px', borderRadius: 7,
                      background: T.sage, color: T.bg,
                      border: 'none', cursor: busy ? 'wait' : 'pointer',
                      fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                      boxShadow: `0 2px 8px -2px ${T.sage}80`,
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    <Check size={13} strokeWidth={3} /> Mark Complete
                  </button>
                )
              )}
              {allowEdit && (
                <button
                  onClick={startEdit}
                  disabled={busy}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '8px 14px', borderRadius: 7,
                    background: 'transparent', color: T.text,
                    border: `1px solid ${T.border}`, cursor: busy ? 'wait' : 'pointer',
                    fontSize: 12, fontFamily: 'inherit',
                  }}
                >
                  <Edit2 size={13} /> Edit
                </button>
              )}
            </>
          )}
          <div style={{ fontSize: 10, color: T.textDim, marginLeft: 'auto' }}>
            Acting as <span style={{ color: T.bronze }}>{user?.name}</span>
          </div>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {editMode ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Owner</label>
                  <input list="dp-owners" value={editForm.Owner} onChange={e => updateField('Owner', e.target.value)} style={inputStyle} />
                  <datalist id="dp-owners">{owners.map(o => <option key={o} value={o} />)}</datalist>
                </div>
                <div>
                  <label style={labelStyle}>Category</label>
                  <input list="dp-cats" value={editForm.Category} onChange={e => updateField('Category', e.target.value)} style={inputStyle} />
                  <datalist id="dp-cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <input list="dp-statuses" value={editForm.Status} onChange={e => updateField('Status', e.target.value)} style={inputStyle} />
                <datalist id="dp-statuses">{statusSuggestions.map(s => <option key={s} value={s} />)}</datalist>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Start Date</label>
                  <input type="date" value={editForm.StartDate} onChange={e => updateField('StartDate', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>End Date</label>
                  <input type="date" value={editForm.EndDate} onChange={e => updateField('EndDate', e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={editForm.Notes} onChange={e => updateField('Notes', e.target.value)} rows={6}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div>
                <label style={labelStyle}>Barriers</label>
                <input type="text" value={editForm.Barriers} onChange={e => updateField('Barriers', e.target.value)} style={inputStyle} />
              </div>
              {editError && (
                <div style={{
                  padding: '10px 12px', borderRadius: 6,
                  background: T.red + '15', border: `1px solid ${T.red}40`,
                  color: T.red, fontSize: 12,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <AlertCircle size={14} /> {editError}
                </div>
              )}
            </>
          ) : (
            <>
              <FieldGrid>
                <Field label="Status"><StatusPill statusKey={row.statusKey} /></Field>
                <Field label="Owner"><OwnerBadge name={row.Owner} /></Field>
                <Field label="Category">
                  <span style={{ fontSize: 13, color: T.text }}>{row.Category || <em style={{ color: T.textDim }}>—</em>}</span>
                </Field>
                <Field label="End Date">
                  {di.hasDate ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span className="mono" style={{ color: T.text }}>{di.pretty}</span>
                      {!row.isComplete && (
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 999,
                          background: (di.isOverdue ? T.red : di.isDueSoon ? T.amber : T.textMute) + '20',
                          color: di.isOverdue ? T.red : di.isDueSoon ? T.amber : T.textMute,
                        }}>
                          {di.isOverdue ? `${Math.abs(di.days)}d overdue` : di.days === 0 ? 'today' : `in ${di.days}d`}
                        </span>
                      )}
                    </span>
                  ) : <em style={{ color: T.textDim, fontSize: 13 }}>not set</em>}
                </Field>
                {row.StartDate && (
                  <Field label="Start Date">
                    <span className="mono" style={{ fontSize: 13, color: T.text }}>
                      {new Date(row.StartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </Field>
                )}
                <Field label="Raw Status">
                  <span className="mono" style={{ fontSize: 11, color: T.textMute }}>
                    {row.Status || <em>null</em>}
                  </span>
                </Field>
              </FieldGrid>

              {row.Notes && (
                <Section label="Notes" icon={<FileText size={12} />}>
                  <div style={{ fontSize: 13, color: T.text, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                    {row.Notes}
                  </div>
                </Section>
              )}

              {row.Barriers && (
                <Section label="Barriers" icon={<AlertTriangle size={12} color={T.amber} />} accent={T.amber}>
                  <div style={{ fontSize: 13, color: T.text, lineHeight: 1.65 }}>{row.Barriers}</div>
                </Section>
              )}

              {comments.length > 0 && (
                <Section label={`Comments (${comments.length})`} icon={<MessageSquare size={12} />}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {comments.map((c, i) => (
                      <div key={i} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, color: T.bronze, fontWeight: 500 }}>{c.by}</span>
                          <span className="mono" style={{ fontSize: 10, color: T.textDim }}>
                            {new Date(c.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>{c.text}</div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {attachments.length > 0 && (
                <Section label={`Attachments (${attachments.length})`} icon={<Paperclip size={12} />}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {attachments.map((a, i) => (
                      <div key={i} style={{
                        background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12,
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 6,
                          background: T.surfaceHi, border: `1px solid ${T.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <FileText size={16} color={T.bronze} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: T.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.name}
                          </div>
                          <div style={{ fontSize: 11, color: T.textMute, marginTop: 2 }}>
                            {a.by} · {a.at} · {a.sizeKb >= 1024 ? (a.sizeKb / 1024).toFixed(1) + ' MB' : a.sizeKb + ' KB'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
                <a href={`https://app.smartsheet.com/sheets/GXPQvPXCG48JwxhQhx35gqWwJC7f43rWwrC3g2Q1`}
                   target="_blank" rel="noreferrer"
                   style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T.bronze, fontSize: 12, textDecoration: 'none' }}>
                  Open in Smartsheet <ArrowUpRight size={12} />
                </a>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.textDim, marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function FieldGrid({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>{children}</div>;
}

function Section({ label, icon, accent, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: accent || T.textMute }}>
        {icon}
        <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500 }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

// ============================================================
// ADD TASK MODAL — preview-mode form. Production app submits
// to /api/tasks which writes the row to Smartsheet.
// ============================================================
function AddTaskModal({ owners, categories, existingStatuses, onCancel, onCreate }) {
  const [form, setForm] = useState({
    Tasks: '',
    Owner: '',
    Category: '',
    Status: 'In Progress',
    StartDate: '',
    EndDate: '',
    Notes: '',
    Barriers: '',
  });
  const [error, setError] = useState(null);

  // Status suggestions: canonical values + any non-canonical ones the sheet
  // has already seen. Deduped, canonical first.
  const CANONICAL_STATUSES = ['To Develop', 'In Progress', 'Nearing Completion', 'Completed'];
  const statusSuggestions = useMemo(() => {
    const seen = new Set(CANONICAL_STATUSES.map(s => s.toLowerCase()));
    const extras = (existingStatuses || []).filter(s => s && !seen.has(s.toLowerCase()));
    return [...CANONICAL_STATUSES, ...extras];
  }, [existingStatuses]);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.Tasks.trim()) {
      setError('Task name is required');
      return;
    }
    if (form.StartDate && form.EndDate && form.EndDate < form.StartDate) {
      setError('End Date cannot be earlier than Start Date');
      return;
    }
    const payload = { ...form };
    // strip empty strings so the row stays clean
    Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null; });
    onCreate(payload);
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px',
    background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6,
    color: T.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
  };
  const labelStyle = {
    display: 'block', fontSize: 10, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: T.textMute, marginBottom: 6, fontWeight: 500,
  };

  return (
    <>
      <div onClick={onCancel} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        zIndex: 50, backdropFilter: 'blur(3px)',
      }} />
      <div className="fade-in scrollbar" style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(580px, 94vw)', maxHeight: '90vh', overflowY: 'auto',
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
              New Task
            </div>
            <h2 className="display" style={{ fontSize: 20, fontWeight: 500, color: T.text, margin: 0 }}>
              Add to Priority Tasks
            </h2>
          </div>
          <button onClick={onCancel} style={{
            background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 6,
            color: T.textMute, padding: 8, cursor: 'pointer',
          }}><X size={16} /></button>
        </div>

        <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Task <span style={{ color: T.red }}>*</span></label>
            <input
              autoFocus
              type="text"
              value={form.Tasks}
              onChange={e => update('Tasks', e.target.value)}
              placeholder="e.g. MGUH AHU-6 chilled water valve replacement"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Owner</label>
              <input
                list="owners-list"
                type="text"
                value={form.Owner}
                onChange={e => update('Owner', e.target.value)}
                placeholder="Name"
                style={inputStyle}
              />
              <datalist id="owners-list">
                {owners.map(o => <option key={o} value={o} />)}
              </datalist>
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <input
                list="categories-list"
                type="text"
                value={form.Category}
                onChange={e => update('Category', e.target.value)}
                placeholder="e.g. MWHC - Priority Items"
                style={inputStyle}
              />
              <datalist id="categories-list">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Status</label>
            <input
              list="statuses-list"
              type="text"
              value={form.Status}
              onChange={e => update('Status', e.target.value)}
              placeholder="e.g. In Progress"
              style={inputStyle}
            />
            <datalist id="statuses-list">
              {statusSuggestions.map(s => <option key={s} value={s} />)}
            </datalist>
            <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>
              Suggestions from existing entries. Free text allowed.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input type="date" value={form.StartDate} onChange={e => update('StartDate', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>End Date</label>
              <input type="date" value={form.EndDate} onChange={e => update('EndDate', e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              value={form.Notes}
              onChange={e => update('Notes', e.target.value)}
              placeholder="Context, next steps, blockers..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Barriers</label>
            <input
              type="text"
              value={form.Barriers}
              onChange={e => update('Barriers', e.target.value)}
              placeholder="Blocker description (optional)"
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 12px', borderRadius: 6,
              background: T.red + '15', border: `1px solid ${T.red}40`,
              color: T.red, fontSize: 12,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>

        <div style={{
          padding: '16px 28px', borderTop: `1px solid ${T.border}`,
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          background: T.bg,
        }}>
          <button onClick={onCancel} style={{
            padding: '9px 16px', borderRadius: 7,
            background: 'transparent', color: T.textMute,
            border: `1px solid ${T.border}`, cursor: 'pointer',
            fontSize: 13, fontFamily: 'inherit',
          }}>Cancel</button>
          <button onClick={handleSubmit} style={{
            padding: '9px 18px', borderRadius: 7,
            background: T.bronze, color: T.bg,
            border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            boxShadow: `0 2px 8px -2px ${T.bronze}80`,
          }}>Create Task</button>
        </div>
      </div>
    </>
  );
}

// ============================================================
// TOAST STACK — bottom-right notifications
// ============================================================
function ToastStack({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      display: 'flex', flexDirection: 'column', gap: 10,
      zIndex: 100,
    }}>
      {toasts.map(t => (
        <div key={t.id} className="fade-in" style={{
          padding: '12px 16px', borderRadius: 8,
          background: T.surfaceElev,
          border: `1px solid ${t.type === 'error' ? T.red : T.sage}50`,
          borderLeft: `3px solid ${t.type === 'error' ? T.red : T.sage}`,
          color: T.text, fontSize: 13,
          minWidth: 240, maxWidth: 360,
          boxShadow: '0 12px 32px -12px rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {t.type === 'error'
            ? <AlertCircle size={15} color={T.red} />
            : <CheckCircle2 size={15} color={T.sage} />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
