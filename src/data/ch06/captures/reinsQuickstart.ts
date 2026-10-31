// The capture of a real on-camera check, line for line as printed (generated from reins-quickstart.txt).
export const REINS_QUICKSTART = {
  "repo": "AnwarDebes/reins",
  "commit": "6f0cf551db70cf628683ed80958360110e27a6e2",
  "short": "6f0cf55",
  "date": "2026-10-29",
  "clone": "git clone https://github.com/AnwarDebes/reins.git (HEAD 6f0cf55)",
  "env": "Python 3.14.3; numpy 2.4.3 already installed (venv with system site-packages)",
  "pip": {
    "cmd": "pip install -e .",
    "exit": 0,
    "totalLines": 21,
    "foldedBefore": 17,
    "shown": "Successfully installed reinskit-1.0.0",
    "foldedAfter": 3,
    "sha256": "4486183b2a54f87ca3d8aea879d5129bd1050cd09bb87a16c2e53ba0cfd87832"
  },
  "cmd": "python demo/quickstart.py",
  "exit": 0,
  "captureFile": "reins-quickstart.txt",
  "sha256": "f3eb69ce25eac1e908ad489bbe46d00563bc357883784179aa0d2636bd95aae9",
  "lines": [
    "shieldable (soundness guaranteed?): True ",
    "",
    "step 0: ALLOW read_record(id=42) (no monitor at risk)",
    "step 1: insert[authorize]+allow on transfer_funds(to=internal) [enforcing precedence(authorize<transfer)] -> ['authorize()', 'transfer_funds(to=internal)']",
    "step 2: substitute->archive on delete_all() [enforcing always(within_scope), never(delete_all)] -> ['archive()']",
    "step 3: insert[audit_log]+allow on send_email(to=a@partner.com) [enforcing response(sensitive_read->audit_log,3)] -> ['audit_log()', 'send_email(to=a@partner.com)']",
    "step 4: ALLOW send_email(to=b@partner.com) (no monitor at risk)",
    "step 5: suppress on send_email(to=c@partner.com) [enforcing count_le(export,2,50)] -> ['noop()']",
    "step 6: ALLOW respond() (no monitor at risk)",
    "",
    "session sound: True | interventions: {'insert': 2, 'substitute': 1, 'suppress': 1}",
    "certificate verifies (integrity + soundness + minimality): True",
    "",
    "Merkle root: 799444639054385ef0b7f43d9d01ba56 ..."
  ]
} as const;
