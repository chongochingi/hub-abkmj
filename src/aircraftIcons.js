/**
 * Aircraft marker shapes from tar1090 / globe.adsbexchange.com (wiedehopf/tar1090 markers.js).
 */

export const KINDS = {
  AIRLINER: "airliner",
  AIRLINER_NARROW: "airliner-narrow",
  JET_SWEPT: "jet-swept",
  JET_NONSWEPT: "jet-nonswept",
  PROP: "prop",
  PROP_CIRRUS: "prop-cirrus",
  HEAVY_JET: "heavy-jet",
  HEAVY_4E: "heavy-4e",
  MILITARY: "military",
  TURBOPROP: "turboprop",
  HELICOPTER: "helicopter",
  GLIDER: "glider",
  BALLOON: "balloon",
  GROUND: "ground",
  UNKNOWN: "unknown",
};

const SVG = {
  [KINDS.AIRLINER]: {
    d: "M16 1c-.17 0-.67.58-.9 1.03-.6 1.21-.6 1.15-.65 5.2-.04 2.97-.08 3.77-.18 3.9-.15.17-1.82 1.1-1.98 1.1-.08 0-.1-.25-.05-.83.03-.5.01-.92-.05-1.08-.1-.25-.13-.26-.71-.26-.82 0-.86.07-.78 1.5.03.6.08 1.17.11 1.25.05.12-.02.2-.25.33l-8 4.2c-.2.2-.18.1-.19 1.29 3.9-1.2 3.71-1.21 3.93-1.21.06 0 .1 0 .13.14.08.3.28.3.28-.04 0-.25.03-.27 1.16-.6.65-.2 1.22-.35 1.28-.35.05 0 .12.04.15.17.07.3.27.27.27-.08 0-.25.01-.27.7-.47.68-.1.98-.09 1.47-.1.18 0 .22 0 .26.18.06.34.22.35.27-.01.04-.2.1-.17 1.06-.14l1.07.02.05 4.2c.05 3.84.07 4.28.26 5.09.11.49.2.99.2 1.11 0 .19-.31.43-1.93 1.5l-1.93 1.26v1.02l4.13-.95.63 1.54c.05.07.12.09.19.09s.14-.02.19-.09l.63-1.54 4.13.95V29.3l-1.93-1.27c-1.62-1.06-1.93-1.3-1.93-1.49 0-.12.09-.62.2-1.11.19-.81.2-1.25.26-5.09l.05-4.2 1.07-.02c.96-.03 1.02-.05 1.06.14.05.36.21.35.27 0 .04-.17.08-.16.26-.16.49 0 .8-.02 1.48.1.68.2.69.21.69.46 0 .35.2.38.27.08.03-.13.1-.17.15-.17.06 0 .63.15 1.28.34 1.13.34 1.16.36 1.16.61 0 .35.2.34.28.04.03-.13.07-.14.13-.14.22 0 .03 0 3.93 1.2-.01-1.18.02-1.07-.19-1.27l-8-4.21c-.23-.12-.3-.21-.25-.33.03-.08.08-.65.11-1.25.08-1.43.04-1.5-.78-1.5-.58 0-.61.01-.71.26-.06.16-.08.58-.05 1.08.04.58.03.83-.05.83-.16 0-1.83-.93-1.98-1.1-.1-.13-.14-.93-.18-3.9-.05-4.05-.05-3.99-.65-5.2C16.67 1.58 16.17 1 16 1z",
    viewBox: "-1 -2 34 34",
  },
  [KINDS.AIRLINER_NARROW]: {
    d: "M34.894 80.404c-1.458.366-14.151 2.859-14.151 2.859l-.069-2.434 12.769-7.019c-1.535-6.779-1.876-8.758-2.061-14.716l-.022-15.412-4.679.026c.018.731-.129 1.457-.429 2.125-.418-.667-.401-1.322-.397-2.101-.794 0-1.561.198-2.352.329.024.836-.095 1.488-.437 2.156-.347-.635-.352-1.136-.402-1.971l-5.735 1.323c-.008.857.04 1.345-.392 2.119-.373-.631-.41-1.257-.41-1.962L1.793 48.877c-1.957.397-1.572.561-1.74 1.544.013-.86-.036-2.334-.026-3.249 0-.52.116-.751.595-.976 7.89-4.004 16.208-7.251 23.891-11.472-.101-.701-.568-.221-.737-.493-.311-2.068-.344-4.905-.118-6.453.04-.224.102-.456.299-.455 1.586.008 1.912-.042 3.26-.013.198.004.294.208.331.427a28.34 28.34 0 0 1 .083 4.839l3.735-3.088.069-13.676C31.706 9.73 33.288.467 35.292.024c2.004.443 3.586 9.706 3.858 15.785.103 1.762.095 11.43.082 13.678l3.735 3.086a28.18 28.18 0 0 1 .075-4.847c.037-.218.124-.415.321-.419 1.349-.029 1.673.021 3.26.013.198 0 .259.233.299.456.225 1.548.194 4.384-.118 6.452-.169.274-.635-.208-.736.495 7.681 4.22 16.001 7.468 23.892 11.471.476.225.594.456.593.978.011.914-.04 2.388-.026 3.248-.168-.983.217-1.148-1.738-1.543l-14.335-3.153c.001.705-.037 1.332-.41 1.963-.431-.775-.384-1.263-.392-2.119l-5.735-1.323c-.049.833-.054 1.336-.401 1.971-.341-.669-.46-1.322-.437-2.156-.791-.132-1.561-.331-2.353-.331.004.781.021 1.434-.397 2.101-.3-.667-.446-1.392-.429-2.123l-4.679-.026-.011 15.412c-.185 5.958-.527 7.938-2.061 14.715l12.769 7.018-.069 2.437-14.151-2.86c-.098.415-.09 1.303-.402 1.292-.312.012-.304-.876-.402-1.291z",
    viewBox: "-2 -2 74.5 87.3",
  },
  [KINDS.JET_SWEPT]: {
    d: "M9.44,23c-.1.6-.35.6-.44.6s-.34,0-.44-.6l-3,.67V22.6A.54.54,0,0,1,6,22.05l2.38-1.12L8,19.33H6.69l0-.2a8.23,8.23,0,0,1-.14-3.85l.06-.18H7.73V13.19h-2L.26,14.29v-.93c0-.28.07-.46.22-.53l7.25-3.6V3.85A4.47,4.47,0,0,1,8.83.49L9,.34l.17.15a4.47,4.47,0,0,1,1.1,3.36V9.23l7.25,3.6c.14.07.22.25.22.53v.93l-5.51-1.1h-2V15.1h1.17l.06.18a8.24,8.24,0,0,1-.15,3.84l0,.2H10l-.36,1.6,2.43,1.14a.52.52,0,0,1,.35.53v1.08Z",
    viewBox: "-1 -1 20 26",
  },
  [KINDS.JET_NONSWEPT]: {
    d: "M9,17.09l-3.51.61v-.3c0-.65.11-1,.33-1.09L8.5,15a5.61,5.61,0,0,1-.28-1.32l-.53-.41-.1-.69H7.12l0-.21a7.19,7.19,0,0,1-.15-2.19L.24,9.05V8.84c0-1.1.51-1.15.61-1.15L7.8,7.18V2.88C7.8.64,8.89.3,8.93.28L9,.26l.07,0s1.13.36,1.13,2.6v4.3l7,.51c.09,0,.59.06.59,1.15v.21l-6.69,1.16a7.17,7.17,0,0,1-.15,2.19l0,.21h-.47l-.1.69-.53.41A5.61,5.61,0,0,1,9.5,15l2.74,1.28c.2.07.31.43.31,1.08v.3Z",
    viewBox: "-2 -2.4 22 22",
  },
  [KINDS.PROP]: {
    d: "M16.36 20.96l2.57.27s.44.05.4.54l-.02.63s-.03.47-.45.54l-2.31.34-.44-.74-.22 1.63-.25-1.62-.38.73-2.35-.35s-.44-.1-.43-.6l-.02-.6s0-.5.48-.5l2.5-.27-.56-5.4-3.64-.1-5.83-1.02h-.45v-2.06s-.07-.37.46-.34l5.8-.17 3.55.12s-.1-2.52.52-2.82l-1.68-.04s-.1-.06 0-.14l1.94-.03s.35-1.18.7 0l1.91.04s.11.05 0 .14l-1.7.02s.62-.09.56 2.82l3.54-.1 5.81.17s.51-.04.48.35l-.01 2.06h-.47l-5.8 1-3.67.11z",
    viewBox: "0 -1 32 31",
  },
  [KINDS.PROP_CIRRUS]: {
    d: "m 32.529,48.297 9.466,-0.384 C 41.957,46.705 41.877,45.583 41.357,45.379 L 32.729,44.318 c -0.171,0.039 0.467,-4.770 1.102,-7.068 0.302,-1.092 0.624,-2.364 0.914,-3.624 0.194,-0.845 0.447,-2.245 1.227,-2.293 l 21.325,-2.424 1.775,0.206 c -0.165,-2.018 -0.034,-4.383 -1.794,-4.523 L 35.400,23.942 35.189,18.157 c -0.172,-1.993 -0.488,-3.164 -0.953,-3.403 l -1.219,-0.439 -0.055,-0.257 c 0,0 5.143,0.347 6.198,-0.023 0.088,-0.031 0.079,-0.231 0,-0.281 -0.363,-0.227 -6.243,0.030 -6.243,0.030 0,0 -0.356,-1.317 -0.700,-1.707 -0.263,0.374 -0.700,1.707 -0.700,1.707 0,0 -5.889,-0.280 -6.440,-0.030 -0.135,0.061 -0.084,0.239 0,0.281 0.787,0.400 6.390,-0.024 6.395,0.023 l -0.055,0.257 -1.219,0.439 c -0.464,0.240 -0.781,1.410 -0.953,3.403 L 29.036,23.942 7.158,24.591 c -1.761,0.140 -1.630,2.505 -1.794,4.523 l 1.775,-0.206 21.325,2.424 c 0.780,0.048 1.033,1.448 1.227,2.293 0.290,1.261 0.612,2.533 0.914,3.624 0.636,2.298 1.273,7.107 1.102,7.068 l -8.628,1.061 c -0.520,0.204 -0.600,1.325 -0.638,2.533 l 9.466,0.384 0.307,3.297 z",
    viewBox: "0 0 64 64",
  },
  [KINDS.HEAVY_JET]: {
    d: "m 31.414,2.728 c -0.314,0.712 -1.296,2.377 -1.534,6.133 l -0.086,13.379 c 0.006,0.400 -0.380,0.888 -0.945,1.252 l -2.631,1.729 c 0.157,-0.904 0.237,-3.403 -0.162,-3.850 l -2.686,0.006 c -0.336,1.065 -0.358,2.518 -0.109,4.088 h 0.434 L 24.057,26.689 8.611,36.852 7.418,38.432 7.381,39.027 8.875,38.166 l 8.295,-2.771 0.072,0.730 0.156,-0.004 0.150,-0.859 3.799,-1.234 0.074,0.727 0.119,0.004 0.117,-0.832 2.182,-0.730 h 1.670 l 0.061,0.822 h 0.176 l 0.062,-0.822 4.018,-0.002 v 13.602 c 0.051,1.559 0.465,3.272 0.826,4.963 l -6.836,5.426 c -0.097,0.802 -0.003,1.372 0.049,1.885 l 7.734,-2.795 0.477,1.973 h 0.232 l 0.477,-1.973 7.736,2.795 c 0.052,-0.513 0.146,-1.083 0.049,-1.885 l -6.836,-5.426 c 0.361,-1.691 0.775,-3.404 0.826,-4.963 V 33.193 l 4.016,0.002 0.062,0.822 h 0.178 L 38.875,33.195 h 1.672 l 2.182,0.730 0.117,0.832 0.119,-0.004 0.072,-0.727 3.799,1.234 0.152,0.859 0.154,0.004 0.072,-0.730 8.297,2.771 1.492,0.861 -0.037,-0.596 -1.191,-1.580 -15.447,-10.162 0.363,-1.225 H 41.125 c 0.248,-1.569 0.225,-3.023 -0.111,-4.088 l -2.686,-0.006 c -0.399,0.447 -0.317,2.945 -0.160,3.850 L 35.535,23.492 C 34.970,23.128 34.584,22.640 34.590,22.240 L 34.504,8.910 C 34.193,4.926 33.369,3.602 32.934,2.722 32.442,1.732 31.894,1.828 31.414,2.728 Z",
    viewBox: "0 -3.2 64.2 64.2",
  },
  [KINDS.HEAVY_4E]: {
    d: "m 30.764,3.957 c -1.030,1.995 -1.438,5.650 -1.600,7.687 -0.248,3.120 -0.114,5.478 -0.156,7.568 -0.016,0.798 -0.737,1.483 -1.435,2.163 l -4.630,4.207 c 0.136,-0.609 0.313,-2.735 0.011,-3.413 l -2.147,-0.067 c -0.337,0.636 -0.227,2.516 -0.102,3.486 l 0.414,0.033 0.179,1.447 -5.794,5.342 c 0.077,-0.914 0.114,-2.161 -0.105,-2.633 l -2.172,-0.078 c -0.367,0.716 -0.185,2.323 -0.053,3.475 h 0.394 l 0.138,0.949 -7.991,6.563 C 5.411,40.937 5.586,41.437 5.564,41.830 l -0.694,2.353 0.005,0.991 0.715,-1.236 10.464,-6.218 c 0.012,0.663 0.110,1.051 0.231,1.010 0.135,-0.045 0.328,-0.852 0.361,-1.290 l 2.274,-1.389 c -0.003,0.493 0.054,1.174 0.196,1.088 0.126,-0.076 0.384,-0.807 0.362,-1.370 l 1.528,-0.943 2.988,-1.018 c 0.073,0.381 0.122,0.929 0.292,0.896 0.159,-0.031 0.257,-0.491 0.355,-1.065 l 1.704,-0.597 c 0.025,0.437 0.163,0.976 0.297,0.914 0.149,-0.070 0.339,-0.647 0.356,-1.118 l 1.935,-0.666 0.054,10.106 c 0.183,3.800 0.173,5.797 0.919,9.127 -0.072,0.573 -0.374,0.766 -0.640,1.020 l -6.724,6.317 -0.007,2.046 8.553,-2.312 c 0.019,0.586 0.061,1.045 0.432,1.368 l 0.146,1.817 0.146,-1.817 c 0.371,-0.323 0.413,-0.782 0.432,-1.368 l 8.553,2.312 -0.007,-2.046 -6.724,-6.317 c -0.266,-0.253 -0.569,-0.446 -0.640,-1.020 0.747,-3.331 0.736,-5.327 0.919,-9.127 l 0.054,-10.106 1.935,0.666 c 0.017,0.470 0.207,1.048 0.356,1.118 0.134,0.062 0.272,-0.477 0.297,-0.914 l 1.704,0.597 c 0.098,0.574 0.196,1.034 0.355,1.065 0.170,0.033 0.219,-0.515 0.292,-0.896 l 2.988,1.018 1.528,0.943 c -0.021,0.563 0.237,1.294 0.362,1.370 0.141,0.086 0.198,-0.595 0.196,-1.088 l 2.274,1.389 c 0.033,0.439 0.227,1.245 0.361,1.290 0.121,0.041 0.219,-0.347 0.231,-1.010 l 10.464,6.218 0.715,1.236 0.005,-0.991 -0.694,-2.353 c -0.021,-0.393 0.153,-0.893 -0.151,-1.143 l -7.991,-6.563 0.138,-0.949 h 0.394 c 0.132,-1.152 0.314,-2.760 -0.053,-3.475 l -2.172,0.078 c -0.218,0.472 -0.182,1.719 -0.105,2.633 l -5.794,-5.342 0.179,-1.447 0.414,-0.033 c 0.125,-0.970 0.236,-2.850 -0.102,-3.486 l -2.147,0.067 c -0.302,0.678 -0.125,2.804 0.011,3.413 l -4.630,-4.207 c -0.698,-0.680 -1.419,-1.365 -1.435,-2.163 -0.042,-2.090 0.092,-4.448 -0.156,-7.568 -0.162,-2.037 -0.600,-5.677 -1.600,-7.687 -0.592,-1.190 -1.211,-1.157 -1.809,0 z",
    viewBox: "0 0 64 64",
  },
  [KINDS.MILITARY]: {
    d: "M 30.82,61.32 29.19,54.84 29.06,60.19 27.70,60.70 22.27,60.63 21.68,59.60 l -0.01,-2.71 6.26,-5.52 -0.03,-3.99 -13.35,-0.01 -3e-6,1.15 -1.94,0.00 -0.01,-1.31 0.68,-0.65 L 13.30,37.20 c -0.01,-0.71 0.57,-0.77 0.60,0 l 0.05,1.57 0.28,0.23 0.26,4.09 L 19.90,38.48 c 0,0 -0.04,-1.26 0.20,-1.28 0.16,-0.02 0.20,0.98 0.20,0.98 l 4.40,-3.70 c 0,0 0.02,-1.28 0.20,-1.28 0.14,-0.00 0.20,0.98 0.20,0.98 l 1.80,-1.54 C 27.02,28.77 28.82,25.58 29,21.20 c 0.06,-1.41 0.23,-3.34 0.86,-3.85 0.21,-4.40 1.32,-11.03 2.39,-11.03 1.07,0 2.17,6.64 2.39,11.03 0.63,0.51 0.80,2.45 0.86,3.85 0.18,4.38 1.98,7.57 2.10,11.44 l 1.80,1.54 c 0,0 0.06,-0.99 0.20,-0.98 0.18,0.01 0.20,1.28 0.20,1.28 l 4.40,3.70 c 0,0 0.04,-1.00 0.20,-0.98 0.24,0.03 0.20,1.28 0.20,1.28 l 5.41,4.60 0.26,-4.09 0.28,-0.23 L 50.59,37.20 c 0.03,-0.77 0.61,-0.71 0.60,0 l 0.02,9.37 0.68,0.65 -0.01,1.31 -1.94,-0.00 -3e-6,-1.15 -13.35,0.01 -0.03,3.99 6.26,5.52 L 42.81,59.60 42.22,60.63 36.79,60.70 35.43,60.19 35.30,54.84 33.67,61.32 Z",
    viewBox: "-7.8 0 80 80",
  },
  [KINDS.TURBOPROP]: {
    d: "M 9.53,0.50 C 9.51,0.54 9.42,0.76 9.38,0.82 9.05,0.53 6.02,0.49 6.02,0.99 c 0.50,0 2.50,0.13 3.33,-0.08 C 8.52,1.63 8.53,3.51 8.23,6.47 L 1.33,7.00 C 0.50,7.07 0.50,7.57 0.50,8.44 L 5.97,9.39 C 6.71,9.58 8.12,10.04 8.12,10.04 c 0,0 0.29,4.81 0.82,6.26 l -2.91,0.67 c 0,0 -0.19,0.63 -0.19,1.20 l 3.54,0.23 0.08,0.11 0.08,-0.11 3.55,-0.20 c -0.00,-0.56 -0.18,-1.20 -0.18,-1.20 L 9.99,16.30 c 0.55,-1.44 0.88,-6.25 0.88,-6.25 0,0 1.41,-0.45 2.15,-0.63 l 5.48,-0.90 c 0.01,-0.87 0.01,-1.38 -0.81,-1.45 L 10.79,6.49 C 10.51,3.52 10.54,1.64 9.71,0.91 10.54,1.13 12.54,1.02 13.04,1.03 13.05,0.52 10.02,0.53 9.68,0.82 9.65,0.76 9.55,0.54 9.53,0.50 Z",
    viewBox: "-2 -2 23 23",
  },
  [KINDS.HELICOPTER]: {
    d: "m 24.698,60.712 c 0,0 -0.450,2.134 -0.861,2.142 -0.561,0.011 -0.480,-3.836 -0.593,-5.761 -0.064,-1.098 1.381,-1.192 1.481,-0.042 l 5.464,0.007 -0.068,-9.482 -0.104,-1.108 c -2.410,-2.131 -3.028,-3.449 -3.152,-7.083 l -12.460,13.179 c -0.773,0.813 -2.977,0.599 -3.483,-0.428 L 26.920,35.416 26.866,29.159 11.471,14.513 c -0.813,-0.773 -0.599,-2.977 0.428,-3.483 l 14.971,14.428 0.150,-5.614 c -0.042,-1.324 1.075,-4.784 3.391,-5.633 0.686,-0.251 2.131,-0.293 3.033,0.008 2.349,0.783 3.433,4.309 3.391,5.633 l 0.073,4.400 12.573,-12.763 c 0.779,-0.807 2.977,-0.599 3.483,0.428 L 37.054,28.325 37.027,35.027 52.411,49.365 c 0.813,0.773 0.599,2.977 -0.428,3.483 L 36.992,38.359 c -0.124,3.634 -0.742,5.987 -3.152,8.118 l -0.104,1.108 -0.068,9.482 5.321,-0.068 c 0.101,-1.150 1.546,-1.057 1.481,0.042 -0.113,1.925 -0.032,5.772 -0.593,5.761 -0.412,-0.008 -0.861,-2.142 -0.861,-2.142 l -5.387,-0.011 0.085,9.377 -1.094,2.059 -1.386,-0.018 -1.093,-2.049 0.085,-9.377 z",
    viewBox: "-13 -13 90 90",
  },
  [KINDS.GLIDER]: {
    d: "M16,2 L2,14 L16,18 L30,14 Z",
    viewBox: "0 0 32 20",
  },
  [KINDS.BALLOON]: {
    d: "M3.56,12.75a.49.49,0,0,1-.46-.34L2.63,11a.51.51,0,0,1,.07-.44l.1-.1-2-3.68a.48.48,0,0,1-.05-.17,4.39,4.39,0,0,1-.48-2A4.29,4.29,0,0,1,4.5.25,4.29,4.29,0,0,1,8.75,4.58a4.39,4.39,0,0,1-.48,2,.45.45,0,0,1-.05.17l-2,3.68a.44.44,0,0,1,.1.1.51.51,0,0,1,.07.45L5.9,12.41a.49.49,0,0,1-.46.34Zm1.6-2.43L6.1,8.59A4.22,4.22,0,0,1,5,8.88v1.44ZM4,10.32V8.88A4.22,4.22,0,0,1,2.9,8.59l.94,1.73Z",
    viewBox: "-2 -2 13 17",
  },
  [KINDS.GROUND]: {
    d: "M9.5,15.75c-.21,0-.34-.17-.41-.51l-2.88.23v-.27c0-.78,0-1.11.28-1.13L9,13.1c-.31-1.86-.55-5-.59-5.55l-.08-.09H6.08L.25,6.54v-1A.43.43,0,0,1,.67,5l3.75-.27L5,4.45V3.53H4.73V2.7a.35.35,0,0,1,.34-.35h.07c.12-.52.26-.83.54-.83s.42.31.53.83h.07a.35.35,0,0,1,.34.35v.83H6.36v1l2-.08C8.42.81,9.09.25,9.49.25s1.09.55,1.12,4.21l2,.08v-1h-.25V2.7a.35.35,0,0,1,.34-.35h.07c.12-.52.26-.83.53-.83s.42.31.54.83h.07a.35.35,0,0,1,.34.35v.83H14v.92l.57.32L18.32,5a.42.42,0,0,1,.43.46v1L13,7.46H10.71l-.08.09c0,.56-.27,3.68-.59,5.55l2.46,1c.28,0,.28.35.28,1.13v.27l-2.88-.23C9.84,15.58,9.71,15.75,9.5,15.75Z",
    viewBox: "-3 -4 25 22",
  },
};

SVG[KINDS.UNKNOWN] = SVG[KINDS.AIRLINER];

const TYPE_TO_KIND = {
  A318: KINDS.AIRLINER_NARROW,
  A319: KINDS.AIRLINER_NARROW,
  A320: KINDS.AIRLINER_NARROW,
  A20N: KINDS.AIRLINER_NARROW,
  A21N: KINDS.AIRLINER_NARROW,
  A321: KINDS.AIRLINER_NARROW,
  A359: KINDS.AIRLINER_NARROW,
  A388: KINDS.HEAVY_4E,
  B731: KINDS.AIRLINER_NARROW,
  B732: KINDS.AIRLINER_NARROW,
  B733: KINDS.AIRLINER_NARROW,
  B734: KINDS.AIRLINER_NARROW,
  B735: KINDS.AIRLINER_NARROW,
  B736: KINDS.AIRLINER_NARROW,
  B737: KINDS.AIRLINER_NARROW,
  B738: KINDS.AIRLINER_NARROW,
  B739: KINDS.AIRLINER_NARROW,
  B37M: KINDS.AIRLINER_NARROW,
  B38M: KINDS.AIRLINER_NARROW,
  B39M: KINDS.AIRLINER_NARROW,
  E170: KINDS.AIRLINER,
  E75L: KINDS.AIRLINER,
  E75S: KINDS.AIRLINER,
  E190: KINDS.AIRLINER,
  E195: KINDS.AIRLINER,
  BCS1: KINDS.AIRLINER,
  BCS3: KINDS.AIRLINER,
  CRJ1: KINDS.JET_SWEPT,
  CRJ2: KINDS.JET_SWEPT,
  CRJ7: KINDS.JET_SWEPT,
  CRJ9: KINDS.JET_SWEPT,
  CRJX: KINDS.JET_SWEPT,
  C560: KINDS.JET_NONSWEPT,
  C56X: KINDS.JET_NONSWEPT,
  C680: KINDS.JET_SWEPT,
  C68A: KINDS.JET_SWEPT,
  C750: KINDS.JET_SWEPT,
  E550: KINDS.JET_SWEPT,
  CL30: KINDS.JET_SWEPT,
  CL35: KINDS.JET_SWEPT,
  CL60: KINDS.JET_SWEPT,
  C25B: KINDS.JET_NONSWEPT,
  C550: KINDS.JET_NONSWEPT,
  E55P: KINDS.JET_NONSWEPT,
  SF50: KINDS.JET_NONSWEPT,
  C172: KINDS.PROP,
  C182: KINDS.PROP,
  C208: KINDS.PROP,
  TEX2: KINDS.PROP,
  SR20: KINDS.PROP_CIRRUS,
  SR22: KINDS.PROP_CIRRUS,
  S22T: KINDS.PROP_CIRRUS,
  PC12: KINDS.TURBOPROP,
  TBM9: KINDS.TURBOPROP,
  C130: KINDS.TURBOPROP,
  B752: KINDS.HEAVY_JET,
  B753: KINDS.HEAVY_JET,
  B772: KINDS.HEAVY_JET,
  B773: KINDS.HEAVY_JET,
  B77L: KINDS.HEAVY_JET,
  B77W: KINDS.HEAVY_JET,
  MD11: KINDS.HEAVY_JET,
  B741: KINDS.HEAVY_4E,
  B742: KINDS.HEAVY_4E,
  B743: KINDS.HEAVY_4E,
  B744: KINDS.HEAVY_4E,
  B748: KINDS.HEAVY_4E,
  EC35: KINDS.HELICOPTER,
  EC45: KINDS.HELICOPTER,
  EC55: KINDS.HELICOPTER,
  A139: KINDS.HELICOPTER,
  A149: KINDS.HELICOPTER,
  B06: KINDS.HELICOPTER,
  B429: KINDS.HELICOPTER,
  R44: KINDS.HELICOPTER,
  R66: KINDS.HELICOPTER,
  R22: KINDS.HELICOPTER,
  S76: KINDS.HELICOPTER,
  H47: KINDS.HELICOPTER,
  H60: KINDS.HELICOPTER,
  UH60: KINDS.HELICOPTER,
  F16: KINDS.MILITARY,
  F15: KINDS.MILITARY,
  F18: KINDS.MILITARY,
  F22: KINDS.MILITARY,
  GLID: KINDS.GLIDER,
  BALL: KINDS.BALLOON,
  TWR: KINDS.GROUND,
  GND: KINDS.GROUND,
};

function inferFromCategory(category) {
  switch ((category || "").toUpperCase().trim()) {
    case "A1":
      return KINDS.PROP;
    case "A2":
      return KINDS.JET_SWEPT;
    case "A3":
    case "A4":
      return KINDS.AIRLINER_NARROW;
    case "A5":
      return KINDS.HEAVY_JET;
    case "A6":
      return KINDS.MILITARY;
    case "A7":
    case "7":
      return KINDS.HELICOPTER;
    case "B1":
      return KINDS.GLIDER;
    case "B2":
      return KINDS.BALLOON;
    case "B6":
      return KINDS.UNKNOWN;
    case "C0":
    case "C1":
    case "C2":
    case "C3":
      return KINDS.GROUND;
    default:
      return category?.toUpperCase().startsWith("C") ? KINDS.GROUND : null;
  }
}

function inferFromTypePrefix(type) {
  if (type.startsWith("CRJ") || type.startsWith("CL6")) return KINDS.JET_SWEPT;
  if (
    type.startsWith("E7") ||
    type.startsWith("E17") ||
    type.startsWith("E19") ||
    type.startsWith("E2") ||
    type.startsWith("BCS")
  ) {
    return KINDS.AIRLINER;
  }
  if (
    type.startsWith("B73") ||
    type.startsWith("B38") ||
    type.startsWith("B39") ||
    type.startsWith("A32") ||
    type.startsWith("A21") ||
    type.startsWith("A20")
  ) {
    return KINDS.AIRLINER_NARROW;
  }
  if (
    type.startsWith("B74") ||
    type.startsWith("A388") ||
    type.startsWith("A346") ||
    type.startsWith("A343")
  ) {
    return KINDS.HEAVY_4E;
  }
  if (
    type.startsWith("B75") ||
    type.startsWith("B76") ||
    type.startsWith("B77") ||
    type.startsWith("B78") ||
    type.startsWith("MD11") ||
    type.startsWith("A33") ||
    type.startsWith("A34") ||
    type.startsWith("A35")
  ) {
    return KINDS.HEAVY_JET;
  }
  if (
    type.startsWith("C5") ||
    type.startsWith("C6") ||
    type.startsWith("C7") ||
    type.startsWith("CL3") ||
    type.startsWith("E55") ||
    type.startsWith("FA") ||
    type.startsWith("GLF")
  ) {
    return KINDS.JET_SWEPT;
  }
  if (type.startsWith("SF") || type.startsWith("E50")) return KINDS.JET_NONSWEPT;
  if (
    type.startsWith("C1") ||
    type.startsWith("C2") ||
    type.startsWith("PA") ||
    type.startsWith("BE") ||
    type.startsWith("TEX")
  ) {
    return KINDS.PROP;
  }
  if (type.startsWith("SR2") || type.startsWith("S22")) return KINDS.PROP_CIRRUS;
  if (type.startsWith("H") && type.length <= 4) return KINDS.HELICOPTER;
  if (
    type.startsWith("EC") ||
    type.startsWith("AS") ||
    type.startsWith("AW") ||
    type.startsWith("BK") ||
    type.startsWith("S76") ||
    type.startsWith("R44") ||
    type.startsWith("R66") ||
    type.startsWith("R22") ||
    type.startsWith("H60") ||
    type.startsWith("UH") ||
    type.startsWith("B06") ||
    type.startsWith("MD5") ||
    type.startsWith("A109")
  ) {
    return KINDS.HELICOPTER;
  }
  if (type.startsWith("PC") || type.startsWith("TBM")) return KINDS.TURBOPROP;
  if (
    type.startsWith("F1") ||
    type.startsWith("F2") ||
    type.startsWith("F3") ||
    type.startsWith("F4") ||
    type.startsWith("F5")
  ) {
    return KINDS.MILITARY;
  }
  return null;
}

function inferFromDescription(description) {
  const d = (description || "").toUpperCase();
  if (!d) return null;
  if (d.includes("ERJ") || d.includes("EMBRAER 1") || d.includes("EMB-17") || d.includes("EMB-19")) {
    return KINDS.AIRLINER;
  }
  if (
    d.includes("CRJ") ||
    d.includes("CL-600") ||
    d.includes("CANADAIR") ||
    d.includes("CHALLENGER") ||
    d.includes("CITATION") ||
    d.includes("GULF") ||
    d.includes("LEARJET") ||
    d.includes("FALCON")
  ) {
    return KINDS.JET_SWEPT;
  }
  if (d.includes("T-6") || d.includes("TEXAN") || d.includes("CESSNA") || d.includes("PIPER") || d.includes("BEECH")) {
    return KINDS.PROP;
  }
  if (d.includes("SR22") || d.includes("SR20") || d.includes("CIRRUS")) return KINDS.PROP_CIRRUS;
  if (d.includes("SF50") || d.includes("VISION")) return KINDS.JET_NONSWEPT;
  if (d.includes("KING AIR") || d.includes("PC-12") || d.includes("TBM") || d.includes("TURBO")) {
    return KINDS.TURBOPROP;
  }
  if (d.includes("BOEING 7") && (d.includes("47") || d.includes("48"))) return KINDS.HEAVY_4E;
  if (d.includes("BOEING 7") || d.includes("AIRBUS A3") || d.includes("737") || d.includes("A320") || d.includes("A321")) {
    return KINDS.AIRLINER_NARROW;
  }
  if (
    d.includes("HELICOP") ||
    d.includes("ROTOR") ||
    d.includes("HELI ") ||
    d.includes(" BELL ") ||
    d.includes("ROBINSON") ||
    d.includes("SIKORSKY") ||
    d.includes("AGUSTA") ||
    d.includes("AIRBUS H")
  ) {
    return KINDS.HELICOPTER;
  }
  return null;
}

export function kindFor(ac, onGround) {
  if (onGround) return KINDS.GROUND;

  const type = (ac.t || "").toUpperCase().trim();
  if (type) {
    if (type === "H") return KINDS.HELICOPTER;
    if (TYPE_TO_KIND[type]) return TYPE_TO_KIND[type];
    const fromPrefix = inferFromTypePrefix(type);
    if (fromPrefix) return fromPrefix;
  }

  const fromCat = inferFromCategory(ac.category);
  if (fromCat) return fromCat;

  return inferFromDescription(ac.desc) || KINDS.AIRLINER_NARROW;
}

export function rotatesWithTrack(kind) {
  return kind !== KINDS.BALLOON && kind !== KINDS.GROUND;
}

export function iconSize(kind) {
  if (kind === KINDS.HELICOPTER || kind === KINDS.HEAVY_4E || kind === KINDS.HEAVY_JET) return 36;
  if (kind === KINDS.AIRLINER_NARROW || kind === KINDS.AIRLINER) return 34;
  return 30;
}

export function svgMarkup(kind, color, trackDeg) {
  const def = SVG[kind] || SVG[KINDS.UNKNOWN];
  const size = iconSize(kind);
  const rotate = rotatesWithTrack(kind) ? trackDeg || 0 : 0;
  return `<svg viewBox="${def.viewBox}" width="${size}" height="${size}" style="transform:rotate(${rotate}deg)" aria-hidden="true">
    <path d="${def.d}" fill="${color}" stroke="#0b1220" stroke-width="1" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
  </svg>`;
}
