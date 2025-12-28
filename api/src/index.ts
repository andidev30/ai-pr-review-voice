import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { fetchPRDetails } from './lib/github'
import { reviewWithGeminiCLI } from './lib/gemini-cli'
import { generateTalkScript, generateDraftComment } from './lib/gemini'
import type { ReviewResult } from './types'

const app = new Hono()

// Enable CORS for frontend
app.use('/*', cors())

// Health check
app.get('/', (c) => {
  return c.json({ status: 'ok', message: 'AI PR Review API (Gemini CLI)' })
})

// Submit PR for review using Gemini CLI
app.post('/api/submit-pr', async (c) => {
  try {
    const formData = await c.req.formData()

    const prUrl = formData.get('prUrl') as string
    const requirementFile = formData.get('requirementFile') as File | null

    if (!prUrl) {
      return c.json({ error: 'prUrl is required' }, 400)
    }

    // Validate PR URL format
    if (!prUrl.includes('github.com') || !prUrl.includes('/pull/')) {
      return c.json({ error: 'Invalid GitHub PR URL format' }, 400)
    }

    console.log(`[submit-pr] Processing PR: ${prUrl}`)

    // Get GitHub token
    const githubToken = process.env.GITHUB_TOKEN

    // Fetch PR details from GitHub API
    console.log('[submit-pr] Fetching PR details...')
    const prDetails = await fetchPRDetails(prUrl, githubToken)
    console.log(`[submit-pr] PR: ${prDetails.title}`)
    console.log(`[submit-pr] Changes: +${prDetails.additions} -${prDetails.deletions} in ${prDetails.changedFiles} files`)

    // Prepare requirement file if provided
    let requirementFileData: { buffer: Buffer; name: string } | undefined
    if (requirementFile && requirementFile.size > 0) {
      console.log(`[submit-pr] Requirement file: ${requirementFile.name}`)
      requirementFileData = {
        buffer: Buffer.from(await requirementFile.arrayBuffer()),
        name: requirementFile.name
      }
    }

    // Review PR using Gemini CLI (clones repo, runs gemini CLI)
    console.log('[submit-pr] Reviewing with Gemini CLI...')
    const findings = await reviewWithGeminiCLI(
      prUrl,
      prDetails.title,
      prDetails.body,
      requirementFileData,
      githubToken
    )

    console.log(`[submit-pr] Found ${findings.length} findings`)

    // Generate talk script
    const talkScript = findings.length > 0
      ? await generateTalkScript(findings)
      : 'No issues found in this pull request. Everything looks good!'

    // Generate draft comment
    const draftComment = await generateDraftComment(findings)

    const result: ReviewResult = {
      prUrl,
      findings,
      talkScript,
      draftComment
    }

    console.log('[submit-pr] Review complete!')
    return c.json(result)

  } catch (error) {
    console.error('[submit-pr] Error:', error)
    return c.json({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, 500)
  }
})

export default app
