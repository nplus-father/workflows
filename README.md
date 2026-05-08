# nplus-father/workflows

Centralised GitHub Actions reusable workflows for all sites under the
`nplus-father` and `Andrewnplus` orgs. Changing a build step here propagates
to every consumer repo on their next push — no need to touch each repo.

## What's inside

| Path | Purpose |
|---|---|
| `.github/workflows/hugobook-build-deploy.yml` | Hugo build (self-hosted) + Deploy. Used by ~860 book repos. |
| `.github/workflows/astro-build-deploy.yml` | Astro build (GitHub-hosted) + Deploy via Pages-artifact. |
| `.github/workflows/astro-ci-check.yml` | Astro PR check (lint + format + build). |
| `.github/workflows/ci-check.yml` | Dummy CI for HugoBook branch protection. |
| `templates/caller-deploy.yml` | Drop-in `deploy.yml` for HugoBook repos. |
| `templates/caller-ci-check.yml` | Drop-in `ci-check.yml` for HugoBook repos. |
| `templates/astro/` | Drop-in caller workflows + dev configs for Astro repos. |
| `docs/MIGRATION.md` | Migration guide + troubleshooting. |

## Versioning

Callers pin with a git tag:

```yaml
uses: nplus-father/workflows/.github/workflows/hugobook-build-deploy.yml@v1
uses: nplus-father/workflows/.github/workflows/astro-build-deploy.yml@v1
```

- `v1` = stable major. Backward-compatible additions and bug fixes land here.
- `v2`, `v3` = breaking changes. Old callers keep working until they opt in.
- `@main` = bleeding edge. Only use in pilot repos while iterating.

After merging any PR here:

```bash
git tag -fa v1 -m "v1 rolling tag"
git push -f origin v1
```

(Force-push the rolling major tag. Callers pinned to `@v1` pick up on next run.)

### Release discipline (avoid breaking every consumer at once)

Because every Astro / HugoBook caller pins `@v1`, a bad commit on `v1` simultaneously
breaks **all** consumers (~860 book repos + 3 Astro sites). To keep this powerful
but not dangerous:

1. **Test on `main` before moving `v1`.** Push your change, then dispatch the
   relevant workflow on a low-stakes consumer with `@main`:
   ```bash
   # Pick one Astro pilot repo
   gh workflow run deploy.yml --repo nplus-father/<sandbox-repo> \
     --ref main --raw-field workflow_ref=main
   gh run watch --repo nplus-father/<sandbox-repo>
   ```
   Only after that succeeds → move `v1`.

2. **Move `v1` only to commits that have actually run green** on a real consumer.
   Don't tag-and-pray.

3. **Rollback procedure** if you discover `v1` is broken in production:
   ```bash
   # Find the last known-good commit
   git log v1 --oneline -10

   # Reset v1 to it
   git tag -fa v1 <good-sha> -m "rollback v1 to <good-sha>"
   git push -f origin v1
   ```
   Daily-cron consumers will pick up the rollback within 24h; push consumers
   need to push (or workflow_dispatch) once.

4. **Breaking changes go to `v2`**, never to `v1`. Add a new file
   (e.g. `astro-build-deploy-v2.yml`) or bump in-place but with a new major tag,
   and migrate consumers one at a time.

5. **List of `@v1` consumers** (alert these if you have to roll back):
   - `nplus-father/nplus-father.github.io` (portal, `astro-portal-build-deploy`)
   - `Andrewnplus/andrewnplus.github.io` (`astro-build-deploy`)
   - `Andrewnplus/outside-the-walls` (`astro-build-deploy`)
   - all `nplus-father/<book>` repos with HugoBook (`hugobook-build-deploy`)

## Inputs

### `hugobook-build-deploy.yml` (Hugo books)

| Input | Default | When to override |
|---|---|---|
| `hugo-version` | `0.154.5` | Book needs a newer/older Hugo. |
| `java-version` | `25` | Book's Gradle needs a specific JDK. |
| `base-url-prefix` | `https://nplus.wiki` | Publishing to a different domain. |
| `run-spotless` | `true` | Disable while fixing formatting. |
| `deploy-mode` | `pages-artifact` | Set `gh-pages-branch` for legacy repos. |

### `astro-build-deploy.yml` (Astro sites)

| Input | Default | When to override |
|---|---|---|
| `node-version` | `22` | Newer Node release. |
| `run-lint` | `true` | Disable while fixing lint errors. |
| `run-format-check` | `true` | Disable while fixing format errors. |

### `astro-ci-check.yml` (Astro PR check)

| Input | Default | When to override |
|---|---|---|
| `node-version` | `22` | Newer Node release. |

## Deploy modes (HugoBook)

- **`pages-artifact`** (default, recommended): uses `actions/deploy-pages@v4`. Requires the repo's **Settings → Pages → Source = "GitHub Actions"**.
- **`gh-pages-branch`** (legacy): pushes built site to `gh-pages` branch via `peaceiris/actions-gh-pages`. Use during transition.

## Astro setup

Astro repos use Pages-artifact only. To onboard a new Astro repo:

1. Copy template files from `templates/astro/` into the repo:
   ```
   .github/workflows/deploy.yml      ← templates/astro/caller-deploy.yml
   .github/workflows/ci-check.yml    ← templates/astro/caller-ci-check.yml
   .prettierrc.json
   .prettierignore
   .gitignore                         (merge with existing if any)
   eslint.config.mjs
   tsconfig.json                      (merge or replace)
   .github/renovate.json              ← templates/astro/renovate.json
   ```
2. In repo Settings → Pages → Source: pick **"GitHub Actions"**.
3. In repo Settings → Actions → General → Access: set **"Accessible from repositories owned by the 'nplus-father' organization"** (so the reusable workflow can be invoked).
4. Add a `public/CNAME` if using a custom domain.

## Requirements on caller repos

- Must be under `nplus-father` or have the workflow access granted (Settings → Actions → General → Access).
- HugoBook structure: `site/` as Hugo root, `gradlew` wrapper at root, optional `site/go.sum`.
- Astro structure: `package.json` at root with `lint`, `format:check`, `build` scripts; output in `dist/`.

## Self-hosted runner

The HugoBook build job runs on runners labelled `self-hosted, linux, hugobook`.
The Astro build job runs on `ubuntu-latest` (GitHub-hosted; no runner needed).
See `docs/MIGRATION.md` for runner ops.
