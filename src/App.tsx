import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db, auth } from './firebase';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, getDoc, deleteDoc, updateDoc, setDoc, getDocFromCache, getDocFromServer } from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import Chat from './components/Chat';
import { Heart, Droplets, Users, Phone, Search, UserPlus, Filter, X, LogIn, LogOut, Settings, Trash2, CheckCircle, AlertCircle, User as UserIcon, Share2, Bot, Calendar, MapPin, Edit2, BarChart3, Award, TrendingUp, PieChart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [donors, setDonors] = useState<any[]>([]);
  const [appUsers, setAppUsers] = useState<any[]>([]);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [showRegForm, setShowRegForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBG, setFilterBG] = useState('');
  const [view, setView] = useState<'public' | 'admin'>('public');
  const [adminSubView, setAdminSubView] = useState<'requests' | 'donors' | 'users' | 'reports'>('requests');
  const [adminDonorFilter, setAdminDonorFilter] = useState<'all' | 'ready'>('all');
  const [adminBloodGroupFilter, setAdminBloodGroupFilter] = useState<string>('all');
  const [mobileTab, setMobileTab] = useState<'requests' | 'chat' | 'donors'>('chat');
  const [selectedDonor, setSelectedDonor] = useState<any | null>(null);
  const [editingDonor, setEditingDonor] = useState<any | null>(null);
  
  const handleFirestoreError = (error: any, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    showNotification(`Firestore Error: ${errInfo.error}`, 'error');
    throw new Error(JSON.stringify(errInfo));
  };

  // Registration Form State
  const [regData, setRegData] = useState({
    name: '',
    bloodGroup: '',
    location: '',
    mobileNumber: '',
    lastDonationDate: '',
    donationCount: 0
  });

  // User Form State
  const [userData, setUserData] = useState({
    email: '',
    role: 'editor',
    uid: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const checkParams = () => {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
      if (params.get('register') === 'true' || hashParams.get('register') === 'true') {
        setShowRegForm(true);
      }
    };
    checkParams();
    window.addEventListener('hashchange', checkParams);
    return () => window.removeEventListener('hashchange', checkParams);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Sync profile
        try {
          await setDoc(doc(db, "profiles", u.uid), {
            email: u.email,
            displayName: u.displayName,
            photoURL: u.photoURL,
            lastLogin: serverTimestamp()
          }, { merge: true });
        } catch (e) {
          console.error("Profile sync error:", e);
        }

        // Check role
        try {
          const userDoc = await getDoc(doc(db, "users", u.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role);
          } else if (u.email === "enevtinfo@gmail.com") {
            setUserRole('admin');
          } else {
            setUserRole(null);
          }
        } catch (e) {
          if (u.email === "enevtinfo@gmail.com") {
            setUserRole('admin');
          } else {
            console.error("Role check error:", e);
            setUserRole(null);
          }
        }
      } else {
        setUserRole(null);
        setView('public');
      }
    });

    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    };
    testConnection();

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const qRequests = query(
      collection(db, "bloodRequests"),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const qDonors = query(
      collection(db, "donors"),
      orderBy("createdAt", "desc")
    );

    const unsubRequests = onSnapshot(qRequests, (snapshot) => {
      setRecentRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, "bloodRequests"));

    const unsubDonors = onSnapshot(qDonors, (snapshot) => {
      setDonors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, "donors"));

    let unsubUsers = () => {};
    let unsubProfiles = () => {};

    if (userRole === 'admin') {
      const qUsers = query(collection(db, "users"));
      unsubUsers = onSnapshot(qUsers, (snapshot) => {
        setAppUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => handleFirestoreError(error, OperationType.LIST, "users"));

      const qProfiles = query(collection(db, "profiles"), orderBy("lastLogin", "desc"), limit(50));
      unsubProfiles = onSnapshot(qProfiles, (snapshot) => {
        setAllProfiles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => handleFirestoreError(error, OperationType.LIST, "profiles"));
    }

    return () => {
      unsubRequests();
      unsubDonors();
      unsubUsers();
      unsubProfiles();
    };
  }, [userRole]);

  const [showConfirmReg, setShowConfirmReg] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string, type: 'request' | 'donor' | 'user' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData.email || !userData.role || !userData.uid) return;
    setIsSubmitting(true);
    try {
      await setDoc(doc(db, "users", userData.uid), {
        email: userData.email,
        role: userData.role,
        uid: userData.uid
      });
      setShowUserForm(false);
      setUserData({ email: '', role: 'editor', uid: '' });
      showNotification('ইউজার সফলভাবে যোগ করা হয়েছে।');
    } catch (error) {
      console.error("Add user error:", error);
      showNotification('ইউজার যোগ করতে সমস্যা হয়েছে।', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUserRole = async (id: string, newRole: string) => {
    try {
      const userRef = doc(db, "users", id);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        await updateDoc(userRef, { role: newRole });
      } else {
        // If document doesn't exist, we need to create it with email and uid
        // We can try to get this info from the profiles collection
        const profileSnap = await getDoc(doc(db, "profiles", id));
        if (profileSnap.exists()) {
          await setDoc(userRef, {
            email: profileSnap.data().email,
            uid: id,
            role: newRole
          });
        } else {
          showNotification('ইউজারের প্রোফাইল পাওয়া যায়নি। ম্যানুয়ালি যোগ করুন।', 'error');
          return;
        }
      }
      showNotification('রোল সফলভাবে আপডেট করা হয়েছে।');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${id}`);
    }
  };

  const handleDeleteUser = async (id: string) => {
    setPendingDelete({ id, type: 'user' });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regData.name || !regData.bloodGroup || !regData.location || !regData.mobileNumber) return;
    
    // Validate lastDonationDate if provided
    if (regData.lastDonationDate) {
      const selectedDate = new Date(regData.lastDonationDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (isNaN(selectedDate.getTime())) {
        showNotification('সঠিক তারিখ নির্বাচন করুন।', 'error');
        return;
      }
      
      if (selectedDate > today) {
        showNotification('শেষ রক্তদানের তারিখ ভবিষ্যতে হতে পারে না।', 'error');
        return;
      }
    }
    
    setShowConfirmReg(true);
  };

  const copyRegLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('register', 'true');
    navigator.clipboard.writeText(url.toString());
    showNotification('নিবন্ধন লিংক কপি করা হয়েছে!');
  };

  const confirmRegistration = async () => {
    setIsSubmitting(true);
    try {
      const donorId = `donor_${Date.now()}`;
      await addDoc(collection(db, "donors"), {
        ...regData,
        uid: donorId,
        createdAt: serverTimestamp()
      });
      setShowRegForm(false);
      setShowConfirmReg(false);
      setRegData({ name: '', bloodGroup: '', location: '', mobileNumber: '', lastDonationDate: '', donationCount: 0 });
      showNotification('সফলভাবে নিবন্ধিত হয়েছেন!');
    } catch (error) {
      console.error("Registration error:", error);
      showNotification('নিবন্ধন করতে সমস্যা হয়েছে।', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    setPendingDelete({ id, type: 'request' });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.type === 'request') {
        await deleteDoc(doc(db, "bloodRequests", pendingDelete.id));
      } else if (pendingDelete.type === 'donor') {
        await deleteDoc(doc(db, "donors", pendingDelete.id));
      } else if (pendingDelete.type === 'user') {
        await deleteDoc(doc(db, "users", pendingDelete.id));
      }
      showNotification('সফলভাবে মুছে ফেলা হয়েছে।');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${pendingDelete.type}s/${pendingDelete.id}`);
    } finally {
      setPendingDelete(null);
    }
  };

  const handleMarkFulfilled = async (id: string) => {
    try {
      await updateDoc(doc(db, "bloodRequests", id), { status: 'fulfilled' });
      showNotification('আবেদনটি সফলভাবে আপডেট করা হয়েছে।');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bloodRequests/${id}`);
    }
  };

  const handleUpdateDonor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDonor) return;
    setIsSubmitting(true);
    try {
      const { id, ...data } = editingDonor;
      await updateDoc(doc(db, "donors", id), data);
      setEditingDonor(null);
      showNotification('রক্তদাতার তথ্য সফলভাবে আপডেট করা হয়েছে।');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `donors/${editingDonor.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDonor = async (id: string) => {
    setPendingDelete({ id, type: 'donor' });
  };

  const getDonationStatus = (lastDonationDate: string) => {
    if (!lastDonationDate) return { ready: true, daysLeft: 0 };
    const lastDate = new Date(lastDonationDate);
    const today = new Date();
    const diffTime = today.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const ready = diffDays >= 90;
    const daysLeft = ready ? 0 : 90 - diffDays;
    return { ready, daysLeft };
  };

  const isEligible = (lastDonationDate: string) => {
    return getDonationStatus(lastDonationDate).ready;
  };

  const getReportData = () => {
    const totalDonors = donors.length;
    const totalRequests = recentRequests.length;
    const fulfilledRequests = recentRequests.filter(r => r.status === 'fulfilled').length;
    
    const bloodGroupStats: Record<string, number> = {};
    donors.forEach(d => {
      bloodGroupStats[d.bloodGroup] = (bloodGroupStats[d.bloodGroup] || 0) + 1;
    });

    const specialDonors = donors.filter(d => (d.donationCount || 0) >= 5).length;

    return {
      totalDonors,
      totalRequests,
      fulfilledRequests,
      specialDonors,
      bloodGroupStats
    };
  };

  const filteredDonors = donors.filter(d => {
    const matchesSearch = d.location?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         d.mobileNumber?.includes(searchQuery);
    const matchesBG = filterBG ? d.bloodGroup === filterBG : true;
    return matchesSearch && matchesBG;
  });

  const canManage = userRole === 'admin' || userRole === 'moderator' || userRole === 'editor';

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-red-600 p-1.5 sm:p-2 rounded-lg">
              <Droplets className="text-white" size={20} />
            </div>
            <h1 className="font-bold text-base sm:text-xl tracking-tight text-red-900 truncate max-w-[100px] xs:max-w-[150px] sm:max-w-none">এক টুকরো হোমনা</h1>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-4">
            {canManage && (
              <button
                onClick={() => setView(view === 'public' ? 'admin' : 'public')}
                className={`flex items-center gap-2 px-2 sm:px-4 py-2 rounded-xl font-medium transition-colors text-xs sm:text-sm ${
                  view === 'admin' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title={view === 'admin' ? 'পাবলিক ভিউ' : 'ম্যানেজমেন্ট'}
              >
                <Settings size={18} />
                <span className="hidden sm:inline">{view === 'admin' ? 'পাবলিক ভিউ' : 'ম্যানেজমেন্ট'}</span>
              </button>
            )}
            
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setShowRegForm(true)}
                className="flex items-center gap-2 bg-red-600 text-white px-3 sm:px-4 py-2 rounded-xl font-medium hover:bg-red-700 transition-colors text-xs sm:text-sm"
              >
                <UserPlus size={18} />
                <span className="hidden sm:inline">নিবন্ধন করুন</span>
              </button>
              <button
                onClick={copyRegLink}
                className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
                title="Copy registration link"
              >
                <Share2 size={18} />
              </button>
            </div>

            {user ? (
              <div className="flex items-center gap-2">
                <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600 transition-colors" title="Logout">
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="flex items-center gap-2 bg-slate-900 text-white px-3 sm:px-4 py-2 rounded-xl font-medium hover:bg-slate-800 transition-colors text-xs sm:text-sm"
              >
                <LogIn size={18} />
                <span className="hidden sm:inline">লগইন</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        {view === 'public' ? (
          <>
            {/* Mobile Tabs */}
            <div className="lg:hidden flex gap-1 mb-6 bg-white p-1 rounded-2xl border border-slate-200 sticky top-20 z-40 shadow-sm">
              <button 
                onClick={() => setMobileTab('requests')} 
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  mobileTab === 'requests' ? 'bg-red-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Droplets size={14} />
                আবেদন
              </button>
              <button 
                onClick={() => setMobileTab('chat')} 
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  mobileTab === 'chat' ? 'bg-red-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Bot size={14} />
                চ্যাট
              </button>
              <button 
                onClick={() => setMobileTab('donors')} 
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  mobileTab === 'donors' ? 'bg-red-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Search size={14} />
                দাতা
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Stats & Requests (3 cols) */}
              <div className={`lg:col-span-3 space-y-6 ${mobileTab === 'requests' ? 'block' : 'hidden lg:block'}`}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-600 rounded-3xl p-6 text-white shadow-lg shadow-red-200"
              >
                <h2 className="text-xl font-bold mb-2">রক্ত দিন, জীবন বাঁচান</h2>
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 mt-4">
                  <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm flex items-center gap-3">
                    <Users size={24} />
                    <div>
                      <p className="text-[10px] opacity-80 uppercase tracking-wider">রক্তদাতা</p>
                      <p className="text-xl font-bold">{donors.length}</p>
                    </div>
                  </div>
                  <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm flex items-center gap-3">
                    <Heart size={24} />
                    <div>
                      <p className="text-[10px] opacity-80 uppercase tracking-wider">আবেদন</p>
                      <p className="text-xl font-bold">{recentRequests.length}</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Droplets className="text-red-600" size={20} />
                  জরুরী আবেদন
                </h3>
                <div className="space-y-3">
                  {recentRequests.filter(r => r.status !== 'fulfilled').map((req) => (
                    <div key={req.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-red-600 font-bold">{req.bloodGroup}</span>
                        <span className="text-[10px] text-slate-400">
                          {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString() : 'Just now'}
                        </span>
                      </div>
                      <p className="font-medium text-slate-700 truncate">{req.location}</p>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <Phone size={10} /> {req.contactNumber}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Center Column: AI Chat (5 cols) */}
            <div className={`lg:col-span-5 space-y-6 ${mobileTab === 'chat' ? 'block' : 'hidden lg:block'}`}>
              <div className="bg-white rounded-2xl sm:rounded-3xl p-1 sm:p-2 shadow-sm border border-slate-100">
                <Chat />
              </div>
            </div>

            {/* Right Column: Donor List & Search (4 cols) */}
            <div className={`lg:col-span-4 space-y-6 ${mobileTab === 'donors' ? 'block' : 'hidden lg:block'}`}>
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 h-full flex flex-col">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Search className="text-red-600" size={20} />
                  রক্তদাতা খুঁজুন
                </h3>
                
                <div className="space-y-3 mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="নাম বা এলাকা দিয়ে খুঁজুন..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                      <button
                        key={bg}
                        onClick={() => setFilterBG(filterBG === bg ? '' : bg)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                          filterBG === bg ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {bg}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {filteredDonors.length > 0 ? (
                    filteredDonors.map((donor) => {
                      const ready = isEligible(donor.lastDonationDate);
                      return (
                        <div key={donor.id} className={`p-4 bg-white border rounded-2xl shadow-sm transition-colors ${
                          ready ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100'
                        }`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-slate-800">{donor.name}</p>
                                {ready && (
                                  <span className="flex items-center gap-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">
                                    <CheckCircle size={10} /> প্রস্তুত
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                <Filter size={10} /> {donor.location}
                              </p>
                              <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                                <Phone size={10} /> {donor.mobileNumber}
                              </p>
                              {donor.lastDonationDate && (
                                <p className="text-[10px] text-slate-400 mt-1 italic">
                                  শেষ দান: {new Date(donor.lastDonationDate).toLocaleDateString('bn-BD')}
                                </p>
                              )}
                            </div>
                            <span className="bg-red-100 text-red-700 px-2 py-1 rounded-lg text-xs font-black shrink-0">
                              {donor.bloodGroup}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-slate-400 text-sm italic">কোনো রক্তদাতা পাওয়া যায়নি।</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">ম্যানেজমেন্ট ড্যাশবোর্ড</h2>
              <div className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-xl text-sm font-bold">
                <Users size={18} />
                রোল: {userRole?.toUpperCase()}
              </div>
            </div>

            {/* Admin Sub-navigation */}
            <div className="flex gap-4 border-b border-slate-200">
              <button
                onClick={() => setAdminSubView('requests')}
                className={`pb-4 px-2 font-bold transition-colors relative ${
                  adminSubView === 'requests' ? 'text-red-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                আবেদনসমূহ
                {adminSubView === 'requests' && <motion.div layoutId="subnav" className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-t-full" />}
              </button>
              <button
                onClick={() => setAdminSubView('donors')}
                className={`pb-4 px-2 font-bold transition-colors relative ${
                  adminSubView === 'donors' ? 'text-red-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                রক্তদাতাগণ
                {adminSubView === 'donors' && <motion.div layoutId="subnav" className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-t-full" />}
              </button>
              <button
                onClick={() => setAdminSubView('reports')}
                className={`pb-4 px-2 font-bold transition-colors relative ${
                  adminSubView === 'reports' ? 'text-red-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                রিপোর্ট
                {adminSubView === 'reports' && <motion.div layoutId="subnav" className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-t-full" />}
              </button>
              {userRole === 'admin' && (
                <button
                  onClick={() => setAdminSubView('users')}
                  className={`pb-4 px-2 font-bold transition-colors relative ${
                    adminSubView === 'users' ? 'text-red-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  ম্যানেজারগণ
                  {adminSubView === 'users' && <motion.div layoutId="subnav" className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-t-full" />}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-8">
              {adminSubView === 'requests' && (
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-900 mb-4">রক্তের আবেদনসমূহ</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recentRequests.map(req => (
                      <div key={req.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-red-600">{req.bloodGroup}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              req.status === 'fulfilled' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                            }`}>
                              {req.status}
                            </span>
                          </div>
                          <p className="text-sm font-medium">{req.location}</p>
                          <p className="text-xs text-slate-500">{req.contactNumber}</p>
                        </div>
                        <div className="flex gap-2">
                          {req.status !== 'fulfilled' && (
                            <button
                              onClick={() => handleMarkFulfilled(req.id)}
                              className="p-2 bg-white text-red-600 rounded-xl border border-red-100 hover:bg-red-50 transition-colors"
                              title="Mark as Fulfilled"
                            >
                              <CheckCircle size={18} />
                            </button>
                          )}
                          {(userRole === 'admin' || userRole === 'moderator') && (
                            <button
                              onClick={() => handleDeleteRequest(req.id)}
                              className="p-2 bg-white text-red-600 rounded-xl border border-red-100 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {adminSubView === 'donors' && (
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <h3 className="font-bold text-slate-900">রক্তদাতাদের তালিকা</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={adminBloodGroupFilter}
                        onChange={(e) => setAdminBloodGroupFilter(e.target.value)}
                        className="bg-slate-100 text-slate-900 text-xs font-bold px-3 py-2 rounded-xl border-none focus:ring-2 focus:ring-red-500 cursor-pointer outline-none"
                      >
                        <option value="all">সব গ্রুপ</option>
                        {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                      <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button
                          onClick={() => setAdminDonorFilter('all')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            adminDonorFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          সবাই
                        </button>
                        <button
                          onClick={() => setAdminDonorFilter('ready')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            adminDonorFilter === 'ready' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          প্রস্তুত (Ready)
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {donors
                      .filter(d => (adminDonorFilter === 'all' || isEligible(d.lastDonationDate)) && (adminBloodGroupFilter === 'all' || d.bloodGroup === adminBloodGroupFilter))
                      .map(donor => {
                        const { ready, daysLeft } = getDonationStatus(donor.lastDonationDate);
                        const isSpecial = (donor.donationCount || 0) >= 5;
                        return (
                          <motion.div 
                            key={donor.id} 
                            whileHover={{ scale: 1.02 }}
                            onClick={() => setSelectedDonor(donor)}
                            className={`p-5 rounded-[2rem] border flex justify-between items-center transition-all cursor-pointer hover:shadow-xl group relative overflow-hidden ${
                            isSpecial 
                              ? 'bg-gradient-to-br from-amber-50 via-white to-red-50 border-amber-300 shadow-lg shadow-amber-100/50 ring-1 ring-amber-200' 
                              : ready ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-slate-100'
                          }`}>
                            {isSpecial && (
                              <>
                                <div className="absolute -right-8 -top-8 w-20 h-20 bg-amber-400/10 rounded-full blur-2xl" />
                                <div className="absolute -right-4 -top-4 w-12 h-12 bg-amber-500 rotate-45 flex items-end justify-center pb-1 shadow-lg">
                                  <Award size={14} className="text-white -rotate-45 mb-0.5" />
                                </div>
                              </>
                            )}
                            <div className="relative z-10">
                              <div className="flex items-center gap-2 mb-1">
                                <p className={`font-black text-lg transition-colors ${isSpecial ? 'text-amber-900' : 'text-slate-900 group-hover:text-red-600'}`}>
                                  {donor.name}
                                </p>
                                {isSpecial && (
                                  <div className="flex items-center gap-1 bg-amber-500 text-white text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-sm">
                                    <Heart size={8} fill="currentColor" /> Life Saver
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <p className="text-xs font-bold text-slate-500 flex items-center gap-1">
                                  <Droplets size={12} className="text-red-500" />
                                  {donor.bloodGroup}
                                </p>
                                <p className="text-xs text-slate-400 flex items-center gap-1">
                                  <MapPin size={12} />
                                  {donor.location}
                                </p>
                              </div>

                              <div className="flex items-center gap-3 mt-3">
                                <div className={`px-2 py-1 rounded-lg flex items-center gap-1.5 ${isSpecial ? 'bg-amber-100 text-amber-700' : 'bg-slate-200/50 text-slate-500'}`}>
                                  <TrendingUp size={10} />
                                  <span className="text-[10px] font-black uppercase">Donations: {donor.donationCount || 0}</span>
                                </div>
                                
                                {ready ? (
                                  <span className="bg-emerald-100 text-emerald-700 text-[9px] px-2 py-1 rounded-lg font-black uppercase flex items-center gap-1">
                                    <CheckCircle size={10} /> Ready
                                  </span>
                                ) : (
                                  <span className="bg-slate-100 text-slate-500 text-[9px] px-2 py-1 rounded-lg font-black uppercase">
                                    {daysLeft} days left
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-2 relative z-10">
                              {(userRole === 'admin' || userRole === 'moderator' || userRole === 'editor') && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingDonor(donor);
                                  }}
                                  className={`p-2 bg-white rounded-xl border transition-colors ${isSpecial ? 'text-amber-600 border-amber-100 hover:bg-amber-50' : 'text-emerald-600 border-emerald-100 hover:bg-emerald-50'}`}
                                  title="Edit"
                                >
                                  <Edit2 size={18} />
                                </button>
                              )}
                              {(userRole === 'admin' || userRole === 'moderator') && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteDonor(donor.id);
                                  }}
                                  className="p-2 bg-white text-red-600 rounded-xl border border-red-100 hover:bg-red-50 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                  </div>
                </div>
              )}

              {adminSubView === 'reports' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                        <Users size={24} />
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">মোট রক্তদাতা</p>
                      <h4 className="text-3xl font-black text-slate-900">{getReportData().totalDonors}</h4>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-4">
                        <Droplets size={24} />
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">রক্তের অনুরোধ</p>
                      <h4 className="text-3xl font-black text-slate-900">{getReportData().totalRequests}</h4>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                        <CheckCircle size={24} />
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">সফল রক্তদান</p>
                      <h4 className="text-3xl font-black text-slate-900">{getReportData().fulfilledRequests}</h4>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
                        <Award size={24} />
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">স্পেশাল রক্তদাতা (৫+)</p>
                      <h4 className="text-3xl font-black text-slate-900">{getReportData().specialDonors}</h4>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                      <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <PieChart size={20} className="text-red-600" />
                        গ্রুপ ভিত্তিক রক্তদাতা
                      </h3>
                      <div className="space-y-4">
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => {
                          const count = getReportData().bloodGroupStats[bg] || 0;
                          const percentage = getReportData().totalDonors > 0 
                            ? (count / getReportData().totalDonors) * 100 
                            : 0;
                          return (
                            <div key={bg} className="space-y-1">
                              <div className="flex justify-between text-sm font-bold">
                                <span className="text-slate-600">{bg}</span>
                                <span className="text-slate-900">{count} জন</span>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${percentage}%` }}
                                  className="h-full bg-red-500 rounded-full"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                      <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <TrendingUp size={20} className="text-red-600" />
                        সাম্প্রতিক কার্যক্রম
                      </h3>
                      <div className="space-y-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-sm font-bold text-slate-900">সফলতার হার</p>
                          <p className="text-2xl font-black text-emerald-600">
                            {getReportData().totalRequests > 0 
                              ? Math.round((getReportData().fulfilledRequests / getReportData().totalRequests) * 100) 
                              : 0}%
                          </p>
                          <p className="text-xs text-slate-400 mt-1">মোট অনুরোধের বিপরীতে সফল রক্তদান</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-sm font-bold text-slate-900">গড় রক্তদান</p>
                          <p className="text-2xl font-black text-blue-600">
                            {(donors.reduce((acc, curr) => acc + (curr.donationCount || 0), 0) / (donors.length || 1)).toFixed(1)}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">প্রতি রক্তদাতার গড় রক্তদানের সংখ্যা</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {adminSubView === 'users' && userRole === 'admin' && (
                <div className="space-y-8">
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-slate-900">ম্যানেজারদের তালিকা</h3>
                      <button
                        onClick={() => setShowUserForm(true)}
                        className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-red-700 transition-colors text-sm"
                      >
                        <UserPlus size={18} />
                        নতুন ম্যানেজার যোগ করুন
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {appUsers.map(u => (
                        <div key={u.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-bold text-sm truncate max-w-[150px]">{u.email}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{u.uid}</p>
                            </div>
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-1 text-red-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className="flex gap-2">
                            {['admin', 'moderator', 'editor'].map(role => (
                              <button
                                key={role}
                                onClick={() => handleUpdateUserRole(u.id, role)}
                                className={`flex-1 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors ${
                                  u.role === role ? 'bg-red-600 text-white' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'
                                }`}
                              >
                                {role}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                      <Users className="text-red-600" size={20} />
                      সাম্প্রতিক লগইন করা ইউজারগণ (এখান থেকে ম্যানেজার বানান)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {allProfiles.map(p => {
                        const isAlreadyManager = appUsers.some(au => au.uid === p.id);
                        return (
                          <div key={p.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {p.photoURL ? (
                                <img src={p.photoURL} alt="" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                                  <UserIcon size={20} />
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-sm">{p.displayName || 'অজানা ইউজার'}</p>
                                <p className="text-xs text-slate-500 truncate max-w-[120px]">{p.email}</p>
                              </div>
                            </div>
                            {!isAlreadyManager ? (
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={() => handleUpdateUserRole(p.id, 'editor')}
                                  className="px-2 py-1 bg-white border border-red-100 text-red-600 rounded-lg text-[10px] font-bold hover:bg-red-50 transition-colors"
                                >
                                  Make Editor
                                </button>
                                <button
                                  onClick={() => handleUpdateUserRole(p.id, 'moderator')}
                                  className="px-2 py-1 bg-white border border-red-100 text-red-600 rounded-lg text-[10px] font-bold hover:bg-red-50 transition-colors"
                                >
                                  Make Mod
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded-lg font-bold">
                                Already Manager
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Registration Modal */}
      <AnimatePresence>
        {showRegForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="bg-red-600 p-6 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold">রক্তদাতা নিবন্ধন</h3>
                  <button 
                    onClick={copyRegLink}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium"
                    title="Copy direct registration link"
                  >
                    <Share2 size={14} />
                    লিংক কপি করুন
                  </button>
                </div>
                <button onClick={() => setShowRegForm(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleRegister} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">পূর্ণ নাম</label>
                  <input
                    required
                    type="text"
                    value={regData.name}
                    onChange={(e) => setRegData({...regData, name: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="আপনার নাম লিখুন"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">রক্তের গ্রুপ</label>
                    <select
                      required
                      value={regData.bloodGroup}
                      onChange={(e) => setRegData({...regData, bloodGroup: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="">নির্বাচন করুন</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">মোবাইল নম্বর</label>
                    <input
                      required
                      type="tel"
                      value={regData.mobileNumber}
                      onChange={(e) => setRegData({...regData, mobileNumber: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="017XXXXXXXX"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">এলাকা/ঠিকানা</label>
                  <input
                    required
                    type="text"
                    value={regData.location}
                    onChange={(e) => setRegData({...regData, location: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="আপনার এলাকা লিখুন"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">শেষ রক্তদানের তারিখ (ঐচ্ছিক)</label>
                  <input
                    type="date"
                    max={new Date().toISOString().split('T')[0]}
                    value={regData.lastDonationDate}
                    onChange={(e) => setRegData({...regData, lastDonationDate: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">মোট কতবার রক্ত দিয়েছেন?</label>
                  <input
                    type="number"
                    min="0"
                    value={regData.donationCount}
                    onChange={(e) => setRegData({...regData, donationCount: parseInt(e.target.value) || 0})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="0"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100 disabled:opacity-50"
                >
                  {isSubmitting ? 'প্রসেসিং হচ্ছে...' : 'নিবন্ধন সম্পন্ন করুন'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Donor Detail Modal */}
      <AnimatePresence>
        {selectedDonor && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-red-600 p-8 text-white relative">
                <button 
                  onClick={() => setSelectedDonor(null)} 
                  className="absolute top-6 right-6 hover:bg-white/20 p-2 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur-md border border-white/30">
                    <span className="text-3xl font-black">{selectedDonor.bloodGroup}</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-1">{selectedDonor.name}</h3>
                    <p className="text-white/80 flex items-center gap-2 text-sm">
                      <MapPin size={14} /> {selectedDonor.location}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-8 space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">মোবাইল নম্বর</p>
                    <p className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Phone size={18} className="text-red-600" />
                      {selectedDonor.mobileNumber}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">রক্তের গ্রুপ</p>
                    <p className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Droplets size={18} className="text-red-600" />
                      {selectedDonor.bloodGroup}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <Calendar size={18} className="text-red-600" />
                    রক্তদানের ইতিহাস
                  </h4>
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {selectedDonor.donationHistory && selectedDonor.donationHistory.length > 0 ? (
                      [...selectedDonor.donationHistory].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((history: any, idx: number) => (
                        <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center">
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {new Date(history.date).toLocaleDateString('bn-BD', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <MapPin size={10} /> {history.location}
                            </p>
                          </div>
                          <div className="bg-red-50 text-red-600 px-2 py-1 rounded-lg text-[9px] font-bold uppercase">
                            Donated
                          </div>
                        </div>
                      ))
                    ) : selectedDonor.lastDonationDate ? (
                      <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex justify-between items-center">
                        <div>
                          <p className="text-sm font-bold text-emerald-900">শেষ রক্তদান</p>
                          <p className="text-xs text-emerald-600">
                            {new Date(selectedDonor.lastDonationDate).toLocaleDateString('bn-BD', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                        <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                          {isEligible(selectedDonor.lastDonationDate) ? 'Ready to Donate' : 'Resting'}
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl text-center">
                        <p className="text-slate-400 text-sm italic">কোনো পূর্ববর্তী রক্তদানের তথ্য পাওয়া যায়নি।</p>
                      </div>
                    )}
                    
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">নিবন্ধনের তারিখ</p>
                      <p className="text-sm font-medium text-slate-700">
                        {selectedDonor.createdAt?.toDate ? 
                          selectedDonor.createdAt.toDate().toLocaleDateString('bn-BD', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          }) : 'Just now'}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedDonor(null)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95"
                >
                  বন্ধ করুন
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Donor Modal */}
      <AnimatePresence>
        {editingDonor && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="bg-red-600 p-6 text-white flex justify-between items-center">
                <h3 className="text-xl font-bold">রক্তদাতার তথ্য এডিট করুন</h3>
                <button onClick={() => setEditingDonor(null)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleUpdateDonor} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">পূর্ণ নাম</label>
                  <input
                    required
                    type="text"
                    value={editingDonor.name || ''}
                    onChange={(e) => setEditingDonor({...editingDonor, name: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">রক্তের গ্রুপ</label>
                    <select
                      required
                      value={editingDonor.bloodGroup || ''}
                      onChange={(e) => setEditingDonor({...editingDonor, bloodGroup: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="" disabled>নির্বাচন করুন</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">মোবাইল নম্বর</label>
                    <input
                      required
                      type="tel"
                      value={editingDonor.mobileNumber || ''}
                      onChange={(e) => setEditingDonor({...editingDonor, mobileNumber: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">এলাকা/ঠিকানা</label>
                  <input
                    required
                    type="text"
                    value={editingDonor.location || ''}
                    onChange={(e) => setEditingDonor({...editingDonor, location: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">শেষ রক্তদানের তারিখ</label>
                  <input
                    type="date"
                    max={new Date().toISOString().split('T')[0]}
                    value={editingDonor.lastDonationDate || ''}
                    onChange={(e) => setEditingDonor({...editingDonor, lastDonationDate: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">রক্তদানের সংখ্যা (Donation Count)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingDonor.donationCount || 0}
                    onChange={(e) => setEditingDonor({...editingDonor, donationCount: parseInt(e.target.value) || 0})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">রক্তদানের ইতিহাস (Donation History)</label>
                  <div className="space-y-2 mb-3 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                    {editingDonor.donationHistory && editingDonor.donationHistory.map((h: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-slate-100 rounded-lg text-[10px]">
                        <span className="font-bold">{h.date} - {h.location}</span>
                        <button 
                          type="button"
                          onClick={() => {
                            const newHistory = editingDonor.donationHistory.filter((_: any, idx: number) => idx !== i);
                            setEditingDonor({...editingDonor, donationHistory: newHistory, donationCount: newHistory.length});
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">নতুন এন্ট্রি যোগ করুন</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" id="newHistDate" className="p-2 text-[10px] border rounded-lg focus:ring-1 focus:ring-red-500 outline-none" />
                      <input type="text" id="newHistLoc" placeholder="স্থান" className="p-2 text-[10px] border rounded-lg focus:ring-1 focus:ring-red-500 outline-none" />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const d = document.getElementById('newHistDate') as HTMLInputElement;
                        const l = document.getElementById('newHistLoc') as HTMLInputElement;
                        if (d.value && l.value) {
                          const newH = [...(editingDonor.donationHistory || []), { date: d.value, location: l.value }];
                          setEditingDonor({
                            ...editingDonor, 
                            donationHistory: newH, 
                            donationCount: newH.length,
                            lastDonationDate: newH.reduce((latest, curr) => new Date(curr.date) > new Date(latest) ? curr.date : latest, d.value)
                          });
                          d.value = ''; l.value = '';
                        }
                      }}
                      className="w-full py-2 bg-red-50 text-red-600 rounded-lg text-[10px] font-bold uppercase hover:bg-red-100 transition-colors"
                    >
                      ইতিহাসে যোগ করুন
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100 disabled:opacity-50"
                >
                  {isSubmitting ? 'আপডেট হচ্ছে...' : 'তথ্য আপডেট করুন'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Management Modal */}
      <AnimatePresence>
        {showUserForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="bg-red-600 p-6 text-white flex justify-between items-center">
                <h3 className="text-xl font-bold">নতুন ম্যানেজার যোগ করুন</h3>
                <button onClick={() => setShowUserForm(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleAddUser} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ইমেল</label>
                  <input
                    required
                    type="email"
                    value={userData.email}
                    onChange={(e) => setUserData({...userData, email: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="example@gmail.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ইউজার আইডি (UID)</label>
                  <input
                    required
                    type="text"
                    value={userData.uid}
                    onChange={(e) => setUserData({...userData, uid: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Firebase Auth UID"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">রোল (Role)</label>
                  <select
                    required
                    value={userData.role}
                    onChange={(e) => setUserData({...userData, role: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="editor">Editor</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100 disabled:opacity-50"
                >
                  {isSubmitting ? 'প্রসেসিং হচ্ছে...' : 'ম্যানেজার যোগ করুন'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmReg && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlus size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">আপনি কি নিশ্চিত?</h3>
              <p className="text-slate-500 text-sm mb-6">
                আপনি কি রক্তদাতা হিসেবে নিবন্ধন করতে চান? আপনার তথ্যগুলো আমাদের ডাটাবেসে সংরক্ষিত হবে।
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmReg(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  না, ফিরে যান
                </button>
                <button
                  onClick={confirmRegistration}
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100 disabled:opacity-50"
                >
                  {isSubmitting ? 'প্রসেসিং...' : 'হ্যাঁ, নিশ্চিত'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-xl font-bold text-white ${
              notification.type === 'success' ? 'bg-red-600' : 'bg-red-600'
            }`}
          >
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {pendingDelete && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">আপনি কি নিশ্চিত?</h3>
              <p className="text-slate-500 text-sm mb-6">
                আপনি কি নিশ্চিতভাবে এটি মুছে ফেলতে চান? এই কাজটি আর ফিরিয়ে আনা সম্ভব নয়।
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPendingDelete(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  না, ফিরে যান
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
                >
                  হ্যাঁ, মুছে ফেলুন
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="bg-white border-t border-slate-200 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex justify-center gap-4 mb-6">
            <button onClick={copyRegLink} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors">
              <Share2 size={18} />
              নিবন্ধন লিংক শেয়ার করুন
            </button>
          </div>
          <p className="text-slate-500 text-sm">© ২০২৬ এক টুকরো হোমনা। সকল অধিকার সংরক্ষিত।</p>
          <p className="text-slate-400 text-[10px] mt-1">একটি অলাভজনক স্বেচ্ছাসেবী সংগঠন।</p>
        </div>
      </footer>
    </div>
  );
}
