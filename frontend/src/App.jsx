import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';

export default function App() {
  const [userSession, setUserSession] = useState(null); // { user_id, username }

  return (
    <div className="relative min-h-screen bg-cyber-bg text-slate-100 overflow-hidden">
      <AnimatePresence mode="wait">
        {!userSession ? (
          <motion.div
            key="landing"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="w-full"
          >
            <LandingPage onStart={(session) => setUserSession(session)} />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="w-full h-screen"
          >
            <Dashboard user={userSession} onBack={() => setUserSession(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
