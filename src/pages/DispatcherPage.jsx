import React from 'react';
import { Container, Box, Typography } from '@mui/material';
import DispatcherForm from './DispatcherForm.jsx';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';

export default function DispatcherPage() {
  return (
    <Box
      className="page-enter"
      sx={{
        minHeight: 'calc(100vh - 64px)',
        background: 'radial-gradient(ellipse at 20% 0%, rgba(245,158,11,0.06) 0%, transparent 60%)',
        py: 3,
      }}
    >
      <Container maxWidth="xl">
        {/* Page header */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1.5,
                bgcolor: 'rgba(245,158,11,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SpeedRoundedIcon sx={{ color: 'primary.main', fontSize: 18 }} />
            </Box>
            <Typography variant="h5" fontWeight={800} letterSpacing="-0.5px">
              Bảng Điều Phối
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" ml={6}>
            Tính cước tự động theo tuyến đường thực tế và phụ phí áp dụng
          </Typography>
        </Box>

        <DispatcherForm />
      </Container>
    </Box>
  );
}
