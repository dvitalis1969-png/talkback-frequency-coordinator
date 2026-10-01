import ReactGA from "react-ga4";

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || "G-JKVY8GR6LW";

// Extend window to include gtag if not already present
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

export const initGA = () => {
  if (MEASUREMENT_ID) {
    // 1. Standard Google Tag initialization
    window.dataLayer = window.dataLayer || [];
    window.gtag = function() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    };

    // 2. Set default consent (v2 compliant)
    window.gtag('consent', 'default', {
      'ad_storage': 'denied',
      'ad_user_data': 'denied',
      'ad_personalization': 'denied',
      'analytics_storage': 'denied',
      'wait_for_update': 500
    });

    // 3. Initialize ReactGA (handles script injection and 'js'/'config' calls)
    ReactGA.initialize(MEASUREMENT_ID, {
      gtagOptions: {
        debug_mode: true
      }
    });

    console.log(`%c[GA] Initialized: ${MEASUREMENT_ID}`, "color: #4f46e5; font-weight: bold;");
    console.log(`%c[GA] Consent state: DENIED (Awaiting user action)`, "color: #f59e0b;");
  } else {
    console.error("[GA] No Measurement ID found. Check VITE_GA_MEASUREMENT_ID environment variable.");
  }
};

export const updateGAConsent = (granted: boolean) => {
  if (window.gtag) {
    window.gtag('consent', 'update', {
      'ad_storage': granted ? 'granted' : 'denied',
      'ad_user_data': granted ? 'granted' : 'denied',
      'ad_personalization': granted ? 'granted' : 'denied',
      'analytics_storage': granted ? 'granted' : 'denied'
    });
    console.log(`%c[GA] Consent Updated: ${granted ? 'GRANTED' : 'DENIED'}`, `color: ${granted ? '#10b981' : '#ef4444'}; font-weight: bold;`);
  }
};

export const logPageView = (path: string) => {
  if (MEASUREMENT_ID) {
    ReactGA.send({ hitType: "pageview", page: path });
  }
};
