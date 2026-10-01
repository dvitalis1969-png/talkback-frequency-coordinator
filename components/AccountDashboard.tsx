import React, { useState } from 'react';
import { toast } from 'sonner';
import { User, CreditCard, Shield, LogOut, X, Check, Clock, Calendar, Zap, ExternalLink, Mail, ShieldAlert, Loader2, Plus, Search, Users, UserMinus, UserCheck, Sparkles, AlertCircle, RefreshCw, Key, Copy, Send } from 'lucide-react';
import { db, auth } from '../src/lib/firebase';
import { doc, setDoc, getDoc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '../src/utils/firestoreErrorHandler';
import { getUserProjectsFromCloud, deleteProjectFromCloud } from '../services/cloudDbService';
import { isPro } from '../src/lib/userUtils';
import ContactForm from './ContactForm';

interface AccountDashboardProps {
    user: any;
    onClose: () => void;
    onLogout: () => void;
    onUpgrade: (tier: string) => void;
    onLoadProject?: (project: any) => void;
}

const AccountDashboard: React.FC<AccountDashboardProps> = ({ user, onClose, onLogout, onUpgrade, onLoadProject }) => {
    const [activeTab, setActiveTab] = useState<'profile' | 'billing' | 'security' | 'projects' | 'contact' | 'admin' | 'branding' | 'team'>('profile');
    const [isLoading, setIsLoading] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);
    const [configStatus, setConfigStatus] = useState<{ stripe: boolean; firebase: boolean; stripeMode?: string; stripePrefix?: string }>({ stripe: false, firebase: false });
    const [cloudProjects, setCloudProjects] = useState<any[]>([]);
    const [isFetchingProjects, setIsFetchingProjects] = useState(false);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [isFetchingUsers, setIsFetchingUsers] = useState(false);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [adminSubTab, setAdminSubTab] = useState<'users' | 'tickets' | 'broadcasts' | 'system'>('users');
    const [contactMessages, setContactMessages] = useState<any[]>([]);
    const [isFetchingMessages, setIsFetchingMessages] = useState(false);
    const [broadcastTitle, setBroadcastTitle] = useState('');
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
    const [totalProjectsCount, setTotalProjectsCount] = useState<number | null>(null);
    const [isFetchingMetrics, setIsFetchingMetrics] = useState(false);

    // Enterprise Team Seat State
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [isFetchingTeam, setIsFetchingTeam] = useState(false);
    const [newTeamRole, setNewTeamRole] = useState<'coordinator' | 'crew'>('crew');
    const [newTeamPassword, setNewTeamPassword] = useState('');
    const [isRemovingMember, setIsRemovingMember] = useState<string | null>(null);
    const [isUpdatingSeats, setIsUpdatingSeats] = useState<string | null>(null);
    const [createdCredentialsModal, setCreatedCredentialsModal] = useState<{
        email: string;
        name: string;
        role: string;
        temporaryPassword?: string | null;
        resetLink?: string | null;
    } | null>(null);
    const [isSettingPassword, setIsSettingPassword] = useState<string | null>(null);
    const [isGeneratingLink, setIsGeneratingLink] = useState<string | null>(null);

    // New User Form State
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [newUserTier, setNewUserTier] = useState('none');
    const [isCreatingUser, setIsCreatingUser] = useState(false);

    const currentUser = user;
    const [displayName, setDisplayName] = useState(currentUser?.name || '');
    const [title, setTitle] = useState(currentUser?.title || '');
    const [location, setLocation] = useState(currentUser?.location || '');
    const [currentTour, setCurrentTour] = useState(currentUser?.currentTour || '');
    const [specialties, setSpecialties] = useState(currentUser?.specialties?.join(', ') || '');
    const [gearInventory, setGearInventory] = useState(currentUser?.gearInventory || '');
    const [availableForWork, setAvailableForWork] = useState(currentUser?.availableForWork || false);
    const [isUpdatingName, setIsUpdatingName] = useState(false);

    // Branding State
    const [companyName, setCompanyName] = useState(currentUser?.branding?.companyName || '');
    const [companyAddress, setCompanyAddress] = useState(currentUser?.branding?.companyAddress || '');
    const [leadEngineer, setLeadEngineer] = useState(currentUser?.branding?.leadEngineer || '');
    const [contactEmail, setContactEmail] = useState(currentUser?.branding?.contactEmail || '');
    const [contactPhone, setContactPhone] = useState(currentUser?.branding?.contactPhone || '');
    const [websiteUrl, setWebsiteUrl] = useState(currentUser?.branding?.websiteUrl || '');
    const [brandColor, setBrandColor] = useState(currentUser?.branding?.brandColor || '#4f46e5');
    const [secondaryColor, setSecondaryColor] = useState(currentUser?.branding?.secondaryColor || '#0f172a');
    const [documentTheme, setDocumentTheme] = useState<'modern-minimal' | 'high-contrast' | 'classic'>(currentUser?.branding?.documentTheme || 'modern-minimal');
    const [logoBase64, setLogoBase64] = useState(currentUser?.branding?.logoBase64 || '');
    const [footerLogoBase64, setFooterLogoBase64] = useState(currentUser?.branding?.footerLogoBase64 || '');
    const [isUpdatingBranding, setIsUpdatingBranding] = useState(false);

    const masterAdmins = [
        'dvitalis1969@gmail.com',
        'dnomsed@live.co.uk',
        'aniakwlk@yahoo.co.uk',
        'pete@rfsuite.net',
        'info@rfsuite.net'
    ];
    
    const isMasterAdmin = currentUser?.email && masterAdmins.includes(currentUser.email.toLowerCase().trim());
    const isEnterprise = currentUser?.subscription?.toLowerCase()?.includes('enterprise') || false;
    // Only master platform administrators see the system Admin console; Enterprise admins see Team Seats
    const isAdmin = isMasterAdmin;
    const organizationId = currentUser?.id || currentUser?.organizationId;
    const maxSeats = currentUser?.maxSeats || 10;

    React.useEffect(() => {
        console.log("AccountDashboard useEffect. currentUser:", currentUser);
        if (currentUser) {
            console.log("AccountDashboard useEffect. branding:", currentUser.branding);
            setDisplayName(currentUser.name || '');
            setTitle(currentUser.title || '');
            setLocation(currentUser.location || '');
            setCurrentTour(currentUser.currentTour || '');
            setSpecialties(currentUser.specialties?.join(', ') || '');
            setGearInventory(currentUser.gearInventory || '');
            setAvailableForWork(currentUser.availableForWork || false);
            
            // Sync Branding
            setCompanyName(currentUser.branding?.companyName || '');
            setCompanyAddress(currentUser.branding?.companyAddress || '');
            setLeadEngineer(currentUser.branding?.leadEngineer || '');
            setContactEmail(currentUser.branding?.contactEmail || '');
            setContactPhone(currentUser.branding?.contactPhone || '');
            setWebsiteUrl(currentUser.branding?.websiteUrl || '');
            setBrandColor(currentUser.branding?.brandColor || '#4f46e5');
            setSecondaryColor(currentUser.branding?.secondaryColor || '#0f172a');
            setDocumentTheme(currentUser.branding?.documentTheme || 'modern-minimal');
            setLogoBase64(currentUser.branding?.logoBase64 || '');
            setFooterLogoBase64(currentUser.branding?.footerLogoBase64 || '');
        }
    }, [currentUser]);

    const handleUpdateBranding = async () => {
        if (!auth.currentUser) {
            console.error("No authenticated user found.");
            return;
        }
        setIsUpdatingBranding(true);
        try {
            const brandingData = {
                companyName: companyName.trim(),
                companyAddress: companyAddress.trim(),
                leadEngineer: leadEngineer.trim(),
                contactEmail: contactEmail.trim(),
                contactPhone: contactPhone.trim(),
                websiteUrl: websiteUrl.trim(),
                brandColor,
                secondaryColor,
                documentTheme,
                logoBase64,
                footerLogoBase64
            };
            console.log("Saving branding data for user:", auth.currentUser.uid, brandingData);

            const userDocRef = doc(db, 'users', auth.currentUser.uid);
            await setDoc(userDocRef, {
                branding: brandingData
            }, { merge: true });
            
            // Verify the save
            const docSnapshot = await getDoc(userDocRef);
            if (docSnapshot.exists()) {
                console.log("Branding data verified in Firestore:", docSnapshot.data().branding);
            } else {
                console.error("Branding data NOT found in Firestore after save!");
            }

            toast.success('Branding settings updated!');
        } catch (error: any) {
            console.error("Error updating branding:", error);
            toast.error(`Failed to update branding: ${error.message}`);
        } finally {
            setIsUpdatingBranding(false);
        }
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 500 * 1024) { // 500KB limit for Base64
            toast.error("Logo file is too large. Please use an image under 500KB.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setLogoBase64(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleFooterLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 500 * 1024) { // 500KB limit for Base64
            toast.error("Footer Logo file is too large. Please use an image under 500KB.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setFooterLogoBase64(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const downloadOfficialLogo = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            canvas.width = 1024;
            canvas.height = 1024;
            if (ctx) {
                ctx.clearRect(0, 0, 1024, 1024);
                ctx.drawImage(img, 0, 0, 1024, 1024);
                const pngUrl = canvas.toDataURL('image/png');
                const downloadLink = document.createElement('a');
                downloadLink.href = pngUrl;
                downloadLink.download = 'rfsuite_logo_1024.png';
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                toast.success("Logo downloaded as PNG");
            }
        };
        img.onerror = () => {
            toast.error("Failed to process logo for download");
        };
        img.src = '/icon.svg';
    };

    const handleUpdateProfile = async () => {
        if (!displayName.trim() || !auth.currentUser) {
            console.error("Missing display name or auth user:", { displayName: displayName.trim(), user: auth.currentUser });
            return;
        }
        console.log("Updating profile for user:", auth.currentUser.uid);
        try {
            setIsUpdatingName(true);
            await updateProfile(auth.currentUser!, { displayName: displayName });
            
            // Update user document in Firestore too
            const profileData = {
                name: displayName,
                title: title.trim(),
                location: location.trim(),
                currentTour: currentTour.trim(),
                specialties: specialties.split(',').map(s => s.trim()).filter(s => s),
                gearInventory: gearInventory.trim(),
                availableForWork
            };

            console.log("Saving to Firestore:", { uid: auth.currentUser.uid, profileData });
            await setDoc(doc(db, 'users', auth.currentUser.uid), profileData, { merge: true });
            await setDoc(doc(db, 'public_profiles', auth.currentUser.uid), {
                id: auth.currentUser.uid,
                ...profileData,
                lastSeen: new Date()
            }, { merge: true });
            
            // Sync with presence
            const globalRef = doc(db, 'presence', 'global', 'users', auth.currentUser.uid);
            await setDoc(globalRef, { 
                statusMessage: profileData.title || profileData.currentTour || ''
            }, { merge: true });

            console.log("Firestore save successful");
            
            toast.success('Profile updated successfully!');
        } catch (error: any) {
            console.error("Error updating profile:", error);
            toast.error(`Failed to update profile: ${error.message}`);
        } finally {
            setIsUpdatingName(false);
        }
    };

    // Sync currentUser with user prop from App.tsx

    React.useEffect(() => {
        // Check if config is available (via a health check or similar)
        const checkConfig = async () => {
            try {
                const response = await fetch(`${API_BASE}/api/health`);
                const data = await response.json();
                
                const stripeResponse = await fetch(`${API_BASE}/api/stripe-status`);
                const stripeData = await stripeResponse.json();
                
                setConfigStatus({ 
                    stripe: stripeData.configured, 
                    firebase: data.config?.firebaseAdmin,
                    stripeMode: stripeData.mode,
                    stripePrefix: stripeData.prefix
                });
            } catch (err) {
                console.error("Config check failed:", err);
            }
        };
        checkConfig();

        if (user?.id && activeTab === 'projects') {
            fetchProjects();
        }
        if (isAdmin && activeTab === 'admin') {
            fetchUsers();
            if (adminSubTab === 'tickets') fetchContactMessages();
            if (adminSubTab === 'system') fetchMetrics();
        }
        if (isEnterprise && activeTab === 'team') {
            fetchTeamMembers();
        }
    }, [user?.id, activeTab, isAdmin, isEnterprise, adminSubTab]);

    const fetchTeamMembers = async () => {
        if (!currentUser?.id) return;
        setIsFetchingTeam(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'users'));
            // Organization linking: find all users linked to this admin's organizationId
            const members = querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter((u: any) => u.organizationId === currentUser.id && u.id !== currentUser.id);
            setTeamMembers(members);
        } catch (err) {
            console.error("Failed to fetch team members:", err);
            toast.error("Failed to load team members.");
        } finally {
            setIsFetchingTeam(false);
        }
    };

    const handleAddTeamMember = async () => {
        if (!newUserEmail.trim()) {
            toast.error("Please enter an email address.");
            return;
        }
        if (teamMembers.length >= maxSeats) {
            toast.error(`Your Enterprise seat pool is full (${maxSeats} seats). Please remove an existing member to free up a seat.`);
            return;
        }
        setIsCreatingUser(true);
        try {
            const response = await fetch(`${API_BASE}/api/admin/create-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: newUserEmail.trim().toLowerCase(),
                    name: newUserName.trim(),
                    role: newTeamRole,
                    adminEmail: currentUser?.email,
                    password: newTeamPassword.trim() || undefined
                })
            });
            const data = await response.json();
            if (data.success) {
                toast.success(data.message || `Team member ${newUserEmail} allocated an Enterprise seat.`);
                setCreatedCredentialsModal({
                    email: newUserEmail.trim().toLowerCase(),
                    name: newUserName.trim() || newUserEmail.trim().split('@')[0],
                    role: newTeamRole === 'coordinator' ? 'RF Coordinator' : 'Stage Crew',
                    temporaryPassword: data.temporaryPassword,
                    resetLink: data.resetLink
                });
                setIsAddingUser(false);
                setNewUserEmail('');
                setNewUserName('');
                setNewTeamPassword('');
                setNewTeamRole('crew');
                fetchTeamMembers();
            } else {
                throw new Error(data.error || "Failed to add team member");
            }
        } catch (e: any) {
            console.error("Failed to add team member:", e);
            toast.error(e.message || "Failed to add team member");
        } finally {
            setIsCreatingUser(false);
        }
    };

    const handleSetMemberPassword = async (memberId: string, memberEmail: string, memberName: string) => {
        const inputPassword = window.prompt(`Enter a new login password for ${memberName || memberEmail} (minimum 6 characters):`);
        if (!inputPassword) return;
        if (inputPassword.trim().length < 6) {
            toast.error("Password must be at least 6 characters long.");
            return;
        }

        setIsSettingPassword(memberId);
        try {
            const response = await fetch(`${API_BASE}/api/admin/set-member-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memberId,
                    newPassword: inputPassword.trim(),
                    adminEmail: currentUser?.email
                })
            });
            const data = await response.json();
            if (data.success) {
                toast.success(data.message || `Password updated for ${memberEmail}`);
                if (navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(`Email: ${memberEmail}\nPassword: ${inputPassword.trim()}\nLogin URL: ${window.location.origin}`);
                    toast.info("Login credentials copied to your clipboard to send to the team member!");
                }
            } else {
                throw new Error(data.error || "Failed to set member password");
            }
        } catch (err: any) {
            console.error("Failed to set member password:", err);
            toast.error(err.message || "Failed to set member password");
        } finally {
            setIsSettingPassword(null);
        }
    };

    const handleCopyMemberResetLink = async (memberEmail: string) => {
        setIsGeneratingLink(memberEmail);
        try {
            const response = await fetch(`${API_BASE}/api/admin/get-member-reset-link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memberEmail: memberEmail.trim().toLowerCase(),
                    adminEmail: currentUser?.email
                })
            });
            const data = await response.json();
            if (data.success && data.resetLink) {
                await navigator.clipboard.writeText(data.resetLink);
                toast.success(`Activation link copied for ${memberEmail}! Send this link to the team member so they can set their password and sign in.`);
            } else {
                throw new Error(data.error || "Failed to generate activation link");
            }
        } catch (err: any) {
            console.error("Failed to get member reset link:", err);
            toast.error(err.message || "Failed to generate activation link");
        } finally {
            setIsGeneratingLink(null);
        }
    };

    const handleRemoveTeamMember = async (memberId: string, memberEmail: string, memberName: string) => {
        if (!window.confirm(`Are you sure you want to remove ${memberName || memberEmail} from your Enterprise team? Their inherited Pro access will be revoked immediately and their seat returned to your pool.`)) {
            return;
        }
        setIsRemovingMember(memberId);
        try {
            const response = await fetch(`${API_BASE}/api/admin/remove-team-member`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memberId,
                    adminEmail: currentUser?.email
                })
            });
            const data = await response.json();
            if (data.success) {
                toast.success(data.message || "Team member removed and seat returned to pool.");
                fetchTeamMembers();
            } else {
                throw new Error(data.error || "Failed to remove team member");
            }
        } catch (e: any) {
            console.error("Failed to remove team member:", e);
            toast.error(e.message || "Failed to remove team member");
        } finally {
            setIsRemovingMember(null);
        }
    };

    const fetchUsers = async () => {
        setIsFetchingUsers(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'users'));
            let usersList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Organizational Scoping: Enterprise admins only see their own organization's users
            if (isEnterprise && !isMasterAdmin) {
                usersList = usersList.filter((u: any) => u.organizationId === currentUser.id || u.id === currentUser.id);
            }

            setAllUsers(usersList);
        } catch (err) {
            console.error("Failed to fetch users:", err);
            toast.error("Failed to fetch users list.");
        } finally {
            setIsFetchingUsers(false);
        }
    };

    const fetchContactMessages = async () => {
        setIsFetchingMessages(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'contact_messages'));
            const messages = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).sort((a: any, b: any) => {
                const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
                const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
                return dateB - dateA;
            });
            setContactMessages(messages);
        } catch (err) {
            console.error("Failed to fetch messages:", err);
            toast.error("Failed to fetch support tickets.");
        } finally {
            setIsFetchingMessages(false);
        }
    };

    const fetchMetrics = async () => {
        setIsFetchingMetrics(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'projects'));
            setTotalProjectsCount(querySnapshot.size);
        } catch (err) {
            console.error("Failed to fetch metrics:", err);
            toast.error("Failed to fetch system metrics.");
        } finally {
            setIsFetchingMetrics(false);
        }
    };

    const handleSendBroadcast = async () => {
        if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
            toast.error("Please enter a title and message.");
            return;
        }
        setIsSendingBroadcast(true);
        try {
            const response = await fetch(`${API_BASE}/api/admin/broadcast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: broadcastTitle.trim(),
                    message: broadcastMessage.trim(),
                    adminEmail: currentUser.email
                })
            });
            
            const data = await response.json();
            if (data.success) {
                toast.success(data.scope === 'global' ? "Global broadcast sent!" : "Organization broadcast sent!");
                setBroadcastTitle('');
                setBroadcastMessage('');
            } else {
                throw new Error(data.error || "Failed to send broadcast");
            }
        } catch (err: any) {
            console.error("Failed to send broadcast:", err);
            toast.error(err.message || "Failed to send broadcast.");
        } finally {
            setIsSendingBroadcast(false);
        }
    };

    const handleResolveTicket = async (messageId: string) => {
        try {
            await setDoc(doc(db, 'contact_messages', messageId), {
                status: 'resolved',
                resolvedAt: new Date(),
                resolvedBy: currentUser.id
            }, { merge: true });
            toast.success("Ticket marked as resolved.");
            fetchContactMessages();
        } catch (err) {
            console.error("Failed to resolve ticket:", err);
            toast.error("Failed to resolve ticket.");
        }
    };

    const handleCreateUser = async () => {
        if (!newUserEmail) return toast.error("Email is required");
        setIsCreatingUser(true);
        try {
            const response = await fetch(`${API_BASE}/api/admin/create-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: newUserEmail.trim().toLowerCase(),
                    name: newUserName.trim(),
                    tier: newUserTier,
                    adminEmail: currentUser?.email
                })
            });
            const data = await response.json();
            if (data.success) {
                toast.success(data.message);
                setIsAddingUser(false);
                setNewUserEmail('');
                setNewUserName('');
                setNewUserTier('none');
                fetchUsers();
            } else {
                throw new Error(data.error || "Failed to create user");
            }
        } catch (e: any) {
            console.error("Failed to create user:", e);
            toast.error(e.message);
        } finally {
            setIsCreatingUser(false);
        }
    };

    const handleBanUser = async (userId: string, isCurrentlyBanned: boolean) => {
        if (!window.confirm(`Are you sure you want to ${isCurrentlyBanned ? 'unban' : 'ban'} this user?`)) return;
        try {
            await setDoc(doc(db, 'users', userId), {
                isBanned: !isCurrentlyBanned
            }, { merge: true });
            toast.success(`User ${isCurrentlyBanned ? 'unbanned' : 'banned'} successfully.`);
            fetchUsers();
        } catch (err) {
            console.error("Failed to toggle ban status:", err);
            toast.error("Failed to update user status.");
        }
    };

    const handleCustomTier = async (userId: string, tier: string) => {
        if (!window.confirm(`Grant ${tier} status to this user?`)) return;
        try {
            const payload: any = {
                subscription: tier,
                subscriptionStatus: 'active',
                expiresAt: null // No expiration
            };
            if (tier === 'Enterprise') {
                payload.maxSeats = 10;
            }
            await setDoc(doc(db, 'users', userId), payload, { merge: true });
            toast.success(`Granted ${tier} status.`);
            fetchUsers();
        } catch (err) {
            console.error("Failed to grant custom tier:", err);
            toast.error("Failed to grant custom tier.");
        }
    };

    const handleUpdateSeatLimit = async (userId: string, newSeatCount: number) => {
        if (newSeatCount < 1) {
            toast.error("Seat limit must be at least 1.");
            return;
        }
        setIsUpdatingSeats(userId);
        try {
            // Write directly to Firestore
            await setDoc(doc(db, 'users', userId), {
                maxSeats: newSeatCount,
                lastUpdated: new Date().toISOString()
            }, { merge: true });

            // Also call backend admin endpoint for server-side validation & audit log
            try {
                await fetch(`${API_BASE}/api/admin/update-seat-limit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        targetUserId: userId,
                        maxSeats: newSeatCount,
                        adminEmail: currentUser?.email
                    })
                });
            } catch (apiErr) {
                console.warn("Backend update-seat-limit call skipped/logged:", apiErr);
            }

            toast.success(`Enterprise seat allocation updated to ${newSeatCount} seats!`);
            await fetchUsers();
        } catch (err: any) {
            console.error("Failed to update seat limit:", err);
            toast.error(err.message || "Failed to update seat limit");
        } finally {
            setIsUpdatingSeats(null);
        }
    };

    const handleCleanupProjects = async () => {
        if (!window.confirm("This will delete all projects that haven't been modified in over a year. Are you absolutely sure?")) return;
        setIsFetchingMetrics(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'projects'));
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            
            let deletedCount = 0;
            const deletePromises = [];
            
            for (const docSnapshot of querySnapshot.docs) {
                const data = docSnapshot.data();
                const lastModified = data.lastModified ? new Date(data.lastModified) : new Date(0);
                if (lastModified < oneYearAgo) {
                    deletePromises.push(deleteProjectFromCloud(docSnapshot.id));
                    deletedCount++;
                }
            }
            
            await Promise.all(deletePromises);
            toast.success(`Cleaned up ${deletedCount} old projects.`);
            fetchMetrics();
        } catch (err) {
            console.error("Failed to cleanup projects:", err);
            toast.error("Failed to cleanup projects.");
        } finally {
            setIsFetchingMetrics(false);
        }
    };

    const handleExtendPass = async (userId: string, currentExpiresAt: string | undefined, hours: number) => {
        setIsFetchingUsers(true);
        try {
            const now = new Date();
            let baseDate = now;
            
            if (currentExpiresAt) {
                const existingDate = new Date(currentExpiresAt);
                if (existingDate > now) {
                    baseDate = existingDate;
                }
            }
            
            const newExpiration = new Date(baseDate.getTime() + hours * 60 * 60 * 1000);
            const userRef = doc(db, 'users', userId);
            
            await setDoc(userRef, {
                expiresAt: newExpiration.toISOString(),
                subscriptionStatus: 'active',
                subscription: hours >= 168 ? '7 Day Pass' : (hours >= 48 ? '48 Hour Pass' : '24 Hour Pass')
            }, { merge: true });
            
            toast.success(`Pass extended by ${hours} hours!`);
            await fetchUsers(); // Refresh the list
        } catch (err) {
            console.error("Failed to extend pass:", err);
            toast.error("Failed to extend pass.");
        } finally {
            setIsFetchingUsers(false);
        }
    };

    const fetchProjects = async () => {
        if (!user?.id) return;
        setIsFetchingProjects(true);
        try {
            const projects = await getUserProjectsFromCloud(user.id);
            setCloudProjects(projects);
        } catch (err) {
            console.error("Failed to fetch cloud projects:", err);
        } finally {
            setIsFetchingProjects(false);
        }
    };

    const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this project?')) return;
        try {
            await deleteProjectFromCloud(id);
            setCloudProjects(prev => prev.filter(p => p.id !== id));
        } catch (err) {
            console.error("Failed to delete project:", err);
            toast.error("Failed to delete project.");
        }
    };

    const handleLoadProject = (project: any) => {
        if (onLoadProject) {
            onLoadProject(project);
            onClose();
        }
    };

    // Hardcoded Stripe Price IDs
    const tiers = [
        { id: 'price_1TFx8PL5JAY1lJg5iiPBdgWN', name: '48 Hour Pass', price: '£5.99', icon: <Clock className="w-3.5 h-3.5" />, desc: 'Single Event Access' },
        { id: 'price_1TFx8gL5JAY1lJg5po1s8JQ2', name: '7 Day Pass', price: '£12.99', icon: <Calendar className="w-3.5 h-3.5" />, desc: 'Festival Week Access' },
        { id: 'price_1TFx90L5JAY1lJg5fCz7HRne', name: '1 Month Pro', price: '£26.99', icon: <Zap className="w-3.5 h-3.5" />, desc: 'Continuous Professional Use' },
        { id: 'price_1TVd9PL5JAY1lJg5uk67PX0b', name: 'Enterprise', price: '£99.99', icon: <Shield className="w-3.5 h-3.5" />, desc: 'Multiple Concurrent Logins' }
    ];

    // Use relative path for API calls - this works on both localhost and Render automatically
    const API_BASE = ''; 

    const handleSubscribe = async (priceId: string, tierName: string) => {
        const targetUrl = `${API_BASE}/api/create-checkout-session`;
        try {
            setIsLoading(true);
            setLastError(null);
            toast.info("Connecting to Stripe...", { description: `Price ID: ${priceId}` });
            console.log(`Initiating checkout to: ${targetUrl}`);
            
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priceId,
                    userId: currentUser.id,
                    email: currentUser.email,
                    returnUrl: API_BASE || window.location.origin, // Ensure return URL points to the backend server
                    tierName,
                }),
            });
            
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await response.text();
                console.error(`Invalid response from ${targetUrl}:`, text.substring(0, 100));
                throw new Error(`Server returned an invalid response (likely HTML) from ${targetUrl}.`);
            }
            
            const data = await response.json();
            if (data.url) {
                const newWindow = window.open(data.url, '_blank');
                if (!newWindow) {
                    toast.error('Please allow popups to open the Stripe checkout page.');
                }
                setIsLoading(false);
            } else {
                const errorMsg = data.message || data.error || 'Failed to create checkout session';
                setLastError(errorMsg);
                throw new Error(errorMsg);
            }
        } catch (error: any) {
            console.error('Subscription error:', error);
            const errorMessage = error.message || 'Failed to start checkout process.';
            setLastError(errorMessage);
            toast.error(`Stripe Connection Error: ${errorMessage}`);
            setIsLoading(false);
        }
    };

    const handleManageBilling = async () => {
        // In a real app, you'd fetch the stripeCustomerId from the user document
        // For now, we'll show a toast if it's not available in the user object
        if (!currentUser.stripeCustomerId) {
            toast.error('No active billing profile found. Please subscribe to a plan first.');
            return;
        }

        try {
            setIsLoading(true);
            const response = await fetch(`${API_BASE}/api/create-portal-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId: currentUser.stripeCustomerId,
                    returnUrl: API_BASE || window.location.origin, // Ensure return URL points to the backend server
                }),
            });
            
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("Server returned an invalid response. If you deployed this app to a static host like Netlify, the backend API is not running.");
            }
            
            const data = await response.json();
            if (data.url) {
                const newWindow = window.open(data.url, '_blank');
                if (!newWindow) {
                    toast.error('Please allow popups to open the Stripe billing portal.');
                }
                setIsLoading(false);
            } else {
                throw new Error(data.error || 'Failed to create portal session');
            }
        } catch (error) {
            console.error('Portal error:', error);
            toast.error('Failed to open billing portal.');
            setIsLoading(false);
        }
    };

    const handlePasswordReset = async () => {
        if (!currentUser?.email) return;
        try {
            setIsLoading(true);
            await sendPasswordResetEmail(auth, currentUser.email);
            toast.success(`A password reset email has been sent to ${currentUser.email}. Please check your inbox.`);
        } catch (error: any) {
            console.error("Password reset error:", error);
            toast.error(`Failed to send password reset email: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000000] flex items-center justify-center p-2 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-4xl h-[90vh] md:h-[80vh] bg-slate-900 border border-white/10 rounded-[2rem] shadow-2xl flex flex-col md:flex-row overflow-y-auto md:overflow-hidden relative">
                {/* Close Button - Moved to container level for better visibility on mobile */}
                <button 
                    onClick={onClose}
                    className="absolute top-6 right-6 md:top-8 md:right-8 p-2 rounded-md bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all z-20"
                >
                    <X className="w-3.5 h-3.5" />
                </button>

                {/* Sidebar */}
                <div className="w-full md:w-64 bg-slate-950/50 border-b md:border-b-0 md:border-r border-white/5 p-4 flex flex-col shrink-0">
                    <div className="flex items-center gap-2 mb-6 md:mb-10">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-600 rounded-md md:rounded-md flex items-center justify-center text-base font-medium md:text-lg font-semibold shadow-sm border border-slate-700/50">📡</div>
                        <div>
                            <h2 className="text-xs md:text-sm font-black text-white uppercase tracking-widest">RF Pro</h2>
                            <p className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Account Center</p>
                        </div>
                    </div>

                    <nav className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-col gap-2 mb-8 md:mb-0 md:flex-grow">
                        {[
                            { id: 'profile', label: 'Profile', icon: <User className="w-3 h-3 md:w-4 md:h-4" /> },
                            { id: 'projects', label: 'My Projects', icon: <Zap className="w-3 h-3 md:w-4 md:h-4" /> },
                            { id: 'branding', label: 'Branding', icon: <Shield className="w-3 h-3 md:w-4 md:h-4" /> },
                            { id: 'billing', label: 'Subscription', icon: <CreditCard className="w-3 h-3 md:w-4 md:h-4" /> },
                            isEnterprise ? { id: 'team', label: 'Team Seats', icon: <Users className="w-3 h-3 md:w-4 md:h-4" /> } : null,
                            { id: 'security', label: 'Security', icon: <Shield className="w-3 h-3 md:w-4 md:h-4" /> },
                            { id: 'contact', label: 'Contact', icon: <Mail className="w-3 h-3 md:w-4 md:h-4" /> },
                            isAdmin ? { id: 'admin', label: 'Platform Admin', icon: <ShieldAlert className="w-3 h-3 md:w-4 md:h-4" /> } : null
                        ].filter(Boolean).map((tab: any) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-3 md:gap-2 px-3 py-2 md:px-3 md:py-3 rounded-md text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${
                                    activeTab === tab.id 
                                    ? 'bg-indigo-600 text-white shadow-sm border border-slate-700/50' 
                                    : 'text-slate-500 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </nav>

                    <button 
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 md:gap-2 px-3 py-2 md:px-3 md:py-3 rounded-md text-[9px] md:text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10 transition-all mt-auto"
                    >
                        <LogOut className="w-3 h-3 md:w-4 md:h-4" />
                        Sign Out
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow p-4 md:p-12 md:overflow-y-auto relative">
                    {activeTab === 'profile' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="text-xl font-semibold font-black text-white uppercase tracking-tight mb-8">User Profile</h3>
                            <div className="space-y-8">
                                <div className="flex items-center gap-4 p-4 bg-slate-950 border border-white/5 rounded-3xl">
                                    <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-3xl flex items-center justify-center text-3xl font-black text-white shadow-sm border border-slate-700/50">
                                        {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                    <div className="flex-grow">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-lg font-semibold font-black text-white uppercase tracking-wider">{currentUser?.name || 'User'}</h4>
                                        </div>
                                        <p className="text-slate-500 text-sm font-medium">{currentUser?.email}</p>
                                        <div className="mt-4 flex items-center gap-2">
                                            <input 
                                                type="text"
                                                value={displayName}
                                                onChange={(e) => setDisplayName(e.target.value)}
                                                className="bg-slate-950 border border-white/5 rounded-md py-2 px-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all"
                                                placeholder="Enter display name"
                                            />
                                        </div>
                                        <div className="mt-2 inline-block px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                                            {currentUser?.subscriptionStatus === 'none' ? 'Free Tier' : `${currentUser?.subscription} Member`}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-950 border border-white/5 rounded-3xl space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Professional Details</h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Job Title</label>
                                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. RF Coordinator, A1" className="w-full bg-slate-900 border border-slate-800 rounded-sm p-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Location</label>
                                            <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. London, UK" className="w-full bg-slate-900 border border-slate-800 rounded-sm p-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Current Tour / Project</label>
                                            <input type="text" value={currentTour} onChange={e => setCurrentTour(e.target.value)} placeholder="e.g. World Tour 2026" className="w-full bg-slate-900 border border-slate-800 rounded-sm p-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Specialties (comma separated)</label>
                                            <input type="text" value={specialties} onChange={e => setSpecialties(e.target.value)} placeholder="e.g. IEMs, Broadcast, Comms" className="w-full bg-slate-900 border border-slate-800 rounded-sm p-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Gear Inventory / Notes</label>
                                        <textarea value={gearInventory} onChange={e => setGearInventory(e.target.value)} placeholder="List your available gear or professional notes..." className="w-full h-20 bg-slate-900 border border-slate-800 rounded-sm p-2 text-sm text-white focus:border-indigo-500 outline-none resize-none" />
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <div className="relative">
                                                <input type="checkbox" className="sr-only" checked={availableForWork} onChange={e => setAvailableForWork(e.target.checked)} />
                                                <div className={`block w-10 h-6 rounded-full transition-colors ${availableForWork ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                                                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${availableForWork ? 'transform translate-x-4' : ''}`}></div>
                                            </div>
                                            <span className="text-sm font-medium text-slate-300">Available for Work / Networking</span>
                                        </label>

                                        <button 
                                            onClick={handleUpdateProfile}
                                            disabled={isUpdatingName}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest text-[10px] rounded-md transition-all"
                                        >
                                            {isUpdatingName ? 'Saving...' : 'Save Profile'}
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 bg-slate-950 border border-white/5 rounded-3xl">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Member Since</p>
                                        <p className="text-white font-bold">Today</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'projects' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-semibold font-black text-white uppercase tracking-tight">My Cloud Projects</h3>
                                <button 
                                    onClick={fetchProjects}
                                    className="p-2 rounded-md bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                                    title="Refresh Projects"
                                >
                                    <Clock className={`w-4 h-4 ${isFetchingProjects ? 'animate-spin' : ''}`} />
                                </button>
                            </div>

                            {isFetchingProjects ? (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                    <p className="text-[10px] font-black uppercase tracking-widest">Loading Projects...</p>
                                </div>
                            ) : cloudProjects.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 bg-slate-950/50 border border-dashed border-white/10 rounded-3xl text-slate-500">
                                    <Zap className="w-12 h-12 mb-4 opacity-20" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">No cloud projects found</p>
                                    <p className="text-[9px] mt-2 opacity-50">Save a project from the main header to see it here.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-2">
                                    {cloudProjects.map(project => (
                                        <div 
                                            key={project.id} 
                                            onClick={() => handleLoadProject(project)}
                                            className="group p-4 bg-slate-950 border border-white/5 rounded-3xl hover:border-indigo-500/30 transition-all cursor-pointer flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-indigo-600/10 rounded-md flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                                    <Zap className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-white uppercase tracking-wider mb-1">{project.name}</h4>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                                                        <Clock className="w-3 h-3" />
                                                        Modified: {project.lastModified.toLocaleDateString()} {project.lastModified.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={(e) => handleDeleteProject(project.id, e)}
                                                    className="p-3 rounded-md bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
                                                    title="Delete Project"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                                <div className="w-10 h-10 bg-white/5 rounded-md flex items-center justify-center text-slate-400 group-hover:text-white transition-all">
                                                    →
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'branding' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-semibold font-black text-white uppercase tracking-tight">Report Branding</h3>
                                {!isPro(currentUser) && (
                                    <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[9px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                                        <Zap className="w-3 h-3" /> Pro Feature
                                    </div>
                                )}
                            </div>

                            <div className="space-y-8">
                                <div className="p-8 bg-slate-950 border border-white/5 rounded-[2rem] space-y-8">
                                    <div className="flex flex-col md:flex-row gap-8">
                                        <div className="w-full md:w-48 space-y-4">
                                            <div className="space-y-4">
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Header Logo</label>
                                                <div className="aspect-square bg-slate-900 border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden group transition-all hover:border-indigo-500/50">
                                                    {logoBase64 ? (
                                                        <>
                                                            <img src={logoBase64} alt="Company Logo" className="w-full h-full object-contain p-2" />
                                                            <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <button 
                                                                    onClick={() => setLogoBase64('')}
                                                                    className="p-2 bg-red-500 rounded-md text-white shadow-sm border border-slate-700/50 transform scale-75 group-hover:scale-100 transition-transform"
                                                                >
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="text-center p-2">
                                                            <div className="w-10 h-10 bg-white/5 rounded-md flex items-center justify-center text-slate-500 mx-auto mb-2 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                                                <Zap className="w-3.5 h-3.5" />
                                                            </div>
                                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Upload PNG/JPG</p>
                                                            <p className="text-[7px] text-slate-600 mt-1 uppercase">Max 500KB</p>
                                                        </div>
                                                    )}
                                                    <input 
                                                        type="file" 
                                                        accept="image/*" 
                                                        onChange={handleLogoUpload}
                                                        className="absolute inset-0 opacity-0 cursor-pointer" 
                                                        disabled={!isPro(currentUser)}
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-4 pt-4 border-t border-white/5">
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Footer Logo</label>
                                                <div className="aspect-square bg-slate-900 border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden group transition-all hover:border-indigo-500/50">
                                                    {footerLogoBase64 ? (
                                                        <>
                                                            <img src={footerLogoBase64} alt="Footer Logo" className="w-full h-full object-contain p-2" />
                                                            <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <button 
                                                                    onClick={() => setFooterLogoBase64('')}
                                                                    className="p-2 bg-red-500 rounded-md text-white shadow-sm border border-slate-700/50 transform scale-75 group-hover:scale-100 transition-transform"
                                                                >
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="text-center p-2">
                                                            <div className="w-10 h-10 bg-white/5 rounded-md flex items-center justify-center text-slate-500 mx-auto mb-2 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                                                <Zap className="w-3.5 h-3.5" />
                                                            </div>
                                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Upload PNG/JPG</p>
                                                            <p className="text-[7px] text-slate-600 mt-1 uppercase">Max 500KB</p>
                                                        </div>
                                                    )}
                                                    <input 
                                                        type="file" 
                                                        accept="image/*" 
                                                        onChange={handleFooterLogoUpload}
                                                        className="absolute inset-0 opacity-0 cursor-pointer" 
                                                        disabled={!isPro(currentUser)}
                                                    />
                                                </div>
                                            </div>

                                            <button 
                                                onClick={downloadOfficialLogo}
                                                className="w-full mt-2 py-2 px-3 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-md text-[8px] font-black text-slate-400 hover:text-white uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                            >
                                                <ExternalLink className="w-3 h-3" /> Download RF Suite Logo (PNG)
                                            </button>
                                        </div>

                                        <div className="flex-grow space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                <div className="space-y-2">
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Company Name</label>
                                                    <input 
                                                        type="text" 
                                                        value={companyName} 
                                                        onChange={e => setCompanyName(e.target.value)} 
                                                        placeholder="e.g. Acme Productions" 
                                                        className="w-full bg-slate-900 border border-white/5 rounded-md py-3 px-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                                        disabled={!isPro(currentUser)}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Company Address</label>
                                                    <input 
                                                        type="text" 
                                                        value={companyAddress} 
                                                        onChange={e => setCompanyAddress(e.target.value)} 
                                                        placeholder="e.g. 123 Main St, City, Country" 
                                                        className="w-full bg-slate-900 border border-white/5 rounded-md py-3 px-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                                        disabled={!isPro(currentUser)}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Lead Engineer</label>
                                                    <input 
                                                        type="text" 
                                                        value={leadEngineer} 
                                                        onChange={e => setLeadEngineer(e.target.value)} 
                                                        placeholder="e.g. John Doe" 
                                                        className="w-full bg-slate-900 border border-white/5 rounded-md py-3 px-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                                        disabled={!isPro(currentUser)}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Contact Email</label>
                                                    <input 
                                                        type="email" 
                                                        value={contactEmail} 
                                                        onChange={e => setContactEmail(e.target.value)} 
                                                        placeholder="e.g. support@acme.com" 
                                                        className="w-full bg-slate-900 border border-white/5 rounded-md py-3 px-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                                        disabled={!isPro(currentUser)}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Contact Phone</label>
                                                    <input 
                                                        type="text" 
                                                        value={contactPhone} 
                                                        onChange={e => setContactPhone(e.target.value)} 
                                                        placeholder="e.g. +1 234 567 890" 
                                                        className="w-full bg-slate-900 border border-white/5 rounded-md py-3 px-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                                        disabled={!isPro(currentUser)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Website URL</label>
                                                <input 
                                                    type="text" 
                                                    value={websiteUrl} 
                                                    onChange={e => setWebsiteUrl(e.target.value)} 
                                                    placeholder="e.g. https://acme.com" 
                                                    className="w-full bg-slate-900 border border-white/5 rounded-md py-3 px-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                                    disabled={!isPro(currentUser)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-2">
                                            <div className="space-y-2">
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Brand Accent Color</label>
                                                <div className="flex items-center gap-3">
                                                    <input 
                                                        type="color" 
                                                        value={brandColor} 
                                                        onChange={e => setBrandColor(e.target.value)} 
                                                        className="w-12 h-12 bg-transparent border-none cursor-pointer"
                                                        disabled={!isPro(currentUser)}
                                                    />
                                                    <span className="text-xs font-mono text-slate-400 uppercase">{brandColor}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Secondary Accent Color</label>
                                                <div className="flex items-center gap-3">
                                                    <input 
                                                        type="color" 
                                                        value={secondaryColor} 
                                                        onChange={e => setSecondaryColor(e.target.value)} 
                                                        className="w-12 h-12 bg-transparent border-none cursor-pointer"
                                                        disabled={!isPro(currentUser)}
                                                    />
                                                    <span className="text-xs font-mono text-slate-400 uppercase">{secondaryColor}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-2 md:col-span-2">
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Document Theme</label>
                                                <select 
                                                    value={documentTheme}
                                                    onChange={e => setDocumentTheme(e.target.value as any)}
                                                    className="w-full bg-slate-900 border border-white/5 rounded-md py-3 px-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                                    disabled={!isPro(currentUser)}
                                                >
                                                    <option value="modern-minimal">Modern Minimal</option>
                                                    <option value="high-contrast">High Contrast</option>
                                                    <option value="classic">Classic</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {!isPro(currentUser) ? (
                                                <button 
                                                    onClick={() => onUpgrade('Pro')}
                                                    className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-black uppercase tracking-widest text-[10px] rounded-md shadow-sm border border-slate-700/50 shadow-indigo-500/20 transition-all flex items-center gap-2"
                                                >
                                                    <Zap className="w-4 h-4" /> Upgrade to Pro
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={handleUpdateBranding}
                                                    disabled={isUpdatingBranding}
                                                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest text-[10px] rounded-md shadow-sm border border-slate-700/50 shadow-indigo-500/20 transition-all"
                                                >
                                                    {isUpdatingBranding ? 'Saving...' : 'Save Branding'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-indigo-600/5 border border-indigo-500/10 rounded-3xl">
                                    <div className="flex items-start gap-2">
                                        <div className="w-8 h-8 bg-indigo-600 rounded-md flex items-center justify-center text-white shrink-0">
                                            <Shield className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-white uppercase tracking-wider mb-1">How it works</h4>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                Once saved, your company logo and details will automatically appear in the header of all exported PDF reports. 
                                                The brand accent color will be applied to table headers and visual elements in the report, giving your deliverables a professional, custom-branded look.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="text-xl font-semibold font-black text-white uppercase tracking-tight mb-8">Subscription Plans</h3>
                            
                            {currentUser?.subscriptionStatus !== 'none' && (
                                <div className="mb-10 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-12 h-12 bg-emerald-500 rounded-md flex items-center justify-center text-lg font-semibold text-white shadow-sm border border-slate-700/50">✓</div>
                                        <div>
                                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Active Plan</p>
                                            <h4 className="text-base font-medium font-black text-white uppercase tracking-wider">{currentUser?.subscription}</h4>
                                            {currentUser?.expiresAt && (
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                                    Expires: {new Date(currentUser.expiresAt).toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleManageBilling}
                                        disabled={isLoading}
                                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[10px] font-black uppercase tracking-widest text-white transition-all flex items-center gap-2"
                                    >
                                        Manage Billing <ExternalLink className="w-3 h-3" />
                                    </button>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-12">
                                {tiers.map(tier => (
                                    <div key={tier.id} className="p-4 bg-slate-950 border border-white/5 rounded-3xl flex flex-col h-full hover:border-indigo-500/30 transition-all group">
                                        <div className="w-10 h-10 bg-white/5 rounded-md flex items-center justify-center text-slate-400 mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                            {tier.icon}
                                        </div>
                                        <h4 className="text-sm font-black text-white uppercase tracking-wider mb-1">{tier.name}</h4>
                                        <p className="text-xl font-semibold font-black text-white mb-4">{tier.price}</p>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-6 flex-grow">{tier.desc}</p>
                                        <button 
                                            onClick={() => handleSubscribe(tier.id, tier.name)}
                                            disabled={isLoading}
                                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest text-[9px] rounded-md transition-all"
                                        >
                                            {isLoading ? 'Processing...' : 'Subscribe'}
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Debug Section - Only visible in development or for admins */}
                            <div className="bg-amber-500/5 rounded-3xl border border-amber-500/20 overflow-hidden">
                                <div className="p-2 bg-amber-500/10 border-b border-amber-500/10 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ShieldAlert className="w-4 h-4 text-amber-500" />
                                        <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Debug Information</h3>
                                    </div>
                                    <span className="text-[8px] font-black text-amber-500/50 bg-amber-500/10 px-2 py-0.5 rounded uppercase tracking-tighter">Diagnostic Mode</span>
                                </div>
                                <div className="p-4 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest">Backend Configuration</p>
                                            <div className="bg-black/40 p-2 rounded-md border border-white/5 font-mono text-[10px] space-y-1">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Stripe Config:</span>
                                                    <span className={configStatus.stripe ? 'text-emerald-400' : 'text-rose-400'}>{configStatus.stripe ? '✅ CONFIGURED' : '❌ MISSING'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Firebase Admin:</span>
                                                    <span className={configStatus.firebase ? 'text-emerald-400' : 'text-rose-400'}>{configStatus.firebase ? '✅ CONFIGURED' : '❌ MISSING'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Stripe Mode:</span>
                                                    <span className="text-amber-400 uppercase">{configStatus.stripeMode || 'UNKNOWN'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest">User Document State</p>
                                            <div className="bg-black/40 p-2 rounded-md border border-white/5 font-mono text-[10px] space-y-1">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Status:</span>
                                                    <span className="text-white">{user?.subscriptionStatus || 'undefined'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Plan:</span>
                                                    <span className="text-white">{user?.subscription || 'undefined'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">isPro Result:</span>
                                                    <span className={isPro(user) ? 'text-emerald-400' : 'text-rose-400'}>{isPro(user) ? 'TRUE' : 'FALSE'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Expires At:</span>
                                                    <span className="text-white">{user?.expiresAt || 'MISSING'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-black/40 rounded-md border border-white/5 font-mono text-[9px] text-slate-400 break-all">
                                        UID: {user?.id}
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={async () => {
                                                if (!auth.currentUser) return toast.error("Not logged in");
                                                try {
                                                    const docRef = doc(db, 'users', auth.currentUser.uid);
                                                    const docSnap = await getDoc(docRef);
                                                    if (docSnap.exists()) {
                                                        console.log("Forced Refresh Data:", docSnap.data());
                                                        toast.success("User data refreshed from Firestore");
                                                        // The onSnapshot in App.tsx should already be handling this, 
                                                        // but this forces a console log for debugging.
                                                    }
                                                } catch (e: any) {
                                                    toast.error(`Refresh failed: ${e.message}`);
                                                }
                                            }}
                                            className="text-[9px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-400 transition-colors"
                                        >
                                            Refresh User Data
                                        </button>
                                        <button 
                                            onClick={() => {
                                                console.log("Full User Object:", user);
                                                toast.info("Full user object logged to console");
                                            }}
                                            className="text-[9px] font-black uppercase tracking-widest text-amber-500 hover:text-amber-400 transition-colors"
                                        >
                                            Log Full User Object
                                        </button>
                                        <button 
                                            onClick={async () => {
                                                try {
                                                    const response = await fetch(`${API_BASE}/api/health`);
                                                    const data = await response.json();
                                                    console.log("Health Check Result:", data);
                                                    toast.info("Health check result logged to console");
                                                } catch (e) {
                                                    console.error("Health check failed:", e);
                                                    toast.error("Health check failed");
                                                }
                                            }}
                                            className="text-[9px] font-black uppercase tracking-widest text-amber-500 hover:text-amber-400 transition-colors"
                                        >
                                            Run Health Check
                                        </button>
                                        <button 
                                            onClick={async () => {
                                                if (!user?.id) return toast.error("No user ID found");
                                                try {
                                                    const response = await fetch(`${API_BASE}/api/test-checkout-success`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ userId: user.id })
                                                    });
                                                    const data = await response.json();
                                                    if (data.success) {
                                                        toast.success("Mock update successful! Refreshing...");
                                                        setTimeout(() => window.location.reload(), 2000);
                                                    } else {
                                                        throw new Error(data.error || "Unknown error");
                                                    }
                                                } catch (e: any) {
                                                    console.error("Mock update failed:", e);
                                                    toast.error(`Mock update failed: ${e.message}`);
                                                }
                                            }}
                                            className="text-[9px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-400 transition-colors"
                                        >
                                            Test Mock Success
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'admin' && isAdmin && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-6">
                                <h3 className="text-xl font-semibold font-black text-white uppercase tracking-tight">Admin Dashboard</h3>
                            </div>

                            <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
                                {['users', 'broadcasts', isMasterAdmin ? 'tickets' : null, isMasterAdmin ? 'system' : null].filter(Boolean).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setAdminSubTab(tab as any)}
                                        className={`px-3 py-2 rounded-md text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                                            adminSubTab === tab 
                                                ? 'bg-indigo-600 text-white shadow-sm border border-slate-700/50 shadow-indigo-500/20' 
                                                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            {adminSubTab === 'users' && (
                                <div>
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-6">
                                        <div className="flex items-center gap-3">
                                            <h4 className="text-sm font-black text-white uppercase tracking-wider">User Directory</h4>
                                            <button 
                                                onClick={() => setIsAddingUser(!isAddingUser)}
                                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-sm text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
                                            >
                                                {isAddingUser ? 'Cancel' : (
                                                    <>
                                                        <Plus className="w-3.5 h-3.5" />
                                                        Add User
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-3 flex-grow md:max-w-md">
                                            <div className="relative flex-grow">
                                                <input 
                                                    type="text"
                                                    value={userSearchTerm}
                                                    onChange={(e) => setUserSearchTerm(e.target.value)}
                                                    placeholder="Search name or email..."
                                                    className="w-full bg-slate-950 border border-white/10 rounded-md py-2 px-3 pl-10 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-all"
                                                />
                                                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                            </div>
                                            <button 
                                                onClick={fetchUsers}
                                                className="p-2 rounded-md bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all shrink-0"
                                                title="Refresh Users"
                                            >
                                                <Clock className={`w-4 h-4 ${isFetchingUsers ? 'animate-spin' : ''}`} />
                                            </button>
                                        </div>
                                    </div>

                                    {isAddingUser && (
                                        <div className="mb-8 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-3xl animate-in fade-in slide-in-from-top-4 duration-300">
                                            <h5 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-4">Create New Account</h5>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Full Name</label>
                                                    <input 
                                                        type="text"
                                                        value={newUserName}
                                                        onChange={(e) => setNewUserName(e.target.value)}
                                                        placeholder="John Doe"
                                                        className="w-full bg-slate-950 border border-white/10 rounded-md py-2 px-3 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all font-bold"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Email Address</label>
                                                    <input 
                                                        type="email"
                                                        value={newUserEmail}
                                                        onChange={(e) => setNewUserEmail(e.target.value)}
                                                        placeholder="john@example.com"
                                                        className="w-full bg-slate-950 border border-white/10 rounded-md py-2 px-3 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all font-bold"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Membership Tier</label>
                                                    <select 
                                                        value={newUserTier}
                                                        onChange={(e) => setNewUserTier(e.target.value)}
                                                        className="w-full bg-slate-950 border border-white/10 rounded-md py-2 px-3 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all font-bold"
                                                    >
                                                        <option value="none">Free Account</option>
                                                        <option value="48 Hour Pass">48 Hour Pass</option>
                                                        <option value="7 Day Pass">7 Day Pass</option>
                                                        <option value="1 Month Pro">1 Month Pro</option>
                                                        <option value="Lifetime Pro">Lifetime Pro</option>
                                                        <option value="Enterprise">Enterprise</option>
                                                    </select>
                                                </div>
                                                <button 
                                                    onClick={handleCreateUser}
                                                    disabled={isCreatingUser || !newUserEmail}
                                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    {isCreatingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                                    Create User
                                                </button>
                                            </div>
                                            <p className="mt-4 text-[9px] text-slate-500 font-bold uppercase tracking-widest italic">Note: A random temporary password will be generated. The user should use "Forgot Password" to set their own password upon first login.</p>
                                        </div>
                                    )}

                                    {isFetchingUsers ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                                            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                            <p className="text-[10px] font-black uppercase tracking-widest">Loading Users...</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 gap-2">
                                                {allUsers
                                                    .filter(u => {
                                                        const search = userSearchTerm.toLowerCase().trim();
                                                        if (!search) return true;
                                                        return (
                                                            (u.name?.toLowerCase().includes(search)) ||
                                                            (u.email?.toLowerCase().includes(search)) ||
                                                            (u.id?.toLowerCase().includes(search))
                                                        );
                                                    })
                                                    .map((u: any) => {
                                                    const isProUser = isPro(u);
                                                    const expiresAt = u.expiresAt ? new Date(u.expiresAt) : null;
                                                    const now = new Date();
                                                    const timeLeft = expiresAt ? expiresAt.getTime() - now.getTime() : 0;
                                                    const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                                                    const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                                    const isEnterpriseUser = u.subscription?.toLowerCase()?.includes('enterprise') || (u.maxSeats && u.maxSeats > 0);
                                                    const currentSeats = u.maxSeats || 10;
                                                    const linkedMembersCount = allUsers.filter((m: any) => m.organizationId === u.id && m.id !== u.id).length;
                                                    
                                                    return (
                                                        <div key={u.id} className={`p-4 bg-slate-950 border rounded-3xl transition-all ${u.isBanned ? 'border-rose-500/50 opacity-75' : 'border-white/5 hover:border-white/10'}`}>
                                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-12 h-12 rounded-md flex items-center justify-center text-lg font-semibold font-black text-white shadow-sm border border-slate-700/50 ${u.isBanned ? 'bg-rose-600' : isProUser ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                                                                        {u.name?.charAt(0).toUpperCase() || 'U'}
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="text-sm font-black text-white uppercase tracking-wider">
                                                                            {u.name || 'Anonymous'}
                                                                            {u.isBanned && <span className="ml-2 text-[9px] text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full">BANNED</span>}
                                                                        </h4>
                                                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{u.email}</p>
                                                                        <p className="text-[9px] text-slate-600 font-mono mt-1">UID: {u.id}</p>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="flex flex-wrap items-center gap-3">
                                                                    <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                                                        isProUser 
                                                                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                                                            : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
                                                                    }`}>
                                                                        {isProUser ? 'Pro Member' : 'Free Tier'}
                                                                    </div>
                                                                    
                                                                    {isEnterpriseUser && (
                                                                        <div className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-indigo-500/10 border-indigo-500/30 text-indigo-300 flex items-center gap-1.5">
                                                                            <Users className="w-3 h-3 text-indigo-400" />
                                                                            <span>Seat Pool: <strong className="text-white">{linkedMembersCount} / {currentSeats}</strong></span>
                                                                        </div>
                                                                    )}

                                                                    {isProUser && expiresAt && (
                                                                        <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                                                            timeLeft < 3600000 ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                                                                        }`}>
                                                                            {u.subscription}: {daysLeft > 0 ? `${daysLeft}d ` : ''}{hoursLeft}h remaining
                                                                        </div>
                                                                    )}
                                                                    
                                                                    {u.stripeCustomerId && (
                                                                        <div className="px-3 py-1 bg-slate-800 border border-white/5 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                                            Stripe: {u.stripeCustomerId}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            
                                                            {u.expiresAt && (
                                                                <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                                                    <div className="flex items-center gap-1">
                                                                        <Calendar className="w-3 h-3" />
                                                                        Expires: {expiresAt.toLocaleString()}
                                                                    </div>
                                                                    {u.subscriptionStatus && (
                                                                        <div className="flex items-center gap-1">
                                                                            <Shield className="w-3 h-3" />
                                                                            Status: {u.subscriptionStatus}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            <div className="mt-4 pt-4 border-t border-white/5">
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Admin Actions</p>
                                                                <div className="flex flex-wrap gap-2">
                                                                    <button 
                                                                        onClick={() => handleExtendPass(u.id, u.expiresAt, 24)}
                                                                        disabled={isFetchingUsers}
                                                                        className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 rounded-sm text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                                                    >
                                                                        +24 Hours
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleExtendPass(u.id, u.expiresAt, 48)}
                                                                        disabled={isFetchingUsers}
                                                                        className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 rounded-sm text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                                                    >
                                                                        +48 Hours
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleExtendPass(u.id, u.expiresAt, 168)}
                                                                        disabled={isFetchingUsers}
                                                                        className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 rounded-sm text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                                                    >
                                                                        +7 Days
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleCustomTier(u.id, 'Lifetime Pro')}
                                                                        disabled={isFetchingUsers}
                                                                        className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-white border border-amber-500/20 rounded-sm text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                                                    >
                                                                        Lifetime Pro
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleCustomTier(u.id, 'Beta Tester')}
                                                                        disabled={isFetchingUsers}
                                                                        className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/20 rounded-sm text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                                                    >
                                                                        Beta Tester
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleCustomTier(u.id, 'Enterprise')}
                                                                        disabled={isFetchingUsers}
                                                                        className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/20 rounded-sm text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                                                    >
                                                                        Enterprise
                                                                    </button>
                                                                    <button 
                                                                        onClick={async () => {
                                                                            if (confirm(`Are you sure you want to reset ${u.name || u.email}'s pass?`)) {
                                                                                setIsFetchingUsers(true);
                                                                                try {
                                                                                    await setDoc(doc(db, 'users', u.id), {
                                                                                        expiresAt: null,
                                                                                        subscriptionStatus: 'none',
                                                                                        subscription: 'none'
                                                                                    }, { merge: true });
                                                                                    toast.success("Pass reset successfully");
                                                                                    await fetchUsers();
                                                                                } catch (e) {
                                                                                    toast.error("Failed to reset pass");
                                                                                } finally {
                                                                                    setIsFetchingUsers(false);
                                                                                }
                                                                            }
                                                                        }}
                                                                        disabled={isFetchingUsers}
                                                                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 rounded-sm text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                                                    >
                                                                        Reset Pass
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleBanUser(u.id, !!u.isBanned)}
                                                                        disabled={isFetchingUsers}
                                                                        className={`px-3 py-1.5 border rounded-sm text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50 ${
                                                                            u.isBanned 
                                                                                ? 'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border-emerald-500/20' 
                                                                                : 'bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border-red-500/20'
                                                                        }`}
                                                                    >
                                                                        {u.isBanned ? 'Unban User' : 'Ban User'}
                                                                    </button>
                                                                    <button 
                                                                        onClick={async () => {
                                                                            if (!u.id) return toast.error("No user ID found");
                                                                            try {
                                                                                const response = await fetch(`${API_BASE}/api/test-checkout-success`, {
                                                                                    method: 'POST',
                                                                                    headers: { 'Content-Type': 'application/json' },
                                                                                    body: JSON.stringify({ userId: u.id })
                                                                                });
                                                                                const data = await response.json();
                                                                                if (data.success) {
                                                                                    toast.success("Stripe sync successful!");
                                                                                    fetchUsers();
                                                                                } else {
                                                                                    throw new Error(data.error || "Unknown error");
                                                                                }
                                                                            } catch (e: any) {
                                                                                console.error("Stripe sync failed:", e);
                                                                                toast.error(`Stripe sync failed: ${e.message}`);
                                                                            }
                                                                        }}
                                                                        className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/20 rounded-sm text-[9px] font-black uppercase tracking-widest transition-all"
                                                                    >
                                                                        Force Stripe Sync
                                                                    </button>
                                                                </div>

                                                                {isEnterpriseUser && (
                                                                    <div className="mt-4 p-4 bg-indigo-950/40 border border-indigo-500/25 rounded-2xl flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center shrink-0">
                                                                                <Users className="w-4 h-4" />
                                                                            </div>
                                                                            <div>
                                                                                <div className="flex items-center gap-2">
                                                                                    <p className="text-[11px] font-black text-white uppercase tracking-wider">
                                                                                        Enterprise Seat Allocation
                                                                                    </p>
                                                                                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-mono text-[10px] font-black">
                                                                                        {currentSeats} Max Seats
                                                                                    </span>
                                                                                </div>
                                                                                <p className="text-[10px] text-slate-400">
                                                                                    {linkedMembersCount} crew members assigned • {Math.max(0, currentSeats - linkedMembersCount)} seats free in pool
                                                                                </p>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mr-1">1-Click Set:</span>
                                                                            {[10, 15, 20, 25, 50, 100].map((preset) => (
                                                                                <button
                                                                                    key={preset}
                                                                                    onClick={() => handleUpdateSeatLimit(u.id, preset)}
                                                                                    disabled={isUpdatingSeats === u.id || currentSeats === preset}
                                                                                    className={`px-2.5 py-1.5 rounded-md text-[9px] font-black tracking-wider transition-all disabled:opacity-50 ${
                                                                                        currentSeats === preset
                                                                                            ? 'bg-indigo-600 text-white border border-indigo-400 shadow-sm ring-1 ring-indigo-400/50'
                                                                                            : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 hover:text-white'
                                                                                    }`}
                                                                                    title={`Set seat allocation directly to ${preset} seats`}
                                                                                >
                                                                                    {preset} Seats
                                                                                </button>
                                                                            ))}
                                                                            <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block"></div>
                                                                            <button
                                                                                onClick={() => handleUpdateSeatLimit(u.id, currentSeats + 5)}
                                                                                disabled={isUpdatingSeats === u.id}
                                                                                className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/20 rounded-md text-[9px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
                                                                                title="Add 5 seats to this organization"
                                                                            >
                                                                                +5 Seats
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleUpdateSeatLimit(u.id, Math.max(1, currentSeats - 5))}
                                                                                disabled={isUpdatingSeats === u.id || currentSeats <= 1}
                                                                                className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-white border border-amber-500/20 rounded-md text-[9px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
                                                                                title="Reduce 5 seats from this organization"
                                                                            >
                                                                                -5 Seats
                                                                            </button>
                                                                            <button
                                                                                onClick={() => {
                                                                                    const promptVal = window.prompt(`Enter custom seat limit for ${u.name || u.email}:`, currentSeats.toString());
                                                                                    if (promptVal !== null) {
                                                                                        const parsed = parseInt(promptVal.trim(), 10);
                                                                                        if (!isNaN(parsed) && parsed >= 1) {
                                                                                            handleUpdateSeatLimit(u.id, parsed);
                                                                                        } else {
                                                                                            toast.error("Please enter a valid positive seat number.");
                                                                                        }
                                                                                    }
                                                                                }}
                                                                                disabled={isUpdatingSeats === u.id}
                                                                                className="px-2.5 py-1.5 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-md text-[9px] font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-1"
                                                                                title="Set custom seat limit"
                                                                            >
                                                                                {isUpdatingSeats === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                                                                Custom...
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {adminSubTab === 'tickets' && (
                                <div>
                                    <div className="flex justify-between items-center mb-6">
                                        <h4 className="text-sm font-black text-white uppercase tracking-wider">Support Tickets</h4>
                                        <button onClick={fetchContactMessages} className="text-[10px] text-indigo-400 hover:text-indigo-300 uppercase tracking-widest font-bold">Refresh</button>
                                    </div>
                                    {isFetchingMessages ? (
                                        <div className="flex justify-center py-10"><Loader2 className="w-4 h-4 animate-spin text-indigo-500" /></div>
                                    ) : contactMessages.filter(msg => msg.status !== 'resolved').length === 0 ? (
                                        <p className="text-slate-500 text-sm">No support tickets found.</p>
                                    ) : (
                                        <div className="space-y-4">
                                            {contactMessages.filter(msg => msg.status !== 'resolved').map(msg => (
                                                <div key={msg.id} className={`p-4 bg-slate-950 border rounded-3xl ${msg.status === 'resolved' ? 'border-emerald-500/20 opacity-75' : 'border-white/10'}`}>
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div>
                                                            <h5 className="text-white font-bold">{msg.subject}</h5>
                                                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">From: {msg.userEmail || msg.userId} • {msg.createdAt?.toDate?.().toLocaleString()}</p>
                                                        </div>
                                                        <div className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${msg.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                            {msg.status || 'open'}
                                                        </div>
                                                    </div>
                                                    <div className="bg-white/5 p-2 rounded-md text-sm text-slate-300 whitespace-pre-wrap mb-4">
                                                        {msg.message}
                                                    </div>
                                                    {msg.status !== 'resolved' && (
                                                        <button 
                                                            onClick={() => handleResolveTicket(msg.id)}
                                                            className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-md text-xs font-bold transition-all"
                                                        >
                                                            Mark as Resolved
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                             {adminSubTab === 'broadcasts' && (
                                <div>
                                    <h4 className="text-sm font-black text-white uppercase tracking-wider mb-6">
                                        {isMasterAdmin ? 'Send Global Announcement' : 'Send Organization Announcement'}
                                    </h4>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-6 bg-white/5 p-2 rounded-md italic">
                                        {isMasterAdmin 
                                            ? "Master Admin Note: This announcement will be visible to EVERY user on the platform." 
                                            : "Enterprise Admin Note: This announcement will only be visible to members of your organization."}
                                    </p>
                                    <div className="space-y-4 max-w-2xl">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Announcement Title</label>
                                            <input 
                                                type="text" 
                                                value={broadcastTitle}
                                                onChange={(e) => setBroadcastTitle(e.target.value)}
                                                placeholder="e.g. Scheduled Maintenance"
                                                className="w-full bg-slate-950 border border-white/10 rounded-md py-3 px-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Message</label>
                                            <textarea 
                                                value={broadcastMessage}
                                                onChange={(e) => setBroadcastMessage(e.target.value)}
                                                placeholder="Type your message here..."
                                                rows={4}
                                                className="w-full bg-slate-950 border border-white/10 rounded-md py-3 px-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all resize-none"
                                            />
                                        </div>
                                        <button 
                                            onClick={handleSendBroadcast}
                                            disabled={isSendingBroadcast}
                                            className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {isSendingBroadcast ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Broadcast'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {adminSubTab === 'system' && (
                                <div>
                                    <div className="flex justify-between items-center mb-6">
                                        <h4 className="text-sm font-black text-white uppercase tracking-wider">System Metrics & Cleanup</h4>
                                        <button onClick={fetchMetrics} className="text-[10px] text-indigo-400 hover:text-indigo-300 uppercase tracking-widest font-bold">Refresh</button>
                                    </div>
                                    
                                    {isFetchingMetrics ? (
                                        <div className="flex justify-center py-10"><Loader2 className="w-4 h-4 animate-spin text-indigo-500" /></div>
                                    ) : (
                                        <div className="space-y-8">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                                <div className="p-4 bg-slate-950 border border-white/5 rounded-3xl">
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Users</p>
                                                    <p className="text-3xl font-black text-white">{allUsers.length}</p>
                                                </div>
                                                <div className="p-4 bg-slate-950 border border-white/5 rounded-3xl">
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Active Pro Members</p>
                                                    <p className="text-3xl font-black text-indigo-400">{allUsers.filter(u => isPro(u)).length}</p>
                                                </div>
                                                <div className="p-4 bg-slate-950 border border-white/5 rounded-3xl">
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Projects</p>
                                                    <p className="text-3xl font-black text-emerald-400">{totalProjectsCount !== null ? totalProjectsCount : '---'}</p>
                                                </div>
                                                <div className="p-4 bg-slate-950 border border-white/5 rounded-3xl">
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">New This Week</p>
                                                    <p className="text-3xl font-black text-amber-400">
                                                        {/* Simple approximation if we don't have createdAt on user */}
                                                        {allUsers.filter(u => {
                                                            if (!u.createdAt) return false;
                                                            const created = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt);
                                                            const oneWeekAgo = new Date();
                                                            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                                                            return created > oneWeekAgo;
                                                        }).length}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-3xl">
                                                <h5 className="text-sm font-black text-rose-400 uppercase tracking-wider mb-2">Storage Cleanup</h5>
                                                <p className="text-xs text-slate-400 mb-6">Delete abandoned projects that haven't been modified in over a year. This action cannot be undone.</p>
                                                <button 
                                                    onClick={handleCleanupProjects}
                                                    className="px-4 py-3 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 rounded-md text-xs font-bold transition-all flex items-center gap-2"
                                                >
                                                    <ShieldAlert className="w-4 h-4" />
                                                    Bulk Delete Old Projects
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'team' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-8">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-xl font-semibold font-black text-white uppercase tracking-tight mb-1 flex items-center gap-2">
                                        <Users className="w-5 h-5 text-indigo-400" />
                                        Enterprise Team & Seat Management
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        Manage crew members, provision inherited Pro seats, and oversee organizational linking.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                        Enterprise Active
                                    </div>
                                    <button
                                        onClick={fetchTeamMembers}
                                        disabled={isFetchingTeam}
                                        className="p-2 rounded-md bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                                        title="Refresh Team Roster"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${isFetchingTeam ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>
                            </div>

                            {/* Seat Pool Allocation Card */}
                            <div className="p-6 bg-slate-950 border border-white/10 rounded-3xl space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Organization</p>
                                        <h4 className="text-base font-black text-white tracking-wide">
                                            {companyName || currentUser?.branding?.companyName || currentUser?.name || 'Enterprise Organization'}
                                        </h4>
                                        <p className="text-[10px] text-indigo-400 font-mono mt-0.5">Admin: {currentUser?.email}</p>
                                    </div>
                                    <div className="text-left sm:text-right">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Seat Pool Allocation</p>
                                        <div className="flex items-center sm:justify-end gap-2">
                                            <span className="text-2xl font-black text-white">{teamMembers.length}</span>
                                            <span className="text-sm font-bold text-slate-500">/ {maxSeats} Seats Used</span>
                                            <span className={`ml-2 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                teamMembers.length >= maxSeats 
                                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                                                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                            }`}>
                                                {Math.max(0, maxSeats - teamMembers.length)} Available
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div>
                                    <div className="w-full h-2.5 bg-slate-900 border border-white/5 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-500 ${
                                                teamMembers.length >= maxSeats
                                                    ? 'bg-rose-500'
                                                    : teamMembers.length >= maxSeats * 0.8
                                                    ? 'bg-amber-500'
                                                    : 'bg-indigo-500'
                                            }`}
                                            style={{ width: `${Math.min(100, Math.round((teamMembers.length / maxSeats) * 100))}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Architecture Principles Callout */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                                    <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                                        <div className="flex items-center gap-2 mb-1 text-indigo-400 text-xs font-bold">
                                            <Shield className="w-3.5 h-3.5" />
                                            Inherited Pro Access
                                        </div>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            Crew members inherit full Pro capabilities (unlimited frequencies, custom bands) tied to your subscription without needing separate licenses.
                                        </p>
                                    </div>
                                    <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                                        <div className="flex items-center gap-2 mb-1 text-indigo-400 text-xs font-bold">
                                            <Zap className="w-3.5 h-3.5" />
                                            Organization Linking
                                        </div>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            All assigned team members are cryptographically bound to your Organization ID ({currentUser?.id ? currentUser.id.slice(0, 10) + '...' : 'Active Org'}).
                                        </p>
                                    </div>
                                    <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                                        <div className="flex items-center gap-2 mb-1 text-indigo-400 text-xs font-bold">
                                            <Clock className="w-3.5 h-3.5" />
                                            Lifecycle Sync
                                        </div>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            When a member is unlinked or your enterprise term concludes, seats are immediately released and member accounts revert to Free.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Add Team Member Section */}
                            <div className="p-6 bg-slate-950 border border-white/10 rounded-3xl space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-black text-white uppercase tracking-wider">Assign Team Seat</h4>
                                        <p className="text-[11px] text-slate-400">Invite crew and field technicians to join your organization seat pool.</p>
                                    </div>
                                    {teamMembers.length >= maxSeats && (
                                        <div className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full text-[10px] font-bold text-rose-400 flex items-center gap-1.5">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            Pool Capacity Reached
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Full Name</label>
                                        <input
                                            type="text"
                                            value={newUserName}
                                            onChange={(e) => setNewUserName(e.target.value)}
                                            placeholder="e.g. Alex Morgan"
                                            disabled={isCreatingUser || teamMembers.length >= maxSeats}
                                            className="w-full bg-slate-900 border border-white/10 rounded-md py-2 px-3 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all font-medium disabled:opacity-50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Email Address</label>
                                        <input
                                            type="email"
                                            value={newUserEmail}
                                            onChange={(e) => setNewUserEmail(e.target.value)}
                                            placeholder="crew@production.com"
                                            disabled={isCreatingUser || teamMembers.length >= maxSeats}
                                            className="w-full bg-slate-900 border border-white/10 rounded-md py-2 px-3 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all font-medium disabled:opacity-50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Team Role</label>
                                        <select
                                            value={newTeamRole}
                                            onChange={(e) => setNewTeamRole(e.target.value as any)}
                                            disabled={isCreatingUser || teamMembers.length >= maxSeats}
                                            className="w-full bg-slate-900 border border-white/10 rounded-md py-2 px-3 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all font-medium disabled:opacity-50"
                                        >
                                            <option value="crew">Stage Crew / Field Tech</option>
                                            <option value="coordinator">RF Co-Coordinator (Full Planning)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                            Password <span className="text-slate-600 font-normal lowercase">(optional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newTeamPassword}
                                            onChange={(e) => setNewTeamPassword(e.target.value)}
                                            placeholder="Auto-generated if blank"
                                            disabled={isCreatingUser || teamMembers.length >= maxSeats}
                                            className="w-full bg-slate-900 border border-white/10 rounded-md py-2 px-3 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all font-mono font-medium disabled:opacity-50"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                                    <p className="text-[10px] text-slate-500 italic">
                                        * Note: The member will receive an Enterprise seat with inherited Pro access. A sign-in credential package and invite link will be generated for them.
                                    </p>
                                    <button
                                        onClick={handleAddTeamMember}
                                        disabled={isCreatingUser || !newUserEmail.trim() || teamMembers.length >= maxSeats}
                                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
                                    >
                                        {isCreatingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                        Assign Enterprise Seat
                                    </button>
                                </div>

                                {createdCredentialsModal && (
                                    <div className="p-5 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl space-y-4 animate-in fade-in">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="w-4 h-4 text-indigo-400" />
                                                <span className="text-xs font-black text-white uppercase tracking-wider">
                                                    Seat Allocated & Credentials Ready for {createdCredentialsModal.name}
                                                </span>
                                            </div>
                                            <button 
                                                onClick={() => setCreatedCredentialsModal(null)}
                                                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition-all"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-300">
                                            Send these login credentials directly to <strong className="text-white">{createdCredentialsModal.name}</strong> ({createdCredentialsModal.email}) so they can sign in independently right away:
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-950/80 p-3.5 rounded-xl border border-white/10 font-mono">
                                            <div>
                                                <span className="text-slate-500 text-[10px] uppercase font-sans font-bold block mb-0.5">Sign-in Email</span>
                                                <span className="text-white font-bold select-all">{createdCredentialsModal.email}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 text-[10px] uppercase font-sans font-bold block mb-0.5">Sign-in Password</span>
                                                <span className="text-emerald-400 font-bold select-all">{createdCredentialsModal.temporaryPassword || 'Set via link below'}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 pt-1">
                                            <button
                                                onClick={() => {
                                                    const text = `RF Suite Sign-In Credentials:\nURL: ${window.location.origin}\nEmail: ${createdCredentialsModal.email}\nPassword: ${createdCredentialsModal.temporaryPassword || '(Use activation link)'}\nRole: ${createdCredentialsModal.role}`;
                                                    navigator.clipboard?.writeText(text);
                                                    toast.success("Credentials copied to clipboard! Paste and send to team member.");
                                                }}
                                                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-bold transition-all flex items-center gap-1.5"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                                Copy Sign-In Details
                                            </button>
                                            {createdCredentialsModal.resetLink && (
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard?.writeText(createdCredentialsModal.resetLink!);
                                                        toast.success("Activation / password setup link copied to clipboard!");
                                                    }}
                                                    className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-md text-xs font-bold transition-all flex items-center gap-1.5"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                                                    Copy Activation Link
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setCreatedCredentialsModal(null)}
                                                className="px-3.5 py-2 bg-transparent hover:bg-white/5 text-slate-400 hover:text-white rounded-md text-xs font-bold transition-all ml-auto"
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Team Members Roster */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                                        <span>Allocated Team Roster</span>
                                        <span className="px-2 py-0.5 bg-white/5 rounded-full text-[10px] text-slate-400 font-bold">
                                            {teamMembers.length}
                                        </span>
                                    </h4>
                                </div>

                                {isFetchingTeam ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                                    </div>
                                ) : teamMembers.length === 0 ? (
                                    <div className="p-12 text-center bg-slate-950 border border-white/5 rounded-3xl space-y-3">
                                        <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                                            <Users className="w-6 h-6" />
                                        </div>
                                        <h5 className="text-sm font-bold text-white">No Team Members Assigned</h5>
                                        <p className="text-xs text-slate-400 max-w-md mx-auto">
                                            Your Enterprise plan includes {maxSeats} seats. Enter a crew member's name and email above to allocate a seat from your pool.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3">
                                        {teamMembers.map((member) => (
                                            <div
                                                key={member.id}
                                                className="p-4 bg-slate-950 border border-white/5 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-white/10 transition-all"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center text-sm font-black uppercase shrink-0">
                                                        {member.name ? member.name.charAt(0) : member.email?.charAt(0) || 'U'}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h5 className="text-sm font-bold text-white">{member.name || 'Crew Member'}</h5>
                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                                member.organizationRole === 'coordinator'
                                                                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                                                    : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                                            }`}>
                                                                {member.organizationRole === 'coordinator' ? 'RF Coordinator' : 'Stage Crew'}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-400 font-mono">{member.email}</p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/5">
                                                    <div className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                                                        <Check className="w-3 h-3" />
                                                        Inherited Seat Active
                                                    </div>

                                                    <button
                                                        onClick={() => handleSetMemberPassword(member.id, member.email, member.name)}
                                                        disabled={isSettingPassword === member.id}
                                                        className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-indigo-300 hover:text-white border border-white/10 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5"
                                                        title="Set or reset sign-in password for this team member"
                                                    >
                                                        {isSettingPassword === member.id ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <Key className="w-3 h-3 text-indigo-400" />
                                                        )}
                                                        Set Password
                                                    </button>

                                                    <button
                                                        onClick={() => handleCopyMemberResetLink(member.email)}
                                                        disabled={isGeneratingLink === member.email}
                                                        className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5"
                                                        title="Generate and copy direct password setup link for this member"
                                                    >
                                                        {isGeneratingLink === member.email ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <Copy className="w-3 h-3 text-slate-400" />
                                                        )}
                                                        Copy Invite Link
                                                    </button>

                                                    <button
                                                        onClick={() => handleRemoveTeamMember(member.id, member.email, member.name)}
                                                        disabled={isRemovingMember === member.id}
                                                        className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 rounded-md text-[10px] font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                                                        title="Remove team member and release seat"
                                                    >
                                                        {isRemovingMember === member.id ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <UserMinus className="w-3 h-3" />
                                                        )}
                                                        Remove Seat
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="text-xl font-semibold font-black text-white uppercase tracking-tight mb-8">Security Settings</h3>
                            <div className="space-y-4">
                                <button 
                                    onClick={handlePasswordReset}
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-between p-4 bg-slate-950 border border-white/5 rounded-3xl hover:bg-white/5 transition-all group text-left disabled:opacity-50"
                                >
                                    <div>
                                        <h4 className="text-sm font-black text-white uppercase tracking-wider mb-1">Change Password</h4>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Send a password reset email to your inbox</p>
                                    </div>
                                    <div className="w-10 h-10 bg-white/5 rounded-md flex items-center justify-center text-slate-400 group-hover:text-white transition-all">→</div>
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'contact' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="text-xl font-semibold font-black text-white uppercase tracking-tight mb-2">Contact Support</h3>
                            <p className="text-sm text-slate-400 mb-8">Have a question or need help? Send us a message or email us directly at <a href="mailto:info@rfsuite.net" className="text-indigo-400 hover:text-indigo-300 transition-colors">info@rfsuite.net</a>.</p>
                            <ContactForm />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AccountDashboard;
