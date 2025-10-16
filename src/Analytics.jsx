// src/Analytics.jsx — FULL REPLACEMENT (Clear button wipes BOTH /analytics and ALL /reports/*/submissions)
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { db } from './firebaseConfig';
import {
  collection,
  collectionGroup,
  getDocs,
  onSnapshot,
  writeBatch,
  doc,
} from 'firebase/firestore';
import { RefreshCw, User, Smartphone, ShieldOff, Lock } from 'lucide-react';

// -------- Utils --------
const fmt = (n) => (typeof n === 'number' ? n : 0);
const CLEAR_PASSWORD = '112189';

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (iso, days) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export default function Analytics() {
  // DATA
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // CONTROLS (existing)
  const [gradeFilter, setGradeFilter] = useState('all'); // 'all' | 9 | 10
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('missedCount'); // 'missedCount' | 'lateCount'
  const [limit, setLimit] = useState(50);

  // NEW: lifetime vs date-range (default = lifetime)
  const [mode, setMode] = useState('lifetime'); // 'lifetime' | 'range'
  const [startDate, setStartDate] = useState(addDaysISO(todayISO(), -30));
  const [endDate, setEndDate] = useState(todayISO());

  // Clear-all state
  const [showClearPrompt, setShowClearPrompt] = useState(false);
  const [clearPwd, setClearPwd] = useState('');
  const [clearing, setClearing] = useState(false);

  // toast
  const [msg, setMsg] = useState('');
  const msgTimer = useRef(null);
  const showMsg = (text, ms = 2500) => {
    clearTimeout(msgTimer.current);
    setMsg(text);
    msgTimer.current = setTimeout(() => setMsg(''), ms);
  };

  // === Lifetime: live listener on /analytics (unchanged behavior) ===
  useEffect(() => {
    if (mode !== 'lifetime') return;
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, 'analytics'),
      (snap) => {
        const data = snap.docs.map((d) => {
          const v = d.data() || {};
          return {
            id: d.id,
            fullName: v.fullName || '(Unassigned slot)',
            slotId: v.slotId || '',
            grade: v.grade ?? '—',
            missedCount: fmt(v.missedCount),
            lateCount: fmt(v.lateCount),
          };
        });
        setRows(data);
        setLoading(false);
      },
      (err) => {
        console.error('analytics listener error', err);
        setLoading(false);
        showMsg('Failed to load analytics (live).');
      }
    );
    return () => {
      unsub && unsub();
    };
  }, [mode]);

  // === Date range: aggregate from /reports/<date>/submissions ===
  const fetchRange = async () => {
    if (mode !== 'range') return;
    if (!startDate || !endDate) return;
    if (startDate > endDate) {
      showMsg('Start date must be ≤ End date.');
      return;
    }

    setLoading(true);
    try {
      // Build list of date strings between start and end (inclusive)
      const dates = [];
      let d = new Date(startDate);
      const end = new Date(endDate);
      while (d <= end) {
        dates.push(d.toISOString().slice(0, 10));
        d.setDate(d.getDate() + 1);
      }

      const map = new Map();

      // Helper to increment missed/late counts per student or slot
      const touch = (rec, isLate) => {
        const key = rec?.studentId ? String(rec.studentId) : `slot:${rec?.slotId || ''}`;
        if (!map.has(key)) {
          map.set(key, {
            id: key,
            studentId: rec?.studentId ?? null,
            fullName: rec?.fullName || '(Unassigned slot)',
            slotId: rec?.slotId || '',
            grade: rec?.grade ?? '—',
            missedCount: 0,
            lateCount: 0,
          });
        }
        const cur = map.get(key);
        if (isLate) cur.lateCount += 1;
        else cur.missedCount += 1;
      };

      // Fetch and aggregate each date’s submissions
      for (const date of dates) {
        const dayCol = collection(db, 'reports', date, 'submissions');
        const snap = await getDocs(dayCol);
        snap.docs.forEach((docSnap) => {
          const sub = docSnap.data() || {};
          (sub.absent || []).forEach((r) => touch(r, false));
          (sub.late || []).forEach((r) => touch(r, true));
        });
      }

      setRows(Array.from(map.values()));
    } catch (e) {
      console.error('range fetch error', e);
      showMsg('Failed to load date range.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch when switching into range or changing dates
  useEffect(() => {
    if (mode === 'range') fetchRange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, startDate, endDate]);

  // Manual refresh button
  const refresh = () => {
    if (mode === 'lifetime') {
      showMsg('Live updating is on (refresh not needed).', 1500);
    } else {
      fetchRange();
    }
  };

  // Filter/sort/limit (client-side; unchanged)
  const filtered = useMemo(() => {
    let out = rows.slice();

    if (gradeFilter !== 'all') {
      out = out.filter((r) => String(r.grade) === String(gradeFilter));
    }

    const s = search.trim().toLowerCase();
    if (s) {
      out = out.filter((r) => {
        const name = (r.fullName || '').toLowerCase();
        const slot = (r.slotId || '').toLowerCase();
        return name.includes(s) || slot.includes(s);
      });
    }

    out.sort((a, b) => fmt(b[sortKey]) - fmt(a[sortKey]));
    out = out.slice(0, Number(limit));
    return out;
  }, [rows, gradeFilter, search, sortKey, limit]);

  // Clear ALL data: delete docs in /analytics AND every /reports/<date>/submissions/*
  const clearAllDataEverywhere = async () => {
    if (clearPwd !== CLEAR_PASSWORD) {
      showMsg('Incorrect password.');
      return;
    }
    setClearing(true);
    try {
      // 1) Delete all docs under /analytics
      const analyticsSnap = await getDocs(collection(db, 'analytics'));
      const analyticsIds = analyticsSnap.docs.map((d) => d.id);
      const CHUNK = 400;
      for (let i = 0; i < analyticsIds.length; i += CHUNK) {
        const batch = writeBatch(db);
        analyticsIds.slice(i, i + CHUNK).forEach((id) => batch.delete(doc(db, 'analytics', id)));
        await batch.commit();
      }

      // 2) Delete ALL submissions in every /reports/<date>/submissions via collectionGroup (parents may not exist)
      const subsGroupSnap = await getDocs(collectionGroup(db, 'submissions'));
      const allSubmissionRefs = subsGroupSnap.docs.map((d) => d.ref);
      for (let i = 0; i < allSubmissionRefs.length; i += CHUNK) {
        const batch = writeBatch(db);
        allSubmissionRefs.slice(i, i + CHUNK).forEach((ref) => batch.delete(ref));
        await batch.commit();
      }

      showMsg('All analytics and reports cleared.');
      setShowClearPrompt(false);
      setClearPwd('');

      // After wiping, clear current rows so UI reflects empty state immediately
      setRows([]);
    } catch (e) {
      console.error('clear all data error', e);
      showMsg('Failed to clear all data.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-slate-900">Top Offenders</h2>

        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-900"
            title="Refresh"
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          {/* Password-protected "Clear All" — now wipes BOTH analytics AND reports */}
          {!showClearPrompt ? (
            <button
              onClick={() => setShowClearPrompt(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              title="Clear ALL data: analytics + reports"
            >
              <ShieldOff size={16} />
              Clear All Data
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Lock size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  className="pl-7 pr-2 py-2 border border-slate-300 rounded-lg w-40"
                  value={clearPwd}
                  onChange={(e) => setClearPwd(e.target.value)}
                  placeholder="Enter password"
                  onKeyDown={(e) => e.key === 'Enter' && !clearing && clearAllDataEverywhere()}
                />
              </div>
              <button
                onClick={clearAllDataEverywhere}
                disabled={clearing}
                className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {clearing ? 'Clearing…' : 'Confirm'}
              </button>
              <button
                onClick={() => { setShowClearPrompt(false); setClearPwd(''); }}
                disabled={clearing}
                className="px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Controls row (Mode + Dates + existing controls) */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-6 gap-3">
        <div>
          <label className="block text-sm text-slate-600 mb-1">Mode</label>
          <select
            className="w-full border border-slate-300 rounded-lg px-2 py-2"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="lifetime">Lifetime (live)</option>
            <option value="range">Date range (reports)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1">Start date</label>
          <input
            type="date"
            className="w-full border border-slate-300 rounded-lg px-2 py-2"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={mode !== 'range'}
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">End date</label>
          <input
            type="date"
            className="w-full border border-slate-300 rounded-lg px-2 py-2"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={mode !== 'range'}
          />
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1">Sort by</label>
          <select
            className="w-full border border-slate-300 rounded-lg px-2 py-2"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
          >
            <option value="missedCount">Most Missed</option>
            <option value="lateCount">Most Late</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1">Grade</label>
          <select
            className="w-full border border-slate-300 rounded-lg px-2 py-2"
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="9">9</option>
            <option value="10">10</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1">Search</label>
          <input
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
            placeholder="Name or slot (e.g., A34)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table (unchanged) */}
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">#</th>
              <th className="py-2 pr-4">Student</th>
              <th className="py-2 pr-4">Slot</th>
              <th className="py-2 pr-4">Grade</th>
              <th className="py-2 pr-4 text-right">Missed</th>
              <th className="py-2 pr-4 text-right">Late</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-6 text-center text-slate-500">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="py-6 text-center text-slate-500">No data.</td></tr>
            ) : (
              filtered.map((r, i) => (
                <tr key={r.id} className="border-b hover:bg-slate-50">
                  <td className="py-2 pr-4">{i + 1}</td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-blue-500" />
                      <span className="font-medium">{r.fullName || '(Unassigned slot)'}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <Smartphone size={14} className="text-slate-500" />
                      <span className="font-mono">{r.slotId || '—'}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-4">{r.grade ?? '—'}</td>
                  <td className="py-2 pr-4 text-right">{fmt(r.missedCount)}</td>
                  <td className="py-2 pr-4 text-right">{fmt(r.lateCount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {msg && (
        <div className="mt-3 p-2 text-center text-sm rounded-lg bg-slate-100 text-slate-700">
          {msg}
        </div>
      )}

      <p className="mt-3 text-xs text-slate-500">
        Lifetime mode reads live from <code>/analytics</code>. Date range mode aggregates from{' '}
        <code>/reports/&lt;date&gt;/submissions</code>. The Clear button now wipes <strong>both</strong> datasets.
      </p>
    </div>
  );
}
