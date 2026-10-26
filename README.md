# nplus-father/workflows

Centralised GitHub Actions reusable workflows for every site under the
`nplus-father` and `Andrewnplus` accounts. Changing a build step here propagates
to every consumer repo on its next run — no need to touch each repo.

## What's inside

| Workflow | Purpose | Callers (2026-10) |
|---|---|---|
| `hugobook-build-deploy.yml` | Hugo book build + GitHub Pages deploy. | ~1850 book and handbook repos |
| `ci-check.yml` | HugoBook PR gate: the same build with `deploy: false`. | ~1850 book and handbook repos |
| `astro-build-deploy.yml` | Astro site build + GitHub Pages deploy. | ~90 note stations and sites |
| `astro-ci-check.yml` | Astro PR gate: deps drift, lint, format, build. | ~90 note stations and sites |
| `astro-portal-build-deploy.yml` | The nplus.wiki portal: tests + GitHub metadata fetch before build. | `nplus-father/nplus-father.github.io` |

`renovate.json` is the shared Renovate preset that book repos and note stations extend
with `github>nplus-father/workflows//renovate`.

## Onboarding a new repo

Don't copy caller files by hand — create the repo from its template, which
already carries `deploy.yml` / `ci-check.yml` wired to `@v1`:

- Hugo book: `nplus-father/hugo-book-template`
- Astro note station: `nplus-father/note-template`

Then, in the new repo:

1. Settings → Pages → Source: **GitHub Actions**.
2. Add `public/CNAME` (Astro) if it serves a custom domain.

This repo's own Settings → Actions → General → Access must stay at
**"Accessible from repositories in the 'nplus-father' organization"**, otherwise
callers fail with *"called workflow is not accessible"*.

## Versioning

Callers pin the rolling major tag:

```yaml
uses: nplus-father/workflows/.github/workflows/hugobook-build-deploy.yml@v1
```

After a change lands on `main` and has run green on a real consumer:

```bash
git tag -fa v1 -m "v1 rolling tag"
git push -f origin v1
```

### Release discipline

Every caller pins `@v1`, so a bad commit on `v1` breaks ~1950 repos at once.

1. **Test on `main` before moving `v1`.** Point one low-stakes consumer's
   `uses:` at `@main` (or the commit sha), push, and watch the run with
   `gh run watch --repo nplus-father/<repo>`. Revert that caller afterwards.
   `ci-check.yml` calls `hugobook-build-deploy.yml@v1` internally, so a PR gate
   only sees a HugoBook change after `v1` moves.
2. **Move `v1` only to commits that have actually run green.**
3. **Rollback** if `v1` is broken in production:
   ```bash
   git log v1 --oneline -10
   git tag -fa v1 <good-sha> -m "rollback v1 to <good-sha>"
   git push -f origin v1
   ```
   Callers pick it up on their next run. A single repo can opt out by pinning
   `@<good-sha>` in its own caller.
4. **Breaking changes** (removing or renaming an input a caller still passes,
   changing required permissions) need a new major tag, never `v1`. Removing an
   input nobody passes is fine on `v1` — check with
   `gh search code '<input>:' --owner nplus-father` first.

## Inputs

### `hugobook-build-deploy.yml`

| Input | Default | When to override |
|---|---|---|
| `hugo-version` | `0.168.0` | Never in callers; Renovate bumps the default here. |
| `java-version` | `25` | Book's Gradle wrapper too old for Java 25 → `'21'`. |
| `base-url-prefix` | `https://nplus.wiki` | Publishing to a different domain. |
| `run-spotless` | `true` | Disable while fixing formatting. |
| `deploy` | `true` | `false` = build-only gate (what `ci-check.yml` does). |
| `runner-labels` | auto | JSON array to force a runner pool. |

> [!IMPORTANT]
>
> **`site/go.mod` 不可以 `require` `nplus-book-core`。** build 前有一道 `Guard against a
> pinned theme version` 會直接 fail。釘了版本的站再也拿不到主題更新——新 shortcode
> 用了會 build 失敗，新站台參數設了也沒人讀。留空即可，Hugo 會在 build 時抓最新 tag。

### `astro-build-deploy.yml` / `astro-ci-check.yml`

| Input | Default | When to override |
|---|---|---|
| `node-version` | `24` | Site pinned to another Node major. |
| `run-lint` | `true` | `false` when `package.json` has no `lint` script. |
| `run-format-check` | `true` | `false` when `package.json` has no `format:check` script. |
| `runner-labels` | auto | `'["ubuntu-latest"]'` for repos owned by `Andrewnplus` (org runners serve org repos only). |

`astro-portal-build-deploy.yml` takes `node-version`, `run-lint`, `run-test`,
`runner-labels`, and the optional secrets documented at the top of the file.

## Runners

`runner-labels` left empty means: **private caller → self-hosted pool**
(`self-hosted, linux, hugobook`), **public caller → `ubuntu-latest`**. This is a
security boundary — a fork PR against a public repo must never reach the
self-hosted host — so it is decided in the workflow, not by each caller.

Runner host setup, image upgrades and troubleshooting live in
`nplus-infra/runners/README.md`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| *"called workflow is not accessible"* | This repo's Actions access setting, see Onboarding. |
| `HTTP 403: Get Pages site failed` | Caller repo's Pages source is still "Deploy from a branch" → set it to GitHub Actions. |
| Spotless: *"Unsupported class file major version"* | Book's Gradle wrapper predates Java 25: bump it to 8.13+, or set `java-version: '21'`. |
| Build job stays *Queued* | Runner offline or its runner group excludes the repo — see `nplus-infra/runners/README.md`. |
