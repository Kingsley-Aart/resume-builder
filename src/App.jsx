// ============================================================================
// BEAUTIFUL RESUME BUILDER - COMPLETE WORKING VERSION
// Modern design with gradients, animations, and proper organization
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  User, LogOut, Download, Plus, Trash2, Eye, Edit3, FileText, Upload, 
  Save, Layout, CheckCircle, AlertCircle, Github, Twitter, 
  Instagram, Globe, Linkedin, X, RefreshCw, Clock, Copy, Moon, Sun,
  Sparkles, Zap, Award, Star, TrendingUp
} from 'lucide-react';
import { auth, db } from './firebase';
import { 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, 
  signOut, onAuthStateChanged, sendPasswordResetEmail 
} from 'firebase/auth';
import { 
  collection, addDoc, getDocs, updateDoc, deleteDoc, doc, 
  query, where, serverTimestamp, getDoc 
} from 'firebase/firestore';

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

const useDarkMode = () => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDark));
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return { isDark, toggleDarkMode: () => setIsDark(prev => !prev) };
};

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);
  return { toasts, showToast };
};

const useUnsavedChanges = (hasChanges) => {
  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = (phone) => /^[\d\s()+-]{10,}$/.test(phone);
const isValidUrl = (url) => { try { new URL(url); return true; } catch { return false; } };
const sanitizeHtml = (text) => { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; };
const getRelativeTime = (date) => {
  if (!date) return '';
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

const duplicateResumeData = (data) => ({
  ...data,
  personalInfo: { ...data.personalInfo, fullName: `${data.personalInfo.fullName} (Copy)` },
  education: data.education.map(e => ({...e})),
  experience: data.experience.map(e => ({...e})),
  skills: [...data.skills],
  projects: data.projects.map(p => ({...p}))
});

const getTemplateClasses = (color, isSelected) => {
  const colorMap = {
    blue: isSelected ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100' : 'border-gray-200',
    purple: isSelected ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-purple-100' : 'border-gray-200',
    green: isSelected ? 'border-green-500 bg-gradient-to-br from-green-50 to-green-100' : 'border-gray-200',
    pink: isSelected ? 'border-pink-500 bg-gradient-to-br from-pink-50 to-pink-100' : 'border-gray-200',
    orange: isSelected ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-orange-100' : 'border-gray-200',
    teal: isSelected ? 'border-teal-500 bg-gradient-to-br from-teal-50 to-teal-100' : 'border-gray-200',
  };
  return colorMap[color] || colorMap.blue;
};

// ============================================================================
// COMPONENTS
// ============================================================================

const ToastContainer = ({ toasts }) => (
  <div className="fixed top-4 right-4 z-50 space-y-2">
    {toasts.map(toast => (
      <div key={toast.id} className={`px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slideIn ${toast.type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' : toast.type === 'error' ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white' : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'}`}>
        {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
        {toast.message}
      </div>
    ))}
  </div>
);

const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn backdrop-blur-sm">
      <div className={`bg-white rounded-2xl shadow-2xl ${maxWidth} w-full p-6 animate-scaleIn`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition"><X className="w-6 h-6" /></button>
        </div>
        {children}
      </div>
    </div>
  );
};

const LandingPage = ({ onGetStarted, onLogin }) => (
  <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
    <style>{`
      @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-20px); } }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      @keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      .animate-fadeIn { animation: fadeIn 0.6s ease-out; }
      .animate-slideIn { animation: slideIn 0.3s ease-out; }
      .animate-scaleIn { animation: scaleIn 0.2s ease-out; }
      .animate-float { animation: float 3s ease-in-out infinite; }
    `}</style>
    
    <nav className="bg-white/80 backdrop-blur-lg shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">ResumeAI</span>
        </div>
        <div className="flex gap-3">
          <button onClick={onLogin} className="px-6 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition font-semibold">Login</button>
          <button onClick={onGetStarted} className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition font-semibold">Get Started</button>
        </div>
      </div>
    </nav>

    <div className="max-w-7xl mx-auto px-4 py-20">
      <div className="text-center mb-16 animate-fadeIn">
        <div className="inline-block mb-4 px-4 py-2 bg-purple-100 rounded-full">
          <span className="text-purple-600 font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            AI-Powered Resume Builder
          </span>
        </div>
        <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
          Build Your Dream Resume in Minutes
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Create professional, ATS-optimized resumes with our intelligent builder. Multiple templates, auto-save, and export to PDF.
        </p>
        <div className="flex gap-4 justify-center">
          <button onClick={onGetStarted} className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-2xl transition font-bold text-lg flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Start Building Free
          </button>
          <button className="px-8 py-4 bg-white text-purple-600 rounded-xl hover:shadow-lg transition font-bold text-lg border-2 border-purple-200">
            Watch Demo
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-20">
        {[
          { icon: Sparkles, title: 'AI Import', desc: 'Paste LinkedIn profile and we extract everything', color: 'from-purple-500 to-pink-500' },
          { icon: Layout, title: '10+ Templates', desc: 'Professional designs for every industry', color: 'from-blue-500 to-cyan-500' },
          { icon: Zap, title: 'Auto-Save', desc: 'Never lose your progress with cloud sync', color: 'from-green-500 to-emerald-500' },
        ].map((feature, i) => (
          <div key={i} className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition animate-fadeIn" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className={`w-16 h-16 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-4 animate-float`}>
              <feature.icon className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-gray-800">{feature.title}</h3>
            <p className="text-gray-600">{feature.desc}</p>
          </div>
        ))}
      </div>

      <div className="text-center">
        <div className="inline-flex items-center gap-8 bg-white rounded-2xl p-6 shadow-lg">
          {[
            { icon: Star, text: '50,000+ Users' },
            { icon: Award, text: 'ATS Optimized' },
            { icon: TrendingUp, text: '95% Success Rate' },
          ].map((stat, i) => (
            <div key={i} className="flex items-center gap-2">
              <stat.icon className="w-5 h-5 text-purple-600" />
              <span className="font-semibold text-gray-700">{stat.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// ============================================================================
// MAIN APP
// ============================================================================

const ResumeBuilder = () => {
  const { isDark, toggleDarkMode } = useDarkMode();
  const { toasts, showToast } = useToast();
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLanding, setShowLanding] = useState(true);
  const [authMode, setAuthMode] = useState('landing'); // Changed from 'login' to 'landing'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [currentView, setCurrentView] = useState('dashboard');
  const [resumes, setResumes] = useState([]);
  const [currentResume, setCurrentResume] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState('modern');
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [itemToDuplicate, setItemToDuplicate] = useState(null);
  
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [resumeData, setResumeData] = useState({
    personalInfo: { fullName: '', email: '', phone: '', location: '', linkedIn: '', github: '', twitter: '', instagram: '', website: '', summary: '' },
    education: [],
    experience: [],
    skills: [],
    projects: []
  });

  const debouncedResumeData = useDebounce(resumeData, 3000);
  useUnsavedChanges(hasUnsavedChanges && currentView === 'builder');

  const templates = useMemo(() => [
    { id: 'modern', name: 'Modern', description: 'Clean & Professional', color: 'blue' },
    { id: 'creative', name: 'Creative', description: 'Bold & Colorful', color: 'purple' },
    { id: 'minimal', name: 'Minimal', description: 'Simple & Elegant', color: 'green' },
    { id: 'professional', name: 'Professional', description: 'Corporate Style', color: 'pink' },
    { id: 'tech', name: 'Tech', description: 'Developer Focused', color: 'orange' },
    { id: 'academic', name: 'Academic', description: 'Research Oriented', color: 'teal' },
  ], []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        setShowLanding(false);
        loadResumes(currentUser.uid);
      } else {
        setShowLanding(true);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentResume && user && debouncedResumeData) autoSaveResume();
  }, [debouncedResumeData]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!isValidEmail(email)) { setAuthError('Invalid email'); return; }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setShowLanding(false);
      showToast('Welcome back!');
    } catch (error) {
      setAuthError('Invalid credentials');
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!isValidEmail(email)) { setAuthError('Invalid email'); return; }
    if (password.length < 6) { setAuthError('Password too short'); return; }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setShowLanding(false);
      showToast('Account created!');
    } catch (error) {
      setAuthError('Email already in use');
    }
  };

  const handleLogout = async () => {
    if (hasUnsavedChanges && !window.confirm('Unsaved changes. Continue?')) return;
    try {
      await signOut(auth);
      setShowLanding(true);
      setCurrentView('dashboard');
      showToast('Logged out');
    } catch (error) {
      showToast('Error logging out', 'error');
    }
  };

  const loadResumes = async (userId) => {
    try {
      const q = query(collection(db, 'resumes'), where('userId', '==', userId), where('trashed', '==', false));
      const querySnapshot = await getDocs(q);
      const list = [];
      querySnapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setResumes(list);
    } catch (error) {
      showToast('Error loading resumes', 'error');
    }
  };

  const autoSaveResume = async () => {
    if (!user || !currentResume || autoSaving) return;
    setAutoSaving(true);
    try {
      await updateDoc(doc(db, 'resumes', currentResume.id), {
        data: resumeData,
        template: selectedTemplate,
        updatedAt: serverTimestamp()
      });
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    } catch (error) {
      showToast('Autosave failed', 'error');
    }
    setAutoSaving(false);
  };

  const saveResume = async () => {
    if (!user) return;
    if (!resumeData.personalInfo.fullName.trim()) { showToast('Name required', 'error'); return; }
    if (!isValidEmail(resumeData.personalInfo.email)) { showToast('Valid email required', 'error'); return; }
    try {
      const payload = { userId: user.uid, data: resumeData, template: selectedTemplate, trashed: false, updatedAt: serverTimestamp() };
      if (currentResume) {
        await updateDoc(doc(db, 'resumes', currentResume.id), payload);
        showToast('Updated!');
      } else {
        const docRef = await addDoc(collection(db, 'resumes'), { ...payload, createdAt: serverTimestamp() });
        setCurrentResume({ id: docRef.id, ...payload });
        showToast('Saved!');
      }
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      loadResumes(user.uid);
    } catch (error) {
      showToast('Save failed', 'error');
    }
  };

  const createNewResume = () => {
    if (hasUnsavedChanges && !window.confirm('Unsaved changes. Continue?')) return;
    setCurrentResume(null);
    setResumeData({ personalInfo: { fullName: '', email: '', phone: '', location: '', linkedIn: '', github: '', twitter: '', instagram: '', website: '', summary: '' }, education: [], experience: [], skills: [], projects: [] });
    setSelectedTemplate('modern');
    setCurrentView('builder');
    setHasUnsavedChanges(false);
  };

  const loadResume = (resume) => {
    if (hasUnsavedChanges && !window.confirm('Unsaved changes. Continue?')) return;
    setCurrentResume(resume);
    setResumeData(resume.data);
    setSelectedTemplate(resume.template || 'modern');
    setCurrentView('builder');
    setHasUnsavedChanges(false);
    showToast('Loaded');
  };

  const duplicateResume = async (resume) => {
    try {
      const duplicated = duplicateResumeData(resume.data);
      await addDoc(collection(db, 'resumes'), {
        userId: user.uid,
        data: duplicated,
        template: resume.template || 'modern',
        trashed: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      loadResumes(user.uid);
      setShowDuplicateModal(false);
      showToast('Duplicated!');
    } catch (error) {
      showToast('Duplicate failed', 'error');
    }
  };

  const deleteResume = async () => {
    if (!itemToDelete) return;
    try {
      await updateDoc(doc(db, 'resumes', itemToDelete.id), { trashed: true, trashedAt: serverTimestamp() });
      loadResumes(user.uid);
      setShowDeleteModal(false);
      showToast('Deleted');
    } catch (error) {
      showToast('Delete failed', 'error');
    }
  };

  const updatePersonalInfo = (field, value) => {
    setResumeData(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, [field]: sanitizeHtml(value) } }));
    setHasUnsavedChanges(true);
  };

  const addEducation = () => {
    setResumeData(prev => ({ ...prev, education: [...prev.education, { degree: '', institution: '', year: '', gpa: '' }] }));
    setHasUnsavedChanges(true);
  };

  const updateEducation = (index, field, value) => {
    setResumeData(prev => {
      const updated = [...prev.education];
      updated[index][field] = sanitizeHtml(value);
      return { ...prev, education: updated };
    });
    setHasUnsavedChanges(true);
  };

  const removeEducation = (index) => {
    setResumeData(prev => ({ ...prev, education: prev.education.filter((_, i) => i !== index) }));
    setHasUnsavedChanges(true);
  };

  const addExperience = () => {
    setResumeData(prev => ({ ...prev, experience: [...prev.experience, { position: '', company: '', startDate: '', endDate: '', description: '' }] }));
    setHasUnsavedChanges(true);
  };

  const updateExperience = (index, field, value) => {
    setResumeData(prev => {
      const updated = [...prev.experience];
      updated[index][field] = sanitizeHtml(value);
      return { ...prev, experience: updated };
    });
    setHasUnsavedChanges(true);
  };

  const removeExperience = (index) => {
    setResumeData(prev => ({ ...prev, experience: prev.experience.filter((_, i) => i !== index) }));
    setHasUnsavedChanges(true);
  };

  const addSkill = () => {
    const skill = window.prompt('Enter skill:');
    if (skill?.trim()) {
      setResumeData(prev => ({ ...prev, skills: [...prev.skills, sanitizeHtml(skill.trim())] }));
      setHasUnsavedChanges(true);
    }
  };

  const removeSkill = (index) => {
    setResumeData(prev => ({ ...prev, skills: prev.skills.filter((_, i) => i !== index) }));
    setHasUnsavedChanges(true);
  };

  const addProject = () => {
    setResumeData(prev => ({ ...prev, projects: [...prev.projects, { name: '', description: '', link: '', technologies: '' }] }));
    setHasUnsavedChanges(true);
  };

  const updateProject = (index, field, value) => {
    setResumeData(prev => {
      const updated = [...prev.projects];
      updated[index][field] = sanitizeHtml(value);
      return { ...prev, projects: updated };
    });
    setHasUnsavedChanges(true);
  };

  const removeProject = (index) => {
    setResumeData(prev => ({ ...prev, projects: prev.projects.filter((_, i) => i !== index) }));
    setHasUnsavedChanges(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-600 font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || showLanding) {
    if (authMode === 'login' || authMode === 'signup') {
      return (
        <>
          <ToastContainer toasts={toasts} />
          <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">ResumeAI</h1>
                <p className="text-gray-600 mt-2">{authMode === 'login' ? 'Welcome back!' : 'Create your account'}</p>
              </div>
              <div className="flex gap-2 mb-6">
                <button onClick={() => setAuthMode('login')} className={`flex-1 py-2 rounded-lg font-semibold transition ${authMode === 'login' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' : 'bg-gray-100 text-gray-600'}`}>Login</button>
                <button onClick={() => setAuthMode('signup')} className={`flex-1 py-2 rounded-lg font-semibold transition ${authMode === 'signup' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' : 'bg-gray-100 text-gray-600'}`}>Sign Up</button>
              </div>
              {authError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{authError}</div>}
              <form onSubmit={authMode === 'login' ? handleLogin : handleSignup}>
                <div className="mb-4"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition" placeholder="Email" required /></div>
                <div className="mb-6"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition" placeholder="Password" required minLength="6" /></div>
                <button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg hover:shadow-lg transition font-semibold">{authMode === 'login' ? 'Login' : 'Sign Up'}</button>
              </form>
              <button onClick={() => setShowLanding(true)} className="w-full mt-4 text-purple-600 text-sm hover:underline">← Back to home</button>
            </div>
          </div>
        </>
      );
    } else {
      return (
        <>
          <ToastContainer toasts={toasts} />
          <LandingPage 
            onGetStarted={() => setAuthMode('signup')} 
            onLogin={() => setAuthMode('login')} 
          />
        </>
      );
    }
  }

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-gray-900' : 'bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50'}`}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-fadeIn { animation: fadeIn 0.6s ease-out; }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
        .animate-scaleIn { animation: scaleIn 0.2s ease-out; }
        @media print {
          body * { visibility: hidden; }
          .print-content, .print-content * { visibility: visible; }
          .print-content { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <ToastContainer toasts={toasts} />

      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg shadow-sm border-b border-purple-100 dark:border-gray-700 sticky top-0 z-40 no-print">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">ResumeAI</h1>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={toggleDarkMode} className="p-2 bg-purple-100 dark:bg-gray-700 rounded-lg hover:bg-purple-200 dark:hover:bg-gray-600 transition" title="Toggle theme">
              {isDark ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-purple-600" />}
            </button>
            {hasUnsavedChanges && <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full"><AlertCircle className="w-4 h-4" />Unsaved</div>}
            {autoSaving && <div className="flex items-center gap-2 text-sm text-purple-600"><RefreshCw className="w-4 h-4 animate-spin" />Saving...</div>}
            {lastSaved && !autoSaving && <div className="text-sm text-green-600 flex items-center gap-1 bg-green-50 px-3 py-1 rounded-full"><CheckCircle className="w-4 h-4" />{getRelativeTime(lastSaved)}</div>}
            <button onClick={() => setCurrentView('dashboard')} className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition font-semibold">Dashboard</button>
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg hover:shadow-lg transition font-semibold"><LogOut className="w-4 h-4" />Logout</button>
          </div>
        </div>
      </header>

      {/* Dashboard View */}
      {currentView === 'dashboard' && (
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8 animate-fadeIn">
            <div>
              <h2 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">My Resumes</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-2">Create and manage your professional resumes</p>
            </div>
            <button onClick={createNewResume} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-2xl transition font-bold"><Plus className="w-5 h-5" />Create New Resume</button>
          </div>

          {resumes.length === 0 ? (
            <div className="text-center py-20 animate-fadeIn">
              <div className="w-32 h-32 bg-gradient-to-br from-purple-100 to-pink-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <FileText className="w-16 h-16 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">No resumes yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">Start building your professional resume now and land your dream job!</p>
              <button onClick={createNewResume} className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-2xl transition font-bold"><Plus className="w-5 h-5" />Create Your First Resume</button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {resumes.map((resume, index) => (
                <div key={resume.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition p-6 border border-purple-100 dark:border-gray-700 animate-fadeIn" style={{ animationDelay: `${index * 0.1}s` }}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-xl text-gray-800 dark:text-white truncate mb-1">{resume.data?.personalInfo?.fullName || 'Untitled Resume'}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-sm px-2 py-1 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-600 rounded-full font-semibold capitalize">{resume.template || 'modern'}</span>
                        {resume.updatedAt && <span className="text-xs text-gray-500">• {getRelativeTime(resume.updatedAt.toDate())}</span>}
                      </div>
                    </div>
                    <Layout className="w-8 h-8 text-purple-400" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => loadResume(resume)} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-lg transition font-semibold"><Edit3 className="w-4 h-4" />Edit</button>
                    <button onClick={() => { setItemToDuplicate(resume); setShowDuplicateModal(true); }} className="px-4 py-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition" title="Duplicate"><Copy className="w-4 h-4" /></button>
                    <button onClick={() => { setItemToDelete(resume); setShowDeleteModal(true); }} className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition" title="Delete"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Builder View */}
      {currentView === 'builder' && (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6 no-print">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Resume Builder</h2>
            <div className="flex gap-2">
              <button onClick={saveResume} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition font-semibold" title="Ctrl+S"><Save className="w-4 h-4" />Save</button>
              <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:shadow-lg transition font-semibold"><Download className="w-4 h-4" />Export PDF</button>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Form Column */}
            <div className="space-y-6 no-print">
              {/* Personal Info */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-purple-100 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-600" />
                  Personal Information
                </h3>
                <div className="space-y-4">
                  <input type="text" placeholder="Full Name *" value={resumeData.personalInfo.fullName} onChange={(e) => updatePersonalInfo('fullName', e.target.value)} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition" required maxLength="80" />
                  <input type="email" placeholder="Email *" value={resumeData.personalInfo.email} onChange={(e) => updatePersonalInfo('email', e.target.value)} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition" required />
                  <input type="tel" placeholder="Phone" value={resumeData.personalInfo.phone} onChange={(e) => updatePersonalInfo('phone', e.target.value)} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition" />
                  <input type="text" placeholder="Location (City, Country)" value={resumeData.personalInfo.location} onChange={(e) => updatePersonalInfo('location', e.target.value)} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition" />
                  
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Social Links</h4>
                    <div className="space-y-3">
                      {[
                        { icon: Linkedin, field: 'linkedIn', placeholder: 'LinkedIn URL', color: 'text-blue-600' },
                        { icon: Github, field: 'github', placeholder: 'GitHub URL', color: 'text-gray-800 dark:text-gray-300' },
                        { icon: Twitter, field: 'twitter', placeholder: 'Twitter URL', color: 'text-blue-400' },
                        { icon: Globe, field: 'website', placeholder: 'Website URL', color: 'text-purple-600' }
                      ].map(({ icon: Icon, field, placeholder, color }) => (
                        <div key={field} className="flex items-center gap-2">
                          <Icon className={`w-5 h-5 ${color}`} />
                          <input type="url" placeholder={placeholder} value={resumeData.personalInfo[field]} onChange={(e) => updatePersonalInfo(field, e.target.value)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 text-sm transition" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <textarea placeholder="Professional Summary (2-3 sentences)" value={resumeData.personalInfo.summary} onChange={(e) => updatePersonalInfo('summary', e.target.value)} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 transition" rows="4" maxLength="500" />
                  <div className="text-xs text-gray-500 text-right">{resumeData.personalInfo.summary.length}/500</div>
                </div>
              </div>

              {/* Education */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-purple-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">Education</h3>
                  <button onClick={addEducation} className="flex items-center gap-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-lg transition text-sm font-semibold"><Plus className="w-4 h-4" />Add</button>
                </div>
                <div className="space-y-4">
                  {resumeData.education.map((edu, index) => (
                    <div key={index} className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg space-y-3 bg-gray-50 dark:bg-gray-700">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-sm text-purple-600">#{index + 1}</span>
                        <button onClick={() => removeEducation(index)} className="text-red-500 hover:text-red-700 transition"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <input type="text" placeholder="Degree" value={edu.degree} onChange={(e) => updateEducation(index, 'degree', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                      <input type="text" placeholder="Institution" value={edu.institution} onChange={(e) => updateEducation(index, 'institution', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" placeholder="Year" value={edu.year} onChange={(e) => updateEducation(index, 'year', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                        <input type="text" placeholder="GPA" value={edu.gpa} onChange={(e) => updateEducation(index, 'gpa', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                      </div>
                    </div>
                  ))}
                  {resumeData.education.length === 0 && <p className="text-center text-gray-500 py-4 text-sm">No education added yet. Click "Add" to get started.</p>}
                </div>
              </div>

              {/* Experience */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-purple-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">Experience</h3>
                  <button onClick={addExperience} className="flex items-center gap-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-lg transition text-sm font-semibold"><Plus className="w-4 h-4" />Add</button>
                </div>
                <div className="space-y-4">
                  {resumeData.experience.map((exp, index) => (
                    <div key={index} className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg space-y-3 bg-gray-50 dark:bg-gray-700">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-sm text-purple-600">#{index + 1}</span>
                        <button onClick={() => removeExperience(index)} className="text-red-500 hover:text-red-700 transition"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <input type="text" placeholder="Position" value={exp.position} onChange={(e) => updateExperience(index, 'position', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                      <input type="text" placeholder="Company" value={exp.company} onChange={(e) => updateExperience(index, 'company', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" placeholder="Start Date" value={exp.startDate} onChange={(e) => updateExperience(index, 'startDate', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                        <input type="text" placeholder="End Date" value={exp.endDate} onChange={(e) => updateExperience(index, 'endDate', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                      </div>
                      <textarea placeholder="Description" value={exp.description} onChange={(e) => updateExperience(index, 'description', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-purple-500" rows="3" maxLength="300" />
                      <div className="text-xs text-gray-500 text-right">{exp.description.length}/300</div>
                    </div>
                  ))}
                  {resumeData.experience.length === 0 && <p className="text-center text-gray-500 py-4 text-sm">No experience added yet. Click "Add" to get started.</p>}
                </div>
              </div>

              {/* Skills */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-purple-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">Skills</h3>
                  <button onClick={addSkill} className="flex items-center gap-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-lg transition text-sm font-semibold"><Plus className="w-4 h-4" />Add</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {resumeData.skills.map((skill, index) => (
                    <div key={index} className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-full border border-purple-200">
                      <span className="text-sm font-semibold">{skill}</span>
                      <button onClick={() => removeSkill(index)} className="text-purple-600 hover:text-purple-800 transition"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  {resumeData.skills.length === 0 && <p className="text-center text-gray-500 py-4 text-sm w-full">No skills added yet. Click "Add" to get started.</p>}
                </div>
              </div>

              {/* Projects */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-purple-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">Projects</h3>
                  <button onClick={addProject} className="flex items-center gap-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-lg transition text-sm font-semibold"><Plus className="w-4 h-4" />Add</button>
                </div>
                <div className="space-y-4">
                  {resumeData.projects.map((project, index) => (
                    <div key={index} className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg space-y-3 bg-gray-50 dark:bg-gray-700">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-sm text-purple-600">#{index + 1}</span>
                        <button onClick={() => removeProject(index)} className="text-red-500 hover:text-red-700 transition"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <input type="text" placeholder="Project Name" value={project.name} onChange={(e) => updateProject(index, 'name', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                      <textarea placeholder="Description" value={project.description} onChange={(e) => updateProject(index, 'description', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-purple-500" rows="2" />
                      <input type="url" placeholder="Link (optional)" value={project.link} onChange={(e) => updateProject(index, 'link', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                      <input type="text" placeholder="Technologies" value={project.technologies} onChange={(e) => updateProject(index, 'technologies', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                    </div>
                  ))}
                  {resumeData.projects.length === 0 && <p className="text-center text-gray-500 py-4 text-sm">No projects added yet. Click "Add" to get started.</p>}
                </div>
              </div>

              {/* Template Selector */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-purple-100 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Choose Template</h3>
                <div className="grid grid-cols-2 gap-3">
                  {templates.map((template) => (
                    <button key={template.id} onClick={() => setSelectedTemplate(template.id)} className={`p-4 border-2 rounded-xl text-left transition ${getTemplateClasses(template.color, selectedTemplate === template.id)}`}>
                      <div className="font-semibold text-sm text-gray-800 dark:text-white">{template.name}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{template.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview Column */}
            <div className="lg:sticky lg:top-24 h-fit">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-purple-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4 no-print">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <Eye className="w-5 h-5 text-purple-600" />
                    Live Preview
                  </h3>
                  <span className="text-sm px-3 py-1 bg-purple-100 text-purple-600 rounded-full font-semibold capitalize">{selectedTemplate}</span>
                </div>
                <div className="print-content border border-gray-200 dark:border-gray-600 rounded-lg overflow-auto bg-white" style={{maxHeight: '800px'}}>
                  <ResumePreview data={resumeData} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Confirm Delete">
          <p className="text-gray-600 mb-6">Are you sure you want to delete <strong className="text-gray-800">{itemToDelete?.data?.personalInfo?.fullName}</strong>? This action can be undone within 30 days.</p>
          <div className="flex gap-3">
            <button onClick={deleteResume} className="flex-1 bg-gradient-to-r from-red-500 to-rose-600 text-white py-3 rounded-lg hover:shadow-lg transition font-semibold">Delete</button>
            <button onClick={() => setShowDeleteModal(false)} className="flex-1 border-2 border-gray-300 py-3 rounded-lg hover:bg-gray-50 transition font-semibold">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Duplicate Modal */}
      {showDuplicateModal && (
        <Modal isOpen={showDuplicateModal} onClose={() => setShowDuplicateModal(false)} title="Duplicate Resume">
          <p className="text-gray-600 mb-6">Create a copy of <strong className="text-gray-800">{itemToDuplicate?.data?.personalInfo?.fullName}</strong>? The copy will have "(Copy)" added to the name.</p>
          <div className="flex gap-3">
            <button onClick={() => duplicateResume(itemToDuplicate)} className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg hover:shadow-lg transition font-semibold">Duplicate</button>
            <button onClick={() => setShowDuplicateModal(false)} className="flex-1 border-2 border-gray-300 py-3 rounded-lg hover:bg-gray-50 transition font-semibold">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ============================================================================
// RESUME PREVIEW COMPONENT
// ============================================================================

const ResumePreview = ({ data }) => (
  <div className="bg-white text-gray-800 p-8 text-sm" style={{minHeight: '11in', width: '8.5in'}}>
    {/* Header */}
    <div className="text-center mb-6 pb-4 border-b-2 border-purple-600">
      <h1 className="text-4xl font-bold text-gray-900 mb-2">
        {data.personalInfo.fullName || 'Your Name'}
      </h1>
      <div className="text-sm text-gray-600 space-x-3">
        {data.personalInfo.email && <span>{data.personalInfo.email}</span>}
        {data.personalInfo.phone && <span>•</span>}
        {data.personalInfo.phone && <span>{data.personalInfo.phone}</span>}
        {data.personalInfo.location && <span>•</span>}
        {data.personalInfo.location && <span>{data.personalInfo.location}</span>}
      </div>
      {(data.personalInfo.linkedIn || data.personalInfo.github || data.personalInfo.website) && (
        <div className="text-xs text-gray-500 mt-2 space-x-2">
          {data.personalInfo.linkedIn && <span>LinkedIn</span>}
          {data.personalInfo.github && data.personalInfo.linkedIn && <span>•</span>}
          {data.personalInfo.github && <span>GitHub</span>}
          {data.personalInfo.website && (data.personalInfo.linkedIn || data.personalInfo.github) && <span>•</span>}
          {data.personalInfo.website && <span>Portfolio</span>}
        </div>
      )}
    </div>

    {/* Summary */}
    {data.personalInfo.summary && (
      <div className="mb-6">
        <h2 className="text-lg font-bold text-purple-600 mb-2 uppercase border-b border-purple-300 pb-1">
          Professional Summary
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed">{data.personalInfo.summary}</p>
      </div>
    )}

    {/* Experience */}
    {data.experience.length > 0 && (
      <div className="mb-6">
        <h2 className="text-lg font-bold text-purple-600 mb-3 uppercase border-b border-purple-300 pb-1">
          Experience
        </h2>
        {data.experience.map((exp, i) => (
          <div key={i} className="mb-4">
            <div className="flex justify-between items-baseline mb-1">
              <h3 className="font-bold text-base">{exp.position}</h3>
              <span className="text-sm text-gray-600">{exp.startDate} - {exp.endDate}</span>
            </div>
            <div className="text-sm italic text-gray-600 mb-1">{exp.company}</div>
            <p className="text-sm text-gray-700 leading-relaxed">{exp.description}</p>
          </div>
        ))}
      </div>
    )}

    {/* Education */}
    {data.education.length > 0 && (
      <div className="mb-6">
        <h2 className="text-lg font-bold text-purple-600 mb-3 uppercase border-b border-purple-300 pb-1">
          Education
        </h2>
        {data.education.map((edu, i) => (
          <div key={i} className="mb-3">
            <div className="flex justify-between items-baseline">
              <h3 className="font-bold">{edu.degree}</h3>
              <span className="text-sm text-gray-600">{edu.year}</span>
            </div>
            <div className="text-sm text-gray-600">{edu.institution}</div>
            {edu.gpa && <div className="text-sm text-gray-500">GPA: {edu.gpa}</div>}
          </div>
        ))}
      </div>
    )}

    {/* Skills */}
    {data.skills.length > 0 && (
      <div className="mb-6">
        <h2 className="text-lg font-bold text-purple-600 mb-2 uppercase border-b border-purple-300 pb-1">
          Skills
        </h2>
        <div className="text-sm text-gray-700">{data.skills.join(' • ')}</div>
      </div>
    )}

    {/* Projects */}
    {data.projects.length > 0 && (
      <div>
        <h2 className="text-lg font-bold text-purple-600 mb-3 uppercase border-b border-purple-300 pb-1">
          Projects
        </h2>
        {data.projects.map((proj, i) => (
          <div key={i} className="mb-3">
            <h3 className="font-bold">{proj.name}</h3>
            <p className="text-sm text-gray-700">{proj.description}</p>
            {proj.technologies && (
              <div className="text-sm text-gray-500 mt-1">Technologies: {proj.technologies}</div>
            )}
            {proj.link && (
              <div className="text-sm text-purple-600 mt-1">{proj.link}</div>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);

export default ResumeBuilder;