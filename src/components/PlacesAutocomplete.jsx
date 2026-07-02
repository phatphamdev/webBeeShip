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

const GOONG_API_KEY = import.meta.env.VITE_GOONG_API_KEY;

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
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* ── Parse tọa độ DMS: "9°38'24.8"N 105°58'08.2"E" → {lat, lng} ── */
  const parseDMS = (text) => {
    // Hỗ trợ ký tự °, ′, ″, ', ", và dạng viết tắt
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
    // Kiểm tra range hợp lệ
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  };

  const handleChange = (e) => {
    const text = e.target.value;
    onChange(text);

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
        // Người dùng nhập tọa độ → dùng Reverse Geocode V2 trực tiếp
        setLoading(true);
        setSuggestions([]);
        setOpen(false);
        try {
          const response = await fetch(
            `https://rsapi.goong.io/v2/geocode?latlng=${coords.lat},${coords.lng}&api_key=${GOONG_API_KEY}`
          );
          const data = await response.json();
          if (data.results && data.results.length > 0) {
            const address = data.results[0].formatted_address || `${coords.lat}, ${coords.lng}`;
            onChange(address);
            onPlaceSelected({ lat: coords.lat, lng: coords.lng, address });
          }
        } catch (error) {
          console.error('Reverse Geocode V2 từ tọa độ thất bại:', error);
        } finally {
          setLoading(false);
        }
        return;
      }

      // Không phải tọa độ → autocomplete bình thường
      setLoading(true);
      try {
        const response = await fetch(
          `https://rsapi.goong.io/Place/AutoComplete?api_key=${GOONG_API_KEY}&input=${encodeURIComponent(text)}`
        );
        const data = await response.json();
          
        if (data.status === 'OK' && data.predictions && data.predictions.length > 0) {
          setSuggestions(data.predictions);
          setOpen(true);
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
    }, 400);
  };

  /* ── Forward Geocode V2: địa chỉ → tọa độ ──────────────── */
  const forwardGeocode = async (address) => {
    const response = await fetch(
      `https://rsapi.goong.io/v2/geocode?address=${encodeURIComponent(address)}&api_key=${GOONG_API_KEY}`
    );
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      const loc = data.results[0].geometry.location;
      const formattedAddress = data.results[0].formatted_address || address;
      return { lat: loc.lat, lng: loc.lng, address: formattedAddress };
    }
    return null;
  };

  /* ── Reverse Geocode V2: tọa độ → địa chỉ ──────────────── */
  const reverseGeocode = async (lat, lng) => {
    const response = await fetch(
      `https://rsapi.goong.io/v2/geocode?latlng=${lat},${lng}&api_key=${GOONG_API_KEY}`
    );
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      return data.results[0].formatted_address || `${lat}, ${lng}`;
    }
    return `${lat}, ${lng}`;
  };

  const handleSelect = async (suggestion) => {
    setLoading(true);
    try {
      let lat = null;
      let lng = null;
      let address = suggestion.description;

      // Bước 1: Forward Geocode V2 – dùng description của suggestion để lấy tọa độ
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

      // Bước 2: Fallback – Place Detail V2 nếu Forward Geocode không trả về kết quả
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

      // Bước 3: Reverse Geocode V2 – nếu đã có tọa độ, xác nhận lại địa chỉ chính xác
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
      }

      setOpen(false);
      setSuggestions([]);
    } catch (error) {
      console.error('Lỗi khi xử lý địa điểm:', error);
    } finally {
      setLoading(false);
    }
  };

  const Icon = type === 'origin' ? LocationOnRoundedIcon : FlagRoundedIcon;
  const iconColor = type === 'origin' ? '#06b6d4' : '#f59e0b';

  return (
    <Box ref={containerRef} sx={{ position: 'relative' }}>
      <TextField
        fullWidth
        label={label}
        value={value}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
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
    </Box>
  );
}
