import { z } from 'zod';

// Evidence schema - file location and line ranges
export const EvidenceSchema = z.object({
    filePath: z.string(),
    startLine: z.number().optional(),
    endLine: z.number().optional(),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

// Finding status
export const FindingStatus = z.enum(['PASS', 'FAIL', 'CLARIFY']);
export type FindingStatus = z.infer<typeof FindingStatus>;

// User decision status
export const UserDecision = z.enum(['APPROVED', 'DISMISSED', 'EDITED']);
export type UserDecision = z.infer<typeof UserDecision>;

// Finding schema - individual review finding
export const FindingSchema = z.object({
    id: z.string(),
    storyId: z.string().optional(),
    criteriaId: z.string().optional(),
    status: FindingStatus,
    summary: z.string(),
    reason: z.string().optional(),
    suggestion: z.string().optional(),
    evidence: z.array(EvidenceSchema),
    confidence: z.number().min(0).max(1),
    proposedComment: z.string(),
    userDecision: UserDecision.optional(),
    userNote: z.string().optional(),
});

export type Finding = z.infer<typeof FindingSchema>;

// Review result schema
export const ReviewResultSchema = z.object({
    prUrl: z.string(),
    findings: z.array(FindingSchema),
    talkScript: z.string().optional(),
    draftComment: z.string().optional(),
});

export type ReviewResult = z.infer<typeof ReviewResultSchema>;

// Submit PR request schema
export const SubmitPRRequestSchema = z.object({
    prUrl: z.string().url(),
});

export type SubmitPRRequest = z.infer<typeof SubmitPRRequestSchema>;
