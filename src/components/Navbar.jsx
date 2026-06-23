import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Chip,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LocalTaxiRoundedIcon from '@mui/icons-material/LocalTaxiRounded';
import CalculateRoundedIcon from '@mui/icons-material/CalculateRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';

const navItems = [
  { label: 'Điều Phối', path: '/dispatcher', icon: <CalculateRoundedIcon fontSize="small" /> },
  { label: 'Quản Trị', path: '/admin', icon: <AdminPanelSettingsRoundedIcon fontSize="small" /> },
];

export default function Navbar() {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          background: 'rgba(15, 15, 20, 0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(241, 240, 239, 0.08)',
          top: 0,
          zIndex: 1100,
        }}
      >
        <Toolbar sx={{ px: { xs: 2, md: 4 } }}>
          {/* Logo */}
          <Box
            component={Link}
            to="/dispatcher"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.2,
              textDecoration: 'none',
              mr: 4,
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(245, 158, 11, 0.35)',
              }}
            >
              <LocalTaxiRoundedIcon sx={{ color: '#1a1207', fontSize: 20 }} />
            </Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                color: '#f1f0ef',
                letterSpacing: '-0.5px',
              }}
            >
              Bee
              <Box component="span" sx={{ color: 'primary.main' }}>
                Ship
              </Box>
            </Typography>
            <Chip
              label="DISPATCH"
              size="small"
              sx={{
                fontSize: '0.6rem',
                fontWeight: 700,
                height: 18,
                letterSpacing: '0.05em',
                bgcolor: 'rgba(245, 158, 11, 0.12)',
                color: 'primary.light',
                border: '1px solid rgba(245, 158, 11, 0.25)',
              }}
            />
          </Box>

          <Box sx={{ flex: 1 }} />

          {/* Desktop nav */}
          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {navItems.map((item) => {
                const active = location.pathname.startsWith(item.path);
                return (
                  <Button
                    key={item.path}
                    component={Link}
                    to={item.path}
                    startIcon={item.icon}
                    variant={active ? 'contained' : 'text'}
                    size="small"
                    sx={{
                      color: active ? 'primary.contrastText' : 'text.secondary',
                      fontWeight: active ? 700 : 500,
                      px: 2,
                      '&:hover': {
                        color: 'primary.light',
                        bgcolor: 'rgba(245, 158, 11, 0.08)',
                      },
                    }}
                  >
                    {item.label}
                  </Button>
                );
              })}
            </Box>
          )}

          {/* Mobile menu icon */}
          {isMobile && (
            <IconButton
              edge="end"
              onClick={() => setDrawerOpen(true)}
              sx={{ color: 'text.primary' }}
            >
              <MenuIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 240,
            bgcolor: 'background.paper',
            border: 'none',
          },
        }}
      >
        <Box sx={{ pt: 3, px: 2 }}>
          <Typography variant="h6" fontWeight={700} color="primary.main" mb={2}>
            Menu
          </Typography>
          <List disablePadding>
            {navItems.map((item) => {
              const active = location.pathname.startsWith(item.path);
              return (
                <ListItem key={item.path} disablePadding>
                  <ListItemButton
                    component={Link}
                    to={item.path}
                    onClick={() => setDrawerOpen(false)}
                    selected={active}
                    sx={{
                      borderRadius: 2,
                      mb: 0.5,
                      '&.Mui-selected': {
                        bgcolor: 'rgba(245, 158, 11, 0.12)',
                        color: 'primary.main',
                      },
                    }}
                  >
                    <Box sx={{ mr: 1.5, display: 'flex' }}>{item.icon}</Box>
                    <ListItemText primary={item.label} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>
      </Drawer>
    </>
  );
}
