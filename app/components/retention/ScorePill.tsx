'use client';

export default function ScorePill({
  score,
}: {
  score: number;
}) {
  let label = 'Ignore';

  if (score >= 95) label = 'Elite';
  else if (score >= 85) label = 'High';
  else if (score >= 70) label = 'Medium';
  else if (score >= 50) label = 'Low';

  return (
    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
      {score} {label}
    </span>
  );
}