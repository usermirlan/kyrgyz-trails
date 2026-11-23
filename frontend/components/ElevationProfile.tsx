/** Dependency-free SVG elevation chart. Server component. */
export default function ElevationProfile({
  profile,
  labels,
}: {
  profile: [number, number][];
  labels: { km: string; m: string };
}) {
  if (profile.length < 2) return null;

  const W = 720, H = 200, PAD = { l: 48, r: 12, t: 12, b: 28 };
  const kms = profile.map((p) => p[0]);
  const eles = profile.map((p) => p[1]);
  const maxKm = Math.max(...kms) || 1;
  const minE = Math.min(...eles), maxE = Math.max(...eles);
  const span = Math.max(maxE - minE, 50);
  const lo = minE - span * 0.1, hi = maxE + span * 0.1;

  const x = (km: number) => PAD.l + (km / maxKm) * (W - PAD.l - PAD.r);
  const y = (e: number) => PAD.t + (1 - (e - lo) / (hi - lo)) * (H - PAD.t - PAD.b);

  const line = profile.map(([k, e], i) => `${i ? "L" : "M"}${x(k).toFixed(1)},${y(e).toFixed(1)}`).join(" ");
  const area = `${line} L${x(maxKm)},${H - PAD.b} L${x(0)},${H - PAD.b} Z`;

  const yTicks = [lo + (hi - lo) * 0.15, (lo + hi) / 2, hi - (hi - lo) * 0.15].map(Math.round);
  const xTicks = [0, maxKm / 2, maxKm];
  const peak = profile[eles.indexOf(maxE)];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${Math.round(minE)}–${Math.round(maxE)} ${labels.m}`}>
      <defs>
        <linearGradient id="elev" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#3f6b4f" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#3f6b4f" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity="0.08" />
          <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="currentColor" fillOpacity="0.5">{v}</text>
        </g>
      ))}
      {xTicks.map((v) => (
        <text key={v} x={x(v)} y={H - 8} textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity="0.5">
          {v.toFixed(1)} {labels.km}
        </text>
      ))}
      <path d={area} fill="url(#elev)" />
      <path d={line} fill="none" stroke="#3f6b4f" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={x(peak[0])} cy={y(peak[1])} r="4" fill="#c8553d" />
      <text x={x(peak[0])} y={y(peak[1]) - 8} textAnchor="middle" fontSize="11" fontWeight="600" fill="#c8553d">
        {Math.round(peak[1])} {labels.m}
      </text>
    </svg>
  );
}
