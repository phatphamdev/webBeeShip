import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { GoogleMap, Marker, DirectionsRenderer, useJsApiLoader } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const LIBRARIES = ['places', 'directions'];

const DEFAULT_CENTER = { lat: 10.7769, lng: 106.7009 }; // TP. HCM

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a24' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a0a0b0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a24' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b5563' }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#374151' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d3748' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#374151' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2937' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#252535' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#212132' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1e1e2e' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1923' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d4654' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1e2233' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a2a1a' }] },
];

/**
 * MapRoute – dùng Google Maps JavaScript API + Directions API
 * Tự động tính đường đi thực tế và trả về distance_km, duration_min
 *
 * @prop {{ lat, lng, address }} origin
 * @prop {{ lat, lng, address }} destination
 * @prop {function} onRouteResult – callback({ distance_km, duration_min })
 */
export default function MapRoute({ origin, destination, onRouteResult }) {
  const [directions, setDirections] = useState(null);
  const [routeError, setRouteError] = useState('');
  const [loadingRoute, setLoadingRoute] = useState(false);
  const mapRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  // Tính tuyến đường khi có điểm đón và điểm đến
  useEffect(() => {
    if (!isLoaded || !origin || !destination) {
      setDirections(null);
      setRouteError('');
      onRouteResult && onRouteResult(null);
      return;
    }

    setLoadingRoute(true);
    setRouteError('');

    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route(
      {
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        travelMode: window.google.maps.TravelMode.DRIVING,
        region: 'VN',
      },
      (result, status) => {
        setLoadingRoute(false);
        if (status === window.google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
          const leg = result.routes[0].legs[0];
          const distance_km = leg.distance.value / 1000;
          const duration_min = Math.ceil(leg.duration.value / 60);
          onRouteResult && onRouteResult({ distance_km, duration_min });
        } else {
          setDirections(null);
          setRouteError('Không tìm được đường đi giữa hai địa điểm này.');
          onRouteResult && onRouteResult(null);
        }
      }
    );
  }, [isLoaded, origin, destination]);

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  // Tính bounds để fit map theo origin/destination
  useEffect(() => {
    if (!mapRef.current || !origin || !destination) return;
    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend({ lat: origin.lat, lng: origin.lng });
    bounds.extend({ lat: destination.lat, lng: destination.lng });
    mapRef.current.fitBounds(bounds, { top: 60, right: 40, bottom: 40, left: 40 });
  }, [origin, destination]);

  if (loadError) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          minHeight: 350,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 3,
          bgcolor: 'rgba(26,26,36,0.9)',
        }}
      >
        <Alert severity="error">
          Lỗi tải Google Maps. Vui lòng kiểm tra API key.
        </Alert>
      </Box>
    );
  }

  if (!isLoaded) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          minHeight: 350,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 3,
          bgcolor: 'rgba(26,26,36,0.9)',
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress sx={{ color: 'primary.main', mb: 1 }} size={32} />
          <Typography variant="caption" display="block" color="text.secondary">
            Đang tải Google Maps...
          </Typography>
        </Box>
      </Box>
    );
  }

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
      {/* Loading overlay khi đang tính tuyến đường */}
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

      {/* Google Map */}
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%', minHeight: 350, borderRadius: 12 }}
        center={DEFAULT_CENTER}
        zoom={12}
        onLoad={onMapLoad}
        options={{
          styles: MAP_STYLES,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: 'cooperative',
        }}
      >
        {/* Vẽ tuyến đường thực tế từ Google Directions */}
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: false,
              polylineOptions: {
                strokeColor: '#f59e0b',
                strokeWeight: 5,
                strokeOpacity: 0.9,
              },
            }}
          />
        )}

        {/* Markers khi chưa có tuyến đường */}
        {!directions && origin && (
          <Marker
            position={{ lat: origin.lat, lng: origin.lng }}
            label={{ text: 'A', color: '#fff', fontWeight: 'bold' }}
            title={`📍 Điểm đón: ${origin.address}`}
          />
        )}
        {!directions && destination && (
          <Marker
            position={{ lat: destination.lat, lng: destination.lng }}
            label={{ text: 'B', color: '#fff', fontWeight: 'bold' }}
            title={`🏁 Điểm đến: ${destination.address}`}
          />
        )}
      </GoogleMap>

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
