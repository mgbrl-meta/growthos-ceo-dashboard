export const mockOpportunities = [
  {
    id: 'opp_001',
    score: 94,
    title: 'Rosemary buyers not repeating after 45 days',
    segment: 'Rosemary first-time buyers',
    customers: 4812,
    potentialRevenue: 2840000,
    potentialProfit: 1280000,
    confidence: 86,
    difficulty: 'Low',
    status: 'New',
  },
  {
    id: 'opp_002',
    score: 82,
    title: 'High AOV customers inactive for 90 days',
    segment: 'High value customers',
    customers: 1144,
    potentialRevenue: 1610000,
    potentialProfit: 740000,
    confidence: 74,
    difficulty: 'Medium',
    status: 'Investigating',
  },
];

export const mockPatterns = [
  {
    id: 'pat_001',
    category: 'Product',
    title: 'Rosemary Oil Shot first buyers show stronger repeat behavior',
    sampleSize: 12842,
    effect: '2.3x repeat rate',
    confidence: 92,
    status: 'Validated',
  },
  {
    id: 'pat_002',
    category: 'Timing',
    title: 'Second order within 30 days predicts higher 12-month value',
    sampleSize: 8210,
    effect: '3.1x LTV',
    confidence: 88,
    status: 'Active',
  },
];

export const mockHypotheses = [
  {
    id: 'hyp_001',
    title: 'Educational WhatsApp at Day 21-35 increases second order rate',
    segment: 'Rosemary buyers',
    channel: 'WhatsApp',
    expectedProfit: 450000,
    confidence: 78,
    score: 88,
    status: 'Untested',
  },
];

export const mockActions = [
  {
    id: 'act_001',
    title: 'Education campaign for Rosemary buyers',
    channel: 'WhatsApp',
    audience: 'Day 35-60 first-time buyers',
    expectedProfit: 450000,
    status: 'Planned',
  },
];

export const mockLearnings = [
  {
    id: 'learn_001',
    title: 'Education outperformed discounting for routine products',
    expectedValue: 450000,
    actualValue: 520000,
    accuracy: 115,
    result: 'Validated',
    recommendation: 'Increase priority of education-led WhatsApp campaigns.',
  },
];