# AI Launcher — Launch checklist (VIS-001)

> Companion files: `producthunt.md` (PH draft) and `dev-to.md`
> (long-form article). Run this list end-to-end before pressing
> "submit" on PH.

## T-minus 7 days

- [ ] **Cut the release tag.** Decide the version (e.g. `v22.0.0` if
      shipping the next release, or `v21.0.1` for a hotfix). Push the
      tag and let `.github/workflows/release.yml` produce a clean build
      (MSI + NSIS, checksums, `latest.json`).
- [ ] **Smoke-test the installers** on a clean Windows VM with
      `npm run smoke:packaged -- --exe "src-tauri/target/release/ai-launcher.exe"`.
      Pass `--require-signature` once signing is on (see below).
- [ ] **Verify auto-update end-to-end.** Install the current
      published v21 build, then push a v21.0.1 hotfix so the
      workflow regenerates `latest.json`. Confirm the in-app updater
      (Updates tab) sees the new version, downloads with progress,
      verifies the signature, and installs on close.
      *Requires signing:* the GitHub secrets `SIGNING_CERT_BASE64` and
      `SIGNING_CERT_PASSWORD` must be set, otherwise the workflow
      skips the sign step and SmartScreen will warn. See
      `docs/SIGNING.md` for how to mint/encode the PFX.
- [ ] **Audit release assets.** Run `scripts/audit-release.sh vX.Y.Z`
      after the GitHub release finishes — it checks asset URLs, sizes
      and manifest content against the tag.
- [ ] **Note the live star count.** Screenshot the repo's
      *Insights → Stars* page. Current public count is **0**; quote
      it honestly in the first PH comment ("0 stars, 0 fluff" lands
      better than a made-up round number).

## T-minus 3 days

- [ ] **Finalize the PH draft.** Paste `producthunt.md` (tagline,
      description, first comment) into a real PH draft form. Have one
      teammate read it cold — anything that reads as "marketing" gets
      cut. Verify the description is ≤260 chars after the paste (PH
      counts em-dashes as multiple bytes sometimes).
- [ ] **Finalize the gallery.** Confirm the 6 screenshots at
      `docs/screenshots/v21/01-..06-*.png` render at 1270×760. If you
      add the optional 30-second MP4 of the detect→install→launch
      flow, keep it under 30 MB and ≤ 720 p.
- [ ] **Pre-write the dev.to article.** `dev-to.md` is the outline;
      the final post lives in a `dev-to/draft/AI-Launcher.md` and is
      ready to publish ~24 h after PH, with cover image
      (`docs/terminal-hero.svg` works) and the canonical links.
- [ ] **Schedule a launch tweet** for 14:05 UTC on PH day (5 min after
      submission, so the PH page is already live). Pin a thread if
      you have one.
- [ ] **Tell 5 people in advance.** DM them the launch time and a
      direct link to the PH page. The first hour of comments is what
      gets you past the front page.

## T-minus 1 day

- [ ] **Confirm the maker + hunter pair.** Helbert = maker (owns the
      first comment and the 4-hour reply window). A hunter with prior
      PH launches posts the link — a fresh account gets deprioritised
      in the queue. Confirm the exact UTC time both are online.
- [ ] **Lock the topic tags.** Final list, in priority order:
      `#developer-tools` `#ai` `#cli` `#productivity` `#open-source`
      `#tauri` `#rust`. PH accepts 3–5 in the form; pick the 4 most
      relevant if the UI complains (`developer-tools`, `ai`, `cli`,
      `open-source`).
- [ ] **Backup plan if the release workflow breaks.** Pre-stage a
      "manual" PH post pointing to the *current* GitHub release
      (whatever tag is public at T-1). The PH page can be edited
      post-launch to swap in the new release URL once it ships.

## T-zero (launch day)

- [ ] **T-30 min.** Confirm the GitHub release is public, the
      installers are attached, and
      `https://github.com/HelbertMoura/ai_launcher/releases/latest/download/latest.json`
      returns a valid JSON (this is the URL the in-app updater
      reads from `tauri.conf.json`).
- [ ] **T-0 (14:00 UTC sharp).** Hunter submits the PH page with the
      pre-staged tagline, description and gallery. Maker hits
      "comment now" with the first comment in `producthunt.md` within
      60 s.
- [ ] **T+0 to T+4 h.** Maker stays in the comments. Answer every
      question. Polite, technical, no marketing. Link to docs/issue
      tracker, never to "buy now" — there is no buy now.
- [ ] **T+4 h.** Pin a closing "thanks" comment with: GitHub repo,
      vX.Y.Z release URL, dev.to article URL, and a one-line "what's
      next" (macOS/Linux, code signing).

## T+1 day

- [ ] **Publish the dev.to article** (move from
      `dev-to/draft/AI-Launcher.md` to public). Add a canonical URL
      to the PH page's first comment and to the GitHub release
      description.
- [ ] **Cross-link the three surfaces.** PH comment ↔ dev.to post ↔
      GitHub release. Check each link actually resolves and the
      anchors/IDs in the article match.
- [ ] **Triage the GitHub issues** that came in from PH — answer
      within 24 h, even if it is "thanks, filed, will look next
      week". Convert every actionable item into a GitHub issue with
      the `from-ph` label.

## T+1 week

- [ ] **Star count delta.** Screenshot it, archive it in
      `docs/releases/vX.Y.Z-postmortem.md` next to the launch date.
      Use the delta, not the absolute, in the next launch's first
      comment.
- [ ] **Comments retrospective.** Read every PH comment (and the
      dev.to comments) with one teammate. Anything that came up more
      than twice goes into a "fix before next launch" list — first
      comment, gallery order, and tagline are the usual suspects.
- [ ] **Plan the next release.** Every PH comment that mentioned a
      feature becomes a GitHub issue in the `vX+1.0` milestone.
      macOS/Linux, code signing, and the most-requested CLI are the
      typical top three.

## Open items (not blockers, but should land)

- [ ] **macOS/Linux builds.** The single most common "I can't use
      this" comment on PH will be "I don't use Windows, when is
      macOS?". Tauri's multi-target story is mature, but the
      install/run scripts in `src-tauri/src/util.rs::resolve_windows_cmd`
      and the file paths in `commands/cli.rs` are Windows-shaped and
      need a porting pass.
- [ ] **EV or Azure Trusted Signing.** Removes the SmartScreen
      "unknown publisher" warning for Windows users. The release
      workflow already has an opt-in signing step that activates when
      `SIGNING_CERT_BASE64` + `SIGNING_CERT_PASSWORD` are present —
      what is missing is the certificate. Options in priority order:
      (1) OV from Sectigo/SSL.com (~$200/yr), (2) Azure Trusted
      Signing (~$10/month, requires a registered business), (3) EV
      with a USB token (~$450/yr). See `docs/SIGNING.md` for the
      full breakdown.
- [ ] **AI Launcher Hub.** Community-shared runbooks. Requires a
      moderation surface (PR review, signing of curated bundles,
      a `from-hub` audit trail) that does not exist yet. Tracked as
      a separate epic, not part of the next release.

## Notes

- The submission is not a "promote this app" moment. The pitch that
  wins is "here is a real problem I had, here is a real tool I
  built, here is the code."
- PH rewards honest, technical, no-marketing-speak launches. The
  template above leans that way on purpose.
- The dev.to article is the long-tail asset. PH gives you a 24 h
  spike; dev.to gives you a 2-year tail.
