"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { admissionsApi } from "@/lib/api";
import type { PipelineStage, DecisionStatus } from "@/types/api";

interface CandidateDecisionPanelProps {
  id: number;
  pipelineStage: PipelineStage;
  decisionStatus: DecisionStatus;
}

export function CandidateDecisionPanel({ id, pipelineStage, decisionStatus }: CandidateDecisionPanelProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDecision = async (decision: 'shortlisted' | 'discussion' | 'rejected') => {
    try {
      setIsLoading(true);
      setError(null);
      const token = localStorage.getItem("access_token") || undefined;
      await admissionsApi.setDecision(id, decision, token);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendDecision = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = localStorage.getItem("access_token") || undefined;
      await admissionsApi.sendDecision(id, token);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="text-red-500 text-sm font-medium">{error}</div>
      )}
      
      {pipelineStage === "committee_review" && (
        <div className="flex gap-3 mt-4 flex-wrap">
          <button
            onClick={() => handleDecision("shortlisted")}
            disabled={isLoading}
            className="px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? "Обработка..." : "Шортлист"}
          </button>
          <button
            onClick={() => handleDecision("discussion")}
            disabled={isLoading}
            className="px-4 py-2 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? "Обработка..." : "Обсуждение"}
          </button>
          <button
            onClick={() => handleDecision("rejected")}
            disabled={isLoading}
            className="px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? "Обработка..." : "Отклонить"}
          </button>
        </div>
      )}

      {decisionStatus !== "pending" && pipelineStage !== "decision_sent" && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <button
            onClick={handleSendDecision}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? "Отправка..." : "Отправить решение"}
          </button>
        </div>
      )}
    </div>
  );
}
