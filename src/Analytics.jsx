// src/Analytics.jsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { db } from './firebaseConfig';
import {
  collection,
  getDocs,
  onSnapshot,
  writeBatch,
  doc,
} from 'firebase/firestore';
import { RefreshCw, User, Smartphone, ShieldOff, Lock } from 'lucide-react';

const fmt = (n) => (typeof n === 'number' ? n : 0);

// Password for clearing analytics (per your request)
const CLEAR_PASSWORD = '112189';

export default function Analytics() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [gradeFilter, setGradeFilter] = useState('all'); // 'all' | 9 | 10
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('missedCount'); // 'missedCount' | 'lateCount'
  const [limit, setLimit] = useState(50);

  // Clear-all UI state
  const [showClearPrompt, setShowClearPrompt] = useState(false);
  const [clearPwd, setClearPwd] = useState('');
  const [clearing, setClearing] = useState(false);
  const [msg, setMsg] = useState('');
  const msgTimer = useRef(null);

  const showMsg = (text, ms = 2500) => {
    clearTimeout(msgTimer.current);
    setMsg(text);
    msgTimer.current = setTimeout(() => setMsg(''), ms);
  };

  // --- Live auto-refresh via onSnapshot ---
  useEffect(() => {
    // We read the whole collection and do filtering/sorting client-side to ensure
    // we include docs that only have lateCount or only have missedCount.
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, 'analytics'),
      (snap) => {
        const data = snap.docs.map((d) => {
          const val = d.data() || {};
          return {
            id: d.id,
            fullName: val.fullName || '(Unassigned slot)',
            slotId: val.slotId || '',
            grade: val.grade ?? '—',
            missedCount: fmt(val.missedCount),
            lateCount: fmt(val.lateCount),
          };
        });
        setRows(data);
        setLoading(false);
      },
      (err) => {
        console.error('Analytics snapshot error', err);
        setLoading(false);
        showMsg('Failed to load analytics (listener).');
      }
    );
    return () => {
      unsub();
      clearTimeout(msgTimer.current);
    };
  }, []);

  // Manual refresh button (still available; forces a one-shot fetch)
  const fetchData = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'analytics'));
      const data = snap.docs.map((d) => {
        const val = d.data() || {};
        return {
          id: d.id,
          fullName: val.fullName || '(Unassigned slot)',
          slotId: val.slotId || '',
          grade: val.grade ?? '—',
          missedCount: fmt(val.missedCount),
          lateCount: fmt(val.lateCount),
        };
      });
      setRows(data);
    } catch (e) {
      console.error('Analytics fetch error', e);
      showMsg('Failed to refresh analytics.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let out = rows.slice();

    // Filter by grade
    if (gradeFilter !== 'all') {
      out = out.filter((r) => String(r.grade) === String(gradeFilter));
    }

    // Search by name or slot
    const s = search.trim().toLowerCase();
    if (s) {
      out = out.filter((r) => {
        const name = (r.fullName || '').toLowerCase();
        const slot = (r.slotId || '').toLowerCase();
        return name.includes(s) || slot.includes(s);
      });
    }

    // Sort by selected key
    out.sort((a, b) => fmt(b[sortKey]) - fmt(a[sortKey]));

    // Apply client-side limit (since we subscribe to all docs)
    out = out.slice(0, Number(limit));

    return out;
  }, [rows, gradeFilter, search, sortKey, limit]);

  // --- Clear all analytics (password-protected) ---
  const clearAllAnalytics = async () => {
    if (clearPwd !== CLEAR_PASSWORD) {
      showMsg('Incorrect password.');
      return;
    }
    setClearing(true);
    try {
      const col = collection(db, 'analytics');
      const snap = await getDocs(col);
      const ids = snap.docs.map((d) => d.id);

      if (ids.length === 0) {
        showMsg('Analytics is already empty.');
        setShowClearPrompt(false);
        setClearPwd('');
        setClearing(false);
        return;
      }

      // Delete in chunks of 400 to stay below batch limits
      const chunkSize = 400;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const batch = writeBatch(db);
        const slice = ids.slice(i, i + chunkSize);
        slice.forEach((id) => batch.delete(doc(db, 'analytics', id)));
        await batch.commit();
      }

      showMsg('All analytics cleared.');
      setShowClearPrompt(false);
      setClearPwd('');
    } catch (e) {
      console.error('Clear analytics error', e);
      showMsg('Failed to clear analytics.');
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
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-900"
            title="Refresh (listener is live — this forces an immediate re-fetch)"
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          {/* Password-protected "Clear All" */}
          {!showClearPrompt ? (
            <button
              onClick={() => setShowClearPrompt(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              title="Clear ALL analytics counters"
            >
              <ShieldOff size={16} />
              Clear All
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
                  onKeyDown={(e) => e.key === 'Enter' && !clearing && clearAllAnalytics()}
                />
              </div>
              <button
                onClick={clearAllAnalytics}
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

      {/* Controls */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
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

        <div>
          <label className="block text-sm text-slate-600 mb-1">Limit</label>
          <select
            className="w-full border border-slate-300 rounded-lg px-2 py-2"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <option>25</option>
            <option>50</option>
            <option>100</option>
          </select>
        </div>
      </div>

      {/* Table */}
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
              <tr><td colSpan={6} className="py-6 text-center text-slate-500">No data yet.</td></tr>
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
        Live data from <code>/analytics</code>. Use “Clear All” (password protected) to reset counters.
      </p>
    </div>
  );
}
