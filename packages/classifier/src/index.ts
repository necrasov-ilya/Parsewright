import type { RankedCandidate } from "@parsewright/ranker";

export interface ClassifiedCandidate extends RankedCandidate {
  semanticMatch: boolean;
  confidence: number;
  classificationReason: string;
  extractedFacts: Record<string, unknown>;
}

export interface CandidateClassificationPatch {
  id: string;
  match: boolean;
  confidence: number;
  reason: string;
  extractedFacts: Record<string, unknown>;
}

export function classifyCandidates(candidates: RankedCandidate[]): ClassifiedCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    semanticMatch: candidate.relevanceScore > 0,
    confidence: Math.max(0.2, Math.min(0.95, candidate.relevanceScore)),
    classificationReason: candidate.matchedTerms.length > 0 ? `Matched ${candidate.matchedTerms.join(", ")}` : "Kept by deterministic ranking.",
    extractedFacts: {
      price: candidate.price,
      currency: candidate.currency,
      seller: candidate.seller,
      durationDays: candidate.durationDays
    }
  }));
}

export function applyClassificationPatches(candidates: ClassifiedCandidate[], patches: CandidateClassificationPatch[]): ClassifiedCandidate[] {
  const byId = new Map(patches.map((patch) => [patch.id, patch]));
  return candidates
    .map((candidate) => {
      const patch = byId.get(candidate.id);
      if (!patch) return candidate;
      return {
        ...candidate,
        semanticMatch: patch.match,
        confidence: Math.max(0, Math.min(1, patch.confidence)),
        classificationReason: patch.reason || candidate.classificationReason,
        extractedFacts: { ...candidate.extractedFacts, ...patch.extractedFacts }
      };
    })
    .filter((candidate) => candidate.semanticMatch);
}
