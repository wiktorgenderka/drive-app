import { describe, it, expect } from 'vitest';
import { waypointsToGPX, parseGPX } from '@/lib/gpx';

describe('waypointsToGPX', () => {
  it('produces valid GPX XML', () => {
    const gpx = waypointsToGPX('Test', [
      { latitude: 52.23, longitude: 21.01, name: 'Warsaw' },
      { latitude: 50.06, longitude: 19.94, name: 'Kraków' },
    ]);
    expect(gpx).toContain('<gpx');
    expect(gpx).toContain('lat="52.23"');
    expect(gpx).toContain('lon="21.01"');
    expect(gpx).toContain('<name>Test</name>');
    expect(gpx).toContain('Warsaw');
  });

  it('escapes XML special chars in names', () => {
    const gpx = waypointsToGPX('A & B <test>', [
      { latitude: 1, longitude: 2 },
      { latitude: 3, longitude: 4 },
    ]);
    expect(gpx).toContain('A &amp; B &lt;test&gt;');
    expect(gpx).not.toContain('A & B');
  });

  it('includes track points', () => {
    const gpx = waypointsToGPX('Route', [
      { latitude: 10, longitude: 20 },
      { latitude: 11, longitude: 21 },
    ]);
    expect(gpx).toContain('<trkpt');
    expect(gpx).toContain('<trk>');
  });
});

describe('parseGPX', () => {
  it('parses waypoints from <wpt> elements', () => {
    const xml = `<?xml version="1.0"?>
<gpx version="1.1">
  <metadata><name>My Route</name></metadata>
  <wpt lat="52.23" lon="21.01"><name>Warsaw</name></wpt>
  <wpt lat="50.06" lon="19.94"><name>Kraków</name></wpt>
</gpx>`;
    const { name, waypoints } = parseGPX(xml);
    expect(name).toBe('My Route');
    expect(waypoints).toHaveLength(2);
    expect(waypoints[0].latitude).toBe(52.23);
    expect(waypoints[0].longitude).toBe(21.01);
    expect(waypoints[0].name).toBe('Warsaw');
  });

  it('parses track points when no <wpt>', () => {
    const xml = `<?xml version="1.0"?>
<gpx version="1.1">
  <trk><name>Track</name><trkseg>
    <trkpt lat="1.0" lon="2.0" />
    <trkpt lat="3.0" lon="4.0" />
  </trkseg></trk>
</gpx>`;
    const { name, waypoints } = parseGPX(xml);
    expect(name).toBe('Track');
    expect(waypoints).toHaveLength(2);
    expect(waypoints[1].latitude).toBe(3.0);
  });

  it('downsamples to max 200 points', () => {
    const pts = Array.from({ length: 500 }, (_, i) => `    <trkpt lat="${i}.0" lon="${i}.0" />`).join('\n');
    const xml = `<gpx><trk><trkseg>\n${pts}\n</trkseg></trk></gpx>`;
    const { waypoints } = parseGPX(xml);
    expect(waypoints.length).toBeLessThanOrEqual(200);
    expect(waypoints.length).toBeGreaterThan(0);
  });

  it('falls back to "Imported route" when no name', () => {
    const xml = `<gpx><trk><trkseg>
      <trkpt lat="1.0" lon="2.0" />
      <trkpt lat="3.0" lon="4.0" />
    </trkseg></trk></gpx>`;
    const { name } = parseGPX(xml);
    expect(name).toBe('Imported route');
  });

  it('round-trips through waypointsToGPX -> parseGPX', () => {
    const original = [
      { latitude: 52.23, longitude: 21.01, name: 'Start' },
      { latitude: 50.06, longitude: 19.94, name: 'End' },
    ];
    const gpx = waypointsToGPX('Round-trip', original);
    const { name, waypoints } = parseGPX(gpx);
    expect(name).toBe('Round-trip');
    expect(waypoints).toHaveLength(2);
    expect(waypoints[0].latitude).toBeCloseTo(52.23, 4);
    expect(waypoints[0].longitude).toBeCloseTo(21.01, 4);
    expect(waypoints[0].name).toBe('Start');
  });
});
