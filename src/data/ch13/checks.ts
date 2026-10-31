// A real check run for this chapter (not staged): ballast's tests from a clean export of the cloned
// repository at its HEAD, 6f113a58a3f10113f04161d699e412ddcfd95df1, on 29 Oct 2026, with Python 3.14.3,
// pytest 9.0.2 and the two declared dependencies the suite imports (SQLAlchemy, pydantic-settings;
// pyproject.toml:15-20). Output exactly as printed (pyproject sets addopts = "-q"); the full run's 9
// collection errors are each "ModuleNotFoundError: No module named 'ballast.data'".
export const BALLAST_CHECK = {
  repo: 'ballast',
  commit: '6f113a5',
  date: '29 Oct 2026',
  env: 'Python 3.14.3 · pytest 9.0.2',
  risk: {
    cmd: 'pytest tests/test_risk.py',
    out: ['...........                                                              [100%]', '11 passed in 1.36s'],
  },
  full: {
    cmd: 'pytest',
    out: ["E   ModuleNotFoundError: No module named 'ballast.data'", '!!!!!!!!!!!!!!!!!!! Interrupted: 9 errors during collection !!!!!!!!!!!!!!!!!!!'],
  },
} as const;
