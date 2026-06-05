export function calculatePriorityScore(input: {
  profitScore: number;
  ltvScore: number;
  confidenceScore: number;
  easeScore: number;
}) {
  return Math.round(
    input.profitScore * 0.4 +
      input.ltvScore * 0.3 +
      input.confidenceScore * 0.2 +
      input.easeScore * 0.1
  );
}

export function getScoreLabel(score: number) {
  if (score >= 95) return 'Elite';
  if (score >= 85) return 'High';
  if (score >= 70) return 'Medium';
  if (score >= 50) return 'Low';
  return 'Ignore';
}