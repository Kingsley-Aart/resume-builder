// Copy this ENTIRE file and replace your current App.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  LogOut, Download, Plus, Trash2, Eye, Edit3, FileText, Upload, 
  Save, Layout, CheckCircle, AlertCircle, Github, Twitter, 
  Instagram, Globe, Linkedin, X, RefreshCw, Clock,
  Copy, Moon, Sun
} from 'lucide-react';
import { auth, db } from './firebase';
import { 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, 
  signOut, onAuthStateChanged 
} from 'firebase/auth';
import { 
  collection, addDoc, getDocs, updateDoc, doc, 
  query, where, serverTimestamp, getDoc 
} from 'firebase/firestore';

// Hooks
import { useDebounce } from './hooks/useDebounce';
import { useToast } from './hooks/useToast';
import { useDarkMode } from './hooks/useDarkMode';
import { useUnsavedChangesWarning } from './hooks/useUnsavedChanges';

// Utils
import { isValidEmail, isValidPhone, isValidUrl, sanitizeHtml } from './utils/validation';
import { getRelativeTime, duplicateResumeData, getTemplateClasses } from './utils/helpers';
import { parseLinkedInData } from './utils/parsing';

// Components
import { ToastContainer } from './components/common/Toast';
import { Loading } from './components/common/Loading';

const ResumeBuilder = () => {
  const { isDark, toggleDarkMode } = useDarkMode();
  const { toasts, showToast } = useToast();
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState('');

  const [currentView, setCurrentView] = useState('dashboard');
  const [resumes, setResumes] = useState([]);
  const [currentResume, setCurrentResume] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState('modern');
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [itemToDuplicate, setItemToDuplicate] = useState(null);
  
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [mobileView, setMobileView] = useState('form');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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
  useUnsavedChangesWarning(hasUnsavedChanges && currentView === 'builder');

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

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!isValidEmail(email)) {
      setAuthError('Please enter a valid email address');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      showToast('Welcome back!');
    } catch (error) {
      setAuthError('Invalid email or password');
    }
  };

  const handleSignup = async (e) => {
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
      showToast('Account created successfully!');
    } catch (error) {
      setAuthError('Failed to create account. Email may already be in use.');
    }
  };

  const handleLogout = async () => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm('You have unsaved changes. Are you sure you want to logout?');
      if (!confirmLeave) return;
    }
    try {
      await signOut(auth);
      setCurrentView('dashboard');
      setCurrentResume(null);
      setHasUnsavedChanges(false);
      showToast('Logged out successfully');
    } catch (error) {
      showToast('Error logging out', 'error');
    }
  };

  const loadResumes = async (userId) => {
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
  };

  const autoSaveResume = async () => {
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
      setHasUnsavedChanges(false);
    } catch (error) {
      setSaveError('Autosave failed');
      showToast('Autosave failed - changes not saved', 'error');
    }
    setAutoSaving(false);
  };

  const saveResume = async () => {
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
      setHasUnsavedChanges(false);
      loadResumes(user.uid);
    } catch (error) {
      showToast('Error saving resume', 'error');
    }
  };

  const createNewResume = () => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm('You have unsaved changes. Are you sure you want to create a new resume?');
      if (!confirmLeave) return;
    }
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
    setHasUnsavedChanges(false);
    setMobileView('form');
  };

  const loadResume = (resume) => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm('You have unsaved changes. Are you sure you want to load another resume?');
      if (!confirmLeave) return;
    }
    setCurrentResume(resume);
    setResumeData(resume.data);
    setSelectedTemplate(resume.template || 'modern');
    setCurrentView('builder');
    setHasUnsavedChanges(false);
    setMobileView('form');
    showToast('Resume loaded');
  };

  const duplicateResume = async (resume) => {
    try {
      const duplicatedData = duplicateResumeData(resume.data);
      const resumePayload = {
        userId: user.uid,
        data: duplicatedData,
        template: resume.template || 'modern',
        trashed: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await addDoc(collection(db, 'resumes'), resumePayload);
      loadResumes(user.uid);
      setShowDuplicateModal(false);
      setItemToDuplicate(null);
      showToast('Resume duplicated successfully!');
    } catch (error) {
      showToast('Error duplicating resume', 'error');
    }
  };

  const deleteResume = async () => {
    if (!itemToDelete) return;
    try {
      await updateDoc(doc(db, 'resumes', itemToDelete.id), {
        trashed: true,
        trashedAt: serverTimestamp()
      });
      loadResumes(user.uid);
      setShowDeleteModal(false);
      setItemToDelete(null);
      showToast('Resume moved to trash', 'info');
    } catch (error) {
      showToast('Error deleting resume', 'error');
    }
  };

  const updatePersonalInfo = (field, value) => {
    setResumeData(prev => ({
      ...prev,
      personalInfo: { ...prev.personalInfo, [field]: sanitizeHtml(value) }
    }));
    setHasUnsavedChanges(true);
  };

  const addEducation = () => {
    setResumeData(prev => ({
      ...prev,
      education: [...prev.education, { degree: '', institution: '', year: '', gpa: '' }]
    }));
    setHasUnsavedChanges(true);
  };

  if (loading) return <Loading />;

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <ToastContainer toasts={toasts} />
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
          <div className="text-center mb-8">
            <FileText className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-800">Resume Builder</h1>
            <p className="text-gray-600 mt-2">Create professional resumes in minutes</p>
          </div>
          <div className="flex gap-2 mb-6">
            <button onClick={() => setAuthMode('login')} className={`flex-1 py-2 rounded-lg font-semibold transition ${authMode === 'login' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-600'}`}>Login</button>
            <button onClick={() => setAuthMode('signup')} className={`flex-1 py-2 rounded-lg font-semibold transition ${authMode === 'signup' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-600'}`}>Sign Up</button>
          </div>
          {authError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{authError}</div>}
          <form onSubmit={authMode === 'login' ? handleLogin : handleSignup}>
            {authMode === 'signup' && <div className="mb-4"><label className="block text-gray-700 text-sm font-semibold mb-2">Full Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter your name" required /></div>}
            <div className="mb-4"><label className="block text-gray-700 text-sm font-semibold mb-2">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="your@email.com" required /></div>
            <div className="mb-6"><label className="block text-gray-700 text-sm font-semibold mb-2">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter your password" required minLength="6" />{authMode === 'signup' && <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>}</div>
            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold">{authMode === 'login' ? 'Login' : 'Sign Up'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer toasts={toasts} />
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-800">Resume Builder</h1>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={toggleDarkMode} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200" title="Toggle dark mode">{isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
            {hasUnsavedChanges && <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full"><AlertCircle className="w-4 h-4" />Unsaved</div>}
            {autoSaving && <div className="flex items-center gap-2 text-sm text-gray-500"><RefreshCw className="w-4 h-4 animate-spin" />Saving...</div>}
            {lastSaved && !autoSaving && <div className="text-sm text-gray-500 flex items-center gap-1"><CheckCircle className="w-4 h-4 text-green-600" />{getRelativeTime(lastSaved)}</div>}
            <button onClick={() => setCurrentView('dashboard')} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Dashboard</button>
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><LogOut className="w-4 h-4" />Logout</button>
          </div>
        </div>
      </header>

      {currentView === 'dashboard' && (
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div><h2 className="text-3xl font-bold text-gray-800">My Resumes</h2><p className="text-gray-600 mt-1">Create and manage your resumes</p></div>
            <button onClick={createNewResume} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-lg"><Plus className="w-5 h-5" />Create New</button>
          </div>
          {resumes.length === 0 ? (
            <div className="text-center py-16"><FileText className="w-24 h-24 text-gray-300 mx-auto mb-4" /><h3 className="text-xl font-semibold text-gray-600 mb-2">No resumes yet</h3><p className="text-gray-500 mb-6">Create your first resume now!</p><button onClick={createNewResume} className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-lg"><Plus className="w-5 h-5" />Create Resume</button></div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {resumes.map((resume) => (
                <div key={resume.id} className="bg-white rounded-xl shadow-md hover:shadow-xl transition p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div><h3 className="font-bold text-lg text-gray-800 truncate">{resume.data?.personalInfo?.fullName || 'Untitled'}</h3><p className="text-sm text-gray-500 capitalize">{resume.template || 'modern'}</p>{resume.updatedAt && <p className="text-xs text-gray-400 mt-1">Updated {getRelativeTime(resume.updatedAt.toDate())}</p>}</div>
                    <Layout className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => loadResume(resume)} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit3 className="w-4 h-4" />Edit</button>
                    <button onClick={() => { setItemToDuplicate(resume); setShowDuplicateModal(true); }} className="px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100" title="Duplicate"><Copy className="w-4 h-4" /></button>
                    <button onClick={() => { setItemToDelete(resume); setShowDeleteModal(true); }} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {currentView === 'builder' && (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Resume Builder</h2>
            <div className="flex gap-2">
              <button onClick={saveResume} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" title="Ctrl+S"><Save className="w-4 h-4" />Save</button>
              <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"><Download className="w-4 h-4" />PDF</button>
            </div>
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Personal Information</h3>
                <div className="space-y-4">
                  <input type="text" placeholder="Full Name *" value={resumeData.personalInfo.fullName} onChange={(e) => updatePersonalInfo('fullName', e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" required maxLength="80" />
                  <input type="email" placeholder="Email *" value={resumeData.personalInfo.email} onChange={(e) => updatePersonalInfo('email', e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" required />
                  <input type="tel" placeholder="Phone" value={resumeData.personalInfo.phone} onChange={(e) => updatePersonalInfo('phone', e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                  <input type="text" placeholder="Location" value={resumeData.personalInfo.location} onChange={(e) => updatePersonalInfo('location', e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                  <textarea placeholder="Summary" value={resumeData.personalInfo.summary} onChange={(e) => updatePersonalInfo('summary', e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" rows="4" maxLength="500" />
                </div>
              </div>
            </div>
            <div><div className="bg-white rounded-xl shadow-lg p-4"><h3 className="text-lg font-bold text-gray-800 mb-4">Preview</h3><div className="border rounded-lg p-8"><h1 className="text-2xl font-bold mb-2">{resumeData.personalInfo.fullName || 'Your Name'}</h1><p className="text-sm text-gray-600">{resumeData.personalInfo.email} {resumeData.personalInfo.phone && ` • ${resumeData.personalInfo.phone}`}</p>{resumeData.personalInfo.summary && <p className="mt-4 text-sm">{resumeData.personalInfo.summary}</p>}</div></div></div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showDeleteModal && <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="bg-white rounded-xl p-6 max-w-md w-full"><h3 className="text-xl font-bold mb-4">Confirm Delete</h3><p className="text-gray-600 mb-6">Are you sure you want to delete <strong>{itemToDelete?.data?.personalInfo?.fullName}</strong>?</p><div className="flex gap-3"><button onClick={deleteResume} className="flex-1 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700">Delete</button><button onClick={() => setShowDeleteModal(false)} className="flex-1 border py-3 rounded-lg hover:bg-gray-50">Cancel</button></div></div></div>}
      {showDuplicateModal && <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="bg-white rounded-xl p-6 max-w-md w-full"><h3 className="text-xl font-bold mb-4">Duplicate Resume</h3><p className="text-gray-600 mb-6">Create a copy of <strong>{itemToDuplicate?.data?.personalInfo?.fullName}</strong>?</p><div className="flex gap-3"><button onClick={() => duplicateResume(itemToDuplicate)} className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700">Duplicate</button><button onClick={() => setShowDuplicateModal(false)} className="flex-1 border py-3 rounded-lg hover:bg-gray-50">Cancel</button></div></div></div>}
    </div>
  );
};

export default ResumeBuilder;