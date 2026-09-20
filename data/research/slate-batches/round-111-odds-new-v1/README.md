# Round 111 ODDS_NEW admission

{
  "reviewedAt": "2026-09-20T03:36:00.044Z",
  "dates": {
    "2026-09-20": {
      "targetCount": 50,
      "sports": {
        "BASEBALL": 11,
        "BASKETBALL": 3,
        "SOCCER": 31,
        "VOLLEYBALL": 5
      },
      "freezeReady": true,
      "freeze": "SOURCE_FREEZE_CREATED",
      "scopeLock": "LOCKED",
      "excluded": 0,
      "artifacts": [
        {
          "path": "data/operator-input/betman/2026-09-20-daily-slate-v1.json",
          "sha256": "5e5bcb1fbe17bb070ee2188d4777086ffa178513a32ee84ebb933d573ccd6f87"
        },
        {
          "path": "data/research/daily-slates/2026-09-20-research-slate-source-freeze-v1.json",
          "sha256": "26af6f4b3bca8bddc25b20ce6ecfd66ea2cbb10119df782396f867bb24b99b4a"
        },
        {
          "path": "data/audits/2026-09-20-research-target-scope-lock-v1.json",
          "sha256": "ee07df7cc50a0ab21ed7d228cd585f22777c92a5c5ab0cc7e43fe8cbce87ccbd"
        }
      ],
      "validation": {
        "status": "FREEZE_READY",
        "blockingReasons": []
      }
    },
    "2026-09-21": {
      "targetCount": 11,
      "sports": {
        "SOCCER": 11
      },
      "freezeReady": true,
      "freeze": "SOURCE_FREEZE_CREATED",
      "scopeLock": "LOCKED",
      "excluded": 0,
      "artifacts": [
        {
          "path": "data/operator-input/betman/2026-09-21-daily-slate-v1.json",
          "sha256": "fb32332e81f9358d4534a551ca4868d917fd91e86ea3b93c5050a3dfa8a670d2"
        },
        {
          "path": "data/research/daily-slates/2026-09-21-research-slate-source-freeze-v1.json",
          "sha256": "d684260d1fc6fa4b1211661e06fad0ca245809a2f7f8ada7118d7dafbfd9b466"
        },
        {
          "path": "data/audits/2026-09-21-research-target-scope-lock-v1.json",
          "sha256": "525efad73933ad8296b346cecfb80fd9a30d70aa1591c0b4ce9d65ecda7faab5"
        }
      ],
      "validation": {
        "status": "FREEZE_READY",
        "blockingReasons": []
      }
    }
  },
  "windows": {
    "2026-09-20": {
      "open": 50,
      "missed": 0
    },
    "2026-09-21": {
      "open": 11,
      "missed": 0
    }
  }
}

This is a separately named research batch. Internal paths resolve from this directory. Original date scopes and MLB targets remain unchanged. Odds remain in the reviewed source audit; the operator/freeze/scope chain contains identities only. The owner confirmation covers these 61 games, not all globally scheduled fixtures.

## Production gate

Default production and V4 runners read repository-root date paths and cannot safely select this batch. Do not run them against this directory or copy these files onto prior scopes. Implement and test explicit committed batch resolution across operator, source, lock, decisions and collector before production. Exact provider fixture identities, sealed pregame input, registry and rights evidence are also missing. No Prediction, PASS, provider call or V4 collection was executed. No automatic watcher was installed.

## Mandatory previews

### 맨체스C vs 선덜랜드

EPL, 2026-09-20T22:00:00+09:00. LIMITED_PREVIEW; mandatory. Home/away and time human-confirmed. Venue unknown. V1 unavailable pending exact identity and safe input. XI unconfirmed; injuries unknown. Form, tactics and results not accessed.

Planned existing-policy poll times: 2026-09-20T21:00:00.000+09:00, 2026-09-20T21:20:00.000+09:00, 2026-09-20T21:30:00.000+09:00, 2026-09-20T21:40:00.000+09:00. These are a plan, not scheduled or executed jobs.

### AT마드 vs 레알마드

라리가, 2026-09-20T23:15:00+09:00. LIMITED_PREVIEW; mandatory. Home/away and time human-confirmed. Venue unknown. V1 unavailable pending exact identity and safe input. XI unconfirmed; injuries unknown. Form, tactics and results not accessed.

Planned existing-policy poll times: 2026-09-20T22:15:00.000+09:00, 2026-09-20T22:35:00.000+09:00, 2026-09-20T22:45:00.000+09:00, 2026-09-20T22:55:00.000+09:00. These are a plan, not scheduled or executed jobs.

## Verification

- 61 identity-only games
- 50/11 KST separation
- human receipt linked by hash
- all new image hashes unchanged
- duplicate identity and ID checks
- FREEZE_READY both dates
- freeze->operator hash chain
- lock->freeze hash chain
- idempotent freeze/lock byte preservation
- 6 original protected files unchanged
- blank odds remain null
- both mandatory previews created
