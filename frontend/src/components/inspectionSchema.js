// The vehicle inspection sheet, defined once.
//
// This file is the single source of truth for what an inspection contains: the
// categories, every component in them, the option vocabulary each component is
// picked from, and how a recorded value is coloured on the printed report.
//
// The backend deliberately does NOT enumerate these ~210 components — it stores
// the whole checklist in a JSON column the same way Estimate.sections does, so
// adding or renaming a component is a change to this file alone and needs no
// migration. The trade-off is the same one Estimate makes: nothing reports on an
// individual component, so there is no child table and no server-side validation
// of the keys.

// --- Option vocabularies -----------------------------------------------------
// Every component picks from one of these. `condition` covers the bulk of the
// sheet; the rest exist because the source sheet uses a distinct vocabulary for
// that component (a roof is "Standard", never "Normal").

const percentScale = () =>
  Array.from({ length: 11 }, (_, i) => `${100 - i * 10}%`);

export const OPTIONS = {
  condition: ["Normal", "Good", "Bad", "Weak", "Not Present", "None"],
  presence: ["Normal", "None", "Not Present"],
  yesNo: ["No", "Yes"],
  functioning: ["Functioning", "Working", "Weak", "Not Functioning", "None"],
  // Tyre wear is recorded as tread remaining, so 100% is a new tyre and low
  // numbers are the bad end — the opposite of how "wear" usually reads.
  percent: percentScale(),
  count: ["None", "1", "2", "3", "4", "5", "6", "7", "8"],
  accidents: ["None", "None Structural", "Structural"],
  drive: ["Power", "Manual", "2WD", "4WD", "AWD", "None"],
  roof: ["Standard", "Sunroof", "Moonroof", "Panoramic", "None"],
  wheelType: ["Rim Cup", "Alloy Wheel", "Steel Rim", "Sports Rim", "None"],
  alterations: ["Not Present", "Present"],
  interiorType: ["Fabric", "Leather", "Semi Leather", "Vinyl"],
  seatType: ["Manual", "Power", "Semi Power"],
  sideMirrorType: ["Manual", "Power", "Power Folding"],
  fluid: ["Normal", "Refill", "Bad", "None"],
};

// Shorthand so the category tables below stay readable.
const c = (key, label, options = "condition") => ({ key, label, options });

// --- The eleven inspection categories ----------------------------------------
// Order matters: it is the order of both the data-entry accordion and the
// printed report. Component keys are snake_case and permanent — changing one
// orphans that value on every inspection already saved.

export const INSPECTION_CATEGORIES = [
  {
    key: "basics",
    title: "Basics and Tyres",
    components: [
      c("no_of_automatic_doors", "No of Automatic Doors", "count"),
      c("no_of_doors", "No of Doors", "count"),
      c("no_of_seats", "No of Seats", "count"),
      c("accidents", "Accidents", "accidents"),
      c("drive_system", "Drive System", "drive"),
      c("roof", "Roof", "roof"),
      c("wheel_type", "Wheel Type", "wheelType"),
      c("alterations", "Alterations", "alterations"),
      c("front_left_tyre_ware", "Front Left Tyre Ware", "percent"),
      c("front_right_tyre_ware", "Front Right Tyre Ware", "percent"),
      c("rear_left_tyre_ware", "Rear Left Tyre Ware", "percent"),
      c("rear_right_tyre_ware", "Rear Right Tyre Ware", "percent"),
    ],
  },
  {
    key: "structure",
    title: "Structure",
    components: [
      c("a_pillar", "A Pillar"),
      c("b_pillar", "B Pillar"),
      c("c_pillar", "C Pillar"),
      c("d_pillar", "D Pillar"),
      c("chassis_legs_box_jt_front", "Chassis Legs & Box Jt Front"),
      c("chassis_legs_box_jt_center", "Chassis Legs & Box Jt Center"),
      c("chassis_legs_rear_panel", "Chassis Legs & Rear Panel"),
      c("front_subframe", "Front Subframe"),
      c("seat_belt", "Seat Belt"),
      c("structure", "Structure"),
    ],
  },
  {
    key: "engine",
    title: "Engine, Hybrid & Electric System",
    components: [
      c("camshaft_sensor", "Camshaft Sensor"),
      c("hybrid_system", "Hybrid System"),
      c("supercharger", "Supercharger", "presence"),
      c("distributor", "Distributor", "presence"),
      c("igniter_coil", "Igniter Coil"),
      c("spark_plugs", "Spark Plugs"),
      c("tappet_cover", "Tappet Cover"),
      c("tappets", "Tappets"),
      c("air_filter", "Air Filter"),
      c("engine_gasket", "Engine Gasket"),
      c("engine_varnish", "Engine Varnish"),
      c("engine_sludge", "Engine Sludge"),
      c("timing_belt", "Timing Belt", "presence"),
      c("timing_chain", "Timing Chain", "presence"),
      c("burning_oil", "Burning Oil", "yesNo"),
      c("oil_leaks", "Oil Leaks", "yesNo"),
      c("driver_belt_pulleys", "Driver Belt Pulleys"),
      c("crankshaft_oil_seal", "Crankshaft Oil Seal"),
      c("crankshaft_sensor", "Crankshaft Sensor"),
      c("camshaft_oil_seal", "Camshaft Oil Seal"),
      c("tappet_cover_oil_seal", "Tappet Cover Oil Seal"),
      c("turbo", "Turbo", "presence"),
      c("throttlebody", "Throttlebody"),
      c("high_tension_leads", "High Tension Leads"),
      c("engine_misfiring", "Engine Misfiring", "yesNo"),
      c("engine_mounts", "Engine Mounts"),
      c("air_flow_sensor", "Air Flow Sensor"),
      c("alternator", "Alternator"),
      c("alternator_belt", "Alternator Belt", "presence"),
      c("engine_blow_by", "Engine Blow-By"),
      c("abnormal_noises_rcmd_insp", "Abnormal Noises Rcmd Insp", "yesNo"),
      c("sump_packing", "Sump Packing"),
      c("rear_drive_shaft_oil_seals", "Rear Drive Shaft Oil Seals", "presence"),
      c("fuel_efficiency", "Fuel Efficiency"),
    ],
  },
  {
    key: "braking",
    title: "Braking System",
    components: [
      c("abs", "ABS"),
      c("parking_brake", "Parking Brake"),
      c("brake_oil_reservoir", "Brake Oil Reservoir"),
      c("reservoir_cap", "Reservoir Cap"),
      c("brake_fluid", "Brake Fluid", "fluid"),
      c("brake_booster", "Brake Booster"),
      c("master_pump", "Master Pump"),
      c("accumulator_sensor", "Accumulator Sensor", "presence"),
      c("front_brake_pads", "Front Brake Pads"),
      c("front_brake_disk", "Front Brake Disk"),
      c("front_brake_drum", "Front Brake Drum", "presence"),
      c("front_brake_caliper", "Front Brake Caliper"),
      c("front_brake_hoses", "Front Brake Hoses"),
      c("rear_brake_pads", "Rear Brake Pads", "presence"),
      c("rear_brake_shoe", "Rear Brake Shoe"),
      c("rear_brake_disk", "Rear Brake Disk", "presence"),
      c("rear_brake_drum", "Rear Brake Drum"),
      c("rear_brake_caliper", "Rear Brake Caliper", "presence"),
      c("rear_brake_hoses", "Rear Brake Hoses"),
      c("rear_brake_liner", "Rear Brake Liner"),
    ],
  },
  {
    key: "transmission",
    title: "Transmission System",
    components: [
      c("clutch_pump_fluid", "Clutch Pump Fluid", "fluid"),
      c("clutch_cable", "Clutch Cable", "presence"),
      c("clutch_pump", "Clutch Pump"),
      c("clutch_plate", "Clutch Plate"),
      c("pressure_plate", "Pressure Plate"),
      c("release_bearing", "Release Bearing"),
      c("gearbox_mounts", "Gearbox Mounts"),
      c("gearbox_shafts_cables", "Gearbox Shafts/Cables"),
      c("gearbox_oil_seals", "Gearbox Oil Seals"),
      c("gear_selection", "Gear Selection"),
      c("gear_engagement", "Gear Engagement"),
      c("stability_control", "Stability Control"),
      c("tip_tronic_system", "Tip-Tronic System", "presence"),
      c("economy_mode", "Economy Mode", "presence"),
      c("sport_mode", "Sport Mode", "presence"),
      c("front_drive_shafts", "Front Drive Shafts"),
      c("front_drive_shaft_oil_seals", "Front Drive Shaft Oil Seals"),
      c("rear_drive_shafts", "Rear Drive Shafts", "presence"),
      c("torque_converter", "Torque Converter", "presence"),
      c("bell_housing", "Bell Housing"),
    ],
  },
  {
    key: "suspension",
    title: "Suspension",
    components: [
      c("front_differential", "Front Differential", "presence"),
      c("rear_differential", "Rear Differential", "presence"),
      c("front_shock_absorber_mounts", "Front Shock Absorber Mounts"),
      c("front_left_shock_absorbers", "Front Left Shock Absorbers"),
      c("front_right_shock_absorbers", "Front Right Shock Absorbers"),
      c("rear_left_shock_absorbers", "Rear Left Shock Absorbers"),
      c("rear_right_shock_absorbers", "Rear Right Shock Absorbers"),
      c("front_coil_springs", "Front Coil Springs"),
      c("front_coil_sp_rubber_dampers", "Front Coil SP Rubber Dampers"),
      c("rear_coil_springs", "Rear Coil Springs"),
      c("rear_coil_sp_rubber_damping", "Rear Coil SP Rubber Damping"),
      c("front_lower_swing_arm", "Front Lower Swing Arm"),
      c("front_lower_arm_bushes", "Front Lower Arm Bushes"),
      c("front_control_arms_bushing", "Front Control Arms & Bushing"),
      c("rear_lower_swing_arm", "Rear Lower Swing Arm"),
      c("rear_lower_swing_arm_bushes", "Rear Lower Swing Arm Bushes"),
      c("front_stabilizer_bar", "Front Stabilizer Bar"),
      c("front_stabilizer_bar_bushes", "Front Stabilizer Bar Bushes"),
      c("rear_stabilizer_bar", "Rear Stabilizer Bar"),
      c("rear_stabilizer_bar_bush", "Rear Stabilizer Bar Bush"),
      c("front_leaf_springs", "Front Leaf Springs", "presence"),
      c("front_leaf_spring_shuckles", "Front Leaf Spring Shuckles", "presence"),
      c("front_leaf_spring_rebound_clips", "Front Leaf Spring Rebound Clips", "presence"),
      c("rear_leaf_springs", "Rear Leaf Springs", "presence"),
      c("rear_leaf_spring_shuckles", "Rear Leaf Spring Shuckles", "presence"),
      c("rear_leaf_spring_rebound_clips", "Rear Leaf Spring Rebound Clips", "presence"),
      c("rear_leaf_bush", "Rear Leaf Bush", "presence"),
      c("four_x_four_drive", "4x4 Drive", "presence"),
    ],
  },
  {
    key: "steering",
    title: "Steering System",
    components: [
      c("wheel_condition", "Wheel Condition"),
      c("power_steering", "Power Steering"),
      c("power_steering_pump", "Power Steering Pump", "presence"),
      c("power_steering_motor", "Power Steering Motor"),
      c("power_steering_hoses", "Power Steering Hoses", "presence"),
      c("electric_power_steering_rack", "Electric Power Steering Rack", "presence"),
      c("hydraulic_power_steering_rack", "Hydraulic Power Steering Rack", "presence"),
      c("steering_column", "Steering Column"),
      c("rack_ends_left", "Rack Ends Left"),
      c("rack_ends_right", "Rack Ends Right"),
      c("tie_rod_left", "Tie Rod Left"),
      c("tie_rod_right", "Tie Rod Right"),
      c("lower_ball_joints", "Lower Ball Joints"),
      c("upper_ball_joints", "Upper Ball Joints"),
      c("control_arms", "Control Arms"),
      c("front_inner_cv_joints_boots", "Front Inner CV Joints & Boots"),
      c("front_outer_cv_joints_boots", "Front Outer CV Joints & Boots"),
      c("rear_inner_cv_joints_boots", "Rear Inner CV Joints & Boots", "presence"),
      c("rear_outer_cv_joints_boots", "Rear Outer CV Joints & Boots", "presence"),
    ],
  },
  {
    key: "cooling",
    title: "Cooling System",
    components: [
      c("radiator_top_tank", "Radiator Top Tank"),
      c("radiator_bottom_tank", "Radiator Bottom Tank"),
      c("radiator_core", "Radiator Core"),
      c("radiator_cap", "Radiator Cap"),
      c("radiator_hose", "Radiator Hose"),
      c("radiator_fan", "Radiator Fan"),
      c("coolant_expansion_tank", "Coolant Expansion Tank"),
      c("coolant_lines", "Coolant Lines"),
      c("thermostat_housing", "Thermostat/Thermostat Housing"),
      c("water_pump", "Water Pump"),
      c("ac_compressor", "AC Compressor"),
      c("ac_belt", "AC Belt", "presence"),
      c("ac_cooler", "AC Cooler"),
    ],
  },
  {
    key: "exhaust",
    title: "Exhaust System",
    components: [
      c("exhaust_manifold", "Exhaust Manifold"),
      c("exhaust_manifold_gasket", "Exhaust Manifold Gasket"),
      c("connecting_pipe", "Connecting Pipe"),
      c("catalytic_converter", "Catalytic Converter"),
      c("center_pipe", "Center Pipe"),
      c("resonator", "Resonator"),
      c("silencer", "Silencer"),
      c("hangers", "Hangers"),
    ],
  },
  {
    key: "interior",
    title: "Interior",
    components: [
      c("interior_type", "Interior Type", "interiorType"),
      c("interior_condition", "Interior Condition"),
      c("seat_covers_fitted", "Seat Covers Fitted", "yesNo"),
      c("seat_type", "Seat Type", "seatType"),
      c("seat_control_mechanism", "Seat Control Mechanism", "functioning"),
      c("no_of_seat_belts", "No of Seat Belts", "count"),
      c("seat_belt_condition", "Seat Belt Condition"),
      c("dashboard_condition", "Dashboard Condition"),
      c("meters", "Meters", "functioning"),
      c("airbags", "Airbags", "functioning"),
      c("power_shutters", "Power Shutters", "functioning"),
      c("central_locking", "Central Locking"),
      c("rear_view_mirror", "Rear View Mirror"),
      c("side_mirror_type", "Side Mirror Type", "sideMirrorType"),
      c("interior_lights", "Interior Lights"),
      c("horn", "Horn", "functioning"),
      c("air_conditioning", "Air Conditioning"),
      c("rear_air_conditioning", "Rear Air Conditioning", "presence"),
      c("accelerator_pedal_rubber", "Accelerator Pedal Rubber"),
      c("brake_pedal_rubber", "Brake Pedal Rubber"),
      c("clutch_pedal_rubber", "Clutch Pedal Rubber", "presence"),
      c("self_starter", "Self Starter"),
    ],
  },
  {
    key: "exterior",
    title: "Exterior",
    components: [
      c("windscreen", "Windscreen"),
      c("rear_windscreen", "Rear Windscreen"),
      c("windscreen_wiper_blades_arms", "Windscreen Wiper Blades & Arms"),
      c("rear_windscreen_wiper_blades_arms", "Rear Windscreen Wiper Blades & Arms"),
      c("wiper_mechanism", "Wiper Mechanism", "functioning"),
      c("rear_wiper_mechanism", "Rear Wiper Mechanism", "functioning"),
      c("windscreen_washer_nozzles", "Windscreen Washer Nozzles", "functioning"),
      c("rear_windscreen_washer_nozzles", "Rear Windscreen Washer Nozzles", "functioning"),
      c("side_mirrors", "Side Mirrors", "functioning"),
      c("side_mirrors_condition", "Side Mirrors Condition"),
      c("head_lights", "Head Lights"),
      c("turn_signal_lights", "Turn Signal Lights"),
      c("hazard_warning_lights", "Hazard Warning Lights"),
      c("brake_lights", "Brake Lights"),
      c("reverse_lights", "Reverse Lights"),
      c("parking_lights", "Parking Lights"),
      c("fog_lights", "Fog Lights"),
      c("reverse_camera", "Reverse Camera", "presence"),
      c("camera_360", "360 Camera", "presence"),
      c("parking_sensors_front", "Parking Sensors Front", "presence"),
      c("parking_sensors_rear", "Parking Sensors Rear", "presence"),
    ],
  },
];

// --- System scan summary -----------------------------------------------------
// A fixed list of control modules read off the diagnostic tool. Not part of the
// checklist above because it is scanned, not inspected by eye, and it prints as
// its own block.

export const SCAN_OPTIONS = ["Normal", "Fault Detected", "Not Equipped"];

export const SYSTEM_SCAN_MODULES = [
  { key: "ecm_cpf", label: "ECM (Engine Control Module) (CPF)" },
  { key: "ecm_cpf_plus", label: "ECM (Engine Control Module) (CPF+)" },
  { key: "tcm", label: "TCM (Transmission Control Module)" },
  { key: "abs", label: "ABS (Anti-lock Braking System)" },
  { key: "airbag_gen", label: "Airbag (GEN)" },
  { key: "airbag_nas", label: "Airbag (NAS)" },
  { key: "bcm", label: "BCM (Body Control Module)" },
  { key: "imm", label: "IMM (Immobilizer)" },
  { key: "transmitter_code_saving", label: "Transmitter Code Saving" },
  { key: "ac", label: "AC (Air Conditioning)" },
  { key: "eps", label: "EPS (Electronic Power Steering)" },
];

// --- Diagnostic trouble codes ------------------------------------------------

export const DTC_STATUS_OPTIONS = ["Active", "History", "N/A"];

// The modules a code can be attributed to — the scan list plus a free "Other"
// escape hatch, since a scan tool will occasionally name a module we don't list.
export const DTC_MODULES = [
  "ECM", "TCM", "ABS", "SRS/Airbag", "BCM", "IMM", "AC", "EPS", "Other",
];

export const emptyDtcRow = () => ({
  code: "",
  module: "",
  description: "",
  status: "Active",
});

// --- Vehicle information -----------------------------------------------------

export const FUEL_TYPES = ["Petrol", "Diesel", "Hybrid", "Plug-in Hybrid", "Electric", "Other"];

// --- Colour coding -----------------------------------------------------------
// The report speaks in three colours, and the legend printed on the last page
// promises exactly this: green is sound, amber needs work, red is major work or
// a structural problem. Anything unrecognised (and anything blank) stays neutral
// so a half-finished sheet doesn't print a wall of false green.

const TONE_BY_VALUE = {
  // Sound.
  "Normal": "good", "Good": "good", "Functioning": "good", "Working": "good",
  "Not Present": "good", "None": "good", "No": "good", "Standard": "good",
  // Needs attention.
  "Weak": "warn", "Refill": "warn", "None Structural": "warn", "Present": "warn",
  // Major work.
  "Bad": "bad", "Yes": "bad", "Structural": "bad", "Not Functioning": "bad",
  "Fault Detected": "bad",
};

// The same word can mean opposite things depending on what is being judged.
// Across this sheet "None" almost always means "not fitted to this vehicle" —
// no turbo, no leaf springs, no sunroof — which is a fact about the car, not a
// defect, and prints green. Fluids are the exception: an empty brake reservoir
// is not a missing feature, it is a fault. Tone is therefore looked up per
// option set first, with TONE_BY_VALUE as the fallback.
const TONE_BY_OPTION_SET = {
  fluid: { "Normal": "good", "Refill": "warn", "Bad": "bad", "None": "bad" },
};

export const valueTone = (value, optionSet) => {
  const raw = (value ?? "").toString().trim();
  if (!raw) return "none";

  // Percentages are a scale, not a word. Tyre figures are tread remaining, so
  // a high number is the healthy end.
  if (raw.endsWith("%")) {
    const pct = parseFloat(raw);
    if (Number.isNaN(pct)) return "none";
    if (pct >= 80) return "good";
    if (pct >= 40) return "warn";
    return "bad";
  }

  // A plain count ("4 seats") is informational — it carries no verdict.
  if (/^\d+$/.test(raw)) return "none";

  return TONE_BY_OPTION_SET[optionSet]?.[raw] || TONE_BY_VALUE[raw] || "none";
};

// Tailwind text colours for each tone, used by both the editor and the report.
// Kept as whole class strings so Tailwind's scanner can see them.
export const TONE_CLASS = {
  good: "text-emerald-700",
  warn: "text-amber-600",
  bad: "text-red-600",
  none: "text-gray-400",
};

// --- Ratings -----------------------------------------------------------------

// The overall figure is the mean of whichever category ratings were filled in,
// so a partly-rated sheet still shows a meaningful number instead of being
// dragged toward zero by categories nobody scored yet. Mirrored by
// inspection_overall_rating() in inventory/models.py — the server recomputes it
// on save and never trusts the value the client sends.
export const overallRating = (ratings = {}, excludedSections = []) => {
  const skipped = new Set(excludedSections || []);
  const scores = INSPECTION_CATEGORIES
    .filter((cat) => !skipped.has(cat.key))
    .map((cat) => parseFloat(ratings?.[cat.key]))
    .filter((n) => !Number.isNaN(n))
    // Clamped and rounded the same way the server does, so the live preview
    // never shows a figure the save would change.
    .map((n) => Math.min(100, Math.max(0, n)));
  if (!scores.length) return 0;
  return Math.round((scores.reduce((sum, n) => sum + n, 0) / scores.length) * 100) / 100;
};

// --- Blank sheets ------------------------------------------------------------

export const blankChecklist = () =>
  INSPECTION_CATEGORIES.reduce(
    (acc, cat) => ({
      ...acc,
      [cat.key]: cat.components.reduce((f, comp) => ({ ...f, [comp.key]: "" }), {}),
    }),
    {}
  );

export const blankRatings = () =>
  INSPECTION_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat.key]: "" }), {});

export const blankSystemScan = () =>
  SYSTEM_SCAN_MODULES.reduce((acc, m) => ({ ...acc, [m.key]: "" }), {});

export const blankRecommendations = () =>
  INSPECTION_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat.key]: "" }), {});


// --- Custom fields and section toggles ---------------------------------------

// A component the catalog doesn't name, added by the inspector for one vehicle.
// `free` marks a value that was typed rather than picked, which is why it
// prints without a verdict colour — an arbitrary string can't be judged.
export const emptyCustomField = () => ({ label: "", value: "", free: false });

// Custom values are picked from the standard condition vocabulary so they
// colour-code like every other row, with a free-text escape hatch for the
// things that vocabulary can't say ("78%", "2 of 4 fitted").
export const CUSTOM_FIELD_OPTIONS = OPTIONS.condition;

// A component's option set, guarded. A custom field carries no option-set name,
// and a catalog edit could leave a stale one behind; an unguarded OPTIONS[...]
// lookup would throw on .map().
export const optionsFor = (optionSet) => OPTIONS[optionSet] || OPTIONS.condition;

// The sections a report can be built from, in print order. The two scan
// sections are keyed without the "__" the editor's pseudo-steps use, because
// these keys are persisted.
export const REPORT_SECTIONS = [
  ...INSPECTION_CATEGORIES.map((cat) => ({ key: cat.key, title: cat.title })),
  { key: "scan", title: "System Scan Summary" },
  { key: "dtc", title: "Diagnostic Trouble Codes" },
];

// Sections that accept custom fields: every inspection category plus the scan
// summary. Fault codes are already free-form, so they need no extra rows.
export const CUSTOM_FIELD_SECTIONS = [...INSPECTION_CATEGORIES.map((c) => c.key), "scan"];

export const blankCustomFields = () =>
  CUSTOM_FIELD_SECTIONS.reduce((acc, key) => ({ ...acc, [key]: [] }), {});

// Rows worth printing or saving: a row with nothing naming it has nothing to say.
export const filledCustomFields = (rows = []) => rows.filter((r) => (r.label || "").trim());

export const isSectionExcluded = (excludedSections, sectionKey) =>
  (excludedSections || []).includes(sectionKey);

// A rating reads on the same three-band scale the option tones use.
export const ratingTone = (pct) => {
  const n = parseFloat(pct);
  if (Number.isNaN(n)) return "none";
  return n >= 75 ? "good" : n >= 50 ? "warn" : "bad";
};
