/**
 * Static iPhone model attributes used by the "Find Your iPhone" quiz.
 *
 * Only covers models likely to appear in refurbished inventory
 * (iPhone 12 onwards + iPhone SE variants).
 */

export type Tier = "budget" | "mid" | "premium";
export type Size = "compact" | "standard" | "large";
export type Usage = "basic" | "everyday" | "power";

export interface IPhoneSpecs {
  display: string;
  chip: string;
  camera: string;
  /** Notable features shown as tags in quiz results */
  features: string[];
}

export interface IPhoneModel {
  /** Model name as stored in Firestore, e.g. "iPhone 15 Pro Max" */
  model: string;
  /** Price/feature tier */
  tier: Tier;
  /** Physical size category */
  size: Size;
  /** Best-fit usage level */
  usage: Usage;
  /** One-line selling point shown in quiz results */
  highlight: string;
  /** Key specs displayed on result cards */
  specs: IPhoneSpecs;
}

export const IPHONE_MODELS: IPhoneModel[] = [
  // ── iPhone SE ──────────────────────────────────────────────────────────
  {
    model: "iPhone SE (2020)",
    tier: "budget",
    size: "compact",
    usage: "basic",
    highlight: "Affordable compact iPhone with Touch ID.",
    specs: {
      display: '4.7" Retina HD',
      chip: "A13 Bionic",
      camera: "12MP single",
      features: ["Touch ID", "Wireless charging"],
    },
  },
  {
    model: "iPhone SE (2022)",
    tier: "budget",
    size: "compact",
    usage: "basic",
    highlight: "A15 chip in a pocket-friendly design with 5G.",
    specs: {
      display: '4.7" Retina HD',
      chip: "A15 Bionic",
      camera: "12MP single",
      features: ["5G", "Touch ID", "Wireless charging"],
    },
  },

  // ── iPhone 12 series ──────────────────────────────────────────────────
  {
    model: "iPhone 12 mini",
    tier: "budget",
    size: "compact",
    usage: "basic",
    highlight: "Compact OLED display with 5G support.",
    specs: {
      display: '5.4" Super Retina XDR',
      chip: "A14 Bionic",
      camera: "12MP dual (wide + ultra-wide)",
      features: ["5G", "MagSafe", "Face ID", "Ceramic Shield"],
    },
  },
  {
    model: "iPhone 12",
    tier: "budget",
    size: "standard",
    usage: "everyday",
    highlight: "Great all-rounder with A14 chip and dual cameras.",
    specs: {
      display: '6.1" Super Retina XDR',
      chip: "A14 Bionic",
      camera: "12MP dual (wide + ultra-wide)",
      features: ["5G", "MagSafe", "Face ID", "Ceramic Shield"],
    },
  },
  {
    model: "iPhone 12 Pro",
    tier: "mid",
    size: "standard",
    usage: "everyday",
    highlight: "Triple camera with LiDAR and ProRAW support.",
    specs: {
      display: '6.1" Super Retina XDR',
      chip: "A14 Bionic",
      camera: "12MP triple (wide + ultra-wide + telephoto)",
      features: ["5G", "MagSafe", "LiDAR", "ProRAW", "Face ID"],
    },
  },
  {
    model: "iPhone 12 Pro Max",
    tier: "mid",
    size: "large",
    usage: "power",
    highlight: "Largest display with sensor-shift stabilisation.",
    specs: {
      display: '6.7" Super Retina XDR',
      chip: "A14 Bionic",
      camera: "12MP triple (wide + ultra-wide + telephoto)",
      features: ["5G", "MagSafe", "LiDAR", "Sensor-shift OIS", "Face ID"],
    },
  },

  // ── iPhone 13 series ──────────────────────────────────────────────────
  {
    model: "iPhone 13 mini",
    tier: "budget",
    size: "compact",
    usage: "basic",
    highlight: "Improved battery and Cinematic mode in a mini form.",
    specs: {
      display: '5.4" Super Retina XDR',
      chip: "A15 Bionic",
      camera: "12MP dual (wide + ultra-wide)",
      features: ["5G", "MagSafe", "Cinematic mode", "Face ID"],
    },
  },
  {
    model: "iPhone 13",
    tier: "mid",
    size: "standard",
    usage: "everyday",
    highlight: "A15 chip, better battery life, and diagonal cameras.",
    specs: {
      display: '6.1" Super Retina XDR',
      chip: "A15 Bionic",
      camera: "12MP dual (wide + ultra-wide)",
      features: ["5G", "MagSafe", "Cinematic mode", "Face ID"],
    },
  },
  {
    model: "iPhone 13 Pro",
    tier: "mid",
    size: "standard",
    usage: "power",
    highlight: "ProMotion 120Hz display and macro photography.",
    specs: {
      display: '6.1" ProMotion 120Hz',
      chip: "A15 Bionic",
      camera: "12MP triple (wide + ultra-wide + 3x telephoto)",
      features: ["5G", "MagSafe", "ProMotion 120Hz", "Macro", "ProRes", "LiDAR"],
    },
  },
  {
    model: "iPhone 13 Pro Max",
    tier: "premium",
    size: "large",
    usage: "power",
    highlight: "All-day battery with pro camera system.",
    specs: {
      display: '6.7" ProMotion 120Hz',
      chip: "A15 Bionic",
      camera: "12MP triple (wide + ultra-wide + 3x telephoto)",
      features: ["5G", "MagSafe", "ProMotion 120Hz", "Macro", "ProRes", "LiDAR"],
    },
  },

  // ── iPhone 14 series ──────────────────────────────────────────────────
  {
    model: "iPhone 14",
    tier: "mid",
    size: "standard",
    usage: "everyday",
    highlight: "Crash Detection and improved low-light camera.",
    specs: {
      display: '6.1" Super Retina XDR',
      chip: "A15 Bionic",
      camera: "12MP dual (wide + ultra-wide)",
      features: ["5G", "MagSafe", "Crash Detection", "Emergency SOS via satellite"],
    },
  },
  {
    model: "iPhone 14 Plus",
    tier: "mid",
    size: "large",
    usage: "everyday",
    highlight: "Big 6.7-inch display with all-day battery.",
    specs: {
      display: '6.7" Super Retina XDR',
      chip: "A15 Bionic",
      camera: "12MP dual (wide + ultra-wide)",
      features: ["5G", "MagSafe", "Crash Detection", "Emergency SOS via satellite"],
    },
  },
  {
    model: "iPhone 14 Pro",
    tier: "premium",
    size: "standard",
    usage: "power",
    highlight: "Dynamic Island, 48MP main camera, always-on display.",
    specs: {
      display: '6.1" ProMotion 120Hz Always-On',
      chip: "A16 Bionic",
      camera: "48MP triple (wide + ultra-wide + 3x telephoto)",
      features: ["5G", "MagSafe", "Dynamic Island", "Always-On display", "ProRes", "LiDAR"],
    },
  },
  {
    model: "iPhone 14 Pro Max",
    tier: "premium",
    size: "large",
    usage: "power",
    highlight: "The best iPhone 14 — biggest screen, longest battery.",
    specs: {
      display: '6.7" ProMotion 120Hz Always-On',
      chip: "A16 Bionic",
      camera: "48MP triple (wide + ultra-wide + 3x telephoto)",
      features: ["5G", "MagSafe", "Dynamic Island", "Always-On display", "ProRes", "LiDAR"],
    },
  },

  // ── iPhone 15 series ──────────────────────────────────────────────────
  {
    model: "iPhone 15",
    tier: "mid",
    size: "standard",
    usage: "everyday",
    highlight: "Dynamic Island, USB-C, and 48MP camera.",
    specs: {
      display: '6.1" Super Retina XDR',
      chip: "A16 Bionic",
      camera: "48MP dual (wide + ultra-wide)",
      features: ["5G", "USB-C", "MagSafe", "Dynamic Island"],
    },
  },
  {
    model: "iPhone 15 Plus",
    tier: "mid",
    size: "large",
    usage: "everyday",
    highlight: "Large display with USB-C and all-day battery.",
    specs: {
      display: '6.7" Super Retina XDR',
      chip: "A16 Bionic",
      camera: "48MP dual (wide + ultra-wide)",
      features: ["5G", "USB-C", "MagSafe", "Dynamic Island"],
    },
  },
  {
    model: "iPhone 15 Pro",
    tier: "premium",
    size: "standard",
    usage: "power",
    highlight: "Titanium design, A17 Pro chip, Action button.",
    specs: {
      display: '6.1" ProMotion 120Hz Always-On',
      chip: "A17 Pro",
      camera: "48MP triple (wide + ultra-wide + 3x telephoto)",
      features: ["5G", "USB-C", "Titanium", "Action button", "ProRes", "LiDAR"],
    },
  },
  {
    model: "iPhone 15 Pro Max",
    tier: "premium",
    size: "large",
    usage: "power",
    highlight: "5x optical zoom and the most powerful iPhone 15.",
    specs: {
      display: '6.7" ProMotion 120Hz Always-On',
      chip: "A17 Pro",
      camera: "48MP triple (wide + ultra-wide + 5x telephoto)",
      features: ["5G", "USB-C", "Titanium", "Action button", "ProRes", "LiDAR"],
    },
  },

  // ── iPhone 16 series ──────────────────────────────────────────────────
  {
    model: "iPhone 16",
    tier: "mid",
    size: "standard",
    usage: "everyday",
    highlight: "Camera Control button and A18 chip.",
    specs: {
      display: '6.1" Super Retina XDR',
      chip: "A18",
      camera: "48MP dual (wide + ultra-wide)",
      features: ["5G", "USB-C", "MagSafe", "Camera Control", "Apple Intelligence"],
    },
  },
  {
    model: "iPhone 16 Plus",
    tier: "mid",
    size: "large",
    usage: "everyday",
    highlight: "Big screen with Camera Control and all-day battery.",
    specs: {
      display: '6.7" Super Retina XDR',
      chip: "A18",
      camera: "48MP dual (wide + ultra-wide)",
      features: ["5G", "USB-C", "MagSafe", "Camera Control", "Apple Intelligence"],
    },
  },
  {
    model: "iPhone 16 Pro",
    tier: "premium",
    size: "standard",
    usage: "power",
    highlight: "A18 Pro chip, 48MP ultra-wide, 4K120 video.",
    specs: {
      display: '6.3" ProMotion 120Hz Always-On',
      chip: "A18 Pro",
      camera: "48MP triple (wide + 48MP ultra-wide + 5x telephoto)",
      features: ["5G", "USB-C", "Titanium", "Camera Control", "ProRes", "Apple Intelligence"],
    },
  },
  {
    model: "iPhone 16 Pro Max",
    tier: "premium",
    size: "large",
    usage: "power",
    highlight: "Largest iPhone display ever with best-in-class camera.",
    specs: {
      display: '6.9" ProMotion 120Hz Always-On',
      chip: "A18 Pro",
      camera: "48MP triple (wide + 48MP ultra-wide + 5x telephoto)",
      features: ["5G", "USB-C", "Titanium", "Camera Control", "ProRes", "Apple Intelligence"],
    },
  },
  {
    model: "iPhone 16e",
    tier: "budget",
    size: "standard",
    usage: "basic",
    highlight: "Affordable iPhone with A18 chip and Apple Intelligence.",
    specs: {
      display: '6.1" OLED',
      chip: "A18",
      camera: "48MP single",
      features: ["5G", "USB-C", "Face ID", "Apple Intelligence"],
    },
  },

  // ── iPhone 17 series ──────────────────────────────────────────────────
  {
    model: "iPhone 17",
    tier: "mid",
    size: "standard",
    usage: "everyday",
    highlight: "Latest generation with Apple Intelligence built in.",
    specs: {
      display: '6.1" ProMotion 120Hz',
      chip: "A19",
      camera: "48MP dual (wide + ultra-wide)",
      features: ["5G", "USB-C", "MagSafe", "Dynamic Island", "Apple Intelligence"],
    },
  },
  {
    model: "iPhone 17 Air",
    tier: "premium",
    size: "standard",
    usage: "everyday",
    highlight: "Ultra-thin design — the thinnest iPhone ever.",
    specs: {
      display: '6.6" ProMotion 120Hz',
      chip: "A19",
      camera: "48MP single",
      features: ["5G", "USB-C", "Ultra-thin", "MagSafe", "Apple Intelligence"],
    },
  },
  {
    model: "iPhone 17 Pro",
    tier: "premium",
    size: "standard",
    usage: "power",
    highlight: "A19 Pro chip with advanced pro camera system.",
    specs: {
      display: '6.3" ProMotion 120Hz Always-On',
      chip: "A19 Pro",
      camera: "48MP triple (wide + ultra-wide + 5x telephoto)",
      features: ["5G", "USB-C", "Titanium", "Camera Control", "ProRes", "Apple Intelligence"],
    },
  },
  {
    model: "iPhone 17 Pro Max",
    tier: "premium",
    size: "large",
    usage: "power",
    highlight: "The ultimate iPhone — largest display, best cameras.",
    specs: {
      display: '6.9" ProMotion 120Hz Always-On',
      chip: "A19 Pro",
      camera: "48MP triple (wide + ultra-wide + 5x telephoto)",
      features: ["5G", "USB-C", "Titanium", "Camera Control", "ProRes", "Apple Intelligence"],
    },
  },
];

/** Lookup map for quick access by model name. */
export const IPHONE_MODEL_MAP = new Map(
  IPHONE_MODELS.map((m) => [m.model, m])
);
