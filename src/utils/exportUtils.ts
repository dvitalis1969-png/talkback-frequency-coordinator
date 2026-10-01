
import { Frequency, DuplexPair } from '../../types';

export interface CoordinationExportData {
  version: string;
  timestamp: string;
  projectName: string;
  frequencies: {
    id: string;
    frequency: number;
    label: string;
    type: string;
    group?: string;
    bandwidth?: number;
  }[];
  talkbackPairs?: {
    id: string;
    tx: number;
    rx: number;
    label: string;
    type: string;
    group?: string;
    bw?: number;
  }[];
}

export const exportToJson = (data: CoordinationExportData, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportToWwbCsv = (frequencies: Frequency[], talkbackPairs: DuplexPair[], filename: string) => {
  // Shure Wireless Workbench CSV format:
  // Zone,Frequency,Channel Name,Manufacturer,Model,Band
  
  let csv = "Zone,Frequency,Channel Name,Manufacturer,Model,Band\n";
  
  frequencies.forEach(f => {
    if (f.value > 0) {
      csv += `"",${f.value.toFixed(3)},"${f.label || f.id}","Generic","Generic",""\n`;
    }
  });
  
  talkbackPairs.forEach(p => {
    if (p.tx > 0) {
      csv += `"",${p.tx.toFixed(5)},"${p.label || p.id}_TX","Generic","Talkback TX",""\n`;
    }
    if (p.rx > 0) {
      csv += `"",${p.rx.toFixed(5)},"${p.label || p.id}_RX","Generic","Talkback RX",""\n`;
    }
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_wwb.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
