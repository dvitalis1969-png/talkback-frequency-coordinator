import React from 'react';
import { SafeAreaView, StatusBar, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { DedicatedSpectrumAnalyzerScreen } from './components/DedicatedSpectrumAnalyzerScreen';

export default function SpectrumAnalyzerRoute() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020617', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
      <DedicatedSpectrumAnalyzerScreen onClose={() => router.back()} />
    </SafeAreaView>
  );
}
