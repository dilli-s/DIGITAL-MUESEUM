/**
 * Calculates the great-circle distance between two points on the Earth surface.
 * 
 * @param {number} lat1 - Latitude of the first point in decimal degrees
 * @param {number} lon1 - Longitude of the first point in decimal degrees
 * @param {number} lat2 - Latitude of the second point in decimal degrees
 * @param {number} lon2 - Longitude of the second point in decimal degrees
 * @returns {number} Distance between the two points in meters
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;

  const dx = lon2 - lon1; // longitude is X
  const dy = lat2 - lat1; // latitude is Y
  
  // Multiply by 5 to give a rough "meters" equivalent for a 0-100 percentage scale
  return Math.sqrt(dx * dx + dy * dy) * 5;
}

/**
 * Calculates the initial bearing between two points in degrees (0-360).
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const dx = lon2 - lon1;
  const dy = lat2 - lat1;
  const toDeg = 180 / Math.PI;
  
  const brng = Math.atan2(dy, dx) * toDeg;
  return (brng + 360) % 360;
}

/**
 * Generates turn-by-turn text instructions from a series of GPS points.
 * @param {Array<{lat: number, lng: number}>} routePoints - Array of route coordinates
 * @returns {Array<{instruction: string, distance: number, type: string}>}
 */
export function generateTurnByTurnDirections(routePoints) {
  if (!routePoints || routePoints.length < 2) return [];

  const steps = [];
  let currentSegmentDist = 0;

  for (let i = 0; i < routePoints.length - 1; i++) {
    const p1 = routePoints[i];
    const p2 = routePoints[i + 1];
    const dist = calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
    
    // If it's the very first segment
    if (i === 0) {
      currentSegmentDist += dist;
      if (routePoints.length === 2) {
        steps.push({ instruction: 'Head straight to destination', distance: currentSegmentDist, type: 'straight' });
      }
      continue;
    }

    const p0 = routePoints[i - 1];
    const bearing1 = calculateBearing(p0.lat, p0.lng, p1.lat, p1.lng);
    const bearing2 = calculateBearing(p1.lat, p1.lng, p2.lat, p2.lng);
    
    // Difference between -180 and 180
    let angleDiff = bearing2 - bearing1;
    if (angleDiff > 180) angleDiff -= 360;
    if (angleDiff < -180) angleDiff += 360;
    
    // Thresholds for turns (e.g. > 30 degrees is a turn)
    if (Math.abs(angleDiff) < 30) {
      // Continue straight
      currentSegmentDist += dist;
    } else {
      // Push the straight segment before the turn
      if (currentSegmentDist > 0) {
        steps.push({ instruction: 'Continue straight', distance: currentSegmentDist, type: 'straight' });
      }
      
      // Determine turn direction
      if (angleDiff >= 30 && angleDiff <= 150) {
        steps.push({ instruction: 'Turn right', distance: dist, type: 'turn-right' });
      } else if (angleDiff <= -30 && angleDiff >= -150) {
        steps.push({ instruction: 'Turn left', distance: dist, type: 'turn-left' });
      } else {
        steps.push({ instruction: 'Make a U-turn', distance: dist, type: 'u-turn' });
      }
      
      currentSegmentDist = 0; // The turn itself consumed this segment's distance
    }
    
    // If it's the last point, push remaining straight distance if any
    if (i === routePoints.length - 2 && currentSegmentDist > 0) {
      steps.push({ instruction: 'Continue straight to destination', distance: currentSegmentDist, type: 'straight' });
    }
  }
  
  steps.push({ instruction: 'Arrive at destination', distance: 0, type: 'arrive' });
  return steps;
}

/**
 * Translates true GPS coordinates to a 0-100% virtual map grid using the museum's bounding box.
 * If bounds are not provided, it falls back to passing through the raw values (useful for legacy data where percentages were stored).
 */
export function translateGpsToMap(lat, lng, museum) {
  const pLat = parseFloat(lat);
  const pLng = parseFloat(lng);

  if (!museum || !museum.bounds_tl_lat || !museum.bounds_br_lat || !museum.bounds_tl_lng || !museum.bounds_br_lng) {
    return { lat: pLat, lng: pLng }; // Fallback
  }

  const tlLat = parseFloat(museum.bounds_tl_lat);
  const tlLng = parseFloat(museum.bounds_tl_lng);
  const brLat = parseFloat(museum.bounds_br_lat);
  const brLng = parseFloat(museum.bounds_br_lng);

  // Calculate the total span of the bounding box
  const latSpan = tlLat - brLat; // Assuming top-left latitude is greater (North) than bottom-right
  const lngSpan = brLng - tlLng; // Assuming bottom-right longitude is greater (East) than top-left

  // If bounds are invalid/zero-span to prevent division by zero
  if (latSpan === 0 || lngSpan === 0) {
    return { lat: pLat, lng: pLng };
  }

  // Calculate percentages (0% is Top/Left, 100% is Bottom/Right)
  const yPct = ((tlLat - pLat) / latSpan) * 100;
  const xPct = ((pLng - tlLng) / lngSpan) * 100;

  // We do NOT clamp it to 0-100% here because users might want to see if coordinates are drifting off map
  return { lat: yPct, lng: xPct };
}

export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // radius of Earth in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

export function latlngToPixel(lat, lng, floorPlan) {
  const x1 = floorPlan.anchor_1_x_px;
  const y1 = floorPlan.anchor_1_y_px;
  const lat1 = floorPlan.anchor_1_lat;
  const lng1 = floorPlan.anchor_1_lng;
  
  const x2 = floorPlan.anchor_2_x_px;
  const y2 = floorPlan.anchor_2_y_px;
  const lat2 = floorPlan.anchor_2_lat;
  const lng2 = floorPlan.anchor_2_lng;
  
  if (x1 == null || y1 == null || lat1 == null || lng1 == null ||
      x2 == null || y2 == null || lat2 == null || lng2 == null) {
    return null;
  }
  
  const dx_px = x2 - x1;
  const dy_px = y2 - y1;
  const dlat = lat2 - lat1;
  const dlng = lng2 - lng1;
  
  const theta_px = Math.atan2(dy_px, dx_px);
  const theta_geo = Math.atan2(dlat, dlng);
  
  const theta = theta_geo - theta_px;
  
  const dist_px = Math.sqrt(dx_px * dx_px + dy_px * dy_px);
  const dist_geo = Math.sqrt(dlng * dlng + dlat * dlat);
  
  if (dist_px === 0) return null;
  const scale = dist_geo / dist_px;
  const inv_scale = scale !== 0 ? 1.0 / scale : 0;
  
  const dlat_pt = lat - lat1;
  const dlng_pt = lng - lng1;
  
  const cos_inv_t = Math.cos(-theta);
  const sin_inv_t = Math.sin(-theta);
  
  const rotated_dlng = (dlng_pt * cos_inv_t - dlat_pt * sin_inv_t) * inv_scale;
  const rotated_dlat = (dlng_pt * sin_inv_t + dlat_pt * cos_inv_t) * inv_scale;
  
  return {
    x: x1 + rotated_dlng,
    y: y1 + rotated_dlat
  };
}
