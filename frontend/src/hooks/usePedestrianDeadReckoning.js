import { useState, useEffect, useRef, useCallback } from 'react';
import { haversineDistance } from '../utils/geo'; // We'll assume a basic util exists, or implement it inline

const DEFAULT_STRIDE_LENGTH = 0.75; // meters
const ACCEL_THRESHOLD = 1.2;
const STEP_COOLDOWN_MS = 300;
const HANDOFF_DISTANCE_M = 15;

export function usePedestrianDeadReckoning({ currentFloorPlan, entrances }) {
  const [position, setPosition] = useState(null); // { x, y, floor_plan_id } in normalized coords
  const [heading, setHeading] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [isOutdoorMode, setIsOutdoorMode] = useState(true);
  const [handoffPrompt, setHandoffPrompt] = useState(null);

  const lastStepTimeRef = useRef(0);
  const positionRef = useRef(null);
  const currentFloorPlanRef = useRef(null);
  const watchIdRef = useRef(null);

  useEffect(() => {
    currentFloorPlanRef.current = currentFloorPlan;
  }, [currentFloorPlan]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const requestPermissions = async () => {
    try {
      let motionGranted = true;
      let orientationGranted = true;

      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const permission = await DeviceMotionEvent.requestPermission();
        motionGranted = permission === 'granted';
      }
      
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        orientationGranted = permission === 'granted';
      }

      if (motionGranted && orientationGranted) {
        startIndoorTracking();
      }
    } catch (e) {
      console.error(e);
      startIndoorTracking();
    }
  };

  const handleDeviceMotion = useCallback((event) => {
    if (!positionRef.current || !currentFloorPlanRef.current || isOutdoorMode) return;

    const { accelerationIncludingGravity } = event;
    if (!accelerationIncludingGravity) return;

    const x = accelerationIncludingGravity.x || 0;
    const y = accelerationIncludingGravity.y || 0;
    const z = accelerationIncludingGravity.z || 0;
    
    const magnitude = Math.sqrt(x*x + y*y + z*z) - 9.8;

    if (magnitude > ACCEL_THRESHOLD) {
      const now = Date.now();
      if (now - lastStepTimeRef.current > STEP_COOLDOWN_MS) {
        lastStepTimeRef.current = now;
        handleStepTaken();
      }
    }
  }, [heading, isOutdoorMode]);

  const handleDeviceOrientation = useCallback((event) => {
    let currentHeading = event.webkitCompassHeading || event.alpha || 0;
    setHeading(currentHeading);
  }, []);

  const handleStepTaken = () => {
    if (!positionRef.current || !currentFloorPlanRef.current) return;

    const floorPlan = currentFloorPlanRef.current;
    // Assuming floorPlan.width_meters is available to normalize stride
    // If not, we approximate: a normalized 1.0 unit = 100 meters
    const mapWidthMeters = floorPlan.width_meters || 100;
    const mapHeightMeters = floorPlan.height_meters || 100;
    
    const normalizedDxPerStep = DEFAULT_STRIDE_LENGTH / mapWidthMeters;
    const normalizedDyPerStep = DEFAULT_STRIDE_LENGTH / mapHeightMeters;

    const rad = (heading - 90) * (Math.PI / 180); 
    
    const dx = Math.cos(rad) * normalizedDxPerStep;
    const dy = Math.sin(rad) * normalizedDyPerStep;

    setPosition(prev => {
      if (!prev) return null;
      return {
        ...prev,
        x: Math.min(Math.max(prev.x + dx, 0.0), 1.0),
        y: Math.min(Math.max(prev.y + dy, 0.0), 1.0)
      };
    });
  };

  const handleQRScan = async (payload) => {
    try {
      const response = await fetch(`/api/qr-locations/${payload}`);
      if (response.ok) {
        const data = await response.json();
        const qrNode = data.data;
        
        // Log drift correction
        if (positionRef.current) {
            const driftX = positionRef.current.x - qrNode.map_x;
            const driftY = positionRef.current.y - qrNode.map_y;
            console.log(`PDR Drift Correction: dx=${driftX.toFixed(4)}, dy=${driftY.toFixed(4)}`);
        }
        
        setPosition({
          x: qrNode.map_x,
          y: qrNode.map_y,
          floor_plan_id: qrNode.floor_plan_id
        });
        
        if (isOutdoorMode) {
            setIsOutdoorMode(false);
            setHandoffPrompt(null);
        }
      }
    } catch (e) {
      console.error("QR Resolution failed", e);
    }
  };

  const startIndoorTracking = () => {
    window.addEventListener('devicemotion', handleDeviceMotion, true);
    window.addEventListener('deviceorientation', handleDeviceOrientation, true);
    setIsTracking(true);
  };

  const stopTracking = () => {
    window.removeEventListener('devicemotion', handleDeviceMotion, true);
    window.removeEventListener('deviceorientation', handleDeviceOrientation, true);
    if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
    }
    setIsTracking(false);
  };

  // Outdoor tracking
  useEffect(() => {
    if (isOutdoorMode && entrances && entrances.length > 0) {
      if ("geolocation" in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition((position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          let nearestEntrance = null;
          let minDistance = Infinity;
          
          entrances.forEach(ent => {
             const dist = haversineDistance(lat, lng, ent.latitude, ent.longitude);
             if (dist < minDistance) {
                 minDistance = dist;
                 nearestEntrance = ent;
             }
          });
          
          if (minDistance <= HANDOFF_DISTANCE_M) {
              setHandoffPrompt("Scan the entrance QR code to begin.");
          } else {
              setHandoffPrompt(`Nearest entrance is ${Math.round(minDistance)} meters away.`);
          }
        }, (err) => console.error(err), { enableHighAccuracy: true });
      }
    }
    return () => {
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [isOutdoorMode, entrances]);

  return {
    position,
    heading,
    isTracking,
    isOutdoorMode,
    handoffPrompt,
    requestPermissions,
    handleQRScan,
    stopTracking
  };
}
