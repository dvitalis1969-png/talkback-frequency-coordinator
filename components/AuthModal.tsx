import React, { useState } from 'react';
import { X, Mail, Lock, User, ArrowRight, Github, Eye, EyeOff, CheckCircle2, KeyRound } from 'lucide-react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { auth, db, googleProvider, getDocWithTimeout, setDocWithTimeout } from '../src/lib/firebase';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (user: any) => void;
    initialMode?: 'login' | 'signup' | 'forgot';
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess, initialMode = 'login' }) => {
    const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resetSent, setResetSent] = useState(false);

    if (!isOpen) return null;

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        setError(null);
        
        if (!auth || !googleProvider) {
            setError("Firebase is not configured correctly. Please check your environment variables.");
            setIsLoading(false);
            return;
        }

        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            
            let subscription = 'none';
            let stripeCustomerId = null;
            
            try {
                // Check if user exists in Firestore
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDocWithTimeout(userDocRef);
                
                if (!userDoc.exists()) {
                    // Create new user document
                    await setDocWithTimeout(userDocRef, {
                        email: user.email,
                        name: user.displayName || user.email?.split('@')[0],
                        subscriptionStatus: 'none',
                        createdAt: new Date().toISOString()
                    });
                } else {
                    const data = userDoc.data();
                    subscription = data.subscriptionStatus || 'none';
                    stripeCustomerId = data.stripeCustomerId || null;
                }
            } catch (dbErr: any) {
                if (dbErr.message && dbErr.message.includes('client is offline')) {
                    console.warn("Firestore is offline or unreachable. Using default user settings.");
                } else {
                    console.error("Error fetching/saving user data:", dbErr);
                }
            }

            onSuccess({
                id: user.uid,
                email: user.email,
                name: user.displayName || user.email?.split('@')[0],
                subscription: subscription,
                stripeCustomerId: stripeCustomerId
            });
            onClose();
        } catch (err: any) {
            console.error("Google Auth error:", err);
            let errorMessage = "Google Sign-In failed. Please try again.";
            if (err.code === 'auth/popup-blocked') {
                errorMessage = "The sign-in popup was blocked by your browser. Please allow popups for this site.";
            } else if (err.code === 'auth/cancelled-popup-request') {
                errorMessage = "The sign-in request was cancelled. Please try again.";
            } else if (err.message) {
                errorMessage = err.message;
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) {
            setError("Please enter your email address to receive a setup / reset link.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            await sendPasswordResetEmail(auth, email.trim().toLowerCase());
            setResetSent(true);
        } catch (err: any) {
            console.error("Password reset error:", err);
            let msg = "Failed to send reset email. Please verify your email address.";
            if (err.code === 'auth/user-not-found') {
                msg = "No account found with this email address. Please ask your administrator to verify your email.";
            } else if (err.message) {
                msg = err.message;
            }
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (mode === 'forgot') {
            return handlePasswordReset(e);
        }

        setIsLoading(true);
        setError(null);
        
        if (!auth) {
            const missingKeys = [
                !import.meta.env.VITE_FIREBASE_API_KEY && 'VITE_FIREBASE_API_KEY',
                !import.meta.env.VITE_FIREBASE_AUTH_DOMAIN && 'VITE_FIREBASE_AUTH_DOMAIN',
                !import.meta.env.VITE_FIREBASE_PROJECT_ID && 'VITE_FIREBASE_PROJECT_ID',
            ].filter(Boolean);
            
            setError(`Firebase is not configured. Missing keys: ${missingKeys.join(', ')}. Please check your Render environment variables.`);
            setIsLoading(false);
            return;
        }

        try {
            if (mode === 'signup') {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                if (name) {
                    await updateProfile(userCredential.user, { displayName: name });
                }
                
                try {
                    // Create user document in Firestore
                    await setDocWithTimeout(doc(db, 'users', userCredential.user.uid), {
                        email: userCredential.user.email,
                        name: name || userCredential.user.email?.split('@')[0],
                        subscriptionStatus: 'none',
                        createdAt: new Date().toISOString()
                    });
                } catch (dbErr: any) {
                    if (dbErr.message && dbErr.message.includes('client is offline')) {
                        console.warn("Firestore is offline or unreachable. User created but profile not saved to DB.");
                    } else {
                        console.error("Error saving user data:", dbErr);
                    }
                }

                onSuccess({
                    id: userCredential.user.uid,
                    email: userCredential.user.email,
                    name: name || userCredential.user.email?.split('@')[0],
                    subscription: 'none',
                    stripeCustomerId: null
                });
            } else {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                
                // Fetch user document to get subscription status
                let subscription = 'none';
                let stripeCustomerId = null;
                try {
                    const userDoc = await getDocWithTimeout(doc(db, 'users', userCredential.user.uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        subscription = data.subscriptionStatus || 'none';
                        stripeCustomerId = data.stripeCustomerId || null;
                    }
                } catch (dbErr: any) {
                    if (dbErr.message && dbErr.message.includes('client is offline')) {
                        console.warn("Firestore is offline or unreachable. Using default user settings.");
                    } else {
                        console.error("Error fetching user data:", dbErr);
                    }
                }

                onSuccess({
                    id: userCredential.user.uid,
                    email: userCredential.user.email,
                    name: userCredential.user.displayName || userCredential.user.email?.split('@')[0],
                    subscription: subscription,
                    stripeCustomerId: stripeCustomerId
                });
            }
            onClose();
        } catch (err: any) {
            console.error("Auth error:", err);
            let errorMessage = "Authentication failed. Please try again.";
            if (err.code === 'auth/invalid-credential') {
                errorMessage = "Invalid email or password. If you were recently invited to a team or haven't set your password yet, use the 'Set or Reset Password' option below.";
            } else if (err.code === 'auth/email-already-in-use') {
                errorMessage = "An account with this email already exists (e.g. from an Enterprise team invite). Please switch to Sign In or reset your password.";
            } else if (err.code === 'auth/weak-password') {
                errorMessage = "Password should be at least 6 characters.";
            } else if (err.code === 'auth/network-request-failed') {
                errorMessage = "Network error. Please check your internet connection, or disable any ad blockers/VPNs that might be blocking Firebase.";
            } else if (err.message) {
                errorMessage = err.message;
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000000] flex items-center justify-center p-2 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative">
                <button 
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 rounded-md bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                >
                    <X className="w-3.5 h-3.5" />
                </button>

                <div className="p-8 md:p-10">
                    <div className="mb-8">
                        <div className="w-12 h-12 bg-indigo-600 rounded-md flex items-center justify-center text-xl font-semibold shadow-sm border border-slate-700/50 mb-6">📡</div>
                        <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight mb-2">
                            {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : 'Set Account Password'}
                        </h2>
                        <p className="text-slate-400 text-xs sm:text-sm font-medium uppercase tracking-widest">
                            {mode === 'login' 
                                ? 'Access your RF coordination suite' 
                                : mode === 'signup' 
                                ? 'Join the professional RF ecosystem' 
                                : 'For invited crew members & password resets'}
                        </p>
                    </div>

                    {mode === 'forgot' && resetSent ? (
                        <div className="space-y-6 text-center py-4">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white mb-2">Check Your Inbox</h3>
                                <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
                                    We sent a password setup / reset link to <span className="text-indigo-400 font-mono font-bold">{email}</span>. Click the link in your email to choose your password, then return here to sign in.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setMode('login'); setResetSent(false); setError(null); }}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-md text-xs uppercase tracking-wider transition-all"
                            >
                                Return to Sign In
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-xs p-3 rounded-md mb-4 space-y-2">
                                    <p>{error}</p>
                                    {mode === 'login' && (
                                        <button
                                            type="button"
                                            onClick={() => { setMode('forgot'); setError(null); }}
                                            className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-semibold block"
                                        >
                                            Click here to set or reset your password →
                                        </button>
                                    )}
                                </div>
                            )}

                            {mode === 'signup' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                        <input 
                                            type="text" 
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="John Doe"
                                            className="w-full bg-slate-950 border border-white/5 rounded-md py-3.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input 
                                        type="email" 
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="engineer@rfsuite.pro"
                                        className="w-full bg-slate-950 border border-white/5 rounded-md py-3.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all"
                                    />
                                </div>
                            </div>

                            {mode !== 'forgot' && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between ml-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Password</label>
                                        {mode === 'login' && (
                                            <button
                                                type="button"
                                                onClick={() => { setMode('forgot'); setError(null); }}
                                                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
                                            >
                                                Forgot or Invited?
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                        <input 
                                            type={showPassword ? "text" : "password"} 
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full bg-slate-950 border border-white/5 rounded-md py-3.5 pl-12 pr-12 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-sm bg-white/5 text-slate-500 hover:text-white hover:bg-white/10 transition-all"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <button 
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest text-xs py-3 rounded-md shadow-sm border border-slate-700/50 transition-all flex items-center justify-center gap-2 group mt-2"
                            >
                                {isLoading ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Setup Link'}
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>

                            {mode === 'forgot' && (
                                <button
                                    type="button"
                                    onClick={() => { setMode('login'); setError(null); }}
                                    className="w-full text-center text-xs text-slate-400 hover:text-white font-bold transition-colors pt-2"
                                >
                                    ← Back to Sign In
                                </button>
                            )}
                        </form>
                    )}

                    {mode !== 'forgot' && (
                        <div className="mt-8 pt-8 border-t border-white/5">
                            <button 
                                type="button"
                                onClick={handleGoogleSignIn}
                                disabled={isLoading}
                                className="w-full bg-white hover:bg-slate-200 border border-white text-black font-black tracking-widest text-[10px] py-3.5 rounded-md transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24">
                                    <path
                                        fill="#4285F4"
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    />
                                    <path
                                        fill="#34A853"
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    />
                                    <path
                                        fill="#FBBC05"
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                                    />
                                    <path
                                        fill="#EA4335"
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    />
                                </svg>
                                Continue with Google
                            </button>
                        </div>
                    )}

                    <div className="mt-8 text-center">
                        <button 
                            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
                            className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-400 transition-colors"
                        >
                            {mode === 'login' ? "Don't have an account? Sign Up" : mode === 'signup' ? "Already have an account? Sign In" : ""}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
