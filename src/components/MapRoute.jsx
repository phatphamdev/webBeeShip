import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon bị mất khi dùng với Vite/Webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Icon tùy chỉnh màu Amber cho điểm đón
const originIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const destIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DEFAULT_CENTER = [10.7769, 106.7009]; // TP. HCM

// Component phụ để tự động fit bounds khi có route
function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length >= 2) {
      map.fitBounds(positions, { padding: [40, 40] });
    }
  }, [positions, map]);
  return null;
}

/**
 * MapRoute – dùng Leaflet + OpenStreetMap (miễn phí, không cần API key)
 * Tính đường đi qua OSRM (Open Source Routing Machine) API
 *
 * @prop {{ lat, lng }} origin
 * @prop {{ lat, lng }} destination
 * @prop {function} onRouteResult – callback({ distance_km, duration_min })
 */
export default function MapRoute({ origin, destination, onRouteResult }) {
  const [routePoints, setRoutePoints] = useState([]); // mảng [lat, lng] cho Polyline
  const [routeError, setRouteError] = useState('');
  const [loadingRoute, setLoadingRoute] = useState(false);

  // Gọi OSRM để lấy tuyến đường thực tế
  useEffect(() => {
    if (!origin || !destination) {
      setRoutePoints([]);
      setRouteError('');
      onRouteResult && onRouteResult(null);
      return;
    }

    setLoadingRoute(true);
    setRouteError('');

    // OSRM public API – hoàn toàn miễn phí
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
      `?overview=full&geometries=geojson&steps=false`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.code !== 'Ok' || !data.routes?.length) {
          setRouteError('Không tìm được đường đi giữa hai địa điểm này.');
          setRoutePoints([]);
          onRouteResult && onRouteResult(null);
          return;
        }

        const route = data.routes[0];
        // GeoJSON coordinates là [lng, lat] → đổi thành [lat, lng] cho Leaflet
        const points = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        setRoutePoints(points);

        const distance_km = route.distance / 1000;
        const duration_min = Math.ceil(route.duration / 60);
        onRouteResult && onRouteResult({ distance_km, duration_min });
      })
      .catch(() => {
        setRouteError('Lỗi kết nối đến dịch vụ tính đường đi. Vui lòng thử lại.');
        setRoutePoints([]);
        onRouteResult && onRouteResult(null);
      })
      .finally(() => setLoadingRoute(false));
  }, [origin, destination]);

  const markerPositions =
    routePoints.length >= 2 ? [routePoints[0], routePoints[routePoints.length - 1]] : null;

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative', borderRadius: 3, overflow: 'hidden' }}>
      {/* Loading overlay */}
      {loadingRoute && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(15,15,20,0.6)',
            backdropFilter: 'blur(4px)',
            borderRadius: 3,
          }}
        >
          <Box sx={{ textAlign: 'center', color: '#f1f0ef' }}>
            <CircularProgress sx={{ color: 'primary.main', mb: 1 }} size={32} />
            <Typography variant="caption" display="block" color="text.secondary">
              Đang tính tuyến đường...
            </Typography>
          </Box>
        </Box>
      )}

      {/* Error alert */}
      {routeError && (
        <Box sx={{ position: 'absolute', top: 8, left: 8, right: 8, zIndex: 1000 }}>
          <Alert severity="warning" sx={{ fontSize: '0.8rem' }}>
            {routeError}
          </Alert>
        </Box>
      )}

      {/* Leaflet Map */}
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={12}
        style={{ width: '100%', height: '100%', minHeight: 350, borderRadius: 12 }}
        zoomControl={true}
        attributionControl={true}
      >
        {/* OpenStreetMap tiles – hoàn toàn miễn phí */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />

        {/* Route polyline màu Amber */}
        {routePoints.length > 1 && (
          <Polyline
            positions={routePoints}
            pathOptions={{
              color: '#f59e0b',
              weight: 5,
              opacity: 0.9,
              lineJoin: 'round',
              lineCap: 'round',
            }}
          />
        )}

        {/* Marker điểm đón */}
        {origin && (
          <Marker position={[origin.lat, origin.lng]} icon={originIcon}>
            <Popup>
              <strong>📍 Điểm đón</strong><br />
              {origin.address?.split(',').slice(0, 2).join(',')}
            </Popup>
          </Marker>
        )}

        {/* Marker điểm đến */}
        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={destIcon}>
            <Popup>
              <strong>🏁 Điểm đến</strong><br />
              {destination.address?.split(',').slice(0, 2).join(',')}
            </Popup>
          </Marker>
        )}

        {/* Tự động zoom vào route */}
        {markerPositions && <FitBounds positions={routePoints} />}
      </MapContainer>

      {/* Overlay hint khi chưa có địa chỉ */}
      {!origin && !destination && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            bgcolor: 'rgba(26,26,36,0.85)',
            backdropFilter: 'blur(8px)',
            borderRadius: 2,
            px: 3,
            py: 1.5,
            border: '1px solid rgba(241,240,239,0.1)',
            pointerEvents: 'none',
            textAlign: 'center',
            zIndex: 1000,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            📍 Nhập điểm đón và điểm đến để hiển thị lộ trình
          </Typography>
        </Box>
      )}
    </Box>
  );
}
