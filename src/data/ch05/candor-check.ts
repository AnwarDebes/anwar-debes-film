// Generated from candor-check.json (same data), so Node scripts can read it without JSON import attributes.
// eslint-disable-next-line
export const candorCheck = {
 "repo": "AnwarDebes/candor",
 "commit": "6772e1aa6b310dc6d24638f3438705522ddbaa61",
 "date": "2026-10-29",
 "where": "fresh clone of github.com/AnwarDebes/candor (HEAD = 6772e1a)",
 "tools": {
  "node": "v22.14.0"
 },
 "captureFile": "src/data/ch05/candor-check.txt",
 "captureSha256": "f6ddb3e89ae4a7d94722073c4d96c89f023c3a6a061f7d97f73202fc86a89daf",
 "runs": [
  {
   "cmd": "node --test live/tests/forward.test.mjs",
   "output": [
    "TAP version 13",
    "# Subtest: planted: probabilities, certificate and active atoms match PyTorch",
    "ok 1 - planted: probabilities, certificate and active atoms match PyTorch",
    "  ---",
    "  duration_ms: 83.5883",
    "  ...",
    "# Subtest: trojan: probabilities, certificate and active atoms match PyTorch",
    "ok 2 - trojan: probabilities, certificate and active atoms match PyTorch",
    "  ---",
    "  duration_ms: 15.3218",
    "  ...",
    "# Subtest: inputs made in the browser are read correctly, and the legible twin agrees",
    "ok 3 - inputs made in the browser are read correctly, and the legible twin agrees",
    "  ---",
    "  duration_ms: 228.503",
    "  ...",
    "1..3",
    "# tests 3",
    "# suites 0",
    "# pass 3",
    "# fail 0",
    "# cancelled 0",
    "# skipped 0",
    "# todo 0",
    "# duration_ms 1055.5997"
   ],
   "exit": 0
  }
 ]
} as const;
