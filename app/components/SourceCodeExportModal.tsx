import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Share,
  Platform,
} from 'react-native';

interface SourceCodeExportModalProps {
  visible: boolean;
  onClose: () => void;
}

interface FileItem {
  name: string;
  path: string;
  description: string;
  downloadPath: string;
  rawPath: string;
  badge: string;
}

export const SourceCodeExportModal: React.FC<SourceCodeExportModalProps> = ({
  visible,
  onClose,
}) => {
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  const files: FileItem[] = [
    {
      name: 'rfMath.ts',
      path: 'app/utils/rfMath.ts',
      description: 'IMD calculation engine (2-Tone, 3-Tone), spatial coupling, UK Ofcom bands',
      downloadPath: '/download/rfMath.ts',
      rawPath: '/raw/rfMath.ts',
      badge: 'CORE RF ENGINE',
    },
    {
      name: 'index.tsx',
      path: 'app/index.tsx',
      description: 'Main Multi-Zone RF Coordinator dashboard, state engine, and hardware controls',
      downloadPath: '/download/index.tsx',
      rawPath: '/raw/index.tsx',
      badge: 'MAIN DASHBOARD',
    },
    {
      name: 'TacticalSpectrumAnalyzer.tsx',
      path: 'app/components/TacticalSpectrumAnalyzer.tsx',
      description: 'Instrument-grade spectrum analyzer with graticule, peak search & delta marker',
      downloadPath: '/download/TacticalSpectrumAnalyzer.tsx',
      rawPath: '/raw/TacticalSpectrumAnalyzer.tsx',
      badge: 'RF ANALYZER',
    },
    {
      name: 'PttSimulator.tsx',
      path: 'app/components/PttSimulator.tsx',
      description: 'Real-time PTT key-up simulator & multi-transmitter IMD stress tester',
      downloadPath: '/download/PttSimulator.tsx',
      rawPath: '/raw/PttSimulator.tsx',
      badge: 'PTT SIMULATOR',
    },
    {
      name: 'CrewCallSheetModal.tsx',
      path: 'app/components/CrewCallSheetModal.tsx',
      description: 'Production crew channel assignments, CTCSS tones, and CSV export modal',
      downloadPath: '/download/CrewCallSheetModal.tsx',
      rawPath: '/raw/CrewCallSheetModal.tsx',
      badge: 'CALL SHEET',
    },
  ];

  const handleDownload = async (file: FileItem) => {
    setDownloadingFile(file.name);
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const res = await fetch(file.downloadPath);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        // Native / Fallback
        await Share.share({
          message: `Download ${file.name} from: ${window.location.origin}${file.downloadPath}`,
          url: `${window.location.origin}${file.downloadPath}`,
        });
      }
    } catch (e) {
      console.error('Download error:', e);
      if (typeof window !== 'undefined') {
        window.open(file.downloadPath, '_blank');
      }
    } finally {
      setTimeout(() => setDownloadingFile(null), 800);
    }
  };

  const handleCopyCode = async (file: FileItem) => {
    try {
      const res = await fetch(file.rawPath);
      const text = await res.text();
      if (Platform.OS === 'web' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopiedFile(file.name);
        setTimeout(() => setCopiedFile(null), 2500);
      } else {
        await Share.share({
          message: text,
          title: file.name,
        });
        setCopiedFile(file.name);
        setTimeout(() => setCopiedFile(null), 2500);
      }
    } catch (e) {
      console.error('Copy error:', e);
      if (typeof window !== 'undefined') {
        window.open(file.rawPath, '_blank');
      }
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.modalTitle}>PROJECT SOURCE FILES (VS CODE)</Text>
              <Text style={styles.modalSubtitle}>
                Download or copy clean source files directly into your local project
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕ CLOSE</Text>
            </TouchableOpacity>
          </View>

          {/* Guide Banner */}
          <View style={styles.guideBanner}>
            <Text style={styles.guideBannerTitle}>💡 LOCAL DIRECTORY STRUCTURE:</Text>
            <Text style={styles.guideBannerCode}>
              your-project/
              {'\n'} ├── app/
              {'\n'} │    ├── index.tsx
              {'\n'} │    ├── utils/rfMath.ts
              {'\n'} │    └── components/
              {'\n'} │         ├── TacticalSpectrumAnalyzer.tsx
              {'\n'} │         ├── PttSimulator.tsx
              {'\n'} │         └── CrewCallSheetModal.tsx
            </Text>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator>
            {files.map((f, idx) => {
              const isCopied = copiedFile === f.name;
              const isDownloading = downloadingFile === f.name;

              return (
                <View key={idx} style={styles.fileCard}>
                  <View style={styles.fileCardHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.fileName}>{f.name}</Text>
                        <View style={styles.badgePill}>
                          <Text style={styles.badgeText}>{f.badge}</Text>
                        </View>
                      </View>
                      <Text style={styles.filePath}>{f.path}</Text>
                    </View>
                  </View>

                  <Text style={styles.fileDesc}>{f.description}</Text>

                  <View style={styles.btnRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[styles.actionBtn, styles.downloadBtn]}
                      onPress={() => handleDownload(f)}
                    >
                      <Text style={styles.downloadBtnText}>
                        {isDownloading ? '⏳ DOWNLOADING...' : `⬇️ DOWNLOAD ${f.name}`}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[styles.actionBtn, isCopied ? styles.copyBtnSuccess : styles.copyBtn]}
                      onPress={() => handleCopyCode(f)}
                    >
                      <Text style={[styles.copyBtnText, isCopied && { color: '#4ade80' }]}>
                        {isCopied ? '✓ COPIED CODE!' : '📋 COPY CODE'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.footerCloseBtn} onPress={onClose}>
              <Text style={styles.footerCloseBtnText}>DONE</Text>
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
    backgroundColor: 'rgba(3, 7, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalCard: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '90%',
    backgroundColor: '#0b1320',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 10,
    marginBottom: 10,
  },
  modalTitle: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  modalSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  guideBanner: {
    backgroundColor: '#082f49',
    borderColor: '#0284c7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  guideBannerTitle: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 4,
  },
  guideBannerCode: {
    color: '#bae6fd',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 14,
  },
  scrollArea: {
    flexGrow: 1,
  },
  fileCard: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 12,
    marginBottom: 10,
  },
  fileCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  fileName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  badgePill: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  badgeText: {
    color: '#38bdf8',
    fontSize: 8,
    fontWeight: '900',
  },
  filePath: {
    color: '#64748b',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  fileDesc: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 6,
    marginBottom: 10,
    lineHeight: 15,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadBtn: {
    backgroundColor: '#0284c7',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  downloadBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  copyBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  copyBtnSuccess: {
    backgroundColor: '#064e3b',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  copyBtnText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: 'bold',
  },
  footerRow: {
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 10,
    marginTop: 6,
    alignItems: 'flex-end',
  },
  footerCloseBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  footerCloseBtnText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
