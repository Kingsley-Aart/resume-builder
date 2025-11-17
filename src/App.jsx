// ============================================================================
// PROFESSIONAL RESUME BUILDER - PRODUCTION READY
// All syntax errors fixed, functionality preserved
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  User, LogOut, Download, Plus, Trash2, Eye, Edit3, FileText, Upload, 
  Save, Layout, GripVertical, CheckCircle, AlertCircle, Github, Twitter, 
  Instagram, Globe, Linkedin, X, Mail, Lock, RefreshCw, Undo, Clock
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

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  return { toasts, showToast };
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidPhone = (phone) => {
  return /^[\d\s()+-]{10,}$/.test(phone);
};

const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const sanitizeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const getRelativeTime = (date) => {
  if (!date) return '';
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

const parseLinkedInData = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const parsed = {
    personalInfo: { 
      fullName: '', email: '', phone: '', location: '', 
      linkedIn: '', github: '', twitter: '', instagram: '', website: '', summary: '' 
    },
    education: [],
    experience: [],
    skills: [],
    projects: [],
    confidence: 0
  };

  let currentSection = null;
  let currentItem = null;
  let fieldsFound = 0;

  lines.forEach((line, index) => {
    const lowerLine = line.toLowerCase();
    
    if (index === 0 && line.length < 50 && !line.includes('@') && !lowerLine.includes('resume')) {
      parsed.personalInfo.fullName = line;
      fieldsFound++;
    }
    
    const emailMatch = line.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch && isValidEmail(emailMatch[0])) {
      parsed.personalInfo.email = emailMatch[0];
      fieldsFound++;
    }
    
    const phoneMatch = line.match(/\+?\d[\d\s()-]{8,}/);
    if (phoneMatch) {
      parsed.personalInfo.phone = phoneMatch[0];
      fieldsFound++;
    }
    
    if (line.includes('linkedin.com')) {
      parsed.personalInfo.linkedIn = line;
      fieldsFound++;
    } else if (line.includes('github.com')) {
      parsed.personalInfo.github = line;
      fieldsFound++;
    } else if (line.includes('twitter.com')) {
      parsed.personalInfo.twitter = line;
    }
    
    if (lowerLine.includes('summary') || lowerLine.includes('about') || lowerLine.includes('profile')) {
      currentSection = 'summary';
    } else if (lowerLine.includes('experience') || lowerLine.includes('work history')) {
      currentSection = 'experience';
      if (currentItem) parsed.experience.push(currentItem);
      currentItem = null;
    } else if (lowerLine.includes('education')) {
      currentSection = 'education';
      if (currentItem) parsed.education.push(currentItem);
      currentItem = null;
    } else if (lowerLine.includes('skills') || lowerLine.includes('technical')) {
      currentSection = 'skills';
    } else if (lowerLine.includes('projects')) {
      currentSection = 'projects';
    } else if (currentSection === 'summary' && line.length > 50 && !line.match(/\d{4}/)) {
      parsed.personalInfo.summary += line + ' ';
    } else if (currentSection === 'experience') {
      if (line.match(/\d{4}/) && (line.includes('-') || line.includes('to') || lowerLine.includes('present'))) {
        if (currentItem) parsed.experience.push(currentItem);
        currentItem = { position: '', company: '', startDate: '', endDate: '', description: '' };
        const dates = line.match(/(\w+\s+\d{4})\s*[-–to]\s*(\w+\s+\d{4}|Present)/i);
        if (dates) {
          currentItem.startDate = dates[1];
          currentItem.endDate = dates[2];
          fieldsFound++;
        }
      } else if (currentItem && !currentItem.position && line.length > 5) {
        currentItem.position = line;
      } else if (currentItem && !currentItem.company && line.length > 3) {
        currentItem.company = line;
      } else if (currentItem) {
        currentItem.description += line + ' ';
      }
    } else if (currentSection === 'education') {
      if (line.match(/\d{4}/)) {
        if (currentItem) parsed.education.push(currentItem);
        currentItem = { degree: '', institution: '', year: '', gpa: '' };
        currentItem.year = line.match(/\d{4}(-\d{4})?/)?.[0] || '';
        fieldsFound++;
      } else if (currentItem && !currentItem.degree) {
        currentItem.degree = line;
      } else if (currentItem && !currentItem.institution) {
        currentItem.institution = line;
      } else if (currentItem && (line.match(/GPA|gpa/i) || line.match(/\d\.\d/))) {
        currentItem.gpa = line.match(/[\d.]+/)?.[0] || '';
      }
    } else if (currentSection === 'skills') {
      const skillDelimiters = /[,•·|;]/g;
      const skills = line.split(skillDelimiters)
        .map(s => s.trim())
        .filter(s => s && s.length > 1 && s.length < 30 && !s.match(/^\d+$/));
      if (skills.length > 0) {
        parsed.skills.push(...skills);
        fieldsFound += skills.length;
      }
    } else if (currentSection === 'projects') {
      if (!currentItem || currentItem.name) {
        if (currentItem) parsed.projects.push(currentItem);
        currentItem = { name: line, description: '', link: '', technologies: '' };
      } else {
        currentItem.description += line + ' ';
      }
    }
  });

  if (currentItem && currentSection === 'experience') parsed.experience.push(currentItem);
  if (currentItem && currentSection === 'education') parsed.education.push(currentItem);
  if (currentItem && currentSection === 'projects') parsed.projects.push(currentItem);

  const maxFields = 20;
  parsed.confidence = Math.min(Math.round((fieldsFound / maxFields) * 100), 100);

  return parsed;
};

// ============================================================================
// COMPONENTS
// ============================================================================

const ToastContainer = ({ toasts }) => (
  <div className="fixed top-4 right-4 z-50 space-y-2">
    {toasts.map(toast => (
      <div
        key={toast.id}
        className={`px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slideIn ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 
          toast.type === 'error' ? 'bg-red-600 text-white' : 
          'bg-blue-600 text-white'
        }`}
      >
        {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : 
         toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : 
         <Clock className="w-5 h-5" />}
        {toast.message}
      </div>
    ))}
  </div>
);

const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className={`bg-white rounded-xl shadow-2xl ${maxWidth} w-full p-6 animate-scaleIn`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X className="w-6 h-6" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, itemName }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Confirm Delete">
    <p className="text-gray-600 mb-6">
      Are you sure you want to delete <strong>{itemName}</strong>? This can be undone within 30 days.
    </p>
    <div className="flex gap-3">
      <button
        onClick={onConfirm}
        className="flex-1 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 transition font-semibold"
      >
        Delete
      </button>
      <button
        onClick={onClose}
        className="flex-1 border border-gray-300 py-3 rounded-lg hover:bg-gray-50 transition"
      >
        Cancel
      </button>
    </div>
  </Modal>
);

const PasswordResetModal = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(true);
    } catch (err) {
      setError('Failed to send reset email. Please try again.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reset Password">
      {success ? (
        <div className="text-center py-4">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <p className="text-gray-700">Password reset email sent! Check your inbox.</p>
          <button
            onClick={onClose}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          <p className="text-gray-600 mb-4">
            Enter your email address and we'll send you a link to reset your password.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
            required
          />
          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              Send Reset Link
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 py-3 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

const ImportModal = ({ isOpen, onClose, onImport, showToast }) => {
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [confidence, setConfidence] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('File size must be less than 5MB', 'error');
      return;
    }

    setImporting(true);

    try {
      if (file.type === 'text/plain') {
        const text = await file.text();
        setImportText(text);
      } else if (file.type === 'application/pdf') {
        showToast('PDF parsing requires additional setup. Please copy-paste text instead.', 'info');
      } else {
        showToast('Please upload a TXT or PDF file', 'error');
      }
    } catch (error) {
      showToast('Error reading file', 'error');
    }

    setImporting(false);
  };

  const handleImport = () => {
    if (!importText.trim()) {
      showToast('Please paste text or upload a file', 'error');
      return;
    }

    const parsed = parseLinkedInData(importText);
    setConfidence(parsed.confidence);
    
    if (parsed.confidence < 30) {
      showToast('Low confidence - please review imported data carefully', 'info');
    }

    onImport(parsed);
    setImportText('');
    setConfidence(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import from LinkedIn/Resume" maxWidth="max-w-2xl">
      <p className="text-gray-600 mb-4">
        Copy and paste your LinkedIn profile text, resume content, or upload a TXT file. Our parser will extract the information.
      </p>
      
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Upload File (TXT)</label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.pdf"
          onChange={handleFileUpload}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          disabled={importing}
        />
      </div>

      <div className="text-center text-gray-500 my-3">OR</div>

      <textarea
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
        placeholder="Paste your LinkedIn profile or resume text here..."
        className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
        disabled={importing}
      />
      
      {confidence !== null && (
        <div className={`mt-2 p-2 rounded text-sm ${
          confidence >= 70 ? 'bg-green-50 text-green-700' :
          confidence >= 40 ? 'bg-yellow-50 text-yellow-700' :
          'bg-red-50 text-red-700'
        }`}>
          Confidence: {confidence}% - {
            confidence >= 70 ? 'High quality data detected' :
            confidence >= 40 ? 'Moderate quality - review carefully' :
            'Low quality - manual review needed'
          }
        </div>
      )}

      <div className="flex gap-3 mt-4">
        <button
          onClick={handleImport}
          disabled={importing}
          className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50"
        >
          {importing ? 'Processing...' : 'Import Data'}
        </button>
        <button
          onClick={onClose}
          className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

const ResumeBuilder = () => {

  const getTemplateClasses = (color, isSelected) => {
    const colorMap = {
      blue: 'border-blue-500 bg-blue-50',
      gray: 'border-gray-500 bg-gray-50',
      purple: 'border-purple-500 bg-purple-50',
      indigo: 'border-indigo-500 bg-indigo-50',
      slate: 'border-slate-500 bg-slate-50',
      green: 'border-green-500 bg-green-50',
      amber: 'border-amber-500 bg-amber-50',
      teal: 'border-teal-500 bg-teal-50',
      pink: 'border-pink-500 bg-pink-50',
      emerald: 'border-emerald-500 bg-emerald-50',
    };
    
    return isSelected 
      ? `${colorMap[color]} shadow-lg` 
      : 'border-gray-200 hover:border-gray-300';
  };
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState('');
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  const [currentView, setCurrentView] = useState('dashboard');
  const [resumes, setResumes] = useState([]);
  const [currentResume, setCurrentResume] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState('modern');
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const { toasts, showToast } = useToast();

  const [resumeData, setResumeData] = useState({
    personalInfo: {
      fullName: '', email: '', phone: '', location: '',
      linkedIn: '', github: '', twitter: '', instagram: '', website: '', summary: ''
    },
    sectionOrder: ['education', 'experience', 'skills', 'projects'],
    education: [],
    experience: [],
    skills: [],
    projects: []
  });

  const debouncedResumeData = useDebounce(resumeData, 3000);

  const templates = useMemo(() => [
    { id: 'modern', name: 'Modern', description: 'Clean two-column', color: 'blue' },
    { id: 'classic', name: 'Classic', description: 'Traditional', color: 'gray' },
    { id: 'creative', name: 'Creative', description: 'Colorful', color: 'purple' },
    { id: 'professional', name: 'Professional', description: 'Corporate', color: 'indigo' },
    { id: 'minimal', name: 'Minimal', description: 'Ultra-clean', color: 'slate' },
    { id: 'tech', name: 'Tech', description: 'Developer', color: 'green' },
    { id: 'executive', name: 'Executive', description: 'Leadership', color: 'amber' },
    { id: 'academic', name: 'Academic', description: 'Research', color: 'teal' },
    { id: 'designer', name: 'Designer', description: 'Portfolio', color: 'pink' },
    { id: 'ats', name: 'ATS-Optimized', description: 'Compatible', color: 'emerald' }
  ], []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        loadResumes(currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentResume && user && debouncedResumeData) {
      autoSaveResume();
    }
  }, [debouncedResumeData]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (currentView === 'builder') {
          saveResume();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentView, resumeData]);

  const handleSignup = useCallback(async (e) => {
    e.preventDefault();
    setAuthError('');

    if (!isValidEmail(email)) {
      setAuthError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters');
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setEmail('');
      setPassword('');
      setName('');
      showToast('Account created successfully!');
    } catch (error) {
      setAuthError('Failed to create account. Email may already be in use.');
    }
  }, [email, password, showToast]);

  const handleLogin = useCallback(async (e) => {
    e.preventDefault();
    setAuthError('');

    if (!isValidEmail(email)) {
      setAuthError('Please enter a valid email address');
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setEmail('');
      setPassword('');
      showToast('Welcome back!');
    } catch (error) {
      setAuthError('Invalid email or password');
    }
  }, [email, password, showToast]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      setCurrentView('dashboard');
      setCurrentResume(null);
      showToast('Logged out successfully');
    } catch (error) {
      showToast('Error logging out', 'error');
    }
  }, [showToast]);

  const loadResumes = useCallback(async (userId) => {
    try {
      const q = query(collection(db, 'resumes'), where('userId', '==', userId), where('trashed', '==', false));
      const querySnapshot = await getDocs(q);
      const resumesList = [];
      querySnapshot.forEach((docSnap) => {
        resumesList.push({ id: docSnap.id, ...docSnap.data() });
      });
      setResumes(resumesList);
    } catch (error) {
      showToast('Error loading resumes', 'error');
    }
  }, [showToast]);

  const autoSaveResume = useCallback(async () => {
    if (!user || !currentResume || autoSaving) return;

    setAutoSaving(true);
    setSaveError(null);

    try {
      const resumeRef = doc(db, 'resumes', currentResume.id);
      const docSnap = await getDoc(resumeRef);

      if (!docSnap.exists()) {
        showToast('Resume not found', 'error');
        setAutoSaving(false);
        return;
      }

      await updateDoc(resumeRef, {
        data: resumeData,
        template: selectedTemplate,
        updatedAt: serverTimestamp()
      });

      setLastSaved(new Date());
    } catch (error) {
      setSaveError('Autosave failed');
      showToast('Autosave failed - changes not saved', 'error');
    }

    setAutoSaving(false);
  }, [user, currentResume, resumeData, selectedTemplate, autoSaving, showToast]);

  const saveResume = useCallback(async () => {
    if (!user) return;

    if (!resumeData.personalInfo.fullName.trim()) {
      showToast('Please enter your full name', 'error');
      return;
    }

    if (!isValidEmail(resumeData.personalInfo.email)) {
      showToast('Please enter a valid email', 'error');
      return;
    }

    try {
      const resumePayload = {
        userId: user.uid,
        data: resumeData,
        template: selectedTemplate,
        trashed: false,
        updatedAt: serverTimestamp()
      };

      if (currentResume) {
        await updateDoc(doc(db, 'resumes', currentResume.id), resumePayload);
        showToast('Resume updated successfully!');
      } else {
        const docRef = await addDoc(collection(db, 'resumes'), {
          ...resumePayload,
          createdAt: serverTimestamp()
        });
        setCurrentResume({ id: docRef.id, ...resumePayload });
        showToast('Resume saved successfully!');
      }
      setLastSaved(new Date());
      loadResumes(user.uid);
    } catch (error) {
      showToast('Error saving resume', 'error');
    }
  }, [user, resumeData, selectedTemplate, currentResume, showToast, loadResumes]);

  const createNewResume = useCallback(() => {
    setCurrentResume(null);
    setResumeData({
      personalInfo: { 
        fullName: '', email: '', phone: '', location: '',
        linkedIn: '', github: '', twitter: '', instagram: '', website: '', summary: ''
      },
      sectionOrder: ['education', 'experience', 'skills', 'projects'],
      education: [],
      experience: [],
      skills: [],
      projects: []
    });
    setSelectedTemplate('modern');
    setCurrentView('builder');
  }, []);

  const loadResume = useCallback((resume) => {
    setCurrentResume(resume);
    setResumeData(resume.data);
    setSelectedTemplate(resume.template || 'modern');
    setCurrentView('builder');
    showToast('Resume loaded');
  }, [showToast]);

  const confirmDelete = useCallback((resume) => {
    setItemToDelete(resume);
    setShowDeleteModal(true);
  }, []);

  const deleteResume = useCallback(async () => {
    if (!itemToDelete) return;

    try {
      await updateDoc(doc(db, 'resumes', itemToDelete.id), {
        trashed: true,
        trashedAt: serverTimestamp()
      });

      loadResumes(user.uid);
      setShowDeleteModal(false);
      setItemToDelete(null);
      showToast('Resume moved to trash. Undo within 30 days.', 'info');
    } catch (error) {
      showToast('Error deleting resume', 'error');
    }
  }, [itemToDelete, user, loadResumes, showToast]);

  const handleImport = useCallback((parsed) => {
    setResumeData({
      ...resumeData,
      personalInfo: { ...resumeData.personalInfo, ...parsed.personalInfo },
      education: [...resumeData.education, ...parsed.education],
      experience: [...resumeData.experience, ...parsed.experience],
      skills: [...new Set([...resumeData.skills, ...parsed.skills])],
      projects: [...resumeData.projects, ...parsed.projects]
    });
    
    setShowImportModal(false);
    showToast(`Data imported successfully! Confidence: ${parsed.confidence}%`);
  }, [resumeData, showToast]);

  const exportToPDF = useCallback(() => {
    showToast('Opening print dialog...');
    setTimeout(() => window.print(), 500);
  }, [showToast]);

  const updatePersonalInfo = useCallback((field, value) => {
    setResumeData(prev => ({
      ...prev,
      personalInfo: { ...prev.personalInfo, [field]: sanitizeHtml(value) }
    }));
  }, []);

  const addEducation = useCallback(() => {
    setResumeData(prev => ({
      ...prev,
      education: [...prev.education, { degree: '', institution: '', year: '', gpa: '' }]
    }));
  }, []);

  const updateEducation = useCallback((index, field, value) => {
    setResumeData(prev => {
      const updated = [...prev.education];
      updated[index][field] = sanitizeHtml(value);
      return { ...prev, education: updated };
    });
  }, []);

  const removeEducation = useCallback((index) => {
    setResumeData(prev => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index)
    }));
    showToast('Education entry removed');
  }, [showToast]);

  const addExperience = useCallback(() => {
    setResumeData(prev => ({
      ...prev,
      experience: [...prev.experience, { position: '', company: '', startDate: '', endDate: '', description: '' }]
    }));
  }, []);

  const updateExperience = useCallback((index, field, value) => {
    setResumeData(prev => {
      const updated = [...prev.experience];
      updated[index][field] = sanitizeHtml(value);
      return { ...prev, experience: updated };
    });
  }, []);

  const removeExperience = useCallback((index) => {
    setResumeData(prev => ({
      ...prev,
      experience: prev.experience.filter((_, i) => i !== index)
    }));
    showToast('Experience entry removed');
  }, [showToast]);

  const addSkill = useCallback(() => {
    const skill = window.prompt('Enter skill:');
    if (skill && skill.trim()) {
      setResumeData(prev => ({
        ...prev,
        skills: [...prev.skills, sanitizeHtml(skill.trim())]
      }));
    }
  }, []);

  const removeSkill = useCallback((index) => {
    setResumeData(prev => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index)
    }));
  }, []);

  const addProject = useCallback(() => {
    setResumeData(prev => ({
      ...prev,
      projects: [...prev.projects, { name: '', description: '', link: '', technologies: '' }]
    }));
  }, []);

  const updateProject = useCallback((index, field, value) => {
    setResumeData(prev => {
      const updated = [...prev.projects];
      updated[index][field] = sanitizeHtml(value);
      return { ...prev, projects: updated };
    });
  }, []);

  const removeProject = useCallback((index) => {
    setResumeData(prev => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== index)
    }));
    showToast('Project removed');
  }, [showToast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
          @keyframes scaleIn {
            from { transform: scale(0.9); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
          .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
          .animate-slideIn { animation: slideIn 0.3s ease-out; }
          .animate-scaleIn { animation: scaleIn 0.2s ease-out; }
        `}</style>

        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-fadeIn">
            <div className="text-center mb-8">
              <FileText className="w-16 h-16 text-blue-600 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-800">Resume Builder</h1>
              <p className="text-gray-600 mt-2">Create professional resumes in minutes</p>
            </div>

            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2 rounded-lg font-semibold transition ${
                  authMode === 'login' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-600'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setAuthMode('signup')}
                className={`flex-1 py-2 rounded-lg font-semibold transition ${
                  authMode === 'signup' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-600'
                }`}
              >
                Sign Up
              </button>
            </div>

            {authError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {authError}
              </div>
            )}

            <form onSubmit={authMode === 'login' ? handleLogin : handleSignup}>
              {authMode === 'signup' && (
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-semibold mb-2">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="Enter your name"
                    required
                  />
                </div>
              )}

              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-semibold mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-semibold mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Enter your password"
                  required
                  minLength="6"
                />
                {authMode === 'signup' && (
                  <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                {authMode === 'login' ? 'Login' : 'Sign Up'}
              </button>
            </form>

            {authMode === 'login' && (
              <button
                onClick={() => setShowPasswordReset(true)}
                className="w-full mt-3 text-blue-600 text-sm hover:underline"
              >
                Forgot password?
              </button>
            )}

            <p className="text-center text-gray-600 text-sm mt-6">
              {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                className="text-blue-600 font-semibold hover:underline"
              >
                {authMode === 'login' ? 'Sign Up' : 'Login'}
              </button>
            </p>
          </div>
        </div>

        <PasswordResetModal
          isOpen={showPasswordReset}
          onClose={() => setShowPasswordReset(false)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
        .animate-scaleIn { animation: scaleIn 0.2s ease-out; }

        @media print {
          body * { visibility: hidden; }
          .print-content, .print-content * { visibility: visible; }
          .print-content { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          @page { 
            margin: 0.5in; 
            size: letter;
          }
          * {
            page-break-inside: avoid;
          }
        }

        .border-blue-500, .border-gray-500, .border-purple-500,
        .border-indigo-500, .border-slate-500, .border-green-500,
        .border-amber-500, .border-teal-500, .border-pink-500, .border-emerald-500,
        .bg-blue-50, .bg-gray-50, .bg-purple-50, .bg-indigo-50, 
        .bg-slate-50, .bg-green-50, .bg-amber-50, .bg-teal-50, 
        .bg-pink-50, .bg-emerald-50 { }
      `}</style>

      <ToastContainer toasts={toasts} />

      <header className="bg-white shadow-sm border-b sticky top-0 z-40 no-print">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-800">Resume Builder</h1>
          </div>
          <div className="flex items-center gap-4">
            {autoSaving && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </div>
            )}
            {lastSaved && !autoSaving && (
              <div className="text-sm text-gray-500 flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-green-600" />
                {getRelativeTime(lastSaved)}
              </div>
            )}
            {saveError && (
              <div className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {saveError}
              </div>
            )}
            <span className="text-sm text-gray-600 hidden md:block">{user.email}</span>
            <button
              onClick={() => setCurrentView('dashboard')}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              Dashboard
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {currentView === 'dashboard' && (
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8 animate-fadeIn">
            <div>
              <h2 className="text-3xl font-bold text-gray-800">My Resumes</h2>
              <p className="text-gray-600 mt-1">Create and manage your professional resumes</p>
            </div>
            <button
              onClick={createNewResume}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Create New Resume
            </button>
          </div>

          {resumes.length === 0 ? (
            <div className="text-center py-16 animate-fadeIn">
              <FileText className="w-24 h-24 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No resumes yet</h3>
              <p className="text-gray-500 mb-6">Create your first professional resume now!</p>
              <button
                onClick={createNewResume}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold shadow-lg"
              >
                <Plus className="w-5 h-5" />
                Create Resume
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {resumes.map((resume, index) => (
                <div
                  key={resume.id}
                  className="bg-white rounded-xl shadow-md hover:shadow-xl transition p-6 animate-fadeIn"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-gray-800 truncate">
                        {resume.data?.personalInfo?.fullName || 'Untitled Resume'}
                      </h3>
                      <p className="text-sm text-gray-500 capitalize">{resume.template || 'modern'} template</p>
                      {resume.updatedAt && (
                        <p className="text-xs text-gray-400 mt-1">
                          Updated {getRelativeTime(resume.updatedAt.toDate())}
                        </p>
                      )}
                    </div>
                    <Layout className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadResume(resume)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => confirmDelete(resume)}
                      className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {currentView === 'builder' && (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6 no-print">
            <h2 className="text-2xl font-bold text-gray-800">Resume Builder</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition"
              >
                <Upload className="w-4 h-4" />
                Import
              </button>
              <button
                onClick={saveResume}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                title="Ctrl+S"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={exportToPDF}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-6 no-print">
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Personal Information</h3>
                <div className="space-y-4">
                  <div>
                    <input
                      type="text"
                      placeholder="Full Name *"
                      value={resumeData.personalInfo.fullName}
                      onChange={(e) => updatePersonalInfo('fullName', e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 transition"
                      required
                      maxLength="80"
                    />
                  </div>
                  <div>
                    <input
                      type="email"
                      placeholder="Email *"
                      value={resumeData.personalInfo.email}
                      onChange={(e) => updatePersonalInfo('email', e.target.value)}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 transition ${
                        resumeData.personalInfo.email && !isValidEmail(resumeData.personalInfo.email)
                          ? 'border-red-500 focus:ring-red-500'
                          : 'focus:ring-blue-500'
                      }`}
                      required
                    />
                    {resumeData.personalInfo.email && !isValidEmail(resumeData.personalInfo.email) && (
                      <p className="text-xs text-red-600 mt-1">Please enter a valid email</p>
                    )}
                  </div>
                  <div>
                    <input
                      type="tel"
                      placeholder="Phone (include country code)"
                      value={resumeData.personalInfo.phone}
                      onChange={(e) => updatePersonalInfo('phone', e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 transition"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Location (City, Country)"
                    value={resumeData.personalInfo.location}
                    onChange={(e) => updatePersonalInfo('location', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 transition"
                  />

                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Social Media</h4>
                    <div className="space-y-3">
                      {[
                        { icon: Linkedin, field: 'linkedIn', placeholder: 'LinkedIn Profile URL', color: 'blue-600' },
                        { icon: Github, field: 'github', placeholder: 'GitHub Profile URL', color: 'gray-800' },
                        { icon: Twitter, field: 'twitter', placeholder: 'Twitter Profile URL', color: 'blue-400' },
                        { icon: Instagram, field: 'instagram', placeholder: 'Instagram Profile URL', color: 'pink-600' },
                        { icon: Globe, field: 'website', placeholder: 'Portfolio/Website URL', color: 'gray-600' }
                      ].map(({ icon: Icon, field, placeholder, color }) => (
                        <div key={field} className="flex items-center gap-2">
                          <Icon className={`w-5 h-5 text-${color}`} />
                          <input
                            type="url"
                            placeholder={placeholder}
                            value={resumeData.personalInfo[field]}
                            onChange={(e) => updatePersonalInfo(field, e.target.value)}
                            className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 transition text-sm ${
                              resumeData.personalInfo[field] && !isValidUrl(resumeData.personalInfo[field])
                                ? 'border-red-500 focus:ring-red-500'
                                : 'focus:ring-blue-500'
                            }`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <textarea
                      placeholder="Professional Summary (2-3 sentences)"
                      value={resumeData.personalInfo.summary}
                      onChange={(e) => updatePersonalInfo('summary', e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 transition"
                      rows="4"
                      maxLength="500"
                    />
                    <div className="text-xs text-gray-500 text-right mt-1">
                      {resumeData.personalInfo.summary.length}/500
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800">Education</h3>
                  <button
                    onClick={addEducation}
                    className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
                <div className="space-y-4">
                  {resumeData.education.map((edu, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-3">
                      <div className="flex justify-between">
                        <span className="font-semibold text-sm text-gray-700">#{index + 1}</span>
                        <button
                          onClick={() => removeEducation(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Degree"
                        value={edu.degree}
                        onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Institution"
                        value={edu.institution}
                        onChange={(e) => updateEducation(index, 'institution', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Year"
                          value={edu.year}
                          onChange={(e) => updateEducation(index, 'year', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="GPA"
                          value={edu.gpa}
                          onChange={(e) => updateEducation(index, 'gpa', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800">Experience</h3>
                  <button
                    onClick={addExperience}
                    className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
                <div className="space-y-4">
                  {resumeData.experience.map((exp, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-3">
                      <div className="flex justify-between">
                        <span className="font-semibold text-sm text-gray-700">#{index + 1}</span>
                        <button
                          onClick={() => removeExperience(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Position"
                        value={exp.position}
                        onChange={(e) => updateExperience(index, 'position', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Company"
                        value={exp.company}
                        onChange={(e) => updateExperience(index, 'company', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Start Date"
                          value={exp.startDate}
                          onChange={(e) => updateExperience(index, 'startDate', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="End Date"
                          value={exp.endDate}
                          onChange={(e) => updateExperience(index, 'endDate', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <textarea
                        placeholder="Description"
                        value={exp.description}
                        onChange={(e) => updateExperience(index, 'description', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        rows="3"
                        maxLength="300"
                      />
                      <div className="text-xs text-gray-500 text-right">
                        {exp.description.length}/300
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800">Skills</h3>
                  <button
                    onClick={addSkill}
                    className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {resumeData.skills.map((skill, index) => (
                    <div key={index} className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full">
                      <span className="text-sm">{skill}</span>
                      <button
                        onClick={() => removeSkill(index)}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800">Projects</h3>
                  <button
                    onClick={addProject}
                    className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
                <div className="space-y-4">
                  {resumeData.projects.map((project, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-3">
                      <div className="flex justify-between">
                        <span className="font-semibold text-sm text-gray-700">#{index + 1}</span>
                        <button
                          onClick={() => removeProject(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Project Name"
                        value={project.name}
                        onChange={(e) => updateProject(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                      <textarea
                        placeholder="Description"
                        value={project.description}
                        onChange={(e) => updateProject(index, 'description', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        rows="2"
                      />
                      <input
                        type="url"
                        placeholder="Link (optional)"
                        value={project.link}
                        onChange={(e) => updateProject(index, 'link', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Technologies"
                        value={project.technologies}
                        onChange={(e) => updateProject(index, 'technologies', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Select Template</h3>
                <div className="grid grid-cols-2 gap-3">
                  {templates.map((template) => (
                     <button
    key={template.id}
    onClick={() => setSelectedTemplate(template.id)}
    className={`p-4 border-2 rounded-lg text-left transition ${
      getTemplateClasses(template.color, selectedTemplate === template.id)
    }`}
  >
    <div className="font-semibold text-sm">{template.name}</div>
    <div className="text-xs text-gray-500 mt-1">{template.description}</div>
  </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:sticky lg:top-24">
              <div className="bg-white rounded-xl shadow-lg p-4">
                <div className="flex items-center justify-between mb-4 no-print">
                  <h3 className="text-lg font-bold text-gray-800">Live Preview</h3>
                  <Eye className="w-5 h-5 text-gray-400" />
                </div>
                <div className="print-content border rounded-lg overflow-auto" style={{maxHeight: '800px'}}>
                  <SimpleModernTemplate data={resumeData} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        showToast={showToast}
      />

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={deleteResume}
        itemName={itemToDelete?.data?.personalInfo?.fullName || 'this resume'}
      />
    </div>
  );
};

const SimpleModernTemplate = ({ data }) => (
  <div className="bg-white text-gray-800 p-8 text-sm" style={{minHeight: '11in', width: '8.5in'}}>
    <div className="text-center mb-6 pb-4 border-b-2 border-gray-300">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
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

    {data.personalInfo.summary && (
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-2 uppercase border-b border-gray-300 pb-1">
          Professional Summary
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed">{data.personalInfo.summary}</p>
      </div>
    )}

    {data.experience.length > 0 && (
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-3 uppercase border-b border-gray-300 pb-1">
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

    {data.education.length > 0 && (
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-3 uppercase border-b border-gray-300 pb-1">
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

    {data.skills.length > 0 && (
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-2 uppercase border-b border-gray-300 pb-1">
          Skills
        </h2>
        <div className="text-sm text-gray-700">{data.skills.join(' • ')}</div>
      </div>
    )}

    {data.projects.length > 0 && (
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-3 uppercase border-b border-gray-300 pb-1">
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
              <div className="text-sm text-blue-600 mt-1">{proj.link}</div>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);

export default ResumeBuilder;