# AI Launcher — Launch checklist (VIS-001)

> Companion files: `producthunt.md` (PH draft) and `dev-to.md`
> (long-form article). Run this list end-to-end before pressing
> "submit" on PH.

## T-minus 7 days

- [ ] **Tag a real release** — `git tag v22.0.0` (or current) and let
      the release workflow produce a clean build.
- [ ] **Verify the .msi/.exe downloads** on a clean Windows VM
      (`scripts/smoke-packaged-app.mjs`).
- [ ] **Verify auto-update** end-to-end: install v21, publish v21.0.1
      with a `latest.json`, confirm the in-app updater picks it up
      and installs on close.
      *Requires:* `TAURI_SIGNING_PRIVATE_KEY` + password in GitHub
      Secrets (see `docs/SIGNING.md`).
- [ ] **Audit release assets** with `scripts/audit-release.sh
      v22.0.0`.
- [ ] **Star count** — read the public star count on the repo; the
      first PH comment will quote it.

## T-minus 3 days

- [ ] **Finalize copy** — paste `producthunt.md` into a real PH draft
      and let one teammate read it cold.
- [ ] **Finalize gallery** — confirm the 6 screenshots render at
      1270×760 and the optional 30-second MP4 is < 30 MB.
- [ ] **Pre-write the dev.to article** — `dev-to.md` is the outline,
      the final post should be in a `dev.to/draft/AI-Launcher.md`
      and ready to publish 24 h after PH.
- [ ] **Schedule a launch tweet** (if using) for 14:05 UTC the same
      day as PH.
- [ ] **Tell 5 people** you'll be on PH that day so the first hour
      has comments.

## T-minus 1 day

- [ ] **Hunter assigned** — confirm who is submitting and at what
      time. Helbert = maker, hunter = someone with PH reputation.
- [ ] **Topics** — final list: `#developer-tools` `#ai` `#cli`
      `#productivity` `#open-source` `#tauri` `#rust`.
- [ ] **Backup plan** if the release workflow breaks: ship a manual
      PH post pointing to the current GitHub release; the PH page
      can be updated post-launch.

## T-zero (launch day)

- [ ] **Confirm GitHub release is public** and `latest.json` is
      reachable at the expected URL.
- [ ] **Submit on Product Hunt** at 14:00 UTC sharp.
- [ ] **First comment** goes up within 60 seconds of submission.
- [ ] **Stay in the comments for 4 hours** — answer every question.
      Polite, technical, no marketing.
- [ ] **Pin a "thanks" comment** that links to GitHub + docs once
      you're done.

## T+1 day

- [ ] **Publish the dev.to article** (`dev-to.md`).
- [ ] **Cross-link** PH comment ↔ dev.to post ↔ GitHub release.
- [ ] **Triage the GitHub issues** that came in from PH — answer
      within 24 h, even if it's a "thanks, will look next week".

## T+1 week

- [ ] **Star count delta** — note it for the next launch.
- [ ] **Comments retrospective** — anything to fix in the first
      comment or gallery for the next release?
- [ ] **Plan v22.x** — every PH comment that mentioned a feature
      becomes an issue in the v22.x milestone.

## Open items (not blockers, but should land)

- [ ] **macOS/Linux builds** — biggest PH comment category is
      "I don't use Windows, when is macOS?"
- [ ] **Code signing via Azure Trusted Signing** — removes the
      SmartScreen warning for Windows users.
      *Requires:* Azure subscription (~US$ 10/month) and
      a `TAURI_SIGNING_PRIVATE_KEY`-equivalent CI integration.
- [ ] **AI Launcher Hub** — community-shared runbooks, requires
      moderation surface we don't have yet.

## Notes

- The submission is not a "promote this app" moment. The pitch that
  wins is "here is a real problem I had, here is a real tool I
  built, here is the code."
- PH rewards honest, technical, no-marketing-speak launches. The
  template above leans that way on purpose.
- The dev.to article is the long-tail asset. PH gives you a 24 h
  spike; dev.to gives you a 2-year tail.
