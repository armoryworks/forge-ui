/**
 * Static data pools for algorithmic variation across weeks.
 * Indexed with (weekIndex % pool.length) to get deterministic but varied data.
 */

export const COMPANIES = [
  // Precision machining shops
  'Precision Machined Parts LLC', 'Delta Fabrication Inc', 'Summit Tool & Die',
  'Keystone Metalworks', 'Cardinal Manufacturing', 'Ironwood Industries',
  'Pacific Precision Group', 'Lakeside CNC Solutions', 'Ridgeline Components',
  'Northstar Machine Works', 'Coastal Tooling Corp', 'Granite State Machining',
  'Redwood Precision Inc', 'Meadowbrook Fabricators', 'Silverline Manufacturing',
  'Harborview Industries', 'Crestview Metal Solutions', 'Pinecrest Machining',
  'Bayshore Components LLC', 'Westfield Tool & Manufacturing',
  // Aerospace & defense
  'Apex Aerospace Components', 'Vanguard Defense Systems', 'Orion Machined Parts',
  'Stratosphere Precision', 'Atlas Aerospace Parts', 'Meridian Defense LLC',
  'Starfield Machining Inc', 'Zephyr Aero Components', 'Thunderbolt Industries',
  'Falcon Precision Group',
  // Medical device
  'Medtrace Components', 'BioFab Solutions LLC', 'Surgical Precision Inc',
  'Helix Medical Manufacturing', 'Vantage Medical Parts', 'Clearfield MedTech',
  'Apex Medical Machining', 'Orthoprecision LLC', 'NovaBio Components',
  'Summit Medical Fabricators',
  // Automotive tier-2
  'AutoPrecision Group', 'Drivetrain Components LLC', 'Velocity Machined Parts',
  'Forged Path Manufacturing', 'Ironclad Auto Fabrication', 'Turbo Precision Inc',
  'CrossRoad Manufacturing', 'PistonWorks LLC', 'GearTech Components',
  'Axle & Frame Industries',
  // General industrial
  'BlueSky Industrial', 'Ironbridge Manufacturing', 'Copperton Works',
  'Sterling Components Group', 'Alloy Dynamics LLC', 'Cascade Metal Solutions',
  'Mountain State Machining', 'Prairie Precision Parts', 'Heartland Fabrication',
  'Lakeview Machine Shop', 'Riverdale CNC Corp', 'Highpoint Tool & Die',
  'Broadfield Metalworks', 'Central Valley Machining', 'Tri-State Fabricators',
  'Oakhurst Precision', 'Maplewood Components', 'Clearwater Manufacturing',
  'Bluewater Tooling Inc', 'Ridgewood Machine Works',
  // Oil & gas / energy
  'Oilfield Precision Parts', 'Wellhead Components LLC', 'Permian Fabricators',
  'Turbine Machining Group', 'Pipeline Components Inc', 'Derrick Industries',
  'Valveworks Manufacturing', 'Upstream Precision LLC', 'Reservoir Components',
  'Downhole Machining Corp',
  // Electronics / enclosures
  'Enclosure Systems Inc', 'RackMount Fabrication', 'Chassis Works LLC',
  'HeatSink Solutions', 'RF Shield Manufacturing', 'Precision Enclosures Group',
  'ModuTec Components', 'CoolFrame Industries', 'Thermal Precision Inc',
  'MicroMill Components',
  // Small/regional shops
  'Countryside Machine Works', 'Twin Peaks Machining', 'Ridgecrest Fab Inc',
  'Valley Forge Components', 'Pioneer Machine Works', 'Heritage Metalworks',
  'Frontier Precision LLC', 'Patriot Fabricators Inc', 'Republic Manufacturing',
  'Constitution Machine Works', 'Liberty Precision Group', 'Independence Tooling',
  'Freedom Components LLC', 'Union Machine Works', 'Federal Precision Parts',
  'Colonial Machining Corp', 'Continental Fabricators', 'Minuteman Metalworks',
  'Lexington CNC Solutions', 'Concord Precision Inc',
];

export const CONTACT_FIRST = [
  'James', 'Sarah', 'Michael', 'Jennifer', 'Robert', 'Linda',
  'William', 'Barbara', 'David', 'Patricia', 'Richard', 'Susan',
  'Joseph', 'Jessica', 'Thomas', 'Karen', 'Charles', 'Nancy',
  'Daniel', 'Margaret', 'Christopher', 'Betty', 'Matthew', 'Dorothy',
  'Anthony', 'Lisa', 'Mark', 'Sandra', 'Donald', 'Ashley',
  'Steven', 'Dorothy', 'Paul', 'Kimberly', 'Andrew', 'Emily',
  'Joshua', 'Donna', 'Kenneth', 'Michelle', 'Kevin', 'Carol',
  'Brian', 'Amanda', 'George', 'Melissa', 'Timothy', 'Deborah',
  'Ronald', 'Stephanie', 'Edward', 'Rebecca', 'Jason', 'Sharon',
  'Jeffrey', 'Laura', 'Ryan', 'Cynthia', 'Jacob', 'Kathleen',
  'Gary', 'Amy', 'Nicholas', 'Angela', 'Eric', 'Shirley',
  'Jonathan', 'Anna', 'Stephen', 'Brenda', 'Larry', 'Pamela',
  'Justin', 'Emma', 'Scott', 'Nicole', 'Brandon', 'Helen',
  'Benjamin', 'Samantha', 'Samuel', 'Katherine', 'Raymond', 'Christine',
  'Gregory', 'Debra', 'Frank', 'Rachel', 'Alexander', 'Carolyn',
  'Patrick', 'Janet', 'Jack', 'Catherine', 'Dennis', 'Maria',
  'Jerry', 'Heather', 'Tyler', 'Diane', 'Aaron', 'Julie',
  'Jose', 'Joyce', 'Adam', 'Victoria', 'Nathan', 'Kelly',
  'Henry', 'Christina', 'Douglas', 'Lauren', 'Zachary', 'Joan',
  'Peter', 'Evelyn', 'Kyle', 'Olivia', 'Noah', 'Judith',
];

export const CONTACT_LAST = [
  'Anderson', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia',
  'Miller', 'Davis', 'Wilson', 'Taylor', 'Moore', 'Jackson',
  'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris',
  'Sanchez', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Young',
  'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen',
  'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker',
  'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker',
  'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris',
  'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz',
  'Morgan', 'Cooper', 'Peterson', 'Bailey', 'Reed', 'Kelly',
  'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
  'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett',
  'Gray', 'Mendoza', 'Ruiz', 'Hughes', 'Price', 'Alvarez',
  'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross',
  'Foster', 'Jimenez', 'Powell', 'Jenkins', 'Perry', 'Russell',
  'Sullivan', 'Bell', 'Coleman', 'Butler', 'Henderson', 'Barnes',
  'Gonzales', 'Fisher', 'Vasquez', 'Simmons', 'Romero', 'Jordan',
  'Patterson', 'Alexander', 'Hamilton', 'Graham', 'Reynolds', 'Griffin',
  'Wallace', 'Moreno', 'West', 'Cole', 'Hayes', 'Bryant',
];

export const LEAD_SOURCES = [
  'Trade Show', 'Referral', 'Web', 'LinkedIn', 'Cold Call',
  'Email Campaign', 'Partner', 'Government RFQ', 'Direct',
  'Industry Association', 'Former Customer', 'Sales Rep', 'Social Media',
  'Conference Networking', 'Distributor', 'OEM Referral', 'Engineering Firm',
  'Purchasing Portal', 'Defense Contractor Portal', 'Word of Mouth',
  'Magazine Ad', 'Podcast Sponsorship', 'YouTube Channel', 'Job Fair',
  'Thomas Net Listing', 'IQS Directory', 'Supplier Scouting', 'Reverse RFQ',
];

export const LEAD_NOTES = [
  'Interested in CNC bracket assemblies. High volume potential.',
  'Needs precision turned shafts for hydraulic actuators.',
  'Inquiring about 5-axis milling for aerospace housings.',
  'Looking for heat sink array supplier. Monthly delivery.',
  'ISO 9001 required. Medical device components.',
  'Defense contractor — ITAR compliant machining needed.',
  'Automotive tier-2. Needs 500-2000 pcs/run on cast aluminum.',
  'Prototype run first, then production scale.',
  'Long-term supplier relationship sought for 5+ years.',
  'Urgent: needs quote within 48 hours for RFQ submission.',
  'Switching from current supplier due to quality issues.',
  'Interested in design-for-manufacturability review.',
  'Needs AS9100D certified machining for flight hardware.',
  'Looking for secondary ops partner for deburring + anodize.',
  'RFQ for stainless weld assemblies, 100+ annual units.',
  'Requesting capability statement and quality certs.',
  'Evaluating multiple shops — price sensitivity is high.',
  'Spec-to-drawing conversion work needed before quoting.',
  'Wants turnkey: raw material sourcing + machining + finish.',
  'Multi-year blanket order potential if quality is met.',
  'NADCAP certification required for surface treatment.',
  'Contract manufacturing for startup product launch.',
  'Offshore supplier audit failed — urgent domestic replacement.',
  'Just-in-time delivery required, weekly ship schedule.',
  'FDA 21 CFR Part 820 quality system required.',
  'Military specification MIL-SPEC surface finish needed.',
  'Casting + machining combo for housing assembly.',
  'Prototype to production bridge needed in Q2.',
  'Looking for shop with in-house inspection & CMM.',
  'Complex 5-axis aluminum structure — tight tolerances.',
  'Repeat customer from 2019 — returning for new project.',
  'Needs annual certification of conformance per PO.',
  'Vendor qualification audit scheduled for next month.',
  'Rush order: 50 pcs needed in 10 business days.',
  'Looking to dual-source current single-source part.',
  'Material traceability documentation required per spec.',
  'First article inspection report needed with delivery.',
  'Customer engineering team wants shop tour before award.',
];

export const JOB_TITLES = [
  'CNC Bracket Assembly — {customer}',
  'Shaft Housing Machining — {customer}',
  'Heat Sink Array Production — {customer}',
  'Pneumatic Manifold Run — {customer}',
  'Precision Bore Housing — {customer}',
  'Aluminum Extrusion Machining — {customer}',
  'Stainless Fitting Lot — {customer}',
  'Prototype Enclosure — {customer}',
  'Tooling Insert Fabrication — {customer}',
  'Gear Housing Production Run — {customer}',
  'Valve Body Machining — {customer}',
  'Custom Flange Set — {customer}',
  'Actuator Bracket Run — {customer}',
  'Support Frame Assembly — {customer}',
  'Mounting Plate Batch — {customer}',
  'End Cap Machining — {customer}',
  'Connector Housing Lot — {customer}',
  'Drive Shaft Production — {customer}',
  'Bearing Retainer Run — {customer}',
  'Hydraulic Block Machining — {customer}',
  '5-Axis Impeller — {customer}',
  'Precision Dowel Pins — {customer}',
  'Weld Fixture Build — {customer}',
  'Spline Shaft Production — {customer}',
  'Aluminum Cover Plate — {customer}',
  'Titanium Bracket Run — {customer}',
  'Invar Tooling Block — {customer}',
  'Steel Weldment Machining — {customer}',
  'Cast Manifold Finish — {customer}',
  'Prototype Medical Housing — {customer}',
  'RF Shield Enclosure — {customer}',
  'Coolant Channel Block — {customer}',
  'Rack Mount Panel — {customer}',
  'Locking Ring Set — {customer}',
  'Injection Mold Insert — {customer}',
  'Rotary Union Body — {customer}',
  'Indexing Plate Assembly — {customer}',
  'Actuator Piston Run — {customer}',
  'Nose Cone Machining — {customer}',
  'Wing Rib Production — {customer}',
  'Fuel Manifold Block — {customer}',
  'Pressure Vessel Head — {customer}',
  'EGR Valve Housing — {customer}',
  'Motor Mount Bracket — {customer}',
  'Linear Rail Carriage — {customer}',
  'Probe Housing Lot — {customer}',
  'Encoder Mount Batch — {customer}',
  'Pivot Block Assembly — {customer}',
  'Reaction Frame Machining — {customer}',
  'Optical Mount Plate — {customer}',
];

export const QUOTE_LINE_DESCRIPTIONS = [
  'CNC Turned Shaft, 6061-T6 Al, ±0.001"',
  'Precision Milled Bracket, 4140 Steel, anodized',
  'Heat Sink Extrusion, 6063 Al, black anodize',
  'Pneumatic Manifold Body, 7075 Al',
  'Bore Housing, 303 SS, Ra 32 finish',
  'Gear Housing, gray cast iron, cleaned & inspected',
  'Valve Seat, 316 SS, lapped surface',
  'Actuator Arm, 2024-T4 Al, chromate conversion',
  'Support Bracket, 1018 CRS, zinc plated',
  'Custom Flange, 17-4 PH SS, passivated',
  'Mounting Plate, cast 6061, Alodine coated',
  'Prototype housing, ABS/Delrin, 3D-printed with machined features',
  'End Cap, 6061-T651 Al, hard anodize',
  'Weld Fixture Plate, A36 steel, laser cut + machined',
  'Spline Shaft, 4340 alloy steel, Rc 58-62',
  'Titanium Fastener Set, Grade 5 Ti, passivated',
  'Invar Base Plate, Invar 36, stress relieved',
  'Drive Shaft, 1144 Stressproof, centerless ground',
  'Bearing Retainer, 52100 bearing steel, hardened',
  'Hydraulic Manifold Block, 1018 CRS, phosphate',
  '5-Axis Impeller, 6061-T6 Al, mirror polish',
  'Dowel Pin Set, A2 tool steel, ground, hardened',
  'Connector Housing, 6061-T6 Al, clear anodize',
  'Coolant Fitting, 316 SS, tig welded',
  'Rack Mount Panel, 5052 Al, silk-screened',
  'Locking Ring, 303 SS, passivated',
  'Mold Insert, H13 tool steel, EDM-machined, polished',
  'Rotary Union Body, 6061 Al, PEEK insert',
  'Indexing Plate, A2 tool steel, Rc 60',
  'Actuator Piston, 1144 steel, chrome plated',
  'Nose Fairing, 2024-T3 Al, chemical mill + anodize',
  'Wing Rib, 7075-T73, chem milled',
  'Fuel Distribution Block, 316 SS, electropolished',
  'Pressure Vessel Head, SA-516 steel, ASME stamp',
  'EGR Housing, A380 die cast, machined',
  'Motor Mount, 304 SS, laser cut + bent',
  'Linear Carriage, 6061-T6 Al, black anodize',
  'Probe Tip, 17-4 PH SS, electropolished',
  'Encoder Bracket, 5052 Al, chromate',
  'Pivot Block, 4140 HT steel, Rc 28-32',
  'Optical Mount, 6061-T6 Al, black anodize + lapped',
  'Reaction Frame, 1020 tube steel, TIG welded + machined',
  'Vacuum Chuck Body, 6061 Al, anodized, ported',
  'Test Fixture Base, MIC-6 Al tooling plate, flatness ±0.001"',
  'Cryofit Bushing, 4340 steel, LN2 interference fit',
  'PCB Standoff Set, 303 SS, passivated, 25-pc lot',
  'Pressure Cap, 316 SS, o-ring grooves, 1500 psi rated',
  'Shroud Assembly, Inconel 718, EDM airfoil slots',
  'Tool Holder Body, P20 steel, Rc 30, bored concentric',
  'Nozzle Insert, tungsten carbide, ground OD/ID',
  'Slip Ring Housing, 6061 Al, Teflon-impregnated bore',
  'Balance Weight, 1018 CRS, precision machined to ±0.1 gram',
  'Spatter Guard, 304 SS, perforated sheet + bend',
  'Wave Spring Retainer, 17-7 PH SS, flatness ±0.0005"',
  'Differential Housing, A380 cast + machined bores',
];

export const EXPENSE_CATEGORIES = [
  'Materials', 'Tools', 'Shipping', 'Software',
  'Travel', 'Office Supplies', 'Safety Equipment', 'Calibration', 'Subcontract',
  'Training', 'Equipment Repair', 'Utilities', 'Consumables', 'Inspection Services',
  'Freight In', 'Freight Out', 'Packaging', 'Certification Fees', 'Legal',
  'Marketing', 'Trade Show', 'Professional Services', 'IT & Technology',
];

export const EXPENSE_DESCRIPTIONS = [
  'Carbide end mills — 4-flute 1/2" (qty 6)',
  'Coolant concentrate — 5 gallon',
  'UPS Next Day — customer delivery',
  'CAD license renewal — Q{q}',
  'Sandpaper, scotch-brite, shop supplies',
  'HSS drill set replacement',
  'Safety glasses and hearing protection restock',
  'Gage calibration — outside lab',
  'Aluminum stock 6061-T6 — 2x4x12 bar',
  'Tap & die set — M4-M12 metric',
  'Surface plate reconditioning',
  'Micrometer calibration certificates',
  'Carbide insert packs — CNMG 432',
  'Spindle coolant flush and refill',
  'Toolholder set — BT40 CAT40 (qty 4)',
  'Compressed air line rebuild kit',
  'Shop vac replacement filters (3-pack)',
  'Anti-fatigue mat replacement',
  'Lathe chuck rebore — outside service',
  'Cutting fluid analysis — quarterly',
  'Bandsaw blade — bi-metal 1/2"',
  'V-block set — matched pair, hardened',
  'Parallel set — 6" precision',
  'Height gauge battery + seal kit',
  'CMM stylus replacement kit',
  'Blue layout fluid — 1 pint',
  'Rust preventive — 5 gallon',
  'Degreaser — parts washer concentrate',
  'Drill chuck rebuild — Jacobs 20N',
  'Safety data sheet binder update',
  'First aid kit restocking',
  'OSHA poster update kit',
  'ESD mats and wrist straps',
  'Steel-toe boot allowance — B. Kelly',
  'Safety prescription glasses — A. Kim',
  'Hearing test — annual (4 employees)',
  'Fire extinguisher service — annual',
  'Forklift certification renewal',
  'Overhead crane inspection — annual',
  'Electrical panel PM — quarterly',
  'Spindle bearing replacement — Haas VF-2',
  'Y-axis servo drive swap — DMG Mori',
  'ATC gear reducer rebuild — Fadal 4020',
  'Coolant pump seal kit — Okuma LB',
  'Ball screw recertification — Mazak Nexus',
  'Air compressor service — 2000 hr',
  'Chiller coil cleaning — quarterly',
  'Pallet shuttle alignment — Matsuura',
  'Probing system battery — Renishaw OMP40',
  'Tool presetter calibration — Zoller Smile',
  'Subcontract: outside grinding — Mitsui acc',
  'Subcontract: heat treat — local vendor',
  'Subcontract: plating — zinc nickel lot',
  'Subcontract: anodizing — color match lot',
  'Subcontract: CMM inspection — FARO arm',
  'Subcontract: laser marking — part numbers',
  'Subcontract: welding — TIG assembly',
  'Subcontract: powder coat — black wrinkle',
  'Subcontract: black oxide — fastener lot',
  'Subcontract: passivation — SS assembly lot',
];

export const JOB_COMMENTS = [
  'Started first op. Setup went smoothly, holding tolerance.',
  'Second op complete. Checking dimensions against print.',
  'Material arrived today — starting setup.',
  'QC check done, all parts within spec. Moving to next stage.',
  'Customer requested minor change to radius — updated job card.',
  'Tooling worn earlier than expected. Replaced and re-inspected.',
  'First article inspection passed. Running full lot.',
  'Waiting on materials — PO submitted yesterday.',
  'Ahead of schedule. Should be done 2 days early.',
  'Deburring complete. Sending to shipping.',
  'Pressure test passed. Lot looks good.',
  'Drawing updated — Rev B. All changes noted on traveler.',
  'Machine offset adjusted. Drift noticed at op 30 — monitoring.',
  'Roughing complete. Starting finish pass.',
  'All holes tapped and checked with go/no-go.',
  'Thread gauge check passed. 100% inspection complete.',
  'Part cleaned and ready for anodize subcontract.',
  'Received from anodize. Color match approved.',
  'Packing list verified. 50 of 50 shipped.',
  'Short on raw stock — ordering 2 more bars.',
  'Surface finish Ra 32 confirmed with profilometer.',
  'Datum shift noticed — rechecked with CMM. All good.',
  'Customer supplied material received, lot controlled.',
  'Cutter chatter at op 40. Changed to different helix.',
  'Coolant pressure drop. Checked filters — cleared.',
  'Ran fixture verification before first piece. Aligned.',
  'Tolerance stack-up reviewed with engineering.',
  'PO received from customer — starting setup today.',
  'Yield 100%. Zero scrap this lot.',
  'One part out of spec on bore dia — scrapped, rerun.',
  'Secondary ops complete. Parts to inspection.',
  'Inspection stamp affixed. CoC drafted.',
  'Lot traveler signed off. Ready for ship.',
  'Re-inspection requested by customer — scheduling.',
  'Design change request received. Pending revision.',
  'Toolpath adjusted for better chip evacuation.',
  'Fixture modified for better datum contact.',
  'End mill swapped to variable flute — better finish.',
  'Coolant nozzle repositioned for deep bore.',
  'Night shift completed 30 of 50. On track.',
  'Deburr complete. Edge break per print ± 0.005".',
  'Masking applied for partial anodize.',
  'Laser etch program verified on first piece.',
  'Outsource CMM scheduled for tomorrow AM.',
  'Flatness check: 0.0008" — within spec.',
  'Perpendicularity 0.002" TIR — good.',
  'Surface cleanliness verified per customer spec.',
  'Packaging per ASTM D3951. Poly bag + foam.',
  'Partial ship approved. 25 pcs shipped, 25 in progress.',
  'RMA received. Disposition: rework op 20.',
];

export const CHAT_MESSAGES_GENERAL = [
  "Anyone have a spare 3/4\" collet? Mine cracked.",
  "Don't forget the 2PM safety meeting today.",
  "Haas VF-2 is running hot — maintenance scheduled for Thursday.",
  "Customer called — they're happy with the last batch.",
  "New stock in receiving — put away in bin A-12.",
  "Who has the 6-inch digital calipers?",
  "Reminder: time sheets due by Friday noon.",
  "We're out of blue layout fluid — adding to supply order.",
  "Coolant concentration checked and adjusted.",
  "Great job on the Atlas order — came out perfect.",
  "Power is back on. Restart your programs and check offsets.",
  "Material cert for the new 4140 bar is in the job folder.",
  "Anyone seen the insert wrench for the boring bar?",
  "Lights-out run is set for tonight on the Mazak — make sure stock is loaded.",
  "Tool life monitor going off on the Haas. Check insert condition on tool 8.",
  "Customer pushed out their delivery 2 weeks — adjust schedule accordingly.",
  "New CMM probe arrived. Calibrated and ready.",
  "Shop floor temp is 61° — heat should be up by 8am.",
  "All machines are down for safety audit tomorrow morning.",
  "Reminder: lockout/tagout training refresher is next Wednesday.",
  "The 5C collet closer on lathe 3 is sticking — flagged for maintenance.",
  "Good news: QC passed the whole lot, zero discrepancies.",
  "Don't forget to log your time before you leave today.",
  "Job 2241 traveler is on the clipboard at machine 4.",
  "Raw material supplier confirmed delivery for Tuesday.",
  "We got the Atlas Aerospace contract. Big win for the shop.",
  "Inspection cart is in aisle 2 — please return it when done.",
  "Quick reminder: calibration stickers must be current before use.",
  "Night shift left notes on job 2198 — read before starting.",
  "New safety data sheets are posted by the sink.",
  "The vise on mill 3 needs regrinding. Scheduled for next week.",
  "Invoice sent to customer. Waiting on PO back.",
  "Anyone picking up lunch? I'll go if we can get a group order.",
  "Machine 5 encoder alarm cleared. Good to resume.",
  "Coolant alarm on lathe 2 — just low, refilled.",
  "The customer rep is coming in Tuesday for a tour.",
  "Finish grinding run complete — 48 pcs passed 100%.",
  "Pallet load station 1 is back online. Machining resumes.",
  "New print rev posted to the job folder — Rev C replaces Rev B.",
  "Fixturing for job 2270 is in the tall cabinet near CMM.",
  "Annual fire extinguisher service is today — don't be alarmed.",
  "Torque wrench calibration due this week — pull from service.",
  "We hit 98% on-time delivery last month. Nice work everyone.",
  "Production meeting at 7am sharp. Bring your job travelers.",
  "The new Mitutoyo gauge is in the blue case on the inspection shelf.",
  "Just FYI — no smoking within 25 feet of the building, per new OSHA signage.",
  "Customer approved the FAIR. Green light to run production.",
  "New lock-out box installed at panel C. Use it.",
  "Reminder: SDS book is in the red binder, cabinet near spray booth.",
  "All done on job 2255. Parts are tagged and ready for ship.",
];

export const CHAT_MESSAGES_JOB = [
  "Quick question on this job — what's the surface finish on the bore?",
  "Just finished the setup. Should be running in about 20 minutes.",
  "This one needs a second look at the thread tolerance — let me know what you think.",
  "Running a bit long on cycle time — checking if we can optimize the toolpath.",
  "Customer wants to expedite. Can we move this up in the queue?",
  "Is the print Rev B or Rev C? I see both in the folder.",
  "First article looks good — going for PM sign-off.",
  "Machine chatter at op 20. Trying a different approach.",
  "Material certs are attached. Good to proceed.",
  "Can someone double-check my setup sheet before I run the first piece?",
  "Op 40 is done. Handed off to inspection.",
  "Rough-in complete. Finish pass starts tomorrow AM.",
  "Deburr note: the inside corners at hole pattern B are tight.",
  "The customer asked for extra cleaning — noted on traveler.",
  "Running the last 10 now. Should be done by 4.",
  "Job on hold — waiting for clarification from engineering on dim 4.5.",
  "Green light to proceed. Engineering confirmed 4.5 is nominal.",
  "Setup validated. Starting production run now.",
  "Night shift picked this up — continuing from op 30.",
  "We're tight on schedule. Any chance to borrow mill 6 for 2 hours?",
];

export const PART_NAMES = [
  'Shaft Housing A', 'Bracket 7075', 'Manifold Body', 'Heat Sink 60W',
  'Bore Plate Rev C', 'Actuator Arm', 'Flange Assembly', 'Valve Seat SS',
  'Support Bracket L', 'Gear Cover Plate',
  'End Cap 316', 'Drive Shaft B', 'Bearing Retainer', 'Hydraulic Block',
  'Impeller 5-Axis', 'Dowel Pin Set', 'Connector Housing', 'Coolant Fitting',
  'Rack Panel 2U', 'Locking Ring', 'Mold Insert H13', 'Rotary Union Body',
  'Indexing Plate', 'Actuator Piston', 'Nose Fairing', 'Wing Rib 7075',
  'Fuel Block SS', 'Pressure Head', 'EGR Housing', 'Motor Mount 304',
  'Linear Carriage', 'Probe Tip', 'Encoder Bracket', 'Pivot Block 4140',
  'Optical Mount', 'Reaction Frame', 'Vacuum Chuck Body', 'Test Fixture Base',
  'Cryofit Bushing', 'PCB Standoff Set', 'Pressure Cap 316', 'Shroud Inconel',
  'Tool Holder P20', 'Nozzle Insert WC', 'Slip Ring Housing', 'Balance Weight',
  'Spatter Guard 304', 'Wave Spring Retainer', 'Diff Housing A380', 'Weld Fixture Plate',
];

export const VENDOR_NAMES = [
  'MSC Industrial', 'Grainger', 'McMaster-Carr', 'Fastenal',
  'Admiral Steel', 'TW Metals', 'Metals Depot', 'Metal Supermarkets',
  'Alcobra Metals', 'Online Metals', 'Speedy Metals', 'Service Center USA',
  'Garlock Sealing', 'SKF Bearings', 'Roper Industries', 'Parker Hannifin',
  'Precision Castparts', 'Kennametal Tools', 'Sandvik Coromant', 'Iscar Metals',
  'Seco Tools', 'Walter Tools', 'Ceratizit USA', 'OSG Tap & Die',
  'YG-1 Tools', 'Accupro', 'Niagara Cutter', 'Helical Solutions',
  'Renishaw Inc', 'Mitutoyo USA', 'Starrett', 'Brown & Sharpe',
  'Fowler Tools', 'Mahr Federal', 'Tesa Technology', 'Hexagon Metrology',
  'Anodize Right', 'Able Electropolishing', 'Metal Finishing Inc', 'Aerojet Plating',
  'Pacific Heat Treat', 'Bodine Heat Treating', 'Paulo Products', 'Thermal Process',
  'FedEx Freight', 'UPS Supply Chain', 'Forward Air', 'Echo Global Logistics',
];

export const ASSET_NAMES: Array<{ name: string; type: string; manufacturer: string; model: string }> = [
  // CNC machines
  { name: 'Haas VF-2 #1', type: 'Machine', manufacturer: 'Haas', model: 'VF-2' },
  { name: 'Haas VF-2 #2', type: 'Machine', manufacturer: 'Haas', model: 'VF-2' },
  { name: 'Haas VF-4SS', type: 'Machine', manufacturer: 'Haas', model: 'VF-4SS' },
  { name: 'DMG Mori NLX 2500', type: 'Machine', manufacturer: 'DMG Mori', model: 'NLX 2500/700' },
  { name: 'Mazak Quick Turn 250', type: 'Machine', manufacturer: 'Mazak', model: 'QT-250MSY' },
  { name: 'Mazak Nexus 510C-II', type: 'Machine', manufacturer: 'Mazak', model: 'Nexus 510C-II' },
  { name: 'Fadal 4020', type: 'Machine', manufacturer: 'Fadal', model: 'VMC 4020' },
  { name: 'Okuma LB 3000 EX', type: 'Machine', manufacturer: 'Okuma', model: 'LB 3000 EX' },
  { name: 'Matsuura MAM72-35V', type: 'Machine', manufacturer: 'Matsuura', model: 'MAM72-35V' },
  { name: 'Doosan DNM 650', type: 'Machine', manufacturer: 'Doosan', model: 'DNM 650' },
  // Support equipment
  { name: 'DoAll Bandsaw C-916', type: 'Machine', manufacturer: 'DoAll', model: 'C-916A' },
  { name: 'Haas RT-210 Rotary', type: 'Tooling', manufacturer: 'Haas', model: 'RT-210' },
  { name: 'Zoller Smile 400', type: 'Tooling', manufacturer: 'Zoller', model: 'Smile 400' },
  { name: 'Renishaw OMP40', type: 'Tooling', manufacturer: 'Renishaw', model: 'OMP40-2' },
  // Facility
  { name: 'Air Compressor — Kaeser', type: 'Facility', manufacturer: 'Kaeser', model: 'ASD 40 T' },
  { name: 'Coolant Chiller #1', type: 'Facility', manufacturer: 'Daikin', model: 'AKZ568' },
  { name: 'Overhead Crane 5-ton', type: 'Facility', manufacturer: 'Demag', model: 'DKUN 5-500' },
  // Vehicles
  { name: 'Forklift — Yale', type: 'Vehicle', manufacturer: 'Yale', model: 'GLP060VX' },
  { name: 'Delivery Van', type: 'Vehicle', manufacturer: 'Ford', model: 'Transit 250' },
];

export const MAINTENANCE_TITLES = [
  'Spindle lubrication — 500 hr interval',
  'Way lube check & fill',
  'Coolant system flush and concentration test',
  'Air filter replacement — compressor',
  'Hydraulic pressure check & fluid top-off',
  'Chip conveyor clean-out',
  'ATC tool changer alignment check',
  'Spindle taper wipe & gauge check',
  'Ball screw backlash measurement',
  'Servo motor greasing — all axes',
  'Chiller coil inspection & cleaning',
  'Coolant pump seal inspection',
  'Safety interlock test — all doors',
  'Fire suppression system annual check',
  'Crane load test — annual',
  'Forklift tire & brake inspection',
  'Electrical panel thermal scan',
  'Emergency stop circuit test',
  'Laser alignment verification',
  'Probing system calibration check',
];

export const DOWNTIME_REASONS = [
  'Spindle bearing noise — vibration above threshold',
  'Coolant pump failure — no flow detected',
  'ATC arm crash — tool change malfunction',
  'Servo alarm — X-axis position error',
  'Hydraulic leak — chuck clamp circuit',
  'Chip conveyor jam — emergency stop tripped',
  'Power fluctuation — all axes faulted',
  'Coolant chiller overtemp shutdown',
  'Air pressure drop below minimum',
  'Tool breakage — auto-detection triggered',
  'Control board error — reboot required',
  'Way cover damage — exposed slide',
  'Encoder fault — Z-axis',
  'Pallet shuttle misalignment',
  'Probe signal loss mid-cycle',
];

export const DOWNTIME_RESOLUTIONS = [
  'Bearing replaced. Spindle run-in complete, vibration normal.',
  'Seal kit installed. Pump tested at pressure — OK.',
  'ATC arm realigned, new cam follower installed. Tool change verified.',
  'Servo drive replaced. Axis homed and position confirmed.',
  'Hose fitting torqued and leak-tested. System bled.',
  'Conveyor cleared. Chain tension adjusted.',
  'UPS battery replaced. Power quality stable.',
  'Condenser coil cleaned. Refrigerant charge verified.',
  'Air dryer serviced. Line pressure restored.',
  'Tool holder inspected. Replacement tool loaded.',
  'Control firmware updated. Watchdog timer cleared.',
  'Way cover section replaced. Slides cleaned and relubed.',
  'Encoder head realigned and scale cleaned. Verified with laser.',
  'Shuttle rails cleaned and pallet relocated. Homing verified.',
  'Probe battery replaced and signal verified at full range.',
];

export const SCRAP_REASONS = [
  'Bore OD out of tolerance — tool wear beyond compensation',
  'Surface finish Ra 125 — spec requires Ra 32 max',
  'Thread pitch diameter out of spec — tap worn',
  'Dimensional creep during long run — thermal expansion',
  'Fixture slip — parts shifted mid-operation',
  'Wrong material lot loaded — hardness too high',
  'Porosity discovered in cast blank after machining',
  'Anodize lot reject — color mismatch',
  'Customer spec change mid-run — prior parts non-conforming',
  'Tool crash — 3 parts damaged in fixture',
];

// ── Additional data pools for expanded simulation ───────────────────────────

export const STORAGE_LOCATION_NAMES = [
  'Raw Stock - Aisle A', 'Raw Stock - Aisle B', 'Finished Goods - Bay 1',
  'Finished Goods - Bay 2', 'WIP Staging', 'Shipping Dock', 'Receiving Dock',
  'Tool Crib', 'Quality Hold Area', 'Reject Bin', 'Overflow Storage',
  'Climate Controlled - Room 1', 'Hazmat Cabinet', 'Pallet Rack A1',
  'Pallet Rack A2', 'Pallet Rack B1', 'Pallet Rack B2', 'Floor Stock',
  'Machine Side Staging', 'Inspection Bench', 'Assembly Station 1',
  'Assembly Station 2', 'Sub-Assembly Area', 'Paint Booth Staging',
];

export const LOCATION_TYPES = ['Area', 'Zone', 'Bin', 'Shelf'];

export const EVENT_TITLES = [
  'Weekly Safety Meeting', 'Production Planning Review', 'Quality Circle Meeting',
  'New Employee Orientation', 'Forklift Safety Training', 'ISO 9001 Internal Audit',
  'Customer Visit — Shop Tour', 'Lean Manufacturing Workshop',
  'First Aid / CPR Refresher', 'Emergency Evacuation Drill',
  'Machine Maintenance Training', 'Lockout/Tagout Refresher',
  'Quarterly All-Hands Meeting', 'Continuous Improvement Session',
  'PPE Inspection & Training', 'Hazardous Material Handling',
  'Calibration Procedures Training', 'GD&T Basics Workshop',
  'SPC Chart Interpretation', 'Root Cause Analysis Training',
  'Annual Safety Review', 'Fire Extinguisher Training',
  'Ergonomics Assessment', 'Shift Changeover Meeting',
];

export const EVENT_LOCATIONS = [
  'Conference Room A', 'Conference Room B', 'Shop Floor', 'Break Room',
  'Training Center', 'Quality Lab', 'Front Office', 'Loading Dock',
  'Machine Area 1', 'Machine Area 2', 'Assembly Area', 'Outdoor Lot',
];

export const TRAINING_MODULE_TITLES = [
  'Shop Safety Fundamentals', 'CNC Operation Basics', 'Blueprint Reading 101',
  'Quality Inspection Procedures', 'Micrometer & Caliper Use', 'GD&T Introduction',
  'Material Identification', 'Coolant Management', 'Tool Setup & Alignment',
  'SPC for Operators', 'Lean 5S Methodology', 'Machine Maintenance Basics',
  'First Article Inspection', 'Non-Conformance Reporting', 'ERP System Navigation',
  'Customer Communication', 'Document Control Procedures', 'Change Order Process',
];

export const TRAINING_MODULE_SUMMARIES = [
  'Learn the fundamentals of shop floor safety and PPE requirements.',
  'Introduction to CNC mill and lathe operation procedures.',
  'How to read and interpret engineering drawings and specifications.',
  'Standard quality inspection procedures and documentation.',
  'Proper use and care of precision measuring instruments.',
  'Geometric Dimensioning and Tolerancing basics for machinists.',
  'Identifying common metals, alloys, and their properties.',
  'Coolant types, concentration management, and disposal.',
  'Setting up tooling, fixtures, and work holding devices.',
  'Statistical Process Control charts and their interpretation.',
  'Implementing 5S methodology on the shop floor.',
  'Basic machine maintenance checks and lubrication schedules.',
  'Conducting and documenting first article inspections.',
  'How to document and route non-conforming material.',
  'Navigating the QB Engineer ERP system effectively.',
  'Professional communication with customers and vendors.',
  'Document control policies and revision management.',
  'Processing engineering change orders and updates.',
];

export const PART_NUMBERS_PREFIX = [
  'BRK', 'SHF', 'HSG', 'PLT', 'VLV', 'GER', 'BRG', 'FLG', 'MNT', 'CAP',
  'NZL', 'ARM', 'PIN', 'ROD', 'COV', 'FRM', 'INS', 'JIG', 'FIX', 'SPL',
];

export const CUSTOMER_NOTES = [
  'Net 30 terms. Good payment history.',
  'Requires FAIR with first shipment.',
  'ISO 9001 certified supplier requirement.',
  'Preferred shipping method: UPS Ground.',
  'Tax exempt — certificate on file.',
  'Key account — priority handling.',
  'New customer — credit application pending.',
  'Annual blanket order renewal in Q4.',
];

// ── Raw materials (for BOM entries and PO line items) ─────────────────────────

export const RAW_MATERIALS: Array<{ name: string; material: string; unit: string }> = [
  { name: '6061-T6 Al Bar Stock 1" dia', material: '6061-T6 Aluminum', unit: 'ft' },
  { name: '6061-T6 Al Plate 0.5" x 12" x 12"', material: '6061-T6 Aluminum', unit: 'ea' },
  { name: '7075-T6 Al Bar Stock 2" dia', material: '7075-T6 Aluminum', unit: 'ft' },
  { name: '7075-T6 Al Plate 1" x 6" x 12"', material: '7075-T6 Aluminum', unit: 'ea' },
  { name: '4140 Steel Rod 0.75" dia', material: '4140 Steel', unit: 'ft' },
  { name: '4140 Steel Rod 1.5" dia', material: '4140 Steel', unit: 'ft' },
  { name: '303 SS Bar Stock 1" dia', material: '303 Stainless', unit: 'ft' },
  { name: '316 SS Bar Stock 0.5" dia', material: '316 Stainless', unit: 'ft' },
  { name: '316 SS Plate 0.25" x 12" x 24"', material: '316 Stainless', unit: 'ea' },
  { name: '1018 CRS Flat Bar 0.5" x 2"', material: '1018 Cold Rolled', unit: 'ft' },
  { name: 'Delrin Rod 2" dia', material: 'Delrin (Acetal)', unit: 'ft' },
  { name: 'PEEK Rod 1" dia', material: 'PEEK', unit: 'ft' },
  { name: 'UHMW Sheet 0.5" x 24" x 48"', material: 'UHMW-PE', unit: 'ea' },
  { name: 'Brass C360 Hex 1" AF', material: 'Brass C360', unit: 'ft' },
  { name: 'Copper C110 Bar 0.75" dia', material: 'Copper C110', unit: 'ft' },
  { name: 'Inconel 718 Bar 1" dia', material: 'Inconel 718', unit: 'ft' },
  { name: 'Titanium 6Al-4V Bar 1.5" dia', material: 'Ti-6Al-4V', unit: 'ft' },
  { name: 'A2 Tool Steel Flat 1" x 3"', material: 'A2 Tool Steel', unit: 'ft' },
  { name: 'D2 Tool Steel Plate 0.75" x 6" x 12"', material: 'D2 Tool Steel', unit: 'ea' },
  { name: 'H13 Tool Steel Block 3" x 4" x 6"', material: 'H13 Tool Steel', unit: 'ea' },
];

export const PURCHASED_COMPONENTS: Array<{ name: string; partNumber: string }> = [
  { name: 'SKF 6205 Deep Groove Bearing', partNumber: 'SKF-6205-2RS' },
  { name: 'SKF 6207 Deep Groove Bearing', partNumber: 'SKF-6207-2Z' },
  { name: 'Buna-N O-Ring -210', partNumber: 'OR-210-BN70' },
  { name: 'Viton O-Ring -116', partNumber: 'OR-116-V75' },
  { name: 'Socket Head Cap Screw M6x20', partNumber: 'SHCS-M6-20-A2' },
  { name: 'Socket Head Cap Screw M8x30', partNumber: 'SHCS-M8-30-A2' },
  { name: 'Dowel Pin 6mm x 20mm', partNumber: 'DP-6-20-H6' },
  { name: 'Retaining Ring N-5100-50', partNumber: 'RR-5100-50' },
  { name: 'Linear Rail 20mm x 400mm', partNumber: 'LR-20-400-C' },
  { name: 'Linear Bearing Block 20mm', partNumber: 'LB-20-FL' },
  { name: 'Timing Belt GT2 200mm', partNumber: 'TB-GT2-200-6' },
  { name: 'Spring Pin 4mm x 24mm', partNumber: 'SP-4-24-SS' },
  { name: 'Shaft Seal 25x42x7', partNumber: 'SS-25-42-7-NBR' },
  { name: 'Keystock 5mm x 5mm x 100mm', partNumber: 'KS-5-5-100' },
  { name: 'Pneumatic Cylinder 25mm bore x 50mm', partNumber: 'PC-25-50-DB' },
];

// ── Assembly names (manufactured parts that are built from sub-parts) ─────────

export const ASSEMBLY_NAMES: Array<{ name: string; prefix: string; material: string }> = [
  { name: 'Hydraulic Manifold Assembly', prefix: 'ASM-HYD', material: '6061-T6 Al' },
  { name: 'Spindle Housing Assembly', prefix: 'ASM-SPH', material: '4140 Steel' },
  { name: 'Rotary Union Assembly', prefix: 'ASM-RTU', material: '303 SS' },
  { name: 'Linear Actuator Assembly', prefix: 'ASM-LNA', material: '7075-T6 Al' },
  { name: 'Valve Block Assembly', prefix: 'ASM-VLB', material: '316 SS' },
  { name: 'Bearing Cartridge Assembly', prefix: 'ASM-BCA', material: '4140 Steel' },
  { name: 'Fixture Plate Assembly', prefix: 'ASM-FPL', material: '6061-T6 Al' },
  { name: 'Gear Reduction Assembly', prefix: 'ASM-GRA', material: '4140 Steel' },
  { name: 'Coolant Nozzle Assembly', prefix: 'ASM-CNZ', material: '303 SS' },
  { name: 'Encoder Mount Assembly', prefix: 'ASM-ENC', material: '7075-T6 Al' },
  { name: 'Pneumatic Clamp Assembly', prefix: 'ASM-PNC', material: '6061-T6 Al' },
  { name: 'Probe Holder Assembly', prefix: 'ASM-PRB', material: '303 SS' },
  { name: 'Motor Bracket Assembly', prefix: 'ASM-MTR', material: '1018 CRS' },
  { name: 'Test Fixture Assembly', prefix: 'ASM-TST', material: '6061-T6 Al' },
  { name: 'Heat Exchanger Assembly', prefix: 'ASM-HTX', material: '316 SS' },
];

// ── Invoice / billing data ────────────────────────────────────────────────────

export const INVOICE_NOTES = [
  'Standard production run — per PO terms.',
  'Expedited order — rush surcharge applied.',
  'Partial shipment invoiced — remainder to follow.',
  'Tooling amortized over first 500 pieces.',
  'Net 30 terms per customer agreement.',
  'First article inspection included.',
  'Material cert and test report enclosed.',
  'Packing slip attached — verify quantities.',
  'Customer blanket order drawdown.',
  'Annual pricing per contract renewal.',
];

export const PAYMENT_METHODS = ['Check', 'ACH', 'CreditCard', 'Wire'];

export const PAYMENT_REFERENCES = [
  'CHK #', 'ACH REF ', 'CC AUTH ', 'WIRE ', 'PMT-', 'TXN-', 'REF-', 'AP-',
];

// ── Customer returns ──────────────────────────────────────────────────────────

export const RETURN_REASONS = [
  'Parts out of tolerance — bore diameter oversize',
  'Surface finish not to spec — Ra too rough',
  'Wrong quantity shipped — 90 received, 100 ordered',
  'Damaged in transit — packaging insufficient',
  'Wrong revision shipped — Rev B sent, Rev C required',
  'Material cert mismatch — wrong alloy',
  'Thread gauge fail — pitch diameter out of spec',
  'Cosmetic defect — tool marks on sealing surface',
  'Missing hardware — fastener kit incomplete',
  'Anodize color mismatch — wrong spec called out',
  'Customer spec change — parts no longer needed',
  'Duplicate shipment — already received prior batch',
];

// ── QC / Quality inspection ──────────────────────────────────────────────────

export const QC_NOTES = [
  'All critical dimensions in spec. CPK > 1.33.',
  'First article passed — production run approved.',
  'Minor cosmetic issue on non-critical surface — accepted.',
  'Thread ring gauge GO/NOGO verified — pass.',
  'CMM report attached — all features nominal.',
  'Surface finish Ra 16 measured — spec Ra 32 max — pass.',
  'Hardness Rc 42-44 measured — spec 40-45 — pass.',
  'Visual inspection — no burrs, no tool marks on sealing surfaces.',
  'Concentricity 0.001" TIR measured — spec 0.003" max — pass.',
  'Flatness 0.0005" measured — spec 0.002" max — pass.',
  'SPC chart shows process stable — no trends detected.',
  'Destructive test sample passed pull/shear test.',
];

// ── Shipment data ─────────────────────────────────────────────────────────────

export const SHIPMENT_CARRIERS = [
  'UPS Ground', 'UPS 2-Day Air', 'UPS Next Day Air',
  'FedEx Ground', 'FedEx 2Day', 'FedEx Priority Overnight',
  'USPS Priority Mail', 'USPS First Class',
  'Freight — LTL', 'Freight — FTL', 'Will Call / Customer Pickup',
  'DHL Express', 'Old Dominion Freight', 'YRC Freight',
];

// ── Chat messages with entity mentions ────────────────────────────────────────

export const CHAT_MESSAGES_WITH_MENTIONS = [
  'Just finished the first article on {entity} — dimensions look good.',
  'Hey, can someone check the PO status for {entity}? Customer is asking.',
  'QC passed on {entity} — ready to ship.',
  'Need to reorder material for {entity} — stock is low.',
  '{entity} is running behind schedule. Can we get extra hours on it?',
  'Customer called about {entity} — wants an ETA update.',
  'Tool broke during {entity} run. Replacing and restarting.',
  'Updated the drawing for {entity} — Rev C is now active.',
  '{entity} is on hold waiting for material from vendor.',
  'Shipping {entity} today via UPS Ground. Tracking to follow.',
  'Invoice sent for {entity}. Net 30 terms.',
  'Great work on {entity} — customer was impressed with the quality.',
];

// ── Activity / conversation comments for various entity types ─────────────────

export const ENTITY_COMMENTS = {
  job: [
    'Setup complete — running first article now.',
    'Material arrived — ready to start production.',
    'Changed tooling approach — using carbide insert instead of HSS.',
    'Halfway through production run. On schedule.',
    'QC check mid-run — all dimensions holding.',
    'Completed op 20, moving to op 30.',
    'Customer approved deviation on non-critical radius.',
    'Running overnight — should finish by morning.',
  ],
  part: [
    'Updated BOM — added O-ring to assembly.',
    'Rev C released — added chamfer to bore entry.',
    'Confirmed material availability with vendor.',
    'Drawing updated — tolerance tightened on OD.',
    'Added routing for secondary op — heat treat.',
    'Customer requested change to surface finish spec.',
    'Prototype approved — releasing for production.',
    'Cost estimate updated based on new vendor quote.',
  ],
  customer: [
    'Called to discuss new project requirements.',
    'Sent updated pricing per annual review.',
    'Credit application approved — Net 30 terms.',
    'Scheduled shop tour for next week.',
    'Customer requested expedited delivery on next order.',
    'Met at trade show — interested in 5-axis capabilities.',
    'Reviewed open AR — all current, good payment history.',
    'New contact added — engineering department.',
  ],
  asset: [
    'Scheduled preventive maintenance — spindle lube.',
    'Vibration analysis complete — within spec.',
    'Replaced way lube pump — working normally.',
    'Annual calibration due next month.',
    'Coolant system flushed and recharged.',
    'Updated maintenance schedule per manufacturer bulletin.',
    'Operator reported intermittent alarm — monitoring.',
    'Replaced servo drive — machine back online.',
  ],
  vendor: [
    'Negotiated 5% discount on annual volumes.',
    'Lead time increased to 3 weeks — backlog.',
    'Material cert issues resolved — approved supplier.',
    'New contact: inside sales rep changed.',
    'Requested quote for titanium bar stock.',
    'Quality issue on last shipment — NCR filed.',
    'Payment terms updated to Net 45.',
    'Site audit scheduled for next quarter.',
  ],
  invoice: [
    'Sent via email — customer confirmed receipt.',
    'Payment received — check deposited.',
    'Customer requested 30-day extension — approved by manager.',
    'Partial payment received — balance due.',
    'Credited $150 for shipping damage.',
    'Statement sent — all invoices current.',
  ],
  quote: [
    'Customer reviewing — expects response by Friday.',
    'Revised pricing per customer feedback.',
    'Added line item for tooling amortization.',
    'Customer accepted — converting to order.',
    'Competitive bid situation — adjusted margin.',
    'Extended validity date per customer request.',
  ],
  salesOrder: [
    'Production scheduled for next week.',
    'Material ordered — arriving Thursday.',
    'Partial ship approved by customer.',
    'Delivery date moved up per customer request.',
    'Added line for spare parts — customer requested.',
    'All items shipped — awaiting delivery confirmation.',
  ],
  purchaseOrder: [
    'Vendor confirmed — shipping next week.',
    'Received partial — remaining items backordered.',
    'Quality issue found on receipt — contacting vendor.',
    'Expedite requested — need material by Friday.',
    'Vendor invoice received — matches PO.',
    'Returned defective material — replacement en route.',
  ],
};

// ── Contact data for adding multiple contacts to customers/leads ──────────────

export const CONTACT_TITLES = [
  'Engineering Manager', 'Purchasing Agent', 'Quality Engineer',
  'Production Supervisor', 'Plant Manager', 'VP Operations',
  'Buyer', 'Program Manager', 'Design Engineer', 'QC Inspector',
  'Shipping Coordinator', 'Accounts Payable', 'Sales Representative',
  'Technical Director', 'Maintenance Manager', 'Shop Foreman',
  'CTO', 'Supply Chain Manager', 'Procurement Specialist', 'CFO',
];

export const CONTACT_DEPARTMENTS = [
  'Engineering', 'Purchasing', 'Quality', 'Production', 'Operations',
  'Finance', 'Sales', 'Shipping', 'Maintenance', 'Management',
];

// ── Contact Interaction data (for logging calls/emails/meetings) ────────────

export const INTERACTION_SUBJECTS = {
  Call: [
    'Discussed delivery timeline for current order',
    'Follow-up on quality concern from last shipment',
    'Pricing review for upcoming annual contract',
    'Expedite request — need parts by end of week',
    'Capacity planning call for Q{q} requirements',
    'Reviewed spec changes for new revision',
    'Payment status check — invoice past due',
    'Technical consultation on material selection',
    'New project kickoff discussion',
    'Production schedule update call',
  ],
  Email: [
    'Sent revised quote per phone discussion',
    'Drawing package for new part number',
    'PO confirmation and expected delivery date',
    'Quality report — dimensional inspection results',
    'Updated terms and conditions for review',
    'Material certification documentation',
    'Invoice copy and payment instructions',
    'RFQ response — competitive pricing',
    'Spec deviation request for customer approval',
    'Shipping notification with tracking info',
  ],
  Meeting: [
    'Quarterly business review — production metrics',
    'New product introduction planning session',
    'Shop tour with customer engineering team',
    'Annual contract negotiation',
    'Quality system audit preparation',
    'Capacity and lead time planning meeting',
    'Process improvement review',
    'Year-end pricing and forecast meeting',
  ],
  Note: [
    'Customer mentioned potential large order next quarter',
    'Key contact retiring end of year — transition plan needed',
    'Competitor pricing lower — may need to adjust',
    'Customer expanding facility — good opportunity',
    'Payment history excellent — consider credit line increase',
    'Customer ISO audit scheduled — prepare documentation',
    'New program launching — prototype phase starts soon',
    'Contact requested visit to our facility next month',
  ],
};

export const INTERACTION_BODIES = {
  Call: [
    'Spoke with {contact} regarding current open orders. All on track for delivery. Will follow up next week with shipping confirmation.',
    'Called to discuss the quality issue reported on PO #{ref}. Root cause identified — tooling wear. Corrective action implemented.',
    '{contact} called to request expedited delivery. Checked production schedule — can accommodate with overtime. Will confirm by EOD.',
    'Discussed annual pricing review. Customer requesting 3% reduction. Will review costs and respond by Friday.',
    'Follow-up call with {contact}. They are satisfied with recent delivery performance. Planning to increase order volume.',
  ],
  Email: [
    'Sent {contact} the revised quote with updated pricing per our phone conversation. Valid for 30 days.',
    'Forwarded material certifications for recent shipment per customer quality requirements. All certs on file.',
    'Responded to RFQ from {contact}. Quoted 3 configurations with volume break pricing. Lead time: 4-6 weeks.',
    'Sent shipping notification to {contact}. Tracking: {ref}. Expected delivery in 2-3 business days.',
    'Emailed {contact} updated drawings showing Rev C changes. Awaiting approval before production start.',
  ],
  Meeting: [
    'Met with {contact} and their engineering team for quarterly review. Reviewed KPIs: 98.5% on-time delivery, 0.2% rejection rate. Customer satisfied.',
    'New product kickoff meeting with {contact}. Reviewed preliminary drawings, discussed tolerances, agreed on prototype schedule. First articles in 3 weeks.',
    'Shop tour with {contact}. Demonstrated 5-axis capability, CMM inspection process. Customer impressed with quality controls.',
    'Annual contract negotiation with {contact}. Agreed on 2% price increase effective Q1. Volume commitment of 500 pcs/month minimum.',
  ],
  Note: [
    'Internal note: {contact} mentioned they are evaluating second-source suppliers. Need to ensure competitive pricing and delivery performance.',
    'Reminder: Send {contact} updated capability statement including new equipment additions.',
    '{contact} retiring at end of year. Their replacement is starting in 2 months — schedule introductory meeting.',
    'Customer has been growing 15% annually. May need to discuss capacity reservation for next fiscal year.',
  ],
};

export const INTERACTION_TYPES = ['Call', 'Email', 'Meeting', 'Note'] as const;

// ── Entity Notes (for Notes tab — different from conversation comments) ─────

export const ENTITY_NOTES = {
  purchaseOrder: [
    'IMPORTANT: Vendor requires 48-hour advance notice for any delivery changes.',
    'Material spec requires mill cert with heat lot traceability. Verify on receipt.',
    'This vendor has a history of short-shipping. Count all boxes carefully.',
    'Pricing locked through Q{q} per annual agreement. Requote before renewal.',
    'Alternate vendor approved: contact Purchasing if lead time exceeds 6 weeks.',
    'Quality alert: last 2 shipments had minor surface finish issues. Inspect 100%.',
  ],
  salesOrder: [
    'Customer requires packing slip in each box with lot numbers listed.',
    'HOLD: Do not ship until customer PO revision is received and confirmed.',
    'Partial shipments authorized. Customer prefers to receive as completed.',
    'Special packaging required: VCI wrap per customer spec PKG-203.',
    'This is a blanket order — releases will come via EDI or email from {contact}.',
    'Customer inspection required before final shipment. Schedule 48 hours in advance.',
  ],
  customerReturn: [
    'Customer reports out-of-tolerance on bore diameter. CMM inspection pending.',
    'Return authorized per RMA #{ref}. Credit memo to be issued upon receipt and inspection.',
    'Root cause: tool wear mid-run. Corrective action: added in-process gauge check every 50 pcs.',
    'Customer requesting full replacement plus expedited shipping at no charge.',
    'Visual defect only — functional. Customer returning for aesthetic reasons per contract terms.',
    'NOTE: This is the second return from this customer this quarter. Review root cause patterns.',
  ],
  job: [
    'SAFETY: This job involves titanium machining — ensure proper chip handling and fire suppression available.',
    'Customer witness point at Op 30. Schedule inspection 2 days before expected completion.',
    'Material pre-heated per spec — do not machine cold. See process sheet.',
    'Tight tolerance on ID bore — use air gauge for in-process checks, not caliper.',
    'Previous run had chip issues on threading op. Use peck cycle with 0.020 depth of cut max.',
    'Customer requires first article inspection report (FAIR) per AS9102 before production run.',
  ],
  vendor: [
    'Preferred vendor for 6061-T6 aluminum — best pricing and shortest lead time.',
    'Credit hold risk: payment terms must be maintained or they revert to prepay.',
    'This vendor offers emergency/rush service at 25% premium — use for urgent jobs only.',
    'Annual quality audit due Q{q}. Schedule site visit with QE team.',
    'Vendor consolidation candidate — overlaps with {alt_vendor} on several material types.',
    'New vendor — probationary period. 100% incoming inspection required for first 5 orders.',
  ],
  asset: [
    'CRITICAL: Spindle bearing replacement due at 10,000 hours. Current: {hours} hours.',
    'Oil analysis trending — watch for iron content increase. Next sample due Q{q}.',
    'Operator qualification required: Level 2 certification minimum for this machine.',
    'Backup power supply installed. Machine will auto-park during power failure.',
    'Known issue: Y-axis has 0.0003" backlash compensation programmed. Do not reset.',
    'Scheduled for CNC control upgrade in Q{q}. Budget approved.',
  ],
};

// ── RFQ data ──────────────────────────────────────────────────────────────────

export const RFQ_DESCRIPTIONS = [
  'Annual requirement — 500 pcs/month, 12 month blanket.',
  'Prototype qty 5 — tight tolerances, expedited.',
  'Production run — 1000 pcs, standard lead time.',
  'Replacement parts — match existing specs exactly.',
  'New program — engineering samples for qualification.',
  'Ramp-up order — 100 pcs initial, 500/mo steady state.',
  'Competitive requote — incumbent pricing expired.',
  'Material substitution — customer spec change.',
];

// ── ECO (Engineering Change Order) data ───────────────────────────────────────

export const ECO_DESCRIPTIONS = [
  'Tighten bore tolerance from ±0.005 to ±0.002 per customer feedback.',
  'Add chamfer 0.015 x 45° on all sharp edges per safety review.',
  'Change material from 6061 to 7075 for higher strength application.',
  'Update surface finish requirement from Ra 63 to Ra 32.',
  'Add thread relief per ASME B1.1 standard.',
  'Modify fillet radius from R0.030 to R0.060 for stress relief.',
  'Add inspection note: 100% check critical bore diameter.',
  'Update drawing to reflect actual as-built dimensions (within spec).',
];

export const ECO_CHANGE_TYPES = ['Design', 'Material', 'Process', 'Documentation'];

// ── Recurring expense data ────────────────────────────────────────────────────

export const RECURRING_EXPENSE_DESCRIPTIONS = [
  'Monthly coolant supply service', 'Quarterly safety equipment inspection',
  'Annual machine calibration service', 'Monthly janitorial service',
  'Bi-weekly shop towel/uniform service', 'Monthly waste oil disposal',
  'Quarterly compressed air system service', 'Annual fire suppression inspection',
  'Monthly pest control service', 'Quarterly HVAC maintenance',
];

export const RECURRING_FREQUENCIES = ['Weekly', 'BiWeekly', 'Monthly', 'Quarterly', 'Annually'];

/** Pick an item from a pool deterministically by week and offset */
export function pick<T>(pool: T[], weekIndex: number, offset = 0): T {
  return pool[(weekIndex + offset) % pool.length];
}

/** Pick N unique items from a pool */
export function pickN<T>(pool: T[], n: number, weekIndex: number): T[] {
  const result: T[] = [];
  for (let i = 0; i < n; i++) {
    result.push(pool[(weekIndex + i) % pool.length]);
  }
  return result;
}

/** Random-ish integer in [min, max] seeded by weekIndex */
export function seededInt(min: number, max: number, weekIndex: number, salt = 0): number {
  const range = max - min + 1;
  return min + ((weekIndex * 7 + salt * 13) % range);
}
