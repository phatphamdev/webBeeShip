import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress,
  Typography,
} from '@mui/material';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';

const GOONG_API_KEY = import.meta.env.VITE_GOONG_API_KEY;

/* ── Cache helpers (localStorage) ────────────────────────── */
const CACHE_KEYS = {
  AUTOCOMPLETE: 'beeship_autocomplete_cache',
  GEOCODE: 'beeship_geocode_cache',
  RECENT: 'beeship_recent_places',
};
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 ngày
const MAX_RECENT = 15;
const MAX_CACHE_ENTRIES = 200;

function getCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Xoá entry hết hạn
    const now = Date.now();
    const cleaned = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v._ts && now - v._ts < CACHE_TTL) {
        cleaned[k] = v;
      }
    }
    return cleaned;
  } catch {
    return {};
  }
}

function setCache(key, cacheObj) {
  try {
    // Giới hạn số lượng entry
    const entries = Object.entries(cacheObj);
    if (entries.length > MAX_CACHE_ENTRIES) {
      entries.sort((a, b) => (b[1]._ts || 0) - (a[1]._ts || 0));
      cacheObj = Object.fromEntries(entries.slice(0, MAX_CACHE_ENTRIES));
    }
    localStorage.setItem(key, JSON.stringify(cacheObj));
  } catch {
    // localStorage full → xoá cache cũ
    try { localStorage.removeItem(key); } catch {}
  }
}

function getRecentPlaces() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEYS.RECENT)) || [];
  } catch {
    return [];
  }
}

function saveRecentPlace(place) {
  try {
    let recents = getRecentPlaces();
    // Xoá trùng lặp (theo address)
    recents = recents.filter((r) => r.address !== place.address);
    recents.unshift({ ...place, _ts: Date.now() });
    if (recents.length > MAX_RECENT) recents = recents.slice(0, MAX_RECENT);
    localStorage.setItem(CACHE_KEYS.RECENT, JSON.stringify(recents));
  } catch {}
}

/* ── Sóc Trăng bias ─────────────────────────────────────── */
const SOC_TRANG_LOCATION = '9.6025,105.9739';
const SOC_TRANG_RADIUS = 30000; // 30km

export default function PlacesAutocomplete({
  label,
  value,
  onChange,
  onPlaceSelected,
  type = 'origin',
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setShowRecent(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* ── Parse tọa độ DMS: "9°38'24.8"N 105°58'08.2"E" → {lat, lng} ── */
  const parseDMS = (text) => {
    const dmsRegex =
      /(\d+)[°º]\s*(\d+)[''′]\s*([\d.]+)["""″]?\s*([NSns])\s*[,\s]\s*(\d+)[°º]\s*(\d+)[''′]\s*([\d.]+)["""″]?\s*([EWew])/;
    const match = text.trim().match(dmsRegex);
    if (!match) return null;
    const [, dLat, mLat, sLat, dirLat, dLng, mLng, sLng, dirLng] = match;
    let lat = parseFloat(dLat) + parseFloat(mLat) / 60 + parseFloat(sLat) / 3600;
    let lng = parseFloat(dLng) + parseFloat(mLng) / 60 + parseFloat(sLng) / 3600;
    if (/[Ss]/.test(dirLat)) lat = -lat;
    if (/[Ww]/.test(dirLng)) lng = -lng;
    return { lat, lng };
  };

  /* ── Parse tọa độ Decimal: "9.6402, 105.9689" → {lat, lng} ── */
  const parseDecimal = (text) => {
    const decimalRegex = /^(-?\d{1,3}\.?\d*)\s*[,\s]\s*(-?\d{1,3}\.?\d*)$/;
    const match = text.trim().match(decimalRegex);
    if (!match) return null;
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  };

  const handleChange = (e) => {
    const text = e.target.value;
    onChange(text);
    setShowRecent(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      // Ưu tiên: kiểm tra có phải tọa độ DMS hoặc Decimal không
      const coordsDMS = parseDMS(text);
      const coordsDecimal = !coordsDMS ? parseDecimal(text) : null;
      const coords = coordsDMS || coordsDecimal;

      if (coords) {
        setLoading(true);
        setSuggestions([]);
        setOpen(false);
        try {
          // Kiểm cache reverse geocode
          const cacheKey = `${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`;
          const geoCache = getCache(CACHE_KEYS.GEOCODE);
          if (geoCache[cacheKey]) {
            const cached = geoCache[cacheKey];
            onChange(cached.address);
            onPlaceSelected({ lat: coords.lat, lng: coords.lng, address: cached.address });
            setLoading(false);
            return;
          }

          const response = await fetch(
            `https://rsapi.goong.io/v2/geocode?latlng=${coords.lat},${coords.lng}&api_key=${GOONG_API_KEY}`
          );
          const data = await response.json();
          if (data.results && data.results.length > 0) {
            const address = data.results[0].formatted_address || `${coords.lat}, ${coords.lng}`;
            onChange(address);
            onPlaceSelected({ lat: coords.lat, lng: coords.lng, address });

            // Lưu cache
            geoCache[cacheKey] = { address, _ts: Date.now() };
            setCache(CACHE_KEYS.GEOCODE, geoCache);
            saveRecentPlace({ lat: coords.lat, lng: coords.lng, address });
          }
        } catch (error) {
          console.error('Reverse Geocode V2 từ tọa độ thất bại:', error);
        } finally {
          setLoading(false);
        }
        return;
      }

      // Không phải tọa độ → kiểm cache autocomplete trước
      const queryKey = text.trim().toLowerCase();
      const acCache = getCache(CACHE_KEYS.AUTOCOMPLETE);
      if (acCache[queryKey]) {
        setSuggestions(acCache[queryKey].data);
        setOpen(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(
          `https://rsapi.goong.io/Place/AutoComplete?api_key=${GOONG_API_KEY}&input=${encodeURIComponent(text)}&location=${SOC_TRANG_LOCATION}&radius=${SOC_TRANG_RADIUS}`
        );
        const data = await response.json();

        if (data.status === 'OK' && data.predictions && data.predictions.length > 0) {
          setSuggestions(data.predictions);
          setOpen(true);

          // Lưu cache
          acCache[queryKey] = { data: data.predictions, _ts: Date.now() };
          setCache(CACHE_KEYS.AUTOCOMPLETE, acCache);
        } else {
          setSuggestions([]);
          setOpen(false);
        }
      } catch (error) {
        console.error('Error fetching Goong autocomplete suggestions:', error);
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  /* ── Forward Geocode V2 (có cache) ──────────────────────── */
  const forwardGeocode = async (address) => {
    const cacheKey = `fwd:${address.trim().toLowerCase()}`;
    const geoCache = getCache(CACHE_KEYS.GEOCODE);
    if (geoCache[cacheKey]) {
      return geoCache[cacheKey].data;
    }

    const response = await fetch(
      `https://rsapi.goong.io/v2/geocode?address=${encodeURIComponent(address)}&api_key=${GOONG_API_KEY}`
    );
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      const loc = data.results[0].geometry.location;
      const formattedAddress = data.results[0].formatted_address || address;
      const result = { lat: loc.lat, lng: loc.lng, address: formattedAddress };

      // Lưu cache
      geoCache[cacheKey] = { data: result, _ts: Date.now() };
      setCache(CACHE_KEYS.GEOCODE, geoCache);
      return result;
    }
    return null;
  };

  /* ── Reverse Geocode V2 (có cache) ──────────────────────── */
  const reverseGeocode = async (lat, lng) => {
    const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    const geoCache = getCache(CACHE_KEYS.GEOCODE);
    if (geoCache[cacheKey]) {
      return geoCache[cacheKey].address;
    }

    const response = await fetch(
      `https://rsapi.goong.io/v2/geocode?latlng=${lat},${lng}&api_key=${GOONG_API_KEY}`
    );
    const data = await response.json();
    let address = `${lat}, ${lng}`;
    if (data.results && data.results.length > 0) {
      address = data.results[0].formatted_address || address;
    }

    // Lưu cache
    geoCache[cacheKey] = { address, _ts: Date.now() };
    setCache(CACHE_KEYS.GEOCODE, geoCache);
    return address;
  };

  const handleSelect = async (suggestion) => {
    setLoading(true);
    setShowRecent(false);
    try {
      let lat = null;
      let lng = null;
      let address = suggestion.description;

      // Bước 1: Forward Geocode V2
      try {
        const geocoded = await forwardGeocode(suggestion.description);
        if (geocoded) {
          lat = geocoded.lat;
          lng = geocoded.lng;
          address = geocoded.address;
        }
      } catch (e) {
        console.warn('Forward Geocode V2 thất bại, thử Place Detail V2...', e);
      }

      // Bước 2: Fallback – Place Detail V2
      if (lat === null || lng === null) {
        try {
          const response = await fetch(
            `https://rsapi.goong.io/v2/place/detail?api_key=${GOONG_API_KEY}&place_id=${suggestion.place_id}`
          );
          const data = await response.json();
          if (data.status === 'OK' && data.result?.geometry?.location) {
            lat = data.result.geometry.location.lat;
            lng = data.result.geometry.location.lng;
            address = data.result.formatted_address || data.result.name || address;
          }
        } catch (e) {
          console.warn('Place Detail V2 thất bại, thử Reverse Geocode V2...', e);
        }
      }

      // Bước 3: Reverse Geocode V2
      if (lat !== null && lng !== null) {
        try {
          const reversedAddress = await reverseGeocode(lat, lng);
          if (reversedAddress && reversedAddress !== `${lat}, ${lng}`) {
            address = reversedAddress;
          }
        } catch (e) {
          console.warn('Reverse Geocode V2 thất bại, dùng địa chỉ hiện có.', e);
        }
      }

      if (lat !== null && lng !== null) {
        onChange(address);
        onPlaceSelected({ lat, lng, address });
        saveRecentPlace({ lat, lng, address });
      }

      setOpen(false);
      setSuggestions([]);
    } catch (error) {
      console.error('Lỗi khi xử lý địa điểm:', error);
    } finally {
      setLoading(false);
    }
  };

  /* ── Chọn từ lịch sử gần đây ─────────────────────────── */
  const handleSelectRecent = (place) => {
    onChange(place.address);
    onPlaceSelected({ lat: place.lat, lng: place.lng, address: place.address });
    setShowRecent(false);
    setOpen(false);
  };

  /* ── Focus handler: hiện recent nếu input trống ────────── */
  const handleFocus = () => {
    if (suggestions.length > 0) {
      setOpen(true);
    } else if (!value || value.length < 2) {
      const recents = getRecentPlaces();
      if (recents.length > 0) {
        setShowRecent(true);
      }
    }
  };

  const Icon = type === 'origin' ? LocationOnRoundedIcon : FlagRoundedIcon;
  const iconColor = type === 'origin' ? '#06b6d4' : '#f59e0b';
  const recentPlaces = showRecent ? getRecentPlaces() : [];

  return (
    <Box ref={containerRef} sx={{ position: 'relative' }}>
      <TextField
        fullWidth
        size="small"
        label={label}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        placeholder={
          type === 'origin'
            ? 'Nhập địa chỉ đón khách...'
            : 'Nhập địa chỉ điểm đến...'
        }
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Icon sx={{ color: iconColor, fontSize: 20 }} />
              </InputAdornment>
            ),
            endAdornment: loading ? (
              <InputAdornment position="end">
                <CircularProgress size={16} sx={{ color: 'primary.main' }} />
              </InputAdornment>
            ) : null,
          },
        }}
      />

      {/* Dropdown gợi ý autocomplete */}
      {open && suggestions.length > 0 && (
        <Paper
          elevation={8}
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1300,
            mt: 0.5,
            bgcolor: '#1e1e2e',
            border: '1px solid rgba(241,240,239,0.12)',
            borderRadius: 2,
            overflow: 'hidden',
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          <List dense disablePadding>
            {suggestions.map((suggestion, idx) => {
              const mainText = suggestion.structured_formatting?.main_text || suggestion.description;
              const secondaryText = suggestion.structured_formatting?.secondary_text || '';
              return (
                <ListItem key={suggestion.place_id || idx} disablePadding>
                  <ListItemButton
                    onClick={() => handleSelect(suggestion)}
                    sx={{
                      py: 1,
                      px: 1.5,
                      borderBottom: '1px solid rgba(241,240,239,0.05)',
                      '&:hover': { bgcolor: 'rgba(245,158,11,0.08)' },
                    }}
                  >
                    <LocationOnRoundedIcon
                      sx={{ fontSize: 16, color: iconColor, mr: 1, flexShrink: 0 }}
                    />
                    <ListItemText
                      primary={
                        <Typography variant="body2" noWrap sx={{ color: 'text.primary' }}>
                          {mainText}
                        </Typography>
                      }
                      secondary={
                        <Typography
                          variant="caption"
                          noWrap
                          sx={{ color: 'text.secondary', display: 'block' }}
                        >
                          {secondaryText}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Paper>
      )}

      {/* Dropdown lịch sử gần đây */}
      {showRecent && recentPlaces.length > 0 && !open && (
        <Paper
          elevation={8}
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1300,
            mt: 0.5,
            bgcolor: '#1e1e2e',
            border: '1px solid rgba(241,240,239,0.12)',
            borderRadius: 2,
            overflow: 'hidden',
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          <Box sx={{ px: 1.5, py: 0.75, borderBottom: '1px solid rgba(241,240,239,0.08)' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              📍 Địa điểm gần đây
            </Typography>
          </Box>
          <List dense disablePadding>
            {recentPlaces.map((place, idx) => (
              <ListItem key={idx} disablePadding>
                <ListItemButton
                  onClick={() => handleSelectRecent(place)}
                  sx={{
                    py: 0.75,
                    px: 1.5,
                    borderBottom: '1px solid rgba(241,240,239,0.05)',
                    '&:hover': { bgcolor: 'rgba(245,158,11,0.08)' },
                  }}
                >
                  <HistoryRoundedIcon
                    sx={{ fontSize: 15, color: 'text.disabled', mr: 1, flexShrink: 0 }}
                  />
                  <ListItemText
                    primary={
                      <Typography variant="body2" noWrap sx={{ color: 'text.primary', fontSize: '0.82rem' }}>
                        {place.address}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
}
