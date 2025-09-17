'use client';
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import io from "socket.io-client";

const socket = io("http://localhost:4000");

export default function TrackPage() {
  const { id } = useParams(); // loadId from URL
  const mapRef = useRef(null);
  const truckMarkerRef = useRef(null);
  const routePolylineRef = useRef(null);
  const [load, setLoad] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initMap = async () => {
      const res = await fetch(`http://localhost:4000/api/loads`);
      const allLoads = await res.json();
      const found = allLoads.find(l => l.id === Number(id));
      setLoad(found);
      if (!found) return;

      // Map center
      const center = found.pickup[0]?.lat
        ? { lat: found.pickup[0].lat, lng: found.pickup[0].lng }
        : { lat: 28.6139, lng: 77.209 }; // Default Delhi

      const map = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 12,
      });

      // Pickup markers
      found.pickup.forEach((p, idx) => {
        if (p.lat && p.lng) {
          new window.google.maps.Marker({
            position: { lat: p.lat, lng: p.lng },
            map,
            label: `${idx + 1}`,
            title: `Pickup ${idx + 1}: ${p.address}`,
          });
        }
      });

      // Dropoff marker
      if (found.dropoff.lat && found.dropoff.lng) {
        new window.google.maps.Marker({
          position: { lat: found.dropoff.lat, lng: found.dropoff.lng },
          map,
          label: "D",
          title: `Dropoff: ${found.dropoff.address}`,
        });
      }

      // Polyline route
      const routePath = [
        ...found.pickup.map(p => ({ lat: p.lat, lng: p.lng })),
        { lat: found.dropoff.lat, lng: found.dropoff.lng }
      ];

      routePolylineRef.current = new window.google.maps.Polyline({
        path: routePath,
        geodesic: true,
        strokeColor: "#FF0000",
        strokeOpacity: 0.8,
        strokeWeight: 3,
        map,
      });

      // Truck marker
      const initialPos = found.locations[0]
        ? { lat: found.locations[0].lat, lng: found.locations[0].lng }
        : routePath[0];

      truckMarkerRef.current = new window.google.maps.Marker({
        position: initialPos,
        map,
        title: `Truck for Load #${id}${found.locations[0]?.city ? ` – ${found.locations[0].city}` : ""}`,
        icon: {
          path: "M12 2C8.13 2 5 5.13 5 9c0 1.63.65 3.12 1.7 4.2L12 22l5.3-8.8C18.35 12.12 19 10.63 19 9c0-3.87-3.13-7-7-7z",
          fillColor: "#0000FF",
          fillOpacity: 1,
          scale: 1.5,
          strokeWeight: 0,
        },
      });
    };

    // Load Google Maps script once
    if (window.google && window.google.maps) {
      initMap();
    } else if (!document.getElementById("google-maps-script")) {
      const script = document.createElement("script");
      script.id = "google-maps-script";
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyCnMo9hEXw5QQTNAkXCxEan0QUT1oXNL00&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = initMap;
      document.body.appendChild(script);
    }
  }, [id]);

  // Listen for live location updates
  useEffect(() => {
    socket.on("locationBroadcast", ({ loadId, loc }) => {
      if (Number(loadId) !== Number(id) || !truckMarkerRef.current) return;

      const newPos = { lat: loc.lat, lng: loc.lng };
      truckMarkerRef.current.setPosition(newPos);
      truckMarkerRef.current.setTitle(`Truck for Load #${id} – ${loc.city}`);
      truckMarkerRef.current.getMap().panTo(newPos);

      // Extend polyline path dynamically
      if (routePolylineRef.current) {
        const path = routePolylineRef.current.getPath();
        path.push(newPos);
      }
    });

    return () => socket.off("locationBroadcast");
  }, [id]);

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <h1 style={{ textAlign: "center", margin: "10px 0" }}>
        🚚 Tracking Load #{id}
      </h1>
      <div
        ref={mapRef}
        style={{ height: "90%", width: "100%", border: "1px solid #ccc" }}
      />
    </div>
  );
}
