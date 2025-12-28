/**
 * Gemini AI Integration
 * File Search (RAG) and PR Review
 */
import { GoogleGenAI } from '@google/genai';
import type { Finding } from '../types';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Initialize Gemini client
const getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is required');
    }
    return new GoogleGenAI({ apiKey });
};

// Ensure temp directory exists
const TEMP_DIR = '/tmp/ai-pr-review';
if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Get MIME type from file name
 */
function getMimeType(fileName: string): string {
    const ext = fileName.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
        'pdf': 'application/pdf',
        'txt': 'text/plain',
        'md': 'text/markdown',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    return mimeTypes[ext || ''] || 'text/plain';
}

/**
 * Upload requirement document to File Search store
 * Returns the file search store name for use in queries
 */
export async function uploadToFileSearch(
    fileBuffer: Buffer,
    fileName: string
): Promise<string> {
    const ai = getAI();

    console.log('[FileSearch] Creating file search store...');

    // Create a file search store
    const fileSearchStore = await ai.fileSearchStores.create({
        config: { displayName: `pr-review-${Date.now()}` }
    });

    console.log(`[FileSearch] Store created: ${fileSearchStore.name}`);

    // Save buffer to temp file
    const tempFilePath = join(TEMP_DIR, `${Date.now()}-${fileName}`);
    writeFileSync(tempFilePath, fileBuffer);
    console.log(`[FileSearch] Temp file saved: ${tempFilePath}`);

    try {
        // Upload file to file search store using file path
        console.log('[FileSearch] Uploading file to store...');
        let operation = await ai.fileSearchStores.uploadToFileSearchStore({
            file: tempFilePath,
            fileSearchStoreName: fileSearchStore.name!,
            config: {
                displayName: fileName,
            }
        });

        // Wait for upload to complete
        console.log('[FileSearch] Waiting for processing...');
        let attempts = 0;
        const maxAttempts = 30; // Max 60 seconds

        while (!operation.done && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            operation = await ai.operations.get({ operation });
            attempts++;
            console.log(`[FileSearch] Processing... (attempt ${attempts})`);
        }

        if (!operation.done) {
            throw new Error('File processing timeout');
        }

        console.log('[FileSearch] File upload completed!');
        return fileSearchStore.name!;

    } finally {
        // Clean up temp file
        if (existsSync(tempFilePath)) {
            unlinkSync(tempFilePath);
            console.log('[FileSearch] Temp file cleaned up');
        }
    }
}

/**
 * Review PR diff against requirements using Gemini with File Search (RAG)
 */
export async function reviewPR(
    diff: string,
    prTitle: string,
    prDescription: string,
    fileSearchStoreName?: string
): Promise<Finding[]> {
    const ai = getAI();

    const prompt = `You are a senior code reviewer. Review the following Pull Request diff.

## PR Title
${prTitle}

## PR Description
${prDescription}

## Diff
\`\`\`diff
${diff}
\`\`\`

${fileSearchStoreName ? `
## IMPORTANT - Requirements Compliance Check
Use the File Search tool to find relevant requirements from the uploaded requirement document.
Compare the code changes against those requirements and verify compliance.
Each finding should reference specific requirements from the document when applicable.
` : ''}

## Instructions
Analyze the code changes and produce a JSON array of findings. Each finding should have:
- id: unique identifier like "F1", "F2", etc.
- status: "PASS" if the change is correct, "FAIL" if there's an issue, "CLARIFY" if more info needed
- summary: brief 1-sentence description
- reason: explanation for FAIL/CLARIFY status
- suggestion: suggested fix for FAIL status
- evidence: array of { filePath, startLine, endLine } showing where the issue is
- confidence: number between 0 and 1
- proposedComment: GitHub-friendly comment text

Focus on:
1. Code correctness and logic errors
2. Security vulnerabilities  
3. Performance issues
4. Best practices violations
5. Missing error handling
${fileSearchStoreName ? '6. Requirements compliance - verify code meets the requirements from the document' : ''}

Return ONLY a valid JSON array of findings.`;

    // Configure tools - include File Search if store name provided
    const config: any = {};

    if (fileSearchStoreName) {
        console.log(`[ReviewPR] Using File Search store: ${fileSearchStoreName}`);
        config.tools = [
            {
                fileSearch: {
                    fileSearchStoreNames: [fileSearchStoreName]
                }
            }
        ];
    }

    console.log('[ReviewPR] Calling Gemini...');
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config
    });

    // Parse the response
    const text = response.text || '';
    console.log('[ReviewPR] Response received, parsing findings...');

    // Extract JSON from the response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
        console.error('Failed to parse findings from response:', text);
        return [];
    }

    try {
        const findings = JSON.parse(jsonMatch[0]) as Finding[];
        return findings;
    } catch (error) {
        console.error('Failed to parse findings JSON:', error);
        return [];
    }
}

/**
 * Generate talk script for findings
 */
export async function generateTalkScript(findings: Finding[]): Promise<string> {
    const ai = getAI();

    const prompt = `Generate a spoken script (max 30 seconds when read aloud) summarizing these PR review findings. 
Use short, clear sentences. Mention file names and line numbers briefly. Ask the user to approve or dismiss each finding.

Findings:
${JSON.stringify(findings, null, 2)}

Return only the spoken script text, no JSON.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });

    return response.text || '';
}

/**
 * Generate draft GitHub comment from approved findings
 */
export async function generateDraftComment(findings: Finding[]): Promise<string> {
    const approvedFindings = findings.filter(f => f.userDecision === 'APPROVED' || !f.userDecision);

    if (approvedFindings.length === 0) {
        return '## PR Review\n\n✅ No issues found.';
    }

    let comment = '## PR Review Summary\n\n';

    for (const finding of approvedFindings) {
        const icon = finding.status === 'PASS' ? '✅' : finding.status === 'FAIL' ? '❌' : '❓';
        comment += `### ${icon} ${finding.status}: ${finding.summary}\n`;

        if (finding.evidence.length > 0) {
            const ev = finding.evidence[0];
            comment += `- File: \`${ev.filePath}\``;
            if (ev.startLine) {
                comment += ` (line ${ev.startLine}${ev.endLine ? `-${ev.endLine}` : ''})`;
            }
            comment += '\n';
        }

        if (finding.reason) {
            comment += `- Reason: ${finding.reason}\n`;
        }

        if (finding.suggestion) {
            comment += `- Suggestion: ${finding.suggestion}\n`;
        }

        comment += '\n';
    }

    return comment;
}
