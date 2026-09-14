import { useState, useEffect, useRef, useCallback } from 'react';
import { haversineDistance } from '../utils/geo';

const DEFAULT_STRIDE_LENGTH = 0.75; // meters per step
const ACCEL_THRESHOLD = 1.3; // Step detection acceleration threshold
const STEP_COOLDOWN_MS = 320; // Minimum time between consecutive steps
const HANDOFF_DISTANCE_M = 15;

export function usePedestrianDeadReckoning({
  currentFloorPlan,
  entrances = [],
  autoStart = true,
  enabled = true
} = {}) {
  const [position, setPosition] = useState(null); // { x, y, latitude, longitude, floor_plan_id }
  const [heading, setHeading] = useState(0); // 0..360 compass degrees (0=N, 90=E, 180=S, 270=W)
  const [stepCount, setStepCount] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [isOutdoorMode, setIsOutdoorMode] = useState(false);
  const [handoffPrompt, setHandoffPrompt] = useState(null);
  const [sensorStatus, setSensorStatus] = useState({ motion: false, orientation: false, type: 'idle' });

  const positionRef = useRef(null);
  const currentFloorPlanRef = useRef(null);
  const lastStepTimeRef = useRef(0);
  const watchIdRef = useRef(null);

  // Fusion refs
  const fusedHeadingRef = useRef(0);
  const lastGyroTimeRef = useRef(0);
  const hasAbsoluteCompassRef = useRef(false);
  const unwrappedHeadingRef = useRef(0);

  useEffect(() => {
    currentFloorPlanRef.current = currentFloorPlan;
  }, [currentFloorPlan]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const setManualPosition = useCallback((newPos) => {
    setPosition(prev => {
      const updated = {
        ...(prev || {}),
        ...newPos
      };
      positionRef.current = updated;
      return updated;
    });
  }, []);

  // Shortest angular difference (-180..180)
  const shortestAngleDiff = (target, current) => {
    return ((target - current + 540) % 360) - 180;
  };

  // Gyroscope & Accelerometer handler
  const handleDeviceMotion = useCallback((event) => {
    const now = performance.now();

    // 1. Gyroscope Angular Rate Fusion
    const rot = event.rotationRate;
    if (rot && rot.alpha !== null && rot.alpha !== undefined) {
      if (lastGyroTimeRef.current > 0) {
        const dt = (now - lastGyroTimeRef.current) / 1000.0;
        if (dt > 0 && dt < 0.5) {
          // On mobile devices, rot.alpha (or rot.gamma if device orientation differs)
          // rot.alpha is z-axis rotation in deg/sec.
          // In Android, CCW is positive, turning right (clockwise) is negative.
          // Compass heading increases clockwise (0 -> 90 -> 180).
          // Therefore, delta = -rot.alpha * dt.
          const gyroRate = Math.abs(rot.alpha) < 0.05 ? 0 : rot.alpha;
          const deltaHeading = -gyroRate * dt;

          unwrappedHeadingRef.current += deltaHeading;
          let newHeading = ((unwrappedHeadingRef.current % 360) + 360) % 360;
          fusedHeadingRef.current = newHeading;
          setHeading(Math.round(newHeading * 10) / 10);
        }
      }
      lastGyroTimeRef.current = now;
      setSensorStatus(prev => ({ ...prev, motion: true }));
    }

    // 2. Step Detection from Accelerometer
    const accel = event.accelerationIncludingGravity;
    if (accel && positionRef.current && currentFloorPlanRef.current) {
      const x = accel.x || 0;
      const y = accel.y || 0;
      const z = accel.z || 0;
      const mag = Math.sqrt(x * x + y * y + z * z) - 9.80665;

      if (mag > ACCEL_THRESHOLD) {
        const timeNow = Date.now();
        if (timeNow - lastStepTimeRef.current > STEP_COOLDOWN_MS) {
          lastStepTimeRef.current = timeNow;
          setStepCount(s => s + 1);
          handleStepTaken();
        }
      }
    }
  }, []);

  // Handle step displacement
  const handleStepTaken = () => {
    const pos = positionRef.current;
    const fp = currentFloorPlanRef.current;
    if (!pos || !fp) return;

    const w = parseFloat(fp.width_px || 1000);
    const h = parseFloat(fp.height_px || 1000);
    const scale = parseFloat(fp.scale_meters_per_px || 0.15);

    const mapWidthMeters = w * scale;
    const mapHeightMeters = h * scale;

    const normDxPerStep = DEFAULT_STRIDE_LENGTH / (mapWidthMeters || 100);
    const normDyPerStep = DEFAULT_STRIDE_LENGTH / (mapHeightMeters || 100);

    // Compass heading: 0°=North (up, y-), 90°=East (right, x+), 180°=South (down, y+), 270°=West (left, x-)
    const rad = (fusedHeadingRef.current - 90) * (Math.PI / 180);
    const dx = Math.cos(rad) * normDxPerStep;
    const dy = Math.sin(rad) * normDyPerStep;

    const newX = Math.min(Math.max(pos.x + dx, 0.0), 1.0);
    const newY = Math.min(Math.max(pos.y + dy, 0.0), 1.0);

    // Recalculate GPS if affine_transform exists
    let newLat = pos.latitude;
    let newLng = pos.longitude;
    const affine = fp.affine_transform;
    if (affine && affine.scale_x && affine.scale_y && affine.offset_x !== undefined) {
      newLng = affine.scale_x * newX + affine.offset_x;
      newLat = affine.scale_y * newY + affine.offset_y;
    }

    setPosition(prev => {
      if (!prev) return null;
      return {
        ...prev,
        x: newX,
        y: newY,
        latitude: newLat,
        longitude: newLng
      };
    });
  };

  // Absolute & standard orientation handler (Compass)
  const handleOrientation = useCallback((event) => {
    let rawHeading = null;

    // 1. iOS Safari webkitCompassHeading (clockwise 0..360, 0=North)
    if (typeof event.webkitCompassHeading === 'number' && !isNaN(event.webkitCompassHeading)) {
      rawHeading = event.webkitCompassHeading;
      hasAbsoluteCompassRef.current = true;
    }
    // 2. Android Chrome deviceorientationabsolute (alpha is CCW, 0=North)
    else if (event.absolute === true && typeof event.alpha === 'number') {
      rawHeading = (360 - event.alpha) % 360;
      hasAbsoluteCompassRef.current = true;
    }
    // 3. Fallback relative orientation
    else if (typeof event.alpha === 'number') {
      rawHeading = (360 - event.alpha) % 360;
    }

    if (rawHeading !== null && !isNaN(rawHeading)) {
      // Complementary fusion with gyroscope:
      // If we haven't had a heading yet, initialize directly
      if (!hasAbsoluteCompassRef.current || fusedHeadingRef.current === 0) {
        fusedHeadingRef.current = rawHeading;
        unwrappedHeadingRef.current = rawHeading;
      } else {
        // Smoothly pull fused heading towards compass to eliminate gyro bias
        const diff = shortestAngleDiff(rawHeading, fusedHeadingRef.current);
        // Alpha determines filter weight: 0.08 gives responsive compass without jump
        const corrected = (fusedHeadingRef.current + diff * 0.08 + 360) % 360;
        fusedHeadingRef.current = corrected;
        unwrappedHeadingRef.current += diff * 0.08;
      }

      setHeading(Math.round(fusedHeadingRef.current * 10) / 10);
      setSensorStatus(prev => ({ ...prev, orientation: true, type: hasAbsoluteCompassRef.current ? 'absolute' : 'relative' }));
    }
  }, []);

  const requestPermissions = useCallback(async () => {
    try {
      let motionGranted = true;
      let orientationGranted = true;

      // iOS 13+ permission requests
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const res = await DeviceMotionEvent.requestPermission();
        motionGranted = res === 'granted';
      }
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        orientationGranted = res === 'granted';
      }

      if (motionGranted || orientationGranted) {
        startTracking();
      } else {
        setSensorStatus(prev => ({ ...prev, error: 'Sensor permission denied' }));
      }
    } catch (err) {
      console.warn('Sensor permission error, starting anyway:', err);
      startTracking();
    }
  }, []);

  const startTracking = useCallback(() => {
    // Listen to deviceorientationabsolute on Chrome Android, deviceorientation on iOS/standard
    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    }
    window.addEventListener('deviceorientation', handleOrientation, true);
    window.addEventListener('devicemotion', handleDeviceMotion, true);
    setIsTracking(true);
  }, [handleOrientation, handleDeviceMotion]);

  const stopTracking = useCallback(() => {
    if ('ondeviceorientationabsolute' in window) {
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
    }
    window.removeEventListener('deviceorientation', handleOrientation, true);
    window.removeEventListener('devicemotion', handleDeviceMotion, true);
    if (watchIdRef.current && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    setIsTracking(false);
  }, [handleOrientation, handleDeviceMotion]);

  // Auto-start tracking if enabled
  useEffect(() => {
    if (autoStart && enabled) {
      startTracking();
    } else {
      stopTracking();
    }
    return () => {
      stopTracking();
    };
  }, [autoStart, enabled, startTracking, stopTracking]);

  // Handle outdoor geolocation handoff
  useEffect(() => {
    if (isOutdoorMode && entrances && entrances.length > 0 && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition((pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        let nearest = null;
        let minDist = Infinity;
        entrances.forEach(ent => {
          if (ent.latitude && ent.longitude) {
            const d = haversineDistance(lat, lng, ent.latitude, ent.longitude);
            if (d < minDist) {
              minDist = d;
              nearest = ent;
            }
          }
        });

        if (minDist <= HANDOFF_DISTANCE_M) {
          setHandoffPrompt('Arrived at entrance! Scan entrance QR code to start indoor navigation.');
        } else {
          setHandoffPrompt(`Nearest entrance is ${Math.round(minDist)} meters away.`);
        }
      }, (err) => console.warn('Outdoor GPS error:', err), { enableHighAccuracy: true });
    }

    return () => {
      if (watchIdRef.current && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isOutdoorMode, entrances]);

  const handleQRScan = useCallback(async (payload) => {
    try {
      const res = await fetch(`/api/qr-locations/${payload}`);
      if (res.ok) {
        const json = await res.json();
        const qrNode = json.data;
        if (qrNode) {
          setPosition({
            x: qrNode.map_x,
            y: qrNode.map_y,
            latitude: qrNode.latitude,
            longitude: qrNode.longitude,
            floor_plan_id: qrNode.floor_plan_id
          });
          setIsOutdoorMode(false);
          setHandoffPrompt(null);
        }
      }
    } catch (e) {
      console.error('Failed to resolve QR scan in PDR:', e);
    }
  }, []);

  return {
    position,
    heading,
    stepCount,
    isTracking,
    sensorStatus,
    isOutdoorMode,
    handoffPrompt,
    requestPermissions,
    setManualPosition,
    SetManualPosition: setManualPosition, // backward compat
    handleQRScan,
    startTracking,
    stopTracking
  };
}

export default usePedestrianDeadReckoning;
