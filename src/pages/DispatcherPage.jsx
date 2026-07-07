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
        <DispatcherForm />
      </Container>
    </Box>
  );
}
