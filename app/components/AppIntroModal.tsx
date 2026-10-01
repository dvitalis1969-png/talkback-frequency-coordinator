import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
  Dimensions,
  Image,
} from 'react-native';

interface AppIntroModalProps {
  visible: boolean;
  onClose: () => void;
  onLaunchApp?: () => void;
}

export const AppIntroModal: React.FC<AppIntroModalProps> = ({
  visible,
  onClose,
  onLaunchApp,
}) => {
  const [activeTab, setActiveTab] = useState<'store' | 'features' | 'rfsuite'>('store');
  const [copiedLink, setCopiedLink] = useState(false);

  const openRfSuite = () => {
    Linking.openURL('https://rfsuite.net').catch(() => {
      if (typeof window !== 'undefined') {
        window.open('https://rfsuite.net', '_blank');
      }
    });
  };

  const copyRfSuiteUrl = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText('https://rfsuite.net');
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {/* Header Bar */}
          <View style={styles.headerBar}>
            <View style={styles.headerLeft}>
              <View style={styles.rfSuiteTag}>
                <Text style={styles.rfSuiteTagText}>IN ASSOCIATION WITH RFSUITE.NET</Text>
              </View>
              <Text style={styles.headerTitle}>RF Coordinator • App Overview</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Navigation Tabs */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'store' && styles.tabBtnActive]}
              onPress={() => setActiveTab('store')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'store' && styles.tabBtnTextActive]}>
                📱 App Store Showcase
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'features' && styles.tabBtnActive]}
              onPress={() => setActiveTab('features')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'features' && styles.tabBtnTextActive]}>
                ⚡ What It Does
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'rfsuite' && styles.tabBtnActive]}
              onPress={() => setActiveTab('rfsuite')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'rfsuite' && styles.tabBtnTextActive]}>
                🌐 About rfsuite.net
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            {/* ================= TAB 1: APP STORE SHOWCASE & HERO ================= */}
            {activeTab === 'store' && (
              <View style={styles.tabSection}>
                {/* Hero Banner with Generated Visual */}
                <View style={styles.heroBannerContainer}>
                  <img
                    src="/src/assets/images/rf_intro_hero_1790003764685.jpg"
                    alt="RF Frequency Suite Hero Graphic"
                    referrerPolicy="no-referrer"
                    style={{
                      width: '100%',
                      height: 220,
                      objectFit: 'cover',
                      borderRadius: 12,
                      border: '1px solid #1e293b',
                    }}
                  />
                  <View style={styles.heroOverlay}>
                    <View style={styles.heroPill}>
                      <Text style={styles.heroPillText}>BROADCAST TALKBACK & RF COORDINATION</Text>
                    </View>
                    <Text style={styles.heroMainTitle}>Multi-Zone Frequency Coordinator</Text>
                    <Text style={styles.heroSubtitle}>
                      Zero-bleed duplex channel calculation, spatial intermodulation protection, and live stage visualizer for field engineers.
                    </Text>
                  </View>
                </View>

                {/* Association Badge Bar */}
                <TouchableOpacity
                  style={styles.associationBar}
                  onPress={openRfSuite}
                  activeOpacity={0.8}
                >
                  <View style={styles.associationLeft}>
                    <Text style={styles.associationIcon}>🌐</Text>
                    <View>
                      <Text style={styles.associationTitle}>
                        Created in Association with <Text style={styles.associationHighlight}>rfsuite.net</Text>
                      </Text>
                      <Text style={styles.associationSub}>
                        Part of the professional RF Suite ecosystem for film, TV, outside broadcast & live events.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.associationAction}>
                    <Text style={styles.associationLinkText}>VISIT WEBSITE ↗</Text>
                  </View>
                </TouchableOpacity>

                {/* App Store Headline Points */}
                <View style={styles.headlineCard}>
                  <Text style={styles.headlineTitle}>Why Sound Supervisors & RF Techs Need This App:</Text>
                  
                  <View style={styles.bulletItem}>
                    <Text style={styles.bulletIcon}>🎯</Text>
                    <View style={styles.bulletTextWrap}>
                      <Text style={styles.bulletHeading}>Spatial Multi-Zone Intelligence</Text>
                      <Text style={styles.bulletDesc}>
                        Coordinate up to 4 distinct zones simultaneously. Calculates 26-metre physical proximity coupling and guarantees $\ge 25\text{ kHz}$ same-zone spacing with 0 filter bleed.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bulletItem}>
                    <Text style={styles.bulletIcon}>🛡️</Text>
                    <View style={styles.bulletTextWrap}>
                      <Text style={styles.bulletHeading}>Complete 2-Tx & 3-Tx Intermod Elimination</Text>
                      <Text style={styles.bulletDesc}>
                        Calculates $2F_1 - F_2$ and $F_1 + F_2 - F_3$ third-order products against all base and portable frequencies, preventing receiver desense on set.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bulletItem}>
                    <Text style={styles.bulletIcon}>📐</Text>
                    <View style={styles.bulletTextWrap}>
                      <Text style={styles.bulletHeading}>Interactive 2D Stage Canvas & Spectrum</Text>
                      <Text style={styles.bulletDesc}>
                        Drag zone nodes over custom physical deck dimensions (meters/feet). Monitor live carrier spikes and simulate multi-user PTT bursts in real-time.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bulletItem}>
                    <Text style={styles.bulletIcon}>📋</Text>
                    <View style={styles.bulletTextWrap}>
                      <Text style={styles.bulletHeading}>Turnkey Call Sheets & Hardware Sync</Text>
                      <Text style={styles.bulletDesc}>
                        Generate instant production call sheets for camera operators, directors, sound crews, and export clean CSV/TXT files for radio programming.
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Store Platform Badges */}
                <View style={styles.storeBadgesRow}>
                  <View style={styles.storeBadge}>
                    <Text style={styles.storeBadgeIcon}>🍎</Text>
                    <View>
                      <Text style={styles.storeBadgeSub}>Available on</Text>
                      <Text style={styles.storeBadgeMain}>Apple App Store</Text>
                    </View>
                  </View>
                  <View style={styles.storeBadge}>
                    <Text style={styles.storeBadgeIcon}>🤖</Text>
                    <View>
                      <Text style={styles.storeBadgeSub}>Get it on</Text>
                      <Text style={styles.storeBadgeMain}>Google Play Store</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* ================= TAB 2: WHAT IT DOES & VISUAL BREAKDOWN ================= */}
            {activeTab === 'features' && (
              <View style={styles.tabSection}>
                {/* Visual Spatial Diagram */}
                <View style={styles.featureGraphicWrap}>
                  <img
                    src="/src/assets/images/rf_zones_graphic_1790003778507.jpg"
                    alt="RF Multi-Zone Spatial Coordination Graphic"
                    referrerPolicy="no-referrer"
                    style={{
                      width: '100%',
                      height: 200,
                      objectFit: 'cover',
                      borderRadius: 10,
                      border: '1px solid #1e293b',
                    }}
                  />
                  <Text style={styles.graphicCaption}>
                    Spatial Distance Matrix: Calculates coupling threshold (&lt; 26m) between zones and enforces channel isolation.
                  </Text>
                </View>

                {/* Core Workflow Cards */}
                <View style={styles.workflowGrid}>
                  <View style={styles.workflowCard}>
                    <View style={styles.workflowStepNumber}>
                      <Text style={styles.workflowStepText}>1</Text>
                    </View>
                    <Text style={styles.workflowTitle}>Configure Zones & Bands</Text>
                    <Text style={styles.workflowDesc}>
                      Set up Studio, OB Truck, Gantry, or Field zones. Select UK Dedicated 455/468 MHz or 457/467 MHz duplex pairs, or define custom MHz splits and simplex IFBs/Walkies.
                    </Text>
                  </View>

                  <View style={styles.workflowCard}>
                    <View style={styles.workflowStepNumber}>
                      <Text style={styles.workflowStepText}>2</Text>
                    </View>
                    <Text style={styles.workflowTitle}>Set Distance Matrix</Text>
                    <Text style={styles.workflowDesc}>
                      Input distance between zones or drag them on the 2D stage canvas. Coupled zones (&lt; 26m) trigger intermodulation coupling rules; isolated zones allow frequency reuse.
                    </Text>
                  </View>

                  <View style={styles.workflowCard}>
                    <View style={styles.workflowStepNumber}>
                      <Text style={styles.workflowStepText}>3</Text>
                    </View>
                    <Text style={styles.workflowTitle}>One-Click Coordination Engine</Text>
                    <Text style={styles.workflowDesc}>
                      Multi-pass stochastic solver tests up to 250 permutations in milliseconds to find the highest-density, 100% clash-free allocation.
                    </Text>
                  </View>

                  <View style={styles.workflowCard}>
                    <View style={styles.workflowStepNumber}>
                      <Text style={styles.workflowStepText}>4</Text>
                    </View>
                    <Text style={styles.workflowTitle}>Live Monitor & Export</Text>
                    <Text style={styles.workflowDesc}>
                      Inspect carrier spikes on the live Tactical Spectrum Analyzer, simulate key-up IMDs with PTT Simulator, and print crew call sheets.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* ================= TAB 3: RFSUITE.NET ASSOCIATION ================= */}
            {activeTab === 'rfsuite' && (
              <View style={styles.tabSection}>
                <View style={styles.rfSuiteCard}>
                  <View style={styles.rfSuiteCardHeader}>
                    <Text style={styles.rfSuiteLogoText}>RF SUITE</Text>
                    <View style={styles.rfSuiteUrlBadge}>
                      <Text style={styles.rfSuiteUrlBadgeText}>rfsuite.net</Text>
                    </View>
                  </View>

                  <Text style={styles.rfSuiteCardTitle}>
                    Professional RF Tools for Wireless & Broadcast Engineers
                  </Text>
                  
                  <Text style={styles.rfSuiteCardBody}>
                    This mobile application has been developed in association with <Text style={{color: '#38bdf8', fontWeight: '700'}}>rfsuite.net</Text>, the comprehensive web portal for RF spectrum planning, frequency coordination, and broadcast wireless audio management.
                  </Text>

                  <Text style={styles.rfSuiteCardBody}>
                    By bringing the powerful algorithms of RF Suite directly into an offline-capable, native-speed mobile interface, frequency coordinators can calculate clean talkback grids anywhere on location — in OB trucks, sound stages, festivals, and film sets.
                  </Text>

                  <View style={styles.rfSuiteButtonsRow}>
                    <TouchableOpacity
                      style={styles.visitWebBtn}
                      onPress={openRfSuite}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.visitWebBtnText}>🌐 Visit rfsuite.net Website</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.copyWebBtn}
                      onPress={copyRfSuiteUrl}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.copyWebBtnText}>
                        {copiedLink ? '✅ Copied!' : '📋 Copy URL'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Additional Standards Info */}
                <View style={styles.standardsCard}>
                  <Text style={styles.standardsTitle}>Engineering & Regulatory Compliance:</Text>
                  <Text style={styles.standardsItem}>• Dedicated UK Ofcom 455/468 MHz & 457/467 MHz PMSE Talkback allocations.</Text>
                  <Text style={styles.standardsItem}>• 12.5 kHz Channel Raster & $\ge 25\text{ kHz}$ strict intra-zone filter isolation.</Text>
                  <Text style={styles.standardsItem}>• 2-Tone & 3-Tone third-order intermodulation distortion ($2A-B$ and $A+B-C$) calculation.</Text>
                  <Text style={styles.standardsItem}>• Inverse-square physical spatial power attenuation thresholding (26m coupling boundary).</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer Action Bar */}
          <View style={styles.footerBar}>
            <TouchableOpacity
              style={styles.rfSuiteFootLink}
              onPress={openRfSuite}
              activeOpacity={0.7}
            >
              <Text style={styles.rfSuiteFootLinkText}>🌐 rfsuite.net</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.launchAppBtn}
              onPress={() => {
                if (onLaunchApp) onLaunchApp();
                onClose();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.launchAppBtnText}>🚀 OPEN COORDINATOR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    width: '100%',
    maxWidth: 780,
    maxHeight: '92%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 24,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerLeft: {
    flex: 1,
  },
  rfSuiteTag: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    marginBottom: 4,
  },
  rfSuiteTagText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 8,
    backgroundColor: '#334155',
    borderRadius: 8,
    marginLeft: 12,
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#0b1120',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    gap: 8,
  },
  tabBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: '#1e293b',
    borderBottomWidth: 2,
    borderBottomColor: '#38bdf8',
  },
  tabBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  tabSection: {
    gap: 18,
  },
  heroBannerContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#020617',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'linear-gradient(180deg, rgba(2,6,23,0) 0%, rgba(2,6,23,0.92) 65%, rgba(2,6,23,0.98) 100%)',
    gap: 4,
  },
  heroPill: {
    backgroundColor: '#0284c7',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 2,
  },
  heroPillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroMainTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
  },
  associationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 10,
    padding: 14,
  },
  associationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  associationIcon: {
    fontSize: 24,
  },
  associationTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  associationHighlight: {
    color: '#38bdf8',
    textDecorationLine: 'underline',
  },
  associationSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  associationAction: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 10,
  },
  associationLinkText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  headlineCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 14,
  },
  headlineTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  bulletIcon: {
    fontSize: 20,
    marginTop: 2,
  },
  bulletTextWrap: {
    flex: 1,
  },
  bulletHeading: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  bulletDesc: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
  },
  storeBadgesRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  storeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 180,
  },
  storeBadgeIcon: {
    fontSize: 22,
  },
  storeBadgeSub: {
    color: '#94a3b8',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  storeBadgeMain: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  featureGraphicWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#020617',
    gap: 8,
  },
  graphicCaption: {
    color: '#94a3b8',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  workflowGrid: {
    gap: 12,
  },
  workflowCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    position: 'relative',
    paddingLeft: 48,
  },
  workflowStepNumber: {
    position: 'absolute',
    left: 14,
    top: 14,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  workflowStepText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  workflowTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  workflowDesc: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
  },
  rfSuiteCard: {
    backgroundColor: '#0c1a2d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e3a5f',
    padding: 20,
    gap: 12,
  },
  rfSuiteCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rfSuiteLogoText: {
    color: '#38bdf8',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  rfSuiteUrlBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  rfSuiteUrlBadgeText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  rfSuiteCardTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  rfSuiteCardBody: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 19,
  },
  rfSuiteButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  visitWebBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  visitWebBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  copyWebBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  copyWebBtnText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  standardsCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
  },
  standardsTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  standardsItem: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
  },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  rfSuiteFootLink: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  rfSuiteFootLinkText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
  },
  launchAppBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#059669',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  launchAppBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
