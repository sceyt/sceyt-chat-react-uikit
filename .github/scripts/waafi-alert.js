#!/usr/bin/env node
/*
 * Posts a CI result to a Waafi channel (the same message format as the
 * Android SDK's channel-alerts.yml). Works on GitHub Actions and GitLab CI.
 * The same file is used in every repo: keep the copies identical.
 *
 * Required:
 *   WAAFI_PLATFORM_API_KEY  secret (GitHub org/repo secret, GitLab masked variable)
 *   WAAFI_CHANNEL_ID        numeric channel id
 *   WAAFI_PROJECT           name shown in the message, e.g. "Chat JS SDK"
 *   WAAFI_FAILED            "true" when a check failed
 * Optional:
 *   WAAFI_ALERT_SUCCESS     "always" (default): every run is posted, pass or fail.
 *                           "changes": passes are posted only on the default
 *                           branch, or when the previous run on the same branch
 *                           failed ("fixed"). Failures are always posted.
 *   WAAFI_SENDER_ID         sender user id (default 37494000000)
 *   WAAFI_GITLAB_API_TOKEN  GitLab only: read_api token. Adds the job lists, the
 *                           "fixed" check and the stale-MR skip.
 * GitHub also needs GITHUB_TOKEN (actions: read, pull-requests: read) and, from the
 * workflow, WAAFI_PR_NUMBER (github.event.pull_request.number, empty on push) and
 * WAAFI_DEFAULT_BRANCH (github.event.repository.default_branch).
 *
 * A missing key or channel id skips the alert with a warning, so CI does not
 * break before the settings exist. A failed delivery exits 1.
 */
'use strict'

const API_BASE = process.env.WAAFI_API_BASE || 'https://uk-london-south-api-v2.waafi.com/v1/dwpe7qzx1k'
const SENDER_ID = process.env.WAAFI_SENDER_ID || '37494000000'
const AGGREGATE_JOBS = ['All checks', 'All Tests']
const ALERT_JOB = /^(Waafi Alerts|waafi-alert)/

const env = (name) => (process.env[name] || '').trim()
const warn = (msg) => console.log(process.env.GITHUB_ACTIONS ? `::warning::${msg}` : `WARNING: ${msg}`)
const fail = (msg) => {
  console.log(process.env.GITHUB_ACTIONS ? `::error::${msg}` : `ERROR: ${msg}`)
  process.exitCode = 1
}

async function getJson(url, headers) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000), redirect: 'error' })
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url.split('?')[0]}`)
  return res.json()
}

// ---------------------------------------------------------------- GitHub
async function githubContext() {
  const api = env('GITHUB_API_URL') || 'https://api.github.com'
  const repo = env('GITHUB_REPOSITORY')
  const runId = env('GITHUB_RUN_ID')
  const headers = { Authorization: `Bearer ${env('GITHUB_TOKEN')}`, Accept: 'application/vnd.github+json' }
  const prNumber = env('WAAFI_PR_NUMBER')

  const run = await getJson(`${api}/repos/${repo}/actions/runs/${runId}`, headers)
  const ctx = {
    platform: 'GitHub',
    repo,
    branch: run.head_branch,
    defaultBranch: env('WAAFI_DEFAULT_BRANCH'),
    // For pull_request runs this is the PR head commit.
    sha: run.head_sha,
    runLabel: `Run #${run.run_number}`,
    runUrl: run.html_url,
    actor: run.triggering_actor?.login || run.actor?.login
  }

  if (/^\d+$/.test(prNumber)) {
    const pr = await getJson(`${api}/repos/${repo}/pulls/${prNumber}`, headers)
    if (pr.head.sha !== ctx.sha || pr.state !== 'open') return { skip: 'PR closed or newer commits exist.' }
    ctx.change = {
      label: `PR #${pr.number}`,
      title: pr.title,
      from: pr.head.ref,
      to: pr.base.ref,
      url: pr.html_url,
      linkText: 'Open pull request'
    }
  }

  ctx.loadJobs = async () => {
    const jobs = []
    for (let page = 1; page <= 5; page++) {
      const data = await getJson(
        `${api}/repos/${repo}/actions/runs/${runId}/jobs?filter=latest&per_page=100&page=${page}`,
        headers
      )
      jobs.push(...data.jobs)
      if (jobs.length >= data.total_count) break
    }
    return jobs.map((job) => ({
      name: job.name,
      passed: job.conclusion === 'success',
      failed: ['failure', 'timed_out', 'action_required'].includes(job.conclusion)
    }))
  }

  ctx.previousFailed = async () => {
    const data = await getJson(
      `${api}/repos/${repo}/actions/workflows/${run.workflow_id}/runs?branch=${encodeURIComponent(run.head_branch)}` +
        `&status=completed&per_page=10`,
      headers
    )
    const previous = data.workflow_runs.find((r) => r.id !== run.id && r.run_number < run.run_number)
    return !!previous && previous.conclusion === 'failure'
  }

  return ctx
}

// ---------------------------------------------------------------- GitLab
async function gitlabContext() {
  const api = env('CI_API_V4_URL')
  const project = env('CI_PROJECT_ID')
  const pipelineId = env('CI_PIPELINE_ID')
  const token = env('WAAFI_GITLAB_API_TOKEN')
  const headers = { 'PRIVATE-TOKEN': token }
  const mrIid = env('CI_MERGE_REQUEST_IID')

  const ctx = {
    platform: 'GitLab',
    repo: env('CI_PROJECT_PATH'),
    branch: mrIid ? env('CI_MERGE_REQUEST_SOURCE_BRANCH_NAME') : env('CI_COMMIT_REF_NAME'),
    defaultBranch: env('CI_DEFAULT_BRANCH'),
    sha: env('CI_COMMIT_SHA'),
    runLabel: `Pipeline #${env('CI_PIPELINE_IID')}`,
    runUrl: env('CI_PIPELINE_URL'),
    actor: env('GITLAB_USER_LOGIN')
  }

  if (mrIid) {
    if (token) {
      const mr = await getJson(`${api}/projects/${project}/merge_requests/${mrIid}`, headers)
      if (mr.sha !== ctx.sha || mr.state !== 'opened') return { skip: 'MR closed or newer commits exist.' }
    }
    ctx.change = {
      label: `MR !${mrIid}`,
      title: env('CI_MERGE_REQUEST_TITLE'),
      from: env('CI_MERGE_REQUEST_SOURCE_BRANCH_NAME'),
      to: env('CI_MERGE_REQUEST_TARGET_BRANCH_NAME'),
      url: `${env('CI_MERGE_REQUEST_PROJECT_URL') || env('CI_PROJECT_URL')}/-/merge_requests/${mrIid}`,
      linkText: 'Open merge request'
    }
  }

  if (token) {
    ctx.loadJobs = async () => {
      const jobs = await getJson(
        `${api}/projects/${project}/pipelines/${pipelineId}/jobs?per_page=100&include_retried=false`,
        headers
      )
      return jobs
        .filter((job) => job.status !== 'skipped' && job.status !== 'manual' && job.status !== 'created')
        .map((job) => ({
          name: job.name,
          passed: job.status === 'success',
          failed: job.status === 'failed' && !job.allow_failure,
          allowed: job.status === 'failed' && job.allow_failure
        }))
    }
    ctx.previousFailed = async () => {
      const ref = encodeURIComponent(env('CI_COMMIT_REF_NAME'))
      const pipelines = await getJson(
        `${api}/projects/${project}/pipelines?ref=${ref}&order_by=id&sort=desc&per_page=10`,
        headers
      )
      const previous = pipelines.find(
        (p) => p.id < Number(pipelineId) && ['success', 'failed'].includes(p.status)
      )
      return !!previous && previous.status === 'failed'
    }
  }

  return ctx
}

// ---------------------------------------------------------------- message
function buildBody(ctx, project, failed, fixed, checks) {
  const failedNames = checks ? checks.failed : []
  const title = failed
    ? `🔴 ${failedNames.length ? failedNames.join(' & ') : `${project} checks`} failed`
    : fixed
      ? `🟢 Fixed: all ${project} checks pass again`
      : `🟢 All ${project} checks passed`
  return [
    title,
    project,
    `${ctx.repo} (${ctx.platform})`,
    '',
    ...(ctx.change
      ? [`${ctx.change.label} · ${ctx.change.title.replace(/\s+/g, ' ').trim()}`, `${ctx.change.from} → ${ctx.change.to}`]
      : [`Branch · ${ctx.branch}`]),
    `Commit ${ctx.sha.slice(0, 7)} · ${ctx.runLabel}`,
    ...(ctx.actor ? [`Triggered by @${ctx.actor}`] : []),
    ...(checks
      ? [
          '',
          '✅ Passed checks',
          ...(checks.passed.length ? checks.passed.map((n) => `• ${n}`) : ['• None']),
          ...(checks.failed.length ? ['', '❌ Failed checks', ...checks.failed.map((n) => `• ${n}`)] : []),
          ...(checks.allowed.length ? ['', '⚠️ Failed but allowed to fail', ...checks.allowed.map((n) => `• ${n}`)] : [])
        ]
      : ['', 'Check results unavailable. Open the run below for details.']),
    ...(ctx.change ? ['', ctx.change.linkText, ctx.change.url] : []),
    '',
    'View logs & reports',
    ctx.runUrl
  ].join('\n')
}

async function send(channelId, apiKey, body) {
  const channelUrl = `${API_BASE}/channels/${channelId}`
  const headers = { 'Content-Type': 'application/json', 'Platform-Api-Key': apiKey }
  const post = (path, data) =>
    fetch(`${channelUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(15000),
      redirect: 'error'
    })
  const message = {
    user_id: SENDER_ID,
    body,
    type: 'text',
    metadata: '',
    transient: false,
    display_count: 1,
    silent: false,
    mentioned_users: [],
    attachments: []
  }

  let res = await post('/messages', message)
  if (res.status === 404) {
    console.log('Waafi returned HTTP 404; adding the sender to the channel.')
    const join = await post('/members', { access_prior_history: true, members: [{ id: SENDER_ID, role: 'participant' }] })
    if (!join.ok) return fail(`Waafi sender enrollment failed: HTTP ${join.status}`)
    console.log('Sender added; retrying once.')
    res = await post('/messages', message)
  }
  if (!res.ok) return fail(`Waafi delivery failed: HTTP ${res.status}`)
  console.log(`Waafi alert delivered: HTTP ${res.status}`)
}

async function main() {
  const apiKey = env('WAAFI_PLATFORM_API_KEY')
  const channelId = env('WAAFI_CHANNEL_ID')
  const project = env('WAAFI_PROJECT') || 'CI'
  const failed = env('WAAFI_FAILED') === 'true'
  const successMode = env('WAAFI_ALERT_SUCCESS') || 'always'

  if (!apiKey) return warn('WAAFI_PLATFORM_API_KEY is not set; skipping the Waafi alert.')
  if (!/^\d+$/.test(channelId)) return warn('WAAFI_CHANNEL_ID is not set or not numeric; skipping the Waafi alert.')

  let ctx
  if (env('GITHUB_ACTIONS') === 'true') ctx = await githubContext()
  else if (env('GITLAB_CI') === 'true') ctx = await gitlabContext()
  else return fail('Not running on GitHub Actions or GitLab CI.')
  if (ctx.skip) return console.log(`Skipping Waafi alert: ${ctx.skip}`)

  let fixed = false
  if (!failed) {
    if (ctx.previousFailed) {
      try {
        fixed = await ctx.previousFailed()
      } catch (e) {
        warn(`Could not read the previous run: ${e.message}`)
      }
    }
    const onDefaultBranch = !ctx.change && ctx.branch === ctx.defaultBranch
    if (successMode !== 'always' && !fixed && !onDefaultBranch) {
      return console.log('All checks passed; not posting (WAAFI_ALERT_SUCCESS=changes).')
    }
  }

  let checks = null
  if (ctx.loadJobs) {
    try {
      const jobs = (await ctx.loadJobs()).filter((job) => !ALERT_JOB.test(job.name))
      let passed = jobs.filter((j) => j.passed).map((j) => j.name)
      let failedJobs = jobs.filter((j) => j.failed).map((j) => j.name)
      const allowed = jobs.filter((j) => j.allowed).map((j) => j.name)
      // Hide the aggregate job when real jobs are listed.
      if (passed.some((n) => !AGGREGATE_JOBS.includes(n))) passed = passed.filter((n) => !AGGREGATE_JOBS.includes(n))
      if (failedJobs.some((n) => !AGGREGATE_JOBS.includes(n))) {
        failedJobs = failedJobs.filter((n) => !AGGREGATE_JOBS.includes(n))
      }
      checks = { passed, failed: failedJobs, allowed }
    } catch (e) {
      warn(`Could not list the jobs (${e.message}); sending the alert with the run link.`)
    }
  }

  await send(channelId, apiKey, buildBody(ctx, project, failed, fixed, checks))
}

main().catch((e) => fail(`Waafi alert error: ${e.message}`))
