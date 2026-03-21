const SVG_NS = 'http://www.w3.org/2000/svg';

export function createSnowfallChart(dailySnowfall, dailyTime) {
  const days = dailySnowfall.slice(0, 7);
  if (!days.length) return null;

  const width = 320;
  const height = 120;
  const barGap = 8;
  const barCount = days.length;
  const labelHeight = 18;
  const topPad = 22;
  const bottomPad = labelHeight + 4;
  const chartHeight = height - topPad - bottomPad;
  const barWidth = (width - barGap * (barCount + 1)) / barCount;
  const maxVal = Math.max(...days, 1);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', '100%');
  svg.style.display = 'block';

  days.forEach((amount, i) => {
    const x = barGap + i * (barWidth + barGap);
    const barH = Math.max((amount / maxVal) * chartHeight, 2);
    const y = topPad + chartHeight - barH;

    // Bar with rounded top
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', barWidth);
    rect.setAttribute('height', barH);
    rect.setAttribute('rx', Math.min(4, barWidth / 2));
    rect.setAttribute('fill', amount > 0 ? 'var(--incoming, #b06cff)' : 'rgba(255,255,255,0.08)');
    svg.appendChild(rect);

    // Amount label above bar
    const amountLabel = document.createElementNS(SVG_NS, 'text');
    amountLabel.setAttribute('x', x + barWidth / 2);
    amountLabel.setAttribute('y', y - 5);
    amountLabel.setAttribute('text-anchor', 'middle');
    amountLabel.setAttribute('fill', 'var(--muted, rgba(226,235,255,0.62))');
    amountLabel.setAttribute('font-size', '10');
    amountLabel.setAttribute('font-family', 'var(--font-ui, sans-serif)');
    amountLabel.setAttribute('font-weight', '600');
    amountLabel.textContent = amount > 0 ? `${amount}"` : '0';
    svg.appendChild(amountLabel);

    // Day abbreviation below
    const dayLabel = document.createElementNS(SVG_NS, 'text');
    dayLabel.setAttribute('x', x + barWidth / 2);
    dayLabel.setAttribute('y', height - 4);
    dayLabel.setAttribute('text-anchor', 'middle');
    dayLabel.setAttribute('fill', 'var(--muted, rgba(226,235,255,0.62))');
    dayLabel.setAttribute('font-size', '10');
    dayLabel.setAttribute('font-family', 'var(--font-ui, sans-serif)');
    const dateStr = dailyTime?.[i];
    if (dateStr) {
      const date = new Date(`${dateStr}T12:00:00`);
      dayLabel.textContent = date.toLocaleDateString(undefined, { weekday: 'short' });
    } else {
      dayLabel.textContent = `D${i + 1}`;
    }
    svg.appendChild(dayLabel);
  });

  return svg;
}