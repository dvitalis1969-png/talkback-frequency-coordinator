import { ScanDataPoint } from '../types';

export interface SerialDevice {
    port: any;
    reader: any;
    writer: any;
    deviceType: 'tinysa' | 'rfexplorer';
    pendingRead?: Promise<any> | null;
    lastConfiguredStartFreq?: number;
    lastConfiguredEndFreq?: number;
    lastUiStartFreq?: number;
    lastUiEndFreq?: number;
    streamRequested?: boolean;
    activeReaderLoop?: boolean;
    latestSweep?: ScanDataPoint[];
    onSweep?: (sweep: ScanDataPoint[]) => void;
    onRaw?: (data: string) => void;
    onStatus?: (status: string) => void;
    lastRawLogTime?: number;
    suppressSpurs?: boolean;
    amplitudeOffset?: number;
}

export async function safeRead(device: SerialDevice) {
    if (!device.reader) {
        throw new Error('Serial port reader is not available. The device might be disconnected.');
    }
    if (!device.pendingRead) {
        device.pendingRead = device.reader.read();
    }
    try {
        const result = await device.pendingRead;
        device.pendingRead = null;
        return result;
    } catch (e) {
        device.pendingRead = null;
        throw e;
    }
}

export async function recreateDeviceReader(device: SerialDevice): Promise<void> {
    try {
        if (device.reader) {
            await device.reader.cancel();
            device.reader.releaseLock();
        }
    } catch (e) {
        console.warn('Error releasing reader lock:', e);
    }
    device.pendingRead = null;
    try {
        if (device.port && device.port.readable) {
            device.reader = device.port.readable.getReader();
        } else {
            console.error('Serial port readable stream not available');
        }
    } catch (e) {
        console.error('Failed to get a new serial reader:', e);
    }
}

export async function requestSerialPort(): Promise<any> {
    if (!('serial' in navigator)) {
        throw new Error('Web Serial API not supported in this browser.');
    }
    // @ts-ignore
    return await navigator.serial.requestPort();
}

export async function connectToTinySA(port: any, baudRate: number = 115200): Promise<SerialDevice> {
    try {
        await port.open({ baudRate });
    } catch (e: any) {
        if (e.name !== 'InvalidStateError' && !e.message?.includes('already open')) {
            throw e;
        }
    }
    
    if (!port.readable || !port.writable) {
        throw new Error('Serial port is not readable or writable. It might be disconnected or locked.');
    }

    if (!port.readable) {
        throw new Error('Serial port is not readable. It might be disconnected or locked.');
    }
    
    // Many TinySA/NanoVNA devices require DTR/RTS to be set to send data
    try {
        // @ts-ignore
        await port.setSignals({ dataTerminalReady: true, requestToSend: true });
    } catch (e) {
        console.warn('Could not set DTR/RTS signals:', e);
    }

    const writer = port.writable ? port.writable.getWriter() : null;
    
    try {
        // Send Ctrl+C and multiple newlines to clear any state and ensure we are at the prompt
        if (writer) {
            const encoder = new TextEncoder();
            // Send Ctrl+C, Esc, and Enter to break any current operation
            await writer.write(encoder.encode('\x03\x1B\r\n\r\n'));
            
            // Small delay for device to process
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        return { port, reader: port.readable.getReader(), writer, deviceType: 'tinysa' };
    } catch (e) {
        if (writer) writer.releaseLock();
        throw e;
    }
}



export function suppressRFExplorerSpurs(scanData: ScanDataPoint[]): ScanDataPoint[] {
    if (!scanData || scanData.length < 10) return scanData;
    
    const result = [...scanData].map(d => ({...d}));
    const n = result.length;
    
    // Calculate the average frequency step size of this sweep
    const stepSize = n > 1 ? (result[n - 1].freq - result[0].freq) / (n - 1) : 0.1;
    
    // Determine the max expected spur width in bins based on RF Explorer's physical spur bandwidth (~0.35 MHz)
    // We always check at least 2 bins to handle bin-straddling under large step sizes.
    const maxSpurWidthBins = Math.max(2, Math.min(6, Math.ceil(0.35 / stepSize)));
    
    // Define the tolerance for matching known spur boundaries (multiples of 500 kHz or 10 MHz)
    const BOUNDARY_TOLERANCE = Math.max(0.1, stepSize * 0.75);
    
    let i = 1;
    while (i < n - 1) {
        let suppressed = false;
        
        // Try to detect a spur of width 'w', starting from the widest possible down to 1
        for (let w = maxSpurWidthBins; w >= 1; w--) {
            if (i + w >= n) continue;
            
            const leftBaseline = result[i - 1].amp;
            const rightBaseline = result[i + w].amp;
            const maxBaseline = Math.max(leftBaseline, rightBaseline);
            
            // Check if any of the points in the candidate range fall near a known spur boundary
            let nearSpurBoundary = false;
            for (let k = 0; k < w; k++) {
                const freq = result[i + k].freq;
                const rem500 = freq % 0.5;
                const distTo500 = Math.min(rem500, 0.5 - rem500);
                const rem10 = freq % 10;
                const distTo10 = Math.min(rem10, 10 - rem10);
                
                if (distTo500 < BOUNDARY_TOLERANCE || distTo10 < BOUNDARY_TOLERANCE) {
                    nearSpurBoundary = true;
                    break;
                }
            }
            
            // Use an aggressive threshold near boundaries to completely clean up small spurs,
            // and a slightly higher threshold elsewhere to avoid false positives on real signals.
            const threshold = nearSpurBoundary ? 8.0 : 12.0;
            
            // Verify if all points in the candidate range [i, i + w - 1] are significantly elevated
            let isSpur = true;
            for (let k = 0; k < w; k++) {
                const amp = result[i + k].amp;
                // If any point is actually a strong signal (>-85 dBm), it's likely a real transmitter, not a low-level spur.
                // RF Explorer internal spurs are typically very weak (<-90 dBm).
                if (amp < maxBaseline + threshold || amp > -85) {
                    isSpur = false;
                    break;
                }
            }
            
            if (isSpur) {
                // Suppress this spur by interpolating between the left and right baselines
                for (let k = 0; k < w; k++) {
                    const fraction = (k + 1) / (w + 1);
                    const interpolated = leftBaseline + fraction * (rightBaseline - leftBaseline);
                    const noise = (Math.random() * 1.0) - 0.5; // Natural noise variation
                    result[i + k].amp = interpolated + noise;
                }
                
                // Move the pointer past the suppressed spur
                i += w;
                suppressed = true;
                break;
            }
        }
        
        if (!suppressed) {
            i++;
        }
    }
    
    return result;
}


export function startRFExplorerBackgroundLoop(device: SerialDevice) {
    device.activeReaderLoop = true;
    
    (async () => {
        let buffer = new Uint8Array(0);
        while (device.activeReaderLoop) {
            try {
                const { value, done } = await safeRead(device);
                if (done) break;
                if (!value) continue;
                
                const merged = new Uint8Array(buffer.length + value.length);
                merged.set(buffer);
                merged.set(value, buffer.length);
                buffer = merged;
                
                // Prevent infinite buffer/memory growth from potential corruption or invalid frame starts
                if (buffer.length > 16384) {
                    buffer = buffer.slice(buffer.length - 4096);
                }
                
                // Throttle raw logs to prevent high-frequency React state updates and event loop lag
                const now = Date.now();
                if (device.onRaw && value && (!device.lastRawLogTime || now - device.lastRawLogTime > 250)) {
                    device.lastRawLogTime = now;
                    const bytes = value as Uint8Array;
                    const hexStr = Array.from(bytes.slice(0, 10)).map((b: number) => b.toString(16).padStart(2, '0')).join(' ');
                    device.onRaw(`Read ${bytes.length} bytes. Hex start: ${hexStr}`);
                }
                
                // Unified sequential parser: process everything in chronological order from the front of the buffer
                while (device.activeReaderLoop && buffer.length > 0) {
                    if (buffer[0] === 0x24) { // '$' - Potential Sweep Frame
                        if (buffer.length < 2) {
                            break; // Wait for second character
                        }
                        const nextChar = buffer[1];
                        if (nextChar === 0x53 || nextChar === 0x73) { // '$S' or '$s'
                            if (buffer.length < 3) {
                                break; // Wait for sample_points byte
                            }
                            const samplePointsByte = buffer[2];
                            const numPoints = nextChar === 0x53 ? samplePointsByte : (samplePointsByte + 1) * 16;
                            const totalFrameLen = numPoints + 5; // 2 (marker) + 1 (points byte) + numPoints + 2 (EOL)
                            if (buffer.length < totalFrameLen) {
                                break; // Wait for full frame
                            }
                            
                            // Decode full sweep
                            const sweepData = buffer.slice(3, 3 + numPoints);
                            const scanData: ScanDataPoint[] = [];
                            
                            const startFreq = device.lastConfiguredStartFreq || 2400;
                            const endFreq = device.lastConfiguredEndFreq || 2480;
                            const step = (endFreq - startFreq) / Math.max(1, numPoints - 1);
                            
                            for (let j = 0; j < numPoints; j++) {
                                // RF Explorer binary data represents dBm in 0.5dB steps.
                                // Formula: dBm = -(Byte / 2)
                                let amp = (sweepData[j] / 2.0) * -1.0;
                                
                                if (amp > 10) amp = -120; // Guard against garbage data
                                scanData.push({ freq: startFreq + (j * step), amp });
                            }
                            
                            const filteredData = device.suppressSpurs !== false ? suppressRFExplorerSpurs(scanData) : scanData;
                            device.latestSweep = filteredData;
                            if (device.onSweep) {
                                device.onSweep(filteredData);
                            }
                            
                            // Consume sweep data
                            buffer = buffer.slice(totalFrameLen);
                            continue;
                        } else if (nextChar === 0x7A) { // '$z'
                            if (buffer.length < 4) {
                                break; // Wait for 16-bit count bytes
                            }
                            const numPoints = (buffer[2] << 8) | buffer[3];
                            const totalFrameLen = numPoints + 6; // 2 (marker) + 2 (points bytes) + numPoints + 2 (EOL)
                            if (buffer.length < totalFrameLen) {
                                break; // Wait for full frame
                            }
                            
                            // Decode full sweep
                            const sweepData = buffer.slice(4, 4 + numPoints);
                            const scanData: ScanDataPoint[] = [];
                            
                            const startFreq = device.lastConfiguredStartFreq || 2400;
                            const endFreq = device.lastConfiguredEndFreq || 2480;
                            const step = (endFreq - startFreq) / Math.max(1, numPoints - 1);
                            
                            for (let j = 0; j < numPoints; j++) {
                                // RF Explorer binary data represents dBm in 0.5dB steps.
                                // Formula: dBm = -(Byte / 2)
                                let amp = (sweepData[j] / 2.0) * -1.0;
                                
                                if (amp > 10) amp = -120; // Guard against garbage data
                                scanData.push({ freq: startFreq + (j * step), amp });
                            }
                            
                            const filteredData = device.suppressSpurs !== false ? suppressRFExplorerSpurs(scanData) : scanData;
                            device.latestSweep = filteredData;
                            if (device.onSweep) {
                                device.onSweep(filteredData);
                            }
                            
                            // Consume sweep data
                            buffer = buffer.slice(totalFrameLen);
                            continue;
                        } else {
                            // Invalid second character, discard the '$' to keep moving forward
                            buffer = buffer.slice(1);
                            continue;
                        }
                    } else if (buffer[0] === 0x23) { // '#' - Configuration / Metadata Line
                        // Find the end of the line
                        let newlineIndex = -1;
                        for (let i = 0; i < buffer.length; i++) {
                            if (buffer[i] === 0x0A) { // '\n'
                                newlineIndex = i;
                                break;
                            }
                        }
                        if (newlineIndex === -1) {
                            // Incomplete line, wait for more data without discarding anything
                            break;
                        }
                        
                        // Extract line
                        const lineBytes = buffer.slice(0, newlineIndex + 1);
                        const lineStr = new TextDecoder().decode(lineBytes).trim();
                        
                        // Parse configuration line
                        if (lineStr.startsWith('#C') && (lineStr.includes('-A:') || lineStr.includes('-F:') || lineStr.includes('-M:'))) {
                            if (device.onStatus) device.onStatus(`Received config line: ${lineStr}`);
                            try {
                                const colonIdx = lineStr.indexOf(':');
                                const payload = lineStr.slice(colonIdx + 1);
                                const parts = payload.split(',');
                                if (parts.length >= 3) {
                                    if (lineStr.includes('-F:')) {
                                        // Format: StartFreq(kHz), EndFreq(kHz), AmpTop, AmpBottom, [Points]
                                        const startKhz = parseFloat(parts[0]);
                                        const endKhz = parseFloat(parts[1]);
                                        let points = 112;
                                        if (parts.length >= 5) points = parseInt(parts[4]);
                                        
                                        if (!isNaN(startKhz) && !isNaN(endKhz) && !isNaN(points) && points > 0) {
                                            device.lastConfiguredStartFreq = startKhz / 1000;
                                            device.lastConfiguredEndFreq = endKhz / 1000;
                                            if (device.onStatus) {
                                                device.onStatus(`Device config sync: Start=${device.lastConfiguredStartFreq.toFixed(3)} MHz, Stop=${device.lastConfiguredEndFreq.toFixed(3)} MHz, Points=${points}`);
                                            }
                                        }
                                    } else if (lineStr.includes('-M:')) {
                                        // Format: CenterFreq(kHz), SpanFreq(kHz), AmpTop, AmpBottom, [Points]
                                        const centerKhz = parseFloat(parts[0]);
                                        const spanKhz = parseFloat(parts[1]);
                                        let points = 112;
                                        if (parts.length >= 5) points = parseInt(parts[4]);
                                        
                                        if (!isNaN(centerKhz) && !isNaN(spanKhz) && !isNaN(points) && points > 0) {
                                            device.lastConfiguredStartFreq = (centerKhz - spanKhz / 2) / 1000;
                                            device.lastConfiguredEndFreq = (centerKhz + spanKhz / 2) / 1000;
                                            if (device.onStatus) {
                                                device.onStatus(`Device config sync: Center=${(centerKhz/1000).toFixed(3)} MHz, Span=${(spanKhz/1000).toFixed(3)} MHz, Points=${points}`);
                                            }
                                        }
                                    } else {
                                        // Format: StartFreq(kHz), StepFreq(kHz), AmpTop_dBm, AmpBottom_dBm, Points, ...
                                        const startKhz = parseFloat(parts[0]);
                                        const stepKhz = parseFloat(parts[1]);
                                        
                                        // AmpTop (parts[2]) and AmpBottom (parts[3]) are echo of config, not calibration offsets
                                        // We don't need to store them as amplitudeOffset anymore.
                                        
                                        let points = 112; // default
                                        if (parts.length >= 5) {
                                            points = parseInt(parts[4]);
                                        }
                                        
                                        if (!isNaN(startKhz) && !isNaN(stepKhz) && !isNaN(points) && points > 0) {
                                            device.lastConfiguredStartFreq = startKhz / 1000;
                                            device.lastConfiguredEndFreq = (startKhz + stepKhz * (points - 1)) / 1000;
                                            if (device.onStatus) {
                                                device.onStatus(`Device config sync: Start=${device.lastConfiguredStartFreq.toFixed(3)} MHz, Stop=${device.lastConfiguredEndFreq.toFixed(3)} MHz, Points=${points}`);
                                            }
                                        }
                                    }
                                }
                            } catch (e) {
                                console.error('Error parsing RF Explorer config line:', e);
                            }
                        }
                        
                        // Consume line from buffer
                        buffer = buffer.slice(newlineIndex + 1);
                        continue;
                    } else {
                        // Discard non-marker leading bytes to align with the next marker
                        let nextMarkerIdx = -1;
                        for (let i = 1; i < buffer.length; i++) {
                            if (buffer[i] === 0x24 || buffer[i] === 0x23) {
                                nextMarkerIdx = i;
                                break;
                            }
                        }
                        if (nextMarkerIdx === -1) {
                            // No markers in the rest of the buffer, discard it
                            buffer = new Uint8Array(0);
                        } else {
                            buffer = buffer.slice(nextMarkerIdx);
                        }
                        continue;
                    }
                }
            } catch (err: any) {
                const isOverrun = err.message?.includes('overrun') || err.name === 'BufferOverrunError';
                
                if (isOverrun) {
                    console.warn('RF Explorer background loop serial buffer overrun detected. Recovering silently...');
                    if (device.onStatus) {
                        device.onStatus('Buffer overrun detected, automatically recovering...');
                    }
                } else {
                    console.error('RF Explorer background loop read error:', err.message);
                    if (device.onStatus) {
                        device.onStatus(`Read error: ${err.message}`);
                    }
                }

                if (err.message?.includes('closed') || err.message?.includes('released') || err.message?.includes('lost') || !device.activeReaderLoop) {
                    break;
                }
                
                // Automatic Reader Recovery for non-fatal stream read errors (like Buffer overrun)
                try {
                    if (device.reader) {
                        try { await device.reader.cancel(); } catch (e) {}
                        try { device.reader.releaseLock(); } catch (e) {}
                        device.reader = null;
                    }
                    if (device.port && device.port.readable) {
                        device.reader = device.port.readable.getReader();
                        device.pendingRead = null;
                        if (device.onStatus) {
                            if (isOverrun) {
                                device.onStatus('Resuming sweep stream...');
                            } else {
                                device.onStatus('Recovered from read error, resuming stream...');
                            }
                        }
                    } else {
                        break; // Port is gone, break loop
                    }
                } catch (recErr: any) {
                    console.error('Failed to recover serial reader:', recErr.message);
                    break;
                }
                
                await new Promise(r => setTimeout(r, 100));
            }
        }
        device.activeReaderLoop = false;
    })();
}

export async function connectToRFExplorer(port: any, baudRate: number = 500000): Promise<SerialDevice> {
    try {
        await port.open({ baudRate });
    } catch (e: any) {
        if (e.name !== 'InvalidStateError' && !e.message?.includes('already open')) {
            throw e;
        }
    }
    
    if (!port.readable || !port.writable) {
        throw new Error('Serial port is not readable or writable. It might be disconnected or locked.');
    }

    if (!port.readable) {
        throw new Error('Serial port is not readable. It might be disconnected or locked.');
    }

    try {
        // @ts-ignore
        await port.setSignals({ dataTerminalReady: true, requestToSend: true });
    } catch (e) {
        console.warn('Could not set DTR/RTS signals:', e);
    }

    let writer;
    try {
        writer = port.writable ? port.writable.getWriter() : null;
    } catch (e) {
        throw new Error('Could not lock the port for writing. Another application might be using it.');
    }
    
    const device: SerialDevice = { port, reader: port.readable.getReader(), writer, deviceType: 'rfexplorer' };
    startRFExplorerBackgroundLoop(device);

    // Send initial C0 to start streaming immediately upon connection
    try {
        if (writer) {
            const cmd = sendRFExplorerCommand("C0");
            await writer.write(cmd);
            device.streamRequested = true;
        }
    } catch (e) {
        console.warn('Failed to send initial C0 to RF Explorer:', e);
    }

    return device;
}

export async function connectToDevice(port: any, baudRate: number, deviceType: 'tinysa' | 'rfexplorer'): Promise<SerialDevice> {
    if (deviceType === 'rfexplorer') {
        return await connectToRFExplorer(port, baudRate);
    }
    return await connectToTinySA(port, baudRate);
}

export async function forceWakeUp(device: SerialDevice): Promise<void> {
    const { writer } = device;
    const encoder = new TextEncoder();
    
    if (device.deviceType === 'tinysa') {
        // TinySA wake-up: Send Ctrl+C, Esc, and Enter to abort and return to the prompt cleanly
        const barrage = '\x03\x1B\r\n';
        await writer.write(encoder.encode(barrage));
        await new Promise(resolve => setTimeout(resolve, 100));
        await writer.write(encoder.encode('\r\n'));
    }
}

export async function listenOnly(device: SerialDevice, durationMs: number = 2000, onRaw?: (data: string) => void): Promise<string> {
    if (isBusy) return "Busy...";
    isBusy = true;
    try {
        const decoder = new TextDecoder();
        let data = "";
        const timeoutPromise = new Promise(resolve => setTimeout(resolve, durationMs));
        
        const readPromise = (async () => {
            try {
                while (true) {
                    const { value, done } = await Promise.race([
                        safeRead(device),
                        new Promise<{value: undefined, done: boolean}>(resolve => setTimeout(() => resolve({value: undefined, done: true}), durationMs))
                    ]);
                    if (done || !value) break;
                    const chunk = decoder.decode(value, { stream: true });
                    data += chunk;
                    if (onRaw) {
                        const bytes = Array.from(value as Uint8Array);
                        const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join(' ');
                        const cleanChunk = chunk.replace(/[\r\n]+/g, ' ').trim();
                        onRaw(`LISTEN: ${cleanChunk || `[HEX: ${hex}]`}`);
                    }
                }
            } finally {}
        })();

        try {
            await Promise.race([readPromise, timeoutPromise]);
        } catch (err) {
            await recreateDeviceReader(device);
            try { await readPromise; } catch (e) {}
            throw err;
        }
        
        try { await readPromise; } catch (e) {}
        return data;
    } finally {
        isBusy = false;
    }
}

export async function sendRawCommand(device: SerialDevice, command: string, onRaw?: (data: string) => void): Promise<string> {
    if (isBusy) return "Busy...";
    isBusy = true;
    
    const { writer } = device;
    try {
        await clearBuffer(device);
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(command + '\r'));
        
        let data = "";
        const decoder = new TextDecoder();
        let timeoutId: any;
        const timeoutMs = command.startsWith('data') || command.startsWith('scan') || command.startsWith('freq') ? 6000 : 3000;
        const timeoutPromise = new Promise((resolve) => {
            timeoutId = setTimeout(() => resolve('TIMEOUT'), timeoutMs);
        });

        const readPromise = (async () => {
            try {
                let lastChunkTime = Date.now();
                while (true) {
                    const { value, done } = await safeRead(device);
                    if (done) break;
                    
                    const chunk = decoder.decode(value, { stream: true });
                    data += chunk;
                    lastChunkTime = Date.now();
                    if (onRaw) {
                        const bytes = Array.from(value as Uint8Array);
                        const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join(' ');
                        const cleanChunk = chunk.replace(/[\r\n]+/g, ' ').trim();
                        onRaw(`RX: ${cleanChunk || `[HEX: ${hex}]`}`);
                    }
                    const trimmedData = data.trim();
                    if (device.deviceType === 'tinysa' && (
                        data.includes('ch>') || 
                        data.includes('tinysa>') || 
                        data.includes('nanovna>') || 
                        (trimmedData.endsWith('>') && trimmedData.length > 5)
                    )) {
                        break;
                    }
                    // If we got data and haven't received new bytes for 400ms on a data command, break
                    if ((command.startsWith('data') || command.startsWith('scan')) && data.length > 20 && Date.now() - lastChunkTime > 400) {
                        break;
                    }
                }
            } finally {
                clearTimeout(timeoutId);
            }
        })();

        const result = await Promise.race([readPromise, timeoutPromise]);
        if (result === 'TIMEOUT') {
            if (data.trim().length > 0) {
                return data.trim();
            }
            throw new Error('Command Timeout');
        }
        return data.trim();
    } catch (e: any) {
        return `Error: ${e.message}`;
    } finally {
        isBusy = false;
    }
}

export async function getDeviceVersion(device: SerialDevice, onRaw?: (data: string) => void): Promise<string | null> {
    const command = 'version';
    const response = await sendRawCommand(device, command, onRaw);
    if (response.includes('Error') || response === "Busy...") return null;
    
    return response
        .replace(/version/g, '')
        .replace(/ch>/g, '')
        .replace(/tinysa>/g, '')
        .replace(/nanovna>/g, '')
        .replace(/>/g, '')
        .trim();
}

let isBusy = false;

export async function disconnectDevice(device: SerialDevice): Promise<void> {
    isBusy = false;
    device.activeReaderLoop = false;
    device.streamRequested = false;
    try {
        if (device.reader) {
            try { await device.reader?.cancel(); } catch (e) { console.warn('Reader cancel error:', e); }
            
            // Wait for active read functions to release the lock
            let retries = 10;
            while ((device.reader || device.activeReaderLoop) && retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 50));
                retries--;
            }
            
            if (device.reader) {
                try { device.reader.releaseLock(); } catch (e) { console.warn('Reader release error:', e); }
                device.reader = null;
            }
        }
        if (device.writer) {
            // Just release the lock, closing the stream can sometimes hang
            try { device.writer.releaseLock(); } catch (e) { console.warn('Writer release error:', e); }
            device.writer = null;
        }
        if (device.port) {
            try { await device.port.close(); } catch (e) { console.warn('Port close error:', e); }
            device.port = null;
        }
    } catch (e) {
        console.error('Error during disconnect:', e);
    }
}

export async function clearBuffer(device: SerialDevice) {
    // Read whatever is available to clear the buffer
    try {
        while (true) {
            const { value, done } = await Promise.race([
                safeRead(device),
                new Promise<{value: undefined, done: boolean}>(resolve => setTimeout(() => resolve({value: undefined, done: true}), 200))
            ]);
            if (done || !value) break;
        }
    } catch (e) {}
}

export async function readTinySAScan(device: SerialDevice, startFreq: number, endFreq: number, points: number = 290, onStatus?: (status: string) => void, onRaw?: (data: string) => void): Promise<ScanDataPoint[]> {
    try {
        const startHz = Math.round(startFreq * 1000000);
        const endHz = Math.round(endFreq * 1000000);

        // 1. Configure sweep range if changed or not set (try sweep, fall back to start/stop if needed)
        if (device.lastConfiguredStartFreq !== startFreq || device.lastConfiguredEndFreq !== endFreq) {
            if (onStatus) onStatus('Setting TinySA sweep range...');
            const sweepRes = await sendRawCommand(device, `sweep ${startHz} ${endHz}`, onRaw);
            if (sweepRes.startsWith('Error:') || sweepRes === 'Busy...') {
                // Try individual start and stop commands
                await sendRawCommand(device, `start ${startHz}`, onRaw);
                await sendRawCommand(device, `stop ${endHz}`, onRaw);
            }
            device.lastConfiguredStartFreq = startFreq;
            device.lastConfiguredEndFreq = endFreq;
        }

        if (onStatus) onStatus('Requesting trace data...');
        let rawResponse = await sendRawCommand(device, 'data 0', onRaw);
        if (!rawResponse || rawResponse === 'Busy...' || rawResponse.startsWith('Error:') || rawResponse.length < 5) {
            rawResponse = await sendRawCommand(device, 'scan', onRaw);
        }
        if (!rawResponse || rawResponse === 'Busy...' || rawResponse.startsWith('Error:') || rawResponse.length < 5) {
            rawResponse = await sendRawCommand(device, 'frequencies', onRaw);
        }

        if (!rawResponse || rawResponse === 'Busy...' || rawResponse.startsWith('Error:')) {
            if (onStatus) onStatus(`TinySA read status: ${rawResponse}`);
            return [];
        }

        const scanData: ScanDataPoint[] = [];
        const lines = rawResponse.split(/[\r\n]+/);

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('data') || trimmed.includes('tinysa>') || trimmed.includes('ch>') || trimmed.includes('nanovna>') || trimmed.endsWith('>')) continue;

            const parts = trimmed.split(/\s+/);
            if (parts.length === 2) {
                const v1 = parseFloat(parts[0]);
                const v2 = parseFloat(parts[1]);
                if (!isNaN(v1) && !isNaN(v2) && v1 > 100000 && v2 >= -200 && v2 <= 100) {
                    scanData.push({ freq: v1 / 1000000, amp: v2 });
                    continue;
                }
            }

            for (const part of parts) {
                const amp = parseFloat(part);
                if (!isNaN(amp) && amp >= -200 && amp <= 100) {
                    scanData.push({ freq: 0, amp });
                }
            }
        }

        const numPoints = scanData.length;
        if (numPoints === 0) {
            if (onStatus) onStatus('TinySA trace returned 0 points');
            return [];
        }

        // Assign linear frequencies if frequencies were not embedded
        if (scanData[0].freq === 0) {
            const step = (endFreq - startFreq) / Math.max(1, numPoints - 1);
            for (let i = 0; i < numPoints; i++) {
                scanData[i].freq = startFreq + (i * step);
            }
        }

        if (onStatus) onStatus(`Trace complete: ${numPoints} points`);
        return scanData;
    } catch (error: any) {
        let message = error.message;
        if (message.includes('The port is closed')) {
            message = 'TinySA device disconnected. Please reconnect the device.';
        }
        console.error('TinySA Read Error:', message);
        if (onStatus) onStatus(`Trace Error: ${message}`);
        return [];
    }
}

export async function captureTinySAScreen(device: SerialDevice, onStatus?: (status: string) => void): Promise<string | null> {
    if (isBusy) return null;
    isBusy = true;
    
    const { writer } = device;
    
    try {
        if (onStatus) onStatus('Clearing buffer...');
        await clearBuffer(device);

        if (onStatus) onStatus('Sending capture command...');
        const command = "capture\r";
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(command));

        let receivedBytes = 0;
        let totalBmpBytes = 153654; // Default for TinySA
        const chunks: Uint8Array[] = [];
        let foundBM = false;
        let accumulated = new Uint8Array(0);

        let timeoutId: any;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('TinySA Capture Timeout')), 30000);
        });

        const readPromise = (async () => {
            try {
                while (true) {
                    const { value, done } = await safeRead(device);
                    if (done) break;
                    
                    if (!foundBM) {
                        const merged = new Uint8Array(accumulated.length + value.length);
                        merged.set(accumulated);
                        merged.set(value, accumulated.length);
                        accumulated = merged;

                        let bmIndex = -1;
                        for (let i = 0; i < accumulated.length - 1; i++) {
                            if (accumulated[i] === 0x42 && accumulated[i+1] === 0x4D) {
                                bmIndex = i;
                                break;
                            }
                        }

                        if (bmIndex !== -1) {
                            foundBM = true;
                            const validData = accumulated.slice(bmIndex);
                            
                            // Try to read size from BMP header (offset 2, 4 bytes)
                            if (validData.length >= 6) {
                                const size = validData[2] | (validData[3] << 8) | (validData[4] << 16) | (validData[5] << 24);
                                if (size > 100000 && size < 1000000) {
                                    totalBmpBytes = size;
                                }
                            }
                            
                            chunks.push(validData);
                            receivedBytes += validData.length;
                            if (onStatus) onStatus(`Header found. Expecting ${totalBmpBytes} bytes...`);
                        } else {
                            if (onStatus) {
                                const hex = Array.from(accumulated.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ');
                                onStatus(`Searching... Got: ${hex}`);
                            }
                        }
                    } else {
                        chunks.push(value);
                        receivedBytes += value.length;
                        if (onStatus && receivedBytes % 10000 < value.length) {
                            onStatus(`Receiving: ${Math.round((receivedBytes / totalBmpBytes) * 100)}%`);
                        }
                    }
                    
                    if (foundBM && receivedBytes >= totalBmpBytes) break;
                }
            } finally {
                clearTimeout(timeoutId);
            }
        })();

        try {
            await Promise.race([readPromise, timeoutPromise]);
        } catch (err) {
            await recreateDeviceReader(device);
            try { await readPromise; } catch (e) {}
            throw err;
        }

        if (receivedBytes < totalBmpBytes) {
            if (onStatus) onStatus(`Incomplete data: ${receivedBytes}/${totalBmpBytes}`);
            return null;
        }

        if (onStatus) onStatus('Processing image...');
        const fullData = new Uint8Array(totalBmpBytes);
        let offset = 0;
        for (const chunk of chunks) {
            const toCopy = Math.min(chunk.length, totalBmpBytes - offset);
            fullData.set(chunk.slice(0, toCopy), offset);
            offset += toCopy;
            if (offset >= totalBmpBytes) break;
        }

        const blob = new Blob([fullData], { type: 'image/bmp' });
        return new Promise((resolve) => {
            const fileReader = new FileReader();
            fileReader.onloadend = () => {
                if (onStatus) onStatus('Done');
                resolve(fileReader.result as string);
            };
            fileReader.readAsDataURL(blob);
        });
    } catch (error: any) {
        let message = error.message;
        if (message.includes('The port is closed')) {
            message = 'TinySA device disconnected. Please reconnect the device.';
        }
        console.error('TinySA Capture Error:', message);
        if (onStatus) onStatus(`Error: ${message}`);
        return null;
    } finally {
        isBusy = false;
    }
}

export function generateMockScanData(startFreq: number, endFreq: number, points: number = 200): ScanDataPoint[] {
    const data: ScanDataPoint[] = [];
    const step = (endFreq - startFreq) / points;
    
    // Create some "TV Channels" with higher noise
    const noiseBands = [
        { center: 500, width: 8, amp: -65 },
        { center: 550, width: 8, amp: -50 },
        { center: 620, width: 8, amp: -75 },
        { center: 680, width: 8, amp: -60 }
    ];

    for (let i = 0; i <= points; i++) {
        const freq = startFreq + i * step;
        // Base noise floor with high-frequency jitter
        let amp = -108 + Math.random() * 4; 

        noiseBands.forEach(band => {
            if (freq >= band.center - band.width/2 && freq <= band.center + band.width/2) {
                // Add structured noise within TV bands
                const dist = Math.abs(freq - band.center) / (band.width / 2);
                const shape = Math.cos(dist * Math.PI / 2);
                amp = band.amp + (shape * 15) + (Math.random() * 8);
            }
        });

        // Add some random spikes (mics) that persist or flicker
        if (Math.random() > 0.99) {
            amp = -35 + Math.random() * 15;
        }

        data.push({ freq, amp });
    }

    return data;
}
export const disconnectTinySA = disconnectDevice;
export const disconnectRFExplorer = disconnectDevice;
function formatDbm(dbm: number): string {
    const sign = dbm < 0 ? '-' : '+';
    const absVal = Math.abs(dbm);
    return sign + absVal.toString().padStart(3, '0');
}

function sendRFExplorerCommand(payload: string): Uint8Array {
    const encoder = new TextEncoder();
    const payloadBytes = encoder.encode(payload);
    const totalLength = payloadBytes.length + 2; // +1 for '#', +1 for size byte
    const commandBytes = new Uint8Array(totalLength);
    commandBytes[0] = 0x23; // '#'
    commandBytes[1] = totalLength; // size byte
    commandBytes.set(payloadBytes, 2);
    return commandBytes;
}

export async function readRFExplorerScan(device: SerialDevice, startFreq: number, endFreq: number, points: number = 112, onStatus?: (status: string) => void, onRaw?: (data: string) => void): Promise<ScanDataPoint[]> {
    // Forward callbacks to device object so background loop can use them
    device.onStatus = onStatus;
    device.onRaw = onRaw;

    const { writer } = device;
    
    try {
        // Initialize tracking of the UI range we are working with
        if (device.lastUiStartFreq === undefined || device.lastUiEndFreq === undefined) {
            device.lastUiStartFreq = startFreq;
            device.lastUiEndFreq = endFreq;
            device.lastConfiguredStartFreq = startFreq;
            device.lastConfiguredEndFreq = endFreq;
        }

        // 1. If user actually changed the range from the UI (i.e. startFreq/endFreq passed from UI are different from our tracked lastUiStartFreq/lastUiEndFreq)
        if (Math.abs(startFreq - device.lastUiStartFreq) > 0.001 || Math.abs(endFreq - device.lastUiEndFreq) > 0.001) {
            if (onStatus) onStatus(`Configuring frequency range from UI: ${startFreq} - ${endFreq} MHz...`);
            
            const startFreqKhz = Math.round(startFreq * 1000);
            const endFreqKhz = Math.round(endFreq * 1000);
            const startFreqStr = startFreqKhz.toString().padStart(7, '0');
            const endFreqStr = endFreqKhz.toString().padStart(7, '0');
            const ampTopStr = formatDbm(-10); // Use -10 instead of -20 for more headroom
            const ampBottomStr = formatDbm(-120);
            
            const payload = `C2-F:${startFreqStr},${endFreqStr},${ampTopStr},${ampBottomStr},00112`;
            const commandBytes = sendRFExplorerCommand(payload);
            
            if (writer) {
                await writer.write(commandBytes);
            }
            device.lastConfiguredStartFreq = startFreq;
            device.lastConfiguredEndFreq = endFreq;
            device.lastUiStartFreq = startFreq;
            device.lastUiEndFreq = endFreq;
            
            // Clear previous sweep to ensure we get a fresh one for the new frequencies
            device.latestSweep = undefined;
            
            // Give device some time to process configuration change (precalibration)
            await new Promise(r => setTimeout(r, 200));
            
            // Reset streaming state so we re-request sweep stream
            device.streamRequested = false;
        }

        // 2. Request configuration and sweep stream with C0 if not already requested
        if (!device.streamRequested && writer) {
            if (onStatus) onStatus('Requesting sweep stream...');
            const commandBytes = sendRFExplorerCommand("C0");
            await writer.write(commandBytes);
            device.streamRequested = true;
            await new Promise(r => setTimeout(r, 50));
        }

        // 3. Return the latest sweep if available, or wait a short time for one to arrive
        if (device.latestSweep && device.latestSweep.length > 0) {
            if (onStatus) onStatus(`Receiving sweep data: ${device.latestSweep.length} points`);
            return device.latestSweep;
        }

        // Wait up to 500ms for first sweep to arrive
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 50));
            if (device.latestSweep && device.latestSweep.length > 0) {
                if (onStatus) onStatus(`Receiving sweep data: ${device.latestSweep.length} points`);
                return device.latestSweep;
            }
        }

        if (onStatus) onStatus('Waiting for sweep data from RF Explorer...');
        return [];

    } catch (error: any) {
        let message = error.message;
        if (message.includes('The port is closed')) {
            message = 'RF Explorer device disconnected. Please reconnect the device.';
        }
        console.error('RF Explorer Read Error:', message);
        if (onStatus) onStatus(`Trace Error: ${message}`);
        // Reset state so we can recover on next attempt
        device.streamRequested = false;
        return [];
    }
}
