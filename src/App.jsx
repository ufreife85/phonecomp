import React, { useState, useEffect, useCallback } from 'react';
import { db } from './firebaseConfig';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  writeBatch,
  doc,
  setDoc,
  increment,
} from 'firebase/firestore';
import StudentList from './StudentList';
import { Printer, Lock, ClipboardCopy, Mail, Trash2, Info, User } from 'lucide-react';
import Analytics from './Analytics';

// --- Set your password here ---
const APP_PASSWORD = 'scan123';

function App() {
  // Replaces scannedStudents with unaccounted (same storage key for continuity)
  const [unaccounted, setUnaccounted] = useState(() => {
    const saved = localStorage.getItem('scannedStudents');
    return saved ? JSON.parse(saved) : [];
  });

  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [lastAdded, setLastAdded] = useState('');
  const [slotInput, setSlotInput] = useState('');

  // NEW: optional staff name to store with reports
  const [staffName, setStaffName] = useState('');

  // --- Auth screen state ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [view, setView] = useState('collect'); // 'collect' | 'analytics'

  useEffect(() => {
    localStorage.setItem('scannedStudents', JSON.stringify(unaccounted));
  }, [unaccounted]);

  const showFeedback = (message, isError = false, ms = 2500) => {
    if (isError) {
      setError(message);
      setTimeout(() => setError(''), ms);
    } else {
      setFeedback(message);
      setTimeout(() => setFeedback(''), ms);
    }
  };

  // --- Helpers ---
  const normalizeSlotId = (raw) => {
    const s = (raw || '').toString().trim().toUpperCase();
    // Accept A–H and 1–36 (allow spaces like "A 12")
    const m = s.match(/^([A-H])\s*([1-9]|[1-2]\d|3[0-6])$/);
    if (!m) return null;
    return `${m[1]}${m[2]}`;
  };

  const handleAddSlot = useCallback(async () => {
    const slotId = normalizeSlotId(slotInput);
    if (!slotId) {
      showFeedback('Enter a valid slot like A1–H36 (e.g., F18).', true);
      return;
    }

    // prevent duplicates
    if (unaccounted.some((s) => (s.slotId || '').toUpperCase() === slotId)) {
      showFeedback('That slot is already on the list.');
      return;
    }

    try {
      const studentsRef = collection(db, 'students');
      const q = query(studentsRef, where('slotId', '==', slotId));
      const qs = await getDocs(q);

      if (qs.empty) {
        // Still add placeholder row to track an unassigned empty slot
        const placeholder = {
          id: `missing:${slotId}`,
          slotId,
          fullName: '(Unassigned slot)',
          grade: null,
          studentId: null,
          status: 'absent', // 'absent' | 'late'
        };
        setUnaccounted((prev) => [placeholder, ...prev]);
        setLastAdded(slotId);
        showFeedback(`No student assigned to ${slotId}. Added as placeholder.`);
      } else {
        // If multiple docs (shouldn’t happen), include them all defensively
        const newRows = [];
        qs.forEach((docSnap) => {
          const s = { id: docSnap.id, ...docSnap.data(), status: 'absent' };
          newRows.push(s);
        });
        setUnaccounted((prev) => [...newRows, ...prev]);
        setLastAdded(slotId);
        showFeedback(`Added ${slotId}.`);
      }
      setSlotInput('');
    } catch (err) {
      console.error('Lookup error:', err);
      showFeedback('Database connection error.', true);
    }
  }, [slotInput, unaccounted]);

  const handleRemoveStudent = (studentIdToRemove) => {
    setUnaccounted((prev) => prev.filter((s) => s.id !== studentIdToRemove));
    showFeedback('Removed.');
  };

  const handleToggleLate = (studentIdToToggle) => {
    setUnaccounted((prev) =>
      prev.map((s) =>
        s.id === studentIdToToggle
          ? { ...s, status: s.status === 'late' ? 'absent' : 'late' }
          : s
      )
    );
  };

  const handleClearList = () => {
    setUnaccounted([]);
    showFeedback('List cleared.');
  };

  const splitByStatus = () => {
    const absent = [];
    const late = [];
    for (const s of unaccounted) {
      if (s.status === 'late') late.push(s);
      else absent.push(s);
    }
    return { absent, late };
  };

  const formatReport = () => {
    if (unaccounted.length === 0) return 'All phones accounted for.';
    const { absent, late } = splitByStatus();

    const hdr = `Phone Collection Report — ${new Date().toLocaleString()}${staffName ? ` — Staff: ${staffName}` : ''}`;
    const toLines = (arr, label) =>
      arr
        .slice()
        .reverse()
        .map((s) => {
          const name = s.fullName || '(Unassigned slot)';
          const grade = s.grade ? ` (Grade ${s.grade})` : '';
          return `• ${label} — ${s.slotId} — ${name}${grade}`;
        })
        .join('\n');

    const absentBlock = absent.length ? `ABSENT (${absent.length})\n${toLines(absent, 'ABSENT')}` : '';
    const lateBlock = late.length ? `\n\nLATE (${late.length})\n${toLines(late, 'LATE')}` : '';
    const total = `\n\nTotal: ${unaccounted.length}`;

    return `${hdr}\n\n${absentBlock}${lateBlock}${total}`;
  };

  const copyReportToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formatReport());
      showFeedback('Report copied to clipboard.');
    } catch {
      showFeedback('Copy failed. Select & copy from the preview box.', true);
    }
  };

  /**
   * NEW: Persist analytics and a report summary.
   * - Adds one document under /reports/<YYYY-MM-DD>/<autoId> with the day's list.
   * - Upserts counters per student under /analytics/<studentKey>:
   *     missedCount (increment), lateCount (increment), lastStatusAt (serverTimestamp)
   *   studentKey is studentId if present, otherwise "slot:<slotId>"
   */
  const submitAnalyticsAndReport = async () => {
    if (unaccounted.length === 0) return;

    const todayIso = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const { absent, late } = splitByStatus();

    // 1) Write a daily report row
    const reportCol = collection(db, 'reports', todayIso, 'submissions');
    const reportPayload = {
      ts: serverTimestamp(),
      date: todayIso,
      staffName: staffName || null,
      total: unaccounted.length,
      absent: absent.map((s) => ({
        studentId: s.studentId ?? null,
        fullName: s.fullName ?? null,
        grade: s.grade ?? null,
        slotId: s.slotId ?? null,
      })),
      late: late.map((s) => ({
        studentId: s.studentId ?? null,
        fullName: s.fullName ?? null,
        grade: s.grade ?? null,
        slotId: s.slotId ?? null,
      })),
    };
    await addDoc(reportCol, reportPayload);

    // 2) Upsert analytics counters in a batch
    const batch = writeBatch(db);
    const touchAnalyticsDoc = (s) => {
      const key = s.studentId ? String(s.studentId) : `slot:${s.slotId}`;
      const ref = doc(db, 'analytics', key);
      const base = {
        fullName: s.fullName ?? null,
        slotId: s.slotId ?? null,
        grade: s.grade ?? null,
        studentId: s.studentId ?? null,
        lastStatusAt: serverTimestamp(),
      };
      // Increment appropriate counter
      const counters =
        s.status === 'late'
          ? { lateCount: increment(1) }
          : { missedCount: increment(1) };
      batch.set(ref, { ...base, ...counters }, { merge: true });
    };

    unaccounted.forEach(touchAnalyticsDoc);
    await batch.commit();
  };

  const submitThen = async (afterFn) => {
    try {
      await submitAnalyticsAndReport();
      await afterFn();
      // Optional: clear the list after submission
      // handleClearList();
    } catch (e) {
      console.error('Submit error:', e);
      showFeedback('Failed to submit analytics/report.', true);
    }
  };

  const openMailtoDraft = () =>
    submitThen(() => {
      const subject = encodeURIComponent('Phone Collection Report');
      const body = encodeURIComponent(formatReport());
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    });

  const copyThenSubmit = () =>
    submitThen(async () => {
      await navigator.clipboard.writeText(formatReport());
      showFeedback('Report copied & analytics saved.');
    });

  const handlePasswordSubmit = () => {
    if (passwordInput === APP_PASSWORD) {
      setIsAuthenticated(true);
      setError('');
    } else {
      showFeedback('Incorrect password.', true);
      setPasswordInput('');
    }
  };

  // --- Login screen ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-xs text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Phone Collection</h1>
          <p className="text-slate-600 mb-6">Please enter the password to continue.</p>
          <div className="relative">
            <Lock
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <button
            onClick={handlePasswordSubmit}
            className="mt-4 w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Unlock
          </button>
          {error && (
            <div className="mt-4 p-2 text-center text-sm bg-red-100 text-red-800 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Main App ---
  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800">
      <div className="container mx-auto max-w-2xl p-4">
        <header className="text-center my-6">
          <h1 className="text-4xl font-bold text-slate-900">Phone Collection</h1>
          <p className="text-slate-600 mt-2">
            Enter <span className="font-mono">slotId</span> (A–H, 1–36). Add a slot for each <em>empty</em> position in the case.
            Mark <strong>Late</strong> if a student arrives and drops off after the sweep.
          </p>

          <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
            <a
              href="/labels.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline"
            >
              <Printer size={16} />
              Print Labels
            </a>
            <span className="inline-flex items-center gap-2 text-slate-500 text-sm">
              <Info size={16} />
              Use format like <span className="font-mono">A34</span>, <span className="font-mono">f18</span>
            </span>
          </div>
        </header>

        <div className="flex items-center gap-2 justify-center mb-4">
            <button
              onClick={() => setView('collect')}
              className={`px-4 py-2 rounded-lg ${view === 'collect' ? 'bg-blue-600 text-white' : 'bg-slate-200 hover:bg-slate-300'}`}
            >
              Collection
            </button>
            <button
              onClick={() => setView('analytics')}
              className={`px-4 py-2 rounded-lg ${view === 'analytics' ? 'bg-blue-600 text-white' : 'bg-slate-200 hover:bg-slate-300'}`}
            >
              Analytics
            </button>
          </div>
        {view === 'collect' ? (
        <main className="bg-white rounded-2xl shadow-lg p-6">
          {/* Staff name (optional) */}
          <div className="mb-4">
            <label className="block text-sm text-slate-600 mb-1">Staff (optional)</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="e.g., Ms. Levine"
                className="w-full sm:w-72 pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Slot entry */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="w-full sm:w-auto">
              <label className="block text-sm text-slate-600 mb-1">Add empty slot</label>
              <input
                value={slotInput}
                onChange={(e) => setSlotInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSlot()}
                placeholder="e.g., A34 or f18"
                className="w-full sm:w-48 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              />
            </div>
            <button
              onClick={handleAddSlot}
              className="flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-2 px-4 rounded-xl shadow-md hover:bg-blue-700 transition-all"
            >
              Add Slot
            </button>

            {lastAdded && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg">
                Added <span className="font-mono">{lastAdded}</span>
              </div>
            )}
          </div>

          {/* Messages */}
          {feedback && (
            <div className="mt-4 p-3 text-center bg-green-100 text-green-800 rounded-lg">
              {feedback}
            </div>
          )}
          {error && (
            <div className="mt-4 p-3 text-center bg-red-100 text-red-800 rounded-lg">
              {error}
            </div>
          )}

          {/* List */}
          <div className="mt-6">
            <StudentList
              students={unaccounted}
              onRemove={handleRemoveStudent}
              onToggleLate={handleToggleLate}
            />

            {unaccounted.length > 0 && (
              <div className="mt-6 border-t pt-6 flex flex-col items-center gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={copyThenSubmit}
                    className="flex items-center justify-center gap-2 bg-slate-700 text-white font-bold py-3 px-4 rounded-xl shadow-md hover:bg-slate-800 transition-all"
                    title="Copy the report text & save analytics"
                  >
                    <ClipboardCopy size={18} />
                    Copy Report & Save
                  </button>

                  <button
                    onClick={openMailtoDraft}
                    className="flex items-center justify-center gap-3 bg-green-600 text-white font-bold py-3 px-4 rounded-xl shadow-md hover:bg-green-700 transition-all"
                    title="Open default mail client with pre-filled report (saves analytics too)"
                  >
                    <Mail size={18} />
                    Open Email Draft ({unaccounted.length})
                  </button>

                  <button
                    onClick={handleClearList}
                    className="flex items-center justify-center gap-2 bg-red-500 text-white font-bold py-3 px-4 rounded-xl shadow-md hover:bg-red-600 transition-all"
                    title="Clear List"
                  >
                    <Trash2 size={18} />
                    Clear
                  </button>
                </div>

                {/* Preview */}
                <textarea
                  readOnly
                  className="w-full max-w-xl h-44 mt-2 p-3 border rounded-lg bg-slate-50 font-mono text-sm"
                  value={formatReport()}
                />
              </div>
            )}
          </div>
        </main>
        ) : (
  <Analytics />
    )}
      </div>
    </div>
  );
}

export default App;
