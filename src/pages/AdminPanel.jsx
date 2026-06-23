import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  Alert,
  Chip,
  CircularProgress,
} from '@mui/material';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import LocalTaxiRoundedIcon from '@mui/icons-material/LocalTaxiRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';

import DataGrid, {
  Column,
  Lookup,
  Editing,
  Sorting,
  FilterRow,
  Pager,
  Paging,
  Toolbar,
  Item as ToolbarItem,
} from 'devextreme-react/data-grid';

import { supabase } from '../supabaseClient.js';

/* ── Formatter VND ───────────────────────────────────────── */
const formatVND = (value) => {
  if (value == null) return '';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
};

/* ── Custom cell render for currency ─────────────────────── */
function CurrencyCell({ value }) {
  return (
    <span style={{ color: '#fcd34d', fontWeight: 600 }}>{formatVND(value)}</span>
  );
}

/* ── Custom cell render for boolean is_active ─────────────── */
function ActiveCell({ value }) {
  return (
    <Chip
      label={value ? 'Hoạt động' : 'Tắt'}
      size="small"
      sx={{
        fontWeight: 700,
        fontSize: '0.7rem',
        bgcolor: value ? 'rgba(74, 222, 128, 0.12)' : 'rgba(248, 113, 113, 0.12)',
        color: value ? '#4ade80' : '#f87171',
        border: `1px solid ${value ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
      }}
    />
  );
}

/* ── Custom cell for surcharge type ──────────────────────── */
function TypeCell({ value }) {
  const isMultiplier = value === 'MULTIPLIER';
  return (
    <Chip
      label={isMultiplier ? 'Nhân × ' : 'Cố định +'}
      size="small"
      sx={{
        fontWeight: 700,
        fontSize: '0.7rem',
        bgcolor: isMultiplier ? 'rgba(251,146,60,0.12)' : 'rgba(6,182,212,0.12)',
        color: isMultiplier ? '#fb923c' : '#06b6d4',
      }}
    />
  );
}

/* ── DataGrid shared styles ─────────────────────────────── */
const gridSx = {
  '& .dx-datagrid': {
    backgroundColor: 'transparent',
    color: '#f1f0ef',
    fontFamily: 'Inter, sans-serif',
  },
  '& .dx-datagrid-headers .dx-datagrid-table .dx-row > td': {
    backgroundColor: 'rgba(241,240,239,0.04)',
    color: '#a09d9a',
    fontWeight: 600,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid rgba(241,240,239,0.1)',
  },
  '& .dx-datagrid-rowsview .dx-row': {
    borderBottom: '1px solid rgba(241,240,239,0.05)',
  },
  '& .dx-datagrid-rowsview .dx-row:hover': {
    backgroundColor: 'rgba(245,158,11,0.06) !important',
  },
  '& .dx-toolbar': {
    backgroundColor: 'transparent',
    marginBottom: 1,
  },
  '& .dx-button': {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderColor: 'rgba(245,158,11,0.25)',
    color: '#fcd34d',
    borderRadius: 6,
  },
  '& .dx-button:hover': {
    backgroundColor: 'rgba(245,158,11,0.2)',
  },
};

/* ═══════════════════════════════════════════════════════════
   SERVICES GRID
   ══════════════════════════════════════════════════════════ */
function ServicesGrid() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const gridRef = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from('services')
      .select('*')
      .order('id');
    if (err) {
      setError(err.message);
    } else {
      setData(rows || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── CRUD handlers ──────────────────────────────────────── */
  const onRowInserted = async (e) => {
    const { id, ...payload } = e.data;
    const { error: err } = await supabase.from('services').insert([payload]);
    if (err) {
      setError(`Lỗi thêm dữ liệu: ${err.message}`);
      fetchData();
    } else {
      fetchData();
    }
  };

  const onRowUpdated = async (e) => {
    const { id, ...payload } = e.data;
    const { error: err } = await supabase
      .from('services')
      .update(payload)
      .eq('id', id);
    if (err) {
      setError(`Lỗi cập nhật: ${err.message}`);
      fetchData();
    }
  };

  const onRowRemoved = async (e) => {
    const { error: err } = await supabase
      .from('services')
      .delete()
      .eq('id', e.data.id);
    if (err) {
      setError(`Lỗi xóa: ${err.message}`);
      fetchData();
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Box sx={gridSx}>
        <DataGrid
          ref={gridRef}
          dataSource={data}
          keyExpr="id"
          showBorders={false}
          showColumnLines={false}
          showRowLines={true}
          rowAlternationEnabled={false}
          columnAutoWidth={true}
          wordWrapEnabled={false}
          onRowInserted={onRowInserted}
          onRowUpdated={onRowUpdated}
          onRowRemoved={onRowRemoved}
        >
          <Editing
            mode="row"
            allowAdding={true}
            allowUpdating={true}
            allowDeleting={true}
            confirmDelete={true}
            useIcons={true}
          />
          <FilterRow visible={true} />
          <Sorting mode="multiple" />
          <Paging defaultPageSize={10} />
          <Pager
            showPageSizeSelector={true}
            allowedPageSizes={[5, 10, 20]}
            showInfo={true}
            infoText="Trang {0} / {1} ({2} bản ghi)"
          />

          <Toolbar>
            <ToolbarItem name="addRowButton" showText="always" />
            <ToolbarItem name="revertButton" />
            <ToolbarItem name="saveButton" />
          </Toolbar>

          <Column dataField="id" caption="ID" width={60} allowEditing={false} alignment="center" />
          <Column dataField="name" caption="Tên dịch vụ" minWidth={180} validationRules={[{ type: 'required' }]} />
          <Column
            dataField="base_price"
            caption="Giá cơ bản"
            dataType="number"
            alignment="right"
            cellRender={({ value }) => <CurrencyCell value={value} />}
            validationRules={[{ type: 'required' }, { type: 'numeric' }]}
          />
          <Column
            dataField="base_km"
            caption="Số km cơ bản"
            dataType="number"
            alignment="right"
            format={{ type: 'fixedPoint', precision: 1 }}
            validationRules={[{ type: 'required' }, { type: 'numeric' }]}
          />
          <Column
            dataField="per_km_price"
            caption="Giá/km thêm"
            dataType="number"
            alignment="right"
            cellRender={({ value }) => <CurrencyCell value={value} />}
            validationRules={[{ type: 'required' }, { type: 'numeric' }]}
          />
        </DataGrid>
      </Box>
    </Box>
  );
}

/* ═══════════════════════════════════════════════════════════
   SURCHARGES GRID
   ══════════════════════════════════════════════════════════ */
function SurchargesGrid() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from('surcharges')
      .select('*')
      .order('id');
    if (err) {
      setError(err.message);
    } else {
      setData(rows || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRowInserted = async (e) => {
    const { id, ...payload } = e.data;
    const { error: err } = await supabase.from('surcharges').insert([payload]);
    if (err) {
      setError(`Lỗi thêm: ${err.message}`);
      fetchData();
    } else {
      fetchData();
    }
  };

  const onRowUpdated = async (e) => {
    const { id, ...payload } = e.data;
    const { error: err } = await supabase
      .from('surcharges')
      .update(payload)
      .eq('id', id);
    if (err) {
      setError(`Lỗi cập nhật: ${err.message}`);
      fetchData();
    }
  };

  const onRowRemoved = async (e) => {
    const { error: err } = await supabase
      .from('surcharges')
      .delete()
      .eq('id', e.data.id);
    if (err) {
      setError(`Lỗi xóa: ${err.message}`);
      fetchData();
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Box sx={gridSx}>
        <DataGrid
          dataSource={data}
          keyExpr="id"
          showBorders={false}
          showColumnLines={false}
          showRowLines={true}
          rowAlternationEnabled={false}
          columnAutoWidth={true}
          onRowInserted={onRowInserted}
          onRowUpdated={onRowUpdated}
          onRowRemoved={onRowRemoved}
        >
          <Editing
            mode="row"
            allowAdding={true}
            allowUpdating={true}
            allowDeleting={true}
            confirmDelete={true}
            useIcons={true}
          />
          <FilterRow visible={true} />
          <Sorting mode="multiple" />
          <Paging defaultPageSize={10} />
          <Pager
            showPageSizeSelector={true}
            allowedPageSizes={[5, 10, 20]}
            showInfo={true}
            infoText="Trang {0} / {1} ({2} bản ghi)"
          />

          <Toolbar>
            <ToolbarItem name="addRowButton" showText="always" />
            <ToolbarItem name="revertButton" />
            <ToolbarItem name="saveButton" />
          </Toolbar>

          <Column dataField="id" caption="ID" width={60} allowEditing={false} alignment="center" />
          <Column dataField="name" caption="Tên phụ phí" minWidth={160} validationRules={[{ type: 'required' }]} />
          <Column
            dataField="type"
            caption="Loại"
            width={140}
            cellRender={({ value }) => <TypeCell value={value} />}
            validationRules={[{ type: 'required' }]}
          >
            <Lookup dataSource={['FIXED', 'MULTIPLIER']} />
          </Column>
          <Column
            dataField="value"
            caption="Giá trị"
            dataType="number"
            alignment="right"
            format={{ type: 'fixedPoint', precision: 2 }}
            validationRules={[{ type: 'required' }, { type: 'numeric' }]}
          />
          <Column
            dataField="is_active"
            caption="Trạng thái"
            dataType="boolean"
            width={130}
            alignment="center"
            cellRender={({ value }) => <ActiveCell value={value} />}
          />
        </DataGrid>
      </Box>
    </Box>
  );
}

/* ═══════════════════════════════════════════════════════════
   ADMIN PANEL PAGE
   ══════════════════════════════════════════════════════════ */
export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box
      className="page-enter"
      sx={{
        minHeight: 'calc(100vh - 64px)',
        background: 'radial-gradient(ellipse at 80% 0%, rgba(6,182,212,0.05) 0%, transparent 60%)',
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
                bgcolor: 'rgba(6,182,212,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AdminPanelSettingsRoundedIcon sx={{ color: 'secondary.main', fontSize: 18 }} />
            </Box>
            <Typography variant="h5" fontWeight={800} letterSpacing="-0.5px">
              Quản Trị Hệ Thống
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" ml={6}>
            Quản lý danh mục dịch vụ và phụ phí — thay đổi sẽ phản ánh ngay trên bảng điều phối
          </Typography>
        </Box>

        {/* Tab navigation */}
        <Card variant="outlined">
          <Box sx={{ borderBottom: '1px solid rgba(241,240,239,0.08)' }}>
            <Tabs
              value={activeTab}
              onChange={(_, v) => setActiveTab(v)}
              sx={{
                px: 2,
                '& .MuiTab-root': {
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  color: 'text.secondary',
                  textTransform: 'none',
                  minHeight: 52,
                  gap: 1,
                },
                '& .Mui-selected': { color: 'primary.main' },
                '& .MuiTabs-indicator': { backgroundColor: 'primary.main', height: 3, borderRadius: 2 },
              }}
            >
              <Tab
                icon={<LocalTaxiRoundedIcon fontSize="small" />}
                iconPosition="start"
                label="Dịch vụ"
                id="tab-services"
                aria-controls="tabpanel-services"
              />
              <Tab
                icon={<TuneRoundedIcon fontSize="small" />}
                iconPosition="start"
                label="Phụ phí"
                id="tab-surcharges"
                aria-controls="tabpanel-surcharges"
              />
            </Tabs>
          </Box>

          <CardContent sx={{ p: { xs: 2, md: 3 }, '&:last-child': { pb: 3 } }}>
            {/* Info banner */}
            <Alert
              severity="info"
              variant="outlined"
              sx={{ mb: 3, fontSize: '0.82rem', borderColor: 'rgba(6,182,212,0.3)', color: 'secondary.light' }}
            >
              💡 Nhấn <strong>+ Thêm mới</strong> để tạo bản ghi. Nhấn biểu tượng bút chì để chỉnh sửa, thùng rác để xóa.
              Thay đổi được lưu thẳng vào Supabase.
            </Alert>

            {/* Tab panels */}
            <div
              role="tabpanel"
              id="tabpanel-services"
              aria-labelledby="tab-services"
              hidden={activeTab !== 0}
            >
              {activeTab === 0 && <ServicesGrid />}
            </div>
            <div
              role="tabpanel"
              id="tabpanel-surcharges"
              aria-labelledby="tab-surcharges"
              hidden={activeTab !== 1}
            >
              {activeTab === 1 && <SurchargesGrid />}
            </div>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
