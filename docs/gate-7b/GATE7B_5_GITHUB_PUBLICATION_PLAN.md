# Gate 7B.5 — GitHub Publication Plan

Plan only. No GitHub repository was created, no remote was configured, and no command below was executed.

## Recommended identity

- Name: `pharos-yield-optimizer`
- Description: `Non-custodial Pharos Pacific yield optimizer with truth-first source qualification, scenario modeling, and unsigned transaction review.`
- Topics: `pharos`, `defi`, `yield-optimizer`, `staking`, `stpros`, `typescript`, `non-custodial`, `evm`
- Visibility: public, subject to owner approval
- License: owner decision required; metadata says MIT but no LICENSE file exists

## Owner-side authentication

The owner must authenticate in their own GitHub terminal/browser. Do not provide passwords, tokens, cookies, or credentials to the agent. Resolve the README, path, endpoint, count, and license questions before publication if desired.

## Exact command options after approval

### Option A — GitHub CLI creates and pushes

~~~powershell
cd "C:\\Users\\NO GO NO\\PharosBuild\\skills\\pharos-yield-optimizer"
gh auth status
gh repo create JimmyOgb/pharos-yield-optimizer --public --description "Non-custodial Pharos Pacific yield optimizer with truth-first source qualification, scenario modeling, and unsigned transaction review." --source . --remote origin --push
~~~

This creates the repository, configures `origin`, and pushes the existing local `main` branch. Do not run it during this gate.

### Option B — Owner creates an empty repository in the web UI

~~~powershell
cd "C:\\Users\\NO GO NO\\PharosBuild\\skills\\pharos-yield-optimizer"
git remote add origin https://github.com/<OWNER>/pharos-yield-optimizer.git
git push -u origin main
~~~

Replace `<OWNER>` with the owner’s chosen account. Do not force-push. The intended local commit is `d1f033c3517a6cac028db37091e5581143f48766`.

## Post-publication checklist

1. Repository is Public with approved name/description/topics.
2. `origin` points to the intended repository.
3. Default branch is `main`.
4. GitHub `main` tip equals `d1f033c3517a6cac028db37091e5581143f48766`.
5. Only intended files were published; no env/key/log/dependency/build/cache artifacts.
6. README links, license, historical disclosures, and endpoint references are acceptable.
7. Publication does not imply Vercel deployment, wallet signing, blockchain writes, judging scores, or three-source qualification.

No deployment, Vercel authentication, wallet operation, or blockchain write is part of this plan.
