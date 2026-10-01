import express from "express";
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import archiver from "archiver";
import Stripe from "stripe";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getLinkPreview } from "link-preview-js";
import { UK_TV_CHANNELS, US_TV_CHANNELS } from "./constants.js";
import nodemailer from 'nodemailer';
import { GoogleGenAI, Type } from "@google/genai";

const calculateReceivedPowerDbm = (erpKw: number, distanceKm: number, frequencyMhz: number): number => {
  if (distanceKm <= 0.001) return 10 * Math.log10(erpKw * 1000);
  const txPowerDbm = 10 * Math.log10(erpKw * 1000);
  const pathLossDb = 20 * Math.log10(distanceKm) + 20 * Math.log10(frequencyMhz) + 32.44;
  return txPowerDbm - pathLossDb;
};

// Lazy initialization for Stripe and Firebase Admin
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    let key = process.env.STRIPE_SECRET_KEY;
    
    if (key) {
      console.log("✅ Stripe initialized from environment variable (starts with: " + key.substring(0, 7) + "...)");
    } else {
      // Try to load from local stripe-config.json if it exists
      const stripePath = path.join(process.cwd(), 'stripe-config.json');
      if (fs.existsSync(stripePath)) {
        try {
          const stripeConfig = JSON.parse(fs.readFileSync(stripePath, 'utf8'));
          key = stripeConfig.stripeSecret;
          console.log("✅ Stripe initialized from local stripe-config.json");
        } catch (e) {
          console.error("Error loading local stripe-config.json:", e);
        }
      }
    }

    if (!key) throw new Error('STRIPE_SECRET_KEY environment variable is required');
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

let firebaseAdminInitialized = false;
let lastFirebaseError: string | null = null;

function initFirebaseAdmin() {
  if (!firebaseAdminInitialized) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (privateKey) {
      // Remove quotes if present
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.substring(1, privateKey.length - 1);
      }
      // Handle escaped newlines
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    if (!projectId || !clientEmail || !privateKey) {
      // Try to load from local service-account.json if it exists
      const saPath = path.join(process.cwd(), 'service-account.json');
      if (fs.existsSync(saPath)) {
        try {
          const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
          initializeApp({
            credential: cert(sa),
          });
          firebaseAdminInitialized = true;
          console.log("✅ Firebase Admin successfully initialized from local service-account.json");
          return;
        } catch (e: any) {
          lastFirebaseError = `Local SA Error: ${e.message}`;
          console.error("Error loading local service-account.json:", e);
        }
      }

      const missing = [];
      if (!projectId) missing.push("PROJECT_ID");
      if (!clientEmail) missing.push("CLIENT_EMAIL");
      if (!privateKey) missing.push("PRIVATE_KEY");
      
      lastFirebaseError = `Missing credentials: ${missing.join(", ")}`;
      console.warn("Firebase Admin credentials missing from environment and local file:", lastFirebaseError);
      return;
    }

    try {
      console.log("Initializing Firebase Admin with Project ID:", projectId);
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      firebaseAdminInitialized = true;
      lastFirebaseError = null;
      console.log("✅ Firebase Admin successfully initialized from environment");
    } catch (err: any) {
      lastFirebaseError = err.message;
      console.error("❌ Firebase Admin initialization error:", err);
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Global middleware
  app.use((req, res, next) => {
    res.setHeader('X-App-Version', 'v2.5.1-STABLE-MARCH-17-13:12');
    res.setHeader('Permissions-Policy', 'serial=*');
    if (req.url.includes('/api/health')) {
      console.log(`[Health Check] Request for ${req.url} from ${req.ip}`);
    }
    next();
  });

  // Health check at the VERY top
  app.get(["/api/health", "/api/healt", "/health"], (req, res) => {
    // Attempt initialization so we can verify it works
    initFirebaseAdmin();
    
    res.json({ 
      status: "ok",
      version: "v2.5.1-STABLE-MARCH-17-13:12",
      firebaseAdminInitialized,
      lastFirebaseError,
      env: {
        hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
        hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
        nodeEnv: process.env.NODE_ENV
      },
      config: {
        stripeSecret: !!(process.env.STRIPE_SECRET_KEY || fs.existsSync(path.join(process.cwd(), 'stripe-config.json'))),
        stripePublishable: !!(process.env.VITE_STRIPE_PUBLISHABLE_KEY || fs.existsSync(path.join(process.cwd(), 'stripe-config.json'))),
        stripeWebhook: !!(process.env.STRIPE_WEBHOOK_SECRET || fs.existsSync(path.join(process.cwd(), 'stripe-config.json'))),
        firebaseAdmin: !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) || fs.existsSync(path.join(process.cwd(), 'service-account.json'))
      }
    });
  });

  app.get("/api/stripe-status", (req, res) => {
    const key = process.env.STRIPE_SECRET_KEY || '';
    res.json({
      configured: !!key,
      mode: key.startsWith('sk_test_') ? 'test' : 'live',
      prefix: key.substring(0, 7) + '...'
    });
  });

  // Enable CORS for all routes
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Stripe webhook needs raw body
  // Stripe webhook handler
  const stripeWebhookHandler = async (req: any, res: any) => {
    initFirebaseAdmin();
    const stripe = getStripe();
    const sig = req.headers['stripe-signature'];
    
    // EXTREME DEBUGGING
    console.log("--------------------------------------------------");
    console.log("[DEBUG] Stripe Webhook Received");
    console.log("[DEBUG] Signature Header:", sig);
    console.log("[DEBUG] Body Type:", typeof req.body);
    console.log("[DEBUG] Body is Buffer:", Buffer.isBuffer(req.body));
    console.log("[DEBUG] Body Length:", req.body ? req.body.length : 0);
    console.log("[DEBUG] Body (first 100 chars):", req.body ? req.body.toString().substring(0, 100) : 'none');
    console.log("--------------------------------------------------");

    let endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    // Log the first few chars of the secret for debugging (safely)
    if (endpointSecret) {
      console.log(`[DEBUG] Webhook Secret found in env (starts with: ${endpointSecret.substring(0, 5)}...)`);
    } else {
      console.log("[DEBUG] Webhook Secret NOT found in env, checking local file...");
      const stripePath = path.join(process.cwd(), 'stripe-config.json');
      if (fs.existsSync(stripePath)) {
        try {
          const stripeConfig = JSON.parse(fs.readFileSync(stripePath, 'utf8'));
          endpointSecret = stripeConfig.stripeWebhook;
          if (endpointSecret) {
            console.log(`[DEBUG] Webhook Secret found in local file (starts with: ${endpointSecret.substring(0, 5)}...)`);
          }
        } catch (e) {
          console.error("[DEBUG] Error parsing local stripe-config.json:", e);
        }
      }
    }

    if (!sig || !endpointSecret) {
      console.error("[DEBUG] Missing signature or secret. sig:", !!sig, "secret:", !!endpointSecret);
      return res.status(400).send(`Missing Stripe signature or webhook secret. sig: ${!!sig}, secret: ${!!endpointSecret}`);
    }

    let event: Stripe.Event;
    try {
      // Stripe expects the raw body as a Buffer for signature verification
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
      console.log(`[DEBUG] Constructing event with body length: ${rawBody.length}`);
      event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
      console.log(`[DEBUG] ✅ Event constructed successfully: ${event.type}`);
    } catch (err: any) {
      console.error(`[DEBUG] ❌ Webhook Signature Verification Failed: ${err.message}`);
      console.error(`[DEBUG] Signature used: ${sig ? sig.substring(0, 20) + '...' : 'NONE'}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (!firebaseAdminInitialized) throw new Error("Firebase Admin not initialized");
      const db = getFirestore(undefined, process.env.VITE_FIREBASE_DATABASE_ID || '(default)');

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        if (userId) {
          const updateData: any = { 
            subscriptionStatus: 'active',
            lastUpdated: new Date().toISOString()
          };
          
          try {
            const expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
              expand: ['line_items.data.price.product'],
            });
            const lineItem = expandedSession.line_items?.data[0];
            if (lineItem?.price?.product) {
              const product = lineItem.price.product as Stripe.Product;
              updateData.subscription = product.name;
            }
          } catch (e) {
            console.error("Error fetching product name in webhook:", e);
          }

          if (session.customer) updateData.stripeCustomerId = session.customer;
          if (session.subscription) updateData.stripeSubscriptionId = session.subscription;
          
          const planName = (session.metadata?.tierName || updateData.subscription || '').toLowerCase();
          console.log(`[Webhook] 🔍 Plan Name detected: "${planName}"`);
          
          if (planName) {
            if (planName.includes('48 hour')) {
              updateData.expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
            } else if (planName.includes('7 day')) {
              updateData.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            } else if (planName.includes('1 month')) {
              updateData.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            } else if (planName.includes('enterprise')) {
              updateData.subscription = 'Enterprise';
              // Enterprise usually has no hardcoded expiration here if it's a subscription, 
              // but we can set it to a year or just null to rely on subscription status
              updateData.expiresAt = null;
            } else if (planName.includes('pass')) {
              // Fallback for any other "pass" - default to 48 hours
              updateData.expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
              console.log(`[Webhook] ⚠️ Unknown pass type "${planName}", defaulting to 48h expiration`);
            }
          }

          console.log(`[Webhook] Final updateData for user ${userId}:`, JSON.stringify(updateData, null, 2));
          await db.collection('users').doc(userId).set(updateData, { merge: true });
          console.log(`[Webhook] ✅ Firestore update successful for user ${userId}`);
        }
      } else if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as Stripe.Subscription;
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('stripeSubscriptionId', '==', subscription.id).get();
        if (!snapshot.empty) {
          for (const doc of snapshot.docs) {
            await doc.ref.update({ subscriptionStatus: 'canceled' });
            console.log(`[Webhook] Subscription canceled for user ${doc.id}`);

            // Lifecycle Synchronization: Synchronize cancellation to all team members in this organization
            const teamSnapshot = await usersRef.where('organizationId', '==', doc.id).get();
            if (!teamSnapshot.empty) {
              const batch = db.batch();
              teamSnapshot.docs.forEach((memberDoc) => {
                if (memberDoc.id !== doc.id) {
                  batch.update(memberDoc.ref, {
                    subscriptionStatus: 'canceled',
                    lastUpdated: new Date().toISOString()
                  });
                }
              });
              await batch.commit();
              console.log(`[Webhook] Synchronized cancellation to ${teamSnapshot.size - 1} team members for org ${doc.id}`);
            }
          }
        }
      } else if (event.type === 'customer.subscription.updated') {
        const subscription = event.data.object as Stripe.Subscription;
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('stripeSubscriptionId', '==', subscription.id).get();
        if (!snapshot.empty) {
          const newStatus = subscription.status === 'active' ? 'active' : (subscription.status === 'trialing' ? 'active' : 'canceled');
          for (const doc of snapshot.docs) {
            await doc.ref.update({ subscriptionStatus: newStatus });
            // Lifecycle Synchronization: Sync status to linked team members
            const teamSnapshot = await usersRef.where('organizationId', '==', doc.id).get();
            if (!teamSnapshot.empty) {
              const batch = db.batch();
              teamSnapshot.docs.forEach((memberDoc) => {
                if (memberDoc.id !== doc.id) {
                  batch.update(memberDoc.ref, {
                    subscriptionStatus: newStatus,
                    lastUpdated: new Date().toISOString()
                  });
                }
              });
              await batch.commit();
              console.log(`[Webhook] Synchronized status (${newStatus}) to ${teamSnapshot.size - 1} team members for org ${doc.id}`);
            }
          }
        }
      }
      res.json({ received: true });
    } catch (err: any) {
      console.error(`[Webhook] ❌ Error processing webhook event:`, err);
      res.status(500).json({ error: err.message });
    }
  };

  app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);
  app.post('/api/stripe-webhook/', express.raw({ type: 'application/json' }), stripeWebhookHandler);



  app.get("/api/config", (req, res) => {
    let stripePublishable = process.env.VITE_STRIPE_PUBLISHABLE_KEY;
    
    if (!stripePublishable) {
      const stripePath = path.join(process.cwd(), 'stripe-config.json');
      if (fs.existsSync(stripePath)) {
        try {
          const stripeConfig = JSON.parse(fs.readFileSync(stripePath, 'utf8'));
          stripePublishable = stripeConfig.stripePublishable;
        } catch (e) {}
      }
    }

    res.json({
      stripePublishable: stripePublishable || null,
      firebase: {
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        apiKey: process.env.VITE_FIREBASE_API_KEY,
        authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
        storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.VITE_FIREBASE_APP_ID,
        databaseId: process.env.VITE_FIREBASE_DATABASE_ID
      }
    });
  });

  // Regular JSON parsing for other routes
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.post("/api/admin/create-user", async (req, res) => {
    try {
      initFirebaseAdmin();
      if (!firebaseAdminInitialized) throw new Error("Firebase Admin not initialized");
      const { email, name, tier, role, expiresAt, adminEmail, password } = req.body;

      const masterAdmins = [
        'pete@rfsuite.net',
        'info@rfsuite.net',
        'office@pro-rf.com',
        'peter@pro-rf.com',
        'support@rfsuite.net',
        'admin@rfsuite.net',
        'rfsuitetest@gmail.com',
        'rfsuitetest2@gmail.com',
        'dvitalis1969@gmail.com',
        'dnomsed@live.co.uk',
        'aniakwlk@yahoo.co.uk'
      ];

      const auth = (await import("firebase-admin/auth")).getAuth();
      const firestore = getFirestore(undefined, process.env.VITE_FIREBASE_DATABASE_ID || '(default)');

      // Determine authorization and scope
      let isMasterAdmin = adminEmail && masterAdmins.includes(adminEmail.toLowerCase().trim());
      let isEnterpriseAdmin = false;
      let organizationId: string | null = null;
      let adminData: any = null;

      if (!isMasterAdmin && adminEmail) {
        const adminSnapshot = await firestore.collection('users').where('email', '==', adminEmail.toLowerCase().trim()).get();
        if (!adminSnapshot.empty) {
          adminData = adminSnapshot.docs[0].data();
          if (adminData.subscription?.toLowerCase() === 'enterprise') {
            isEnterpriseAdmin = true;
            // The organization ID is the enterprise admin's own document ID (their UID)
            organizationId = adminSnapshot.docs[0].id;
            
            // Ensure the admin has their own organizationId set for record keeping
            if (!adminData.organizationId) {
              await adminSnapshot.docs[0].ref.update({ organizationId });
            }
          }
        }
      }

      if (!isMasterAdmin && !isEnterpriseAdmin) {
        return res.status(403).json({ error: "Unauthorized. Admin or Enterprise privileges required." });
      }

      if (!email) return res.status(400).json({ error: "Email is required" });

      // Enterprise Admin Seat Pool Validation
      if (isEnterpriseAdmin && !isMasterAdmin && organizationId) {
        const teamSnapshot = await firestore.collection('users')
          .where('organizationId', '==', organizationId)
          .get();
        
        const existingMembers = teamSnapshot.docs.filter(d => d.id !== organizationId);
        const maxSeats = adminData?.maxSeats || 10;
        
        const isAlreadyMember = existingMembers.some(d => d.data().email?.toLowerCase() === email.toLowerCase().trim());
        if (!isAlreadyMember && existingMembers.length >= maxSeats) {
          return res.status(400).json({
            error: `Seat allocation limit reached (${maxSeats} seats). Please remove an existing team member to allocate a new seat.`
          });
        }
      }

      // 1. Create or update the Auth account with credentials
      let userRecord;
      let isNewAccount = false;
      const initialPassword = password?.trim() || `RF2026-${Math.random().toString(36).slice(-4)}!`;

      try {
        userRecord = await auth.createUser({
          email: email.toLowerCase().trim(),
          displayName: name || email.split('@')[0],
          password: initialPassword, 
        });
        isNewAccount = true;
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-exists') {
          userRecord = await auth.getUserByEmail(email.toLowerCase().trim());
          if (password?.trim()) {
            await auth.updateUser(userRecord.uid, { password: password.trim() });
          }
        } else {
          throw authErr;
        }
      }

      // Generate a password reset / account activation link
      let resetLink: string | null = null;
      try {
        resetLink = await auth.generatePasswordResetLink(email.toLowerCase().trim());
      } catch (linkErr) {
        console.warn("Could not generate reset link:", linkErr);
      }

      // 2. Create/Update Firestore document
      const userData: any = {
        email: email.toLowerCase().trim(),
        name: name || userRecord.displayName || email.split('@')[0],
        lastUpdated: new Date().toISOString(),
        role: 'user'
      };

      if (isEnterpriseAdmin && !isMasterAdmin) {
        // STRICT ENTERPRISE TEAM PROVISIONING MODEL:
        // Standalone or lifetime tiers CANNOT be granted by enterprise admins.
        // The user receives inherited access tied to the enterprise organization.
        userData.subscription = 'Team Member';
        userData.subscriptionStatus = adminData?.subscriptionStatus === 'active' ? 'active' : 'inactive';
        userData.organizationId = organizationId;
        userData.organizationName = adminData?.branding?.companyName || adminData?.name || 'Enterprise Team';
        userData.organizationAdminEmail = adminEmail.toLowerCase().trim();
        userData.organizationRole = role || 'crew';
        userData.inheritedFrom = organizationId;
        userData.expiresAt = adminData?.expiresAt || null;
      } else {
        // Master Platform Admin manual tier grant
        userData.subscription = tier || 'none';
        userData.subscriptionStatus = tier !== 'none' ? 'active' : 'none';
        if (expiresAt) {
          userData.expiresAt = expiresAt;
        } else if (tier === '48 Hour Pass') {
          userData.expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
        }
      }

      await firestore.collection('users').doc(userRecord.uid).set(userData, { merge: true });

      res.json({ 
        success: true, 
        uid: userRecord.uid, 
        organizationId: userData.organizationId || null,
        temporaryPassword: (isNewAccount || password?.trim()) ? initialPassword : null,
        resetLink,
        message: isEnterpriseAdmin && !isMasterAdmin
          ? `Team member ${email} successfully assigned an Enterprise seat.`
          : `User ${email} created/updated with ${tier} membership.`
      });
    } catch (err: any) {
      console.error("[Admin Create User] ❌ Failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/remove-team-member", async (req, res) => {
    try {
      initFirebaseAdmin();
      if (!firebaseAdminInitialized) throw new Error("Firebase Admin not initialized");
      const { memberId, adminEmail } = req.body;
      if (!memberId || !adminEmail) {
        return res.status(400).json({ error: "memberId and adminEmail are required" });
      }

      const firestore = getFirestore(undefined, process.env.VITE_FIREBASE_DATABASE_ID || '(default)');
      const masterAdmins = [
        'pete@rfsuite.net',
        'info@rfsuite.net',
        'office@pro-rf.com',
        'peter@pro-rf.com',
        'support@rfsuite.net',
        'admin@rfsuite.net',
        'rfsuitetest@gmail.com',
        'rfsuitetest2@gmail.com',
        'dvitalis1969@gmail.com',
        'dnomsed@live.co.uk',
        'aniakwlk@yahoo.co.uk'
      ];

      let isMasterAdmin = masterAdmins.includes(adminEmail.toLowerCase().trim());
      let enterpriseAdminId: string | null = null;

      if (!isMasterAdmin) {
        const adminSnapshot = await firestore.collection('users').where('email', '==', adminEmail.toLowerCase().trim()).get();
        if (!adminSnapshot.empty) {
          const adminData = adminSnapshot.docs[0].data();
          if (adminData.subscription?.toLowerCase() === 'enterprise') {
            enterpriseAdminId = adminSnapshot.docs[0].id;
          }
        }
      }

      if (!isMasterAdmin && !enterpriseAdminId) {
        return res.status(403).json({ error: "Unauthorized. Enterprise privileges required." });
      }

      const memberDoc = await firestore.collection('users').doc(memberId).get();
      if (!memberDoc.exists) {
        return res.status(404).json({ error: "Team member not found" });
      }
      const memberData = memberDoc.data()!;

      // Enterprise admin can only remove members from their own organization
      if (!isMasterAdmin && memberData.organizationId !== enterpriseAdminId) {
        return res.status(403).json({ error: "You can only remove members belonging to your organization." });
      }

      // Revoke inherited access and free the seat
      await firestore.collection('users').doc(memberId).update({
        organizationId: null,
        organizationName: null,
        organizationRole: null,
        organizationAdminEmail: null,
        inheritedFrom: null,
        subscription: 'none',
        subscriptionStatus: 'none',
        expiresAt: null,
        lastUpdated: new Date().toISOString()
      });

      res.json({
        success: true,
        message: `Team member ${memberData.email || memberData.name || memberId} removed. Seat has been returned to your pool.`
      });
    } catch (err: any) {
      console.error("[Remove Team Member] ❌ Failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/set-member-password", async (req, res) => {
    try {
      initFirebaseAdmin();
      if (!firebaseAdminInitialized) throw new Error("Firebase Admin not initialized");
      const { memberId, newPassword, adminEmail } = req.body;
      if (!memberId || !newPassword || !adminEmail) {
        return res.status(400).json({ error: "memberId, newPassword, and adminEmail are required" });
      }
      if (newPassword.trim().length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long." });
      }

      const auth = (await import("firebase-admin/auth")).getAuth();
      const firestore = getFirestore(undefined, process.env.VITE_FIREBASE_DATABASE_ID || '(default)');
      const masterAdmins = [
        'pete@rfsuite.net',
        'info@rfsuite.net',
        'office@pro-rf.com',
        'peter@pro-rf.com',
        'support@rfsuite.net',
        'admin@rfsuite.net',
        'rfsuitetest@gmail.com',
        'rfsuitetest2@gmail.com',
        'dvitalis1969@gmail.com',
        'dnomsed@live.co.uk',
        'aniakwlk@yahoo.co.uk'
      ];

      const isMasterAdmin = masterAdmins.includes(adminEmail.toLowerCase().trim());
      let enterpriseAdminId: string | null = null;

      if (!isMasterAdmin) {
        const adminSnapshot = await firestore.collection('users').where('email', '==', adminEmail.toLowerCase().trim()).get();
        if (!adminSnapshot.empty) {
          const adminData = adminSnapshot.docs[0].data();
          if (adminData.subscription?.toLowerCase() === 'enterprise') {
            enterpriseAdminId = adminSnapshot.docs[0].id;
          }
        }
      }

      if (!isMasterAdmin && !enterpriseAdminId) {
        return res.status(403).json({ error: "Unauthorized. Admin or Enterprise privileges required." });
      }

      const memberDoc = await firestore.collection('users').doc(memberId).get();
      if (!memberDoc.exists) {
        return res.status(404).json({ error: "Team member not found" });
      }

      const memberData = memberDoc.data()!;
      if (!isMasterAdmin && memberData.organizationId !== enterpriseAdminId) {
        return res.status(403).json({ error: "You can only manage passwords for members belonging to your organization." });
      }

      await auth.updateUser(memberId, { password: newPassword.trim() });

      res.json({
        success: true,
        message: `Password successfully updated for ${memberData.name || memberData.email}. They can now sign in immediately with this password.`
      });
    } catch (err: any) {
      console.error("[Set Member Password] ❌ Failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/get-member-reset-link", async (req, res) => {
    try {
      initFirebaseAdmin();
      if (!firebaseAdminInitialized) throw new Error("Firebase Admin not initialized");
      const { memberEmail, adminEmail } = req.body;
      if (!memberEmail || !adminEmail) {
        return res.status(400).json({ error: "memberEmail and adminEmail are required" });
      }

      const auth = (await import("firebase-admin/auth")).getAuth();
      const firestore = getFirestore(undefined, process.env.VITE_FIREBASE_DATABASE_ID || '(default)');
      const masterAdmins = [
        'pete@rfsuite.net',
        'info@rfsuite.net',
        'office@pro-rf.com',
        'peter@pro-rf.com',
        'support@rfsuite.net',
        'admin@rfsuite.net',
        'rfsuitetest@gmail.com',
        'rfsuitetest2@gmail.com',
        'dvitalis1969@gmail.com',
        'dnomsed@live.co.uk',
        'aniakwlk@yahoo.co.uk'
      ];

      const isMasterAdmin = masterAdmins.includes(adminEmail.toLowerCase().trim());
      let enterpriseAdminId: string | null = null;

      if (!isMasterAdmin) {
        const adminSnapshot = await firestore.collection('users').where('email', '==', adminEmail.toLowerCase().trim()).get();
        if (!adminSnapshot.empty) {
          const adminData = adminSnapshot.docs[0].data();
          if (adminData.subscription?.toLowerCase() === 'enterprise') {
            enterpriseAdminId = adminSnapshot.docs[0].id;
          }
        }
      }

      if (!isMasterAdmin && !enterpriseAdminId) {
        return res.status(403).json({ error: "Unauthorized. Admin or Enterprise privileges required." });
      }

      const memberSnapshot = await firestore.collection('users').where('email', '==', memberEmail.toLowerCase().trim()).get();
      if (!memberSnapshot.empty) {
        const memberData = memberSnapshot.docs[0].data();
        if (!isMasterAdmin && memberData.organizationId !== enterpriseAdminId) {
          return res.status(403).json({ error: "You can only generate setup links for members belonging to your organization." });
        }
      }

      const resetLink = await auth.generatePasswordResetLink(memberEmail.toLowerCase().trim());

      res.json({
        success: true,
        resetLink,
        message: `Generated activation / password setup link for ${memberEmail}.`
      });
    } catch (err: any) {
      console.error("[Get Member Reset Link] ❌ Failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/update-seat-limit", async (req, res) => {
    try {
      initFirebaseAdmin();
      if (!firebaseAdminInitialized) throw new Error("Firebase Admin not initialized");
      const { targetUserId, maxSeats, adminEmail } = req.body;
      if (!targetUserId || maxSeats === undefined || !adminEmail) {
        return res.status(400).json({ error: "targetUserId, maxSeats, and adminEmail are required" });
      }

      const parsedSeats = parseInt(maxSeats, 10);
      if (isNaN(parsedSeats) || parsedSeats < 1) {
        return res.status(400).json({ error: "Seat count must be a positive number (minimum 1)." });
      }

      const firestore = getFirestore(undefined, process.env.VITE_FIREBASE_DATABASE_ID || '(default)');
      const masterAdmins = [
        'pete@rfsuite.net',
        'info@rfsuite.net',
        'office@pro-rf.com',
        'peter@pro-rf.com',
        'support@rfsuite.net',
        'admin@rfsuite.net',
        'rfsuitetest@gmail.com',
        'rfsuitetest2@gmail.com',
        'dvitalis1969@gmail.com',
        'dnomsed@live.co.uk',
        'aniakwlk@yahoo.co.uk'
      ];

      const isMasterAdmin = masterAdmins.includes(adminEmail.toLowerCase().trim());
      if (!isMasterAdmin) {
        return res.status(403).json({ error: "Unauthorized. Master platform administrator privileges required." });
      }

      const userDocRef = firestore.collection('users').doc(targetUserId);
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: "Target organization user not found" });
      }

      await userDocRef.set({
        maxSeats: parsedSeats,
        lastUpdated: new Date().toISOString()
      }, { merge: true });

      const targetData = userDoc.data();
      res.json({
        success: true,
        maxSeats: parsedSeats,
        message: `Updated seat allocation for ${targetData?.email || targetUserId} to ${parsedSeats} seats.`
      });
    } catch (err: any) {
      console.error("[Update Seat Limit] ❌ Failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/broadcast", async (req, res) => {
    try {
      initFirebaseAdmin();
      const { title, message, adminEmail } = req.body;
      const masterAdmins = ['dvitalis1969@gmail.com', 'dnomsed@live.co.uk', 'aniakwlk@yahoo.co.uk', 'pete@rfsuite.net', 'info@rfsuite.net'];
      
      const firestore = getFirestore(undefined, process.env.VITE_FIREBASE_DATABASE_ID || '(default)');
      
      let isMasterAdmin = adminEmail && masterAdmins.includes(adminEmail.toLowerCase().trim());
      let organizationId = null;

      if (!isMasterAdmin && adminEmail) {
        const adminSnapshot = await firestore.collection('users').where('email', '==', adminEmail.toLowerCase().trim()).get();
        if (!adminSnapshot.empty) {
          const adminData = adminSnapshot.docs[0].data();
          if (adminData.subscription?.toLowerCase() === 'enterprise') {
            organizationId = adminSnapshot.docs[0].id;
          } else {
            return res.status(403).json({ error: "Unauthorized" });
          }
        } else {
          return res.status(403).json({ error: "Admin account not found" });
        }
      } else if (!isMasterAdmin) {
        return res.status(401).json({ error: "Missing admin email" });
      }

      const announcementData: any = {
        title,
        message,
        createdAt: new Date(),
        authorEmail: adminEmail,
        organizationId: organizationId // null for global, UID for enterprise
      };

      await firestore.collection('announcements').add(announcementData);
      res.json({ success: true, scope: organizationId ? 'organization' : 'global' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai-extract-schedule", async (req, res) => {
    try {
      const { base64Data, mimeType } = req.body;
      if (!base64Data || !mimeType) {
        return res.status(400).json({ error: "Missing base64Data or mimeType" });
      }

      // Use the standard environment variable name. 
      // In AI Studio, this is provided automatically.
      // On Render, you must add 'GEMINI_API_KEY' to your Environment variables dashboard.
      console.log("Processing AI Extract Request with model gemini-3-flash-preview");
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey || apiKey.trim() === '') {
        return res.status(500).json({ 
          error: "Gemini API key is not configured. On Render, please add 'GEMINI_API_KEY' to your Environment Variables in the dashboard. In AI Studio, it should be provided automatically.",
          libVersion: "v1.3"
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          role: "user",
          parts: [
            { inlineData: { data: base64Data, mimeType: mimeType } } as any,
            { text: "Extract the running order from this document. Determine each act's name, their stage, their start time, their end time, and the day or date of the performance (e.g. Friday, Saturday, Sunday). Format times as HH:MM. Return the dataset as a JSON array." }
          ]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                artist: { type: Type.STRING },
                stage: { type: Type.STRING },
                start: { type: Type.STRING },
                end: { type: Type.STRING },
                performanceDay: { type: Type.STRING }
              },
              required: ["artist", "stage", "start", "end", "performanceDay"]
            }
          }
        }
      });

      const text = response.text || "[]";
      res.json({
        data: JSON.parse(text),
        libVersion: "v1.3"
      });
    } catch (err: any) {
      console.error("AI Proxy Error:", err);
      // Try to extract a more useful message from the error object if it's a JSON string
      let errorMessage = err.message;
      try {
          if (typeof err.message === 'string' && err.message.includes('{')) {
              const startIdx = err.message.indexOf('{');
              const endIdx = err.message.lastIndexOf('}') + 1;
              const jsonPart = err.message.substring(startIdx, endIdx);
              const parsed = JSON.parse(jsonPart);
              errorMessage = parsed.error?.message || errorMessage;
          }
      } catch (e) {}
      
      res.status(500).json({ 
        error: errorMessage,
        raw: err.message,
        libVersion: "v1.3"
      });
    }
  });

  // API routes FIRST
  app.get("/api", (req, res) => {
    res.json({ message: "RF Suite API is running", version: "v2.5.1-STABLE-MARCH-17-13:12" });
  });

  app.post("/api/send-email", async (req, res) => {
    let host = "unknown";
    try {
      console.log("📧 Received email request:", req.body);
      const { subject, message, userEmail } = req.body;
      
      let emailUser = process.env.EMAIL_USER;
      let emailPass = process.env.EMAIL_PASS;
      console.log(`📧 Checking credentials: EMAIL_USER='${emailUser}', EMAIL_PASS='${emailPass ? '***' : 'MISSING'}'`);
      let emailConfig: any = {};

      // Fallback to local file if env vars are missing
      if (!emailUser || !emailPass) {
        const emailPath = path.join(process.cwd(), 'email-config.json');
        if (fs.existsSync(emailPath)) {
          try {
            emailConfig = JSON.parse(fs.readFileSync(emailPath, 'utf8'));
            emailUser = emailConfig.emailUser;
            emailPass = emailConfig.emailPass;
            console.log("✅ Email credentials loaded from local email-config.json");
          } catch (e) {
            console.error("Error loading local email-config.json:", e);
          }
        }
      }

      if (!emailUser || !emailPass) {
        console.error("❌ Email credentials missing");
        return res.status(400).json({ error: "Email service is not configured. Please set EMAIL_USER and EMAIL_PASS in settings." });
      }

      // Auto-detect SMTP settings based on domain if not explicitly provided
      host = process.env.SMTP_HOST || emailConfig.host;
      let port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : emailConfig.port;
      let secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : emailConfig.secure;

      if (!host) {
        if (emailUser.includes('@outlook.com') || emailUser.includes('@hotmail.com') || emailUser.includes('@live.com') || emailUser.includes('@rfsuite.net')) {
          host = 'smtp.office365.com';
          port = 587;
          secure = false; // Office365 uses STARTTLS on 587
        } else {
          host = 'smtp.gmail.com';
          port = 465;
          secure = true;
        }
      }

      console.log(`📧 Using SMTP host: ${host}, port: ${port}, secure: ${secure}, user: ${emailUser.substring(0, 3)}...`);

      const transporter = nodemailer.createTransport({
        host: host,
        port: port,
        secure: secure,
        auth: {
          user: emailUser,
          pass: emailPass,
        },
        tls: {
          // This helps with some Office365/Outlook certificate issues
          ciphers: 'SSLv3',
          rejectUnauthorized: false
        },
        // Add timeout to prevent hanging
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });

      const supportEmail = process.env.SUPPORT_EMAIL || 'info@rfsuite.net';
      console.log(`📧 Sending support email to: ${supportEmail ? supportEmail.substring(0, 3) + '...' : 'MISSING'}`);

      await transporter.sendMail({
        from: emailUser,
        to: supportEmail,
        replyTo: userEmail,
        subject: `New Contact Support Message: ${subject}`,
        text: `From: ${userEmail}\n\nMessage:\n${message}`,
      });

      console.log("✅ Email sent successfully");
      res.json({ success: true });
    } catch (err: any) {
      console.error("❌ Email error:", err);
      
      let errorMessage = `Failed to send email via ${host}`;
      if (err.message && err.message.includes("535")) {
        if (host.includes('gmail')) {
          errorMessage = "Gmail authentication failed. Please ensure you are using a 16-character 'App Password' instead of your regular password. You can generate one in your Google Account settings.";
        } else if (host.includes('office365') || host.includes('outlook')) {
          errorMessage = "Outlook/Office365 authentication failed. Please check your email and password. If you have 2-Step Verification enabled, you may need an 'App Password' from your Microsoft account settings.";
        } else {
          errorMessage = `Authentication failed for ${host}. Please verify your EMAIL_USER and EMAIL_PASS.`;
        }
      } else if (err.message && (err.message.includes("ETIMEDOUT") || err.message.includes("ECONNREFUSED"))) {
        errorMessage = `Connection to email server (${host}) failed. This might be a network issue or incorrect SMTP settings.`;
      } else if (err.message) {
        errorMessage = `Email Error (${host}): ${err.message}`;
      }
      
      res.status(500).json({ error: errorMessage });
    }
  });

  app.get("/api/link-preview", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) return res.status(400).json({ error: "URL is required" });
      
      const preview = await getLinkPreview(url, {
        timeout: 3000,
        followRedirects: 'follow'
      });
      res.json(preview);
    } catch (err) {
      console.error("Link preview error:", err);
      res.status(500).json({ error: "Failed to fetch link preview" });
    }
  });

  app.get("/api/checkout-success", async (req, res) => {
    const sessionId = req.query.session_id as string;
    console.log(`[Success Route] Received session_id: ${sessionId}`);
    
    if (sessionId) {
      try {
        initFirebaseAdmin();
        const stripe = getStripe();
        console.log(`[Success Route] Retrieving Stripe session...`);
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ['line_items.data.price.product'],
        });
        const userId = session.client_reference_id;
        console.log(`[Success Route] Session retrieved. UserID: ${userId}, FirebaseReady: ${firebaseAdminInitialized}`);
        
        if (userId && firebaseAdminInitialized) {
          const db = getFirestore(undefined, process.env.VITE_FIREBASE_DATABASE_ID || '(default)');
          const updateData: any = { 
            subscriptionStatus: 'active',
            lastUpdated: new Date().toISOString()
          };

          const lineItem = session.line_items?.data[0];
          if (lineItem?.price?.product) {
            const product = lineItem.price.product as Stripe.Product;
            updateData.subscription = product.name;
          }

          if (session.customer) updateData.stripeCustomerId = session.customer;
          if (session.subscription) updateData.stripeSubscriptionId = session.subscription;
          
          const planName = (session.metadata?.tierName || updateData.subscription || '').toLowerCase();
          console.log(`[Success Route] 🔍 Plan Name detected: "${planName}"`);
          if (planName) {
            if (planName.includes('48 hour')) {
              updateData.expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
            } else if (planName.includes('7 day')) {
              updateData.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            } else if (planName.includes('1 month')) {
              updateData.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            } else if (planName.includes('enterprise')) {
              updateData.subscription = 'Enterprise';
              updateData.expiresAt = null;
            } else if (planName.includes('pass')) {
              // Fallback for any other "pass" - default to 48 hours
              updateData.expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
              console.log(`[Success Route] ⚠️ Unknown pass type "${planName}", defaulting to 48h expiration`);
            }
          }

          console.log(`[Success Route] Updating Firestore for user ${userId}...`, JSON.stringify(updateData, null, 2));
          await db.collection('users').doc(userId).set(updateData, { merge: true });
          console.log(`[Success Route] ✅ Firestore update successful`);
        } else {
          console.warn(`[Success Route] ⚠️ Skipping Firestore update: userId=${userId}, firebaseAdminInitialized=${firebaseAdminInitialized}`);
        }
      } catch (err) {
        console.error("[Success Route] ❌ Error verifying session on success route:", err);
      }
    }

    res.redirect('/?checkout=success');
  });

  app.get("/api/checkout-cancel", (req, res) => {
    res.redirect('/?checkout=cancel');
  });

  app.post("/api/test-checkout-success", async (req, res) => {
    try {
      initFirebaseAdmin();
      if (!firebaseAdminInitialized) throw new Error("Firebase Admin not initialized");
      
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      
      const db = getFirestore(undefined, process.env.VITE_FIREBASE_DATABASE_ID || '(default)');
      const updateData: any = {
        subscription: "48 Hour Pass Test",
        subscriptionStatus: "active",
        lastUpdated: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        isTest: true
      };
      
      console.log(`[Test Success] Simulating success for user ${userId}...`);
      await db.collection('users').doc(userId).set(updateData, { merge: true });
      console.log(`[Test Success] ✅ Mock update successful`);
      
      res.json({ success: true, message: "Mock update successful" });
    } catch (err: any) {
      console.error("[Test Success] ❌ Mock update failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/portal-return", (req, res) => {
    res.redirect('/?portal=return');
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      console.log("[Checkout] Creating session request received");
      const stripe = getStripe();
      const { priceId, userId, email, returnUrl, tierName } = req.body;
      
      console.log("[Checkout] Params:", { priceId, userId, email, returnUrl, tierName });

      if (!priceId || !userId || !email || !returnUrl) {
        console.error("[Checkout] ❌ Missing required parameters");
        return res.status(400).json({ error: "Missing required parameters" });
      }

      // Fetch the price to determine if it's recurring or one-time
      const stripeKey = process.env.STRIPE_SECRET_KEY || '';
      const isTestKey = stripeKey.startsWith('sk_test_');
      console.log(`[Checkout] 🔍 Retrieving price details for: ${priceId}`);
      console.log(`[Checkout] 🔑 Using Stripe ${isTestKey ? 'TEST' : 'LIVE'} Key (starts with: ${stripeKey.substring(0, 7)}...)`);
      
      let price;
      try {
        price = await stripe.prices.retrieve(priceId);
      } catch (priceErr: any) {
        if (priceErr.code === 'resource_missing') {
          const msg = `[Checkout] ❌ Price ID ${priceId} NOT FOUND. You are using a ${isTestKey ? 'TEST' : 'LIVE'} key. Please ensure this Price ID exists in your Stripe ${isTestKey ? 'Test' : 'Live'} dashboard.`;
          console.error(msg);
          return res.status(404).json({ 
            error: "Price not found", 
            message: msg,
            mode: isTestKey ? 'test' : 'live'
          });
        }
        throw priceErr;
      }

      const mode = price.type === 'recurring' ? 'subscription' : 'payment';
      console.log(`[Checkout] ✅ Price found! Mode: ${mode}, Currency: ${price.currency}`);
      
      const session = await stripe.checkout.sessions.create({
        mode: mode,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${returnUrl}/api/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${returnUrl}/api/checkout-cancel`,
        client_reference_id: userId,
        customer_email: email,
        metadata: {
          tierName: tierName || 'Unknown Pass'
        }
      });

      console.log("[Checkout] ✅ Session created successfully:", session.id);
      res.json({ url: session.url });
    } catch (err: any) {
      console.error("[Checkout] ❌ Stripe session creation failed:", err.message);
      res.status(500).json({ 
        error: err.message,
        details: process.env.NODE_ENV !== 'production' ? err : undefined
      });
    }
  });

  app.post("/api/create-portal-session", async (req, res) => {
    try {
      const stripe = getStripe();
      const { customerId, returnUrl } = req.body;
      
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${returnUrl}/api/portal-return`,
      });

      res.json({ url: portalSession.url });
    } catch (err: any) {
      console.error("Stripe portal error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/backup-json", (req, res) => {
    const backup: Record<string, string> = {};
    const walk = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const relativePath = path.relative(process.cwd(), fullPath);
        if (
          relativePath.startsWith("node_modules") || 
          relativePath.startsWith("dist") || 
          relativePath.startsWith(".git") || 
          relativePath.startsWith("dev-dist") || 
          relativePath.endsWith(".zip") ||
          relativePath.endsWith(".png") ||
          relativePath.endsWith(".jpg") ||
          relativePath.endsWith(".ico")
        ) continue;

        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) walk(fullPath);
        else backup[relativePath] = fs.readFileSync(fullPath, 'utf8');
      }
    };
    try {
      walk(process.cwd());
      res.json(backup);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/download/mobile-index", (req, res) => {
    try {
      const filePath = path.join(process.cwd(), 'app', 'index.tsx');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="index.tsx"');
      res.sendFile(filePath);
    } catch (err) {
      res.status(500).send("Error reading index.tsx: " + String(err));
    }
  });

  // Explicit download endpoints for index.txt and index.tsx
  app.get(["/download/index.txt", "/api/download/index.txt", "/files/index.txt", "/raw/index.txt"], (req, res) => {
    try {
      const filePath = path.join(process.cwd(), 'app', 'index.tsx');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="index.txt"');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      res.sendFile(filePath);
    } catch (err) {
      res.status(500).send("Error reading index.txt: " + String(err));
    }
  });

  app.get(["/download/index.tsx", "/api/download/index.tsx", "/files/index.tsx", "/download/latest/index.tsx", "/api/latest/index.tsx"], (req, res) => {
    try {
      const filePath = path.join(process.cwd(), 'app', 'index.tsx');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="index.tsx"');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      res.sendFile(filePath);
    } catch (err) {
      res.status(500).send("Error reading index.tsx: " + String(err));
    }
  });

  app.get("/api/download/rfmath", (req, res) => {
    try {
      const filePath = path.join(process.cwd(), 'app', 'utils', 'rfMath.ts');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="rfMath.ts"');
      res.sendFile(filePath);
    } catch (err) {
      res.status(500).send("Error reading rfMath.ts: " + String(err));
    }
  });

  app.get("/api/download/spectrum-analyzer", (req, res) => {
    try {
      const filePath = path.join(process.cwd(), 'app', 'components', 'TacticalSpectrumAnalyzer.tsx');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="TacticalSpectrumAnalyzer.tsx"');
      res.sendFile(filePath);
    } catch (err) {
      res.status(500).send("Error reading TacticalSpectrumAnalyzer.tsx: " + String(err));
    }
  });

  app.get("/api/download/ptt-simulator", (req, res) => {
    try {
      const filePath = path.join(process.cwd(), 'app', 'components', 'PttSimulator.tsx');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="PttSimulator.tsx"');
      res.sendFile(filePath);
    } catch (err) {
      res.status(500).send("Error reading PttSimulator.tsx: " + String(err));
    }
  });

  app.get("/api/download/callsheet-modal", (req, res) => {
    try {
      const filePath = path.join(process.cwd(), 'app', 'components', 'CrewCallSheetModal.tsx');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="CrewCallSheetModal.tsx"');
      res.sendFile(filePath);
    } catch (err) {
      res.status(500).send("Error reading CrewCallSheetModal.tsx: " + String(err));
    }
  });

  app.get("/api/backup-code-v2", (req, res) => {
    try {
      console.log("Starting backup-code generation...");
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=RF_Suite_Source_${timestamp}.zip`);
      
      const archive = archiver('zip', {
        zlib: { level: 9 }
      });

      archive.on('error', function(err) {
        console.error("Archiver error:", err);
        if (!res.headersSent) {
            res.status(500).send({ error: err.message });
        }
      });

      archive.on('warning', function(err) {
        if (err.code === 'ENOENT') {
          console.warn("Archiver warning:", err);
        } else {
          console.error("Archiver error:", err);
        }
      });

      archive.pipe(res);

      const rootDir = process.cwd();
      console.log("Root Dir:", rootDir);

      const walk = (dir: string, baseDir: string = '') => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const relativePath = path.join(baseDir, file);
          
          // Ignore patterns
          if (
            file === 'node_modules' || 
            file === 'dist' || 
            file === '.git' || 
            file === 'dev-dist' || 
            file.endsWith('.zip') ||
            file.endsWith('.sqlite') ||
            file.endsWith('.db')
          ) {
            continue;
          }

          try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              walk(fullPath, relativePath);
            } else {
              // console.log("Adding file:", relativePath); // Uncomment for debugging if needed
              archive.file(fullPath, { name: relativePath });
            }
          } catch (e) {
            console.warn(`Skipping file ${fullPath}:`, e);
          }
        }
      };

      walk(rootDir);

      archive.finalize();
    } catch (err) {
      console.error("Zip error:", err);
      if (!res.headersSent) {
        res.status(500).send("Error creating zip: " + String(err));
      }
    }
  });

  app.get("/api/debug-dist", (req, res) => {
    try {
      const distPath = path.join(process.cwd(), "dist");
      if (!fs.existsSync(distPath)) {
        return res.json({ error: "dist not found", path: distPath });
      }
      
      const files: any[] = [];
      
      function walk(dir: string, relativePath: string = "") {
        const list = fs.readdirSync(dir);
        list.forEach(file => {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          const rel = path.join(relativePath, file);
          if (stat.isDirectory()) {
            walk(filePath, rel);
          } else {
            files.push({ path: rel, size: stat.size });
          }
        });
      }
      
      walk(distPath);
      res.json({ 
        cwd: process.cwd(),
        distPath,
        files,
        totalFiles: files.length,
        totalSize: files.reduce((acc, f) => acc + f.size, 0)
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/download-dist", (req, res) => {
    try {
      const distPath = path.join(process.cwd(), "dist");
      console.log("Download-dist requested. Dist path:", distPath);

      if (!fs.existsSync(distPath)) {
        console.error("Dist folder not found at:", distPath);
        return res.status(404).send("Build output (dist) not found. Please wait a moment and try again.");
      }
      
      const zip = new AdmZip();
      
      if (!fs.existsSync(distPath)) {
        console.error("Dist folder not found at:", distPath);
        return res.status(404).send("Build output (dist) not found. Please wait a moment and try again.");
      }

      // Use addLocalFolder for better reliability as suggested in generate-zip.ts
      zip.addLocalFolder(distPath);
      
      const buffer = zip.toBuffer();
      console.log("Zip created. Buffer size:", buffer.length);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `RF_Suite_DEPLOY_ME_${timestamp}.zip`;
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.end(buffer);
    } catch (err) {
      console.error("Dist zip error:", err);
      if (!res.headersSent) {
        res.status(500).send("Error creating dist zip: " + String(err));
      }
    }
  });

  app.get("/api/download-deploy-zip", (req, res) => {
    try {
      const distPath = path.join(process.cwd(), "dist");
      console.log("Generating deploy zip from:", distPath);

      if (!fs.existsSync(distPath)) {
        console.error("Dist folder not found at:", distPath);
        return res.status(404).json({ error: "Build output (dist) not found. Please wait a moment and try again." });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=RF_Suite_Deploy_${timestamp}.zip`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
      });

      archive.on('error', function(err) {
        console.error("Archiver error:", err);
        if (!res.headersSent) {
            res.status(500).send({ error: err.message });
        }
      });

      // Pipe archive data to the response
      archive.pipe(res);

      // Add all files from dist, ignoring any zip files to prevent recursion
      archive.glob('**/*', { 
        cwd: distPath,
        ignore: ['*.zip', '**/*.zip'] 
      });

      archive.finalize();

    } catch (err) {
      console.error("Zip generation error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error creating zip: " + String(err) });
      }
    }
  });

  app.get("/api/lookup/postcode", async (req, res) => {
    try {
      const { postcode, region } = req.query;
      if (!postcode) return res.status(400).json({ error: "Postcode is required" });

      if (region === 'us') {
        // Use zippopotam.us for US Zips
        const response = await fetch(`https://api.zippopotam.us/us/${postcode}`);
        if (!response.ok) {
          return res.status(404).json({ error: "Zip code not found" });
        }
        const data: any = await response.json();
        const place = data.places[0];
        return res.json({
          lat: parseFloat(place.latitude),
          lng: parseFloat(place.longitude),
          name: `${place['place name']}, ${place['state abbreviation']}`
        });
      } else {
        // Use postcodes.io for UK
        const response = await fetch(`https://api.postcodes.io/postcodes/${(postcode as string).replace(/\s/g, '')}`);
        if (!response.ok) {
          return res.status(404).json({ error: "Postcode not found" });
        }
        const data: any = await response.json();
        return res.json({
          lat: data.result.latitude,
          lng: data.result.longitude,
          name: data.result.parish || data.result.admin_ward || "UK Location"
        });
      }
    } catch (err) {
      console.error("Postcode lookup error:", err);
      res.status(500).json({ error: "Failed to lookup postcode" });
    }
  });

  app.get("/api/lookup/uk-tv", (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const offset = parseFloat(req.query.offset as string) || 0;
      const env = req.query.env as string || 'outdoor';
      const sirThreshold = env === 'indoor' ? 30 : 40;
      
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: "Invalid coordinates" });
      }

      const transmittersPath = path.join(process.cwd(), 'data', 'uk_transmitters.json');
      if (!fs.existsSync(transmittersPath)) {
        return res.json({ occupied: [] });
      }

      const transmitters = JSON.parse(fs.readFileSync(transmittersPath, 'utf8'));
      const channelData: Record<number, { maxErp: number, transmitterName: string, distance: number }> = {};
      const coveringNames: string[] = [];

      const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      };

      // Find all transmitters that cover this location
      // Ignore local fillers with ERP < 6W (0.006 kW)
      const covering = transmitters
        .filter((t: any) => t.erp && t.erp >= 0.006)
        .map((t: any) => {
          const distance = haversine(lat, lng, t.lat, t.lng);
          return { ...t, distance };
        })
        .filter((t: any) => t.distance <= Math.min(t.radius || 65, 65));

      if (covering.length > 0) {
        covering.forEach((t: any) => {
          let blocksChannel = false;
          t.channels.forEach((ch: number) => {
            // ERP Overrides based on provided CSV data
            let erp = t.erp;
            const overrides: Record<string, Record<number, number>> = {
              "Angus": { 33: 10, 36: 10, 48: 10 },
              "Arfon North": { 29: 8, 31: 8, 37: 8 },
              "Arfon South": { 41: 2, 44: 2, 47: 2 },
              "Beacon Hill": { 42: 10, 45: 10, 40: 10 },
              "Belmont": { 30: 64, 23: 75, 26: 75 },
              "Bilsdale": { 21: 117.5, 43: 50, 46: 50, 40: 50 },
              "Blaenplwyf": { 25: 10, 22: 10, 28: 10 },
              "Brougher Mountain": { 21: 2, 24: 2, 27: 2, 30: 1 },
              "Caldbeck": { 23: 50, 26: 50, 30: 50 },
              "Caradon Hill": { 21: 50, 24: 50, 27: 50 },
              "Carmel": { 33: 10, 36: 10, 48: 10 },
              "Chatton": { 29: 10, 31: 10, 37: 10 },
              "Craigkelly": { 29: 10, 31: 10, 37: 10 },
              "Crystal Palace": { 35: 34 },
              "Darvel": { 32: 10, 34: 10, 35: 10 },
              "Divis": { 23: 50, 26: 50, 30: 50 },
              "Dover": { 39: 40, 42: 40, 48: 40 },
              "Durris": { 23: 50, 26: 50, 30: 50 },
              "Eitshal": { 25: 10, 22: 10 },
              "Hannington": { 40: 25, 43: 25, 46: 25 },
              "Huntshaw Cross": { 32: 10, 34: 10, 35: 10 },
              "Keelylang Hill": { 42: 10, 45: 10, 39: 10 },
              "Knockmore": { 33: 10, 36: 10, 48: 10 },
              "Limavady": { 40: 10, 43: 10, 46: 10 },
              "Midhurst": { 29: 10, 34: 10, 33: 10 },
              "Moel Y Parc": { 33: 10, 36: 10, 48: 10 },
              "Oxford": { 29: 50, 37: 50, 31: 50 },
              "Presely": { 42: 10, 45: 10, 39: 10 },
              "Redruth": { 48: 10, 33: 10, 32: 10 },
              "Ridge Hill": { 21: 10, 24: 10, 27: 10 },
              "Rosemarkie": { 43: 10, 46: 10, 40: 10 },
              "Rowridge": { 25: 50, 22: 50, 28: 50 },
              "Rumster Forest": { 32: 10, 34: 10, 35: 10 },
              "Sandy Heath": { 33: 170, 36: 170, 48: 170 },
              "Selkirk": { 33: 5, 36: 5, 48: 5 },
              "Stockland Hill": { 25: 25, 22: 25, 28: 25 },
              "Waltham": { 29: 25, 37: 25, 31: 25 },
              "Wenvoe": { 42: 50, 45: 50, 39: 50 }
            };

            if (overrides[t.name] && overrides[t.name][ch] !== undefined) {
              erp = overrides[t.name][ch];
            }
            
            // Apply SIR formula
            const ERP_W = erp * 1000;
            const d_TV_km = Math.max(t.distance, 0.001); // Prevent log10(0)
            
            // Earth curvature / terrain penalty: 1.5 dB extra path loss per km over 30km
            const terrainPenalty = d_TV_km > 30 ? (d_TV_km - 30) * 1.5 : 0;
            
            const sir = 13.98 
                      - 10 * Math.log10(ERP_W) 
                      + 20 * Math.log10(d_TV_km) 
                      + terrainPenalty
                      + offset;
                      
            if (sir < sirThreshold) {
              blocksChannel = true;
              if (!channelData[ch] || erp > channelData[ch].maxErp) {
                channelData[ch] = { maxErp: erp, transmitterName: t.name, distance: parseFloat(t.distance.toFixed(1)) };
              }
            }
          });
          
          if (blocksChannel) {
            coveringNames.push(t.name);
          }
        });
      }

      res.json({ 
        occupied: channelData,
        transmitters: coveringNames
      });
    } catch (err) {
      console.error("UK TV Lookup error:", err);
      res.status(500).json({ error: "Failed to lookup TV transmitters" });
    }
  });

  app.get("/api/lookup/us-tv", async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const offset = parseFloat(req.query.offset as string) || 0;
      const env = req.query.env as string || 'outdoor';
      const sirThreshold = env === 'indoor' ? 30 : 40;
      
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: "Invalid coordinates" });
      }

      let transmitters: any[] = [];
      let source = "None";

      // 1. Try RabbitEars if API Key is present
      if (process.env.RABBITEARS_API_KEY) {
        try {
          const reUrl = `https://www.rabbitears.info/api.php?request=getsignalreport&key=${process.env.RABBITEARS_API_KEY}&lat=${lat}&lon=${lng}&format=json`;
          const resp = await fetch(reUrl);
          if (resp.ok) {
            const data: any = await resp.json();
            if (data && data.stations) {
              transmitters = data.stations.map((s: any) => ({
                name: s.callsign || s.name,
                callsign: s.callsign,
                lat: parseFloat(s.latitude),
                lng: parseFloat(s.longitude),
                channels: [parseInt(s.channel)],
                erp: parseFloat(s.erp) || 100,
                distance: parseFloat(s.distance),
                radius: 80
              }));
              source = "RabbitEars API";
            }
          }
        } catch (e) {
          console.warn("RabbitEars API attempt failed:", e);
        }
      }

      // 2. Try the older FCC API endpoint as fallback if reached
      if (transmitters.length === 0) {
        try {
          // Use a shorter timeout and try data.fcc.gov which sometimes works
          const fccUrl = `https://data.fcc.gov/api/dtv-maps/stations.json?lat=${lat}&lon=${lng}&dist=100`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const resp = await fetch(fccUrl, { signal: controller.signal }).catch(() => null);
          clearTimeout(timeoutId);
          
          if (resp && resp.ok) {
            const data: any = await resp.json();
            if (data && data.stations) {
              transmitters = data.stations.map((s: any) => ({
                name: s.callsign || s.facilityId,
                callsign: s.callsign,
                lat: parseFloat(s.latitude),
                lng: parseFloat(s.longitude),
                channels: [parseInt(s.channel)],
                erp: parseFloat(s.erp) || 100,
                distance: parseFloat(s.distance),
                radius: 100
              }));
              source = "FCC DTV Maps (Legacy)";
            }
          }
        } catch (e) {}
      }

      // 3. Partitioned Local Backup (Scalable)
      if (transmitters.length === 0) {
        const latGrid = Math.floor(lat / 2);
        const lngGrid = Math.floor(lng / 2);
        
        // Load surrounding grids (+/- 1) to ensure we get nearby transmitters
        for (let dl = -1; dl <= 1; dl++) {
          for (let dg = -1; dg <= 1; dg++) {
            const key = `${latGrid + dl}_${lngGrid + dg}`;
            const pPath = path.join(process.cwd(), 'data', 'us_partitioned', `${key}.json`);
            if (fs.existsSync(pPath)) {
              try {
                const pData = JSON.parse(fs.readFileSync(pPath, 'utf8'));
                if (Array.isArray(pData)) {
                  transmitters.push(...pData);
                }
              } catch (e) {}
            }
          }
        }
        
        if (transmitters.length > 0) {
          source = "Local Partitioned Data";
        } else {
          // Absolute fallback to full file if partitions missing or empty
          const fullPath = path.join(process.cwd(), 'data', 'us_transmitters.json');
          if (fs.existsSync(fullPath)) {
            try {
              const fullData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
              if (Array.isArray(fullData) && fullData.length > 0) {
                transmitters = fullData;
                source = "Local Full Backup";
              }
            } catch (e) {}
          }
        }
      }

      const channelData: Record<number, { maxErp: number, transmitterName: string, distance: number }> = {};
      const coveringNames: string[] = [];

      const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      };

      const sortedTransmitters = transmitters
        .map((t: any) => {
          const distance = t.distance !== undefined ? t.distance : haversine(lat, lng, t.lat, t.lng);
          return { ...t, distance };
        })
        .filter((t: any, index: number, self: any[]) => 
          // filter duplicates by name in case multiple partitions had same station
          index === self.findIndex((u) => u.name === t.name)
        )
        .filter((t: any) => t.distance <= Math.min(t.radius || 100, 100));

      sortedTransmitters.forEach((t: any) => {
        let blocksChannel = false;
        const channelsToProcess = Array.isArray(t.channels) ? t.channels : (t.channel ? [t.channel] : []);
        
        channelsToProcess.forEach((ch: number) => {
          const erp = t.erp || 100;
          const ERP_W = erp * 1000;
          const d_TV_km = Math.max(t.distance, 0.001);
          const terrainPenalty = d_TV_km > 30 ? (d_TV_km - 30) * 1.5 : 0;
          const sir = 13.98 - 10 * Math.log10(ERP_W) + 20 * Math.log10(d_TV_km) + terrainPenalty + offset;

          if (sir < sirThreshold) {
            blocksChannel = true;
            if (!channelData[ch] || erp > (channelData[ch]?.maxErp || 0)) {
              channelData[ch] = { 
                maxErp: erp, 
                transmitterName: t.name || t.callsign || "Unknown", 
                distance: parseFloat(t.distance.toFixed(1)) 
              };
            }
          }
        });

        if (blocksChannel) {
          coveringNames.push(t.name || t.callsign || "Unknown");
        }
      });

      res.json({ 
        occupied: channelData,
        transmitters: Array.from(new Set(coveringNames)),
        meta: { source, lat, lng, count: transmitters.length, nearbyCount: sortedTransmitters.length }
      });
    } catch (err) {
      console.error("US TV Lookup Route Error:", err);
      res.status(500).json({ error: "Failed to lookup TV transmitters", occupied: {}, transmitters: [] });
    }
  });

  // Registered downloadable files mapping for easy case-insensitive resolution
  const DOWNLOAD_REGISTRY: Record<string, { relativePath: string; fileName: string; contentType: string }> = {
    "radio-mic-planner.tsx": { relativePath: "app/radio-mic-planner.tsx", fileName: "radio-mic-planner.tsx", contentType: "text/plain; charset=utf-8" },
    "radio-mic-planner.txt": { relativePath: "app/radio-mic-planner.tsx", fileName: "radio-mic-planner.txt", contentType: "text/plain; charset=utf-8" },
    "radio-mic-planner": { relativePath: "app/radio-mic-planner.tsx", fileName: "radio-mic-planner.tsx", contentType: "text/plain; charset=utf-8" },
    "radiomicplanner.tsx": { relativePath: "app/radio-mic-planner.tsx", fileName: "radio-mic-planner.tsx", contentType: "text/plain; charset=utf-8" },
    "index.tsx": { relativePath: "index.tsx", fileName: "index.tsx", contentType: "text/plain; charset=utf-8" },
    "index.txt": { relativePath: "index.tsx", fileName: "index.txt", contentType: "text/plain; charset=utf-8" },
    "index": { relativePath: "index.tsx", fileName: "index.tsx", contentType: "text/plain; charset=utf-8" },
    "rfmath.ts": { relativePath: "app/utils/rfMath.ts", fileName: "rfMath.ts", contentType: "text/plain; charset=utf-8" },
    "rfmath.txt": { relativePath: "app/utils/rfMath.ts", fileName: "rfMath.txt", contentType: "text/plain; charset=utf-8" },
    "rfmath": { relativePath: "app/utils/rfMath.ts", fileName: "rfMath.ts", contentType: "text/plain; charset=utf-8" },
    "rf-math.ts": { relativePath: "app/utils/rfMath.ts", fileName: "rfMath.ts", contentType: "text/plain; charset=utf-8" },
    "rf_math.ts": { relativePath: "app/utils/rfMath.ts", fileName: "rfMath.ts", contentType: "text/plain; charset=utf-8" },
    "math.ts": { relativePath: "app/utils/rfMath.ts", fileName: "rfMath.ts", contentType: "text/plain; charset=utf-8" },
    "tacticalspectrumanalyzer.tsx": { relativePath: "app/components/TacticalSpectrumAnalyzer.tsx", fileName: "TacticalSpectrumAnalyzer.tsx", contentType: "text/plain; charset=utf-8" },
    "spectrum-analyzer": { relativePath: "app/components/TacticalSpectrumAnalyzer.tsx", fileName: "TacticalSpectrumAnalyzer.tsx", contentType: "text/plain; charset=utf-8" },
    "spectrum": { relativePath: "app/components/TacticalSpectrumAnalyzer.tsx", fileName: "TacticalSpectrumAnalyzer.tsx", contentType: "text/plain; charset=utf-8" },
    "pttsimulator.tsx": { relativePath: "app/components/PttSimulator.tsx", fileName: "PttSimulator.tsx", contentType: "text/plain; charset=utf-8" },
    "ptt-simulator": { relativePath: "app/components/PttSimulator.tsx", fileName: "PttSimulator.tsx", contentType: "text/plain; charset=utf-8" },
    "ptt": { relativePath: "app/components/PttSimulator.tsx", fileName: "PttSimulator.tsx", contentType: "text/plain; charset=utf-8" },
    "crewcallsheetmodal.tsx": { relativePath: "app/components/CrewCallSheetModal.tsx", fileName: "CrewCallSheetModal.tsx", contentType: "text/plain; charset=utf-8" },
    "callsheet-modal": { relativePath: "app/components/CrewCallSheetModal.tsx", fileName: "CrewCallSheetModal.tsx", contentType: "text/plain; charset=utf-8" },
    "callsheet": { relativePath: "app/components/CrewCallSheetModal.tsx", fileName: "CrewCallSheetModal.tsx", contentType: "text/plain; charset=utf-8" },
    "google_play_header_4096x2304.jpg": { relativePath: "public/assets/google_play_header_4096x2304.jpg", fileName: "google_play_header_4096x2304.jpg", contentType: "image/jpeg" },
    "google_play_header_4096x2304.png": { relativePath: "public/assets/google_play_header_4096x2304.png", fileName: "google_play_header_4096x2304.png", contentType: "image/png" },
    "google_play_feature_1024x500.png": { relativePath: "public/assets/google_play_feature_1024x500.png", fileName: "google_play_feature_1024x500.png", contentType: "image/png" },
    "header-4096.jpg": { relativePath: "public/assets/google_play_header_4096x2304.jpg", fileName: "google_play_header_4096x2304.jpg", contentType: "image/jpeg" },
    "header-4096.png": { relativePath: "public/assets/google_play_header_4096x2304.png", fileName: "google_play_header_4096x2304.png", contentType: "image/png" },
    "header.jpg": { relativePath: "public/assets/google_play_header_4096x2304.jpg", fileName: "google_play_header_4096x2304.jpg", contentType: "image/jpeg" },
    "header.png": { relativePath: "public/assets/google_play_header_4096x2304.png", fileName: "google_play_header_4096x2304.png", contentType: "image/png" },
    "feature-1024.png": { relativePath: "public/assets/google_play_feature_1024x500.png", fileName: "google_play_feature_1024x500.png", contentType: "image/png" },
    "feature.png": { relativePath: "public/assets/google_play_feature_1024x500.png", fileName: "google_play_feature_1024x500.png", contentType: "image/png" }
  };

  const resolveDownloadFile = (rawRequested: any) => {
    let requestedName = "";
    if (Array.isArray(rawRequested)) {
      requestedName = rawRequested.join("/");
    } else if (typeof rawRequested === "string") {
      requestedName = rawRequested;
    } else {
      requestedName = String(rawRequested || "");
    }
    requestedName = requestedName.trim().replace(/^\/+/, "");

    const clean = requestedName.toLowerCase();
    if (DOWNLOAD_REGISTRY[clean]) {
      const entry = DOWNLOAD_REGISTRY[clean];
      const fullPath = path.join(process.cwd(), entry.relativePath);
      if (fs.existsSync(fullPath)) return { ...entry, fullPath };
    }
    // Also check direct match in common directories
    const candidates = [
      path.join(process.cwd(), requestedName),
      path.join(process.cwd(), "public", "assets", requestedName),
      path.join(process.cwd(), "public", requestedName),
      path.join(process.cwd(), "src", "assets", "images", requestedName),
      path.join(process.cwd(), "app", requestedName),
      path.join(process.cwd(), "app", "utils", requestedName),
      path.join(process.cwd(), "app", "components", requestedName),
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        const ext = path.extname(cand).toLowerCase();
        let ct = "text/plain; charset=utf-8";
        if (ext === '.jpg' || ext === '.jpeg') ct = "image/jpeg";
        else if (ext === '.png') ct = "image/png";
        else if (ext === '.zip') ct = "application/zip";
        else if (ext === '.tsx' || ext === '.ts') ct = "text/typescript; charset=utf-8";
        return { fullPath: cand, fileName: path.basename(cand), contentType: ct };
      }
    }
    return null;
  };

  const handleDownloadRequest = (req: any, res: any, asAttachment: boolean) => {
    let param = req.params?.file || req.params?.[0] || req.query?.file || "";
    if (!param) {
      param = req.path.replace(/^\/(api\/)?(download|raw)\/?/i, "");
    }
    const matched = resolveDownloadFile(param);
    if (!matched) {
      return res.status(404).send(`File '${param}' not found in project`);
    }
    res.setHeader("Content-Type", matched.contentType || "text/plain; charset=utf-8");
    if (asAttachment) {
      res.setHeader("Content-Disposition", `attachment; filename="${matched.fileName}"`);
    }
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    res.sendFile(matched.fullPath);
  };

  const generatePlayStoreAssetsZipBuffer = () => {
    const zip = new AdmZip();
    const assetsDir = path.join(process.cwd(), "public", "assets");
    const h4096Jpg = path.join(assetsDir, "google_play_header_4096x2304.jpg");
    const h4096Png = path.join(assetsDir, "google_play_header_4096x2304.png");
    const f1024Png = path.join(assetsDir, "google_play_feature_1024x500.png");
    if (fs.existsSync(h4096Jpg)) zip.addLocalFile(h4096Jpg);
    if (fs.existsSync(h4096Png)) zip.addLocalFile(h4096Png);
    if (fs.existsSync(f1024Png)) zip.addLocalFile(f1024Png);
    return zip.toBuffer();
  };

  const generateExpoZipBuffer = () => {
    const zip = new AdmZip();

    // 1. Add app directory files to both root 'app' and 'src/app' (so either Expo Router layout works effortlessly)
    const appDir = path.join(process.cwd(), "app");
    if (fs.existsSync(appDir)) {
      zip.addLocalFolder(appDir, "app");
      zip.addLocalFolder(appDir, "src/app");
    }

    // Add components and utils at root and in src/ for projects not using Expo Router subfolders
    const componentsDir = path.join(process.cwd(), "app", "components");
    if (fs.existsSync(componentsDir)) {
      zip.addLocalFolder(componentsDir, "components");
      zip.addLocalFolder(componentsDir, "src/components");
    }
    const utilsDir = path.join(process.cwd(), "app", "utils");
    if (fs.existsSync(utilsDir)) {
      zip.addLocalFolder(utilsDir, "utils");
      zip.addLocalFolder(utilsDir, "src/utils");
    }

    // 2. Add package.json configured for Expo
    const expoPackageJson = {
      name: "expo-rf-coordinator",
      version: "1.0.0",
      main: "expo-router/entry",
      scripts: {
        start: "expo start",
        android: "expo start --android",
        ios: "expo start --ios",
        web: "expo start --web"
      },
      dependencies: {
        "@react-native-async-storage/async-storage": "^2.1.2",
        "expo": "~52.0.37",
        "expo-asset": "~11.0.4",
        "expo-constants": "~17.0.7",
        "expo-linking": "~7.0.5",
        "expo-router": "~4.0.17",
        "expo-status-bar": "~2.0.1",
        "react": "18.3.1",
        "react-dom": "18.3.1",
        "react-native": "0.76.7",
        "react-native-svg": "15.8.0",
        "react-native-web": "~0.19.13",
        "@expo/metro-runtime": "~4.0.1",
        "lucide-react": "^1.16.0"
      },
      devDependencies: {
        "@babel/core": "^7.25.2",
        "@types/react": "~18.3.12",
        "typescript": "^5.3.3"
      },
      private: true
    };
    zip.addFile("package.json", Buffer.from(JSON.stringify(expoPackageJson, null, 2), "utf8"));

    // 3. Add app.json for Expo
    const expoAppJson = {
      expo: {
        name: "RF Frequency Coordinator",
        slug: "expo-rf-coordinator",
        scheme: "expo-rf-coordinator",
        version: "1.0.1",
        orientation: "portrait",
        userInterfaceStyle: "dark",
        newArchEnabled: true,
        plugins: ["expo-router"],
        splash: {
          backgroundColor: "#020617"
        },
        ios: {
          supportsTablet: true,
          bundleIdentifier: "com.rffrequencycoordinator.app"
        },
        android: {
          package: "com.rffrequencycoordinator.app",
          versionCode: 2,
          adaptiveIcon: {
            backgroundColor: "#020617"
          }
        },
        web: {
          bundler: "metro"
        }
      }
    };
    zip.addFile("app.json", Buffer.from(JSON.stringify(expoAppJson, null, 2), "utf8"));

    // 3b. Add eas.json for Google Play (.aab) cloud builds
    const easJson = {
      cli: {
        version: ">= 12.0.0"
      },
      build: {
        development: {
          developmentClient: true,
          distribution: "internal"
        },
        preview: {
          distribution: "internal"
        },
        production: {
          android: {
            buildType: "app-bundle"
          }
        }
      },
      submit: {
        production: {}
      }
    };
    zip.addFile("eas.json", Buffer.from(JSON.stringify(easJson, null, 2), "utf8"));

    // 4. Add babel.config.js
    const babelConfig = `module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
`;
    zip.addFile("babel.config.js", Buffer.from(babelConfig, "utf8"));

    // 5. Add metro.config.js
    const metroConfig = `const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
`;
    zip.addFile("metro.config.js", Buffer.from(metroConfig, "utf8"));

    // 6. Add tsconfig.json
    const expoTsConfig = {
      extends: "expo/tsconfig.base",
      compilerOptions: {
        strict: true
      }
    };
    zip.addFile("tsconfig.json", Buffer.from(JSON.stringify(expoTsConfig, null, 2), "utf8"));

    // 7. Add README.md with clear instructions
    const readmeContent = `# RF Frequency Coordinator (Expo & Google Play Ready)

## 1. Quick Start (Run Locally):
\`\`\`bash
npm install
npx expo start
\`\`\`
Press **'w'** in your terminal to open in web browser, or scan the QR code with Expo Go on your mobile device!

---

## 2. Build for Google Play Store (Production .AAB Bundle):

### Step A: Build with Expo EAS
1. Install EAS CLI (if not already installed):
   \`\`\`bash
   npm install -g eas-cli
   \`\`\`
2. Login to your Expo account:
   \`\`\`bash
   npx eas login
   \`\`\`
3. Trigger the Android App Bundle build:
   \`\`\`bash
   npx eas build --platform android --profile production
   \`\`\`
4. When finished, EAS CLI will output a direct link to download your **.aab** file.

---

## 3. Upload to Google Play Console:
1. Open the [Google Play Console](https://play.google.com/console).
2. Select your application.
3. In the left navigation, go to **Release** > **Production** (or **Internal testing** / **Closed testing**).
4. Click **Create new release** in the top-right corner.
5. In the **App bundles** section, upload the downloaded **.aab** file.
6. Enter release notes (e.g. "Smart zone auto-numbering, improved spectrum analyzer, and stability fixes").
7. Click **Next**, review the release summary, and click **Start rollout to Production**!
`;
    zip.addFile("README.md", Buffer.from(readmeContent, "utf8"));

    return zip.toBuffer();
  };

  // Serve generated static assets
  app.use('/assets', express.static(path.join(process.cwd(), 'public', 'assets')));
  app.use('/public/assets', express.static(path.join(process.cwd(), 'public', 'assets')));
  app.use('/public', express.static(path.join(process.cwd(), 'public')));
  app.use('/src/assets/images', express.static(path.join(process.cwd(), 'src', 'assets', 'images')));
  app.use('/assets/images', express.static(path.join(process.cwd(), 'src', 'assets', 'images')));

  // Dedicated Play Store Graphics Downloader & Preview Page
  app.get(["/playstore-assets", "/google-play-assets", "/download-images", "/store-images", "/header-images"], (req, res) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Google Play Store Header & Feature Graphics</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #090d16;
      color: #f1f5f9;
      padding: 32px 16px;
      line-height: 1.6;
    }
    .container {
      max-width: 960px;
      margin: 0 auto;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 12px;
      padding: 16px 24px;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #34d399;
      font-weight: 700;
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .btn-bundle {
      background: #059669;
      color: #fff;
      text-decoration: none;
      font-weight: 800;
      font-size: 14px;
      padding: 10px 20px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: background 0.15s;
    }
    .btn-bundle:hover {
      background: #047857;
    }
    .card {
      background: #111827;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .card-title {
      font-size: 20px;
      font-weight: 800;
      color: #38bdf8;
      margin-bottom: 8px;
    }
    .card-meta {
      font-size: 14px;
      color: #94a3b8;
      margin-bottom: 16px;
    }
    .preview-box {
      width: 100%;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #334155;
      background: #020617;
      margin-bottom: 16px;
      position: relative;
    }
    .preview-img {
      width: 100%;
      height: auto;
      display: block;
      max-height: 400px;
      object-fit: contain;
      background: #020617;
    }
    .button-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .btn-dl {
      background: #0284c7;
      color: #ffffff;
      border: none;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: background 0.15s;
    }
    .btn-dl:hover {
      background: #0369a1;
    }
    .btn-secondary {
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #334155;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.15s;
    }
    .btn-secondary:hover {
      background: #334155;
      color: #ffffff;
    }
    .instructions-box {
      background: #0f172a;
      border: 1px solid #1e3a5f;
      border-radius: 12px;
      padding: 20px;
      margin-top: 24px;
    }
    .instructions-title {
      font-size: 16px;
      font-weight: 800;
      color: #f8fafc;
      margin-bottom: 10px;
    }
    .instructions-list {
      padding-left: 20px;
      font-size: 14px;
      color: #cbd5e1;
      line-height: 1.7;
    }
    .instructions-list li {
      margin-bottom: 6px;
    }
    .toast {
      display: none;
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #10b981;
      color: #ffffff;
      font-weight: 700;
      font-size: 14px;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
      z-index: 100;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-bar">
      <div>
        <div class="badge">Google Play Store Ready</div>
        <h1 style="font-size: 22px; font-weight: 800; margin-top: 4px; color: #f8fafc;">RF Frequency Suite Graphic Assets</h1>
      </div>
      <a class="btn-bundle" href="/download/playstore-assets.zip" download="Google_Play_Header_and_Feature_Graphics.zip">
        📦 Download All Assets (.ZIP)
      </a>
    </div>

    <!-- 4096 x 2304 Header Graphic -->
    <div class="card">
      <h2 class="card-title">1. High-Resolution Header Banner (4096 × 2304 px)</h2>
      <p class="card-meta">Exact 16:9 Ultra-HD aspect ratio formatted for top store banners, featured developer spots, and promotional listings.</p>
      
      <div class="preview-box">
        <img class="preview-img" src="/assets/google_play_header_4096x2304.jpg" alt="Google Play Header 4096x2304" referrerpolicy="no-referrer">
      </div>

      <div class="button-row">
        <button class="btn-dl" onclick="downloadViaBlob('/assets/google_play_header_4096x2304.jpg', 'google_play_header_4096x2304.jpg')">
          ⬇ Download 4096×2304 JPG (~850 KB)
        </button>
        <button class="btn-dl" style="background: #047857;" onclick="downloadViaBlob('/assets/google_play_header_4096x2304.png', 'google_play_header_4096x2304.png')">
          ⬇ Download 4096×2304 PNG (Lossless)
        </button>
        <a class="btn-secondary" href="/assets/google_play_header_4096x2304.jpg" target="_blank" rel="noopener">
          👁 View Full Size Image
        </a>
      </div>
    </div>

    <!-- 1024 x 500 Feature Graphic -->
    <div class="card">
      <h2 class="card-title">2. Google Play Feature Graphic (1024 × 500 px)</h2>
      <p class="card-meta">Mandatory official dimension required by the Google Play Console for your Main Store Listing.</p>
      
      <div class="preview-box">
        <img class="preview-img" src="/assets/google_play_feature_1024x500.png" alt="Google Play Feature 1024x500" referrerpolicy="no-referrer">
      </div>

      <div class="button-row">
        <button class="btn-dl" onclick="downloadViaBlob('/assets/google_play_feature_1024x500.png', 'google_play_feature_1024x500.png')">
          ⬇ Download 1024×500 PNG (~870 KB)
        </button>
        <a class="btn-secondary" href="/assets/google_play_feature_1024x500.png" target="_blank" rel="noopener">
          👁 View Full Size Image
        </a>
      </div>
    </div>

    <!-- How to Save on Mobile & Desktop -->
    <div class="instructions-box">
      <h3 class="instructions-title">💡 How to Save to Your Device Hard Drive or Phone:</h3>
      <ul class="instructions-list">
        <li><strong>On Computer (Mac / Windows / Linux):</strong> Click any of the blue <em>Download</em> buttons above. If prompted, choose your preferred folder (e.g. Downloads or Desktop).</li>
        <li><strong>On Phone (iOS / Android):</strong> Tap the <em>Download</em> button to save to your Files/Downloads folder. Alternatively, tap <em>View Full Size Image</em>, then tap and hold (long-press) the image and select <strong>"Save to Photos"</strong> or <strong>"Download Image"</strong>.</li>
        <li><strong>Google Play Console Upload:</strong> In the Play Console, go to <strong>Grow → Store presence → Main store listing → Feature graphic</strong> and upload the 1024×500 px PNG.</li>
      </ul>
    </div>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.style.display = 'block';
      setTimeout(() => { t.style.display = 'none'; }, 3500);
    }

    async function downloadViaBlob(url, filename) {
      showToast('⏳ Preparing ' + filename + ' download...');
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Fetch failed with status ' + res.status);
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
        showToast('✅ Saved ' + filename + ' to your device!');
      } catch (err) {
        console.error('Blob download fallback triggered:', err);
        // Fallback: direct navigation with attachment header
        const fallbackLink = document.createElement('a');
        fallbackLink.href = '/download/' + filename;
        fallbackLink.download = filename;
        fallbackLink.target = '_blank';
        document.body.appendChild(fallbackLink);
        fallbackLink.click();
        document.body.removeChild(fallbackLink);
      }
    }
  </script>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });

  // App Store & Google Play Introduction Showcase Page (Mockup & What It Does)
  app.get(["/about", "/intro", "/store-mockup", "/showcase", "/rfsuite"], (req, res) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RF Coordinator • Official App Store & Google Play Showcase</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #090d16;
      color: #f1f5f9;
      padding: 32px 16px;
      line-height: 1.6;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    .badge-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 12px;
      padding: 12px 20px;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .rfsuite-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.35);
      padding: 6px 14px;
      border-radius: 9999px;
      color: #38bdf8;
      font-weight: 800;
      font-size: 13px;
      letter-spacing: 0.5px;
    }
    .rfsuite-link {
      color: #38bdf8;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: color 0.15s;
    }
    .rfsuite-link:hover {
      color: #7dd3fc;
      text-decoration: underline;
    }
    .launch-app-btn {
      background: #0284c7;
      color: #fff;
      text-decoration: none;
      font-weight: 700;
      font-size: 13px;
      padding: 8px 18px;
      border-radius: 8px;
      transition: background 0.15s;
    }
    .launch-app-btn:hover {
      background: #0369a1;
    }
    .hero-card {
      background: #111827;
      border: 1px solid #1e293b;
      border-radius: 16px;
      overflow: hidden;
      margin-bottom: 32px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .hero-image-wrap {
      width: 100%;
      height: 380px;
      position: relative;
      background: #020617;
    }
    .hero-image-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .hero-content {
      padding: 32px;
    }
    .app-title-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .app-title {
      font-size: 28px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: -0.5px;
    }
    .app-subtitle {
      font-size: 16px;
      color: #94a3b8;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .store-downloads-row {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      margin-bottom: 28px;
    }
    .store-btn {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      background: #020617;
      border: 1px solid #334155;
      padding: 10px 20px;
      border-radius: 10px;
      color: #ffffff;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      transition: border-color 0.15s, transform 0.1s;
    }
    .store-btn:hover {
      border-color: #38bdf8;
      transform: translateY(-2px);
    }
    .store-btn-sub {
      font-size: 10px;
      color: #94a3b8;
      text-transform: uppercase;
      font-weight: 600;
    }
    .grid-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 32px;
    }
    @media (max-width: 768px) {
      .grid-2col { grid-template-columns: 1fr; }
      .hero-image-wrap { height: 220px; }
    }
    .feature-card {
      background: #111827;
      border: 1px solid #1e293b;
      border-radius: 14px;
      padding: 24px;
    }
    .feature-icon {
      font-size: 32px;
      margin-bottom: 12px;
    }
    .feature-heading {
      font-size: 18px;
      font-weight: 800;
      color: #38bdf8;
      margin-bottom: 8px;
    }
    .feature-text {
      font-size: 14px;
      color: #cbd5e1;
      line-height: 1.6;
    }
    .rfsuite-spotlight {
      background: linear-gradient(135deg, #0c1a2d 0%, #0f172a 100%);
      border: 1px solid #1e3a5f;
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 32px;
      position: relative;
    }
    .rfsuite-spotlight-title {
      font-size: 22px;
      font-weight: 900;
      color: #ffffff;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .rfsuite-spotlight-text {
      color: #cbd5e1;
      font-size: 15px;
      margin-bottom: 20px;
      line-height: 1.7;
    }
    .button-group {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .btn-primary {
      background: #0284c7;
      color: #fff;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 800;
      font-size: 14px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: background 0.15s;
    }
    .btn-primary:hover { background: #0369a1; }
    .btn-outline {
      background: #1e293b;
      color: #e2e8f0;
      border: 1px solid #334155;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 14px;
      transition: background 0.15s;
    }
    .btn-outline:hover { background: #334155; }
    .footer {
      text-align: center;
      font-size: 13px;
      color: #64748b;
      padding: 24px 0;
      border-top: 1px solid #1e293b;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Top Association Badge Bar -->
    <div class="badge-bar">
      <div class="rfsuite-badge">
        <span>🌐</span> IN ASSOCIATION WITH RFSUITE.NET
      </div>
      <div>
        <a class="rfsuite-link" href="https://rfsuite.net" target="_blank" rel="noopener">Visit rfsuite.net Website ↗</a>
      </div>
      <div>
        <a class="launch-app-btn" href="/">🚀 Open Web App</a>
      </div>
    </div>

    <!-- Main App Store Style Hero Card -->
    <div class="hero-card">
      <div class="hero-image-wrap">
        <img src="/assets/google_play_header_4096x2304.jpg" alt="RF Multi-Zone Coordination Hero Graphic" referrerpolicy="no-referrer">
      </div>
      <div class="hero-content">
        <div class="app-title-row">
          <div>
            <h1 class="app-title">RF Multi-Zone Frequency Coordinator</h1>
            <p class="app-subtitle">Zero-bleed talkback & wireless audio coordination for outside broadcasts, film sets, festivals, and live theatre.</p>
          </div>
        </div>

        <!-- Store Badges -->
        <div class="store-downloads-row">
          <div class="store-btn">
            <span style="font-size: 24px;">🍎</span>
            <div>
              <div class="store-btn-sub">Designed for</div>
              <div>iOS / iPadOS App Store</div>
            </div>
          </div>
          <div class="store-btn">
            <span style="font-size: 24px;">🤖</span>
            <div>
              <div class="store-btn-sub">Designed for</div>
              <div>Google Play Store</div>
            </div>
          </div>
          <a class="store-btn" href="/download-page" style="border-color: #0284c7;">
            <span style="font-size: 24px;">💻</span>
            <div>
              <div class="store-btn-sub">Developer Hub</div>
              <div>Download Source Files</div>
            </div>
          </a>
        </div>
      </div>
    </div>

    <!-- Spotlight: Association with RFSuite.net -->
    <div class="rfsuite-spotlight">
      <h2 class="rfsuite-spotlight-title">
        <span>🌐</span> Official Collaboration with rfsuite.net
      </h2>
      <p class="rfsuite-spotlight-text">
        This mobile coordination app was created in association with <strong>rfsuite.net</strong> — the recognized industry reference platform for RF frequency planning, wireless audio management, and spectrum engineering.
      </p>
      <p class="rfsuite-spotlight-text">
        By deploying the proven algorithms of <strong>rfsuite.net</strong> into an offline-first, native-speed mobile architecture, sound recordists and RF technicians gain instant access to professional frequency planning tools right on set in OB trucks, stages, and gantry platforms.
      </p>
      <div class="button-group">
        <a class="btn-primary" href="https://rfsuite.net" target="_blank" rel="noopener">
          Explore rfsuite.net ↗
        </a>
        <a class="btn-outline" href="/">
          Launch Coordinator App
        </a>
      </div>
    </div>

    <!-- What The App Does: Visual 4-Pillar Grid -->
    <div class="grid-2col">
      <div class="feature-card">
        <div class="feature-icon">📐</div>
        <h3 class="feature-heading">1. Spatial Multi-Zone Matrix</h3>
        <p class="feature-text">
          Coordinates multiple independent production zones simultaneously. Calculates 26-meter physical proximity coupling and enforces &ge; 25 kHz same-zone channel separation with 0 adjacent filter bleed.
        </p>
      </div>

      <div class="feature-card">
        <div class="feature-icon">🛡️</div>
        <h3 class="feature-heading">2. Zero-Bleed IMD Elimination</h3>
        <p class="feature-text">
          Calculates 2-Tx and 3-Tx third-order intermodulation products (2A-B and A+B-C) in real-time across both Base Transmitter and Portable Receiver paths to prevent front-end desense.
        </p>
      </div>

      <div class="feature-card">
        <div class="feature-icon">📻</div>
        <h3 class="feature-heading">3. Dedicated UK Bands & Custom Splits</h3>
        <p class="feature-text">
          Built-in presets for Ofcom Dedicated 455/468 MHz and 457/467 MHz talkback pairs, continuous IFBs, and Walkie channels, plus full support for user-defined custom MHz ranges.
        </p>
      </div>

      <div class="feature-card">
        <div class="feature-icon">📊</div>
        <h3 class="feature-heading">4. Tactical Spectrum & 2D Stage Canvas</h3>
        <p class="feature-text">
          Interactive draggable zone placement on physical arena decks, live carrier spike monitoring, active PTT burst simulation, and instant crew call sheet generation.
        </p>
      </div>
    </div>

    <!-- Secondary Visual Diagram Card -->
    <div class="hero-card" style="padding: 24px; background: #0f172a;">
      <h3 style="font-size: 18px; font-weight: 800; color: #f8fafc; margin-bottom: 12px;">Multi-Zone Spatial Propagation & Coupling</h3>
      <img src="/src/assets/images/rf_zones_graphic_1790003778507.jpg" alt="RF Zone Spatial Graphic" style="width: 100%; height: 260px; object-fit: cover; border-radius: 10px; border: 1px solid #1e293b; margin-bottom: 12px;" referrerpolicy="no-referrer">
      <p style="font-size: 13px; color: #94a3b8; text-align: center;">Spatial Inverse-Square Thresholding: Automatically enables safe frequency reuse across isolated zones while locking coupled zones to prevent interference.</p>
    </div>

    <div class="footer">
      Created in association with <a href="https://rfsuite.net" target="_blank" rel="noopener" style="color: #38bdf8; text-decoration: none;">rfsuite.net</a> • Available for iOS & Android
    </div>
  </div>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });

  // Dedicated Privacy Policy Route compliant with Google Play Console requirements
  app.get(["/privacy", "/privacy-policy", "/privacy.html"], (req, res) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy • TalkbackApp</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #090d16;
      color: #e2e8f0;
      padding: 40px 20px;
      line-height: 1.7;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 36px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .header {
      border-bottom: 1px solid #1e293b;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 26px;
      font-weight: 800;
      color: #38bdf8;
      margin-bottom: 8px;
    }
    .date {
      font-size: 13px;
      color: #94a3b8;
    }
    h2 {
      font-size: 18px;
      font-weight: 700;
      color: #f1f5f9;
      margin-top: 24px;
      margin-bottom: 10px;
    }
    p, ul {
      font-size: 15px;
      color: #cbd5e1;
      margin-bottom: 14px;
    }
    ul {
      padding-left: 20px;
    }
    li {
      margin-bottom: 6px;
    }
    .highlight-box {
      background: rgba(56, 189, 248, 0.1);
      border-left: 4px solid #38bdf8;
      padding: 14px 18px;
      border-radius: 6px;
      margin: 20px 0;
      font-size: 14px;
      color: #e2e8f0;
    }
    .footer-note {
      margin-top: 32px;
      padding-top: 20px;
      border-top: 1px solid #1e293b;
      font-size: 13px;
      color: #64748b;
      text-align: center;
    }
    a {
      color: #38bdf8;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>TalkbackApp Privacy Policy</h1>
      <div class="date">Last updated: September 23, 2026 • Effective Date: September 23, 2026</div>
    </div>

    <div class="highlight-box">
      <strong>Summary:</strong> TalkbackApp is an offline engineering tool. We do not collect, store, transmit, track, or share any personal data, location data, or device identifiers. All RF calculations and channel plans remain 100% private on your device.
    </div>

    <h2>1. Introduction</h2>
    <p>
      TalkbackApp ("the App", "we", "us", or "our") is a specialized radio frequency coordination and intercom planning application developed for broadcast audio engineers, comms crew, and live event production professionals. We are committed to protecting your privacy.
    </p>

    <h2>2. Data Collection and Usage</h2>
    <p>
      TalkbackApp does not collect any personal data or usage metrics:
    </p>
    <ul>
      <li><strong>No Account Required:</strong> You do not need to register, create an account, or log in to use the App.</li>
      <li><strong>No Personal Information:</strong> We do not ask for or collect names, email addresses, phone numbers, or billing details inside the mobile application.</li>
      <li><strong>No Telemetry or Analytics:</strong> We do not embed 3rd-party analytics SDKs, advertising trackers, or telemetry tools.</li>
      <li><strong>No Location Data:</strong> The App does not access, request, or record your physical GPS or network location.</li>
    </ul>

    <h2>3. Local Device Storage</h2>
    <p>
      Any talkback profiles, frequency presets, zone configurations, or project parameters you create are saved locally on your device storage (via sandboxed application cache). This data is never transmitted to any external server or third party.
    </p>

    <h2>4. Children's Privacy</h2>
    <p>
      The App is intended for professional broadcast and sound engineering workflows and is not directed to individuals under the age of 18. We do not knowingly collect personal information from children.
    </p>

    <h2>5. Changes to This Privacy Policy</h2>
    <p>
      We may update our Privacy Policy periodically. Any updates will be posted to this page with an updated revision date.
    </p>

    <h2>6. Contact Us</h2>
    <p>
      If you have questions, feedback, or inquiries regarding this Privacy Policy or the TalkbackApp application, please contact us at:
    </p>
    <ul>
      <li><strong>Email:</strong> <a href="mailto:dvitalis1969@gmail.com">dvitalis1969@gmail.com</a></li>
      <li><strong>Associated Website:</strong> <a href="https://rfsuite.net" target="_blank" rel="noopener">rfsuite.net</a></li>
    </ul>

    <div class="footer-note">
      © 2026 TalkbackApp • In association with rfsuite.net • All Rights Reserved.
    </div>
  </div>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });

  // Dedicated Interactive Browser Code Viewer for index.tsx
  app.get(["/view-index", "/code-viewer", "/index-viewer", "/view-code", "/code", "/source"], (req, res) => {
    const indexPath = path.join(process.cwd(), "index.tsx");
    let content = "";
    let stats = { size: 0, lines: 0 };
    if (fs.existsSync(indexPath)) {
      content = fs.readFileSync(indexPath, "utf8");
      stats.size = Buffer.byteLength(content, "utf8");
      stats.lines = content.split("\n").length;
    }

    // Escape HTML special characters for safe embedding inside textarea / pre
    const escapedContent = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>index.tsx • Dedicated Source Viewer & Direct Download</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #030712;
      color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .topbar {
      background: #111827;
      border-bottom: 1px solid #1f2937;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      z-index: 10;
    }
    .file-title-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .file-badge {
      background: #0284c7;
      color: #ffffff;
      font-weight: 800;
      font-size: 11px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .file-name {
      font-size: 17px;
      font-weight: 700;
      color: #38bdf8;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .file-meta {
      font-size: 13px;
      color: #9ca3af;
    }
    .btn-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s ease;
      border: none;
    }
    .btn-primary {
      background: #0284c7;
      color: #ffffff;
    }
    .btn-primary:hover {
      background: #0369a1;
      transform: translateY(-1px);
    }
    .btn-success {
      background: #059669;
      color: #ffffff;
    }
    .btn-success:hover {
      background: #047857;
    }
    .btn-secondary {
      background: #374151;
      color: #e5e7eb;
    }
    .btn-secondary:hover {
      background: #4b5563;
      color: #ffffff;
    }
    .editor-container {
      flex: 1;
      position: relative;
      background: #080c14;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .code-box {
      width: 100%;
      height: 100%;
      background: #080c14;
      color: #e2e8f0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 13px;
      line-height: 1.5;
      padding: 16px 20px;
      border: none;
      outline: none;
      resize: none;
      white-space: pre;
      overflow: auto;
      tab-size: 2;
    }
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #10b981;
      color: #ffffff;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 14px;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5);
      display: none;
      z-index: 100;
    }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="file-title-group">
      <span class="file-badge">STANDALONE SOURCE</span>
      <span class="file-name">index.tsx</span>
      <span class="file-meta">(${stats.lines.toLocaleString()} lines • ${(stats.size / 1024).toFixed(1)} KB)</span>
    </div>
    <div class="btn-actions">
      <button class="btn btn-secondary" onclick="copyFullSource()">📋 Copy Entire File</button>
      <button class="btn btn-primary" onclick="downloadDirect()">⬇️ Download index.tsx</button>
      <a class="btn btn-secondary" href="/raw/index.txt" target="_blank" rel="noopener noreferrer">📄 View Raw Text</a>
      <a class="btn btn-success" href="/download/expo-project.zip" download="expo-rf-coordinator.zip">📦 Download Expo ZIP</a>
    </div>
  </div>

  <div class="editor-container">
    <textarea id="sourceCode" class="code-box" readonly spellcheck="false">${escapedContent}</textarea>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.style.display = 'block';
      setTimeout(() => { t.style.display = 'none'; }, 3000);
    }

    function copyFullSource() {
      const el = document.getElementById('sourceCode');
      el.select();
      navigator.clipboard.writeText(el.value).then(() => {
        showToast('✅ Copied all ' + el.value.length.toLocaleString() + ' characters to clipboard!');
      }).catch(err => {
        document.execCommand('copy');
        showToast('✅ Copied to clipboard!');
      });
    }

    function downloadDirect() {
      const text = document.getElementById('sourceCode').value;
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'index.tsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast('✅ index.tsx downloaded to your laptop!');
    }
  </script>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.send(html);
  });

  // Interactive browser download web page that opens in a clean window and provides 1-click download buttons
  app.get(["/download-page", "/download-portal", "/files", "/downloads", "/get-files", "/download.html"], (req, res) => {
    const autoDownload = req.query.download as string || '';
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Download Project Files - RF Coordinator</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0b0f19;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 14px;
      max-width: 680px;
      width: 100%;
      padding: 32px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-block;
      background: rgba(14, 165, 233, 0.15);
      color: #38bdf8;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 9999px;
      border: 1px solid rgba(14, 165, 233, 0.3);
      margin-bottom: 16px;
    }
    h1 {
      font-size: 24px;
      font-weight: 800;
      color: #f8fafc;
      margin-bottom: 8px;
    }
    p.desc {
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .file-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 24px;
    }
    .file-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 14px 16px;
      gap: 12px;
      transition: border-color 0.15s ease;
    }
    .file-item:hover {
      border-color: #38bdf8;
    }
    .file-info {
      display: flex;
      flex-direction: column;
      gap: 3px;
      flex: 1;
    }
    .file-name {
      font-weight: 700;
      font-size: 15px;
      color: #38bdf8;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .file-meta {
      font-size: 12px;
      color: #94a3b8;
    }
    .btn-group {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-shrink: 0;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #0284c7;
      color: #ffffff;
      text-decoration: none;
      font-weight: 700;
      font-size: 13px;
      padding: 9px 14px;
      border-radius: 6px;
      transition: background 0.15s ease, transform 0.1s ease;
      cursor: pointer;
      border: none;
      white-space: nowrap;
    }
    .btn:hover {
      background: #0369a1;
    }
    .btn:active {
      transform: scale(0.98);
    }
    .btn-copy {
      background: #334155;
      color: #e2e8f0;
    }
    .btn-copy:hover {
      background: #475569;
      color: #ffffff;
    }
    .btn-zip {
      background: #059669;
    }
    .btn-zip:hover {
      background: #047857;
    }
    .toast {
      display: none;
      position: fixed;
      bottom: 24px;
      background: #10b981;
      color: #ffffff;
      font-weight: 700;
      font-size: 14px;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
    }
    .footer {
      font-size: 12px;
      color: #64748b;
      text-align: center;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Direct Browser Download & VS Code Export</div>
    <h1>RF Coordinator Project Files</h1>
    <p class="desc">Click <strong>Download</strong> to save the file to your computer's Downloads folder, or click <strong>Copy Code</strong> to copy the complete source directly for pasting into VS Code.</p>
    
    <div class="file-list">
      <!-- rfMath.ts -->
      <div class="file-item">
        <div class="file-info">
          <span class="file-name">rfMath.ts</span>
          <span class="file-meta">Core RF Coordination Math Engine & Distance Matrix</span>
        </div>
        <div class="btn-group">
          <button class="btn btn-copy" onclick="copyFile('/download/rfMath.ts', 'rfMath.ts')">📋 Copy Code</button>
          <a class="btn" id="dl-rfmath" href="/download/rfMath.ts" download="rfMath.ts">⬇ Download</a>
        </div>
      </div>

      <!-- index.tsx (TypeScript / JSX) -->
      <div class="file-item" style="border: 2px solid #0284c7; background: #082f49;">
        <div class="file-info">
          <span class="file-name" style="color: #38bdf8; font-size: 16px;">index.tsx (100% Pure React Native • Single All-In-One File)</span>
          <span class="file-meta" style="color: #bae6fd;">Directly drop into your VS Code app/ directory. Pure React Native with zero missing imports, zero web DOM errors, and zero relative file dependencies. Works out of the box with standard Expo.</span>
        </div>
        <div class="btn-group">
          <button class="btn btn-copy" onclick="copyFile('/download/index.tsx', 'index.tsx')">📋 Copy Code</button>
          <a class="btn" id="dl-indextsx" href="/download/index.tsx" download="index.tsx">⬇ Download index.tsx</a>
        </div>
      </div>

      <!-- radio-mic-planner.tsx (Radio Mic and IEM Planner) -->
      <div class="file-item" style="border: 2px solid #8b5cf6; background: #2e1065;">
        <div class="file-info">
          <span class="file-name" style="color: #c084fc; font-size: 16px;">radio-mic-planner.tsx (Radio Mic & IEM Planner • Pure React Native)</span>
          <span class="file-meta" style="color: #e9d5ff;">Microphone and In-Ear Monitor (IEM) coordination app with tactical spectrum analyzer display, intermod calculations, TV white space exclusions, and WWB export.</span>
        </div>
        <div class="btn-group">
          <button class="btn btn-copy" onclick="copyFile('/download/radio-mic-planner.tsx', 'radio-mic-planner.tsx')">📋 Copy Code</button>
          <a class="btn" id="dl-radiomicplanner" href="/download/radio-mic-planner.tsx" download="radio-mic-planner.tsx" style="background: #7c3aed;">⬇ Download radio-mic-planner.tsx</a>
        </div>
      </div>

      <!-- index.txt (Plain text format) -->
      <div class="file-item">
        <div class="file-info">
          <span class="file-name">index.txt (Encapsulated Raw Text)</span>
          <span class="file-meta">Plain text equivalent of the encapsulated index.tsx (easy paste in case of file extension filter)</span>
        </div>
        <div class="btn-group">
          <button class="btn btn-copy" onclick="copyFile('/download/index.txt', 'index.txt')">📋 Copy Code</button>
          <a class="btn" id="dl-indextxt" href="/download/index.txt" download="index.txt">⬇ Download index.txt</a>
        </div>
      </div>

      <!-- Complete Project ZIP -->
      <div class="file-item">
        <div class="file-info">
          <span class="file-name">expo-rf-coordinator.zip</span>
          <span class="file-meta">Complete turnkey Expo project with configs and all components</span>
        </div>
        <div class="btn-group">
          <a class="btn btn-zip" id="dl-zip" href="/download/expo-project.zip" download="expo-rf-coordinator.zip">📦 Download ZIP</a>
        </div>
      </div>

      <!-- Google Play Header Banner 4096x2304 px -->
      <div class="file-item" style="border: 2px solid #10b981; background: #064e3b22;">
        <div class="file-info">
          <span class="file-name" style="color: #34d399;">google_play_header_4096x2304.jpg (4096 × 2304 px • Ultra HD Header)</span>
          <span class="file-meta">High-resolution banner graphic sized at exactly 4096 × 2304 px for Google Play Store app page</span>
        </div>
        <div class="btn-group">
          <a class="btn" style="background: #059669;" href="/assets/google_play_header_4096x2304.jpg" download="google_play_header_4096x2304.jpg">⬇ JPG (4096x2304)</a>
          <a class="btn" style="background: #047857;" href="/assets/google_play_header_4096x2304.png" download="google_play_header_4096x2304.png">⬇ PNG (4096x2304)</a>
        </div>
      </div>

      <!-- Google Play Standard Feature Graphic 1024x500 px -->
      <div class="file-item">
        <div class="file-info">
          <span class="file-name">google_play_feature_1024x500.png (1024 × 500 px • Official Console Spec)</span>
          <span class="file-meta">Standard required dimensions for Google Play Console feature graphic upload</span>
        </div>
        <div class="btn-group">
          <a class="btn" href="/assets/google_play_feature_1024x500.png" download="google_play_feature_1024x500.png">⬇ PNG (1024x500)</a>
        </div>
      </div>
    </div>

    <div class="footer">
      Generated by RF Frequency Coordinator Suite • Ready for VS Code
    </div>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.style.display = 'block';
      setTimeout(() => { t.style.display = 'none'; }, 2500);
    }

    async function copyFile(url, filename) {
      try {
        const res = await fetch(url);
        const text = await res.text();
        await navigator.clipboard.writeText(text);
        showToast('✅ Copied ' + filename + ' to clipboard! Paste into VS Code.');
      } catch (err) {
        showToast('❌ Failed to copy automatically. Please click Download.');
      }
    }

    // Auto download trigger if query param provided
    window.addEventListener('DOMContentLoaded', () => {
      const auto = "${autoDownload}";
      if (auto === 'rfMath.ts') {
        document.getElementById('dl-rfmath')?.click();
      } else if (auto === 'index.tsx') {
        document.getElementById('dl-indextsx')?.click();
      } else if (auto === 'index.txt') {
        document.getElementById('dl-indextxt')?.click();
      } else if (auto === 'zip') {
        document.getElementById('dl-zip')?.click();
      }
    });
  </script>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });

  // ZIP Download Endpoints for Expo
  app.get(["/download/expo-project.zip", "/download/expo.zip", "/download/project.zip", "/download/expo-rf-coordinator.zip"], (req, res) => {
    try {
      const buffer = generateExpoZipBuffer();
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", 'attachment; filename="expo-rf-coordinator.zip"');
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.send(buffer);
    } catch (e: any) {
      res.status(500).send("Error generating Expo ZIP: " + e.message);
    }
  });

  // Google Play Assets Direct Downloads (Single Files & ZIP Bundle)
  app.get(["/download/google_play_header_4096x2304.jpg", "/download/header-4096.jpg", "/download/header.jpg", "/api/download/google_play_header_4096x2304.jpg"], (req, res) => {
    const filePath = path.join(process.cwd(), "public", "assets", "google_play_header_4096x2304.jpg");
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Disposition", 'attachment; filename="google_play_header_4096x2304.jpg"');
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(filePath);
  });

  app.get(["/download/google_play_header_4096x2304.png", "/download/header-4096.png", "/download/header.png", "/api/download/google_play_header_4096x2304.png"], (req, res) => {
    const filePath = path.join(process.cwd(), "public", "assets", "google_play_header_4096x2304.png");
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", 'attachment; filename="google_play_header_4096x2304.png"');
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(filePath);
  });

  app.get(["/download/google_play_feature_1024x500.png", "/download/feature-1024.png", "/download/feature.png", "/api/download/google_play_feature_1024x500.png"], (req, res) => {
    const filePath = path.join(process.cwd(), "public", "assets", "google_play_feature_1024x500.png");
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", 'attachment; filename="google_play_feature_1024x500.png"');
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(filePath);
  });

  app.get(["/download/playstore-assets.zip", "/download/google-play-assets.zip", "/download/header-assets.zip", "/download/images.zip"], (req, res) => {
    try {
      const buffer = generatePlayStoreAssetsZipBuffer();
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", 'attachment; filename="Google_Play_Header_and_Feature_Graphics.zip"');
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.send(buffer);
    } catch (e: any) {
      res.status(500).send("Error generating assets ZIP: " + e.message);
    }
  });

  // Specific and generic download routes in Express 5 (using named wildcards)
  app.get("/download", (req, res) => handleDownloadRequest(req, res, true));
  app.get("/download/*file", (req, res) => handleDownloadRequest(req, res, true));
  app.get("/api/download", (req, res) => handleDownloadRequest(req, res, true));
  app.get("/api/download/*file", (req, res) => handleDownloadRequest(req, res, true));
  app.get("/raw", (req, res) => handleDownloadRequest(req, res, false));
  app.get("/raw/*file", (req, res) => handleDownloadRequest(req, res, false));
  app.get("/api/raw", (req, res) => handleDownloadRequest(req, res, false));
  app.get("/api/raw/*file", (req, res) => handleDownloadRequest(req, res, false));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const staticPath = path.join(process.cwd(), 'dist');
    app.use(express.static(staticPath, {
      setHeaders: (res, path) => {
        // Ensure index.html is never cached so users always get the latest version
        if (path.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));
    app.get('*all', (req, res, next) => {
      if (req.method === 'GET') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(path.join(staticPath, "index.html"));
      } else {
        next();
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
