import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const GOONG_API_KEY = import.meta.env.VITE_GOONG_API_KEY;
const DEFAULT_CENTER = [10.7769, 106.7009]; // TP. HCM

// Decode polyline từ Goong Directions API
function decodePolyline(str, precision = 5) {
  let index = 0, lat = 0, lng = 0, coordinates = [], shift = 0, result = 0, byte = null, lat_change, lng_change, factor = Math.pow(10, precision);
  while (index < str.length) {
    byte = null; shift = 0; result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
    shift = result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += lat_change; lng += lng_change;
    coordinates.push([lat / factor, lng / factor]);
  }
  return coordinates;
}

// Cấu hình icon marker mặc định của Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Component con để fit bounds bản đồ
function MapFitBounds({ origin, destination }) {
  const map = useMap();
  
  const originLat = origin?.lat;
  const originLng = origin?.lng;
  const destLat = destination?.lat;
  const destLng = destination?.lng;

  useEffect(() => {
    if (originLat && originLng && destLat && destLng) {
      const bounds = L.latLngBounds([
        [originLat, originLng],
        [destLat, destLng]
      ]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (originLat && originLng) {
      map.setView([originLat, originLng], 15);
    } else if (destLat && destLng) {
      map.setView([destLat, destLng], 15);
    }
  }, [originLat, originLng, destLat, destLng, map]);

  return null;
}

export default function MapRoute({ origin, destination, onRouteResult, waypoints = [] }) {
  const [routePath, setRoutePath] = useState([]);
  const [routeError, setRouteError] = useState('');
  const [loadingRoute, setLoadingRoute] = useState(false);

  const onRouteResultRef = useRef(onRouteResult);
  
  useEffect(() => {
    onRouteResultRef.current = onRouteResult;
  }, [onRouteResult]);

  const originLat = origin?.lat;
  const originLng = origin?.lng;
  const destLat = destination?.lat;
  const destLng = destination?.lng;
  const waypointsStr = JSON.stringify(waypoints);

  // Tính tuyến đường khi có điểm đón và điểm đến sử dụng Goong API V2
  useEffect(() => {
    if (!originLat || !originLng || !destLat || !destLng) {
      setRoutePath([]);
      setRouteError('');
      if (onRouteResultRef.current) onRouteResultRef.current(null);
      return;
    }

    const fetchRoute = async () => {
      setLoadingRoute(true);
      setRouteError('');

      try {
        let routeData = null;
        let decodedPath = [];
        let distance_km = 0;
        let duration_min = 0;

        const wps = JSON.parse(waypointsStr);

        // Nếu có nhiều hơn 2 điểm (origin + destination + waypoints), dùng Trip v2 API để tối ưu
        if (wps.length > 0) {
          const locs = [
            `${originLat},${originLng}`,
            ...wps.map(w => `${w.lat},${w.lng}`),
            `${destLat},${destLng}`
          ].join(';');
          
          const response = await fetch(
            `https://rsapi.goong.io/v2/trip?locations=${locs}&vehicle=bike&api_key=${GOONG_API_KEY}`
          );
          const data = await response.json();
          if (data.trips && data.trips.length > 0) {
            const trip = data.trips[0];
            distance_km = trip.distance / 1000;
            duration_min = Math.ceil(trip.duration / 60);
            decodedPath = decodePolyline(trip.geometry);
            routeData = trip;
          }
        } else {
          // Chỉ có origin và destination
          // 1. Gọi Distance Matrix API v2 để tính toán khoảng cách/thời gian cực kì chính xác
          const dmResponse = await fetch(
            `https://rsapi.goong.io/v2/distancematrix?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&vehicle=bike&api_key=${GOONG_API_KEY}`
          );
          const dmData = await dmResponse.json();
          if (dmData.rows && dmData.rows.length > 0 && dmData.rows[0].elements[0].status === 'OK') {
            const element = dmData.rows[0].elements[0];
            distance_km = element.distance.value / 1000;
            duration_min = Math.ceil(element.duration.value / 60);
          }

          // 2. Gọi Directions API v2 để lấy polyline vẽ lên bản đồ
          const response = await fetch(
            `https://rsapi.goong.io/v2/direction?origin=${originLat},${originLng}&destination=${destLat},${destLng}&vehicle=bike&api_key=${GOONG_API_KEY}`
          );
          const data = await response.json();

          if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            
            // Nếu Distance Matrix lỗi, fallback dùng distance của Direction
            if (distance_km === 0) {
              const leg = route.legs[0];
              distance_km = leg.distance.value / 1000;
              duration_min = Math.ceil(leg.duration.value / 60);
            }
            
            // Giải mã overview_polyline
            const encodedPolyline = route.overview_polyline.points;
            decodedPath = decodePolyline(encodedPolyline);
            routeData = route;
          }
        }

        if (routeData && decodedPath.length > 0) {
          setRoutePath(decodedPath);
          if (onRouteResultRef.current) onRouteResultRef.current({ distance_km, duration_min });
        } else {
          setRoutePath([]);
          setRouteError('Không tìm được đường đi bộ/xe máy giữa các địa điểm này.');
          if (onRouteResultRef.current) onRouteResultRef.current(null);
        }
      } catch (error) {
        console.error('Lỗi tính đường đi Goong API V2:', error);
        setRoutePath([]);
        setRouteError('Đã xảy ra lỗi khi tính toán đường đi.');
        if (onRouteResultRef.current) onRouteResultRef.current(null);
      } finally {
        setLoadingRoute(false);
      }
    };

    fetchRoute();
  }, [originLat, originLng, destLat, destLng, waypointsStr]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
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

      {routeError && (
        <Box sx={{ position: 'absolute', top: 8, left: 8, right: 8, zIndex: 1000 }}>
          <Alert severity="warning" sx={{ fontSize: '0.8rem' }}>
            {routeError}
          </Alert>
        </Box>
      )}

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={12}
        style={{ width: '100%', height: '100%', minHeight: 350, zIndex: 1 }}
        zoomControl={true}
      >
        {/* Sửa lại bản đồ sáng màu hơn để thấy rõ địa điểm, dễ quan sát giao thông */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        
        <MapFitBounds origin={origin} destination={destination} />

        {routePath.length > 0 && (
          <Polyline 
            positions={routePath} 
            color="#2563eb" 
            weight={5} 
            opacity={0.8} 
          />
        )}

        {origin && (
          <Marker position={[origin.lat, origin.lng]} />
        )}
        
        {destination && (
          <Marker position={[destination.lat, destination.lng]} />
        )}
        
        {waypoints && waypoints.map((wp, idx) => (
          <Marker key={idx} position={[wp.lat, wp.lng]} />
        ))}
      </MapContainer>

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
