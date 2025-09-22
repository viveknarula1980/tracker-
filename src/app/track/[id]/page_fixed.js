'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import io from 'socket.io-client';
import './TrackNewLoad.css';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyCnMo9hEXw5QQTNAkXCxEan0QUT1oXNL00'; // Replace with your real Google Maps API key

export default function LoadDetails() {
  const { id } = useParams();
  const [load, setLoad] = useState(null);
  const [driverStatus, setDriverStatus] = useState('Created');
  const [driverLocation, setDriverLocation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [userAddress, setUserAddress] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [locationWatchId, setLocationWatchId] = useState(null);
  const [directionsService, setDirectionsService] = useState(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);
  const [currentDestination, setCurrentDestination] = useState(null);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const driverMarker = useRef(null);
  const userMarker = useRef(null);
  const stopMarkers = useRef([]);
  const polylineRef = useRef(null);
  const socketRef = useRef(null);

  // -----------------------------
  // Load Google Maps
  // -----------------------------
  useEffect(() => {
    const initMap = () => {
      try {
        if (!mapRef.current || mapInstance.current) return;

        console.log("🗺️ Initializing Google Maps...");

        // Check if Google Maps API is available
        if (!window.google || !window.google.maps) {
          console.error("❌ Google Maps API not available");
          setError("Google Maps API not loaded. Please check your internet connection.");
          return;
        }

        mapInstance.current = new window.google.maps.Map(mapRef.current, {
          center: { lat: 39.8283, lng: -98.5795 },
          zoom: 4,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          scaleControl: true,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ]
        });

        // Initialize Directions Service and Renderer
        const directionsServiceInstance = new window.google.maps.DirectionsService();
        const directionsRendererInstance = new window.google.maps.DirectionsRenderer({
          draggable: false,
          panel: null, // We'll create our own panel
          polylineOptions: {
            strokeColor: '#2196f3',
            strokeWeight: 6,
            strokeOpacity: 0.8
          },
          markerOptions: {
            draggable: false
          }
        });

        directionsRendererInstance.setMap(mapInstance.current);
        setDirectionsService(directionsServiceInstance);
        setDirectionsRenderer(directionsRendererInstance);

        setMapLoaded(true);
        console.log("✅ Google Maps initialized successfully");
      } catch (error) {
        console.error("❌ Failed to initialize Google Maps:", error);
        setError("Failed to load Google Maps. Please check your API key and internet connection.");
      }
    };

    const loadGoogleMapsScript = () => {
      if (window.google && window.google.maps) {
        console.log("✅ Google Maps API already loaded");
        initMap();
        return;
      }

      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        // Script is already loading
        console.log("⏳ Google Maps script already loading...");
        return;
      }

      console.log("📡 Loading Google Maps script...");
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log("✅ Google Maps script loaded successfully");
        initMap();
      };
      script.onerror = () => {
        console.error("❌ Failed to load Google Maps script");
        setError("Failed to load Google Maps script. Please check your internet connection and API key.");
      };
      document.head.appendChild(script);
    };

    loadGoogleMapsScript();
  }, []);

  // -----------------------------
  // Fetch load & listen to socket
  // -----------------------------
  useEffect(() => {
    if (!id) return;

    const fetchLoad = async () => {
      try {
        const res = await fetch(`${BACKEND}/api/loads/${id}`);
        if (!res.ok) throw new Error('Load not found');
        const data = await res.json();
        setLoad(data);
        setDriverStatus(data.status);
        if (data.driverLocation) setDriverLocation(data.driverLocation);
      } catch (err) {
        setError(err.message);
      }
    };

    fetchLoad();

    socketRef.current = io(BACKEND, { transports: ['websocket'] });
    socketRef.current.emit('join_load', id);

    socketRef.current.on('load_details', (load) => {
      setLoad(load);
      setDriverStatus(load.status);
      if (load.driverLocation) setDriverLocation(load.driverLocation);
    });

    socketRef.current.on('location_update', (loc) => {
      if (loc.lat && loc.lng) setDriverLocation(loc);
    });

    return () => socketRef.current?.disconnect();
  }, [id]);

  // -----------------------------
  // Track viewer (user) location
  // -----------------------------
  useEffect(() => {
    if (!mapLoaded) return;

    if (navigator.geolocation) {
      const watcher = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          const newLoc = { lat: latitude, lng: longitude };
          setUserLocation(newLoc);

          try {
            const res = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_KEY}`
            );
            const data = await res.json();
            if (data.results?.[0]) {
              setUserAddress(data.results[0].formatted_address);
            }
          } catch (err) {
            console.error('Reverse geocode error:', err);
          }
        },
        (err) => console.error('Geolocation error:', err),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );

      return () => navigator.geolocation.clearWatch(watcher);
    } else {
      setError('Geolocation not supported in this browser.');
    }
  }, [mapLoaded]);

  // -----------------------------
  // Plot stops + driver + user
  // -----------------------------
  useEffect(() => {
    if (!mapLoaded || !load) return;

    // Clear old stops
    stopMarkers.current.forEach((m) => m.setMap(null));
    stopMarkers.current = [];
    if (polylineRef.current) polylineRef.current.setMap(null);

    // Plot stops
    load.stops.forEach((stop, index) => {
      if (!stop.lat || !stop.lng) return;
      const marker = new window.google.maps.Marker({
        map: mapInstance.current,
        position: { lat: stop.lat, lng: stop.lng },
        icon: stop.type === 'pickup'
          ? 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
          : 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
        label: stop.type === 'pickup' ? `${index + 1}` : 'D',
      });
      stopMarkers.current.push(marker);
    });

    // Driver marker
    if (driverLocation?.lat && driverLocation?.lng) {
      if (!driverMarker.current) {
        driverMarker.current = new window.google.maps.Marker({
          map: mapInstance.current,
          position: driverLocation,
          icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
          label: '🚚',
        });
      } else {
        driverMarker.current.setPosition(driverLocation);
      }
    }

    // User marker
    if (userLocation?.lat && userLocation?.lng) {
      if (!userMarker.current) {
        userMarker.current = new window.google.maps.Marker({
          map: mapInstance.current,
          position: userLocation,
          icon: 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
          label: '👤',
        });
      } else {
        userMarker.current.setPosition(userLocation);
      }
    }

    // Fit map
    const bounds = new window.google.maps.LatLngBounds();
    load.stops.forEach((s) => s.lat && s.lng && bounds.extend(s));
    if (driverLocation) bounds.extend(driverLocation);
    if (userLocation) bounds.extend(userLocation);
    if (!bounds.isEmpty()) mapInstance.current.fitBounds(bounds);

    // Polyline
    const path = load.stops.filter(s => s.lat && s.lng).map(s => ({ lat: s.lat, lng: s.lng }));
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
  }, [mapLoaded, load, driverLocation, userLocation]);

  // -----------------------------
  // Confirm / Cancel Load
  // -----------------------------
  const handleConfirm = async () => {
    try {
      const res = await fetch(`${BACKEND}/api/loads/${id}/confirm`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to confirm load');
      setDriverStatus('Confirmed');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = async () => {
    try {
      const res = await fetch(`${BACKEND}/api/loads/${id}/cancel`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to cancel load');
      setDriverStatus('Canceled');
    } catch (err) {
      setError(err.message);
    }
  };

  // -----------------------------
  // Driver Location Sharing
  // -----------------------------
  const startLocationSharing = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }

    if (isSharingLocation) {
      stopLocationSharing();
      return;
    }

    setIsSharingLocation(true);
    setError(null);

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const locationData = {
          lat: latitude,
          lng: longitude,
          timestamp: new Date().toISOString(),
          loadId: id
        };

        // Update local state
        setUserLocation(locationData);

        // Send location to backend via socket
        if (socketRef.current) {
          socketRef.current.emit('driver_location_update', {
            loadId: id,
            location: locationData
          });
        }

        // Also send to backend REST API as backup
        try {
          await fetch(`${BACKEND}/api/loads/${id}/location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(locationData)
          });
        } catch (err) {
          console.error('Failed to send location to backend:', err);
        }

        console.log('📍 Location shared:', locationData);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setError(`Location error: ${error.message}`);
        setIsSharingLocation(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30000, // Accept locations up to 30 seconds old
        timeout: 10000 // 10 second timeout
      }
    );

    setLocationWatchId(watchId);
  };

  const stopLocationSharing = () => {
    if (locationWatchId) {
      navigator.geolocation.clearWatch(locationWatchId);
      setLocationWatchId(null);
    }
    setIsSharingLocation(false);
    console.log('⏹️ Location sharing stopped');
  };

  // Cleanup location sharing on unmount
  useEffect(() => {
    return () => {
      if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
      }
    };
  }, [locationWatchId]);

  // -----------------------------
  // Navigation Functions
  // -----------------------------
  const calculateRoute = (destinationIndex = 0) => {
    if (!directionsService || !userLocation || !load?.stops[destinationIndex]) {
      setError('Unable to calculate route. Please ensure location services are enabled.');
      return;
    }

    const destination = load.stops[destinationIndex];
    const origin = new window.google.maps.LatLng(userLocation.lat, userLocation.lng);
    const dest = new window.google.maps.LatLng(destination.lat, destination.lng);

    const request = {
      origin: origin,
      destination: dest,
      travelMode: window.google.maps.TravelMode.DRIVING,
      optimizeWaypoints: true,
      avoidHighways: false,
      avoidTolls: false
    };

    directionsService.route(request, (result, status) => {
      if (status === 'OK') {
        directionsRenderer.setDirections(result);
        setCurrentDestination(destination);
        console.log('🗺️ Route calculated successfully to:', destination.address);
      } else {
        console.error('Directions request failed:', status);
        setError('Failed to calculate route. Please try again.');
      }
    });
  };

  const clearRoute = () => {
    if (directionsRenderer) {
      directionsRenderer.setDirections({ routes: [] });
      setCurrentDestination(null);
    }
  };

  const navigateToPickup = () => {
    const pickupIndex = load.stops.findIndex(stop => stop.type === 'pickup');
    if (pickupIndex !== -1) {
      calculateRoute(pickupIndex);
    }
  };

  const navigateToDropoff = () => {
    const dropoffIndex = load.stops.findIndex(stop => stop.type === 'dropoff');
    if (dropoffIndex !== -1) {
      calculateRoute(dropoffIndex);
    }
  };

  // -----------------------------
  // Render
  // -----------------------------
  if (error) return <p style={{ padding: '20px', color: 'red' }}>{error}</p>;
  if (!load) return <p style={{ padding: '20px' }}>Loading load details...</p>;

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <div style={{ width: '400px', padding: '20px', overflowY: 'auto' }}>
        <div className="card">
          <h2>Load #{id}</h2>
          <p><strong>Driver Phone:</strong> {load.driverPhone}</p>
          <p><strong>Geofence:</strong> {load.geofence} miles</p>

          <h3>Stops</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {load.stops.map((s, i) => (
              <li key={i}>
                <strong>{s.type.toUpperCase()} {i + 1}:</strong> {s.address}
              </li>
            ))}
          </ul>

          <h3>Status: {driverStatus}</h3>
          {driverLocation && (
            <p><strong>Driver Location:</strong> {driverLocation.lat}, {driverLocation.lng}</p>
          )}

          {userLocation && (
            <p><strong>Your Location:</strong> {userAddress || `${userLocation.lat}, ${userLocation.lng}`}</p>
          )}

          {driverStatus === 'Created' && (
            <div style={{ marginTop: '20px' }}>
              <button onClick={handleConfirm} style={{ background: 'green', color: 'white', padding: '10px', marginRight: '10px' }}>✅ Confirm Load</button>
              <button onClick={handleCancel} style={{ background: 'red', color: 'white', padding: '10px' }}>❌ Cancel Load</button>
            </div>
          )}

          {driverStatus === 'Confirmed' && (
            <div style={{ marginTop: '20px' }}>
              <p style={{ color: 'green', marginBottom: '15px' }}>📡 Driver confirmed! Tracking live location...</p>

              {/* Navigation Controls */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '10px', color: '#333' }}>🗺️ Navigation</h4>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <button
                    onClick={navigateToPickup}
                    style={{
                      background: '#4CAF50',
                      color: 'white',
                      padding: '10px 15px',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      flex: 1,
                      transition: 'background 0.3s'
                    }}
                  >
                    🟢 To Pickup
                  </button>
                  <button
                    onClick={navigateToDropoff}
                    style={{
                      background: '#f44336',
                      color: 'white',
                      padding: '10px 15px',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      flex: 1,
                      transition: 'background 0.3s'
                    }}
                  >
                    🔴 To Drop-off
                  </button>
                </div>
                {currentDestination && (
                  <button
                    onClick={clearRoute}
                    style={{
                      background: '#757575',
                      color: 'white',
                      padding: '8px 12px',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: '600',
                      width: '100%',
                      transition: 'background 0.3s'
                    }}
                  >
                    ❌ Clear Route
                  </button>
                )}
                {currentDestination && (
                  <div style={{
                    marginTop: '10px',
                    padding: '10px',
                    background: '#f5f5f5',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}>
                    <strong>Navigating to:</strong><br />
                    {currentDestination.type === 'pickup' ? '🟢' : '🔴'} {currentDestination.address}
                  </div>
                )}
              </div>

              {/* Location Sharing */}
              <div style={{ borderTop: '1px solid #eee', paddingTop: '15px' }}>
                <h4 style={{ marginBottom: '10px', color: '#333' }}>📍 Location Sharing</h4>
                <button
                  onClick={startLocationSharing}
                  style={{
                    background: isSharingLocation ? '#f44336' : '#2196f3',
                    color: 'white',
                    padding: '12px 20px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    width: '100%',
                    transition: 'background 0.3s'
                  }}
                >
                  {isSharingLocation ? '⏹️ Stop Sharing Location' : '📍 Share My Live Location'}
                </button>
                {isSharingLocation && (
                  <p style={{ color: '#2196f3', fontSize: '12px', marginTop: '8px', textAlign: 'center' }}>
                    🔄 Sharing location in real-time...
                  </p>
                )}
              </div>
            </div>
          )}
          {driverStatus === 'Canceled' && <p style={{ color: 'red' }}>❌ Load canceled.</p>}
        </div>
      </div>

      {/* Map */}
      <div
        ref={mapRef}
        style={{
          flex: 1,
          height: '100%',
          minHeight: '500px',
          backgroundColor: '#f0f0f0',
          position: 'relative'
        }}
      >
        {!mapLoaded && !error && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#666'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '10px' }}>🗺️</div>
            <div>Loading Google Maps...</div>
          </div>
        )}
        {error && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#d32f2f',
            padding: '20px',
            backgroundColor: '#ffebee',
            borderRadius: '8px',
            border: '1px solid #ffcdd2'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '10px' }}>⚠️</div>
            <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>Map Loading Error</div>
            <div style={{ fontSize: '14px' }}>{error}</div>
            <div style={{ fontSize: '12px', marginTop: '10px', color: '#666' }}>
              Please check your Google Maps API key and internet connection.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
