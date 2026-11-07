# Gate 7B.5 — Claims and Disclosures Review

## Required disclosures verified

README, UI, API, and source preserve these boundaries:

| Claim | Finding |
|---|---|
| 8.5% annualized | Explicitly illustrative/model-only, not verified current or forward APY. |
| Qualifying sources | Only one independently qualifying source, Faroo stPROS, is established. |
| Three-source requirement | Explicitly stated as unmet. |
| Instant DEX exit | Classified as an execution alternative, not another yield source. |
| Transactions | Unsigned calldata review only; no keys, signing, or broadcasting. |
| Vercel | Local packaging/simulation is not cloud deployment. |
| Metrics | Engineering checks are explicitly not hackathon points or judging scores. |

The UI contains one-source, unsigned-transaction, modeling, and no-guaranteed-return notices. No screenshot, badge image, or demo video is committed.

## Findings requiring owner review

### README integration count

README line 68 says 34 live integration tests. Current static `it(...)` declarations are:

- `tests/integration/liveRpc.test.ts`: 6
- `tests/integration/productionSmoke.test.ts`: 9
- `tests/integration/vercelAdapter.test.ts`: 16
- Integration total: 31
- All current test declarations: 130

The total is consistent; the integration subset is not. Reconcile in a separately authorized documentation commit.

### Historical metrics

Older Gate 7A reports state 126 tests and 12 simulator checks; later material states 130 and 13. These may be dated snapshots, but must not be presented as current without context.

### License

`package.json` contains `"license": "MIT"`, but no `LICENSE`, `COPYING`, or `NOTICE` is committed. This is a legal/presentation gap. Do not add or infer a license without owner approval.

### Broken links

README link inspection found 10 missing relative targets, including absent Gate 1B, 1C, 1D, 1E, Gate 2, and Gate 3 filenames. Correct or remove them only in a separately authorized follow-up.

### Competition/video language

Historical Gate 1/6 docs mention Task 15 point values and a planned video bonus. They must not be read as proof of awarded scores or a recorded/published video. The README correctly distinguishes engineering checks from judging points.

## Preserve these statements

1. 8.5% is illustrative only.
2. One qualifying source is established; three are required and unmet.
3. Instant DEX exit is a liquidity/execution route, not a qualifying source.
4. Transaction preparation is unsigned and non-custodial.
5. Local Vercel simulation is not cloud deployment.
6. Tests/checks are not hackathon points or judging results.

## Conclusion

Core financial and non-custodial claims are responsibly disclosed. Publication remains conditional on owner review of the README issues, historical metrics/path presentation, and license presentation.
