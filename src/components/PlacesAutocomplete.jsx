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

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

/**
 * PlacesAutocomplete – dùng Google Places Autocomplete API
 * Requires VITE_GOOGLE_MAPS_API_KEY in .env
 */
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
  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const sessionTokenRef = useRef(null);

  // Khởi tạo Google Places service khi API đã load
  useEffect(() => {
    function initServices() {
      if (
        window.google?.maps?.places?.AutocompleteService &&
        !autocompleteServiceRef.current
      ) {
        autocompleteServiceRef.current =
          new window.google.maps.places.AutocompleteService();
        // PlacesService cần một DOM element để hiển thị attributions
        const dummyDiv = document.createElement('div');
        placesServiceRef.current = new window.google.maps.places.PlacesService(dummyDiv);
        sessionTokenRef.current =
          new window.google.maps.places.AutocompleteSessionToken();
      }
    }

    // Nếu Google Maps script đã load sẵn
    initServices();

    // Lắng nghe sự kiện khi script load xong
    const interval = setInterval(() => {
      if (window.google?.maps?.places) {
        initServices();
        clearInterval(interval);
      }
    }, 300);

    return () => clearInterval(interval);
  }, []);

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

  const handleChange = (e) => {
    const text = e.target.value;
    onChange(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      if (!autocompleteServiceRef.current) {
        setSuggestions([]);
        return;
      }

      setLoading(true);

      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: text,
          sessionToken: sessionTokenRef.current,
          componentRestrictions: { country: 'vn' }, // Giới hạn Việt Nam
          types: ['geocode', 'establishment'],
        },
        (predictions, status) => {
          setLoading(false);
          if (
            status === window.google.maps.places.PlacesServiceStatus.OK &&
            predictions
          ) {
            setSuggestions(predictions);
            setOpen(predictions.length > 0);
          } else {
            setSuggestions([]);
            setOpen(false);
          }
        }
      );
    }, 300);
  };

  const handleSelect = (prediction) => {
    if (!placesServiceRef.current) return;

    setLoading(true);
    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        sessionToken: sessionTokenRef.current,
        fields: ['geometry', 'formatted_address', 'name'],
      },
      (place, status) => {
        setLoading(false);
        if (
          status === window.google.maps.places.PlacesServiceStatus.OK &&
          place?.geometry?.location
        ) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const address = place.formatted_address || prediction.description;

          onChange(address);
          onPlaceSelected({ lat, lng, address });

          // Tạo session token mới cho lần tìm kiếm tiếp theo
          sessionTokenRef.current =
            new window.google.maps.places.AutocompleteSessionToken();
        }
        setOpen(false);
        setSuggestions([]);
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
            {suggestions.map((prediction, idx) => (
              <ListItem key={prediction.place_id || idx} disablePadding>
                <ListItemButton
                  onClick={() => handleSelect(prediction)}
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
                        {prediction.structured_formatting?.main_text ||
                          prediction.description.split(',')[0]}
                      </Typography>
                    }
                    secondary={
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{ color: 'text.secondary', display: 'block' }}
                      >
                        {prediction.structured_formatting?.secondary_text ||
                          prediction.description.split(',').slice(1, 4).join(',')}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>

          {/* Google attribution bắt buộc */}
          <Box
            sx={{
              px: 1.5,
              py: 0.75,
              borderTop: '1px solid rgba(241,240,239,0.05)',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <img
              src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-non-white.png"
              alt="Powered by Google"
              style={{ height: 14, opacity: 0.6 }}
            />
          </Box>
        </Paper>
      )}
    </Box>
  );
}
