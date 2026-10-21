// Resolve a provider's wall-clock timestamp in its verified resort timezone.
export function zonedTimestamp(value, timeZone) {
  if (!value || !timeZone) return null;
  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = '0'] = match;
  const target = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
  const check = new Date(target);
  if (check.getUTCFullYear() !== +year || check.getUTCMonth() + 1 !== +month || check.getUTCDate() !== +day || check.getUTCHours() !== +hour || check.getUTCMinutes() !== +minute || check.getUTCSeconds() !== +second) return null;
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const localEpoch = (epoch) => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(epoch)).map(p => [p.type, p.value]));
    return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  };
  let resolved = target;
  for (let i = 0; i < 3; i++) resolved += target - localEpoch(resolved);
  if (localEpoch(resolved) !== target) return null;
  // Ambiguous fall-back hours have two possible instants; do not guess one.
  if ([resolved - 3600000, resolved + 3600000].some(t => localEpoch(t) === target)) return null;
  return new Date(resolved).toISOString();
}
