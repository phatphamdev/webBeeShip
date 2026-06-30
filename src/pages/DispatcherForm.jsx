import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormGroup,
  FormControlLabel,
  Switch,
  Divider,
  Chip,
  Skeleton,
  Alert,
  CircularProgress,
  Tooltip,
  Grid,
  TextField,
} from '@mui/material';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LocalTaxiRoundedIcon from '@mui/icons-material/LocalTaxiRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import PlacesAutocomplete from '../components/PlacesAutocomplete.jsx';
import MapRoute from '../components/MapRoute.jsx';
import { supabase } from '../supabaseClient.js';

/* ── Formatter VND ────────────────────────────────────────── */
const formatVND = (amount) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
    Math.round(amount)
  );

/* ── Price Calculation Logic ──────────────────────────────── */
function calculatePrice(service, activeSurcharges, distance_km, itemCount = 1) {
  if (!service || !distance_km) return null;

  const { base_price, base_km, per_km_price } = service;
  const extraKm = Math.max(0, distance_km - base_km);
  const extraFare = extraKm * per_km_price;
  let subtotal = base_price + extraFare;

  // Extra item fee logic
  let extraItemFee = 0;
  if (itemCount > 4) {
    extraItemFee = Math.ceil((itemCount - 4) / 3) * 3000;
  }
  subtotal += extraItemFee;

  // Apply MULTIPLIER surcharges first
  const multipliers = activeSurcharges.filter((s) => s.type === 'MULTIPLIER');
  const fixeds = activeSurcharges.filter((s) => s.type === 'FIXED');

  let afterMultiplier = subtotal;
  for (const m of multipliers) {
    afterMultiplier *= m.value;
  }

  // Then add FIXED surcharges
  const fixedTotal = fixeds.reduce((sum, f) => sum + f.value, 0);
  const total = afterMultiplier + fixedTotal;

  return {
    base_price,
    extra_km: extraKm,
    extra_fare: extraFare,
    extra_item_fee: extraItemFee,
    item_count: itemCount,
    subtotal,
    multipliers,
    fixeds,
    after_multiplier: afterMultiplier,
    fixed_total: fixedTotal,
    total,
  };
}

/* ── Small stat card ──────────────────────────────────────── */
function StatCard({ icon, label, value, unit, color = 'primary.main' }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        bgcolor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(241,240,239,0.07)',
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1.5,
          bgcolor: `${color}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
        <Typography variant="subtitle2" fontWeight={700} color={color}>
          {value}{' '}
          <Box component="span" sx={{ fontWeight: 400, fontSize: '0.75rem', color: 'text.secondary' }}>
            {unit}
          </Box>
        </Typography>
      </Box>
    </Box>
  );
}

/* ── Main Component ───────────────────────────────────────── */
export default function DispatcherForm() {
  // Location state
  const [origin, setOrigin] = useState(null);       // { lat, lng, address }
  const [destination, setDestination] = useState(null);
  const [originText, setOriginText] = useState('');
  const [destinationText, setDestinationText] = useState('');

  // Route result from map
  const [routeInfo, setRouteInfo] = useState(null); // { distance_km, duration_min }

  // Supabase data
  const [services, setServices] = useState([]);
  const [surcharges, setSurcharges] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState('');

  // Selections
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [activeSurchargeIds, setActiveSurchargeIds] = useState(new Set());
  const [itemCount, setItemCount] = useState(1);

  // Price
  const [priceBreakdown, setPriceBreakdown] = useState(null);
  const priceRef = useRef(null);

  /* ── Fetch Supabase data ────────────────────────────────── */
  useEffect(() => {
    async function fetchData() {
      setLoadingData(true);
      setDataError('');
      try {
        const [{ data: svcData, error: svcErr }, { data: surData, error: surErr }] =
          await Promise.all([
            supabase.from('services').select('*').order('id'),
            supabase.from('surcharges').select('*').eq('is_active', true).order('id'),
          ]);

        if (svcErr) throw new Error(svcErr.message);
        if (surErr) throw new Error(surErr.message);

        setServices(svcData || []);
        setSurcharges(surData || []);

        if (svcData?.length > 0) setSelectedServiceId(svcData[0].id);
      } catch (err) {
        setDataError(`Lỗi tải dữ liệu: ${err.message}`);
      } finally {
        setLoadingData(false);
      }
    }
    fetchData();
  }, []);

  /* ── Recalculate price ──────────────────────────────────── */
  useEffect(() => {
    if (!routeInfo || !selectedServiceId) {
      setPriceBreakdown(null);
      return;
    }
    const service = services.find((s) => s.id === selectedServiceId);
    const activeSurchargeList = surcharges.filter((s) => activeSurchargeIds.has(s.id));
    const result = calculatePrice(service, activeSurchargeList, routeInfo.distance_km, itemCount);
    setPriceBreakdown(result);

    // Trigger pulse animation
    if (priceRef.current) {
      priceRef.current.classList.remove('price-pulse');
      void priceRef.current.offsetWidth; // reflow
      priceRef.current.classList.add('price-pulse');
    }
  }, [routeInfo, selectedServiceId, activeSurchargeIds, services, surcharges, itemCount]);

  /* ── Handlers ───────────────────────────────────────────── */
  const handleOriginSelected = useCallback((place) => {
    setOrigin(place);
    setOriginText(place.address);
  }, []);

  const handleDestinationSelected = useCallback((place) => {
    setDestination(place);
    setDestinationText(place.address);
  }, []);

  const handleRouteResult = useCallback((result) => {
    setRouteInfo(result);
  }, []);

  const toggleSurcharge = (id) => {
    setActiveSurchargeIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedService = services.find((s) => s.id === selectedServiceId);

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <Grid container spacing={2.5} sx={{ height: '100%' }}>
      {/* ── LEFT COLUMN: Form ── */}
      <Grid size={{ xs: 12, md: 5, lg: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {dataError && (
            <Alert severity="error" variant="outlined" onClose={() => setDataError('')}>
              {dataError}
            </Alert>
          )}

          {/* Address Inputs */}
          <Card variant="outlined" sx={{ overflow: 'visible' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography variant="subtitle1" fontWeight={700} mb={2} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <RouteRoundedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                Hành trình
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <PlacesAutocomplete
                  label="Điểm đón"
                  value={originText}
                  onChange={setOriginText}
                  onPlaceSelected={handleOriginSelected}
                  type="origin"
                />
                <PlacesAutocomplete
                  label="Điểm đến"
                  value={destinationText}
                  onChange={setDestinationText}
                  onPlaceSelected={handleDestinationSelected}
                  type="destination"
                />
              </Box>

              {/* Route info chips */}
              {routeInfo && (
                <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                  <Chip
                    icon={<RouteRoundedIcon />}
                    label={`${routeInfo.distance_km.toFixed(1)} km`}
                    size="small"
                    sx={{ bgcolor: 'rgba(6,182,212,0.12)', color: 'secondary.main', fontWeight: 700 }}
                  />
                  <Chip
                    icon={<AccessTimeRoundedIcon />}
                    label={`~${routeInfo.duration_min} phút`}
                    size="small"
                    sx={{ bgcolor: 'rgba(245,158,11,0.12)', color: 'primary.main', fontWeight: 700 }}
                  />
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Service Select */}
          <Card variant="outlined">
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography variant="subtitle1" fontWeight={700} mb={2} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocalTaxiRoundedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                Loại dịch vụ
              </Typography>

              {loadingData ? (
                <Skeleton variant="rounded" height={56} />
              ) : (
                <FormControl fullWidth>
                  <InputLabel>Chọn dịch vụ</InputLabel>
                  <Select
                    value={selectedServiceId}
                    label="Chọn dịch vụ"
                    onChange={(e) => setSelectedServiceId(e.target.value)}
                  >
                    {services.map((svc) => (
                      <MenuItem key={svc.id} value={svc.id}>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {svc.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Cước cơ bản: {formatVND(svc.base_price)} / {svc.base_km} km đầu
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {selectedService && (selectedService.name.toLowerCase().includes('giao hàng') || selectedService.name.toLowerCase().includes('giao nước')) && (
                <Box sx={{ mt: 2.5 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Số lượng (items/ly)"
                    value={itemCount}
                    onChange={(e) => setItemCount(Math.max(1, parseInt(e.target.value) || 1))}
                    inputProps={{ min: 1 }}
                  />
                </Box>
              )}

              {selectedService && (
                <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                  <StatCard
                    icon={<PaymentsRoundedIcon sx={{ color: 'primary.main', fontSize: 16 }} />}
                    label={`${selectedService.base_km} km đầu`}
                    value={formatVND(selectedService.base_price)}
                    unit=""
                    color="primary.main"
                  />
                  <StatCard
                    icon={<RouteRoundedIcon sx={{ color: 'secondary.main', fontSize: 16 }} />}
                    label="Mỗi km thêm"
                    value={formatVND(selectedService.per_km_price)}
                    unit="/km"
                    color="secondary.main"
                  />
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Surcharges */}
          {!loadingData && surcharges.length > 0 && (
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Typography variant="subtitle1" fontWeight={700} mb={2} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TuneRoundedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  Phụ phí
                </Typography>
                <FormGroup>
                  {surcharges.map((s) => (
                    <FormControlLabel
                      key={s.id}
                      control={
                        <Switch
                          checked={activeSurchargeIds.has(s.id)}
                          onChange={() => toggleSurcharge(s.id)}
                          size="small"
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': { color: 'primary.main' },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: 'primary.main',
                            },
                          }}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2">{s.name}</Typography>
                          <Tooltip
                            title={
                              s.type === 'MULTIPLIER'
                                ? `Nhân giá × ${s.value}`
                                : `Cộng thêm ${formatVND(s.value)}`
                            }
                          >
                            <Chip
                              label={
                                s.type === 'MULTIPLIER'
                                  ? `×${s.value}`
                                  : `+${formatVND(s.value)}`
                              }
                              size="small"
                              sx={{
                                fontSize: '0.65rem',
                                height: 18,
                                fontWeight: 700,
                                bgcolor:
                                  s.type === 'MULTIPLIER'
                                    ? 'rgba(251,146,60,0.15)'
                                    : 'rgba(6,182,212,0.12)',
                                color:
                                  s.type === 'MULTIPLIER' ? 'warning.main' : 'secondary.main',
                              }}
                            />
                          </Tooltip>
                          <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                        </Box>
                      }
                      sx={{ mb: 0.5 }}
                    />
                  ))}
                </FormGroup>
              </CardContent>
            </Card>
          )}
        </Box>
      </Grid>

      {/* ── RIGHT COLUMN: Map + Price ── */}
      <Grid size={{ xs: 12, md: 7, lg: 8 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, height: '100%' }}>
          {/* Map */}
          <Card variant="outlined" sx={{ flex: 1, minHeight: { xs: 300, md: 400 } }}>
            <CardContent sx={{ p: 1.5, height: '100%', '&:last-child': { pb: 1.5 } }}>
              <MapRoute
                origin={origin}
                destination={destination}
                onRouteResult={handleRouteResult}
              />
            </CardContent>
          </Card>

          {/* Price Breakdown */}
          {priceBreakdown ? (
            <Card
              variant="outlined"
              ref={priceRef}
              sx={{
                border: '1px solid rgba(245, 158, 11, 0.3)',
                background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(26,26,36,1) 60%)',
              }}
            >
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Typography variant="subtitle1" fontWeight={700} mb={2} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PaymentsRoundedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  Chi tiết cước phí
                </Typography>

                {/* Breakdown rows */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  <PriceRow
                    label={`Cước cơ bản (${selectedService?.base_km} km đầu)`}
                    value={formatVND(priceBreakdown.base_price)}
                  />

                  {priceBreakdown.extra_km > 0 && (
                    <PriceRow
                      label={`${priceBreakdown.extra_km.toFixed(2)} km vượt (×${formatVND(selectedService?.per_km_price)}/km)`}
                      value={formatVND(priceBreakdown.extra_fare)}
                    />
                  )}

                  {priceBreakdown.extra_item_fee > 0 && (
                    <PriceRow
                      label={`Phụ phí số lượng (${priceBreakdown.item_count} items/ly)`}
                      value={`+${formatVND(priceBreakdown.extra_item_fee)}`}
                    />
                  )}

                  <PriceRow
                    label="Tạm tính"
                    value={formatVND(priceBreakdown.subtotal)}
                    isSub
                  />

                  {priceBreakdown.multipliers.map((m) => (
                    <PriceRow
                      key={m.id}
                      label={`${m.name} (×${m.value})`}
                      value={`×${m.value}`}
                      color="warning.main"
                    />
                  ))}

                  {priceBreakdown.fixeds.map((f) => (
                    <PriceRow
                      key={f.id}
                      label={f.name}
                      value={`+${formatVND(f.value)}`}
                      color="secondary.main"
                    />
                  ))}
                </Box>

                <Divider sx={{ my: 2, borderColor: 'rgba(245,158,11,0.25)' }} />

                {/* Total */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" fontWeight={700}>
                    Tổng cước
                  </Typography>
                  <Typography
                    variant="h5"
                    fontWeight={800}
                    sx={{
                      color: 'primary.main',
                      textShadow: '0 0 20px rgba(245,158,11,0.4)',
                    }}
                  >
                    {formatVND(priceBreakdown.total)}
                  </Typography>
                </Box>

                {/* Stats row */}
                <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                  {routeInfo && (
                    <>
                      <Chip
                        icon={<RouteRoundedIcon sx={{ fontSize: '14px !important' }} />}
                        label={`${routeInfo.distance_km.toFixed(1)} km`}
                        size="small"
                        sx={{ bgcolor: 'rgba(6,182,212,0.12)', color: 'secondary.main', fontWeight: 700 }}
                      />
                      <Chip
                        icon={<AccessTimeRoundedIcon sx={{ fontSize: '14px !important' }} />}
                        label={`~${routeInfo.duration_min} phút`}
                        size="small"
                        sx={{ bgcolor: 'rgba(245,158,11,0.12)', color: 'primary.main', fontWeight: 700 }}
                      />
                    </>
                  )}
                </Box>
              </CardContent>
            </Card>
          ) : (
            /* Placeholder khi chưa tính được giá */
            routeInfo && !selectedServiceId && (
              <Alert severity="info" variant="outlined">
                Vui lòng chọn loại dịch vụ để xem cước phí.
              </Alert>
            )
          )}
        </Box>
      </Grid>
    </Grid>
  );
}

/* ── Price Row helper ────────────────────────────────────── */
function PriceRow({ label, value, isSub = false, color }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        py: 0.25,
        ...(isSub && {
          mt: 0.5,
          pt: 1,
          borderTop: '1px dashed rgba(241,240,239,0.1)',
        }),
      }}
    >
      <Typography
        variant="body2"
        color={isSub ? 'text.primary' : 'text.secondary'}
        fontWeight={isSub ? 600 : 400}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={isSub ? 700 : 500}
        color={color || (isSub ? 'text.primary' : 'text.secondary')}
      >
        {value}
      </Typography>
    </Box>
  );
}
