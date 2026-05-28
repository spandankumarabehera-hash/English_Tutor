import React, { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  MessageSquare, 
  Mic, 
  BookOpen, 
  ArrowRight, 
  Check, 
  HelpCircle, 
  Play, 
  Globe, 
  X, 
  Lock, 
  User, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const API_BASE = "http://localhost:8000/api";

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What is the name of your first school?",
  "In what city were you born?",
  "What is your favorite childhood book?",
  "What is the name of your favorite teacher?"
];

export default function LandingPage({ onStart }) {
  // Modal states: 'login', 'register', 'forgot_password_username', 'forgot_password_question', 'forgot_username'
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState("login"); // login, register, forgot_pass_start, forgot_pass_question, forgot_user
  
  // Sign In / Sign Up Form State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState("");
  
  // Credentials Recovery Form State
  const [recoveryUsername, setRecoveryUsername] = useState("");
  const [activeQuestion, setActiveQuestion] = useState("");
  const [recoveryAnswer, setRecoveryAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [recoveredUsername, setRecoveredUsername] = useState("");

  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fade-in animations configurations
  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12
      }
    }
  };

  const floatAnimation = {
    animate: {
      y: [0, -12, 0],
      transition: {
        duration: 5,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  // --- Auth Handlers ---

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setAuthError("Please fill out all fields.");
      return;
    }
    if (username.length < 3) {
      setAuthError("Username must be at least 3 characters.");
      return;
    }
    if (password.length < 4) {
      setAuthError("Password must be at least 4 characters.");
      return;
    }

    if (authTab === "register" && !securityAnswer.trim()) {
      setAuthError("Please provide a security question answer.");
      return;
    }

    setAuthError("");
    setAuthSuccess("");
    setIsSubmitting(true);

    try {
      if (authTab === "login") {
        const res = await axios.post(`${API_BASE}/auth/login`, {
          username: username,
          password: password
        });
        setAuthSuccess("Login successful! Redirecting...");
        setTimeout(() => {
          setShowAuthModal(false);
          onStart({ user_id: res.data.user_id, username: res.data.username });
        }, 800);
      } else {
        const res = await axios.post(`${API_BASE}/auth/register`, {
          username: username,
          password: password,
          recovery_question: securityQuestion,
          recovery_answer: securityAnswer
        });
        setAuthSuccess("Account created successfully! Logging you in...");
        setTimeout(() => {
          setShowAuthModal(false);
          onStart({ user_id: res.data.user_id, username: res.data.username });
        }, 800);
      }
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.detail) {
        setAuthError(err.response.data.detail);
      } else {
        setAuthError("Connection refused. Please check if your FastAPI backend is running.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Password Recovery Step 1: Load question ---
  const handleLoadQuestion = async (e) => {
    e.preventDefault();
    if (!recoveryUsername.trim()) {
      setAuthError("Please enter your username.");
      return;
    }
    setAuthError("");
    setIsSubmitting(true);

    try {
      const res = await axios.get(`${API_BASE}/auth/recovery-question?username=${recoveryUsername.trim()}`);
      setActiveQuestion(res.data.recovery_question);
      setAuthTab("forgot_pass_question");
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        setAuthError(err.response.data.detail);
      } else {
        setAuthError("Error loading security question. Username may not exist.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Password Recovery Step 2: Answer & Reset ---
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!recoveryAnswer.trim() || !newPassword.trim()) {
      setAuthError("Please fill out all fields.");
      return;
    }
    setAuthError("");
    setAuthSuccess("");
    setIsSubmitting(true);

    try {
      await axios.post(`${API_BASE}/auth/reset-password`, {
        username: recoveryUsername,
        recovery_answer: recoveryAnswer,
        new_password: newPassword
      });
      setAuthSuccess("Password reset successful! You can now log in.");
      setTimeout(() => {
        setAuthTab("login");
        setUsername(recoveryUsername);
        setPassword("");
        setRecoveryUsername("");
        setRecoveryAnswer("");
        setNewPassword("");
        setAuthSuccess("");
      }, 1500);
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        setAuthError(err.response.data.detail);
      } else {
        setAuthError("Incorrect recovery answer.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Username Recovery ---
  const handleRecoverUsername = async (e) => {
    e.preventDefault();
    if (!recoveryAnswer.trim()) {
      setAuthError("Please enter your security answer.");
      return;
    }
    setAuthError("");
    setRecoveredUsername("");
    setIsSubmitting(true);

    try {
      const res = await axios.post(`${API_BASE}/auth/recover-username`, {
        recovery_question: securityQuestion,
        recovery_answer: recoveryAnswer
      });
      setRecoveredUsername(res.data.username);
      setAuthSuccess("Username recovered successfully!");
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        setAuthError(err.response.data.detail);
      } else {
        setAuthError("No matching username found with this security question and answer.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-cyber-gradient bg-glow-purple bg-glow-blue overflow-hidden text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Glow Circles */}
      <div className="absolute top-[20%] left-[10%] w-[350px] h-[350px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow"></div>

      {/* Grid Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.1),rgba(255,255,255,0))] pointer-events-none"></div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.005)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.005)_1px,transparent_1px)] bg-[size:100px_100px] pointer-events-none"></div>

      {/* Navbar */}
      <header className="relative z-10 max-w-7xl mx-auto px-6 py-6 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white animate-spin-slow" />
          </div>
          <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            English<span className="text-indigo-400">AI</span>Tutor
          </span>
        </div>

        <div className="flex items-center gap-6">
          <a href="#features" className="hidden md:block text-slate-400 hover:text-white transition text-sm font-medium">Features</a>
          <a href="#how-it-works" className="hidden md:block text-slate-400 hover:text-white transition text-sm font-medium">How It Works</a>
          <button 
            onClick={() => {
              setAuthTab("login");
              setAuthError("");
              setAuthSuccess("");
              setShowAuthModal(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-slate-900 border border-white/10 hover:border-indigo-500/30 text-white font-semibold text-sm transition hover:shadow-indigo-500/10 hover:shadow-lg micro-glow-btn flex items-center gap-2"
          >
            Sign In <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24 md:pt-24 md:pb-32 grid md:grid-cols-2 gap-12 items-center">
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="flex flex-col space-y-6"
        >
          <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 w-fit">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-indigo-300 uppercase tracking-widest">Next-Gen Language Learning</span>
          </motion.div>

          <motion.h1 variants={fadeInUp} className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.1] text-white">
            Master English with <br />
            <span className="text-gradient">Futuristic AI</span> Tutor
          </motion.h1>

          <motion.p variants={fadeInUp} className="text-lg text-slate-400 max-w-lg leading-relaxed">
            Experience conversational English learning with real-time polite grammar corrections, voice-based dialogs, smart dictionary lookups, and encouraging personalized guidance.
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-wrap gap-4 pt-4">
            <button 
              onClick={() => {
                setAuthTab("register");
                setAuthError("");
                setAuthSuccess("");
                setShowAuthModal(true);
              }}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-95 text-white font-semibold text-base transition shadow-xl shadow-indigo-500/35 hover:shadow-indigo-500/50 hover:-translate-y-0.5 flex items-center gap-3 active:translate-y-0"
            >
              Start Learning Free <ArrowRight className="w-5 h-5" />
            </button>
            <a 
              href="#how-it-works"
              className="px-6 py-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold text-base transition flex items-center gap-2"
            >
              <Play className="w-4 h-4 text-indigo-400 fill-indigo-400" /> How it Works
            </a>
          </motion.div>
        </motion.div>

        {/* Floating Avatar Illustration */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative flex justify-center items-center"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 via-indigo-500/20 to-purple-500/20 rounded-3xl blur-[40px] pointer-events-none animate-pulse-slow"></div>

          <motion.div 
            variants={floatAnimation}
            animate="animate"
            className="relative z-10 w-[280px] h-[280px] md:w-[350px] md:h-[350px] rounded-3xl glass-card flex flex-col justify-center items-center border border-white/10 shadow-2xl p-6"
          >
            <div className="relative w-36 h-36 md:w-44 md:h-44 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center p-1.5 shadow-2xl shadow-indigo-500/30">
              <div className="absolute inset-0 rounded-full bg-indigo-500/30 blur-xl animate-pulse"></div>
              <div className="w-full h-full rounded-full bg-dark-bg flex items-center justify-center overflow-hidden border border-white/10">
                <Sparkles className="w-16 h-16 text-indigo-400 animate-pulse" />
              </div>
            </div>

            <div className="absolute top-8 -left-4 px-4 py-2 rounded-xl glass-card text-xs flex items-center gap-2 border border-green-500/30 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
              <span className="text-slate-300">Live AI Assistant</span>
            </div>

            <div className="absolute bottom-16 -right-6 px-4 py-2 rounded-xl glass-card text-xs flex flex-col border border-indigo-500/30 shadow-lg space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">User Speech</span>
              <span className="text-indigo-300 font-medium">"I goes to school..."</span>
              <div className="w-full h-[1px] bg-white/5 my-1"></div>
              <span className="text-green-400 font-medium">"I go to school..."</span>
            </div>

            <div className="absolute top-1/2 -right-8 transform -translate-y-1/2 px-4 py-2.5 rounded-xl glass-card text-xs flex items-center gap-2 border border-purple-500/30 shadow-lg">
              <Mic className="w-4 h-4 text-purple-400 animate-bounce" />
              <span className="text-slate-300">Voice Active</span>
            </div>

            <div className="mt-8 text-center">
              <h3 className="font-extrabold text-lg tracking-wide text-white">English AI Tutor</h3>
              <p className="text-xs text-indigo-400 font-medium mt-1">Fluent Speech & Grammar Coach</p>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* CORE FEATURES SECTION */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 py-20 border-t border-white/5">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">Mastery Tools</h2>
          <h3 className="text-3xl md:text-4xl font-extrabold text-white mt-2">Everything you need to speak fluently</h3>
          <p className="text-slate-400 mt-4 leading-relaxed">
            Engineered with deep semantic analysis and advanced voice synthesizers to model an experienced human teacher.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="glass-card glass-card-interactive p-8 rounded-2xl flex flex-col space-y-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-blue-400" />
            </div>
            <h4 className="text-xl font-bold text-white">Grammar Checking & Explainers</h4>
            <p className="text-slate-400 text-sm leading-relaxed">
              Never worry about mistakes. Our bot identifies grammatical errors in real time, marks incorrect words, explains why it’s wrong, and proposes elegant fluent alternatives.
            </p>
          </div>

          <div className="glass-card glass-card-interactive p-8 rounded-2xl flex flex-col space-y-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Mic className="w-6 h-6 text-purple-400" />
            </div>
            <h4 className="text-xl font-bold text-white">Full Voice-to-Voice Loop</h4>
            <p className="text-slate-400 text-sm leading-relaxed">
              Click the glowing microphone to speak naturally. The AI records your voice, transcribes it, checks grammar, and responds instantly with both responsive text and synthetic speech.
            </p>
          </div>

          <div className="glass-card glass-card-interactive p-8 rounded-2xl flex flex-col space-y-4">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-pink-400" />
            </div>
            <h4 className="text-xl font-bold text-white">AI Dictionary Assistant</h4>
            <p className="text-slate-400 text-sm leading-relaxed">
              Don't understand a word? Query the built-in dictionary module or click any text segment to instantly see dynamic simple explanations, synonyms, antonyms, and usage examples.
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section id="how-it-works" className="relative z-10 max-w-7xl mx-auto px-6 py-20 border-t border-white/5 bg-slate-950/20">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-xs font-semibold text-purple-400 uppercase tracking-widest">Process</h2>
          <h3 className="text-3xl md:text-4xl font-extrabold text-white mt-2">How English AI Tutor Works</h3>
          <p className="text-slate-400 mt-4">Simple, rapid, and fun workflow for vocabulary and confidence building.</p>
        </div>

        <div className="grid md:grid-cols-4 gap-8 relative">
          <div className="relative flex flex-col items-center text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-black text-lg text-indigo-400 relative z-10">1</div>
            <h5 className="text-lg font-bold text-white">Choose a practice mode</h5>
            <p className="text-slate-400 text-xs leading-relaxed max-w-[200px]">Select free conversation or select scenarios like job interviews or restaurant roleplays.</p>
          </div>

          <div className="relative flex flex-col items-center text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-black text-lg text-indigo-400 relative z-10">2</div>
            <h5 className="text-lg font-bold text-white">Speak or write freely</h5>
            <p className="text-slate-400 text-xs leading-relaxed max-w-[200px]">Type messages or click the microphone to transcribe sentences with Web Speech engines.</p>
          </div>

          <div className="relative flex flex-col items-center text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-black text-lg text-indigo-400 relative z-10">3</div>
            <h5 className="text-lg font-bold text-white">Review error correction</h5>
            <p className="text-slate-400 text-xs leading-relaxed max-w-[200px]">Polite overlays display grammatically corrected alternatives with full phonetic definitions.</p>
          </div>

          <div className="relative flex flex-col items-center text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-black text-lg text-indigo-400 relative z-10">4</div>
            <h5 className="text-lg font-bold text-white">Track Progress Under Profile</h5>
            <p className="text-slate-400 text-xs leading-relaxed max-w-[200px]">Create an account to save vocabulary logs, chat sessions, streaks, and progress stats forever!</p>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-20 border-t border-white/5">
        <h3 className="text-3xl font-extrabold text-white text-center mb-12">Frequently Asked Questions</h3>

        <div className="grid md:grid-cols-2 gap-8">
          {[
            {
              q: "Can I practice speaking with English AI Tutor?",
              a: "Absolutely! The site fully supports real-time voice speech synthesis and speech-to-text. Simply tap the mic icon to dictate your answer."
            },
            {
              q: "Is the Gemini API integration expensive?",
              a: "No! The system supports the ultra-fast and lightweight Gemini 2.5 Flash model which has generous free tier tokens. Additionally, the app features a fully working offline mockup engine."
            },
            {
              q: "How does the grammar correction engine work?",
              a: "Whenever you write or speak a sentence, a parallel AI engine checks for errors. Instead of criticizing you, it highlights mistakes, explains why they are wrong, and suggests standard natural phrasing."
            },
            {
              q: "Is my progress saved across sessions?",
              a: "Yes! Creating a free account links your stats, streaks, XP scores, and saved dictionary items to your profile, so you can log in on any local device and resume learning."
            }
          ].map((faq, idx) => (
            <div key={idx} className="p-6 rounded-xl bg-slate-900/40 border border-white/5 flex gap-4">
              <HelpCircle className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="font-semibold text-white text-base">{faq.q}</h5>
                <p className="text-slate-400 text-sm mt-2 leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/5 bg-slate-950 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-lg text-white">English AI Tutor</span>
          </div>
          <p className="text-slate-500 text-xs">
            © {new Date().getFullYear()} English AI Tutor. Designed for next-generation interactive vocabulary training.
          </p>
          <div className="flex gap-4">
            <a href="#" className="p-2 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition">
              <Globe className="w-4 h-4" />
            </a>
          </div>
        </div>
      </footer>

      {/* AUTHENTICATION GLASSMORPHISM DIALOG MODAL */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuthModal(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            ></motion.div>

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md p-8 rounded-3xl glass-card border border-white/10 shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90vh] overflow-y-auto"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/10 via-indigo-900/10 to-purple-900/10 pointer-events-none"></div>

              <button 
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition z-20"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Title Section */}
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
                </div>
                <h4 className="text-2xl font-black text-white">
                  {authTab === "login" && "Welcome Back"}
                  {authTab === "register" && "Start Your Journey"}
                  {authTab === "forgot_pass_start" && "Reset Password"}
                  {authTab === "forgot_pass_question" && "Verify Security Question"}
                  {authTab === "forgot_user" && "Recover Username"}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  {authTab === "login" && "Sign in to access your grammar dashboard"}
                  {authTab === "register" && "Create a free local account to persist your conversational stats"}
                  {authTab === "forgot_pass_start" && "Enter your username to look up your security question"}
                  {authTab === "forgot_pass_question" && "Provide the correct security answer to reset your password"}
                  {authTab === "forgot_user" && "Provide the security question and answer to retrieve your username"}
                </p>
              </div>

              {/* Tabs Switcher (Only for login / register) */}
              {(authTab === "login" || authTab === "register") && (
                <div className="flex bg-slate-950/60 p-1 rounded-xl border border-white/5 mb-6">
                  <button
                    onClick={() => {
                      setAuthTab("login");
                      setAuthError("");
                      setAuthSuccess("");
                    }}
                    className={`flex-1 py-2 rounded-lg font-bold text-xs tracking-wider transition uppercase ${authTab === 'login' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => {
                      setAuthTab("register");
                      setAuthError("");
                      setAuthSuccess("");
                    }}
                    className={`flex-1 py-2 rounded-lg font-bold text-xs tracking-wider transition uppercase ${authTab === 'register' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Sign Up
                  </button>
                </div>
              )}

              {/* Feedback cards */}
              {authError && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="font-semibold leading-relaxed">{authError}</span>
                </div>
              )}

              {authSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 animate-bounce" />
                  <span className="font-semibold leading-relaxed">{authSuccess}</span>
                </div>
              )}

              {/* --- VIEW A: SIGN IN / SIGN UP FORM --- */}
              {(authTab === "login" || authTab === "register") && (
                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest pl-1">Username</label>
                    <div className="relative flex items-center">
                      <User className="absolute left-4 w-4 h-4 text-slate-500" />
                      <input 
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter username" 
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 focus:border-indigo-500 text-sm outline-none text-white font-medium transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest pl-1">Password</label>
                    <div className="relative flex items-center">
                      <Lock className="absolute left-4 w-4 h-4 text-slate-500" />
                      <input 
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••" 
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 focus:border-indigo-500 text-sm outline-none text-white font-medium transition"
                      />
                    </div>
                  </div>

                  {/* Sign-Up Extra Security fields */}
                  {authTab === "register" && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest pl-1">Security Question</label>
                        <select
                          value={securityQuestion}
                          onChange={(e) => setSecurityQuestion(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 focus:border-indigo-500 text-xs outline-none text-white font-medium transition"
                        >
                          {SECURITY_QUESTIONS.map((q, idx) => (
                            <option key={idx} value={q} className="bg-[#0B0F19] text-slate-200">{q}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest pl-1">Security Answer</label>
                        <input 
                          type="text"
                          required
                          value={securityAnswer}
                          onChange={(e) => setSecurityAnswer(e.target.value)}
                          placeholder="Your answer (e.g. 'Bella')" 
                          className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 focus:border-indigo-500 text-sm outline-none text-white font-medium transition"
                        />
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full mt-2 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-95 disabled:opacity-50 text-white font-bold text-sm tracking-wide transition shadow-lg shadow-indigo-500/25 flex justify-center items-center gap-2"
                  >
                    {isSubmitting ? "Processing..." : authTab === "login" ? "Sign In" : "Sign Up"}
                  </button>

                  {/* Recovery buttons links */}
                  {authTab === "login" && (
                    <div className="flex justify-between items-center text-[11px] pt-2 text-indigo-400 font-bold pl-1">
                      <button 
                        type="button" 
                        onClick={() => {
                          setAuthTab("forgot_pass_start");
                          setAuthError("");
                          setAuthSuccess("");
                        }}
                        className="hover:underline hover:text-indigo-300"
                      >
                        Forgot Password?
                      </button>
                      <button 
                        type="button" 
                        onClick={() => {
                          setAuthTab("forgot_user");
                          setAuthError("");
                          setAuthSuccess("");
                          setSecurityAnswer("");
                          setRecoveredUsername("");
                        }}
                        className="hover:underline hover:text-indigo-300"
                      >
                        Forgot Username?
                      </button>
                    </div>
                  )}
                </form>
              )}

              {/* --- VIEW B: FORGOT PASSWORD - INPUT USERNAME --- */}
              {authTab === "forgot_pass_start" && (
                <form onSubmit={handleLoadQuestion} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest pl-1">Enter Your Username</label>
                    <div className="relative flex items-center">
                      <User className="absolute left-4 w-4 h-4 text-slate-500" />
                      <input 
                        type="text"
                        required
                        value={recoveryUsername}
                        onChange={(e) => setRecoveryUsername(e.target.value)}
                        placeholder="Enter username" 
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 focus:border-indigo-500 text-sm outline-none text-white font-medium transition"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm tracking-wide transition shadow"
                  >
                    {isSubmitting ? "Searching..." : "Find Security Question"}
                  </button>

                  <button 
                    type="button" 
                    onClick={() => {
                      setAuthTab("login");
                      setAuthError("");
                    }}
                    className="w-full py-2.5 rounded-xl border border-white/5 bg-slate-900/40 text-xs font-bold text-slate-400 hover:text-white transition"
                  >
                    Back to Sign In
                  </button>
                </form>
              )}

              {/* --- VIEW C: FORGOT PASSWORD - ANSWER SECURITY QUESTION & RESET --- */}
              {authTab === "forgot_pass_question" && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/10 text-xs leading-relaxed text-slate-300 font-semibold mb-2">
                    <span className="text-[10px] text-indigo-400 uppercase font-black block mb-1">Your Security Question</span>
                    {activeQuestion}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest pl-1">Your Security Answer</label>
                    <input 
                      type="text"
                      required
                      value={recoveryAnswer}
                      onChange={(e) => setRecoveryAnswer(e.target.value)}
                      placeholder="Enter security answer" 
                      className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 focus:border-indigo-500 text-sm outline-none text-white font-medium transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest pl-1">New Password</label>
                    <div className="relative flex items-center">
                      <Lock className="absolute left-4 w-4 h-4 text-slate-500" />
                      <input 
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••" 
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 focus:border-indigo-500 text-sm outline-none text-white font-medium transition"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-bold text-sm tracking-wide transition shadow"
                  >
                    {isSubmitting ? "Verifying..." : "Reset Password & Log In"}
                  </button>

                  <button 
                    type="button" 
                    onClick={() => {
                      setAuthTab("forgot_pass_start");
                      setAuthError("");
                      setRecoveryAnswer("");
                      setNewPassword("");
                    }}
                    className="w-full py-2.5 rounded-xl border border-white/5 bg-slate-900/40 text-xs font-bold text-slate-400 hover:text-white transition"
                  >
                    Back
                  </button>
                </form>
              )}

              {/* --- VIEW D: FORGOT USERNAME --- */}
              {authTab === "forgot_user" && (
                <form onSubmit={handleRecoverUsername} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest pl-1">Select Security Question</label>
                    <select
                      value={securityQuestion}
                      onChange={(e) => setSecurityQuestion(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 focus:border-indigo-500 text-xs outline-none text-white font-medium transition"
                    >
                      {SECURITY_QUESTIONS.map((q, idx) => (
                        <option key={idx} value={q} className="bg-[#0B0F19] text-slate-200">{q}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest pl-1">Your Security Answer</label>
                    <input 
                      type="text"
                      required
                      value={recoveryAnswer}
                      onChange={(e) => setRecoveryAnswer(e.target.value)}
                      placeholder="Enter security answer" 
                      className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 focus:border-indigo-500 text-sm outline-none text-white font-medium transition"
                    />
                  </div>

                  {/* Display recovered username block */}
                  {recoveredUsername && (
                    <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-center space-y-1 animate-bounce">
                      <span className="text-[10px] text-green-400 uppercase font-black tracking-widest block">Username Recovered!</span>
                      <span className="text-lg font-black text-white">{recoveredUsername}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm tracking-wide transition shadow"
                  >
                    {isSubmitting ? "Verifying..." : "Recover Username"}
                  </button>

                  <button 
                    type="button" 
                    onClick={() => {
                      setAuthTab("login");
                      setAuthError("");
                      setRecoveryAnswer("");
                      setRecoveredUsername("");
                      setAuthSuccess("");
                    }}
                    className="w-full py-2.5 rounded-xl border border-white/5 bg-slate-900/40 text-xs font-bold text-slate-400 hover:text-white transition"
                  >
                    Back to Sign In
                  </button>
                </form>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
