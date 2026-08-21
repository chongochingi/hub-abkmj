const R = 6371;

export function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function ringCentroid(ring) {
  if (!ring?.length) return null;
  let lat = 0;
  let lon = 0;
  let n = 0;
  for (const coord of ring) {
    if (!Array.isArray(coord) || coord.length < 2) continue;
    lon += coord[0];
    lat += coord[1];
    n += 1;
  }
  if (!n) return null;
  return { lat: lat / n, lon: lon / n };
}

export function featureLatLon(feature) {
  const geom = feature?.geometry;
  if (!geom) return null;
  if (geom.type === "Point") {
    const [lon, lat] = geom.coordinates;
    return { lat, lon };
  }
  if (geom.type === "MultiPoint" && geom.coordinates?.[0]) {
    const [lon, lat] = geom.coordinates[0];
    return { lat, lon };
  }
  if (geom.type === "Polygon" && geom.coordinates?.[0]) {
    return ringCentroid(geom.coordinates[0]);
  }
  if (geom.type === "MultiPolygon" && geom.coordinates?.[0]?.[0]) {
    return ringCentroid(geom.coordinates[0][0]);
  }
  return null;
}

export function distanceToFeatureKm(lat, lon, feature) {
  const pt = featureLatLon(feature);
  if (!pt) return Infinity;
  return haversineKm(lat, lon, pt.lat, pt.lon);
}
