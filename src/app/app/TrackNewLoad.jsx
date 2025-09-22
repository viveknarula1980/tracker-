// 'use client';
// import React, { useState, useEffect, useRef } from "react";
// import { useRouter } from "next/navigation";
// import "./TrackNewLoad.css";

// export default function TrackNewLoad() {
//   const [geofence, setGeofence] = useState(0.25);
//   const [stops, setStops] = useState([
//     { id: Date.now() + 1, type: "pickup", address: "", open: true },
//     { id: Date.now() + 2, type: "dropoff", address: "", open: true },
//   ]);
//   const router = useRouter();
//   const mapRef = useRef(null);
//   const mapInstance = useRef(null);

//   // Load Google Maps script
//   useEffect(() => {
//     const initMap = () => {
//       if (mapRef.current && !mapInstance.current) {
//         mapInstance.current = new window.google.maps.Map(mapRef.current, {
//           center: { lat: 39.8283, lng: -98.5795 }, // USA center
//           zoom: 4,
//         });
//       }
//     };

//     if (!window.google) {
//       const script = document.createElement("script");
//       script.src =
//         "https://maps.googleapis.com/maps/api/js?key=AIzaSyCnMo9hEXw5QQTNAkXCxEan0QUT1oXNL00Y&libraries=places";
//       script.async = true;
//       script.onload = initMap;
//       document.body.appendChild(script);
//     } else {
//       initMap();
//     }
//   }, []);

//   // Add extra stop (user chooses type later)
//   const handleAddStop = () => {
//     setStops([
//       ...stops,
//       { id: Date.now(), type: "pickup", address: "", open: true },
//     ]);
//   };

//   // Attach Google Places Autocomplete
//   const attachAutocomplete = (input, stopId) => {
//     if (!window.google || !input) return;
//     const autocomplete = new window.google.maps.places.Autocomplete(input, {
//       fields: ["formatted_address", "geometry"],
//     });
//     autocomplete.addListener("place_changed", () => {
//       const place = autocomplete.getPlace();
//       if (!place.geometry) return;
//       setStops((prev) =>
//         prev.map((stop) =>
//           stop.id === stopId ? { ...stop, address: place.formatted_address } : stop
//         )
//       );
//       mapInstance.current.setCenter(place.geometry.location);
//       mapInstance.current.setZoom(10);
//       new window.google.maps.Marker({
//         map: mapInstance.current,
//         position: place.geometry.location,
//       });
//     });
//   };

//   // Submit and redirect
//   const handleCreate = async () => {
//     const driverPhone = document.querySelector(".phone-input input")?.value;

//     const payload = {
//       driverPhone,
//       geofence,
//       stops,
//     };

//     try {
//       const res = await fetch(" http://localhost:3000/api/loads", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload),
//       });

//       if (!res.ok) {
//         const text = await res.text();
//         throw new Error(`Failed to create load: ${text}`);
//       }

//       router.push("/dashboard");
//     } catch (err) {
//       console.error("Error creating load:", err);
//       alert("Failed to create load. Check backend logs.");
//     }
//   };

//   return (
//     <div className="page">
//       {/* Sidebar */}
//       <div className="sidebar">
//         <div className="sidebar-header">
//           <div className="users-label">Users</div>
//           <button className="add-btn">+</button>
//         </div>
//         <div className="sidebar-list">
//           <div className="list-item active">
//             All <span>0</span>
//           </div>
//         </div>
//       </div>

//       {/* Main */}
//       <div className="main">
//         <div className="card">
//           <div className="card-header">
//             <button className="back-btn" onClick={() => router.back()}>
//               Back
//             </button>
//             <h2>Track New Load</h2>
//             <button className="create-btn" onClick={handleCreate}>
//               Create
//             </button>
//           </div>

//           {/* Driver phone */}
//           <div className="field">
//             <div className="phone-input">
//               <span className="flag">🇺🇸 +1</span>
//               <input type="text" placeholder="Driver phone" />
//             </div>
//             <p className="hint">
//               Driver's phone will be sent a tracking link. Number cannot be
//               changed after driver accepts tracking.
//             </p>
//           </div>

//           {/* Pickup & Drop-off always visible */}
//           {stops.map((stop, index) => (
//             <div className="stop-panel" key={stop.id}>
//               <div
//                 className="stop-header"
//                 onClick={() =>
//                   setStops((prev) =>
//                     prev.map((s) =>
//                       s.id === stop.id ? { ...s, open: !s.open } : s
//                     )
//                   )
//                 }
//               >
//                 <span>
//                   {stop.type === "pickup" ? "📍 Pickup" : "🏁 Drop-off"}{" "}
//                   {index + 1}
//                 </span>
//                 <span>{stop.open ? "▲" : "▼"}</span>
//               </div>
//               {stop.open && (
//                 <div className="stop-body">
//                   <input
//                     type="text"
//                     placeholder={`Enter ${stop.type} address`}
//                     defaultValue={stop.address}
//                     ref={(input) => input && attachAutocomplete(input, stop.id)}
//                   />
//                   <div className="stop-buttons">
//                     <button
//                       className={stop.type === "pickup" ? "active" : ""}
//                       onClick={() =>
//                         setStops((prev) =>
//                           prev.map((s) =>
//                             s.id === stop.id ? { ...s, type: "pickup" } : s
//                           )
//                         )
//                       }
//                     >
//                       Pickup
//                     </button>
//                     <button
//                       className={stop.type === "dropoff" ? "active" : ""}
//                       onClick={() =>
//                         setStops((prev) =>
//                           prev.map((s) =>
//                             s.id === stop.id ? { ...s, type: "dropoff" } : s
//                           )
//                         )
//                       }
//                     >
//                       Drop-off
//                     </button>
//                   </div>
//                 </div>
//               )}
//             </div>
//           ))}

//           {/* Add stop */}
//           <div className="field">
//             <button className="add-stop" onClick={handleAddStop}>
//               + Add stop
//             </button>
//           </div>

//           {/* Geofence */}
//           <div className="field">
//             <div className="label-row">
//               <label>Geofence Threshold</label>
//               <span>{geofence} Miles</span>
//             </div>
//             <input
//               type="range"
//               min="0.25"
//               max="10"
//               step="0.25"
//               value={geofence}
//               onChange={(e) => setGeofence(e.target.value)}
//             />
//           </div>
//         </div>
//       </div>

//       {/* Map */}
//       <div className="map-container" ref={mapRef}></div>
//     </div>
//   );
// }


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
        `https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_KEY&libraries=places`;
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
      // ✅ FIX: send `stops` array instead of pickup/dropoff
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
      </div>

      {/* Main Card */}
      <div className="main">
        <div className="card">
          <div className="card-header">
            <h2>Track New Load</h2>
            <button className="create-btn" onClick={handleTrack}>
              Track
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
          </div>

          {/* Stops */}
          {stops.map((stop, idx) => (
            <div className="stop-panel" key={stop.id}>
              <div className="stop-header">
                <span>
                  {stop.type === "pickup" ? "📍 Pickup" : "🏁 Drop-off"} {idx + 1}
                </span>
              </div>
              <div className="stop-body">
                <input
                  type="text"
                  placeholder={`Enter ${stop.type} address`}
                  value={stop.address}
                  ref={input => input && attachAutocomplete(input, stop.id)}
                  onChange={e =>
                    setStops(prev =>
                      prev.map(s =>
                        s.id === stop.id ? { ...s, address: e.target.value } : s
                      )
                    )
                  }
                />
                <div className="stop-buttons">
                  <button
                    className={stop.type === "pickup" ? "active" : ""}
                    onClick={() =>
                      setStops(prev =>
                        prev.map(s =>
                          s.id === stop.id ? { ...s, type: "pickup" } : s
                        )
                      )
                    }
                  >
                    Pickup
                  </button>
                  <button
                    className={stop.type === "dropoff" ? "active" : ""}
                    onClick={() =>
                      setStops(prev =>
                        prev.map(s =>
                          s.id === stop.id ? { ...s, type: "dropoff" } : s
                        )
                      )
                    }
                  >
                    Drop-off
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="field">
            <button className="add-stop" onClick={handleAddStop}>
              + Add stop
            </button>
          </div>

          {/* Geofence */}
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
              onChange={e => setGeofence(e.target.value)}
            />
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
