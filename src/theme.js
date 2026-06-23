import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#f59e0b',       // Amber 500
      light: '#fcd34d',      // Amber 300
      dark: '#d97706',       // Amber 600
      contrastText: '#1a1207',
    },
    secondary: {
      main: '#06b6d4',       // Cyan 500
      light: '#67e8f9',
      dark: '#0891b2',
      contrastText: '#061015',
    },
    background: {
      default: '#0f0f14',
      paper: '#1a1a24',
    },
    surface: {
      main: '#242432',
    },
    text: {
      primary: '#f1f0ef',
      secondary: '#a09d9a',
      disabled: '#5a5855',
    },
    error: {
      main: '#f87171',
    },
    success: {
      main: '#4ade80',
    },
    warning: {
      main: '#fb923c',
    },
    divider: 'rgba(241, 240, 239, 0.1)',
  },
  typography: {
    fontFamily: "'Inter', sans-serif",
    h4: { fontWeight: 700, letterSpacing: '-0.5px' },
    h5: { fontWeight: 700, letterSpacing: '-0.3px' },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 500 },
    body1: { fontSize: '0.95rem' },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(241, 240, 239, 0.08)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          '& fieldset': {
            borderColor: 'rgba(241, 240, 239, 0.15)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
  },
});

export default theme;
