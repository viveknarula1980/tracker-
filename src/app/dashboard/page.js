'use client';
import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend-23gf.onrender.com";

export default function Home() {
  const [loads, setLoads] = useState([]);
  const [pickupNew, setPickupNew] = useState("");
  const [dropoffNew, setDropoffNew] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [extraPickups, setExtraPickups] = useState({});
  const [currentTrackingLoadId, setCurrentTrackingLoadId] = useState(null);

  const pickupRef = useRef(null);
  const dropoffRef = useRef(null);
  const mapRef = useRef(null);
  const truckMarkerRef = useRef(null);
  const routePolylineRef = useRef(null);
  const mapInitialized = useRef(false);

  /* ----------------- Google Places Autocomplete ----------------- */
  useEffect(() => {
    if (!window.google || !window.google.maps) {
      if (!document.getElementById("google-maps-script")) {
        const script = document.createElement("script");
        script.id = "google-maps-script";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyCnMo9hEXw5QQTNAkXCxEan0QUT1oXNL00'}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = initAutocomplete;
        document.body.appendChild(script);
      }
    } else {
      initAutocomplete();
    }
  }, []);

  const initAutocomplete = () => {
    const options = { types: ['(cities)'] };

    if (pickupRef.current) {
      const autocompletePickup = new window.google.maps.places.Autocomplete(pickupRef.current, options);
      autocompletePickup.addListener("place_changed", () => {
        const place = autocompletePickup.getPlace();
        setPickupNew(place.formatted_address || place.name);
      });
    }

    if (dropoffRef.current) {
      const autocompleteDropoff = new window.google.maps.places.Autocomplete(dropoffRef.current, options);
      autocompleteDropoff.addListener("place_changed", () => {
        const place = autocompleteDropoff.getPlace();
        setDropoffNew(place.formatted_address || place.name);
      });
    }
  };

  /* ----------------- Load existing loads + Socket.io ----------------- */
  useEffect(() => {
    const socket = io(BACKEND);

    fetch(`${BACKEND}/api/loads`)
      .then(res => res.json())
      .then(setLoads);

    socket.emit("joinDashboard");

    socket.on("loadsUpdated", setLoads);

    socket.on("locationBroadcast", ({ loadId, loc }) => {
      setLoads(prev => prev.map(l => {
        if (l.id === loadId) {
          return {
            ...l,
            locations: [...l.locations, loc],
            events: [...l.events, { type: "LocationUpdate", ts: loc.timestamp, meta: loc }]
          };
        }
        return l;
      }));

      // Update map marker if tracking this load
      if (loadId === currentTrackingLoadId && truckMarkerRef.current) {
        const newPos = { lat: loc.lat, lng: loc.lng };
        truckMarkerRef.current.setPosition(newPos);
        truckMarkerRef.current.setTitle(`Truck for Load #${loadId} – ${loc.city}`);
        truckMarkerRef.current.getMap().panTo(newPos);

        if (routePolylineRef.current) {
          const path = routePolylineRef.current.getPath();
          path.push(newPos);
        }
      }
    });

    return () => socket.disconnect();
  }, [currentTrackingLoadId]);

  /* ----------------- Map initialization ----------------- */
  const initMap = (load = null) => {
    if (!mapRef.current || !window.google || !window.google.maps) return;

    const center = load && load.pickup[0]?.lat
      ? { lat: load.pickup[0].lat, lng: load.pickup[0].lng }
      : { lat: 0, lng: 0 };

    const zoom = load ? 12 : 2;

    const map = new window.google.maps.Map(mapRef.current, {
      center,
      zoom,
      mapTypeId: 'roadmap',
    });

    if (load) {
      load.pickup.forEach((p, idx) => {
        if (p.lat && p.lng) {
          new window.google.maps.Marker({
            position: { lat: p.lat, lng: p.lng },
            map,
            label: {
              text: `${idx + 1}`,
              color: 'white',
              fontWeight: 'bold',
              fontSize: '14px',
            },
            title: `Pickup ${idx + 1}: ${p.address}`,
          });
        }
      });

      if (load.dropoff.lat && load.dropoff.lng) {
        new window.google.maps.Marker({
          position: { lat: load.dropoff.lat, lng: load.dropoff.lng },
          map,
          label: {
            text: "D",
            color: 'white',
            fontWeight: 'bold',
            fontSize: '14px',
          },
          title: `Dropoff: ${load.dropoff.address}`,
        });
      }

      const routePath = [
        ...load.pickup.map(p => ({ lat: p.lat, lng: p.lng })),
        { lat: load.dropoff.lat, lng: load.dropoff.lng }
      ];

      routePolylineRef.current = new window.google.maps.Polyline({
        path: routePath,
        geodesic: true,
        strokeColor: "#FF0000",
        strokeOpacity: 0.8,
        strokeWeight: 3,
        map,
      });

      const initialPos = load.locations.length > 0
        ? { lat: load.locations[load.locations.length - 1].lat, lng: load.locations[load.locations.length - 1].lng }
        : routePath[0];

      truckMarkerRef.current = new window.google.maps.Marker({
        position: initialPos,
        map,
        title: `Truck for Load #${currentTrackingLoadId}`,
        icon: {
          path: "M12 2C8.13 2 5 5.13 5 9c0 1.63.65 3.12 1.7 4.2L12 22l5.3-8.8C18.35 12.12 19 10.63 19 9c0-3.87-3.13-7-7-7z",
          fillColor: "#0000FF",
          fillOpacity: 1,
          scale: 1.5,
          strokeWeight: 0,
        },
      });
    }

    mapInitialized.current = true;
  };

  useEffect(() => {
    if (typeof window === "undefined" || !window.google || !window.google.maps) return;

    if (!mapInitialized.current) {
      initMap();
    }

    if (currentTrackingLoadId) {
      const load = loads.find(l => l.id === currentTrackingLoadId);
      if (load) {
        initMap(load);
      }
    }
  }, [currentTrackingLoadId, loads]);

  /* ----------------- Create new load ----------------- */
  const createLoad = async () => {
    if (!pickupNew || !dropoffNew) return alert("Pickup and Dropoff required!");

    const res = await fetch(`${BACKEND}/api/loads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickup: [{ address: pickupNew }],
        dropoff: { address: dropoffNew },
        driverPhone
      })
    });

    const load = await res.json();
    setCurrentTrackingLoadId(load.id);

    setPickupNew("");
    setDropoffNew("");
    setDriverPhone("");
  };

  /* ----------------- Add pickup ----------------- */
  const addPickup = async (id) => {
    const extra = extraPickups[id];
    if (!extra) return alert("Pickup address required!");

    await fetch(`${BACKEND}/api/loads/${id}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "PickupAdded",
        meta: { pickup: { address: extra } }
      })
    });

    setExtraPickups(prev => ({ ...prev, [id]: "" }));
  };

  /* ----------------- Confirm load + generate tracking URL ----------------- */
  const confirmLoad = async (id) => {
    const res = await fetch(`${BACKEND}/api/loads/${id}/confirm`, { method: "POST" });
    const data = await res.json();

    setLoads(prev =>
      prev.map(l =>
        l.id === id ? { ...l, status: "Confirmed", trackingUrl: data.trackingUrl } : l
      )
    );

    setCurrentTrackingLoadId(id);
  };

  /* ----------------- Render ----------------- */
  return (
    <main className="min-h-screen p-6 bg-gray-100">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className='left-main'>
          <h1 className="text-3xl font-bold mb-6">📦 Load Tracking Dashboard</h1>

          {/* Create Load */}
          <div className="bg-white shadow-lg rounded-xl p-6 mb-6 border border-gray-200 form-main">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Create New Load</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pickup City</label>
                <input ref={pickupRef} type="text" placeholder="Enter pickup city"
                  className="w-full px-4 py-3 border rounded-lg" value={pickupNew}
                  onChange={e => setPickupNew(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dropoff City</label>
                <input ref={dropoffRef} type="text" placeholder="Enter dropoff city"
                  className="w-full px-4 py-3 border rounded-lg" value={dropoffNew}
                  onChange={e => setDropoffNew(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Driver Phone</label>
                <input type="text" placeholder="Enter driver phone number"
                  value={driverPhone} onChange={e => setDriverPhone(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg" />
              </div>
            </div>
            <button onClick={createLoad}
              className="mt-4 w-full px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md">
              + Create Load
            </button>
          </div>

          {/* Loads List */}
          <div className="space-y-4">
            {loads.map(load => (
              <div key={load.id} className="bg-white shadow-md rounded-lg p-4">
                <h3 className="text-lg font-bold mb-2">
                  Load #{load.id} – {load.status}
                </h3>
                <p><strong>Pickups:</strong> {load.pickup.map((p, i) => `${i + 1}. ${p.address}`).join(", ")}</p>
                <p><strong>Dropoff:</strong> {load.dropoff.address}</p>
                <p><strong>Driver:</strong> {load.driverPhone}</p>

                {/* Timeline */}
                <h4 className="mt-3 font-semibold">Timeline:</h4>
                <div className="space-y-2">
                  {load.events?.sort((a, b) => a.ts - b.ts).map((ev, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className={`p-2 rounded-full ${ev.type !== "Pending" ? "bg-green-500" : "bg-red-500"}`}></span>
                      <span>{ev.meta?.city || ev.meta?.address || ev.type}</span>
                      <span className="text-gray-500 text-sm ml-auto">{new Date(ev.ts).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>

                {/* Tracking controls */}
                <div className="mt-3 flex gap-2 flex-wrap">
                  <input type="text" placeholder="Add another pickup"
                    value={extraPickups[load.id] || ""}
                    onChange={e => setExtraPickups(prev => ({ ...prev, [load.id]: e.target.value }))}
                    className="border rounded p-1 flex-1" />
                  <button onClick={() => addPickup(load.id)}
                    className="px-3 py-1 bg-yellow-500 text-white rounded">Add Pickup</button>

                  {!load.trackingUrl ? (
                    <button onClick={() => confirmLoad(load.id)}
                      className="px-3 py-1 bg-green-600 text-white rounded">
                      Start Tracking
                    </button>
                  ) : (
                    <p className="mt-2 text-blue-600 break-all">
                      Tracking Link: <a href={load.trackingUrl} target="_blank" rel="noreferrer">{load.trackingUrl}</a>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Map */}
        <div className="bg-white shadow-md rounded-lg p-4">
          <div ref={mapRef} style={{ height: "100vh", width: "100%", border: "1px solid #ccc" }} />
        </div>
      </div>
    </main>
  );
}
