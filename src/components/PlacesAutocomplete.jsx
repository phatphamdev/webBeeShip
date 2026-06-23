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

/**
 * PlacesAutocomplete – dùng Nominatim (OpenStreetMap) thay Google Places
 * Hoàn toàn miễn phí, không cần API key
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
    if (text.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5&countrycodes=vn&addressdetails=1`,
          { headers: { 'Accept-Language': 'vi' } }
        );
        const data = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  const handleSelect = (item) => {
    const address = item.display_name;
    onChange(address);
    onPlaceSelected({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      address,
    });
    setOpen(false);
    setSuggestions([]);
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
            {suggestions.map((item, idx) => (
              <ListItem key={item.place_id || idx} disablePadding>
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
                        {item.display_name.split(',')[0]}
                      </Typography>
                    }
                    secondary={
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{ color: 'text.secondary', display: 'block' }}
                      >
                        {item.display_name.split(',').slice(1, 4).join(',')}
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
