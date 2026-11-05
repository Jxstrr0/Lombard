# 00 — Repo setup (do this once, right after creating `Jxstrr0/Lombard`)

Written for doing everything from a phone. Most settings live on **github.com in your phone's browser**; the GitHub mobile app hides a lot of them. If a menu below is missing, open the browser menu and switch on **"Desktop site"**.

Repo URL: `https://github.com/Jxstrr0/Lombard`
Game URL once deployed: `https://jxstrr0.github.io/Lombard/` (the `/Lombard/` path is case-sensitive and must match Vite's `base`).

---

## Step 1 — Visibility

**Settings → General → Danger Zone → Change visibility.**

- **Public:** unlimited GitHub Actions minutes; anyone can read the code and docs.
- **Private:** 3,000 Actions minutes/month on your Pro plan (plenty, even with bakes). Pages still works on private repos with Pro, and the game itself is public either way.

Either is fine. Pick one and note it in `05-OPEN-DECISIONS.md` (Claude Code can do that in the first session).

## Step 2 — Get the handoff docs into the repo

Uploading a .zip to GitHub doesn't unpack it, and phone browsers can't upload folders. Easiest path:

1. On github.com: **Add file → Upload files**.
2. Select all the `.md` files from the handoff: `CLAUDE.md`, `README.md`, `ATTRIBUTION.md`, `00-REPO-SETUP.md`, `01-GDD.md` … `05-OPEN-DECISIONS.md`.
3. Commit straight to `main` with the message `Add handoff docs`.

They'll all land in the repo root. Claude Code moves the numbered docs into `docs/` in its first session (it's in the first prompt at the bottom).

## Step 3 — General settings

**Settings → General:**

| Setting | Set to | Why |
|---|---|---|
| Default branch | `main` | everything assumes it |
| Features → Wikis | off | docs live in `docs/` |
| Features → Issues | on | bug reports and parked ideas |
| Features → Projects | off | not needed |
| Features → Discussions | off | not needed |
| Pull Requests → Allow merge commits | off | keeps history readable |
| Pull Requests → Allow squash merging | on | one clean commit per Claude Code task |
| Pull Requests → Allow rebase merging | off | one way to merge, less confusion |
| Pull Requests → Allow auto-merge | on | lets you approve a PR from the phone and walk away |
| Pull Requests → Automatically delete head branches | on | no branch clutter |

## Step 4 — GitHub Pages

**Settings → Pages → Build and deployment → Source: "GitHub Actions".**

Don't pick "Deploy from a branch". The `deploy.yml` workflow Claude Code writes in M0 builds the site and publishes it directly. Leave custom domain empty for now.

## Step 5 — Actions permissions

**Settings → Actions → General:**

| Setting | Set to | Why |
|---|---|---|
| Actions permissions | Allow all actions and reusable workflows | the workflows use standard actions (checkout, setup-node, cache, Pages deploy) |
| Workflow permissions | **Read and write permissions** | the bake workflow commits the baked shop back to the repo |
| Allow GitHub Actions to create and approve pull requests | on | lets a workflow open a PR instead of pushing, if we switch to that later |

No secrets are needed. Lombard has no API keys, no backend, and nothing to protect in Settings → Secrets.

## Step 6 — Protect `main` (light touch)

**Settings → Rules → Rulesets → New ruleset → New branch ruleset:**

- Name: `protect main`
- Enforcement: Active
- Target branches: Add target → Include default branch
- Rules: tick **Restrict deletions** and **Block force pushes**. Leave everything else off.

Don't turn on "Require a pull request before merging". The bake workflow commits straight to `main`, and requiring PRs would block it.

## Step 7 — Security basics (free, one-time)

**Settings → Advanced Security** (may be called **Code security**):

- Dependabot alerts: on
- Dependabot security updates: on
- Secret scanning / push protection: on if offered (catches an API key accidentally committed)

## Step 8 — Give Claude Code access

1. Open Claude Code from the Claude app or claude.ai/code.
2. Connect GitHub if it asks, and when GitHub asks which repos the Claude app can access, pick **Only select repositories → Lombard** (add more repos later as needed).
3. Start a session on `Jxstrr0/Lombard`.

If a later session reports that a download was blocked (for example Playwright's browser for `npm run shots`), the Claude Code environment's network access setting is too strict. Loosen it for that environment. The Blender bake itself runs in GitHub Actions, not in Claude Code, so it isn't affected.

## Step 9 — Repo "About" box

On the repo's main page, tap the gear next to **About**:

- Description: `A pawn shop sim on the canals of Mostograd. A Longlight Interactive game.`
- Website: `https://jxstrr0.github.io/Lombard/` (tick "Use your GitHub Pages website" once it's live)
- Topics: `game`, `threejs`, `typescript`, `simulation`, `longlight`

## Step 10 — First Claude Code prompt

Paste this into the first session:

> Read `CLAUDE.md`. Then move `00-REPO-SETUP.md` and `01`–`05-*.md` into a `docs/` folder, fix any links, and record the repo visibility in `docs/05-OPEN-DECISIONS.md` (it's [public/private]). Then start M0 from `docs/03-ROADMAP.md`. Set Vite `base` to `/Lombard/`, deploy with a `deploy.yml` workflow using GitHub Pages' official Actions deploy (Pages source is already set to GitHub Actions). Work in small commits. When M0's definition of done is met, stop and give me the deployed URL and a short "how to test on a phone" checklist.

## After M0 lands — quick check

- [ ] Actions tab shows a green `deploy` run.
- [ ] `https://jxstrr0.github.io/Lombard/` opens on your phone and shows the placeholder shop.
- [ ] The build number in the corner matches the latest commit's short hash.
- [ ] Settings → Pages shows "Your site is live".
