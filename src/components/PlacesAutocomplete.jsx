import React, { useState, useEffect, useRef } from 'react';
import { useLoadScript } from '@react-google-maps/api';
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

// Khai báo mảng libraries bên ngoài component để tránh re-render liên tục
const libraries = ['places'];

/**
 * PlacesAutocomplete – Sử dụng Google Maps Places API để gợi ý địa chỉ
 */
export default function PlacesAutocomplete({
  label,
  value,
  onChange,
  onPlaceSelected,
  type = 'origin',
}) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries,
    language: 'vi',
    region: 'VN',
  });

  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  
  const autocompleteService = useRef(null);
  const placesService = useRef(null);
  const sessionToken = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  // Khởi tạo các service của Google Maps khi script load xong
  useEffect(() => {
    if (isLoaded && !loadError && !autocompleteService.current) {
      autocompleteService.current = new window.google.maps.places.AutocompleteService();
      // PlacesService cần một DOM element dummy
      placesService.current = new window.google.maps.places.PlacesService(document.createElement('div'));
      sessionToken.current = new window.google.maps.places.AutocompleteSessionToken();
    }
  }, [isLoaded, loadError]);

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

  const fetchSuggestions = (inputText) => {
    if (!autocompleteService.current) return;
    
    setLoading(true);
    autocompleteService.current.getPlacePredictions(
      {
        input: inputText,
        sessionToken: sessionToken.current,
        componentRestrictions: { country: 'vn' }, // Giới hạn ở Việt Nam
      },
      (predictions, status) => {
        setLoading(false);
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestions(predictions);
          setOpen(true);
        } else {
          setSuggestions([]);
          setOpen(false);
        }
      }
    );
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

    // Debounce API calls (tránh gọi API quá nhiều khi gõ nhanh)
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(text);
    }, 400);
  };

  const handleSelect = (suggestion) => {
    const address = suggestion.description;
    onChange(address);
    setOpen(false);
    setSuggestions([]);

    if (!placesService.current) return;

    // Gọi API getDetails để lấy tọa độ (Lat/Lng) của địa điểm vừa chọn
    placesService.current.getDetails(
      {
        placeId: suggestion.place_id,
        fields: ['geometry', 'name', 'formatted_address'],
        sessionToken: sessionToken.current,
      },
      (place, status) => {
        // Tái tạo session token mới sau khi đã kết thúc 1 phiên tìm kiếm
        sessionToken.current = new window.google.maps.places.AutocompleteSessionToken();
        
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          onPlaceSelected({
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            address: place.formatted_address || address,
          });
        }
      }
    );
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

      {loadError && (
        <Typography variant="caption" color="error" sx={{ position: 'absolute', bottom: -20, left: 0 }}>
          Lỗi tải Google Maps API
        </Typography>
      )}

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
            {suggestions.map((item) => {
              const primaryText = item.structured_formatting.main_text;
              const secondaryText = item.structured_formatting.secondary_text;
              
              return (
                <ListItem key={item.place_id} disablePadding>
                  <ListItemButton
                    onClick={() => handleSelect(item)}
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
                          {primaryText}
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
