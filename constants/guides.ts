
import { AppCategory } from '../types';

export interface GuideSection {
    title: string;
    description: string;
    steps?: string[];
    tips?: string[];
    physics?: string;
    markdown?: string;
}

export const CATEGORY_GUIDES: Record<AppCategory, GuideSection[]> = {
    calculator: [
        {
            title: "The Analytical Workspace vs. Standard Calculators",
            description: "Most web-based RF tools use static 'one-size-fits-all' guard bands that lead to spectral waste. Our Analytical Workspace performs real-time combinatorial analysis, modeling every possible carrier interaction. This creates a 'Virtual Spectrum' where you can stress-test high-density plans against the laws of non-linear physics before a single transmitter is powered on.",
            steps: [
                "Enter frequencies with 1Hz precision to model exact hardware tuning.",
                "Assign labels to map your digital twin to physical rack positions.",
                "Utilize 'Linear Mode' for modern digital systems like Shure Axient, bypassing legacy IMD floors to increase yield by up to 40%.",
                "Run the Audit to visualize SNR (Signal-to-Noise Ratio) probability."
            ],
            tips: [
                "Use the 'Seed' function to reset to scientifically vetted guard parameters.",
                "Take snapshots to iterate through multiple 'What-If' scenarios without losing your baseline."
            ],
            physics: "The engine models the 3rd-order 'Ghost Signals' (2f1-f2 and f1+f2-f3) generated in the non-linear junctions of antenna multicouplers and receiver front-ends. By calculating the power sum of these products, we predict interference probability with laboratory accuracy."
        },
        {
            title: "Monte Carlo Stochastic Seeking",
            description: "When the spectral puzzle exceeds human capacity, our engine employs a Monte Carlo search algorithm. While other tools use 'Brute Force' which often hits dead ends in crowded spectrum, our engine seeks the 'Path of Least Resistance', finding solutions that maintain the highest possible Signal-to-Noise headroom for every channel.",
            steps: [
                "Define 'Immutable' constraints—fixed frequencies that the engine must work around.",
                "Set your target yield. The engine will run 5,000 internal trials per request.",
                "Monitor the 'Yield vs. Density' ledger to identify which equipment profiles are causing spectral bottlenecks."
            ],
            tips: [
                "If yield is low, try 'Aggressive' spacing for non-critical channels like tech-comms.",
                "Our 'Symmetry Logic' ensures that even in high-density modes, your carriers remain centered in their assigned filters."
            ]
        },
        {
            title: "Multi-Band & TV White Space Integration",
            description: "Modern RF environments require coordinating across multiple frequency bands while dodging DTV interference. The Multi-Band and TV Channels tabs let you define complex operating windows and protect them against local television broadcasts.",
            steps: [
                "Open the TV Channels tab to perform a localized scan using your postcode or coordinates.",
                "Click on individual TV channels to cycle their exclusion state: Available (Green), Blocked (Red), Mic Only (Blue), IEM Only (Amber), or Both (Purple).",
                "Switch to the Multi-Band tab to define distinct frequency pools for different equipment classes.",
                "The engine automatically subtracts your blocked TV channels from the available multi-band spectrum, ensuring your generator only picks legal, clean frequencies."
            ],
            tips: [
                "Dedicate specific TV channels exclusively to IEMs (Amber) to physically separate them from microphone spectrum, reducing broadband noise floor issues.",
                "Use the 'Block All' feature in the TV tab, then selectively open only the channels you have verified as clean with an RF scanner."
            ]
        }
    ],
    coordination: [
        {
            title: "Festival Coordination: The Masterclass",
            description: "Welcome to the pinnacle of large-scale RF planning. Standard calculators treat your entire festival site as a single, crowded room, leading to artificial spectrum exhaustion. We built this engine differently. We treat your venue as a physical, spatiotemporal landscape. By understanding the exact distances between your stages and the times acts are performing, our engine 'recycles' frequencies, achieving massive reuse that would otherwise be mathematically impossible. Prepare to coordinate like a true RF architect.",
            markdown: `**Festival Frequency Coordination – Technical User Guide**

This guide provides a complete, technically structured workflow for RF engineers using the Festival Frequency Coordination system. It covers site setup, spectrum preparation, act configuration, frequency calculation, and advanced verification tools.

---

### **1. Site Setup & Stage Configuration**

#### **1.1 Define Stages**
1. In **Festival Setup & Topology**, specify the number of stages.  
2. Assign a name to each physical stage (e.g., *Main Stage*, *Acoustic Tent*).  
3. Repeat until all stages are defined.

#### **1.2 Upload & Calibrate the Sitemap**
1. Select **Sitemap** from the header.  
2. Upload your sitemap (PDF or image).  
3. Each stage appears on the left with a draggable marker.  
4. Drag each marker to its correct position on the map.  
5. Measure the real‑world distance between two stages using:
   - The printed scale on the map, or  
   - Google Maps / Google Earth.  
6. Select **Set Scale**, click the two stage markers, and enter the measured distance.  
7. The system calculates a *pixels‑per‑metre* scale and automatically computes all inter‑stage distances.  
8. (Recommended) Delete the sitemap using the red button to conserve memory.  
9. Open **Site Coordinator** to view the generated **Stage Distance Matrix**.

---

### **2. TV Spectrum Preparation**

#### **2.1 Multi-State TV Grid Configuration**
1. Enter the venue’s **postcode**, **grid reference**, or **latitude/longitude**.  
2. Select **Lookup** to retrieve local DTV transmitter data.  
3. Channels are categorised as:
   - **Red** – Main service transmitter (avoid)  
   - **Amber** – Moderate DTV activity  
   - **Green** – Low‑power relay  
   - **Blocked** – Low‑level DTV activity detected  
4. Click on TV channels in the grid to cycle through exclusion states and dedicate spectrum:
   - **Available (Green)** – Open for any equipment
   - **Mic Only (Blue)** – Strictly reserved for Microphones
   - **IEM Only (Amber)** – Strictly reserved for In-Ear Monitors
   - **Both (Purple)** – Dedicated to both Mics and IEMs
   - **Blocked (Red/Slate)** – Excluded from calculation  

#### **Channel Clearance Logic**
The system compares:
- TV transmitter field strength at distance *d* from your site
- Microphone field strength at 20 m from transmitter to receiver

Rules:
- If the TV field strength exceeds the mic/IEM field strength by **≥ 40 dB**, the channel is **unusable**.  
- Microphone field strength must exceed all TV channels by:
  - **40 dB** outdoors  
  - **30 dB** indoors  

A red channel with a **green bar** indicates extremely low TV power; the microphone may still dominate.

---

### **3. Live Site Scan Integration**

#### **3.1 Importing CSV Scan Data**
If you have pre‑scanned RF data:
- Select **Import CSV**  
- The scan populates the **Live Site Scan Integration** window  
- TV channels update automatically based on detected peaks  

#### **3.2 Connecting a TinySA Spectrum Analyser**
1. Connect the TinySA via USB‑C.  
2. Select **Connect Device**.  
3. Choose the device and connect.  
4. Live scan data appears in the integration window.

**Using Scan Data**
- Clear previous data using **Clear All** in the TV Grid.  
- Adjust the **exclusion limit line** (e.g., –85 dBm).  
- Any peak above this threshold automatically blocks its corresponding TV channel.  
- The system identifies the cleanest available spectrum.

---

### **4. Constant TX & House Systems**

#### **4.1 Adding Constant Transmitters**
1. Navigate to **Constant TX**.  
2. For each stage, select **Add** and define:
   - Equipment type  
   - Number of mic frequencies  
   - Number of IEM frequencies  

If the equipment type is not listed:
- Select **Custom Range (User Defined)**  
- Enter the tuning range manually  

#### **4.2 Bespoke Parameters**
Custom spacing and behaviour can be defined for house systems.

#### **4.3 Frequency Behaviour**
- Constant TX frequencies - calculated to be fully intermodulation‑free with all acts and house systems.  
- House systems - calculated to be fully intermodulation‑free with Constant TX frequencies and channel spaced from act frequencies.

---

### **5. Performing Acts**

#### **5.1 Adding Acts**
You may:
- Select **Add Act** manually, or  
- Import a running order via the **AI Scheduler Importer**

**Manual Entry**
Select **Expand** on the Act card and enter:
- Act Name  
- Stage  
- Day  
- Start Time  
- Finish Time  
- Required mics & IEMs  

**Importing a Running Order**
1. Select **Import Running Order**.  
2. Set the event date on the AI Scheduler Importee.  
3. Upload the running order document.  
4. The AI extracts:
   - Act name  
   - Day  
   - Stage  
   - Start/finish times  
5. Only acts matching the selected date are highlighted, all other acts and dates will be greyed out.  
6. Select **Sync to Plan** to import them into Performing Acts page.

#### **5.2 Act Frequency Requirements**
Expand each act to configure:
- Microphone quantities  
- IEM quantities  
- Equipment types  

In the act card the House RF Policy can be defined:
- Mute All - Mutes all house system frequencies on that stage, clearing additional spectrum for the performing act
- Mute Mics - Mute house system mics if the act is bringing their own mics but using house system IEMs
- Mute IEMs - Mute house system IEMs if the act is bringing their own IEMs but using house system mics

The House IEMs IMD-Free with act mics and House mics IMD-Free with act IEMS boxes will be ticked by default. 
These can be kept ticked to provide the most robust frequency set for acts, with the act frequencies IMD compatible with house system and Constant TX frequencies

---

### **6. Global Act Tools**

#### **6.1 Add Mic / Add IEM to All**
If all acts require RF:
- Select **Add Mic to All**  
- Select **Add IEM to All**  

This assigns a mic and IEM card to every act automatically.

#### **6.2 Sticky Header & Frequency Locking**
- **Unstick**: Enables a persistent header for easier navigation.  
- **Unlock**: Locks/unlocks all frequencies for acts, Constant TX, and House Systems.

---

### **7. Festival Handoff & Timing Tools**

#### **7.1 Live Handoff**
- Select **Live Handoff** on any act.  
- Generate a secure, read‑only link.  
- Create a QR code.  
- Optionally assign a **global 4‑digit PIN**.

#### **7.2 Act‑Specific QR Codes**
- Generate QR codes per act (S/M/L).  
- Assign unique PINs.  
- Prevents cross‑access between acts.

#### **7.3 Print All Act QR Codes**
Generates a printable sheet containing all act QR codes for backstage use.

**Detailed QR Code Behaviour**
- Global PIN: applies to all acts  
- Act‑specific PIN: applies only to the selected act  
- Crew must enter the PIN after scanning the QR code  
- Prevents unauthorised access to other acts’ frequency lists  

#### **7.4 Time Overlap Buffer**
Defines whether acts are treated as simultaneous:

- If **gap ≤ buffer** → acts are treated as overlapping → fully intermod‑free  
- If **gap > buffer** → acts calculated independently  
- Consecutive acts always receive a **250 kHz separation buffer**

#### **7.5 Manual Exclusions**
Specify frequency ranges to avoid:
- Other spectrum users  
- Intentional guard bands  

The engine will not place any mic or IEM frequencies in excluded ranges.

#### **7.6 Act Order**
Use the **+ / –** buttons to define running order:
- Act 1 = opener  
- Highest number = headliner  

**Technical Behaviour**
- Consecutive acts (1→2, 2→3, 3→4…) are treated as sequential  
- Non‑adjacent acts (1→3, 2→4, 3→6…) are treated as non‑overlapping  
- Frequencies from non‑adjacent acts may be reused safely  

---

### **8. Engine Controls**

#### **8.1 Calculation Strategies**
**Standard Mode**
- Monte‑Carlo shuffle  
- Randomised frequency searching  
- Ideal for finding gaps in congested spectrum  

**High‑Density Mode**
- Packs frequencies tightly from the bottom of the tuning range upward  
- Ideal for high channel counts  

#### **8.2 Calculation Passes**
If insufficient frequencies are found:
- Increase passes: **1**, **5**, **20**, **50**

#### **8.3 Exporting**
- **Export RF Plan** (PDF, Excel, text)  
- **Export Mics** / **Export IEMs** (Workbench‑ready formats)

---

### **9. Unified Site Spectral View**

A comprehensive visualisation tool showing:
- All act frequencies  
- Constant TX  
- House systems  
- Intermodulation products  
- TV channels  

#### **9.1 Navigation & Display**
- Toggle visibility of stages, intermods, labels  
- Zoom in/out  
- Adjust centre frequency  
- Drag left/right using grab‑hand or navigator  

#### **9.2 Intermodulation Analysis**
1. Activate two groups (e.g., Constant TX + House Systems).  
2. Select **Run Focus Audit**.  
3. The system reports:
   - No clashes  
   - Mathematical clashes (often not physically significant due to front‑end attenuation)

#### **9.3 Re‑calculation Options**
If undesirable interactions appear:
- Recalculate to compress frequencies  
- Or export to Wireless Workbench, CSV, XLSX, PDF, or TXT formats via the master Export menu for verification and distribution  

#### **9.4 Specialized IMD Audit**
1. Ensure you have active frequencies on at least two systems (e.g., a Touring Act and a House System).
2. Select **Run Specialized Audit** to test specific combinations.
3. Choose the Act system (e.g., Touring Mic) to test against a House system (e.g., House IEM).
4. The engine isolates these specific components and computes direct interference, ensuring critical touring systems don't compromise local house monitors.

**Technical Notes**
- Intermodulation products 80–120 kHz apart may appear mathematically but are often not physically generated due to receiver front‑end attenuation.  
- Hovering over any frequency displays the contributing carriers.  
- Labels, two‑tone and three‑tone products, and TV channels can be toggled on/off for clarity.`
        }
    ],
    multizone: [
        {
            title: "Exhibition & High-Density Coordination: The Masterclass",
            description: "Trade shows, corporate campuses, and exhibition halls are RF warzones. You are tasked with cramming hundreds of wireless channels into a single building, often with exhibitors bringing rogue, uncoordinated gear. This module is your ultimate weapon. It treats every booth or breakout room as an isolated 'RF Island', utilizing structural shielding and proximity logic to squeeze more gear into the air than any standard calculator could ever permit.",
            steps: [
                "1. DEFINE ZONES: Scroll to 'Exhibition Zones & Booths'. Click '+ Add Zone' for every booth, breakout room, or area requiring wireless. Name them clearly (e.g., 'Booth 101', 'Room A').",
                "2. CONFIGURE EQUIPMENT: Add equipment to each zone. If you are deploying 20 identical breakout rooms, use the 'Clone Group' feature to instantly duplicate your standard gear rack across multiple zones—saving you hours of manual entry.",
                "3. DEFINE PROXIMITY: Scroll to the 'Distance Matrix (m)'. In indoor environments, walls and structures absorb RF energy. Enter the physical distances between booths. The engine uses this to calculate 'Walk-over' interference, allowing booths that are far apart to safely reuse the same spectrum.",
                "4. LOCK VIP FREQUENCIES: If a major exhibitor arrives with a rack of gear locked to specific frequencies, use 'Fixed Frequency Injections' to assign their exact frequencies to their zone. The engine will seamlessly weave the rest of the show around them.",
                "5. SET GLOBAL EXCLUSIONS: Block out local DTV channels in the 'TV Channel' section. Use 'Manual Exclusions' to globally ban specific frequencies (like venue-wide security comms) from being assigned to any booth.",
                "6. EXECUTE CALCULATION: Click 'GENERATE MULTI-EQUIPMENT PLAN'. The engine will perform a highly aggressive, high-density combinatorial analysis, prioritizing Signal-to-Noise Ratio (SNR) protection over total IMD elimination—the only way to survive a trade show.",
                "7. EXPORT INDIVIDUAL PLANS: The master CSV is great for you, but exhibitors only care about their own gear. Use the 'WWB Group Export' or individual zone exports to hand each booth their own custom, pre-validated frequency file."
            ],
            tips: [
                "Use the 'Global Separation' tool above the Distance Matrix to quickly set a default baseline distance (e.g., 15m) between all booths, then manually adjust the adjacent ones.",
                "Coordination for trade shows is a battle of 'SNR Protection'. The noise floor is incredibly high. Ensure your transmitters are close to their receivers to overcome the ambient RF hash.",
                "If you run out of spectrum, switch your digital gear to 'Linear Mode' (if supported, like Shure Axient). This bypasses legacy IMD floors and increases yield by up to 40%."
            ],
            physics: "This module relies on Free-Space Path Loss (FSPL) combined with structural attenuation assumptions. By calculating the energy drop-off between booths, the engine determines the exact moment a signal from Booth A drops below the noise floor of Booth B. Once that threshold is crossed, the engine safely reassigns that exact same frequency to Booth B, maximizing spectral efficiency."
        }
    ],
    analysis: [
        {
            title: "Visual Verification Laboratory",
            description: "A high-fidelity bridge between your mathematical plan and the physical reality of the airwaves. While most tools show static lines, our 'Live Trace' simulation models real-world carrier skirts and noise floors. View your 'Ghost Products' overlaid on real-world noise for instant troubleshooting of onsite anomalies.",
            steps: [
                "Import CSV/TXT scan data from handheld scanners, OR connect directly via USB.",
                "To connect hardware: Click 'Connect Device' in the Analyzer, select your serial port, and choose the correct baud rate (e.g. 115200 for TinySA, 500000 for RF Explorer).",
                "Ensure your browser supports the Web Serial API (e.g., Chrome or Edge).",
                "Toggle 'Load Gen' to see where your coordinated carriers sit relative to the noise floor.",
                "Enable '2-Tone' and '3-Tone' overlays. If an IMD line matches a real-world energy spike, your hardware is mixing.",
                "Use 'Peak Hold' to catch intermittent 'Rogue' interference from roving ENG crews or bad cables."
            ],
            tips: [
                "Use 'Snap-to-Signal' tooltips for precise, Hz-level investigation of interference spikes.",
                "Narrow your span to <1MHz to check the skirts of your digital carriers for 'Slope Leakage'."
            ]
        }
    ],
    comms: [
        {
            title: "Talkback & Zonal Comms: The Masterclass",
            description: "Communication systems (like Riedel Bolero, Clear-Com, or analog two-ways) are the 'bullies' of the RF world. Their base stations transmit continuously at incredibly high power (often up to 2 Watts). If placed too close to your delicate wireless microphones, they will generate massive intermodulation products that destroy your audio. This module is engineered specifically to isolate and coordinate these high-power systems, keeping your comms crystal clear and your microphones safe.",
            steps: [
                "1. DEFINE BANDS: At the top, define your 'Base TX Band' (the frequencies the base station blasts out to the beltpacks) and your 'Port RX Band' (the frequencies the beltpacks whisper back to the base). Keep these bands as far apart as physically possible.",
                "2. CONFIGURE ZONES: Scroll to 'Talkback Zones'. For a single setup, just use one zone. For massive events (Olympics, multi-stage festivals), click '+ Add Zone' for every physical location that has a base station (e.g., 'Main Stage Comms', 'Broadcast Compound').",
                "3. ADD CHANNELS: Inside each Zone, click '+ Add TX' for your continuous base station transmitters, and '+ Add RX' for your beltpack receivers.",
                "4. DEFINE PROXIMITY: Scroll to the 'Distance Matrix (m)' and enter the physical distance between your comms zones. This is critical for our 'IMD Compatibility Relaxation' algorithm. If two base stations are more than 25 meters apart, the engine can drastically relax the spacing rules and reuse spectrum.",
                "5. SET GLOBAL EXCLUSIONS: Block out local DTV channels and enter any 'Manual Exclusions' (like local police or aviation frequencies) that you must absolutely avoid.",
                "6. EXECUTE CALCULATION: Click 'GENERATE ZONAL PLAN'. The engine will calculate a master plan that reuses frequencies across distant zones while keeping local zones completely, mathematically intermod-free.",
                "7. EXPORT RESULTS: Review the 'Coordination Results' for a zone-by-zone breakdown, and export your CSV for deployment."
            ],
            tips: [
                "Receiver sensitivity is your priority. A tiny -95dBm IMD product can break the squelch of a base station and cause maddening 'Static' noise in everyone's headset. Give your RX band the cleanest spectrum.",
                "Maintain at least 150kHz of offset between base TX carriers. This minimizes heat build-up and non-linear mixing inside your expensive antenna combiners.",
                "Distance is your ultimate weapon. Moving a base station antenna just 10 meters further away from your microphone receivers can solve 90% of your intermod problems."
            ],
            physics: "Mixing efficiency follows a non-linear power curve. At 25 meters, the energy from a 50mW beltpack has dropped by approximately 53dB compared to its level at 10cm. This is the 'Conversion Loss Boundary'. If aggressor signals reach the non-linear stage (the receiver front-end) at levels below -40dBm, the resulting 3rd-order IMD products sit safely below the thermal noise floor of professional receivers. Our engine dynamically calculates this boundary, relaxing IMD constraints for distant zones to unlock unprecedented spectral density."
        },
        {
            title: "The Physics of Frequency Reuse Offsets",
            description: "Harness the power of precision frequency offsets based on real-world Adjacent Channel Rejection (ACR) measurements. Not all reuse is equal; we use specific scientific benchmarks to determine the minimum safe distance for different frequency offsets.",
            steps: [
                "25kHz Offset: The 'Critical Limit'. Requires >400m of separation due to standard receiver filter slopes.",
                "50kHz - 100kHz Offset: The 'Buffer Zone'. Safe for stages 75m to 150m apart.",
                "150kHz Offset: The 'Reuse Sweet Spot'. Our measurements show this provides ~40dB of isolation advantage, allowing reuse at only 25m."
            ],
            tips: [
                "Use the 150kHz rule to pack 'Wireless Intercom' channels on separate trucks in a dense OB compound.",
                "Check the 'Audit Ledger' to see which 'Spatial Rejections' occurred—this highlights your site's physical bottlenecks."
            ],
            physics: "These methods are derived from the 'Capture Effect' of FM and digital signals. By ensuring the interfering signal is at least 20dB below the wanted signal at a given frequency offset, the receiver can successfully 'Capture' and demodulate the clean audio without interference."
        },
        {
            title: "Advanced Zonal Talkback",
            description: "A specialized module for generating site-wide comms plans across multiple isolated zones. Zonal Talkback handles independent RX/TX bases and walkies while reusing spectrum wherever possible.",
            steps: [
                "Add distinct zones (e.g., 'Broadcast', 'Main Stage') representing physical comms hubs.",
                "Enter distances between zones in the cross-matrix. Distant zones automatically benefit from relaxed IMD guard spacing.",
                "Configure your Base TX (Transmit) and Walkie RX (Receive) bands at the top.",
                "Assign equipment to each zone: Base Transmitters or Simplex Walkies.",
                "Generate the Zonal Plan. The engine will allocate the tightest IMD-safe frequencies across all your zones, prioritizing isolation for Base TX."
            ],
            tips: [
                "Zonal Talkback automatically ignores TX-to-TX IMD products between distant base stations since they don't intermodulate in a receiver.",
                "Use the interactive 1D Timeline to visually inspect the resulting comms allocations for conflicts."
            ]
        }
    ],
    toolkit: [
        {
            title: "High-Fidelity Physics Simulators",
            description: "A sandbox for visualizing complex RF interactions. These tools allow you to 'See' the invisible energy interactions that cause hardware failure.",
            steps: [
                "Co-Channel Lab: Drag the interferer to see the 'Capture Effect' radius. Toggle the Wanted Mic ON/OFF to see how squelch dynamics change.",
                "IMD Physics Demo: Manipulate three source carriers and watch as 3rd-order intermod products 'grow' and 'shrink' in the spectrum.",
                "Proximity Simulator: Model high-density OB compounds. Move trucks and antennas to see how spatial isolation prevents transmitter mixing."
            ],
            tips: [
                "The Co-Channel Lab is the best way to explain 'Safe Separation' to stage managers.",
                "In the IMD Demo, cluster the frequencies close together to see the exponential increase in spectral congestion."
            ],
            physics: "These sims model 3rd Order Intermodulation (2f1-f2) and the conversion loss of non-linear junctions. We use a 3dB slope for IMD growth—for every 1dB increase in transmitter power, the IMD product grows by 3dB."
        },
        {
            title: "Frequency Forensics & Diagnostics",
            description: "Engineered to reverse engineer third-party frequency lists to identify spacing rules, hardware thresholds, and underlying intermodulation constraints.",
            steps: [
                "1. IMPORT DATA: Paste raw frequency values into the analyzer. Each value must be on a new line.",
                "2. CHANNELS & SPACING: The engine automatically extracts and compares the channel-to-channel spacing to detect standard manufacturer profiles (e.g., Duet, Axient).",
                "3. DETECT CONSTRAINTS: Uncover hidden intermodulation grids and safety margins configured by previous coordinators to understand their exact safety margins.",
                "4. RESOLVE CONFLICTS: Flag overlapping frequencies, proximity violations, and out-of-band carriers that violate spectral licensing limits."
            ],
            tips: [
                "Always run forensics on unknown competitor frequency plans to find where they left spectral margins you can use.",
                "Forensics is the perfect tool for auditing legacy venue files from years past to ensure they meet modern linear digital system standards."
            ],
            physics: "The engine runs reverse-spacing matrix audits, performing combinatorial delta-checks on every frequency pair and tri-tone set to find the maximum common divisor, which reveals the grid spacing."
        }
    ],
    hardware: [
        {
            title: "The Authoritative Logic Library",
            description: "Manage the 'Physics Profiles' of your gear. Unlike tools that hide their logic, we give you full control over the engine's 'Brain'. Define how aggressive your guards should be based on your specific deployment environment.",
            steps: [
                "Customize 'FF Guard' (Fundamental-to-Fundamental). Standard is 350kHz for analogue, 200kHz for digital.",
                "Set IMD guards—100kHz for 'Robust' touring, 50kHz for 'Aggressive' festival environments.",
                "Use the 'Global Patch' to add a safety buffer to your entire inventory before a high-stakes show."
            ],
            tips: [
                "The 'Permanent Inventory' (USER_INVENTORY) in the source code is your touring 'Bible'. Hardcode your rack there to bypass browser cache clears.",
                "High-end digital systems like Sennheiser D6000 or Shure AD can often operate with 'Zero' 3-Tone guard if linear mode is properly configured."
            ]
        }
    ],
    tour: [
        {
            title: "Touring Synchronization Engine",
            description: "Designed for acts traveling across multiple regions with a fixed equipment rack. This module distinguishes between 'Constant Transmits' (gear that stays the same every day) and 'Local Requirements' (gear that adapts to the local RF environment).",
            steps: [
                "Define your 'Constant Transmits'—these are coordinated first and remain locked across all tour stops.",
                "Add 'Tour Stops' for every venue on your itinerary.",
                "Group stops into 'Clusters' if they share the same RF environment (e.g., multiple shows in the same city).",
                "Configure local TV channel white space for each cluster to ensure legal compliance at every stop.",
                "Venue-Specific TV Environment: Each venue in the Itinerary section includes its own Multi-State TV Grid. Users can enter venue coordinates for each stop to fetch local TV transmitter data.",
                "Tour-Wide Strategy Analysis: In the Review step, a new Tour-Wide Channel Strategy card analyzes all venues to identify Common Primary, Secondary, and Tertiary channels available across the entire tour.",
                "Global Plan Integration: The 'Apply to Global Plan' button automatically configures the Global Gear TV grid based on the cross-venue analysis, prioritizing tour-safe channels.",
                "The Optimization Algorithm: The app looks for 'Golden Channels' (Primary at 100% of venues) and ranks channels by stability and density matching to ensure zero 'Hard Blocks'.",
                "Visual 'Heatmap' UI: The Smart Tour Channel Optimizer highlights the 'Optimum Path'—the specific channels that provide the most consistent floor for your coordination.",
                "Master Frequency Pool: The app generates a Master Tour Pool of frequencies based on the maximum gear needed at any single stop, ensuring consistency across the tour.",
                "Intelligent Reuse: When you click 'Calculate Tour Plan', the app assigns the exact same frequencies to gear at different venues if they are clear in both locations.",
                "Detailed Transmitter Tooltips: Hovering over the colored bars in the analysis grid reveals Transmitter Name, Max ERP (kW), and Distance (km) for that specific venue.",
                "User-Selected Channel Utilization: The 'Select Channel' column allows you to strictly limit the frequency calculation to only the channels you check.",
                "Equipment Type Assignment: You can designate specific channels for Microphones and others for IEMs, which the coordination engine will strictly respect.",
                "Handling Split Tours: If available channels are mutually exclusive across venues, the tool will mark them as blocked. In such cases, it's best to split the project into separate legs or use the optimizer to find compromise channels."
            ],
            tips: [
                "Constant Transmits are the 'Anchor' of your tour. Ensure they are coordinated with 'Robust' spacing to handle varying noise floors.",
                "Use the 'Calculate Tour Plan' button to run a global coordination that respects your global constants while optimizing for local white space."
            ],
            physics: "The engine uses a tiered coordination approach. Tier 1 (Constants) is calculated as a site-wide immutable block. Tier 2 (Local) is then calculated using the Tier 1 block as fixed aggressors, while also respecting the local TV channel masks defined for that specific cluster."
        }
    ],
    wmas: [
        {
            title: "WMAS Coordination",
            description: "Wireless Multichannel Audio Systems (WMAS) use wideband blocks instead of narrowband carriers. This module helps you allocate these blocks efficiently.",
            steps: [
                "Define your WMAS Nodes (e.g., 'Main Stage WMAS').",
                "Select a profile (e.g., Sennheiser 6MHz or 8MHz).",
                "Choose a mode (Low Latency, Standard, High Density) which affects link capacity.",
                "Use 'Auto-Assign' to find available blocks based on TV channel availability and spectrum data."
            ],
            tips: [
                "WMAS blocks are treated as exclusions for narrowband systems to prevent interference.",
                "Ensure your TV channel data is accurate for the location."
            ]
        }
    ],
    eventManagement: [],
    network: [
        {
            title: "Community Network",
            description: "Connect with other RF professionals, share knowledge, and collaborate on projects.",
            steps: [
                "Post updates, questions, or share RF plots.",
                "Like and comment on posts from other users.",
                "Attach images or select plots from your gallery to share."
            ],
            tips: [
                "Engage with the community to learn new techniques and best practices.",
                "Share your successful coordination plots to help others."
            ]
        }
    ],
    tvLookup: [
        {
            title: "TV Channel Lookup",
            description: "Find available TV channels based on location and clearance criteria.",
            markdown: "### How to use\n1. Select your region.\n2. Enter location details.\n3. Review occupied and available channels."
        }
    ],
    sandbox: []
};
