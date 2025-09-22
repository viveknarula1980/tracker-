'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import io from 'socket.io-client';
import './TrackNewLoad.css';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyCnMo9hEXw5QQTNAkXCxEan0QUT1oXNL00';

export default function TrackNewLoad() {
  const [geofence, setGeofence] = useState(0.25);
  const [stops, setStops] = useState([
    { id: Date.now() + 1, type: 'pickup', address: '', lat: null, lng: null },
    { id: Date.now() + 2, type: 'dropoff', address: '', lat: null, lng: null },
  ]);
  const [driverPhone, setDriverPhone] = useState('');
  const [currentLoad, setCurrentLoad] = useState(null);
  const [loadStatus, setLoadStatus] = useState('');
  const [driverLocation, setDriverLocation] = useState(null);
  const [error, setError] = useState(null);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const stopMarkers = useRef([]);
  const driverMarker = useRef(null);
  const polylineRef = useRef(null);
  const socketRef = useRef(null);
  const router = useRouter();

  /* ------------------ Initialize Google Map ------------------ */
  useEffect(() => {
    const initMap = () => {
      if (mapRef.current && !mapInstance.current) {
        mapInstance.current = new window.google.maps.Map(mapRef.current, {
          center: { lat: 39.8283, lng: -98.5795 },
          zoom: 4,
        });
      }
    };

    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&libraries=places`;
      script.async = true;
      script.onload = initMap;
      script.onerror = () => setError('Failed to load Google Maps');
      document.body.appendChild(script);
    } else {
      initMap();
    }
  }, []);

  /* ------------------ Google Autocomplete ------------------ */
  const attachAutocomplete = (input, stopId) => {
    if (!window.google || !input) return;

    const autocomplete = new window.google.maps.places.Autocomplete(input, {
      fields: ['formatted_address', 'geometry'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.geometry) return;

      setStops((prev) =>
        prev.map((s) =>
          s.id === stopId
            ? {
                ...s,
                address: place.formatted_address,
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
              }
            : s
        )
      );
    });
  };

  /* ------------------ Add Stop ------------------ */
  const handleAddStop = () => {
    setStops((prev) => [...prev, { id: Date.now(), type: 'pickup', address: '', lat: null, lng: null }]);
  };

  /* ------------------ Show stops on map ------------------ */
  const showStopsOnMap = (stops) => {
    if (!mapInstance.current) return;

    // Remove old markers
    stopMarkers.current.forEach((m) => m.setMap(null));
    stopMarkers.current = [];

    stops.forEach((stop, index) => {
      if (!stop.lat || !stop.lng) return;

      const icon = stop.type === 'pickup'
        ? 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
        : 'http://maps.google.com/mapfiles/ms/icons/red-dot.png';

      const marker = new window.google.maps.Marker({
        position: { lat: stop.lat, lng: stop.lng },
        map: mapInstance.current,
        title: `${stop.type.toUpperCase()}: ${stop.address}`,
        icon,
        label: stop.type === 'pickup' ? `${index + 1}` : 'D',
      });
      stopMarkers.current.push(marker);
    });

    // Draw route polyline
    if (polylineRef.current) polylineRef.current.setMap(null);
    const path = stops.filter(s => s.lat && s.lng).map(s => ({ lat: s.lat, lng: s.lng }));
    if (path.length > 1) {
      polylineRef.current = new window.google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#FF0000',
        strokeOpacity: 0.7,
        strokeWeight: 4,
        map: mapInstance.current,
      });
    }

    updateMapBounds();
  };

  /* ------------------ Update map bounds to show all points ------------------ */
  const updateMapBounds = () => {
    if (!mapInstance.current) return;
    const bounds = new window.google.maps.LatLngBounds();
    stops.forEach((s) => s.lat && s.lng && bounds.extend({ lat: s.lat, lng: s.lng }));
    if (driverLocation?.lat && driverLocation?.lng) bounds.extend({ lat: driverLocation.lat, lng: driverLocation.lng });
    mapInstance.current.fitBounds(bounds);
  };

  /* ------------------ Create Load ------------------ */
  const handleCreateLoad = async () => {
    if (!driverPhone) return setError('Driver phone is required!');
    if (!stops.length || stops.some((s) => !s.address || !s.lat || !s.lng))
      return setError('All stops must have valid addresses with coordinates!');

    try {
      const payload = { driverPhone, geofence, stops };
      const res = await fetch(`${BACKEND}/api/loads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create load');
      }

      const load = await res.json();
      setCurrentLoad(load);
      setLoadStatus('Created');
      setError(null);
      showStopsOnMap(load.stops);
      initSocket(load.id);
      alert('✅ Load created successfully!');
    } catch (err) {
      setError(err.message || 'Failed to create load. Try again.');
    }
  };

  /* ------------------ Socket.IO ------------------ */
  const initSocket = (loadId) => {
    if (socketRef.current) return;

    socketRef.current = io(BACKEND);
    socketRef.current.emit('join_load', loadId);

    socketRef.current.on('loadsUpdated', (loads) => {
      const load = loads.find((l) => l.id === loadId);
      if (load) {
        setLoadStatus(load.status);
        if (load.driverLocation) {
          setDriverLocation(load.driverLocation);
          updateDriverMarker(load.driverLocation);
        }
      }
    });

    socketRef.current.on('location_update', (loc) => {
      setDriverLocation(loc);
      updateDriverMarker(loc);
    });
  };

  /* ------------------ Update driver marker ------------------ */
  const updateDriverMarker = (loc) => {
    if (!mapInstance.current || !loc?.lat || !loc?.lng) return;

    const pos = { lat: loc.lat, lng: loc.lng };
    if (!driverMarker.current) {
      driverMarker.current = new window.google.maps.Marker({
        position: pos,
        map: mapInstance.current,
        icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
        label: '🚚',
      });
    } else {
      driverMarker.current.setPosition(pos);
      mapInstance.current.panTo(pos);
    }

    updateMapBounds();
  };

  /* ------------------ Confirm / Cancel Load ------------------ */
  const handleConfirmLoad = async () => {
    if (!currentLoad) return;
    try {
      const res = await fetch(`${BACKEND}/api/loads/${currentLoad.id}/confirm`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to confirm load');
      setLoadStatus('Confirmed');

      // Immediately fetch current driver location when load is confirmed
      await fetchDriverLocation(currentLoad.id);
    } catch (err) {
      setError('Failed to confirm load. Try again.');
    }
  };

  const handleCancelLoad = async () => {
    if (!currentLoad) return;
    try {
      const res = await fetch(`${BACKEND}/api/loads/${currentLoad.id}/cancel`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to cancel load');
      setLoadStatus('Canceled');
    } catch (err) {
      setError('Failed to cancel load. Try again.');
    }
  };

  /* ------------------ Fetch Driver Location ------------------ */
  const fetchDriverLocation = async (loadId) => {
    try {
      const res = await fetch(`${BACKEND}/api/loads/${loadId}/driver-location`);
      if (res.ok) {
        const locationData = await res.json();
        if (locationData && locationData.lat && locationData.lng) {
          setDriverLocation(locationData);
          updateDriverMarker(locationData);
        }
      }
    } catch (err) {
      console.error('Failed to fetch driver location:', err);
    }
  };

  const handleNavigate = () => {
    if (!currentLoad) return;
    const path = new URL(currentLoad.trackingUrl).pathname;
    router.push(path);
  };

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="main">
        <div className="card">
          <h2>Track New Load</h2>
          <button className="create-btn" onClick={handleCreateLoad}>
            {currentLoad ? 'Track Load' : 'Create Load'}
          </button>

          {error && <p style={{ color: 'red' }}>{error}</p>}

          <div className="field">
            <div className="phone-input">
              <span className="flag">🇺🇸 +1</span>
              <input
                type="text"
                placeholder="Driver phone"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                disabled={!!currentLoad}
              />
            </div>
          </div>

          {stops.map((stop, idx) => (
            <div className="stop-panel" key={stop.id}>
              <span>{stop.type === 'pickup' ? '📍 Pickup' : '🏁 Drop-off'} {idx + 1}</span>
              <input
                type="text"
                placeholder={`Enter ${stop.type} address`}
                value={stop.address}
                ref={(input) => input && attachAutocomplete(input, stop.id)}
                onChange={(e) =>
                  setStops((prev) =>
                    prev.map((s) => (s.id === stop.id ? { ...s, address: e.target.value } : s))
                  )
                }
                disabled={!!currentLoad}
              />
            </div>
          ))}

          <button onClick={handleAddStop} disabled={!!currentLoad}>+ Add Stop</button>

          <div>
            <label>Geofence: {geofence} Miles</label>
            <input
              type="range"
              min="0.25"
              max="10"
              step="0.25"
              value={geofence}
              onChange={(e) => setGeofence(Number(e.target.value))}
              disabled={!!currentLoad}
            />
          </div>

          {currentLoad && (
            <div>
              <p>Tracking URL: <a href={currentLoad.trackingUrl} rel="noreferrer">{currentLoad.trackingUrl}</a></p>
              {loadStatus === 'Created' && (
                <>
                  <button onClick={handleConfirmLoad} style={{ background: 'green', marginRight: '10px' }}>✅ Confirm Load</button>
                  <button onClick={handleCancelLoad} style={{ background: 'red' }}>❌ Cancel Load</button>
                </>
              )}
              <button onClick={handleNavigate} style={{ marginTop: '10px', display: 'block' }}>🚀 Open Tracking Page</button>
              <p>Status: {loadStatus}</p>
              {driverLocation && (
                <p>Driver Location: {driverLocation.city || `${driverLocation.lat}, ${driverLocation.lng}`}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="map-container" ref={mapRef} style={{ height: '500px', width: '100%' }}></div>
    </div>
  );
}
