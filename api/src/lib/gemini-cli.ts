/**
 * Gemini CLI Integration
 * Clone repo, copy requirement file, and run Gemini CLI for review
 */
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import type { Finding } from '../types';

const execAsync = promisify(exec);

// Temp directory for cloned repos
const TEMP_DIR = join(process.cwd(), 'temp');

/**
 * Parse GitHub PR URL to extract repo info
 */
interface PRInfo {
    owner: string;
    repo: string;
    pullNumber: number;
    cloneUrl: string;
}

export function parsePRUrl(url: string): PRInfo {
    const regex = /github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/;
    const match = url.match(regex);

    if (!match) {
        throw new Error(`Invalid GitHub PR URL: ${url}`);
    }

    return {
        owner: match[1],
        repo: match[2],
        pullNumber: parseInt(match[3], 10),
        cloneUrl: `https://github.com/${match[1]}/${match[2]}.git`
    };
}

/**
 * Setup temp directory for review
 */
export function setupTempDir(prInfo: PRInfo): string {
    const repoDir = join(TEMP_DIR, `${prInfo.owner}-${prInfo.repo}-pr${prInfo.pullNumber}`);

    // Clean up if exists
    if (existsSync(repoDir)) {
        rmSync(repoDir, { recursive: true, force: true });
    }

    // Create temp directory
    if (!existsSync(TEMP_DIR)) {
        mkdirSync(TEMP_DIR, { recursive: true });
    }

    return repoDir;
}

/**
 * Clone repository and checkout PR branch
 */
export async function cloneAndCheckoutPR(
    prInfo: PRInfo,
    repoDir: string,
    githubToken?: string
): Promise<void> {
    console.log(`[gemini-cli] Cloning ${prInfo.cloneUrl}...`);

    // Clone with token if provided (for private repos)
    let cloneUrl = prInfo.cloneUrl;
    if (githubToken) {
        cloneUrl = cloneUrl.replace('https://', `https://${githubToken}@`);
    }

    await execAsync(`git clone --depth 50 ${cloneUrl} ${repoDir}`);

    // Fetch the PR
    console.log(`[gemini-cli] Fetching PR #${prInfo.pullNumber}...`);
    await execAsync(`git fetch origin pull/${prInfo.pullNumber}/head:pr-${prInfo.pullNumber}`, { cwd: repoDir });

    // Checkout the PR branch
    await execAsync(`git checkout pr-${prInfo.pullNumber}`, { cwd: repoDir });

    console.log(`[gemini-cli] Repository ready at ${repoDir}`);
}

/**
 * Get diff between PR branch and base
 */
export async function getDiffFromRepo(repoDir: string): Promise<string> {
    // Get diff between current branch and main/master
    try {
        const { stdout } = await execAsync(`git diff origin/main...HEAD`, { cwd: repoDir, maxBuffer: 10 * 1024 * 1024 });
        return stdout;
    } catch {
        try {
            const { stdout } = await execAsync(`git diff origin/master...HEAD`, { cwd: repoDir, maxBuffer: 10 * 1024 * 1024 });
            return stdout;
        } catch {
            // Fallback: diff last commit
            const { stdout } = await execAsync(`git diff HEAD~1`, { cwd: repoDir, maxBuffer: 10 * 1024 * 1024 });
            return stdout;
        }
    }
}

/**
 * Copy requirement file to repo directory
 */
export function copyRequirementFile(
    repoDir: string,
    fileBuffer: Buffer,
    fileName: string
): string {
    const destPath = join(repoDir, `REQUIREMENTS-${fileName}`);
    writeFileSync(destPath, fileBuffer);
    console.log(`[gemini-cli] Requirement file copied to ${destPath}`);
    return `REQUIREMENTS-${fileName}`;
}

/**
 * Create GEMINI.md context file for the review
 */
export function createGeminiContext(
    repoDir: string,
    prTitle: string,
    prDescription: string,
    diff: string,
    requirementFileName?: string
): void {
    // Truncate diff if too large (keep first 30k chars)
    const truncatedDiff = diff.length > 30000
        ? diff.substring(0, 30000) + '\n... [diff truncated due to size]'
        : diff;

    const contextContent = `# PR Review Context

## PR Title
${prTitle}

## PR Description
${prDescription}

## Your Task
You are reviewing this Pull Request. Analyze the code changes and provide findings.

${requirementFileName ? `
## Requirements Document
Read the file "${requirementFileName}" in this directory and verify the code changes comply with those requirements.
` : ''}

## Changes (Diff)
\`\`\`diff
${truncatedDiff}
\`\`\`

## Output Format
Return a JSON array of findings. Each finding must have:
- id: "F1", "F2", etc.
- status: "PASS", "FAIL", or "CLARIFY"  
- summary: brief description
- reason: explanation for FAIL/CLARIFY
- suggestion: fix suggestion
- evidence: array of { filePath, startLine, endLine }
- confidence: 0 to 1
- proposedComment: GitHub comment text

Focus on:
1. Code correctness and logic errors
2. Security vulnerabilities
3. Performance issues
4. Best practices violations
5. Missing error handling
${requirementFileName ? '6. Requirements compliance' : ''}

Return ONLY the JSON array, no other text.
`;

    writeFileSync(join(repoDir, 'GEMINI.md'), contextContent);
    console.log(`[gemini-cli] Created GEMINI.md context file`);
}

/**
 * Run Gemini CLI for PR review using execAsync with timeout
 */
export async function runGeminiCLI(repoDir: string): Promise<Finding[]> {
    console.log('[gemini-cli] Running Gemini CLI for review...');

    const prompt = `Read the GEMINI.md file and perform the PR review. Return ONLY a valid JSON array of findings with id, status, summary, reason, suggestion, evidence, confidence, proposedComment fields.`;

    try {
        console.log('[gemini-cli] Executing gemini command...');

        const { stdout, stderr } = await execAsync(
            `gemini -p "${prompt}" --output-format json`,
            {
                cwd: repoDir,
                timeout: 120000, // 2 minute timeout
                maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            }
        );

        console.log('[gemini-cli] Command completed');

        if (stderr) {
            console.log('[gemini-cli] stderr:', stderr.substring(0, 300));
        }

        console.log('[gemini-cli] stdout length:', stdout.length);
        console.log('[gemini-cli] stdout preview:', stdout.substring(0, 500));

        // Try to parse JSON response
        try {
            const response = JSON.parse(stdout);

            // Extract findings from response object
            if (response.response) {
                const text = response.response;
                const jsonMatch = text.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    const findings = JSON.parse(jsonMatch[0]) as Finding[];
                    console.log(`[gemini-cli] Parsed ${findings.length} findings`);
                    return findings;
                }
            }

            // Check if it's directly an array
            if (Array.isArray(response)) {
                console.log(`[gemini-cli] Direct array: ${response.length} findings`);
                return response as Finding[];
            }

            console.log('[gemini-cli] Could not extract findings from parsed response');
            return [];
        } catch {
            // Try to extract JSON array from raw output
            const jsonMatch = stdout.match(/\[[\s\S]*?\]/);
            if (jsonMatch) {
                try {
                    const findings = JSON.parse(jsonMatch[0]) as Finding[];
                    console.log(`[gemini-cli] Extracted ${findings.length} findings from raw output`);
                    return findings;
                } catch (e) {
                    console.error('[gemini-cli] Failed to parse extracted JSON:', e);
                }
            }

            console.log('[gemini-cli] No valid JSON found in output');
            return [];
        }
    } catch (error: any) {
        if (error.killed) {
            console.error('[gemini-cli] Process was killed (timeout)');
        } else if (error.code === 'ETIMEDOUT') {
            console.error('[gemini-cli] Command timed out');
        } else {
            console.error('[gemini-cli] Command error:', error.message);
        }

        // Try to parse any partial output
        if (error.stdout) {
            const jsonMatch = error.stdout.match(/\[[\s\S]*?\]/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]) as Finding[];
                } catch {
                    // ignore
                }
            }
        }

        return [];
    }
}

/**
 * Cleanup temp directory
 */
export function cleanup(repoDir: string): void {
    if (existsSync(repoDir)) {
        rmSync(repoDir, { recursive: true, force: true });
        console.log(`[gemini-cli] Cleaned up ${repoDir}`);
    }
}

/**
 * Full review flow using Gemini CLI
 */
export async function reviewWithGeminiCLI(
    prUrl: string,
    prTitle: string,
    prDescription: string,
    requirementFile?: { buffer: Buffer; name: string },
    githubToken?: string
): Promise<Finding[]> {
    const prInfo = parsePRUrl(prUrl);
    const repoDir = setupTempDir(prInfo);

    try {
        // Clone repo
        await cloneAndCheckoutPR(prInfo, repoDir, githubToken);

        // Copy requirement file if provided
        let requirementFileName: string | undefined;
        if (requirementFile) {
            requirementFileName = copyRequirementFile(repoDir, requirementFile.buffer, requirementFile.name);
        }

        // Get diff
        const diff = await getDiffFromRepo(repoDir);
        console.log(`[gemini-cli] Diff size: ${diff.length} characters`);

        // Create GEMINI.md context file
        createGeminiContext(repoDir, prTitle, prDescription, diff, requirementFileName);

        // Run Gemini CLI review
        const findings = await runGeminiCLI(repoDir);

        return findings;

    } finally {
        // Always cleanup
        cleanup(repoDir);
    }
}
