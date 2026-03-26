import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db, auth } from './firebase';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, getDoc, deleteDoc, updateDoc, setDoc, getDocFromCache, getDocFromServer } from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import Chat from './components/Chat';
import { Heart, Droplets, Users, Phone, Search, UserPlus, Filter, X, LogIn, LogOut, Settings, Trash2, CheckCircle, AlertCircle, User as UserIcon, Share2, Bot, Calendar, MapPin, Edit2, BarChart3, Award, TrendingUp, PieChart, History, ShieldCheck, MessageCircle, Languages } from 'lucide-react';
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
  const [lang, setLang] = useState<'bn' | 'en'>('bn');
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
  
  const t = {
    bn: {
      appName: "এক টুকরো হোমনা",
      tagline: "রক্তদান সহকারী",
      emergencyRequests: "জরুরী রক্তের আবেদন",
      donorList: "রক্তদাতা তালিকা",
      registerDonor: "রক্তদাতা হিসেবে নিবন্ধন",
      login: "লগইন",
      logout: "লগআউট",
      adminPanel: "অ্যাডমিন প্যানেল",
      publicView: "পাবলিক ভিউ",
      search: "খুঁজুন...",
      filter: "ফিল্টার",
      bloodGroup: "রক্তের গ্রুপ",
      location: "এলাকা/ঠিকানা",
      contact: "যোগাযোগ",
      lastDonated: "শেষ দান",
      ready: "প্রস্তুত",
      notReady: "বিশ্রামে আছেন",
      noRequests: "কোনো রক্তের আবেদন পাওয়া যায়নি।",
      noDonors: "কোনো রক্তদাতা পাওয়া যায়নি।",
      register: "নিবন্ধন",
      name: "নাম",
      mobile: "মোবাইল নম্বর",
      lastDonationDate: "শেষ রক্তদানের তারিখ",
      donationCount: "মোট কতবার রক্ত দিয়েছেন?",
      submit: "জমা দিন",
      cancel: "বাতিল",
      confirm: "নিশ্চিত করুন",
      edit: "এডিট",
      delete: "ডিলিট",
      admin: "অ্যাডমিন",
      moderator: "মডারেটর",
      editor: "এডিটর",
      history: "ইতিহাস",
      eligible: "রক্তদানে সক্ষম",
      notEligible: "বিশ্রামে আছেন",
      justNow: "এইমাত্র",
      chat: "চ্যাট",
      requests: "আবেদন",
      donors: "দাতা",
      share: "শেয়ার",
      copyLink: "লিংক কপি করুন",
      whatsapp: "হোয়াটসঅ্যাপ",
      smsSent: "SMS পাঠানো হয়েছে",
      error: "ত্রুটি",
      success: "সফল",
      welcome: "আসসালামু আলাইকুম",
      confirmReg: "আপনি কি নিশ্চিত যে আপনি নিবন্ধন করতে চান?",
      processing: "প্রসেসিং হচ্ছে...",
      fulfilled: "রক্ত পাওয়া গেছে",
      pending: "অপেক্ষমান",
      stats: "পরিসংখ্যান",
      reports: "রিপোর্ট",
      users: "ইউজার",
      totalDonors: "মোট রক্তদাতা",
      totalRequests: "মোট আবেদন",
      activeDonors: "সক্রিয় দাতা",
      fulfilledRequests: "সফল আবেদন",
      specialDonors: "স্পেশাল রক্তদাতা (৫+)",
      donorsByGroup: "গ্রুপ ভিত্তিক রক্তদাতা",
      people: "জন",
      recentActivity: "সাম্প্রতিক কার্যক্রম",
      successRate: "সফলতার হার",
      successRateDesc: "মোট অনুরোধের বিপরীতে সফল রক্তদান",
      avgDonations: "গড় রক্তদান",
      avgDonationsDesc: "প্রতি রক্তদাতার গড় রক্তদানের সংখ্যা",
      managerList: "ম্যানেজারদের তালিকা",
      addNewManager: "নতুন ম্যানেজার যোগ করুন",
      uidCopied: "UID কপি করা হয়েছে।",
      recentLogins: "সাম্প্রতিক লগইন করা ইউজারগণ (এখান থেকে ম্যানেজার বানান)",
      unknownUser: "অজানা ইউজার",
      donorRegistration: "রক্তদাতা নিবন্ধন",
      fullName: "পূর্ণ নাম",
      enterName: "আপনার নাম লিখুন",
      select: "নির্বাচন করুন",
      enterLocation: "আপনার এলাকা লিখুন",
      lastDonationDateOptional: "শেষ রক্তদানের তারিখ (ঐচ্ছিক)",
      howManyDonations: "মোট কতবার রক্ত দিয়েছেন?",
      completeRegistration: "নিবন্ধন সম্পন্ন করুন",
      totalDonations: "মোট রক্তদান",
      times: "বার",
      registrationDate: "নিবন্ধনের তারিখ",
      donationHistory: "রক্তদানের ইতিহাস",
      donated: "রক্ত দিয়েছেন",
      lastDonation: "শেষ রক্তদান",
      latest: "সর্বশেষ",
      noHistory: "কোনো পূর্ববর্তী রক্তদানের তথ্য পাওয়া যায়নি।",
      close: "বন্ধ করুন",
      editInfo: "তথ্য এডিট করুন",
      editDonorInfo: "রক্তদাতার তথ্য এডিট করুন",
      donationCountLabel: "রক্তদানের সংখ্যা (Donation Count)",
      donationHistoryLabel: "রক্তদানের ইতিহাস (Donation History)",
      addNewEntry: "নতুন এন্ট্রি যোগ করুন",
      place: "স্থান",
      addToHistory: "ইতিহাসে যোগ করুন",
      updating: "আপডেট হচ্ছে...",
      updateInfo: "তথ্য আপডেট করুন",
      email: "ইমেল",
      userId: "ইউজার আইডি (UID)",
      role: "রোল (Role)",
      addManager: "ম্যানেজার যোগ করুন",
      areYouSure: "আপনি কি নিশ্চিত?",
      confirmRegDesc: "আপনি কি রক্তদাতা হিসেবে নিবন্ধন করতে চান? আপনার তথ্যগুলো আমাদের ডাটাবেসে সংরক্ষিত হবে।",
      noGoBack: "না, ফিরে যান",
      yesConfirm: "হ্যাঁ, নিশ্চিত",
      confirmDeleteDesc: "আপনি কি নিশ্চিতভাবে এটি মুছে ফেলতে চান? এই কাজটি আর ফিরিয়ে আনা সম্ভব নয়।",
      yesDelete: "হ্যাঁ, মুছে ফেলুন",
      firestoreError: "ফায়ারস্টোর ত্রুটি:",
      userAdded: "ইউজার সফলভাবে যোগ করা হয়েছে।",
      userAddError: "ইউজার যোগ করতে সমস্যা হয়েছে।",
      profileNotFound: "ইউজারের প্রোফাইল পাওয়া যায়নি। ম্যানুয়ালি যোগ করুন।",
      roleUpdated: "রোল সফলভাবে আপডেট করা হয়েছে।",
      selectValidDate: "সঠিক তারিখ নির্বাচন করুন।",
      futureDateError: "শেষ রক্তদানের তারিখ ভবিষ্যতে হতে পারে না।",
      regLinkCopied: "নিবন্ধন লিংক কপি করা হয়েছে!",
      registeredSuccess: "সফলভাবে নিবন্ধিত হয়েছেন!",
      regError: "নিবন্ধন করতে সমস্যা হয়েছে।",
      deletedSuccess: "সফলভাবে মুছে ফেলা হয়েছে।",
      requestUpdated: "আবেদনটি সফলভাবে আপডেট করা হয়েছে।",
      donorUpdated: "রক্তদাতার তথ্য সফলভাবে আপডেট করা হয়েছে।",
      bloodDonationSaveLife: "রক্ত দিন, জীবন বাঁচান",
      managementDashboard: "ম্যানেজমেন্ট ড্যাশবোর্ড",
      roleLabel: "রোল",
      bloodRequestsTitle: "রক্তের আবেদনসমূহ",
      donorListTitle: "রক্তদাতাদের তালিকা",
      allGroups: "সব গ্রুপ",
      everyone: "সবাই",
      confirmRoleChange: "রোল পরিবর্তন নিশ্চিত করুন",
      confirmRoleChangeDesc: "আপনি কি নিশ্চিতভাবে {email} এর রোল পরিবর্তন করে {role} করতে চান?",
      yesChange: "হ্যাঁ, পরিবর্তন করুন",
      shareRegLink: "নিবন্ধন লিংক শেয়ার করুন",
      copyright: "© ২০২৬ এক টুকরো হোমনা। সকল অধিকার সংরক্ষিত।",
      nonProfitOrg: "একটি অলাভজনক স্বেচ্ছাসেবী সংগঠন।",
      managers: "ম্যানেজারগণ",
      emergencyBloodRequestMsg: "আসসালামু আলাইকুম। জরুরী রক্তের প্রয়োজন! গ্রুপ: {group}, স্থান: {location}। যোগাযোগ: {contact}। - এক টুকরো হোমনা",
      canYouDonateMsg: "আসসালামু আলাইকুম। আপনি কি বর্তমানে রক্ত দিতে পারবেন? - এক টুকরো হোমনা",
    },
    en: {
      appName: "Ek Tukro Homna",
      tagline: "Blood Donation Assistant",
      emergencyRequests: "Emergency Blood Requests",
      donorList: "Donor List",
      registerDonor: "Register as Donor",
      login: "Login",
      logout: "Logout",
      adminPanel: "Admin Panel",
      publicView: "Public View",
      search: "Search...",
      filter: "Filter",
      bloodGroup: "Blood Group",
      location: "Location",
      contact: "Contact",
      lastDonated: "Last Donated",
      ready: "Ready",
      notReady: "On Rest",
      noRequests: "No blood requests found.",
      noDonors: "No donors found.",
      register: "Register",
      name: "Name",
      mobile: "Mobile Number",
      lastDonationDate: "Last Donation Date",
      donationCount: "Total Donations",
      submit: "Submit",
      cancel: "Cancel",
      confirm: "Confirm",
      edit: "Edit",
      delete: "Delete",
      admin: "Admin",
      moderator: "Moderator",
      editor: "Editor",
      history: "History",
      eligible: "Eligible",
      notEligible: "On Rest",
      justNow: "Just Now",
      chat: "Chat",
      requests: "Requests",
      donors: "Donors",
      share: "Share",
      copyLink: "Copy Link",
      whatsapp: "WhatsApp",
      smsSent: "SMS Sent",
      error: "Error",
      success: "Success",
      welcome: "Assalamu Alaikum",
      confirmReg: "Are you sure you want to register?",
      processing: "Processing...",
      fulfilled: "Fulfilled",
      pending: "Pending",
      stats: "Statistics",
      reports: "Reports",
      users: "Users",
      totalDonors: "Total Donors",
      totalRequests: "Total Requests",
      activeDonors: "Active Donors",
      fulfilledRequests: "Fulfilled Requests",
      specialDonors: "Special Donors (5+)",
      donorsByGroup: "Donors by Group",
      people: "People",
      recentActivity: "Recent Activity",
      successRate: "Success Rate",
      successRateDesc: "Successful donations against total requests",
      avgDonations: "Avg Donations",
      avgDonationsDesc: "Average number of donations per donor",
      managerList: "Manager List",
      addNewManager: "Add New Manager",
      uidCopied: "UID Copied.",
      recentLogins: "Recent Logins (Promote to Manager)",
      unknownUser: "Unknown User",
      donorRegistration: "Donor Registration",
      fullName: "Full Name",
      enterName: "Enter your name",
      select: "Select",
      enterLocation: "Enter your location",
      lastDonationDateOptional: "Last Donation Date (Optional)",
      howManyDonations: "How many times have you donated?",
      completeRegistration: "Complete Registration",
      totalDonations: "Total Donations",
      times: "times",
      registrationDate: "Registration Date",
      donationHistory: "Donation History",
      donated: "Donated",
      lastDonation: "Last Donation",
      latest: "Latest",
      noHistory: "No previous donation history found.",
      close: "Close",
      editInfo: "Edit Info",
      editDonorInfo: "Edit Donor Info",
      donationCountLabel: "Donation Count",
      donationHistoryLabel: "Donation History",
      addNewEntry: "Add New Entry",
      place: "Place",
      addToHistory: "Add to History",
      updating: "Updating...",
      updateInfo: "Update Info",
      email: "Email",
      userId: "User ID (UID)",
      role: "Role",
      addManager: "Add Manager",
      areYouSure: "Are you sure?",
      confirmRegDesc: "Do you want to register as a blood donor? Your information will be stored in our database.",
      noGoBack: "No, Go Back",
      yesConfirm: "Yes, Confirm",
      confirmDeleteDesc: "Are you sure you want to delete this? This action cannot be undone.",
      yesDelete: "Yes, Delete",
      firestoreError: "Firestore Error:",
      userAdded: "User added successfully.",
      userAddError: "Error adding user.",
      profileNotFound: "User profile not found. Add manually.",
      roleUpdated: "Role updated successfully.",
      selectValidDate: "Select a valid date.",
      futureDateError: "Last donation date cannot be in the future.",
      regLinkCopied: "Registration link copied!",
      registeredSuccess: "Registered successfully!",
      regError: "Error registering.",
      deletedSuccess: "Deleted successfully.",
      requestUpdated: "Request updated successfully.",
      donorUpdated: "Donor info updated successfully.",
      bloodDonationSaveLife: "Give Blood, Save Life",
      managementDashboard: "Management Dashboard",
      roleLabel: "Role",
      bloodRequestsTitle: "Blood Requests",
      donorListTitle: "Donor List",
      allGroups: "All Groups",
      everyone: "Everyone",
      confirmRoleChange: "Confirm Role Change",
      confirmRoleChangeDesc: "Are you sure you want to change the role of {email} to {role}?",
      yesChange: "Yes, Change",
      shareRegLink: "Share Registration Link",
      copyright: "© 2026 Ek Tukro Homna. All rights reserved.",
      nonProfitOrg: "A non-profit voluntary organization.",
      managers: "Managers",
      emergencyBloodRequestMsg: "Assalamu Alaikum. Emergency blood needed! Group: {group}, Location: {location}. Contact: {contact}. - Ek Tukro Homna",
      canYouDonateMsg: "Assalamu Alaikum. Can you donate blood currently? - Ek Tukro Homna",
    }
  }[lang];

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
    console.error(`${t.firestoreError} `, JSON.stringify(errInfo));
    showNotification(`${t.firestoreError} ${errInfo.error}`, 'error');
    throw new Error(JSON.stringify(errInfo));
  };

  // Registration Form State
  const [regData, setRegData] = useState({
    name: '',
    bloodGroup: '',
    location: '',
    mobileNumber: '',
    lastDonationDate: '',
    donationCount: 0,
    donationHistory: []
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
          if (u.email === "enevtinfo@gmail.com") {
            setUserRole('admin');
          } else {
            const userDoc = await getDoc(doc(db, "users", u.uid));
            if (userDoc.exists()) {
              setUserRole(userDoc.data().role);
            } else {
              setUserRole(null);
            }
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
  const [pendingRoleUpdate, setPendingRoleUpdate] = useState<{ id: string, role: string, email: string } | null>(null);

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
      showNotification(t.userAdded);
    } catch (error) {
      console.error("Add user error:", error);
      showNotification(t.userAddError, 'error');
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
          showNotification(t.profileNotFound, 'error');
          return;
        }
      }
      showNotification(t.roleUpdated);
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
        showNotification(t.selectValidDate, 'error');
        return;
      }
      
      if (selectedDate > today) {
        showNotification(t.futureDateError, 'error');
        return;
      }
    }
    
    setShowConfirmReg(true);
  };

  const copyRegLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('register', 'true');
    navigator.clipboard.writeText(url.toString());
    showNotification(t.regLinkCopied);
  };

  const confirmRegistration = async () => {
    setIsSubmitting(true);
    try {
      const donorId = `donor_${Date.now()}`;
      await addDoc(collection(db, "donors"), {
        ...regData,
        uid: auth.currentUser?.uid || donorId,
        createdAt: serverTimestamp()
      });
      setShowRegForm(false);
      setShowConfirmReg(false);
      setRegData({ name: '', bloodGroup: '', location: '', mobileNumber: '', lastDonationDate: '', donationCount: 0, donationHistory: [] });
      showNotification(t.registeredSuccess);
    } catch (error) {
      console.error("Registration error:", error);
      showNotification(t.regError, 'error');
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
      showNotification(t.deletedSuccess);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${pendingDelete.type}s/${pendingDelete.id}`);
    } finally {
      setPendingDelete(null);
    }
  };

  const handleMarkFulfilled = async (id: string) => {
    try {
      await updateDoc(doc(db, "bloodRequests", id), { status: 'fulfilled' });
      showNotification(t.requestUpdated);
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
      showNotification(t.donorUpdated);
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

  const canManage = userRole !== null && (userRole === 'admin' || userRole === 'moderator' || userRole === 'editor');

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 min-w-0">
            <div className="bg-red-600 p-1.5 rounded-lg shrink-0">
              <Droplets className="text-white" size={18} />
            </div>
            <h1 className="font-bold text-sm sm:text-xl tracking-tight text-red-900 truncate max-w-[100px] xs:max-w-[180px] sm:max-w-none">{t.appName}</h1>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-4">
            {/* Language Toggle */}
            <div className="relative flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
              <motion.div
                initial={false}
                animate={{ x: lang === 'bn' ? 0 : '100%' }}
                transition={{ type: "spring", stiffness: 400, damping: 35 }}
                className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] bg-white rounded-lg shadow-sm z-0"
              />
              <button
                onClick={() => setLang('bn')}
                className={`relative z-10 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[9px] sm:text-xs font-bold transition-colors duration-300 flex-1 min-w-[40px] sm:min-w-[80px] ${
                  lang === 'bn' ? 'text-red-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                বাংলা
              </button>
              <button
                onClick={() => setLang('en')}
                className={`relative z-10 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[9px] sm:text-xs font-bold transition-colors duration-300 flex-1 min-w-[40px] sm:min-w-[80px] ${
                  lang === 'en' ? 'text-red-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                EN
              </button>
            </div>

            {canManage && (
              <button
                onClick={() => setView(view === 'public' ? 'admin' : 'public')}
                className={`flex items-center gap-2 px-2 sm:px-4 py-2 rounded-xl font-medium transition-colors text-xs sm:text-sm ${
                  view === 'admin' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title={view === 'admin' ? t.publicView : t.adminPanel}
              >
                <Settings size={18} />
                <span className="hidden sm:inline">{view === 'admin' ? t.publicView : t.adminPanel}</span>
              </button>
            )}
            
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setShowRegForm(true)}
                className="flex items-center gap-2 bg-red-600 text-white px-3 sm:px-4 py-2 rounded-xl font-medium hover:bg-red-700 transition-colors text-xs sm:text-sm"
              >
                <UserPlus size={18} />
                <span className="hidden sm:inline">{t.register}</span>
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
                <span className="hidden sm:inline">{t.login}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        {view === 'public' ? (
          <>
            {/* Mobile Tabs */}
            <div className="lg:hidden flex gap-1 mb-4 bg-white p-1 rounded-2xl border border-slate-200 sticky top-16 z-40 shadow-sm">
              <button 
                onClick={() => setMobileTab('requests')} 
                className={`flex-1 py-2 rounded-xl text-[10px] xs:text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  mobileTab === 'requests' ? 'bg-red-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Droplets size={12} />
                {t.requests}
              </button>
              <button 
                onClick={() => setMobileTab('chat')} 
                className={`flex-1 py-2 rounded-xl text-[10px] xs:text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  mobileTab === 'chat' ? 'bg-red-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Bot size={12} />
                {t.chat}
              </button>
              <button 
                onClick={() => setMobileTab('donors')} 
                className={`flex-1 py-2 rounded-xl text-[10px] xs:text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  mobileTab === 'donors' ? 'bg-red-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Search size={12} />
                {t.donors}
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
                <h2 className="text-xl font-bold mb-2">{t.bloodDonationSaveLife}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-4">
                  <div className="bg-white/10 p-3 sm:p-4 rounded-2xl backdrop-blur-sm flex items-center gap-2 sm:gap-3 min-w-0">
                    <Users size={20} className="sm:w-6 sm:h-6 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[8px] sm:text-[10px] opacity-80 uppercase tracking-wider truncate">{t.donors}</p>
                      <p className="text-lg sm:text-xl font-bold truncate">{donors.length}</p>
                    </div>
                  </div>
                  <div className="bg-white/10 p-3 sm:p-4 rounded-2xl backdrop-blur-sm flex items-center gap-2 sm:gap-3 min-w-0">
                    <Heart size={20} className="sm:w-6 sm:h-6 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[8px] sm:text-[10px] opacity-80 uppercase tracking-wider truncate">{t.requests}</p>
                      <p className="text-lg sm:text-xl font-bold truncate">{recentRequests.length}</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Droplets className="text-red-600" size={20} />
                  {t.emergencyRequests}
                </h3>
                <div className="space-y-3">
                      {recentRequests.filter(r => r.status !== 'fulfilled').map((req) => (
                        <div key={req.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-sm">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-red-600 font-bold">{req.bloodGroup}</span>
                            <div className="flex items-center gap-2">
                              {auth.currentUser?.uid === req.uid && (
                                <button
                                  onClick={() => handleMarkFulfilled(req.id)}
                                  className="text-emerald-600 hover:text-emerald-700 p-1"
                                  title={t.fulfilled}
                                >
                                  <CheckCircle size={14} />
                                </button>
                              )}
                              <span className="text-[10px] text-slate-400">
                                {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US') : t.justNow}
                              </span>
                            </div>
                          </div>
                          <p className="font-medium text-slate-700 truncate">{req.location}</p>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <Phone size={10} /> {req.contactNumber}
                            {userRole === 'admin' && (
                              <a 
                                href={`https://wa.me/${req.contactNumber.replace(/\D/g, '').startsWith('88') ? req.contactNumber.replace(/\D/g, '') : '88' + req.contactNumber.replace(/\D/g, '')}?text=${encodeURIComponent(t.emergencyBloodRequestMsg.replace('{group}', req.bloodGroup).replace('{location}', req.location).replace('{contact}', req.contactNumber))}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="ml-1 p-1 bg-emerald-50 text-emerald-600 rounded-md hover:bg-emerald-100 transition-colors inline-flex items-center justify-center"
                                title="WhatsApp Message"
                              >
                                <MessageCircle size={10} />
                              </a>
                            )}
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
                  {t.donorList}
                </h3>
                
                <div className="space-y-3 mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder={t.search}
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
                        <div key={donor.id} className={`p-3 sm:p-4 bg-white border rounded-2xl shadow-sm transition-colors ${
                          ready ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100'
                        }`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <p className="font-bold text-slate-800 text-sm sm:text-base truncate">{donor.name}</p>
                                  {ready && (
                                    <span className="shrink-0 flex items-center gap-0.5 text-[8px] sm:text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">
                                      <CheckCircle size={8} className="sm:w-2.5 sm:h-2.5" /> {t.ready}
                                    </span>
                                  )}
                                </div>
                                {auth.currentUser?.uid === donor.uid && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingDonor(donor);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                                    title="Edit My Info"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                <Filter size={10} /> {donor.location}
                              </p>
                              <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                                <Phone size={10} /> {donor.mobileNumber}
                                {userRole === 'admin' && (
                                  <a 
                                    href={`https://wa.me/${donor.mobileNumber.replace(/\D/g, '').startsWith('88') ? donor.mobileNumber.replace(/\D/g, '') : '88' + donor.mobileNumber.replace(/\D/g, '')}?text=${encodeURIComponent(t.canYouDonateMsg)}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="ml-1 p-1 bg-emerald-50 text-emerald-600 rounded-md hover:bg-emerald-100 transition-colors inline-flex items-center justify-center"
                                    title="WhatsApp Message"
                                  >
                                    <MessageCircle size={10} />
                                  </a>
                                )}
                              </p>
                              {donor.lastDonationDate && (
                                <p className="text-[10px] text-slate-400 mt-1 italic">
                                  {t.lastDonated}: {new Date(donor.lastDonationDate).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US')}
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
                      <p className="text-slate-400 text-sm italic">{t.noDonors}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{t.managementDashboard}</h2>
              <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-red-100 text-red-700 rounded-xl text-xs sm:text-sm font-bold self-start sm:self-auto">
                <Users size={16} className="sm:w-[18px] sm:h-[18px]" />
                {t.roleLabel}: {userRole?.toUpperCase()}
              </div>
            </div>

            {/* Admin Sub-navigation */}
            <div className="flex gap-2 sm:gap-4 border-b border-slate-200 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setAdminSubView('requests')}
                className={`pb-3 sm:pb-4 px-1 sm:px-2 font-bold text-xs sm:text-sm transition-colors relative whitespace-nowrap ${
                  adminSubView === 'requests' ? 'text-red-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {t.requests}
                {adminSubView === 'requests' && <motion.div layoutId="subnav" className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-t-full" />}
              </button>
              <button
                onClick={() => setAdminSubView('donors')}
                className={`pb-3 sm:pb-4 px-1 sm:px-2 font-bold text-xs sm:text-sm transition-colors relative whitespace-nowrap ${
                  adminSubView === 'donors' ? 'text-red-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {t.donors}
                {adminSubView === 'donors' && <motion.div layoutId="subnav" className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-t-full" />}
              </button>
              <button
                onClick={() => setAdminSubView('reports')}
                className={`pb-3 sm:pb-4 px-1 sm:px-2 font-bold text-xs sm:text-sm transition-colors relative whitespace-nowrap ${
                  adminSubView === 'reports' ? 'text-red-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {t.reports}
                {adminSubView === 'reports' && <motion.div layoutId="subnav" className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-t-full" />}
              </button>
              {userRole === 'admin' && (
                <button
                  onClick={() => setAdminSubView('users')}
                  className={`pb-3 sm:pb-4 px-1 sm:px-2 font-bold text-xs sm:text-sm transition-colors relative whitespace-nowrap ${
                    adminSubView === 'users' ? 'text-red-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {t.managers}
                  {adminSubView === 'users' && <motion.div layoutId="subnav" className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-t-full" />}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-8">
              {adminSubView === 'requests' && (
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-900 mb-4">{t.bloodRequestsTitle}</h3>
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
                          {(userRole === 'admin' || userRole === 'moderator' || auth.currentUser?.uid === req.uid) && (
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
                    <h3 className="font-bold text-slate-900">{t.donorListTitle}</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={adminBloodGroupFilter}
                        onChange={(e) => setAdminBloodGroupFilter(e.target.value)}
                        className="bg-slate-100 text-slate-900 text-xs font-bold px-3 py-2 rounded-xl border-none focus:ring-2 focus:ring-red-500 cursor-pointer outline-none"
                      >
                        <option value="all">{t.allGroups}</option>
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
                          {t.everyone}                        </button>
                        <button
                          onClick={() => setAdminDonorFilter('ready')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            adminDonorFilter === 'ready' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {t.ready} (Ready)
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
                              {(userRole === 'admin' || userRole === 'moderator' || userRole === 'editor' || auth.currentUser?.uid === donor.uid) && (
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
                              {(userRole === 'admin' || userRole === 'moderator' || auth.currentUser?.uid === donor.uid) && (
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
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.totalDonors}</p>
                      <h4 className="text-3xl font-black text-slate-900">{getReportData().totalDonors}</h4>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-4">
                        <Droplets size={24} />
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.totalRequests}</p>
                      <h4 className="text-3xl font-black text-slate-900">{getReportData().totalRequests}</h4>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                        <CheckCircle size={24} />
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.fulfilledRequests}</p>
                      <h4 className="text-3xl font-black text-slate-900">{getReportData().fulfilledRequests}</h4>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
                        <Award size={24} />
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.specialDonors}</p>
                      <h4 className="text-3xl font-black text-slate-900">{getReportData().specialDonors}</h4>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                      <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <PieChart size={20} className="text-red-600" />
                        {t.donorsByGroup}
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
                                <span className="text-slate-900">{count} {t.people}</span>
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
                        {t.recentActivity}
                      </h3>
                      <div className="space-y-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-sm font-bold text-slate-900">{t.successRate}</p>
                          <p className="text-2xl font-black text-emerald-600">
                            {getReportData().totalRequests > 0 
                              ? Math.round((getReportData().fulfilledRequests / getReportData().totalRequests) * 100) 
                              : 0}%
                          </p>
                          <p className="text-xs text-slate-400 mt-1">{t.successRateDesc}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-sm font-bold text-slate-900">{t.avgDonations}</p>
                          <p className="text-2xl font-black text-blue-600">
                            {(donors.reduce((acc, curr) => acc + (curr.donationCount || 0), 0) / (donors.length || 1)).toFixed(1)}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">{t.avgDonationsDesc}</p>
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
                      <h3 className="font-bold text-slate-900">{t.managerList}</h3>
                      <button
                        onClick={() => setShowUserForm(true)}
                        className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-red-700 transition-colors text-sm"
                      >
                        <UserPlus size={18} />
                        {t.addNewManager}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {appUsers.map(u => (
                        <div key={u.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-bold text-sm truncate max-w-[150px]">{u.email}</p>
                              <div className="flex items-center gap-1">
                                <p className="text-[10px] text-slate-400 font-mono">{u.uid}</p>
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(u.uid);
                                    showNotification(t.uidCopied);
                                  }}
                                  className="text-[10px] text-red-400 hover:text-red-600"
                                  title="Copy UID"
                                >
                                  <Share2 size={10} />
                                </button>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-1 text-red-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className="flex gap-2 items-center">
                            <select 
                              defaultValue={u.role}
                              id={`role-select-${u.id}`}
                              className="flex-1 bg-white border border-slate-200 rounded-xl text-[10px] font-bold px-2 py-1.5 outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                            >
                              <option value="admin">ADMIN</option>
                              <option value="moderator">MODERATOR</option>
                              <option value="editor">EDITOR</option>
                            </select>
                            <button
                              onClick={() => {
                                const select = document.getElementById(`role-select-${u.id}`) as HTMLSelectElement;
                                setPendingRoleUpdate({ id: u.id, role: select.value, email: u.email });
                              }}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-xl text-[10px] font-bold uppercase hover:bg-red-700 transition-colors shadow-sm"
                            >
                              Update
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                      <Users className="text-red-600" size={20} />
                      {t.recentLogins}
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
                                <p className="font-bold text-sm">{p.displayName || t.unknownUser}</p>
                                <p className="text-xs text-slate-500 truncate max-w-[120px]">{p.email}</p>
                                <div className="flex items-center gap-1">
                                  <p className="text-[8px] text-slate-400 font-mono">{p.id}</p>
                                  <button 
                                    onClick={() => {
                                      navigator.clipboard.writeText(p.id);
                                      showNotification(t.uidCopied);
                                    }}
                                    className="text-[8px] text-red-400 hover:text-red-600"
                                    title="Copy UID"
                                  >
                                    <Share2 size={8} />
                                  </button>
                                </div>
                              </div>
                            </div>
                            {!isAlreadyManager ? (
                              <div className="flex gap-2 items-center">
                                <select 
                                  id={`promote-select-${p.id}`}
                                  defaultValue="editor"
                                  className="bg-white border border-slate-200 rounded-xl text-[10px] font-bold px-2 py-1.5 outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                                >
                                  <option value="admin">ADMIN</option>
                                  <option value="moderator">MODERATOR</option>
                                  <option value="editor">EDITOR</option>
                                </select>
                                <button
                                  onClick={() => {
                                    const select = document.getElementById(`promote-select-${p.id}`) as HTMLSelectElement;
                                    setPendingRoleUpdate({ id: p.id, role: select.value, email: p.email || 'Unknown' });
                                  }}
                                  className="px-3 py-1.5 bg-red-600 text-white rounded-xl text-[10px] font-bold uppercase hover:bg-red-700 transition-colors shadow-sm"
                                >
                                  Promote
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
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="bg-red-600 p-4 sm:p-6 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2 sm:gap-3">
                  <h3 className="text-lg sm:text-xl font-bold">{t.donorRegistration}</h3>
                  <button 
                    onClick={copyRegLink}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1.5 text-[10px] sm:text-xs font-medium"
                    title="Copy direct registration link"
                  >
                    <Share2 size={12} className="sm:w-3.5 sm:h-3.5" />
                    {t.copyLink}
                  </button>
                </div>
                <button onClick={() => setShowRegForm(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleRegister} className="p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.fullName}</label>
                  <input
                    required
                    type="text"
                    value={regData.name}
                    onChange={(e) => setRegData({...regData, name: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder={t.enterName}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.bloodGroup}</label>
                    <select
                      required
                      value={regData.bloodGroup}
                      onChange={(e) => setRegData({...regData, bloodGroup: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="">{t.select}</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.mobile}</label>
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
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.location}</label>
                  <input
                    required
                    type="text"
                    value={regData.location}
                    onChange={(e) => setRegData({...regData, location: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder={t.enterLocation}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.lastDonationDateOptional}</label>
                  <input
                    type="date"
                    max={new Date().toISOString().split('T')[0]}
                    value={regData.lastDonationDate}
                    onChange={(e) => setRegData({...regData, lastDonationDate: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.howManyDonations}</label>
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
                  {isSubmitting ? t.processing : t.completeRegistration}
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
              className="bg-white w-full max-w-lg rounded-3xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="bg-red-600 p-5 sm:p-8 text-white relative shrink-0">
                <button 
                  onClick={() => setSelectedDonor(null)} 
                  className="absolute top-4 sm:top-6 right-4 sm:right-6 hover:bg-white/20 p-1.5 sm:p-2 rounded-full transition-colors"
                >
                  <X size={20} className="sm:w-6 sm:h-6" />
                </button>
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="w-14 h-14 sm:w-20 sm:h-20 bg-white/20 rounded-2xl sm:rounded-3xl flex items-center justify-center backdrop-blur-md border border-white/30">
                    <span className="text-xl sm:text-3xl font-black">{selectedDonor.bloodGroup}</span>
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-2xl font-bold mb-0.5 sm:mb-1">{selectedDonor.name}</h3>
                    <p className="text-white/80 flex items-center gap-1.5 text-[10px] sm:text-sm">
                      <MapPin size={12} className="sm:w-3.5 sm:h-3.5" /> {selectedDonor.location}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-5 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="p-3 sm:p-4 bg-slate-50 rounded-2xl sm:rounded-3xl border border-slate-100 min-w-0">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 sm:mb-2">{t.mobile}</p>
                    <p className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 truncate">
                      <Phone size={16} className="text-red-600 shrink-0" />
                      {selectedDonor.mobileNumber}
                    </p>
                  </div>
                  <div className="p-3 sm:p-4 bg-slate-50 rounded-2xl sm:rounded-3xl border border-slate-100 min-w-0">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 sm:mb-2">{t.bloodGroup}</p>
                    <p className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 truncate">
                      <Droplets size={16} className="text-red-600 shrink-0" />
                      {selectedDonor.bloodGroup}
                    </p>
                  </div>
                  <div className="p-3 sm:p-4 bg-red-50 rounded-2xl sm:rounded-3xl border border-red-100 min-w-0">
                    <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-1 sm:mb-2">{t.totalDonations}</p>
                    <p className="text-base sm:text-lg font-bold text-red-700 flex items-center gap-2 truncate">
                      <Award size={18} className="text-red-600" />
                      {selectedDonor.donationCount || 0} {t.times}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">{t.registrationDate}</p>
                    <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Calendar size={16} className="text-slate-400" />
                      {selectedDonor.createdAt?.toDate ? 
                        selectedDonor.createdAt.toDate().toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }) : t.justNow}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                      <History size={18} className="text-red-600" />
                      {t.donationHistory}
                    </h4>
                    {selectedDonor.lastDonationDate && (
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${isEligible(selectedDonor.lastDonationDate) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {isEligible(selectedDonor.lastDonationDate) ? t.ready : t.notReady}
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {selectedDonor.donationHistory && selectedDonor.donationHistory.length > 0 ? (
                      [...selectedDonor.donationHistory].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((history: any, idx: number) => (
                        <div key={idx} className="relative pl-6 pb-4 last:pb-0">
                          {/* Timeline Line */}
                          <div className="absolute left-2 top-2 bottom-0 w-0.5 bg-slate-100"></div>
                          {/* Timeline Dot */}
                          <div className="absolute left-0 top-2 w-4 h-4 rounded-full bg-white border-2 border-red-500 z-10"></div>
                          
                          <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-1">
                              <p className="text-sm font-bold text-slate-900">
                                {new Date(history.date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </p>
                              <span className="text-[9px] font-black text-red-500 uppercase tracking-tighter bg-red-50 px-2 py-0.5 rounded-md">
                                Donated
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <MapPin size={12} className="text-slate-400" /> {history.location}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : selectedDonor.lastDonationDate ? (
                      <div className="relative pl-6">
                        <div className="absolute left-0 top-2 w-4 h-4 rounded-full bg-white border-2 border-emerald-500 z-10"></div>
                        <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                          <div className="flex justify-between items-start mb-1">
                            <div>
                              <p className="text-[10px] text-emerald-600 font-bold uppercase mb-1">{t.lastDonation}</p>
                              <p className="text-sm font-bold text-emerald-900">
                                {new Date(selectedDonor.lastDonationDate).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </p>
                            </div>
                            <div className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-[9px] font-bold uppercase">
                              {t.latest}
                            </div>
                          </div>
                          <p className="text-xs text-emerald-600/70 flex items-center gap-1">
                            <MapPin size={12} /> {selectedDonor.location}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-3xl text-center">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <History size={20} className="text-slate-300" />
                        </div>
                        <p className="text-slate-400 text-sm italic">{t.noHistory}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedDonor(null)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95"
                  >
                    {t.close}
                  </button>
                  {(userRole === 'admin' || userRole === 'moderator' || userRole === 'editor' || auth.currentUser?.uid === selectedDonor.uid) && (
                    <button
                      onClick={() => {
                        setEditingDonor(selectedDonor);
                        setSelectedDonor(null);
                      }}
                      className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-100"
                    >
                      {t.editInfo}
                    </button>
                  )}
                </div>
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
                <h3 className="text-xl font-bold">{t.editDonorInfo}</h3>
                <button onClick={() => setEditingDonor(null)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleUpdateDonor} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.fullName}</label>
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
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.bloodGroup}</label>
                    <select
                      required
                      value={editingDonor.bloodGroup || ''}
                      onChange={(e) => setEditingDonor({...editingDonor, bloodGroup: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="" disabled>{t.select}</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.mobile}</label>
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
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.location}</label>
                  <input
                    required
                    type="text"
                    value={editingDonor.location || ''}
                    onChange={(e) => setEditingDonor({...editingDonor, location: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.lastDonationDate}</label>
                  <input
                    type="date"
                    max={new Date().toISOString().split('T')[0]}
                    value={editingDonor.lastDonationDate || ''}
                    onChange={(e) => setEditingDonor({...editingDonor, lastDonationDate: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.donationCountLabel}</label>
                  <input
                    type="number"
                    min="0"
                    value={editingDonor.donationCount || 0}
                    onChange={(e) => setEditingDonor({...editingDonor, donationCount: parseInt(e.target.value) || 0})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.donationHistoryLabel}</label>
                  <div className="space-y-2 mb-3 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                    {editingDonor.donationHistory && editingDonor.donationHistory.map((h: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-slate-100 rounded-lg text-[10px]">
                        <span className="font-bold">{h.date} - {h.location}</span>
                        <button 
                          type="button"
                          onClick={() => {
                            const newHistory = editingDonor.donationHistory.filter((_: any, idx: number) => idx !== i);
                            const lastDate = newHistory.length > 0 ? newHistory[0].date : editingDonor.lastDonationDate;
                            setEditingDonor({
                              ...editingDonor, 
                              donationHistory: newHistory, 
                              donationCount: Math.max(0, (editingDonor.donationCount || 0) - 1),
                              lastDonationDate: lastDate
                            });
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">{t.addNewEntry}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" id="newHistDate" className="p-2 text-[10px] border rounded-lg focus:ring-1 focus:ring-red-500 outline-none" />
                      <input type="text" id="newHistLoc" placeholder={t.place} className="p-2 text-[10px] border rounded-lg focus:ring-1 focus:ring-red-500 outline-none" />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const d = document.getElementById('newHistDate') as HTMLInputElement;
                        const l = document.getElementById('newHistLoc') as HTMLInputElement;
                        if (d.value && l.value) {
                          const newH = [...(editingDonor.donationHistory || []), { date: d.value, location: l.value }];
                          // Sort history by date descending
                          const sortedH = [...newH].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                          setEditingDonor({
                            ...editingDonor, 
                            donationHistory: sortedH, 
                            // If history count is greater than manual count, update it
                            donationCount: Math.max(editingDonor.donationCount || 0, sortedH.length),
                            // Update last donation date if the new entry is more recent
                            lastDonationDate: sortedH[0].date
                          });
                          d.value = ''; l.value = '';
                        }
                      }}
                      className="w-full py-2 bg-red-50 text-red-600 rounded-lg text-[10px] font-bold uppercase hover:bg-red-100 transition-colors"
                    >
                      {t.addToHistory}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100 disabled:opacity-50"
                >
                  {isSubmitting ? t.updating : t.updateInfo}
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
                <h3 className="text-xl font-bold">{t.addNewManager}</h3>
                <button onClick={() => setShowUserForm(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleAddUser} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.email}</label>
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
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.userId}</label>
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
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.role}</label>
                  <select
                    required
                    value={userData.role}
                    onChange={(e) => setUserData({...userData, role: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="editor">{t.editor}</option>
                    <option value="moderator">{t.moderator}</option>
                    <option value="admin">{t.admin}</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100 disabled:opacity-50"
                >
                  {isSubmitting ? t.processing : t.addManager}
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
              <h3 className="text-xl font-bold text-slate-900 mb-2">{t.areYouSure}</h3>
              <p className="text-slate-500 text-sm mb-6">
                {t.confirmRegDesc}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmReg(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  {t.noGoBack}
                </button>
                <button
                  onClick={confirmRegistration}
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100 disabled:opacity-50"
                >
                  {isSubmitting ? t.processing : t.yesConfirm}
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
              <h3 className="text-xl font-bold text-slate-900 mb-2">{t.areYouSure}</h3>
              <p className="text-slate-500 text-sm mb-6">
                {t.confirmDeleteDesc}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPendingDelete(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  {t.noGoBack}
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
                >
                  {t.yesDelete}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Role Update Confirmation Modal */}
      <AnimatePresence>
        {pendingRoleUpdate && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{t.confirmRoleChange}</h3>
              <p className="text-slate-500 text-sm mb-6">
                {t.confirmRoleChangeDesc
                  .replace('{email}', pendingRoleUpdate.email)
                  .replace('{role}', pendingRoleUpdate.role)}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPendingRoleUpdate(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  {t.noGoBack}
                </button>
                <button
                  onClick={() => {
                    handleUpdateUserRole(pendingRoleUpdate.id, pendingRoleUpdate.role);
                    setPendingRoleUpdate(null);
                  }}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
                >
                  {t.yesChange}
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
              {t.shareRegLink}
            </button>
          </div>
          <p className="text-slate-500 text-sm">{t.copyright}</p>
          <p className="text-slate-400 text-[10px] mt-1">{t.nonProfitOrg}</p>
        </div>
      </footer>
    </div>
  );
}
