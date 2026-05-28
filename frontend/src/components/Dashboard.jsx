import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  MessageSquare, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  BookOpen, 
  BookMarked,
  Flame, 
  Trophy, 
  ShieldAlert, 
  Check, 
  ChevronRight, 
  Plus, 
  Trash2, 
  X, 
  Menu,
  GraduationCap,
  LogOut,
  User,
  Clock,
  Award,
  BookOpenCheck,
  CheckCircle
} from 'lucide-react';
const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const API_BASE = "http://localhost:8000/api";

export default function Dashboard({ user, onBack }) {
  const authHeaders = {
    headers: {
      "X-User-Id": String(user.user_id)
    }
  };

  // Sidebar navigation states
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("chat"); // chat, vocabulary, progress, practice

  // Stats State
  const [userStats, setUserStats] = useState({
    streak: 0,
    xp: 0,
    sentences_spoken: 0,
    grammar_accuracy: 100.0,
    time_spent: 0,
    quizzes_completed: 0
  });

  // Chat States
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [currentMode, setCurrentMode] = useState("free_chat");
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Voice states
  const [isDictating, setIsDictating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAutoplayTts, setIsAutoplayTts] = useState(true);
  const [recognition, setRecognition] = useState(null);
  const [showVoiceCallMode, setShowVoiceCallMode] = useState(false);
  const [showVoiceSubtitles, setShowVoiceSubtitles] = useState(true);
  const voiceCallModeRef = useRef(false);

  useEffect(() => {
    voiceCallModeRef.current = showVoiceCallMode;
  }, [showVoiceCallMode]);
  
  // Grammar highlight overlays
  const [activeCorrection, setActiveCorrection] = useState(null); // { error, replacement, explanation, x, y }
  
  // Vocabulary States
  const [vocabSearchText, setVocabSearchText] = useState("");
  const [searchedVocab, setSearchedVocab] = useState(null);
  const [savedVocab, setSavedVocab] = useState([]);
  const [isVocabLoading, setIsVocabLoading] = useState(false);

  // Mock Practice Quiz States
  const [quizLevel, setQuizLevel] = useState("beginner"); // beginner, intermediate, advanced
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizStep, setQuizStep] = useState("select"); // select, active, results
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [isQuizLoading, setIsQuizLoading] = useState(false);

  const chatEndRef = useRef(null);

  // 1. Voice SpeechRecognition setup with dynamic AUTO-SUBMISSION!
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsDictating(true);
      };

      // Voice recognition transcript triggers auto-submit immediately!
      rec.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript.trim()) {
          sendDictatedMessage(transcript.trim());
        }
      };

      rec.onerror = (e) => {
        console.error("Speech Recognition Error: ", e);
        setIsDictating(false);
      };

      rec.onend = () => {
        setIsDictating(false);
      };

      setRecognition(rec);
    }
  }, [currentSessionId, currentMode]); // Bind session dependencies to trigger clean callbacks

  // 2. Active learning minute tracking ping loop (every 60 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (user && user.user_id) {
        axios.post(`${API_BASE}/progress/time`, {}, authHeaders)
          .then(res => {
            setUserStats(res.data);
          })
          .catch(err => console.error("Error logging time:", err));
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [user]);

  // 3. Initial loaders
  useEffect(() => {
    fetchSessions();
    fetchSavedVocabulary();
    fetchProgress();
  }, []);

  // 4. Fetch messages on session swap
  useEffect(() => {
    if (currentSessionId) {
      fetchMessages(currentSessionId);
    }
  }, [currentSessionId]);

  // 5. Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, activeTab]);

  // --- API Integrations ---

  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${API_BASE}/sessions`, authHeaders);
      setSessions(res.data);
      if (res.data.length > 0 && !currentSessionId) {
        setCurrentSessionId(res.data[0].id);
        setCurrentMode(res.data[0].mode);
      } else if (res.data.length === 0) {
        createNewSession("free_chat");
      }
    } catch (e) {
      console.error("Error fetching sessions: ", e);
    }
  };

  const createNewSession = async (mode = "free_chat") => {
    const newId = `session_${uuidv4()}`;
    const titles = {
      free_chat: "Casual Practice",
      interview: "Job Interview Drill",
      restaurant: "At the Restaurant",
      airport: "Airport Check-in Scenario",
      casual: "Supportive Conversation"
    };
    const title = titles[mode] || "Casual Practice";
    
    try {
      const res = await axios.post(`${API_BASE}/sessions`, {
        id: newId,
        title: title,
        mode: mode
      }, authHeaders);
      setSessions(prev => [res.data, ...prev]);
      setCurrentSessionId(newId);
      setCurrentMode(mode);
      setMessages([]);
      setIsLoading(true);
      const chatRes = await axios.post(`${API_BASE}/chat`, {
        text: `Initialize ${mode} mode`,
        session_id: newId,
        mode: mode
      }, authHeaders);
      setMessages([chatRes.data]);
      setIsLoading(false);
      fetchProgress();
    } catch (e) {
      console.error("Error creating session: ", e);
      setIsLoading(false);
    }
  };

  const fetchMessages = async (sessionId) => {
    try {
      const res = await axios.get(`${API_BASE}/sessions/${sessionId}/messages`, authHeaders);
      const filtered = res.data.filter(m => !m.text.startsWith("Initialize "));
      setMessages(filtered);
    } catch (e) {
      console.error("Error fetching messages: ", e);
    }
  };

  const deleteSession = async (sessionId, event) => {
    event.stopPropagation();
    try {
      await axios.delete(`${API_BASE}/sessions/${sessionId}`, authHeaders);
      const updated = sessions.filter(s => s.id !== sessionId);
      setSessions(updated);
      if (currentSessionId === sessionId) {
        if (updated.length > 0) {
          setCurrentSessionId(updated[0].id);
          setCurrentMode(updated[0].mode);
        } else {
          setCurrentSessionId(null);
        }
      }
    } catch (e) {
      console.error("Error deleting session: ", e);
    }
  };

  // --- Dynamic Dictionary Check on Chat Send ---
  const checkForDictionaryIntercept = (text) => {
    const text_lower = text.toLowerCase().strip ? text.toLowerCase().strip() : text.toLowerCase().trim();
    const intercept_words = ["define ", "meaning of ", "what does ", "what is the meaning of "];
    
    let target = null;
    for (let iw of intercept_words) {
      if (text_lower.includes(iw)) {
        const parts = text_lower.split(iw);
        if (parts.length > 1) {
          target = parts[1].replace("mean", "").trim();
          break;
        }
      }
    }
    
    if (target) {
      // Automatically pull dictionary card out alongside the tutor chat response!
      lookupVocabulary(target);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !currentSessionId) return;

    const userText = inputText.trim();
    setInputText("");
    setIsLoading(true);

    // Auto-intercept dictionary lookups in the background to show the vocab card!
    checkForDictionaryIntercept(userText);

    // Optimistically insert user message
    const tempUserMsg = {
      id: Date.now(),
      session_id: currentSessionId,
      sender: "user",
      text: userText,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await axios.post(`${API_BASE}/chat`, {
        text: userText,
        session_id: currentSessionId,
        mode: currentMode
      }, authHeaders);

      fetchMessages(currentSessionId);
      fetchProgress();

      if (isAutoplayTts) {
        speakText(res.data.text);
      }
    } catch (e) {
      console.error("Error sending message: ", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Dedicated Voice Mode Auto-submission API trigger
  const sendDictatedMessage = async (dictatedText) => {
    if (!dictatedText.trim() || !currentSessionId) return;
    setIsLoading(true);

    // Intercept dictionary triggers inside dictation too!
    checkForDictionaryIntercept(dictatedText);

    // Optimistically append user transcript message
    const tempUserMsg = {
      id: Date.now(),
      session_id: currentSessionId,
      sender: "user",
      text: dictatedText,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await axios.post(`${API_BASE}/chat`, {
        text: dictatedText,
        session_id: currentSessionId,
        mode: currentMode
      }, authHeaders);

      fetchMessages(currentSessionId);
      fetchProgress();

      if (isAutoplayTts) {
        speakText(res.data.text);
      }
    } catch (e) {
      console.error("Error sending voice transcript message: ", e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSavedVocabulary = async () => {
    try {
      const res = await axios.get(`${API_BASE}/vocabulary`, authHeaders);
      setSavedVocab(res.data);
    } catch (e) {
      console.error("Error fetching vocabulary: ", e);
    }
  };

  const fetchWordImage = async (word) => {
    try {
      const response = await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(word)}&prop=pageimages&format=json&pithumbsize=600&origin=*`);
      if (!response.ok) return null;
      const data = await response.json();
      const pages = data?.query?.pages;
      if (pages) {
        const pageId = Object.keys(pages)[0];
        if (pageId && pages[pageId]?.thumbnail?.source) {
          return pages[pageId].thumbnail.source;
        }
      }
    } catch (err) {
      console.error("Error fetching word image:", err);
    }
    return null;
  };

  const lookupVocabulary = async (word) => {
    if (!word || !word.trim()) return;
    setIsVocabLoading(true);
    setSearchedVocab(null);
    try {
      const res = await axios.post(`${API_BASE}/dictionary/lookup`, { word: word.trim() });
      const imageUrl = await fetchWordImage(word.trim());
      setSearchedVocab({ ...res.data, imageUrl });
    } catch (e) {
      console.error("Error looking up vocabulary: ", e);
    } finally {
      setIsVocabLoading(false);
    }
  };

  const saveVocabulary = async (wordData) => {
    try {
      const res = await axios.post(`${API_BASE}/vocabulary/save`, wordData, authHeaders);
      setSavedVocab(prev => [res.data, ...prev]);
    } catch (e) {
      console.error("Error saving word: ", e);
    }
  };

  const deleteVocabulary = async (word) => {
    try {
      await axios.delete(`${API_BASE}/vocabulary/${word}`, authHeaders);
      setSavedVocab(prev => prev.filter(v => v.word !== word));
    } catch (e) {
      console.error("Error deleting word: ", e);
    }
  };

  const fetchProgress = async () => {
    try {
      const res = await axios.get(`${API_BASE}/progress`, authHeaders);
      setUserStats(res.data);
    } catch (e) {
      console.error("Error fetching user progress: ", e);
    }
  };

  // --- Voice Engine ---

  const startVoiceRecording = () => {
    if (recognition) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }
      try {
        recognition.start();
      } catch (err) {
        console.log("Speech recognition already active:", err);
      }
    } else {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
    }
  };

  const stopVoiceRecording = () => {
    if (recognition) {
      try {
        recognition.stop();
      } catch (err) {
        console.log("Speech recognition stop error:", err);
      }
    }
  };

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[*#`_\-]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voices = window.speechSynthesis.getVoices();
      const engVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || 
                       voices.find(v => v.lang.startsWith('en')) || 
                       voices[0];
      
      if (engVoice) utterance.voice = engVoice;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        if (voiceCallModeRef.current) {
          setTimeout(() => {
            if (voiceCallModeRef.current) {
              startVoiceRecording();
            }
          }, 600);
        }
      };
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } else {
      const audio = new Audio(`${API_BASE}/tts?text=${encodeURIComponent(text)}`);
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        if (voiceCallModeRef.current) {
          setTimeout(() => {
            if (voiceCallModeRef.current) {
              startVoiceRecording();
            }
          }, 600);
        }
      };
      audio.onerror = () => setIsSpeaking(false);
      audio.play();
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const startVoiceCall = () => {
    setShowVoiceCallMode(true);
    const greeting = "Connected. Welcome to your holographic AI voice session! I am listening. Speak freely, and let's practice your English conversation.";
    
    // Add AI welcoming message to subtitles
    const tempAiMsg = {
      id: Date.now(),
      session_id: currentSessionId,
      sender: "ai",
      text: greeting,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempAiMsg]);
    
    setTimeout(() => {
      speakText(greeting);
    }, 600);
  };

  const stopVoiceCall = () => {
    setShowVoiceCallMode(false);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    stopVoiceRecording();
  };

  // --- Mock Practice Quiz Actions ---

  const generateQuiz = async () => {
    setIsQuizLoading(true);
    setUserAnswers({});
    setCurrentQuestionIdx(0);
    try {
      const res = await axios.get(`${API_BASE}/quiz/generate?level=${quizLevel}`, authHeaders);
      setQuizQuestions(res.data);
      setQuizStep("active");
    } catch (e) {
      console.error("Error generating quiz:", e);
    } finally {
      setIsQuizLoading(false);
    }
  };

  const selectAnswer = (ans) => {
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestionIdx]: ans
    }));
  };

  const submitQuiz = async () => {
    try {
      const res = await axios.post(`${API_BASE}/quiz/submit`, {}, authHeaders);
      setUserStats(res.data);
      setQuizStep("results");
    } catch (e) {
      console.error("Error logging quiz scorecard:", e);
    }
  };

  // --- Inline word highlighter for user messages ---

  const renderCorrectedUserText = (msg) => {
    if (!msg.corrected_text || !msg.grammar_data) {
      return <p className="text-sm md:text-base leading-relaxed text-slate-100">{msg.text}</p>;
    }

    try {
      const corrections = JSON.parse(msg.grammar_data);
      let text = msg.text;
      const sortedCorrections = [...corrections].sort((a, b) => b.error.length - a.error.length);

      let elements = [];
      let lastIndex = 0;

      sortedCorrections.forEach((corr, idx) => {
        const errorText = corr.error;
        const startIdx = text.toLowerCase().indexOf(errorText.toLowerCase());
        
        if (startIdx !== -1) {
          if (startIdx > lastIndex) {
            elements.push(<span key={`text-${idx}`}>{text.substring(lastIndex, startIdx)}</span>);
          }
          
          elements.push(
            <span 
              key={`corr-${idx}`} 
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setActiveCorrection({
                  error: corr.error,
                  replacement: corr.replacement,
                  explanation: corr.explanation,
                  x: rect.left,
                  y: rect.top - 120
                });
              }}
              className="correction-word-highlight font-bold"
            >
              {text.substring(startIdx, startIdx + errorText.length)}
            </span>
          );
          
          lastIndex = startIdx + errorText.length;
        }
      });

      if (lastIndex < text.length) {
        elements.push(<span key="text-end">{text.substring(lastIndex)}</span>);
      }

      return (
        <div className="text-sm md:text-base leading-relaxed text-slate-100">
          <p>{elements.length > 0 ? elements : msg.text}</p>
          <div className="mt-2 text-[11px] text-red-300 flex items-center gap-1.5 opacity-90 border-t border-red-500/10 pt-1.5">
            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Grammar error identified. Tap highlighted word(s) for details.</span>
          </div>
        </div>
      );
    } catch (e) {
      return <p className="text-sm md:text-base leading-relaxed text-slate-100">{msg.text}</p>;
    }
  };

  return (
    <div className="min-h-screen bg-cyber-gradient flex text-slate-200 font-sans overflow-hidden">
      
      {/* 1. LEFT SIDEBAR */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="flex-shrink-0 border-r border-white/5 glass-card flex flex-col z-20"
          >
            {/* Sidebar Logo */}
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <span className="font-extrabold text-lg bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                  English<span className="text-indigo-400">AI</span>
                </span>
              </div>
              <button 
                onClick={onBack}
                className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Quick stats mini widget */}
            <div className="p-3 mx-4 my-3 rounded-xl bg-gradient-to-br from-indigo-900/10 to-purple-900/10 border border-indigo-500/5 flex items-center justify-around">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-orange-400">
                  <Flame className="w-4 h-4 fill-orange-400 animate-pulse" />
                  <span className="font-black text-sm">{userStats.streak}</span>
                </div>
                <span className="text-[9px] text-slate-400 uppercase font-semibold">Streak</span>
              </div>
              <div className="w-[1px] h-6 bg-white/5"></div>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-indigo-400">
                  <Trophy className="w-4 h-4" />
                  <span className="font-black text-sm">{userStats.xp}</span>
                </div>
                <span className="text-[9px] text-slate-400 uppercase font-semibold">XP</span>
              </div>
              <div className="w-[1px] h-6 bg-white/5"></div>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-black text-sm">{userStats.grammar_accuracy}%</span>
                </div>
                <span className="text-[9px] text-slate-400 uppercase font-semibold">Accuracy</span>
              </div>
            </div>

            {/* Premium Multi-Tab Grid (4 Grid Tabs) */}
            <div className="px-4 grid grid-cols-2 gap-1 mb-4">
              <button 
                onClick={() => setActiveTab("chat")}
                className={`py-2 rounded-lg text-[10px] font-bold tracking-wider transition ${activeTab === 'chat' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-900/40 border border-white/5 text-slate-400 hover:text-slate-200'}`}
              >
                1. TUTOR CHAT
              </button>
              <button 
                onClick={() => setActiveTab("vocabulary")}
                className={`py-2 rounded-lg text-[10px] font-bold tracking-wider transition ${activeTab === 'vocabulary' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-900/40 border border-white/5 text-slate-400 hover:text-slate-200'}`}
              >
                2. DICTIONARY
              </button>
              <button 
                onClick={() => {
                  fetchProgress();
                  setActiveTab("progress");
                }}
                className={`py-2 rounded-lg text-[10px] font-bold tracking-wider transition ${activeTab === 'progress' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-900/40 border border-white/5 text-slate-400 hover:text-slate-200'}`}
              >
                3. DASHBOARD
              </button>
              <button 
                onClick={() => setActiveTab("practice")}
                className={`py-2 rounded-lg text-[10px] font-bold tracking-wider transition ${activeTab === 'practice' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-900/40 border border-white/5 text-slate-400 hover:text-slate-200'}`}
              >
                4. MOCK TEST
              </button>
            </div>

            {/* Sidebar scrolling body */}
            <div className="flex-1 overflow-y-auto p-4 pt-1 space-y-6 border-t border-white/5">
              
              {/* CHAT TAB PANEL */}
              {activeTab === "chat" && (
                <>
                  <div className="space-y-2">
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest pl-1">Practice Scenarios</span>
                    <div className="flex flex-col gap-1.5">
                      {[
                        { mode: "free_chat", label: "Casual Talk", desc: "Speak freely about any topic" },
                        { mode: "interview", label: "Job Interview", desc: "Formal career drills" },
                        { mode: "restaurant", label: "At the Bistro", desc: "Ordering food roleplay" },
                        { mode: "airport", label: "Airport Desk", desc: "Boarding passport checks" }
                      ].map((item) => (
                        <button
                          key={item.mode}
                          onClick={() => createNewSession(item.mode)}
                          className={`w-full text-left p-2.5 rounded-xl border transition ${currentMode === item.mode ? 'bg-indigo-600/10 border-indigo-500/50 shadow' : 'bg-slate-900/20 border-white/5 hover:border-slate-800'}`}
                        >
                          <div className="font-bold text-xs text-white flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${currentMode === item.mode ? 'bg-indigo-400' : 'bg-slate-500'}`}></span>
                            {item.label}
                          </div>
                          <div className="text-[9px] text-slate-400 mt-0.5 truncate">{item.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between items-center pl-1">
                      <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest">Conversations</span>
                      <button 
                        onClick={() => createNewSession("free_chat")}
                        className="p-1 rounded bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 transition"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto">
                      {sessions.map((sess) => (
                        <div
                          key={sess.id}
                          onClick={() => {
                            setCurrentSessionId(sess.id);
                            setCurrentMode(sess.mode);
                          }}
                          className={`group w-full p-2 rounded-xl border text-left flex justify-between items-center cursor-pointer transition ${currentSessionId === sess.id ? 'bg-white/5 border-white/10' : 'border-transparent hover:bg-white/5'}`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <MessageSquare className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                            <span className="text-xs text-slate-200 font-medium truncate">{sess.title}</span>
                          </div>
                          <button
                            onClick={(e) => deleteSession(sess.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* DICTIONARY TAB PANEL */}
              {activeTab === "vocabulary" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest">Dictionary Finder</span>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={vocabSearchText}
                        onChange={(e) => setVocabSearchText(e.target.value)}
                        placeholder="e.g. 'fluent'" 
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs focus:border-indigo-500 outline-none text-white font-medium"
                      />
                      <button 
                        onClick={() => lookupVocabulary(vocabSearchText)}
                        className="px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition"
                      >
                        Search
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest">Saved Words ({savedVocab.length})</span>
                    {savedVocab.length === 0 ? (
                      <div className="text-center py-6 text-slate-500 text-xs">
                        No words saved yet. Search and click 'Save Word' to record vocabulary.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5 max-h-[250px] overflow-y-auto">
                        {savedVocab.map((item) => (
                          <div 
                            key={item.id}
                            onClick={() => lookupVocabulary(item.word)}
                            className="group p-2 rounded-xl bg-slate-900/40 border border-white/5 hover:border-indigo-500/20 cursor-pointer flex justify-between items-center transition"
                          >
                            <div>
                              <div className="font-extrabold text-xs text-indigo-300">{item.word}</div>
                              <div className="text-[9px] text-slate-500 italic">{item.part_of_speech}</div>
                            </div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteVocabulary(item.word);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(activeTab === "progress" || activeTab === "practice") && (
                <div className="p-4 rounded-xl bg-indigo-950/10 border border-indigo-500/10 text-xs text-indigo-300 leading-relaxed font-semibold">
                  🚀 Use the central panel to review study analytics and participate in Mock Quizzes!
                </div>
              )}

            </div>

            {/* Profile Footer */}
            <div className="p-4 border-t border-white/5 bg-slate-950/40 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="text-xs font-bold text-white truncate capitalize">{user.username}</div>
                <div className="text-[9px] text-slate-500 tracking-wider font-semibold uppercase mt-0.5">Active Student</div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* 2. MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col relative h-screen overflow-hidden">
        
        {/* Header */}
        <header className="p-4 border-b border-white/5 glass-card flex justify-between items-center relative z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg bg-slate-900 border border-white/5 text-slate-400 hover:text-white transition"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div>
              <h2 className="font-black text-sm text-white tracking-wide uppercase flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-indigo-400" />
                English Tutor Module
              </h2>
              <p className="text-[10px] text-indigo-300 font-semibold mt-0.5">
                {activeTab === "chat" && `Mode: Conversation (${currentMode})`}
                {activeTab === "vocabulary" && "Mode: Vocabulary & Dictionary assistant"}
                {activeTab === "progress" && "Mode: Full Analytics Dashboard"}
                {activeTab === "practice" && "Mode: Mock Practice English Exam"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === "chat" && (
              <button
                onClick={startVoiceCall}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-95 text-white font-bold text-xs tracking-wider transition shadow shadow-indigo-500/15 hover:shadow-indigo-500/30 flex items-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0 animate-pulse"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Voice Call</span>
              </button>
            )}

            <button
              onClick={() => setIsAutoplayTts(!isAutoplayTts)}
              className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 transition ${isAutoplayTts ? 'bg-indigo-600/10 border-indigo-500/40 text-indigo-300' : 'bg-slate-900/40 border-white/5 text-slate-400'}`}
            >
              {isAutoplayTts ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline font-bold">AutoVoice</span>
            </button>

            <span className="px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] font-bold text-green-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"></span>
              Online
            </span>
          </div>
        </header>

        {/* --- VIEW 1: TUTOR CHAT (activeTab === "chat") --- */}
        {activeTab === "chat" && (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            
            {/* IMMERSIVE VOICE CALL OVERLAY */}
            <AnimatePresence>
              {showVoiceCallMode && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                  className="absolute inset-0 bg-slate-950/95 backdrop-blur-2xl z-40 flex overflow-hidden border-t border-white/5 animate-pulse-slow"
                >
                  {/* Glowing neon bg spots */}
                  <div className="absolute top-[20%] left-[30%] w-[300px] h-[300px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none animate-pulse-slow"></div>
                  <div className="absolute bottom-[20%] right-[30%] w-[350px] h-[350px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow"></div>

                  {/* MAIN AVATAR CENTER AREA */}
                  <div className="flex-1 flex flex-col items-center justify-between p-8 relative">
                    
                    {/* Header Controls inside Call */}
                    <div className="w-full flex justify-between items-center relative z-10">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping"></span>
                        <span className="text-[10px] uppercase font-black tracking-widest text-green-400">CALL ACTIVE</span>
                      </div>
                      
                      <button
                        onClick={() => setShowVoiceSubtitles(!showVoiceSubtitles)}
                        className={`px-4 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-2 ${showVoiceSubtitles ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300' : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-white'}`}
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>{showVoiceSubtitles ? 'Hide Subtitles' : 'Show Subtitles'}</span>
                      </button>
                    </div>

                    {/* Central Holographic Orb Avatar */}
                    <div className="flex-1 flex flex-col items-center justify-center space-y-8 relative">
                      
                      {/* Interactive Visual Core */}
                      <div className="relative w-72 h-72 flex items-center justify-center">
                        
                        {/* Pulse Ring Wave (Only visible when Listening) */}
                        <AnimatePresence>
                          {isDictating && (
                            <motion.div
                              initial={{ scale: 0.8, opacity: 0.8 }}
                              animate={{ scale: 1.5, opacity: 0 }}
                              exit={{ scale: 0.8, opacity: 0 }}
                              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                              className="absolute inset-0 rounded-full bg-pink-500/10 border border-pink-500/30"
                            ></motion.div>
                          )}
                        </AnimatePresence>

                        {/* Speaking Concentric Ring Wave (Only visible when Speaking) */}
                        <AnimatePresence>
                          {isSpeaking && (
                            <motion.div
                              initial={{ scale: 0.9, opacity: 0.9 }}
                              animate={{ scale: 1.35, opacity: 0 }}
                              exit={{ scale: 0.9, opacity: 0 }}
                              transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
                              className="absolute inset-0 rounded-full bg-blue-500/10 border border-blue-500/30"
                            ></motion.div>
                          )}
                        </AnimatePresence>

                        {/* Dashed Outer Ring */}
                        <div className={`absolute inset-0 rounded-full border border-dashed transition-all duration-700 ${isDictating ? 'border-pink-500/20 animate-spin-slow' : isSpeaking ? 'border-cyan-500/20 animate-spin-slow' : 'border-indigo-500/10 animate-spin-slow'}`}></div>

                        {/* Reverse Dotted Middle Ring */}
                        <div className={`absolute w-56 h-56 rounded-full border border-dotted transition-all duration-700 ${isDictating ? 'border-pink-500/30 animate-spin-reverse' : isSpeaking ? 'border-cyan-500/30 animate-spin-reverse' : 'border-purple-500/15 animate-spin-reverse'}`}></div>

                        {/* Inner Core */}
                        <div
                          className={`relative w-40 h-40 rounded-full flex items-center justify-center border shadow-2xl transition-all duration-700 ${
                            isDictating 
                              ? 'bg-pink-500/10 border-pink-400/40 shadow-pink-500/25 scale-105' 
                              : isSpeaking 
                                ? 'bg-cyan-500/10 border-cyan-400/40 shadow-cyan-500/25 scale-105' 
                                : isLoading 
                                  ? 'bg-indigo-500/10 border-indigo-400/40 shadow-indigo-500/20 animate-pulse'
                                  : 'bg-gradient-to-br from-indigo-950/40 to-purple-950/40 border-white/10 shadow-indigo-500/10 shadow-lg'
                          }`}
                        >
                          <div className={`absolute w-12 h-12 rounded-full blur-xl transition-all duration-700 ${isDictating ? 'bg-pink-400 animate-pulse' : isSpeaking ? 'bg-cyan-400 animate-pulse' : isLoading ? 'bg-blue-400 animate-pulse' : 'bg-indigo-500/40'}`}></div>
                          
                          {isLoading && (
                            <div className="absolute inset-0 rounded-full border-t-2 border-r-2 border-indigo-400 animate-spin"></div>
                          )}

                          {isSpeaking && (
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <div
                                  key={i}
                                  className="w-1 bg-cyan-400 rounded-full animate-bounce"
                                  style={{
                                    height: '24px',
                                    animationDuration: `${0.4 + i * 0.15}s`,
                                    animationIterationCount: 'infinite',
                                    animationDirection: 'alternate'
                                  }}
                                ></div>
                              ))}
                            </div>
                          )}

                          {isDictating && (
                            <Mic className="w-8 h-8 text-pink-400 animate-pulse" />
                          )}

                          {!isSpeaking && !isDictating && !isLoading && (
                            <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse" />
                          )}
                        </div>

                      </div>

                      {/* State Description */}
                      <div className="text-center space-y-1">
                        <h4 className="font-extrabold text-lg text-white tracking-wide">
                          {isDictating ? 'Tutor is Listening...' : isSpeaking ? 'Tutor is Speaking...' : isLoading ? 'Tutor is Thinking...' : 'Voice Connection Active'}
                        </h4>
                        <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest animate-pulse">
                          {isDictating ? 'Speak clearly now' : isSpeaking ? 'Listen carefully' : isLoading ? 'Processing speech grammar' : 'Speak to start practicing'}
                        </p>
                      </div>

                    </div>

                    {/* Bottom Call Controls Panel */}
                    <div className="flex items-center gap-6 relative z-10 pb-4">
                      
                      <button
                        onClick={isDictating ? stopVoiceRecording : startVoiceRecording}
                        className={`p-4 rounded-full border transition hover:scale-105 active:scale-98 ${isDictating ? 'bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/20 mic-pulse-active' : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white hover:border-slate-800'}`}
                        title={isDictating ? 'Mute Mic' : 'Unmute Mic'}
                      >
                        {isDictating ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                      </button>

                      <button
                        onClick={stopVoiceCall}
                        className="px-6 py-3.5 rounded-full bg-gradient-to-r from-red-600 to-pink-600 hover:opacity-95 text-white font-bold text-xs tracking-wider transition shadow-lg shadow-red-600/35 hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
                      >
                        <VolumeX className="w-4 h-4" />
                        <span>DISCONNECT CALL</span>
                      </button>

                    </div>

                  </div>

                  {/* SIDE SLIDING SUBTITLE TRANSCRIPT DRAWER */}
                  <AnimatePresence>
                    {showVoiceSubtitles && (
                      <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 380, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="flex-shrink-0 border-l border-white/5 bg-slate-950/80 backdrop-blur-xl flex flex-col relative"
                      >
                        <div className="p-5 border-b border-white/5 flex items-center justify-between">
                          <span className="text-[10px] uppercase font-black tracking-widest text-indigo-400">Live Subtitles Feed</span>
                          <button
                            onClick={() => setShowVoiceSubtitles(false)}
                            className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[calc(100vh-140px)]">
                          {messages.length === 0 ? (
                            <div className="text-center py-12 text-slate-500 text-xs">
                              Transcript is empty. Start speaking to populate subtitles.
                            </div>
                          ) : (
                            messages.map((msg) => {
                              const isUser = msg.sender === 'user';
                              return (
                                <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`p-3 rounded-2xl text-xs border max-w-[90%] ${isUser ? 'bg-indigo-600/10 border-indigo-500/25 rounded-tr-none' : 'bg-slate-900 border-white/5 rounded-tl-none'}`}>
                                    <div className="flex justify-between items-center mb-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                      <span>{isUser ? 'You' : 'Tutor'}</span>
                                      {!isUser && (
                                        <button onClick={() => speakText(msg.text)} className="p-0.5 rounded hover:bg-white/5 text-slate-400 hover:text-white">
                                          <Volume2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                    {isUser ? renderCorrectedUserText(msg) : (
                                      <p className="leading-relaxed text-slate-200">{msg.text}</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                          <div ref={chatEndRef}></div>
                        </div>

                      </motion.div>
                    )}
                  </AnimatePresence>

                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950/10">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center text-center max-w-sm mx-auto space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center animate-bounce">
                    <Sparkles className="w-8 h-8 text-indigo-400" />
                  </div>
                  <h3 className="font-extrabold text-white text-lg">Start speaking or writing!</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Type an English sentence or click the glowing microphone below to dictate your thoughts. I will analyze your grammar and respond!
                  </p>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto space-y-6 pb-12">
                  {messages.map((msg) => {
                    const isUser = msg.sender === 'user';
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className="flex gap-3 max-w-[85%] sm:max-w-[75%] items-start">
                          {!isUser && (
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center p-1.5 border border-white/10 flex-shrink-0 shadow-lg mt-0.5">
                              <Sparkles className="w-full h-full text-white" />
                            </div>
                          )}

                          <div className={`p-4 rounded-2xl border ${isUser ? 'bg-indigo-600/10 border-indigo-500/25 rounded-tr-none' : 'bg-slate-900 border-white/5 rounded-tl-none shadow-xl'}`}>
                            <div className="flex justify-between items-center mb-1.5">
                              <span className={`text-[10px] font-extrabold uppercase tracking-wider ${isUser ? 'text-indigo-300' : 'text-slate-400'}`}>
                                {isUser ? 'Student' : 'English Tutor'}
                              </span>
                              {!isUser && (
                                <button
                                  onClick={() => speakText(msg.text)}
                                  className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white transition"
                                >
                                  <Volume2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            {isUser ? renderCorrectedUserText(msg) : (
                              <p className="text-sm md:text-base leading-relaxed text-slate-100 whitespace-pre-wrap">{msg.text}</p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="flex gap-3 items-center">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center p-1.5 border border-white/10 flex-shrink-0 shadow-lg">
                          <Sparkles className="w-full h-full text-white animate-spin-slow" />
                        </div>
                        <div className="p-3.5 rounded-2xl bg-slate-900 border border-white/5 rounded-tl-none flex items-center shadow-lg">
                          <div className="typing-indicator flex items-center">
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef}></div>
                </div>
              )}
            </div>

            {/* GRAMMAR ERROR POPUP */}
            <AnimatePresence>
              {activeCorrection && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="fixed z-50 p-5 rounded-2xl glass-card border border-red-500/30 max-w-sm shadow-2xl backdrop-blur-xl"
                  style={{ left: `clamp(16px, ${activeCorrection.x}px, calc(100vw - 420px))`, top: `clamp(16px, ${activeCorrection.y}px, calc(100vh - 350px))` }}
                >
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-1.5 text-red-400 font-extrabold text-xs">
                      <ShieldAlert className="w-4 h-4" />
                      <span>GRAMMAR REVISION</span>
                    </div>
                    <button onClick={() => setActiveCorrection(null)} className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white transition">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                        <div className="text-[10px] text-red-400 uppercase font-semibold">Original</div>
                        <div className="text-sm font-bold text-slate-300 line-through mt-0.5">{activeCorrection.error}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                      <div className="flex-1 p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                        <div className="text-[10px] text-green-400 uppercase font-semibold">Suggested</div>
                        <div className="text-sm font-bold text-white mt-0.5">{activeCorrection.replacement}</div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-3 rounded-lg border border-white/5">
                      <span className="font-semibold text-slate-400 block mb-1">Tutor Explanation:</span>
                      {activeCorrection.explanation}
                    </div>

                    <button
                      onClick={() => {
                        lookupVocabulary(activeCorrection.replacement);
                        setActiveTab("vocabulary");
                        setActiveCorrection(null);
                      }}
                      className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold tracking-wide transition flex items-center justify-center gap-1.5"
                    >
                      <BookMarked className="w-3.5 h-3.5" /> Lookup Suggested Word in Dict
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Speaking Wave */}
            <AnimatePresence>
              {(isSpeaking || isDictating) && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 50, opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="w-full bg-slate-900 border-t border-white/5 flex items-center justify-center gap-1 px-4 py-2 pointer-events-none"
                >
                  <span className="text-[10px] uppercase font-black text-indigo-400 tracking-widest mr-4 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isDictating ? 'bg-red-500 animate-ping' : 'bg-indigo-500 animate-ping'}`}></span>
                    {isDictating ? "Listening..." : "Speaking..."}
                  </span>
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 bg-gradient-to-t ${isDictating ? 'from-red-500 to-pink-500' : 'from-blue-500 to-indigo-500'} rounded-full`}
                      style={{
                        height: `${15 + Math.random() * 25}px`,
                        animation: `bounce 0.6s infinite ease-in-out alternate`,
                        animationDelay: `${i * 0.05}s`
                      }}
                    ></div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Inputs Panel */}
            <footer className="p-4 border-t border-white/5 glass-card">
              <div className="max-w-4xl mx-auto flex items-center gap-3">
                <button
                  onClick={isDictating ? stopVoiceRecording : startVoiceRecording}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center border transition flex-shrink-0 shadow-lg ${isDictating ? 'bg-red-500 border-red-400 text-white mic-pulse-active' : 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700 shadow shadow-indigo-500/20'}`}
                >
                  {isDictating ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 animate-pulse" />}
                </button>

                <div className="flex-1 relative flex items-center">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder={isDictating ? "Listening... Speak now..." : "Type your sentence here, e.g. 'She do study English'..."}
                    disabled={isDictating}
                    className="w-full px-5 py-3.5 rounded-xl bg-slate-900 border border-white/10 focus:border-indigo-500 text-sm outline-none text-white font-medium pr-12 transition"
                  />
                  {isSpeaking && (
                    <button
                      onClick={stopSpeaking}
                      className="absolute right-3 p-2 rounded-lg bg-slate-950 border border-white/5 text-slate-400 hover:text-white transition"
                    >
                      <VolumeX className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <button
                  onClick={sendMessage}
                  disabled={!inputText.trim() || isLoading}
                  className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 disabled:opacity-50 text-white font-semibold text-sm transition flex-shrink-0 shadow"
                >
                  Send
                </button>
              </div>
            </footer>
          </div>
        )}

        {/* --- VIEW 2: DICTIONARY PLACEHOLDER --- */}
        {activeTab === "vocabulary" && !searchedVocab && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <BookOpen className="w-8 h-8" />
            </div>
            <h3 className="font-extrabold text-white text-lg">AI Dictionary Assistant</h3>
            <p className="text-slate-400 text-xs max-w-sm leading-relaxed">
              Use the sidebar search bar to lookup word explanations, synonyms, antonyms, parts of speech, and pronunciations immediately.
            </p>
          </div>
        )}

        {/* --- VIEW 3: FULL PROGRESS ANALYTICS DASHBOARD --- */}
        {activeTab === "progress" && (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-950/10">
            <div className="max-w-5xl mx-auto space-y-8">
              
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight">Learning Dashboard</h3>
                  <p className="text-xs text-indigo-400 font-semibold mt-1">Real-time statistics and analytics for {user.username}</p>
                </div>
                <span className="text-xs bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  Study Goal Active
                </span>
              </div>

              {/* Grid of stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl glass-card border border-white/5 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-center text-orange-400">
                    <Flame className="w-5 h-5 fill-orange-400" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Day Streak</div>
                    <div className="text-2xl font-black text-white mt-1">{userStats.streak} Days</div>
                  </div>
                </div>

                <div className="p-5 rounded-2xl glass-card border border-white/5 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Total Experience</div>
                    <div className="text-2xl font-black text-white mt-1">{userStats.xp} XP</div>
                  </div>
                </div>

                <div className="p-5 rounded-2xl glass-card border border-white/5 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/25 flex items-center justify-center text-green-400">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Grammar Accuracy</div>
                    <div className="text-2xl font-black text-white mt-1">{userStats.grammar_accuracy}%</div>
                  </div>
                </div>

                <div className="p-5 rounded-2xl glass-card border border-white/5 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Time Practiced</div>
                    <div className="text-2xl font-black text-white mt-1">{userStats.time_spent} Mins</div>
                  </div>
                </div>
              </div>

              {/* Study Time Goal Tracker & Suggestions */}
              <div className="grid md:grid-cols-3 gap-6">
                
                {/* Daily Study Goal */}
                <div className="p-6 rounded-2xl glass-card border border-white/5 md:col-span-2 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-extrabold text-sm text-white tracking-wide uppercase">Daily Study Goal Completion</h4>
                    <span className="text-xs text-indigo-400 font-bold">Goal: 15 Mins</span>
                  </div>
                  
                  <div className="w-full bg-slate-900 h-4 rounded-full overflow-hidden border border-white/5 p-0.5">
                    <div 
                      className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (userStats.time_spent / 15) * 100)}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Progress: {userStats.time_spent} mins studied today</span>
                    <span className="text-indigo-300 font-bold">
                      {userStats.time_spent >= 15 ? "Daily Goal Achieved! 🌟" : `${Math.round((userStats.time_spent / 15) * 100)}% Completed`}
                    </span>
                  </div>

                  <div className="p-3 bg-indigo-950/15 border border-indigo-500/10 rounded-xl text-[11px] text-indigo-300 leading-relaxed">
                    💡 **Time Tracking System active**: Keep this page open while you write or speak. Every 60 seconds pings the server, logging your active learning time and rewarding you **+5 XP** per minute!
                  </div>
                </div>

                {/* Tutor Suggestions */}
                <div className="p-6 rounded-2xl glass-card border border-purple-500/20 bg-purple-950/5 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-purple-400 font-extrabold text-xs">
                      <Award className="w-4.5 h-4.5" />
                      <span>TUTOR INSIGHTS</span>
                    </div>
                    <h5 className="font-bold text-sm text-white mt-2">English Fluency Index</h5>
                    <p className="text-slate-300 text-xs leading-relaxed mt-2 font-medium">
                      {userStats.grammar_accuracy < 80.0 && "Your accuracy score is growing. Focus on practicing simple tenses (went, goes, bought) and take Beginner grammar tests."}
                      {userStats.grammar_accuracy >= 80.0 && userStats.grammar_accuracy < 95.0 && "Your tenses are strong! Challenge yourself with job interview dialogs, advanced scenarios, and Intermediate quizzes."}
                      {userStats.grammar_accuracy >= 95.0 && "Magnificent fluency score! You are speak English extremely naturally. Practice subjunctive clauses and write long-form essays."}
                    </p>
                  </div>

                  <div className="border-t border-white/5 pt-3.5 mt-4 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Mock Tests Taken:</span>
                    <span className="font-black text-white">{userStats.quizzes_completed} Completed</span>
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

        {/* --- VIEW 4: INTERACTIVE MOCK PRACTICE (activeTab === "practice") --- */}
        {activeTab === "practice" && (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-950/10 flex items-center justify-center">
            <div className="w-full max-w-2xl">
              
              {/* STEP 1: Quiz selector */}
              {quizStep === "select" && (
                <div className="glass-card border border-white/5 rounded-3xl p-8 space-y-6 text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/5 via-indigo-900/5 to-purple-900/5 pointer-events-none"></div>
                  
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mx-auto animate-pulse">
                    <BookOpenCheck className="w-8 h-8 text-indigo-400" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-white">English Practice Quiz</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Test your English levels with a 5-question multiple choice grammar test. Earn **+50 XP** on completion!
                    </p>
                  </div>

                  {/* Level grid selectors */}
                  <div className="grid grid-cols-3 gap-3 pt-3">
                    {[
                      { level: "beginner", title: "Beginner", desc: "Basic verbs & articles" },
                      { level: "intermediate", title: "Intermediate", desc: "Conditionals & tenses" },
                      { level: "advanced", title: "Advanced", desc: "Subjunctives & vocabulary" }
                    ].map((item) => (
                      <button
                        key={item.level}
                        onClick={() => setQuizLevel(item.level)}
                        className={`p-4 rounded-2xl border text-center transition flex flex-col justify-center items-center ${quizLevel === item.level ? 'bg-indigo-600/10 border-indigo-500/50 shadow shadow-indigo-500/10' : 'bg-slate-900/20 border-white/5 hover:border-slate-800'}`}
                      >
                        <span className="font-extrabold text-sm text-white capitalize">{item.title}</span>
                        <span className="text-[9px] text-slate-400 mt-1">{item.desc}</span>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={generateQuiz}
                    disabled={isQuizLoading}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-95 text-white font-bold text-sm tracking-wide transition shadow-lg shadow-indigo-500/25"
                  >
                    {isQuizLoading ? "Generating AI Quiz..." : "Start Practice Quiz"}
                  </button>
                </div>
              )}

              {/* STEP 2: ACTIVE QUIZ */}
              {quizStep === "active" && quizQuestions.length > 0 && (
                <div className="glass-card border border-white/5 rounded-3xl p-8 space-y-6">
                  
                  <div className="flex justify-between items-center text-xs border-b border-white/5 pb-4">
                    <span className="font-black text-indigo-400 uppercase tracking-widest">Mock Quiz ({quizLevel})</span>
                    <span className="font-bold text-slate-400">Question {currentQuestionIdx + 1} of 5</span>
                  </div>

                  {/* Question Banner */}
                  <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/5 text-center">
                    <p className="text-base text-white font-semibold leading-relaxed">
                      {quizQuestions[currentQuestionIdx].question}
                    </p>
                  </div>

                  {/* Options list */}
                  <div className="flex flex-col gap-3">
                    {quizQuestions[currentQuestionIdx].choices.map((choice, idx) => {
                      const isSelected = userAnswers[currentQuestionIdx] === choice;
                      return (
                        <button
                          key={idx}
                          onClick={() => selectAnswer(choice)}
                          className={`w-full text-left p-4 rounded-xl border text-xs font-semibold transition ${isSelected ? 'bg-indigo-600 border-indigo-500 text-white shadow shadow-indigo-500/20' : 'bg-slate-900 border-white/5 hover:border-slate-800 text-slate-300'}`}
                        >
                          <span className="mr-3 font-extrabold opacity-75">{String.fromCharCode(65 + idx)}.</span>
                          {choice}
                        </button>
                      );
                    })}
                  </div>

                  {/* Navigators footer */}
                  <div className="flex justify-between items-center pt-2">
                    <button
                      disabled={currentQuestionIdx === 0}
                      onClick={() => setCurrentQuestionIdx(prev => prev - 1)}
                      className="px-5 py-2.5 rounded-xl border border-white/5 bg-slate-900/40 text-slate-400 hover:text-white transition disabled:opacity-40 text-xs font-semibold"
                    >
                      Previous
                    </button>

                    {currentQuestionIdx < 4 ? (
                      <button
                        disabled={!userAnswers[currentQuestionIdx]}
                        onClick={() => setCurrentQuestionIdx(prev => prev + 1)}
                        className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-40 text-xs font-semibold"
                      >
                        Next Question
                      </button>
                    ) : (
                      <button
                        disabled={Object.keys(userAnswers).length < 5}
                        onClick={submitQuiz}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white transition disabled:opacity-40 text-xs font-semibold shadow"
                      >
                        Finish & Submit
                      </button>
                    )}
                  </div>

                </div>
              )}

              {/* STEP 3: SCORECARD */}
              {quizStep === "results" && (
                <div className="glass-card border border-white/5 rounded-3xl p-8 space-y-6">
                  
                  <div className="text-center space-y-2 pb-4 border-b border-white/5">
                    <h3 className="text-2xl font-black text-white">Quiz Scorecard</h3>
                    <div className="text-4xl font-extrabold text-indigo-400 mt-1">
                      {Object.keys(userAnswers).filter(idx => userAnswers[idx] === quizQuestions[idx].correct_answer).length} / 5
                    </div>
                    <p className="text-[11px] text-green-400 font-bold uppercase tracking-wider animate-bounce mt-1">
                      🎉 Completed! +50 XP Points Rewarded
                    </p>
                  </div>

                  {/* Explanations list */}
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                    {quizQuestions.map((q, idx) => {
                      const ans = userAnswers[idx];
                      const isCorrect = ans === q.correct_answer;
                      return (
                        <div key={idx} className="p-4 rounded-2xl bg-slate-900/40 border border-white/5 space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-extrabold text-slate-400">Question #{idx + 1}</span>
                            <span className={`font-bold uppercase tracking-wide px-2 py-0.5 rounded text-[10px] ${isCorrect ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                              {isCorrect ? "Correct" : "Incorrect"}
                            </span>
                          </div>

                          <p className="text-xs text-white font-semibold leading-relaxed mt-1">
                            {q.question}
                          </p>

                          <div className="grid grid-cols-2 gap-2 text-[11px] py-1">
                            <div className="p-2 rounded bg-slate-950/40 border border-white/5">
                              <span className="text-slate-500 block">Your Answer:</span>
                              <span className={`font-semibold ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>{ans}</span>
                            </div>
                            <div className="p-2 rounded bg-slate-950/40 border border-white/5">
                              <span className="text-slate-500 block">Correct Answer:</span>
                              <span className="font-semibold text-green-400">{q.correct_answer}</span>
                            </div>
                          </div>

                          <div className="p-3 rounded-lg bg-indigo-950/10 border border-indigo-500/10 text-[10px] text-indigo-300 leading-relaxed font-semibold">
                            <span className="font-black text-indigo-400 block mb-0.5">Tutor Explanation:</span>
                            {q.explanation}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setQuizStep("select")}
                    className="w-full py-3.5 rounded-xl bg-slate-900 border border-white/10 hover:border-indigo-500/30 text-white font-bold text-xs tracking-wider transition"
                  >
                    Practice Again
                  </button>

                </div>
              )}

            </div>
          </div>
        )}

      </main>

      {/* 3. DICTIONARY DRAWER */}
      <AnimatePresence>
        {searchedVocab && (
          <motion.div 
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            className="w-[360px] flex-shrink-0 border-l border-white/5 glass-card flex flex-col z-30 shadow-2xl relative"
          >
            <button 
              onClick={() => setSearchedVocab(null)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition z-20"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 pt-12">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[10px] uppercase font-bold text-indigo-400">
                    {searchedVocab.part_of_speech}
                  </span>
                  <span className="text-slate-400 text-xs font-semibold">{searchedVocab.pronunciation}</span>
                </div>
                <h3 className="text-3xl font-black text-white capitalize tracking-tight mt-1">{searchedVocab.word}</h3>
              </div>

              {/* Word Visual Image Card */}
              {searchedVocab.imageUrl ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="relative group overflow-hidden rounded-2xl border border-white/10 shadow-lg w-full bg-slate-950/50 aspect-[16/10]"
                >
                  <img 
                    src={searchedVocab.imageUrl} 
                    alt={searchedVocab.word}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-85 pointer-events-none" />
                  <div className="absolute bottom-2.5 left-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/5 text-[9px] font-bold text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Visual Definition
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative overflow-hidden rounded-2xl border border-white/5 shadow-inner w-full py-8 px-4 bg-gradient-to-br from-indigo-950/20 to-purple-950/20 flex flex-col items-center justify-center text-center gap-2"
                >
                  <div className="w-11 h-11 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-base uppercase shadow-md">
                    {searchedVocab.word ? searchedVocab.word.charAt(0) : "A"}
                  </div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Abstract Definition</span>
                </motion.div>
              )}

              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block pl-0.5">Dictionary Definition</span>
                <p className="text-sm text-slate-200 leading-relaxed bg-slate-900/60 p-4 rounded-2xl border border-white/5 font-medium">
                  {searchedVocab.definition}
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest block pl-0.5">Simple Explanation</span>
                <p className="text-xs text-slate-300 leading-relaxed bg-indigo-950/20 p-4 rounded-2xl border border-indigo-500/10 font-medium">
                  {searchedVocab.explanation}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block pl-0.5">Synonyms</span>
                  <div className="flex flex-wrap gap-1">
                    {(Array.isArray(searchedVocab.synonyms) ? searchedVocab.synonyms : searchedVocab.synonyms.split(",")).map((syn, idx) => (
                      <span 
                        key={idx} 
                        onClick={() => lookupVocabulary(syn)}
                        className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-[11px] text-slate-300 hover:border-indigo-500/20 transition cursor-pointer"
                      >
                        {syn}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block pl-0.5">Antonyms</span>
                  <div className="flex flex-wrap gap-1">
                    {(Array.isArray(searchedVocab.antonyms) ? searchedVocab.antonyms : searchedVocab.antonyms.split(",")).map((ant, idx) => (
                      <span 
                        key={idx}
                        onClick={() => lookupVocabulary(ant)}
                        className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-[11px] text-slate-300 hover:border-indigo-500/20 transition cursor-pointer"
                      >
                        {ant}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block pl-0.5">Example Sentences</span>
                <div className="flex flex-col gap-2.5">
                  {(Array.isArray(searchedVocab.examples) ? searchedVocab.examples : JSON.parse(searchedVocab.examples || "[]")).map((ex, idx) => (
                    <div key={idx} className="flex gap-2 p-3 rounded-xl bg-slate-900/40 border border-white/5 relative">
                      <span className="text-indigo-400 text-xs font-black absolute top-2 right-3">#0{idx+1}</span>
                      <p className="text-xs text-slate-300 leading-relaxed pr-6 italic">"{ex}"</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                {savedVocab.some(v => v.word === searchedVocab.word.toLowerCase().strip ? searchedVocab.word.toLowerCase().strip() : searchedVocab.word.toLowerCase()) ? (
                  <button
                    onClick={() => deleteVocabulary(searchedVocab.word)}
                    className="w-full py-3 rounded-xl bg-red-600/10 border border-red-500/20 text-red-400 font-bold text-xs tracking-wider transition hover:bg-red-600/20 flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove from Saved Vocabulary
                  </button>
                ) : (
                  <button
                    onClick={() => saveVocabulary(searchedVocab)}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs tracking-wider transition flex-shrink-0 flex items-center justify-center gap-1.5"
                  >
                    <BookMarked className="w-3.5 h-3.5" /> Save Word to Dictionary
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vocabulary Loader */}
      {isVocabLoading && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="p-6 rounded-2xl glass-card flex flex-col items-center gap-3">
            <Sparkles className="w-8 h-8 text-indigo-400 animate-spin" />
            <span className="text-xs text-slate-300 font-bold">Querying AI Dictionary...</span>
          </div>
        </div>
      )}
    </div>
  );
}
