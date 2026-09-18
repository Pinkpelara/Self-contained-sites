// Meeting planner over IANA zones using only Intl.DateTimeFormat.
// No offset tables. Daylight saving comes from the platform time zone data.

export const CITIES = [
  { label: 'New York', zone: 'America/New_York' },
  { label: 'Chicago', zone: 'America/Chicago' },
  { label: 'Denver', zone: 'America/Denver' },
  { label: 'Los Angeles', zone: 'America/Los_Angeles' },
  { label: 'Toronto', zone: 'America/Toronto' },
  { label: 'Mexico City', zone: 'America/Mexico_City' },
  { label: 'Sao Paulo', zone: 'America/Sao_Paulo' },
  { label: 'London', zone: 'Europe/London' },
  { label: 'Paris', zone: 'Europe/Paris' },
  { label: 'Berlin', zone: 'Europe/Berlin' },
  { label: 'Madrid', zone: 'Europe/Madrid' },
  { label: 'Cairo', zone: 'Africa/Cairo' },
  { label: 'Lagos', zone: 'Africa/Lagos' },
  { label: 'Dubai', zone: 'Asia/Dubai' },
  { label: 'Mumbai', zone: 'Asia/Kolkata' },
  { label: 'Singapore', zone: 'Asia/Singapore' },
  { label: 'Hong Kong', zone: 'Asia/Hong_Kong' },
  { label: 'Shanghai', zone: 'Asia/Shanghai' },
  { label: 'Tokyo', zone: 'Asia/Tokyo' },
  { label: 'Seoul', zone: 'Asia/Seoul' },
  { label: 'Sydney', zone: 'Australia/Sydney' },
  { label: 'Auckland', zone: 'Pacific/Auckland' },
  { label: 'Honolulu', zone: 'Pacific/Honolulu' },
  { label: 'Vancouver', zone: 'America/Vancouver' }
];

export function isValidZone(zone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function partsInZone(instant, zone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'shortOffset'
  });
  const parts = formatter.formatToParts(instant);
  const get = type => parts.find(part => part.type === type)?.value || '';
  const offsetText = parts.find(part => part.type === 'timeZoneName')?.value || '';
  return {
    label: `${get('weekday')}, ${get('month')} ${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    offsetText,
    offsetMinutes: offsetMinutesOf(instant, zone)
  };
}

// Offset in minutes by comparing the zone wall clock with UTC.
function offsetMinutesOf(instant, zone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  const parts = dtf.formatToParts(instant);
  const get = type => parts.find(part => part.type === type)?.value || '0';
  const asUtc = Date.UTC(
    Number(get('year')), Number(get('month')) - 1, Number(get('day')),
    Number(get('hour')), Number(get('minute')), Number(get('second'))
  );
  return Math.round((asUtc - instant.getTime()) / 60000);
}

export function formatOffset(offsetMinutes) {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const minutes = String(abs % 60).padStart(2, '0');
  return `UTC${sign}${hours}:${minutes}`;
}

export function meetingTable(instantInput, zones) {
  const instant = instantInput instanceof Date ? instantInput : new Date(instantInput);
  if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) {
    throw new Error('Pick a valid meeting date and time.');
  }
  if (!Array.isArray(zones) || zones.length === 0) throw new Error('Pick at least one city.');
  if (zones.length > 24) throw new Error('Keep the list at 24 cities or fewer.');
  return zones.map(zone => {
    const safe = isValidZone(zone) ? zone : 'UTC';
    const parts = partsInZone(instant, safe);
    const city = CITIES.find(entry => entry.zone === zone);
    return {
      zone,
      city: city ? city.label : zone,
      fallback: safe !== zone,
      ...parts,
      offsetLabel: formatOffset(parts.offsetMinutes),
      inWorkHours: parts.hour >= 9 && parts.hour < 17
    };
  });
}

// Count of cities inside 9:00 to 17:00 local time for a candidate instant.
export function overlapScore(instant, zones) {
  return meetingTable(instant, zones).filter(row => row.inWorkHours).length;
}

export function bestOverlap(candidates, zones) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error('Give at least one candidate time.');
  }
  let best = null;
  for (const candidate of candidates) {
    const instant = candidate instanceof Date ? candidate : new Date(candidate);
    const score = overlapScore(instant, zones);
    if (!best || score > best.score) best = { instant, score };
  }
  return best;
}

export function encodeShare(state) {
  const payload = {
    d: state.date,
    t: state.time,
    z: state.zones
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeShare(hash) {
  const clean = String(hash).replace(/^#/, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!clean) throw new Error('That share link is empty.');
  let parsed;
  try {
    parsed = JSON.parse(decodeURIComponent(escape(atob(clean))));
  } catch {
    throw new Error('That share link could not be read.');
  }
  if (typeof parsed.d !== 'string' || typeof parsed.t !== 'string' || !Array.isArray(parsed.z)) {
    throw new Error('That share link is missing fields.');
  }
  const zones = parsed.z.filter(zone => isValidZone(zone)).slice(0, 24);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.d)) throw new Error('That share link has a bad date.');
  if (!/^\d{2}:\d{2}$/.test(parsed.t)) throw new Error('That share link has a bad time.');
  return { date: parsed.d, time: parsed.t, zones };
}
