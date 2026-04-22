# nplus-father/workflows

Centralised GitHub Actions reusable workflows for all HugoBook repos under the
`nplus-father` org. Changing a build step here propagates to every book repo
on their next push — no need to touch 800 repos.

## What's inside

| Path | Purpose |
|---|---|
| `.github/workflows/hugobook-build-deploy.yml` | Build (self-hosted) + Deploy (GitHub-hosted Pages). The main pipeline. |
| `.github/workflows/ci-check.yml` | Dummy CI for branch protection. |
| `templates/caller-deploy.yml` | Drop-in `deploy.yml` for each book repo (~15 lines). |
| `templates/caller-ci-check.yml` | Drop-in `ci-check.yml` for each book repo. |
| `docs/MIGRATION.md` | How to migrate existing book repos + troubleshooting. |

## Versioning

Callers pin with a git tag:

```yaml
uses: nplus-father/workflows/.github/workflows/hugobook-build-deploy.yml@v1
```

- `v1` = stable major version. Bug fixes and backward-compatible changes roll out here.
- `v2`, `v3` = breaking changes. Existing callers keep working until they opt in.
- `@main` = bleeding edge. Only use in the pilot repo while iterating.

After merging any PR here:
```bash
git tag -fa v1 -m "v1 rolling tag"
git push -f origin v1
```
(Force-push the rolling major tag. Callers pinned to `@v1` pick up on next run.)

## Inputs (hugobook-build-deploy.yml)

| Input | Default | When to override |
|---|---|---|
| `hugo-version` | `0.154.5` | Book needs a newer/older Hugo (will download at build time). |
| `java-version` | `25` | Book's Gradle needs a specific JDK. |
| `base-url-prefix` | `https://nplus.wiki` | Publishing to a different domain. |
| `run-spotless` | `true` | Disable while fixing formatting. |
| `deploy-mode` | `pages-artifact` | Set `gh-pages-branch` if the repo's Pages source is still the `gh-pages` branch. |

## Deploy modes

- **`pages-artifact`** (default, recommended): uses `actions/deploy-pages@v4`. Requires the book repo's **Settings → Pages → Source = "GitHub Actions"**. Upgraded path for every book repo.
- **`gh-pages-branch`** (legacy): pushes built site to `gh-pages` branch via `peaceiris/actions-gh-pages`. Matches the pre-migration behaviour. Use during transition if Pages source hasn't been flipped yet.

## Requirements on caller repos

- Must be under `nplus-father` org (reusable workflow access is scoped there).
- Must have structure: `site/` as Hugo root, `gradlew` wrapper at root, `site/go.sum` for Hugo modules (optional).
- Must grant the reusable workflow access: Repo Settings → Actions → General → Access → **Accessible from repositories owned by the 'nplus-father' organization**.

## Self-hosted runner

The build job runs on runners labelled `self-hosted, linux, hugobook`. Runners
are in `~/gh-runner/` on the ops host. See `docs/MIGRATION.md` for day-to-day
operations.
