// src/App.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from './firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import StudentList from './StudentList';
import Scanner from './Scanner';
import { Send, ScanLine, X, Mail, Trash2, Printer, Lock } from 'lucide-react';

// --- Set your password here ---
const APP_PASSWORD = 'scan123';

function App() {
  const [scannedStudents, setScannedStudents] = useState(() => {
    const savedStudents = localStorage.getItem('scannedStudents');
    return savedStudents ? JSON.parse(savedStudents) : [];
  });

  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [lastScannedName, setLastScannedName] = useState('');
  const processingScan = useRef(false);
  
  // --- NEW: State to control site access ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  useEffect(() => {
    localStorage.setItem('scannedStudents', JSON.stringify(scannedStudents));
  }, [scannedStudents]);

  const showFeedback = (message, isError = false) => {
    if (isError) {
      setError(message);
      setTimeout(() => setError(''), 3000);
    } else {
      setFeedback(message);
      setTimeout(() => setFeedback(''), 2000);
    }
  };

  const handleScanSuccess = useCallback(async (decodedText) => {
    if (processingScan.current) return;
    processingScan.current = true;
    const qrId = decodedText;
    try {
      const currentStudents = JSON.parse(localStorage.getItem('scannedStudents')) || [];
      if (currentStudents.some(student => student.qrId === qrId)) {
          showFeedback('Student already scanned.');
          processingScan.current = false;
          return;
      }
      const studentsRef = collection(db, 'students');
      const q = query(studentsRef, where('qrId', '==', qrId));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        showFeedback(`QR Code "${qrId}" not found.`, true);
      } else {
        querySnapshot.forEach((doc) => {
          const studentData = { id: doc.id, ...doc.data() };
          setScannedStudents(prevStudents => [studentData, ...prevStudents]);
          setLastScannedName(studentData.fullName);
        });
      }
    } catch (err) {
      console.error("Error fetching student:", err);
      showFeedback("Database connection error.", true);
    } finally {
      setTimeout(() => {
        processingScan.current = false;
      }, 1500);
    }
  }, []);

  const handleScanError = useCallback((errorMessage) => {
    if (errorMessage && (errorMessage.includes("permission") || errorMessage.includes("NotAllowedError"))) {
      console.error("Fatal QR Scanner Error:", errorMessage);
      showFeedback("Camera permission was denied.", true);
      setIsScanning(false);
    }
  }, []);

  const handleRemoveStudent = (studentIdToRemove) => {
    setScannedStudents(prevStudents =>
      prevStudents.filter(student => student.id !== studentIdToRemove)
    );
    showFeedback('Student removed.');
  };

  const handleClearList = () => {
    setScannedStudents([]);
    setAdminEmail('');
    showFeedback("List cleared.");
  };

  const handleSendReport = async () => {
    if (scannedStudents.length === 0) {
      showFeedback("The list is empty. Nothing to send.", true);
      return;
    }
    if (!adminEmail || !/\S+@\S+\.\S+/.test(adminEmail)) {
        showFeedback("Please enter a valid administrator email.", true);
        return;
    }
    const functionUrl = 'https://sendreportemail-dvo2lwydea-uc.a.run.app';
    showFeedback("Sending report...");
    try {
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                students: scannedStudents,
                recipientEmail: adminEmail
            }),
        });
        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }
        showFeedback("Report sent successfully!");
        handleClearList();
    } catch (error) {
        console.error('Error sending report:', error);
        showFeedback('Failed to send report. Please try again.', true);
    }
  };
  
  const handlePasswordSubmit = () => {
    if (passwordInput === APP_PASSWORD) {
      setIsAuthenticated(true);
      setError('');
    } else {
      showFeedback("Incorrect password.", true);
      setPasswordInput('');
    }
  };

  const scannerComponent = useCallback(() => (
    <Scanner
        onScanSuccess={handleScanSuccess}
        onScanError={handleScanError}
        lastScannedName={lastScannedName}
    />
  ), [handleScanSuccess, handleScanError, lastScannedName]);

  // --- NEW: Render the Login Screen if not authenticated ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-xs text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Phone Scanner</h1>
          <p className="text-slate-600 mb-6">Please enter the password to continue.</p>
          <div className="relative">
            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
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
          {error && <div className="mt-4 p-2 text-center text-sm bg-red-100 text-red-800 rounded-lg">{error}</div>}
        </div>
      </div>
    );
  }

  // --- Main App content (only shown after successful login) ---
  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800">
      <div className="container mx-auto max-w-2xl p-4">
        <header className="text-center my-6">
          <h1 className="text-4xl font-bold text-slate-900">Phone Collection Scanner</h1>
          <p className="text-slate-600 mt-2">Scan QR codes on empty phone cases to generate a report.</p>
          <a
            href="/labels.html"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline"
          >
            <Printer size={16} />
            Print Labels
          </a>
        </header>

        <main className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex flex-col items-center">
            <button
              onClick={() => { setError(''); setIsScanning(true); }}
              className="flex items-center justify-center gap-3 w-full sm:w-auto bg-blue-600 text-white font-bold text-lg py-4 px-8 rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300"
            >
              <ScanLine size={24} />
              Start Collection
            </button>
          </div>
          
          {isScanning && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-4 w-full max-w-md relative">
                 <h2 className="text-center text-xl font-semibold mb-2">Scan QR Code</h2>
                 {scannerComponent()}
                 <button onClick={() => setIsScanning(false)} className="absolute top-2 right-2 p-2 bg-slate-200 rounded-full hover:bg-slate-300">
                    <X size={20} />
                 </button>
              </div>
            </div>
          )}

          {feedback && <div className="mt-4 p-3 text-center bg-green-100 text-green-800 rounded-lg">{feedback}</div>}
          {error && <div className="mt-4 p-3 text-center bg-red-100 text-red-800 rounded-lg">{error}</div>}

          <div className="mt-6">
            <StudentList students={scannedStudents} onRemove={handleRemoveStudent} />

            {scannedStudents.length > 0 && (
              <div className="mt-6 border-t pt-6 flex flex-col items-center gap-4">
                <div className="w-full max-w-sm relative">
                    <Mail size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="email"
                        placeholder="Administrator's Email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="flex items-center gap-4">
                    <button
                      onClick={handleSendReport}
                      className="flex items-center justify-center gap-3 bg-green-600 text-white font-bold py-3 px-6 rounded-xl shadow-md hover:bg-green-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-300"
                    >
                      <Send size={20} />
                      Send Report ({scannedStudents.length})
                    </button>
                    <button
                      onClick={handleClearList}
                      className="flex items-center justify-center gap-2 bg-red-500 text-white font-bold py-3 px-4 rounded-xl shadow-md hover:bg-red-600 transition-all duration-300"
                      title="Clear List"
                    >
                      <Trash2 size={20} />
                      Clear
                    </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;