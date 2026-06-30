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
    }, 300);
  };

  const handleSelect = async (suggestion) => {
    setLoading(true);
    try {
      // 1. Fetch chi tiết địa điểm bằng API v2/place/detail
      const response = await fetch(
        `https://rsapi.goong.io/v2/place/detail?api_key=${GOONG_API_KEY}&place_id=${suggestion.place_id}`
      );
      const data = await response.json();

      if (data.status === 'OK' && data.result) {
        const place = data.result;
        
        let lat = null;
        let lng = null;
        if (place.geometry && place.geometry.location) {
          lat = place.geometry.location.lat;
          lng = place.geometry.location.lng;
        }

        const address = place.formatted_address || place.name || suggestion.description;
        
        // 2. Tối ưu địa điểm: gọi thêm v2/place/children để lấy các điểm con (như cổng, tòa nhà con...)
        let children = [];
        try {
          const childrenRes = await fetch(
            `https://rsapi.goong.io/v2/place/children?api_key=${GOONG_API_KEY}&parent_id=${suggestion.place_id}`
          );
          const childrenData = await childrenRes.json();
          if (childrenData && childrenData.result) {
            children = childrenData.result;
            // Có thể dùng điểm con đầu tiên để chính xác vị trí giao hàng nếu có
            // if (children.length > 0 && children[0].geometry) {
            //   lat = children[0].geometry.location.lat;
            //   lng = children[0].geometry.location.lng;
            // }
          }
        } catch (e) {
          console.error('Error fetching children places:', e);
        }

        if (lat !== null && lng !== null) {
          onChange(address);
          onPlaceSelected({ lat, lng, address, children });
        }
      }
      setOpen(false);
      setSuggestions([]);
    } catch (error) {
      console.error('Error fetching Goong place details V2:', error);
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
