import { User } from '../../types';

export const isPro = (user: User | null | undefined): boolean => {
    if (!user) {
        console.log("isPro: No user object provided");
        return false;
    }
    
    const userEmail = user.email?.toLowerCase().trim();
    const isAdminEmail = 
        userEmail === 'dvitalis1969@gmail.com' || 
        userEmail === 'dnomsed@live.co.uk' || 
        userEmail === 'aniakwlk@yahoo.co.uk';
    
    // Admin override
    if (isAdminEmail) {
        console.log(`isPro: Admin override for ${userEmail}`);
        return true;
    }
    
    if (user.role === 'admin') {
        console.log(`isPro: Role override for ${userEmail}`);
        return true;
    }

    // Lifetime / Custom Tiers override
    if (['Lifetime Pro', 'Beta Tester', 'Enterprise'].includes(user.subscription || '')) {
        console.log(`isPro: Lifetime/Custom Tier override for ${userEmail}`);
        return true;
    }

    // Team Member / Enterprise Seat inherited access:
    // Access is inherited dynamically while linked to an active organization
    if (user.subscription === 'Team Member' || user.subscription === 'Enterprise Seat') {
        const isTeamActive = user.subscriptionStatus === 'active' && !!user.organizationId;
        if (isTeamActive && user.expiresAt) {
            const expirationDate = new Date(user.expiresAt).getTime();
            if (Date.now() > expirationDate) {
                console.log(`isPro: Team member ${userEmail} pass/subscription has expired`);
                return false;
            }
        }
        console.log(`isPro: Team member ${userEmail} inherited access: ${isTeamActive ? 'ACTIVE' : 'INACTIVE'}`);
        return isTeamActive;
    }
    
    let isProUser = user.subscriptionStatus === 'active';
    
    // Check expiration if it exists
    if (isProUser && user.expiresAt) {
        const expirationDate = new Date(user.expiresAt).getTime();
        const now = Date.now();
        if (now > expirationDate) {
            isProUser = false;
        }
    }

    if (!isProUser) {
        console.log(`isPro: User ${userEmail} is not Pro. Status: ${user.subscriptionStatus}, Expires: ${user.expiresAt}`);
    } else {
        console.log(`isPro: User ${userEmail} is Pro. Status: ${user.subscriptionStatus}, Expires: ${user.expiresAt}`);
    }
    return isProUser;
};
