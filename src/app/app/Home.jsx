'use client';
import React, { useState } from "react";
import { useRouter } from 'next/navigation';
import "./Home.css";

export default function Home() {
  const router = useRouter();
  const [showCreateLoad, setShowCreateLoad] = useState(false);

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <button className="menu-btn">☰</button>
        </div>

        <div className="users-section">
          <span className="users-icon">👥</span>
          <span className="users-label">Users</span>
          <button className="add-btn">+</button>
        </div>

        <div className="user-list">
          <div className="user-item">
            <span>All</span>
            <span className="count">0</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Search & Track */}
        <div className="top-bar">
          <input type="text" placeholder="Search" className="search-input" />
          <button className="track-btn" onClick={() => router.push('/dashboard')}>Track</button>
          <button className="edit-btn">✎</button>
        </div>

        {/* Start Tracking Card */}
        <div className="tracking-card">
          <h2>Start Tracking</h2>
          {!showCreateLoad ? (
            <button className="track-new-btn" onClick={() => setShowCreateLoad(true)}>Same Page</button>
          ) : (
            <button className="track-new-btn" onClick={() => router.push('/TrackNewLoad')}>Create Load</button>
          )}
        </div>

        {/* Status Section */}
        <div className="status-list">
          <div className="status-item">
            <span>Active</span>
            <span>0 ⌄</span>
          </div>
          <div className="status-item">
            <span>Pending</span>
            <span>0 ⌄</span>
          </div>
          <div className="status-item">
            <span>Archived</span>
            <span>›</span>
          </div>
        </div>
      </main>
    </div>
  );
}
