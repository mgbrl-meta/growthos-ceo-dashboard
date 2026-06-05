import { calculatePriorityScore } from './scoring';
import { getRecommendedAction } from './recommendations';
import { getActionType } from './actionType';

type Difficulty = 'Low' | 'Medium' | 'High';

type BaseOpportunity = {
  id: string;
  type: string;
  title: string;
  reason: string;
  segment: string;
  customers: number;
  potentialRevenue: number;
  potentialProfit: number;
  confidence: number;
  difficulty: Difficulty;
  source: string;
  detectedAt: string;
  status: string;
};

function withCalculatedScore(opportunity: BaseOpportunity) {
  const profitScore = Math.min(100, Math.round(opportunity.potentialProfit / 10000));
  const ltvScore = profitScore;

  const easeScore =
    opportunity.difficulty === 'Low'
      ? 90
      : opportunity.difficulty === 'Medium'
        ? 70
        : 45;

  const score = calculatePriorityScore({
    profitScore,
    ltvScore,
    confidenceScore: opportunity.confidence,
    easeScore,
  });

  return {
    ...opportunity,
    score,
    recommendedAction: getRecommendedAction(opportunity.type),
    actionType: getActionType(opportunity.type),
    expectedImpact: `INR ${Math.round(opportunity.potentialProfit).toLocaleString(
      'en-IN'
    )} profit potential`,
    executionEffort: opportunity.difficulty,
  };
}

export function getDetectedOpportunities() {
  return [
    withCalculatedScore({
      id: 'opp_001',
      type: 'FIRST_ORDER_NO_REPEAT',
      title: 'Rosemary buyers not repeating after 45 days',
      reason: '4812 first-time Rosemary buyers have crossed the expected repeat window without a second order.',
      segment: 'Rosemary first-time buyers',
      customers: 4812,
      potentialRevenue: 2840000,
      potentialProfit: 1280000,
      confidence: 86,
      difficulty: 'Low',
      source: 'First Order Repeat Engine',
      detectedAt: 'Today',
      status: 'New',
    }),
    withCalculatedScore({
      id: 'opp_002',
      type: 'REPLENISHMENT_DUE',
      title: 'Rosemary Oil Shot replenishment window reached',
      reason: '3260 Rosemary buyers are due for replenishment based on expected consumption cycle.',
      segment: 'Rosemary buyers due for refill',
      customers: 3260,
      potentialRevenue: 1840000,
      potentialProfit: 820000,
      confidence: 81,
      difficulty: 'Low',
      source: 'Replenishment Engine',
      detectedAt: 'Today',
      status: 'New',
    }),
    withCalculatedScore({
      id: 'opp_003',
      type: 'CROSS_SELL_GAP',
      title: 'Rosemary buyers have not purchased Redensyl Serum',
      reason: '2190 Rosemary buyers have not entered the serum routine, creating a cross-sell gap.',
      segment: 'Rosemary buyers without serum',
      customers: 2190,
      potentialRevenue: 1390000,
      potentialProfit: 610000,
      confidence: 77,
      difficulty: 'Medium',
      source: 'Cross Sell Engine',
      detectedAt: 'Today',
      status: 'New',
    }),
    withCalculatedScore({
      id: 'opp_004',
      type: 'HIGH_VALUE_CHURN',
      title: 'High value customers inactive for 90 days',
      reason: '1144 high-LTV customers have not ordered in 90 days and may be at churn risk.',
      segment: 'High LTV inactive customers',
      customers: 1144,
      potentialRevenue: 1610000,
      potentialProfit: 740000,
      confidence: 74,
      difficulty: 'Medium',
      source: 'Churn Risk Engine',
      detectedAt: 'Today',
      status: 'Investigating',
    }),
    withCalculatedScore({
      id: 'opp_005',
      type: 'WINBACK',
      title: 'Inactive customers ready for Day 75-90 winback',
      reason: '3920 repeat customers are entering the strongest practical winback window.',
      segment: 'Inactive repeat customers',
      customers: 3920,
      potentialRevenue: 1220000,
      potentialProfit: 460000,
      confidence: 66,
      difficulty: 'Medium',
      source: 'Winback Engine',
      detectedAt: 'Today',
      status: 'Testing',
    }),
  ].sort((a, b) => b.score - a.score);
}