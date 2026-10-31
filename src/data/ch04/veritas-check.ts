// Generated from veritas-check.json (same data), so Node scripts can read it without JSON import attributes.
// eslint-disable-next-line
export const veritasCheck = {
 "repo": "AnwarDebes/veritas",
 "commit": "95527346c073d020010558d2831f1b60bf1b5580",
 "date": "2026-10-29",
 "where": "fresh clone of github.com/AnwarDebes/veritas (HEAD = 9552734), live/",
 "tools": {
  "node": "v22.14.0"
 },
 "captureFile": "src/data/ch04/veritas-check.txt",
 "captureSha256": "899f0ec71ea64ab11342a92d727f2d4a1796b1bcfd5087723f704e29cb4f892d",
 "runs": [
  {
   "cmd": "cd live && npm test",
   "output": [
    "",
    "> test",
    "> node --test tests/solver.test.mjs tests/guard.test.mjs",
    "",
    "TAP version 13",
    "# Subtest: the formula says \"passes\" exactly when the guard lets the input through",
    "ok 1 - the formula says \"passes\" exactly when the guard lets the input through",
    "  ---",
    "  duration_ms: 147234.8569",
    "  ...",
    "# Subtest: a bypass is found, it really passes, and the repair is proved and re-checked",
    "ok 2 - a bypass is found, it really passes, and the repair is proved and re-checked",
    "  ---",
    "  duration_ms: 7666.9018",
    "  ...",
    "# Subtest: agrees with brute force, and every UNSAT answer has a proof that checks",
    "ok 3 - agrees with brute force, and every UNSAT answer has a proof that checks",
    "  ---",
    "  duration_ms: 20676.4026",
    "  ...",
    "# Subtest: a fake proof for a satisfiable formula is rejected",
    "ok 4 - a fake proof for a satisfiable formula is rejected",
    "  ---",
    "  duration_ms: 1.2769",
    "  ...",
    "1..4",
    "# tests 4",
    "# suites 0",
    "# pass 4",
    "# fail 0",
    "# cancelled 0",
    "# skipped 0",
    "# todo 0",
    "# duration_ms 156927.4243"
   ],
   "exit": 0
  }
 ]
} as const;
