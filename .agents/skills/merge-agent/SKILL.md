---
name: merge-agent
description: Integrate incoming Brainrot Games worktrees into local main, check its sync status, or publish tested commits to GitHub main.
---

# Brainrot Games merge agent

Use `git worktree list --porcelain` to find the checkout holding local `main`. The chat’s current checkout can be detached or belong to an incoming change. Confirm the intended source and target before changing either. For a sync-status request, compare local `main` with the live remote tip from `git ls-remote --exit-code origin refs/heads/main`. Fetch the remote ref when needed to calculate ahead and behind counts. Treat the status request as read-only with respect to local branches and files.

## Coordinate work on main

Before changing local or remote `main`, check whether another Codex chat is already handling integration for this repository. Use `list_threads` to find the **Merge Agent** chat or another relevant chat, match it to this repository and its main checkout, and inspect its recent activity with `read_thread` when ownership is unclear. If another agent is actively integrating or publishing changes, leave shared `main` to that agent. Keep the incoming work in its source checkout and provide the source branch or SHA for handoff. If the existing chat is idle and the user asked this chat to perform the integration, proceed after checking Git state. Read-only status checks can run in parallel.

## Integrate incoming work

Inspect the source’s committed diff and its staged, unstaged, and untracked files. Resolve a committed handoff to a full SHA and review what it adds relative to `main`. On a clean target checkout, squash the reviewed source commit into local `main` unless the handoff calls for another history shape. For a handoff containing uncommitted work, capture the agreed paths with a checked binary-capable patch or equivalent, including intended new files. Preserve unrelated changes in both checkouts.

Resolve conflicts against the combined behavior of both changes. Review the staged diff and run `git diff --cached --check`. Run the production build, the full game suite, and any focused checks relevant to the handoff on the combined tree before committing. Use the Node version and commands in [CI](../../../.github/workflows/ci.yml). Recheck the base commit and staged tree before committing if either checkout may have changed while tests ran. Verify the resulting commit captures the agreed scope. Before any requested worktree cleanup, verify that the integrated commit contains the source work and that the worktree contains no unique changes that would be lost.

## Publish to GitHub

A handoff to local `main` ends with a local commit and a report. When publication is authorized, inspect the outgoing commits against the live remote and make sure the push covers the intended scope. The Merge Agent workflow uses a direct, non-force push to `origin/main`.

Run the full game suite on the exact outgoing commit in a clean checkout, using the Node version from CI.

```sh
node --import tsx --test 'src/games/**/*.test.ts'
```

If a check fails, diagnose the cause and attempt a durable fix that preserves the test’s coverage. Rerun the suite on the corrected outgoing revision. Hold publication and report the failure and attempted fixes if it remains unresolved.

Before pushing, verify local `main` still points to the tested SHA and that the remote can fast-forward. Push that specific commit with `git push origin "${tested_sha}:refs/heads/main"`, where `tested_sha` is the verified full SHA. If the remote moved or rejected the push, inspect the current state and resolve the blocker within the requested scope. Test any changed candidate before retrying. Verify the live remote tip after the push and report the commit, check results, and local and remote status.
