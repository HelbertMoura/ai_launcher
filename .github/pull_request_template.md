### Summary

<!-- 1–3 bullets: what changed and why. -->

### How to test

<!--
Steps a reviewer can follow on Windows to verify the change.
Include the exact CLI / tool if the change affects a specific one.
-->

### Screenshots

<!-- For UI changes. Remove this section otherwise. -->

### Checklist

- [ ] `cargo check --manifest-path src-tauri/Cargo.toml` passes locally
- [ ] `npm run build` passes locally
- [ ] Added or updated `CHANGELOG.md` under the unreleased section
- [ ] If a new CLI / tool was added, both `get_cli_definitions()` (Rust) and
      `CLI_ICONS` / `CLI_COLORS` (React) were updated
