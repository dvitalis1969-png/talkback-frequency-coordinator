import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform
} from 'react-native';

export interface PttChannel {
  index: number;
  label: string;
  role: string;
  handsetTxFreq: number;
  baseTxFreq?: number;
  txFreq: number;
  rxFreq?: number;
  isSimplex: boolean;
  simplexType?: 'base_tx' | 'walkie';
  zoneName: string;
  zoneId: string;
  isKeyed: boolean;
  powerWatts: number;
}

interface Props {
  channels: PttChannel[];
  onToggleKey: (index: number) => void;
  onKeyAll: () => void;
  onReleaseAll: () => void;
  isStressTesting: boolean;
  onToggleStressTest: () => void;
  activeZoneName: string;
  liveImdClashes: string[];
}

export const PttSimulator: React.FC<Props> = ({
  channels,
  onToggleKey,
  onKeyAll,
  onReleaseAll,
  isStressTesting,
  onToggleStressTest,
  activeZoneName,
  liveImdClashes
}) => {
  const keyedCount = channels.filter((c) => c.isKeyed).length;

  return (
    <View style={styles.container}>
      {/* Simulator Control Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>PTT BURST &amp; STRESS SIMULATOR</Text>
          <Text style={styles.subtitle}>
            SIMULATING SIMULTANEOUS CREW KEY-UPS IN {activeZoneName.toUpperCase()}
          </Text>
        </View>

        <View style={styles.statBadge}>
          <Text style={styles.statBadgeLabel}>ON AIR</Text>
          <Text style={[styles.statBadgeValue, keyedCount > 0 ? styles.statValueActive : {}]}>
            {keyedCount} / {channels.length} TX
          </Text>
        </View>
      </View>

      {/* Live Clash Alert Banner */}
      {liveImdClashes.length > 0 ? (
        <View style={styles.clashBanner}>
          <Text style={styles.clashBannerTitle}>
            ⚠️ DANGER: {liveImdClashes.length} SIMULTANEOUS IMD COLLISION(S) DETECTED!
          </Text>
          {liveImdClashes.slice(0, 3).map((clash, idx) => (
            <Text key={idx} style={styles.clashBannerText}>
              • {clash}
            </Text>
          ))}
        </View>
      ) : keyedCount >= 2 ? (
        <View style={styles.safeBanner}>
          <Text style={styles.safeBannerText}>
            🛡️ {keyedCount} TRANSMITTERS KEYED: ZERO IMD COLLISION ON ACTIVE RECEIVERS
          </Text>
        </View>
      ) : null}

      {/* Global Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.stressBtn, isStressTesting && styles.stressBtnActive]}
          onPress={onToggleStressTest}
        >
          <Text style={[styles.stressBtnText, isStressTesting && { color: '#ffffff' }]}>
            {isStressTesting ? '⏹ STOP STRESS TEST' : '⚡ AUTO STRESS TEST'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.keyAllBtn}
          onPress={keyedCount === channels.length ? onReleaseAll : onKeyAll}
        >
          <Text style={styles.keyAllBtnText}>
            {keyedCount === channels.length ? 'RELEASE ALL' : 'KEY ALL TX'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Channels Grid / List */}
      <ScrollView style={styles.channelsScroll} nestedScrollEnabled={true}>
        {channels.length === 0 ? (
          <Text style={styles.emptyText}>
            NO COORDINATED CHANNELS YET. TAP &quot;CO-ORDINATE ALL ZONES&quot; TO POPULATE.
          </Text>
        ) : (
          <View style={styles.channelGrid}>
            {channels.map((chan) => {
              const isBaseFeed = chan.simplexType === 'base_tx';
              const badgeType = !chan.isSimplex ? 'DUPLEX TALKBACK' : (isBaseFeed ? 'IFB FEED' : 'WALKIE');
              const handsetFreq = chan.handsetTxFreq || chan.txFreq;

              return (
                <TouchableOpacity
                  key={`ptt_${chan.index}`}
                  activeOpacity={0.7}
                  style={[
                    styles.channelCard,
                    chan.isKeyed && styles.channelCardKeyed,
                    chan.isKeyed && !isBaseFeed && styles.channelCardKeyedHandset
                  ]}
                  onPress={() => onToggleKey(chan.index)}
                >
                  {/* Top line: LED & Role */}
                  <View style={styles.cardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <View style={[styles.ledDot, chan.isKeyed ? styles.ledDotActive : styles.ledDotIdle]} />
                      <Text
                        style={[styles.roleText, chan.isKeyed && { color: '#ffffff' }]}
                        numberOfLines={1}
                      >
                        {chan.role || `CH ${chan.index + 1}`}
                      </Text>
                    </View>
                    <View style={[styles.typeBadge, chan.isKeyed ? styles.typeBadgeActive : {}]}>
                      <Text style={styles.typeBadgeText}>{badgeType}</Text>
                    </View>
                  </View>

                  {/* Frequency & RF Routing Details */}
                  <View style={styles.cardFreqBox}>
                    <View style={styles.cardFreqRow}>
                      <Text style={[styles.freqLabel, chan.isKeyed ? styles.freqLabelKeyed : {}]}>
                        🎙️ PORTABLE PTT TX:
                      </Text>
                      <Text style={[styles.freqValue, chan.isKeyed ? styles.freqValueKeyed : {}]}>
                        {handsetFreq.toFixed(5)} MHz
                      </Text>
                    </View>

                    {chan.baseTxFreq ? (
                      <View style={styles.cardFreqRow}>
                        <Text style={styles.baseLabel}>
                          📻 BASE STATION TX:
                        </Text>
                        <Text style={styles.baseValue}>
                          {chan.baseTxFreq.toFixed(5)} MHz [CONTINUOUS]
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.cardStatusRow}>
                      <Text style={[styles.statusText, chan.isKeyed ? styles.statusTextActive : {}]}>
                        SPECTRUM: {chan.isKeyed ? '🔴 FILLED (ACTIVE CARRIER)' : '👻 GHOST OUTLINE (STANDBY)'}
                      </Text>
                      <Text style={styles.powerText}>
                        {chan.isKeyed ? `${chan.powerWatts}W RF` : '0W (STANDBY)'}
                      </Text>
                    </View>
                  </View>

                  {/* Big PTT Tactile Switch */}
                  <View style={[styles.pttButton, chan.isKeyed ? styles.pttButtonActive : {}]}>
                    <Text style={[styles.pttButtonText, chan.isKeyed ? styles.pttButtonTextActive : {}]}>
                      {chan.isKeyed 
                        ? `🔴 ON AIR — KEYED @ ${handsetFreq.toFixed(5)} MHz` 
                        : `🎙️ PRESS TO TALK (${handsetFreq.toFixed(5)} MHz)`}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#090f1d',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginTop: 6
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  title: {
    color: '#38bdf8',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  subtitle: {
    color: '#64748b',
    fontSize: 7.5,
    fontWeight: 'bold',
    marginTop: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  statBadge: {
    backgroundColor: '#111827',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center'
  },
  statBadgeLabel: {
    color: '#9ca3af',
    fontSize: 7,
    fontWeight: 'bold'
  },
  statBadgeValue: {
    color: '#e5e7eb',
    fontSize: 9.5,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  statValueActive: {
    color: '#ef4444'
  },
  clashBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 4,
    padding: 6,
    marginBottom: 8
  },
  clashBannerTitle: {
    color: '#f87171',
    fontSize: 8.5,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  clashBannerText: {
    color: '#fca5a5',
    fontSize: 7.5,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  safeBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 4,
    padding: 6,
    marginBottom: 8
  },
  safeBannerText: {
    color: '#34d399',
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8
  },
  stressBtn: {
    flex: 1.2,
    backgroundColor: '#1e1b4b',
    borderColor: '#6366f1',
    borderWidth: 1,
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stressBtnActive: {
    backgroundColor: '#dc2626',
    borderColor: '#f87171'
  },
  stressBtnText: {
    color: '#c7d2fe',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  keyAllBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderColor: '#475569',
    borderWidth: 1,
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  keyAllBtnText: {
    color: '#cbd5e1',
    fontSize: 8.5,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  channelsScroll: {
    maxHeight: 240
  },
  emptyText: {
    color: '#64748b',
    fontSize: 8.5,
    textAlign: 'center',
    paddingVertical: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  channelGrid: {
    gap: 6
  },
  channelCard: {
    backgroundColor: '#0f172a',
    borderRadius: 5,
    padding: 8,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  channelCardKeyed: {
    backgroundColor: '#1a1012',
    borderColor: '#ef4444'
  },
  channelCardKeyedHandset: {
    backgroundColor: '#0c1a14',
    borderColor: '#22c55e'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  ledDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5
  },
  ledDotIdle: {
    backgroundColor: '#475569'
  },
  ledDotActive: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4
  },
  roleText: {
    color: '#cbd5e1',
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  typeBadge: {
    backgroundColor: '#1e293b',
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 3
  },
  typeBadgeActive: {
    backgroundColor: '#22c55e'
  },
  typeBadgeText: {
    color: '#e2e8f0',
    fontSize: 7,
    fontWeight: '900'
  },
  cardFreqBox: {
    backgroundColor: '#090e17',
    padding: 5,
    borderRadius: 4,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  cardFreqRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2
  },
  freqLabel: {
    color: '#38bdf8',
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  freqLabelKeyed: {
    color: '#4ade80'
  },
  freqValue: {
    color: '#e0f2fe',
    fontSize: 8.5,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  freqValueKeyed: {
    color: '#4ade80',
    fontWeight: '900'
  },
  baseLabel: {
    color: '#eab308',
    fontSize: 7.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  baseValue: {
    color: '#fef08a',
    fontSize: 7.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  cardStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 3,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 3
  },
  statusText: {
    color: '#64748b',
    fontSize: 7,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  statusTextActive: {
    color: '#4ade80',
    fontWeight: 'bold'
  },
  powerText: {
    color: '#94a3b8',
    fontSize: 7.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold'
  },
  pttButton: {
    backgroundColor: '#1e293b',
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#38bdf8'
  },
  pttButtonActive: {
    backgroundColor: '#15803d',
    borderColor: '#4ade80'
  },
  pttButtonText: {
    color: '#38bdf8',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  pttButtonTextActive: {
    color: '#ffffff'
  }
});
