'use client';
import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import io from "socket.io-client";
// Assuming you copy the CSS or import "./TrackNewLoad.css" if shared

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";
const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyCnMo9hEXw5QQTNAkXCxEan0QUT1oXNL00"; // Replace with your real Google Maps API key

export default function TrackLoad() {
  const [currentLoad, setCurrentLoad] = useState(null);
  const [loadStatus, setLoadStatus] = useState(""); 
  const [driverLocation, setDriverLocation] = useState(null);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const stopMarkers = useRef([]);
  const driverMarker = useRef(null);
  const socketRef = useRef(null);
  const movementInterval = useRef(null);

  const params = useParams();
  const id = params.id; // Assuming route is /track/[id]

  // ----------------- Initialize Google Maps -----------------
  useEffect(() => {
    const initMap = () => {
      try {
        if (mapRef.current && !mapInstance.current) {
          mapInstance.current = new window.google.maps.Map(mapRef.current, {
            center: { lat: 39.8283, lng: -98.5795 },
            zoom: 4,
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: true,
          });
          console.log("✅ Google Maps initialized successfully");
        }
      } catch (error) {
        console.error("❌ Failed to initialize Google Maps:", error);
        alert("Failed to load Google Maps. Please check your API key and internet connection.");
      }
    };

    const loadGoogleMapsScript = () => {
      if (window.google && window.google.maps) {
        initMap();
        return;
      }

      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        // Script is already loading
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log("✅ Google Maps script loaded");
        initMap();
      };
      script.onerror = () => {
        console.error("❌ Failed to load Google Maps script");
        alert("Failed to load Google Maps script. Please check your internet connection.");
      };
      document.head.appendChild(script);
    };

    loadGoogleMapsScript();

    // Fetch load on mount
    if (id) {
      fetchLoad();
    }

    return () => {
      if (movementInterval.current) clearInterval(movementInterval.current);
    };
  }, [id]);

  // ----------------- Fetch Load -----------------
  const fetchLoad = async () => {
    try {
      const res = await fetch(`${BACKEND}/api/loads/${id}`);
      if (!res.ok) throw new Error("Failed to fetch load");
      const load = await res.json();
      setCurrentLoad(load);
      setLoadStatus(load.status);
      showStopsOnMap(load.stops);
      initSocket(load.id);
      if (load.status === "Confirmed") {
        startDriverMovement(); // Restart simulation if already confirmed (simple, non-persistent)
      }
    } catch (err) {
      console.error(err);
      alert("Failed to fetch load.");
    }
  };

  // ----------------- Show stop markers -----------------
  const showStopsOnMap = (stops) => {
    if (!mapInstance.current) return;

    stopMarkers.current.forEach(m => m.setMap(null));
    stopMarkers.current = [];

    stops.forEach((stop, index) => {
      if (!stop.lat || !stop.lng) return;

      const marker = new window.google.maps.Marker({
        position: { lat: stop.lat, lng: stop.lng },
        map: mapInstance.current,
        label: stop.type === "pickup" ? `${index + 1}` : "D",
      });
      stopMarkers.current.push(marker);
    });

    const firstStop = stops[0];
    if (firstStop) {
      mapInstance.current.setCenter({ lat: firstStop.lat, lng: firstStop.lng });
      mapInstance.current.setZoom(10);
    }
  };

  // ----------------- Reverse Geocode -----------------
  const getAddressFromLatLng = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}`
      );
      const data = await res.json();
      return data.results[0]?.formatted_address || `${lat},${lng}`;
    } catch {
      return `${lat},${lng}`;
    }
  };

  // ----------------- Simulate Driver Movement -----------------
  const startDriverMovement = async () => {
    if (!currentLoad || !currentLoad.stops[0]?.lat || !currentLoad.stops[1]?.lat) return;

    const start = { lat: currentLoad.stops[0].lat, lng: currentLoad.stops[0].lng };
    const end = { lat: currentLoad.stops[currentLoad.stops.length - 1].lat, lng: currentLoad.stops[currentLoad.stops.length - 1].lng };

    let progress = 0;
    movementInterval.current = setInterval(async () => {
      progress += 0.01; // moves in 100 steps
      if (progress > 1) {
        clearInterval(movementInterval.current);
        return;
      }
      const lat = start.lat + (end.lat - start.lat) * progress;
      const lng = start.lng + (end.lng - start.lng) * progress;
      const address = await getAddressFromLatLng(lat, lng);

      const loc = { lat, lng, address };

      setDriverLocation(loc);

      if (socketRef.current) {
        socketRef.current.emit("driver_location", { loadId: currentLoad.id, loc });
      }

      if (!driverMarker.current) {
        driverMarker.current = new window.google.maps.Marker({
          position: loc,
          map: mapInstance.current,
          icon: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          label: "🚚",
        });
      } else {
        driverMarker.current.setPosition(loc);
      }
    }, 1000); // every second
  };

  // ----------------- Initialize Socket -----------------
  const initSocket = (loadId) => {
    if (socketRef.current) return;

    socketRef.current = io(BACKEND);
    socketRef.current.emit("join_load", loadId);

    socketRef.current.on("loadsUpdated", (loads) => {
      const load = loads.find(l => l.id === loadId);
      if (load) setLoadStatus(load.status);
    });
  };

  // ----------------- Confirm / Cancel Load -----------------
  const handleConfirmLoad = async () => {
    if (!currentLoad) return;
    const res = await fetch(`${BACKEND}/api/loads/${currentLoad.id}/confirm`, { method: "POST" });
    if (res.ok) {
      setLoadStatus("Confirmed");
      startDriverMovement(); // ✅ start driver animation
    }
  };

  const handleCancelLoad = async () => {
    if (!currentLoad) return;
    const res = await fetch(`${BACKEND}/api/loads/${currentLoad.id}/cancel`, { method: "POST" });
    if (res.ok) {
      setLoadStatus("Canceled");
      if (movementInterval.current) clearInterval(movementInterval.current);
    }
  };

  return (
    <div className="page">
      <div className="main">
        <div className="card">
          <div className="card-header">
            <h2>Track Load</h2>
          </div>

          {currentLoad && (
            <>
              {/* Driver Phone */}
              <div className="field">
                <label>Driver Phone: {currentLoad.driverPhone}</label>
              </div>

              {/* Stops */}
              {currentLoad.stops.map((stop, idx) => (
                <div className="stop-panel" key={idx}>
                  <div className="stop-header">
                    <span>{stop.type === "pickup" ? "📍 Pickup" : "🏁 Drop-off"} {idx + 1}</span>
                  </div>
                  <div className="stop-body">
                    <p>{stop.address}</p>
                  </div>
                </div>
              ))}

              {/* Geofence */}
              <div className="field">
                <label>Geofence Threshold: {currentLoad.geofence} Miles</label>
              </div>

              {/* Load Actions */}
              <div className="tracking-link">
                {loadStatus === "Created" && (
                  <>
                    <button onClick={handleConfirmLoad}>✅ Confirm</button>
                    <button onClick={handleCancelLoad}>❌ Cancel</button>
                  </>
                )}
                <p>Status: {loadStatus}</p>
                {driverLocation && loadStatus === "Confirmed" && (
                  <p>Driver Location: {driverLocation.address}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="map-container" ref={mapRef} style={{ height: "500px", width: "100%" }}></div>
    </div>
  );
}