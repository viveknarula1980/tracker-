'use client';
import React, { useState, useEffect, useRef } from "react";
import "./TrackNewLoad.css";

const BACKEND = " http://localhost:3000";

export default function TrackNewLoad() {
  const [geofence, setGeofence] = useState(0.25);
  const [stops, setStops] = useState([
    { id: Date.now() + 1, type: "pickup", address: "" },
    { id: Date.now() + 2, type: "dropoff", address: "" },
  ]);
  const [driverPhone, setDriverPhone] = useState("");
  const [trackingUrl, setTrackingUrl] = useState(null);
  const [selectedStopType, setSelectedStopType] = useState("pickup"); // For the toggle
  const [emailInterval, setEmailInterval] = useState(false);
  const [sendLater, setSendLater] = useState(false);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  // ----------------- Initialize Google Maps -----------------
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
      const script = document.createElement("script");
      script.src =
        `https://maps.googleapis.com/maps/api/js?key=AIzaSyCnMo9hEXw5QQTNAkXCxEan0QUT1oXNL00&libraries=places`;
      script.async = true;
      script.onload = initMap;
      document.body.appendChild(script);
    } else {
      initMap();
    }
  }, []);

  // ----------------- Attach Google Autocomplete -----------------
  const attachAutocomplete = (input, stopId) => {
    if (!window.google || !input) return;

    const autocomplete = new window.google.maps.places.Autocomplete(input, {
      fields: ["formatted_address", "geometry"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry) return;

      setStops(prev =>
        prev.map(s =>
          s.id === stopId ? { ...s, address: place.formatted_address } : s
        )
      );

      mapInstance.current.setCenter(place.geometry.location);
      mapInstance.current.setZoom(10);
      new window.google.maps.Marker({
        map: mapInstance.current,
        position: place.geometry.location,
      });
    });
  };

  // ----------------- Add new stop -----------------
  const handleAddStop = () => {
    setStops(prev => [
      ...prev,
      { id: Date.now(), type: "pickup", address: "" },
    ]);
  };

  // ----------------- Create Load (connect to backend) -----------------
  const handleTrack = async () => {
    if (!driverPhone) return alert("Driver phone is required!");
    if (!stops.length || stops.some(s => !s.address))
      return alert("All stops must have addresses!");

    try {
      const payload = {
        driverPhone,
        geofence,
        stops: stops.map(s => ({
          type: s.type,
          address: s.address
        }))
      };

      console.log("📤 Sending payload to backend:", payload);

      const res = await fetch(`${BACKEND}/api/loads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to create load");

      const load = await res.json();

      // Save and show tracking URL
      setTrackingUrl(load.trackingUrl);
      alert(`✅ Load created!\nTracking URL: ${load.trackingUrl}`);
    } catch (err) {
      console.error("❌ Error creating load:", err);
      alert("Failed to create load. Please try again.");
    }
  };

  return (
    <div className="page">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="users-label">Users</div>
          <button className="add-btn">+</button>
        </div>
        <div className="sidebar-list">
          <div className="list-item active">
            All <span>0</span>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="main">
        <div className="card">
          <div className="card-header">
            <button className="back-btn">Back</button>
            <h2>Track New Load</h2>
            <button className="create-btn" onClick={handleTrack}>
              Create
            </button>
          </div>

          {/* Driver Phone */}
          <div className="field">
            <div className="phone-input">
              <span className="flag">🇺🇸 +1</span>
              <input
                type="text"
                placeholder="Driver phone"
                value={driverPhone}
                onChange={e => setDriverPhone(e.target.value)}
              />
            </div>
            <p className="hint">
              Driver's phone will be sent a tracking link. Number cannot be
              changed after driver accepts tracking.
            </p>
          </div>

          {/* Pickup/Drop-off Toggle */}
          <div className="field">
            <div className="toggle-container">
              <div className="toggle-buttons">
                <button
                  className={`toggle-btn ${selectedStopType === "pickup" ? "active" : ""}`}
                  onClick={() => setSelectedStopType("pickup")}
                >
                  Pickup
                </button>
                <button
                  className={`toggle-btn ${selectedStopType === "dropoff" ? "active" : ""}`}
                  onClick={() => setSelectedStopType("dropoff")}
                >
                  Drop-off
                </button>
              </div>
            </div>
          </div>

          {/* Address Input */}
          <div className="field">
            <div className="address-input-container">
              <input
                type="text"
                placeholder={`Enter ${selectedStopType} address`}
                className="address-input"
                ref={(input) => {
                  if (input) {
                    attachAutocomplete(input, selectedStopType === "pickup" ? stops[0]?.id : stops[1]?.id);
                  }
                }}
                onChange={(e) => {
                  const value = e.target.value;
                  setStops(prev =>
                    prev.map(s =>
                      s.type === selectedStopType ? { ...s, address: value } : s
                    )
                  );
                }}
                value={stops.find(s => s.type === selectedStopType)?.address || ""}
              />
            </div>
          </div>

          {/* Add Stop Button */}
          <div className="field">
            <button className="add-stop" onClick={handleAddStop}>
              + Add stop
            </button>
          </div>

          {/* Geofence Threshold */}
          <div className="field">
            <div className="label-row">
              <label>Geofence Threshold</label>
              <span>{geofence} Miles</span>
            </div>
            <input
              type="range"
              min="0.25"
              max="10"
              step="0.25"
              value={geofence}
              onChange={(e) => setGeofence(e.target.value)}
              className="geofence-slider"
            />
            <p className="hint">
              This is how close the driver needs to be to a stop in order for
              you to be alerted of arrival and departures.
            </p>
          </div>

          {/* Email Interval */}
          <div className="field">
            <div className="checkbox-container">
              <input
                type="checkbox"
                id="emailInterval"
                checked={emailInterval}
                onChange={(e) => setEmailInterval(e.target.checked)}
              />
              <label htmlFor="emailInterval">Email Interval</label>
            </div>
            <p className="hint">
              Set how often you and your email list receive updates.
            </p>
          </div>

          {/* Send Later */}
          <div className="field">
            <div className="send-later-container">
              <button
                className={`send-later-btn ${sendLater ? "active" : ""}`}
                onClick={() => setSendLater(!sendLater)}
              >
                Send Later
              </button>
              <span className="dropdown-arrow">›</span>
            </div>
            <p className="hint">
              Schedule tracking links to be sent to the carrier later.
            </p>
          </div>

          {/* Tracking URL */}
          {trackingUrl && (
            <div className="tracking-link">
              <div className="tracking-header">
                <h3>📱 Tracking Link Generated!</h3>
                <p>Share this link with the driver to start tracking:</p>
              </div>
              <div className="url-container">
                <input
                  type="text"
                  value={trackingUrl}
                  readOnly
                  className="tracking-url-input"
                />
                <button
                  className="copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(trackingUrl);
                    alert("✅ Tracking URL copied to clipboard!");
                  }}
                >
                  📋 Copy
                </button>
              </div>
              <div className="tracking-actions">
                <a href={trackingUrl} target="_blank" rel="noreferrer" className="open-link-btn">
                  🔗 Open Tracking Page
                </a>
                <button
                  className="share-btn"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: 'Load Tracking Link',
                        text: 'Track your load in real-time',
                        url: trackingUrl,
                      });
                    } else {
                      alert("Share this URL: " + trackingUrl);
                    }
                  }}
                >
                  📤 Share
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="map-container" ref={mapRef}></div>
    </div>
  );
}
