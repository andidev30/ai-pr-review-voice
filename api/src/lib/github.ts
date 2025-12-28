/**
 * GitHub PR Utilities
 * Fetch PR diff from GitHub API
 */

export interface PRInfo {
    owner: string;
    repo: string;
    pullNumber: number;
}

/**
 * Parse GitHub PR URL to extract owner, repo, and PR number
 * Supports formats:
 * - https://github.com/owner/repo/pull/123
 * - https://github.com/owner/repo/pull/123/files
 */
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
    };
}

/**
 * Fetch PR diff from GitHub API
 * Returns the unified diff text
 */
export async function fetchPRDiff(prUrl: string, githubToken?: string): Promise<string> {
    const prInfo = parsePRUrl(prUrl);

    const apiUrl = `https://api.github.com/repos/${prInfo.owner}/${prInfo.repo}/pulls/${prInfo.pullNumber}`;

    const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3.diff',
        'User-Agent': 'AI-PR-Review-App',
    };

    if (githubToken) {
        headers['Authorization'] = `Bearer ${githubToken}`;
    }

    const response = await fetch(apiUrl, { headers });

    if (!response.ok) {
        throw new Error(`Failed to fetch PR diff: ${response.status} ${response.statusText}`);
    }

    const diff = await response.text();
    return diff;
}

/**
 * Fetch PR details (title, description) from GitHub API
 */
export async function fetchPRDetails(prUrl: string, githubToken?: string): Promise<{
    title: string;
    body: string;
    additions: number;
    deletions: number;
    changedFiles: number;
}> {
    const prInfo = parsePRUrl(prUrl);

    const apiUrl = `https://api.github.com/repos/${prInfo.owner}/${prInfo.repo}/pulls/${prInfo.pullNumber}`;

    const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AI-PR-Review-App',
    };

    if (githubToken) {
        headers['Authorization'] = `Bearer ${githubToken}`;
    }

    const response = await fetch(apiUrl, { headers });

    if (!response.ok) {
        throw new Error(`Failed to fetch PR details: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
        title: data.title,
        body: data.body || '',
        additions: data.additions,
        deletions: data.deletions,
        changedFiles: data.changed_files,
    };
}
