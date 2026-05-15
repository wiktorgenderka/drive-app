interface Waypoint {
  latitude: number;
  longitude: number;
  name?: string;
}

export function waypointsToGPX(name: string, waypoints: Waypoint[]): string {
  const pts = waypoints
    .map((w) => {
      const nameEl = w.name ? `\n      <name>${escXml(w.name)}</name>` : '';
      return `  <wpt lat="${w.latitude}" lon="${w.longitude}">${nameEl}\n  </wpt>`;
    })
    .join('\n');

  const trkpts = waypoints
    .map((w) => `      <trkpt lat="${w.latitude}" lon="${w.longitude}" />`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="DriveApp" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${escXml(name)}</name></metadata>
${pts}
  <trk>
    <name>${escXml(name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

export function parseGPX(xml: string): { name: string; waypoints: Waypoint[] } {
  const getName = (tag: string) => {
    const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
    return m ? m[1].trim() : '';
  };

  const routeName =
    getName('metadata>.*?<name') ||
    xml.match(/<metadata[^>]*>[\s\S]*?<name[^>]*>([^<]+)<\/name>/)?.[1]?.trim() ||
    xml.match(/<trk[^>]*>[\s\S]*?<name[^>]*>([^<]+)<\/name>/)?.[1]?.trim() ||
    'Imported route';

  const waypoints: Waypoint[] = [];

  // Parse <wpt> elements first
  const wptRe = /<wpt\s+[^>]*lat="([\d.\-]+)"[^>]*lon="([\d.\-]+)"[^>]*>([\s\S]*?)<\/wpt>/g;
  let m: RegExpExecArray | null;
  while ((m = wptRe.exec(xml)) !== null) {
    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[2]);
    const inner = m[3];
    const nameMatch = inner.match(/<name[^>]*>([^<]+)<\/name>/);
    if (!isNaN(lat) && !isNaN(lon)) {
      waypoints.push({ latitude: lat, longitude: lon, name: nameMatch?.[1]?.trim() });
    }
  }

  // If no <wpt>, parse track points
  if (waypoints.length === 0) {
    const trkptRe = /<trkpt\s+[^>]*lat="([\d.\-]+)"[^>]*lon="([\d.\-]+)"/g;
    while ((m = trkptRe.exec(xml)) !== null) {
      const lat = parseFloat(m[1]);
      const lon = parseFloat(m[2]);
      if (!isNaN(lat) && !isNaN(lon)) {
        waypoints.push({ latitude: lat, longitude: lon });
      }
    }

    // Downsample if too dense (keep max 200 points)
    if (waypoints.length > 200) {
      const step = Math.ceil(waypoints.length / 200);
      const sampled = waypoints.filter((_, i) => i % step === 0);
      if (sampled[sampled.length - 1] !== waypoints[waypoints.length - 1]) {
        sampled.push(waypoints[waypoints.length - 1]);
      }
      waypoints.splice(0, waypoints.length, ...sampled);
    }
  }

  return { name: routeName, waypoints };
}

function escXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
