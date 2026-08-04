import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../firebase/config';
import { hasPermission } from '../lib/permissions';
import { issuePortalToken } from '../services/portalAuth';

const AuthContext = createContext(null);

async function emailSignIn(email, password, remember) {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  return signInWithEmailAndPassword(auth, email, password);
}

async function portalSignIn(role, identifier, remember) {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  const data = await issuePortalToken({ role, identifier });
  if (data?.mode === 'password' && data.email && data.password) {
    return signInWithEmailAndPassword(auth, data.email, data.password);
  }
  if (data?.token) {
    return signInWithCustomToken(auth, data.token);
  }
  throw new Error('invalid portal session response');
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = loading, null = signed out
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setFirebaseUser(null);
      return;
    }
    const unsub = onAuthStateChanged(auth, (user) => setFirebaseUser(user));
    return unsub;
  }, []);

  useEffect(() => {
    if (!firebaseUser) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    const unsub = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setProfileLoading(false);
      },
      () => setProfileLoading(false)
    );
    return unsub;
  }, [firebaseUser]);

  const value = useMemo(() => ({
    firebaseUser,
    profile,
    role: profile?.role || null,
    loading: firebaseUser === undefined || (!!firebaseUser && profileLoading && !profile),
    isFirebaseConfigured,
    can: (permissionKey) => hasPermission(profile, permissionKey),

    // Staff — email + password
    signInAdmin: emailSignIn,
    signInTeacher: emailSignIn,
    signInAccountant: emailSignIn,
    signInReception: emailSignIn,

    // Parent / student — passwordless (phone or study ID)
    async signInParent(phone, _passwordIgnored, remember) {
      return portalSignIn('parent', phone, remember);
    },
    async signInStudent(studentId, _passwordIgnored, remember) {
      return portalSignIn('student', studentId, remember);
    },
    async resetPassword(email) {
      return sendPasswordResetEmail(auth, email);
    },
    async signOut() {
      return firebaseSignOut(auth);
    },
  }), [firebaseUser, profile, profileLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
