# HugoBook CI/CD migration guide

How to move an existing book repo off its per-repo `deploy.yml` onto the
centralised `nplus-father/workflows` pipeline.

- **Ops host**: `~/gh-runner/` on andrew-PC (4 self-hosted runners, Docker).
- **Shared workflow**: `nplus-father/workflows` (this repo).
- **Book repos**: currently under `Andrewnplus/*`; need to be transferred to `nplus-father/*`.

---

## One-time setup (do these once, then forget)

### 1. Runner host (already done)

```bash
# On andrew-PC:
cd ~/gh-runner
docker compose ps              # should show 4x hugobook-runner-N Up
./scripts/health-check.sh      # verifies and prints registration page URL
```

Registered runners visible at:
https://github.com/organizations/nplus-father/settings/actions/runners

All four should show **Idle** with labels `self-hosted, Linux, X64, hugobook`.

### 2. `nplus-father/workflows` Actions access (must be set)

Without this, caller repos get **"called workflow is not accessible"**.

https://github.com/nplus-father/workflows/settings/actions →
**Access** → select **"Accessible from repositories in the 'nplus-father' organization"** → Save.

### 3. First-time tag

After the initial commit lands:

```bash
cd ~/workspace/workflows
git tag -a v1 -m "v1 initial"
git push origin v1
```

All caller workflows reference `@v1`, so this tag must exist before any book repo is migrated.

### 4. (Recommended) Restrict runners to private repos only

https://github.com/organizations/nplus-father/settings/actions/runner-groups →
edit **Default** group → **Repository access**: "Selected repositories" or "Private repositories only".

This prevents a future public fork PR from running on our runner — the risk the prompt warned about.

---

## Migrating a single book repo

Using `100m-leads` as the pilot. Same sequence applies to every other book.

### Step A: Transfer the repo to `nplus-father`

```bash
gh repo transfer Andrewnplus/100m-leads nplus-father
```

GitHub 301-redirects the old URL, so external links keep working.

### Step B: Flip Pages source (only if using `deploy-mode: pages-artifact`)

https://github.com/nplus-father/100m-leads/settings/pages →
**Source: "GitHub Actions"** (was "Deploy from a branch").

**Skip this step if you pass `deploy-mode: gh-pages-branch`** in the caller —
that mode keeps the old `gh-pages` branch deploy.

### Step C: Replace workflow files

In a local clone of the transferred repo:

```bash
cd ~/workspace/100m-leads  # (re-clone from nplus-father after transfer)
cp ~/workspace/workflows/templates/caller-deploy.yml .github/workflows/deploy.yml
cp ~/workspace/workflows/templates/caller-ci-check.yml .github/workflows/ci-check.yml

# Verify nothing else in .github/workflows needs keeping.
ls .github/workflows/
```

If the book needs overrides (different Hugo version, legacy deploy mode), edit
the `with:` block in `deploy.yml`:

```yaml
jobs:
  deploy:
    uses: nplus-father/workflows/.github/workflows/hugobook-build-deploy.yml@v1
    permissions: { contents: read, pages: write, id-token: write }
    secrets: inherit
    with:
      deploy-mode: gh-pages-branch   # only if Pages is still branch-based
```

Commit + push:

```bash
git add .github/workflows/
git commit -m "ci: migrate to nplus-father/workflows reusable pipeline"
git push
```

### Step D: Watch the first run

https://github.com/nplus-father/100m-leads/actions → newest run → expand
`deploy` job → expand `build` job.

Checks:
- Build job's `Set up runner` / `Run actions/checkout` shows `Runner name: hugobook-runner-N`.
- `Spotless check` passes.
- `Build site` runs under 2 minutes (cache warm after second run).
- Deploy job on `ubuntu-latest` finishes with a Pages URL.

### Step E: (Optional) Update template so future books inherit this

Once the pilot is happy, repeat step C for `hugo-book-template`. Any new book
created via `gh repo create --template nplus-father/hugo-book-template` picks
up the caller workflows automatically.

---

## Bulk migration of remaining 799 repos

After the pilot is green, automate with `gh`:

```bash
# Transfer in batches of 50 with a pause (GitHub rate-limits)
for repo in $(gh repo list Andrewnplus --limit 1000 --json name -q '.[].name' | head -50); do
  gh repo transfer "Andrewnplus/$repo" nplus-father
  sleep 2
done

# Flip Pages source via API (needs admin on each repo)
for repo in $(gh repo list nplus-father --limit 1000 --json name -q '.[].name'); do
  gh api -X POST "repos/nplus-father/$repo/pages" \
    -f build_type='workflow' \
    -f source='{"branch":"main","path":"/"}'  # ignored when build_type=workflow
done

# Replace workflow files in every repo
for repo in $(gh repo list nplus-father --limit 1000 --json name -q '.[].name'); do
  tmp=$(mktemp -d)
  gh repo clone "nplus-father/$repo" "$tmp"
  cp ~/workspace/workflows/templates/caller-deploy.yml "$tmp/.github/workflows/deploy.yml"
  cp ~/workspace/workflows/templates/caller-ci-check.yml "$tmp/.github/workflows/ci-check.yml"
  (cd "$tmp" && git add .github/workflows/ && git commit -m "ci: migrate to shared workflow" && git push)
  rm -rf "$tmp"
done
```

**Don't run these blindly.** Do 3–5 repos manually first, confirm each works,
then scale up.

---

## Troubleshooting

### Runner shows `Offline` in the org page

```bash
cd ~/gh-runner
docker compose ps
docker compose logs runner-1 | tail -40
```

Most common causes:
- `ACCESS_TOKEN` expired → rotate PAT, update `.env`, `docker compose restart`.
- Host lost network → runners reconnect automatically once network returns.
- Container OOM killed → check `dmesg | grep -i oom`; raise `memory` limit in `docker-compose.yml`.

### Caller repo's workflow fails with "workflow_call from ... is not allowed"

Fix: https://github.com/nplus-father/workflows/settings/actions → Access →
"Accessible from repositories in the 'nplus-father' organization".

### Build job never gets picked up (stays "Queued" forever)

- Verify labels in caller resolve a runner: `runs-on: [self-hosted, linux, hugobook]`
  must all be set on the runner. Check the Runners page.
- Verify runner isn't restricted by runner group to a subset of repos.
- Runner offline — see above.

### Cache miss on every build

Normal on first run. If it persists:
- Check that `site/go.sum` and `gradle-wrapper.properties` exist (they're in the cache key).
- GitHub Actions cache has a 10 GB-per-repo limit; evictions happen by LRU. Nothing to fix — it'll cache what fits.

### Deploy job fails with `HTTP 403: Get Pages site failed`

The repo's Pages source is still set to "Deploy from a branch". Either:
- Flip it to "GitHub Actions" (step B above), or
- Override `deploy-mode: gh-pages-branch` in the caller and skip flipping.

### Spotless fails with "Unsupported class file major version"

The book's Gradle wrapper is too old for Java 25. Two fixes:
- Bump `gradle-wrapper.properties` in the book to Gradle 8.13+.
- Or set `java-version: '21'` in the caller's `with:` block until that book gets updated.

### `peaceiris/actions-hugo` downloads Hugo every build even though runner has it

You set `hugo-version` to something other than `0.154.5` in the caller.
Either remove the override (use default) or bump the runner image's
`HUGO_VERSION` ARG in `~/gh-runner/Dockerfile.runner` and rebuild.

---

## Upgrading the runner image

Any of: new Hugo, new JDK, new Go, new base image.

```bash
cd ~/gh-runner
# Edit Dockerfile.runner: change HUGO_VERSION / JAVA_VERSION / GO_VERSION / base FROM
docker compose build --no-cache
docker compose up -d  # rolling recreate; ephemeral runners pick up new image
```

Zero-downtime not guaranteed — in-flight jobs on old containers keep running
to completion; new jobs land on new containers. If you need strict
zero-downtime, scale out first (add `runner-5..8`), then recycle `runner-1..4`.

---

## Rollback (if the shared workflow breaks production)

Fastest:

```bash
cd ~/workspace/workflows
git revert HEAD
git push
git tag -fa v1 -m "v1 rollback" <good-commit-sha>
git push -f origin v1
```

Callers pinned `@v1` revert on next run.

For a single book to opt out temporarily: pin to a known-good sha in that
book's `deploy.yml`:

```yaml
uses: nplus-father/workflows/.github/workflows/hugobook-build-deploy.yml@<sha>
```
