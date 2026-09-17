import React, { useState, useEffect, useRef } from 'react';
import {
  Shield, ShieldAlert, ShieldCheck, Video, Cpu, Activity,
  Bell, AlertTriangle, CheckCircle2, RefreshCw, Eye, EyeOff,
  Sliders, User, Users, Car, Key, FileText, Check, PhoneCall,
  MessageSquare, Radio, HardDrive, Wifi, Power, Play, Square,
  Camera as CamIcon, Terminal, ExternalLink, Settings, Layers,
  ChevronRight, Sparkles, Building, Lock, Unlock, Zap, Download,
  Clock, Thermometer, Lightbulb, ShoppingBag, ShoppingCart, CheckCircle
} from 'lucide-react';
import { api } from './api';
import {
  UserProfile, GuardState, Camera, Agent, SecurityEvent,
  AlarmItem, AlarmRule, FaceItem, PlateItem, CRMCustomer,
  AttendanceItem, FacilityItem, ShopProductItem, ShopOrderItem
} from './types';

export function App() {
  // Auth state
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(api.getToken());
  const [loginEmail, setLoginEmail] = useState('admin@makoran.io');
  const [loginPass, setLoginPass] = useState('MakoranGuard2026!');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Active view
  const [currentTab, setCurrentTab] = useState<'monitor' | 'events' | 'cameras' | 'rules' | 'biometrics' | 'attendance' | 'facilities' | 'shop' | 'commercial'>('monitor');

  // Core Data
  const [guardState, setGuardState] = useState<GuardState | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [alarms, setAlarms] = useState<AlarmItem[]>([]);
  const [rules, setRules] = useState<AlarmRule[]>([]);
  const [faces, setFaces] = useState<FaceItem[]>([]);
  const [plates, setPlates] = useState<PlateItem[]>([]);
  const [crm, setCrm] = useState<CRMCustomer[]>([]);
  const [attendance, setAttendance] = useState<AttendanceItem[]>([]);
  const [facilities, setFacilities] = useState<FacilityItem[]>([]);
  const [products, setProducts] = useState<ShopProductItem[]>([]);
  const [orders, setOrders] = useState<ShopOrderItem[]>([]);
  const [tenantsList, setTenantsList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', role: 'OPERATOR', phone: '' });
  const [shopCategory, setShopCategory] = useState<string>('ALL');
  const [shopSearchText, setShopSearchText] = useState<string>('');
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [selectedProductDetails, setSelectedProductDetails] = useState<ShopProductItem | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: 'MINI_PC_AGENT' as any,
    description: '',
    price: 15000000,
    stock: 10,
    sku: 'MK-NEW-01'
  });
  const [searchPersonName, setSearchPersonName] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [eventFilterType, setEventFilterType] = useState<string>('ALL');
  const [eventSearchText, setEventSearchText] = useState<string>('');
  const [selectedEventModal, setSelectedEventModal] = useState<SecurityEvent | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [otaDeploying, setOtaDeploying] = useState(false);
  const [otaProgress, setOtaProgress] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  // Audio Context Ref for Siren
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sirenOscRef = useRef<OscillatorNode | null>(null);

  // Play / Stop Tactical Alarm Siren via Web Audio API
  const playAlarmSiren = () => {
    if (!audioEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      if (sirenOscRef.current) return; // already playing

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15, ctx.currentTime);

      osc.type = 'sawtooth';
      // 2-tone police/security warble (800Hz <-> 1200Hz)
      const now = ctx.currentTime;
      for (let i = 0; i < 20; i++) {
        osc.frequency.setValueAtTime(800, now + i * 0.5);
        osc.frequency.setValueAtTime(1200, now + i * 0.5 + 0.25);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      sirenOscRef.current = osc;
    } catch (e) {
      console.warn('Audio API unavailable:', e);
    }
  };

  const stopAlarmSiren = () => {
    if (sirenOscRef.current) {
      try {
        sirenOscRef.current.stop();
        sirenOscRef.current.disconnect();
      } catch (e) {}
      sirenOscRef.current = null;
    }
  };

  // Trigger audio on alarm state
  useEffect(() => {
    if (guardState?.alarm_status === 'TRIGGERED' && guardState?.siren_active) {
      playAlarmSiren();
    } else {
      stopAlarmSiren();
    }
    return () => stopAlarmSiren();
  }, [guardState?.alarm_status, guardState?.siren_active, audioEnabled]);

  // Fleet OTA Update
  const handleFleetOTA = () => {
    setOtaDeploying(true);
    const initial: Record<string, number> = {};
    agents.forEach(a => { initial[a.id] = 5; });
    setOtaProgress(initial);
    showToast('بسته ارتقای امنیتی فریم‌ورک v1.3.0 به تمام ناوگان مینی‌پی‌سی مخابره شد', 'info');

    let currentStep = 5;
    const interval = setInterval(() => {
      currentStep += 20;
      const progress: Record<string, number> = {};
      agents.forEach(a => {
        progress[a.id] = Math.min(100, currentStep + Math.floor(Math.random() * 10));
      });
      setOtaProgress(progress);

      if (currentStep >= 100) {
        clearInterval(interval);
        setOtaDeploying(false);
        showToast('تمامی مینی‌پی‌سی‌های ناوگان با موفقیت به نسخه v1.3.0 ارتقا یافتند و خودآزمایی شد', 'success');
        api.getAgents().then(setAgents);
      }
    }, 800);
  };

  // Live View WebRTC Sessions (Camera ID -> Session ID)
  const [activeLiveStreams, setActiveLiveStreams] = useState<Record<string, { sessionId: string; startedAt: number }>>({});
  const [streamingStats, setStreamingStats] = useState<Record<string, { fps: number; kbps: number; frame: number }>>({});

  // AI Simulation State
  const [aiSimulating, setAiSimulating] = useState(false);
  const [aiLastResult, setAiLastResult] = useState<any>(null);

  // Modals
  const [showAddCamera, setShowAddCamera] = useState(false);
  const [showAddFace, setShowAddFace] = useState(false);
  const [showAddPlate, setShowAddPlate] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [discoveredCams, setDiscoveredCams] = useState<any[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [cartModal, setCartModal] = useState<ShopProductItem | null>(null);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showAddFacilityModal, setShowAddFacilityModal] = useState(false);
  const [showAddTenantModal, setShowAddTenantModal] = useState(false);

  // Forms
  const [newCam, setNewCam] = useState({ name: '', protocol: 'ONVIF', zone: 'entrance', stream_url: '', channel_index: 1 });
  const [newFace, setNewFace] = useState({ name: '', category: 'VIP', phone: '', notes: '' });
  const [newPlate, setNewPlate] = useState({ plate_number: '', owner_name: '', category: 'ALLOWED', vehicle_model: '' });
  const [orderCustomer, setOrderCustomer] = useState({ name: '', phone: '' });
  const [attendanceForm, setAttendanceForm] = useState({
    person_name: 'مهندس رضا مکرانی',
    person_id: 'face-01',
    check_type: 'CHECK_IN' as 'CHECK_IN' | 'CHECK_OUT',
    camera_id: 'cam-01',
    confidence: 0.98
  });
  const [newFacility, setNewFacility] = useState({
    name: '',
    type: 'LIGHT',
    zone: 'entrance',
    agent_id: 'agent-mini-01'
  });
  const [newTenant, setNewTenant] = useState({
    name: '',
    slug: '',
    plan: 'Enterprise Guard'
  });
  const [newRule, setNewRule] = useState({
    name: '',
    armed_away: true,
    armed_stay: true,
    human: true,
    face: true,
    plate: false,
    zone_entrance: true,
    zone_perimeter: true,
    zone_vault: false,
    trigger_alarm: true,
    duration: 15,
    send_push: true,
    send_sms: true,
    send_call: false
  });

  // Banner message
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Initial Load & Auth Check
  useEffect(() => {
    if (token) {
      loadUserProfile();
    }
  }, [token]);

  const loadUserProfile = async () => {
    try {
      const res = await api.getMe();
      setUser({
        ...res.user,
        tenantName: res.tenant?.name || 'مکران گارد سنترال'
      });
      loadAllData();
    } catch (err) {
      api.setToken(null);
      setToken(null);
      setUser(null);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await api.login(loginEmail, loginPass);
      setToken(res.token);
      setUser(res.user);
      showToast('با موفقیت وارد پنل مکران وان شدید', 'success');
      loadAllData();
    } catch (err: any) {
      setLoginError(err.message || 'خطا در ورود به سیستم');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    Object.values(activeLiveStreams).forEach(s => api.stopLiveView(s.sessionId));
    setActiveLiveStreams({});
    api.setToken(null);
    setToken(null);
    setUser(null);
  };

  // 2. Fetch All Data
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [gRes, camRes, agRes, evRes, alRes, rRes, fRes, pRes, crmRes, attRes, facRes, prodRes, ordRes, tRes, audRes, uRes] = await Promise.all([
        api.getGuardState(),
        api.getCameras(),
        api.getAgents(),
        api.getEvents(40),
        api.getAlarms(),
        api.getRules(),
        api.getFaces(),
        api.getPlates(),
        api.getCRM(),
        api.getAttendance(),
        api.getFacilities(),
        api.getShopProducts(),
        api.getShopOrders(),
        api.getTenants().catch(() => []),
        api.getAuditLogs().catch(() => []),
        api.getUsers().catch(() => [])
      ]);
      setGuardState(gRes);
      setCameras(camRes);
      setAgents(agRes);
      setEvents(evRes);
      setAlarms(alRes);
      setRules(rRes);
      setFaces(fRes);
      setPlates(pRes);
      setCrm(crmRes);
      setAttendance(attRes);
      setFacilities(facRes);
      setProducts(prodRes);
      setOrders(ordRes);
      setTenantsList(tRes);
      setAuditLogs(audRes);
      setUsersList(uRes || []);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Real-time WebSocket connection to Server Client Channel
  useEffect(() => {
    if (!token) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/client?token=${token}`;
    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.event === 'new_security_event') {
            setEvents(prev => [payload.data, ...prev]);
            if (payload.data.alarm_triggered) {
              setGuardState(prev => prev ? { ...prev, alarm_status: 'TRIGGERED', siren_active: 1, relay_active: 1 } : null);
              showToast(`🚨 هشدار فوری: ${payload.data.label}`, 'error');
            }
          } else if (payload.event === 'guard_state_change') {
            setGuardState(prev => prev ? { ...prev, ...payload.data } : null);
          } else if (payload.event === 'new_attendance') {
            setAttendance(prev => [payload.data, ...prev]);
          } else if (payload.event === 'facility_state_change') {
            setFacilities(prev => prev.map(f => f.id === payload.data.deviceId ? { ...f, state: payload.data.state, value: payload.data.value } : f));
          }
        } catch (e) {}
      };
    } catch (e) {}

    return () => {
      if (ws) ws.close();
    };
  }, [token]);

  // Live video frame simulation loop
  useEffect(() => {
    const timer = setInterval(() => {
      const stats: Record<string, { fps: number; kbps: number; frame: number }> = {};
      Object.keys(activeLiveStreams).forEach(camId => {
        const prev = streamingStats[camId] || { fps: 25, kbps: 2200, frame: 0 };
        stats[camId] = {
          fps: Math.floor(24 + Math.random() * 2),
          kbps: Math.floor(2100 + Math.random() * 400),
          frame: prev.frame + 1
        };
      });
      setStreamingStats(stats);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeLiveStreams, streamingStats]);

  // Security Arming actions
  const setArmedState = async (state: 'ARMED_AWAY' | 'ARMED_STAY' | 'DISARMED' | 'PANIC') => {
    try {
      await api.setArmedState(state);
      setGuardState(prev => prev ? { ...prev, armed_state: state } : null);
      showToast(`وضعیت حفاظتی مکران به «${state}» تغییر یافت`, 'info');
      if (state === 'PANIC') {
        showToast('🚨 آژیر اضطراری دستی (PANIC) فعال شد!', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleAlarmAction = async (action: 'ACKNOWLEDGE' | 'RESOLVE' | 'SILENCE') => {
    try {
      await api.setAlarmAction(action);
      const updated = await api.getGuardState();
      setGuardState(updated);
      const updatedAlarms = await api.getAlarms();
      setAlarms(updatedAlarms);
      showToast(`هشدار با موفقیت روی حالت ${action} قرار گرفت`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Live View WebRTC On-Demand Handlers
  const toggleLiveStream = async (camera: Camera) => {
    const isStreaming = !!activeLiveStreams[camera.id];

    if (isStreaming) {
      const session = activeLiveStreams[camera.id];
      try {
        await api.stopLiveView(session.sessionId);
      } catch (e) {}
      setActiveLiveStreams(prev => {
        const copy = { ...prev };
        delete copy[camera.id];
        return copy;
      });
      showToast(`پخش زنده دوربین ${camera.name} متوقف شد (ترافیک آزاد شد)`, 'info');
    } else {
      try {
        showToast(`درخواست استریم WebRTC از مینی‌پی‌سی برای دوربین ${camera.name}...`, 'info');
        const session = await api.requestLiveView(camera.id, camera.agent_id);
        setActiveLiveStreams(prev => ({
          ...prev,
          [camera.id]: { sessionId: session.sessionId, startedAt: Date.now() }
        }));
        showToast(`پخش زنده WebRTC با موفقیت آغاز شد`, 'success');
      } catch (err: any) {
        showToast(err.message || 'خطا در برقراری استریم', 'error');
      }
    }
  };

  // AI Threat Ingestion Simulator
  const triggerAISimulation = async (eventType: string, cameraId = 'cam-01') => {
    setAiSimulating(true);
    try {
      const res = await api.processAI({
        camera_id: cameraId,
        event_type: eventType
      });
      setAiLastResult(res);
      showToast(`پردازش تصویر در سرور انجام شد: ${res.decision === 'alarm' ? '🚨 آژیر امنیتی تایید شد!' : 'اطلاعات ثبت شد'}`, res.decision === 'alarm' ? 'error' : 'success');
      loadAllData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setAiSimulating(false);
    }
  };

  // Hardware Controls
  const testAgentRelay = async (agentId: string, relay = 1) => {
    try {
      await api.sendAgentCommand(agentId, 'trigger_relay', { relay, duration: 10 });
      showToast(`فرمان فعال‌سازی رله #${relay} به مینی پی‌سی ارسال شد (مدت ۱۰ ثانیه)`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const testAgentSiren = async (agentId: string) => {
    try {
      await api.sendAgentCommand(agentId, 'siren_pulse', { duration: 12 });
      showToast(`فرمان تست آژیر فیزیکی ۱۱۰ دسی‌بل به مینی‌پی‌سی ارسال شد`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const testAgentOTA = async (agentId: string) => {
    try {
      await api.sendAgentCommand(agentId, 'ota_update', { parameters: { version: '1.3.0', checksum: 'sha256-verified' } });
      showToast(`فرمان ارتقای امنیتی فریم‌ورک OTA به نسخه v1.3.0 ارسال گردید`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Toggle Facility Device
  const handleToggleFacility = async (dev: FacilityItem) => {
    try {
      const newState = dev.state === 'ON' ? 'OFF' : dev.state === 'OPEN' ? 'CLOSED' : 'ON';
      await api.toggleFacility(dev.id, newState);
      setFacilities(prev => prev.map(f => f.id === dev.id ? { ...f, state: newState } : f));
      showToast(`دستگاه ${dev.name} به وضعیت «${newState}» تغییر یافت`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Test Attendance Clock-In
  const testAttendanceClockIn = async () => {
    try {
      await api.logAttendance({
        person_id: 'face-01',
        person_name: 'مهندس رضا مکرانی',
        camera_id: 'cam-01',
        check_type: 'CHECK_IN',
        confidence: 0.99
      });
      showToast('ثبت تردد خودکار با تشخیص چهره با موفقیت ثبت شد', 'success');
      const updated = await api.getAttendance();
      setAttendance(updated);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Place E-Commerce Order
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cartModal) return;
    try {
      await api.createShopOrder({
        customer_name: orderCustomer.name || user?.fullName || 'خریدار سازمانی',
        phone: orderCustomer.phone || user?.phone || '+989120000000',
        total_amount: cartModal.price,
        items: [{ product_id: cartModal.id, product_name: cartModal.name, quantity: 1, unit_price: cartModal.price }]
      });
      setCartModal(null);
      setOrderCustomer({ name: '', phone: '' });
      showToast(`سفارش خرید تجهیزات امنیتی با موفقیت ثبت گردید. پیش‌فاکتور صادر شد.`, 'success');
      const updated = await api.getShopOrders();
      setOrders(updated);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Auto-Discover Cameras
  const handleDiscoverCameras = async () => {
    setDiscovering(true);
    setShowDiscoveryModal(true);
    try {
      showToast('در حال اسکن ساب‌نت شبکه محلی جهت کشف دوربین‌های ONVIF و RTSP...', 'info');
      const res = await api.discoverCameras();
      setDiscoveredCams(res.cameras || []);
      showToast(`${res.cameras?.length || 0} تجهیز ویدئویی در شبکه کشف گردید`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setDiscovering(false);
    }
  };

  // Create Security Rule
  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const armed_states = [];
      if (newRule.armed_away) armed_states.push('ARMED_AWAY');
      if (newRule.armed_stay) armed_states.push('ARMED_STAY');

      const event_types = [];
      if (newRule.human) event_types.push('human_detected');
      if (newRule.face) event_types.push('unknown_face');
      if (newRule.plate) event_types.push('blocked_plate');

      const zones = [];
      if (newRule.zone_entrance) zones.push('entrance');
      if (newRule.zone_perimeter) zones.push('perimeter');
      if (newRule.zone_vault) zones.push('vault');

      await api.addRule({
        name: newRule.name || 'قانون امنیتی جدید',
        armed_states,
        event_types,
        zones,
        actions: {
          trigger_alarm: newRule.trigger_alarm,
          alarm_duration_sec: newRule.duration,
          send_push: newRule.send_push,
          send_sms: newRule.send_sms,
          send_phone_call: newRule.send_call
        }
      });

      setShowAddRule(false);
      showToast('قانون امنیتی جدید با موفقیت فعال گردید', 'success');
      const updated = await api.getRules();
      setRules(updated);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Switch Tenant
  const handleSwitchTenant = async (tenantId: string) => {
    try {
      const res = await api.switchTenant(tenantId);
      setUser(res.user);
      showToast(`سازمان فعال به «${res.tenant.name}» تغییر یافت`, 'success');
      loadAllData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Create New Tenant Organization
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createTenant({
        name: newTenant.name,
        slug: newTenant.slug || undefined,
        plan: newTenant.plan
      });
      showToast(`سازمان «${newTenant.name}» با موفقیت افزوده و فعال شد`, 'success');
      setShowAddTenantModal(false);
      setNewTenant({ name: '', slug: '', plan: 'Enterprise Guard' });
      const tList = await api.getTenants();
      setTenantsList(tList);
      loadAllData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Submit Interactive Face Attendance
  const handleAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.logAttendance({
        person_id: attendanceForm.person_id,
        person_name: attendanceForm.person_name,
        camera_id: attendanceForm.camera_id,
        check_type: attendanceForm.check_type,
        confidence: attendanceForm.confidence
      });
      showToast(`تردد بیومتریک برای «${attendanceForm.person_name}» با موفقیت ثبت شد`, 'success');
      setShowAttendanceModal(false);
      const updated = await api.getAttendance();
      setAttendance(updated);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Add Facility Device
  const handleAddFacilitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.addFacility(newFacility);
      showToast(`دستگاه هوشمند «${newFacility.name}» با موفقیت افزوده شد`, 'success');
      setShowAddFacilityModal(false);
      setNewFacility({ name: '', type: 'LIGHT', zone: 'entrance', agent_id: 'agent-mini-01' });
      const facRes = await api.getFacilities();
      setFacilities(facRes);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Facility Master Control
  const handleFacilityMaster = async (action: 'ALL_OFF' | 'ALL_ON' | 'LOCKDOWN') => {
    try {
      await api.facilityMasterControl(action);
      const actionLabels: Record<string, string> = {
        'ALL_OFF': 'خاموشی کلیه چراغ‌ها و تجهیزات',
        'ALL_ON': 'روشن‌سازی کلیه چراغ‌ها و روشنایی سایت',
        'LOCKDOWN': 'قفل امنیتی سراسری و بستن کلیه گیت‌ها'
      };
      showToast(`فرمان مستر «${actionLabels[action]}» به رله‌های مینی‌پی‌سی ابلاغ شد`, 'success');
      const facRes = await api.getFacilities();
      setFacilities(facRes);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createUser(newUser);
      showToast(`کاربر جدید «${newUser.full_name}» با موفقیت افزوده شد`, 'success');
      setShowAddUserModal(false);
      setNewUser({ email: '', password: '', full_name: '', role: 'OPERATOR', phone: '' });
      const uRes = await api.getUsers();
      setUsersList(uRes);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Delete User
  const handleDeleteUser = async (id: string) => {
    if (!confirm('آیا از حذف دسترسی این کاربر اطمینان دارید؟')) return;
    try {
      await api.deleteUser(id);
      showToast('کاربر با موفقیت حذف گردید', 'success');
      const uRes = await api.getUsers();
      setUsersList(uRes);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Add Product to Store
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.addProduct(newProduct);
      showToast(`محصول «${newProduct.name}» به کاتالوگ فروشگاه افزوده شد`, 'success');
      setShowAddProductModal(false);
      setNewProduct({ name: '', category: 'MINI_PC_AGENT', description: '', price: 15000000, stock: 10, sku: 'MK-NEW-01' });
      const prodRes = await api.getShopProducts();
      setProducts(prodRes);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Update Order Status
  const handleUpdateOrderStatus = async (id: string, status: string) => {
    try {
      await api.updateOrderStatus(id, status);
      showToast(`وضعیت سفارش ${id} به «${status}» تغییر یافت`, 'success');
      const ordRes = await api.getShopOrders();
      setOrders(ordRes);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Search Face Sightings
  const handleSearchFace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPersonName) return;
    try {
      const results = await api.searchFaceSightings(searchPersonName);
      setSearchResults(results);
      showToast(`${results.length} رخداد تردد برای «${searchPersonName}» یافت شد`, 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // PTZ Control
  const handlePTZ = async (cameraId: string, action: string) => {
    try {
      await api.sendPTZ(cameraId, action);
      showToast(`فرمان چرخش دوربین (${action}) ارسال شد`, 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Export Events to CSV
  const handleExportEventsCSV = () => {
    if (events.length === 0) {
      showToast('رویدادی برای استخراج وجود ندارد', 'info');
      return;
    }
    const headers = ['ID', 'Event Type', 'Camera', 'Zone', 'Label', 'Confidence', 'Alarm Triggered', 'Timestamp'];
    const rows = events.map(e => [
      e.id,
      e.event_type,
      e.camera_name || e.camera_id,
      e.zone || '',
      `"${(e.label || '').replace(/"/g, '""')}"`,
      e.confidence,
      e.alarm_triggered ? 'YES' : 'NO',
      e.created_at
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const dl = document.createElement('a');
    dl.setAttribute('href', encodeURI(csvContent));
    dl.setAttribute('download', `makoran_events_${Date.now()}.csv`);
    dl.click();
    showToast('گزارش اکسل/CSV رویدادها با موفقیت صادر شد', 'success');
  };

  // Export Events to JSON
  const handleExportEventsJSON = () => {
    if (events.length === 0) {
      showToast('رویدادی برای استخراج وجود ندارد', 'info');
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(events, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute('href', dataStr);
    dl.setAttribute('download', `makoran_events_${Date.now()}.json`);
    dl.click();
    showToast('فایل JSON رویدادها صادر شد', 'success');
  };

  // Submissions
  const handleAddCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.addCamera({ ...newCam, agent_id: agents[0]?.id || 'agent-mini-01' });
      setShowAddCamera(false);
      setNewCam({ name: '', protocol: 'ONVIF', zone: 'entrance', stream_url: '', channel_index: 1 });
      showToast('دوربین جدید با موفقیت اضافه شد', 'success');
      loadAllData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleAddFace = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.addFace(newFace);
      setShowAddFace(false);
      setNewFace({ name: '', category: 'VIP', phone: '', notes: '' });
      showToast('مشخصات فرد در دایرکتوری چهره ثبت شد', 'success');
      loadAllData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleAddPlate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.addPlate(newPlate);
      setShowAddPlate(false);
      setNewPlate({ plate_number: '', owner_name: '', category: 'ALLOWED', vehicle_model: '' });
      showToast('پلاک خودرو با موفقیت ثبت گردید', 'success');
      loadAllData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Login Screen
  if (!token || !user) {
    return (
      <div className="min-h-screen bg-[#07080B] text-slate-100 flex flex-col justify-center items-center px-4 relative overflow-hidden" dir="rtl">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-[#D4AF37]/5 rounded-full blur-[130px] pointer-events-none"></div>

        <div className="w-full max-w-md bg-[#0F1118]/90 border border-[#D4AF37]/30 rounded-2xl p-8 shadow-2xl backdrop-blur-md relative z-10">
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="w-24 h-24 mb-3 relative flex items-center justify-center p-2 rounded-2xl bg-gradient-to-b from-[#1E1B15] to-[#0E0F14] border border-[#D4AF37]/40 shadow-lg">
              <img src="/logo-icon.svg" alt="Makoran Service Logo" className="w-full h-full object-contain filter drop-shadow" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight gold-gradient-text">
              مَکُران وان • MAKORAN ONE
            </h1>
            <p className="text-xs text-[#ECC665] font-semibold tracking-widest mt-1 uppercase">
              پلتفرم ابری امنیت هوشمند و نظارت تصویری «مکران گارد»
            </p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-red-950/70 border border-red-500/40 rounded-xl text-red-200 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">پست الکترونیکی سازمانی</label>
              <input
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#171A24] border border-slate-700/60 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] text-sm text-white outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">رمز عبور امنیتی</label>
              <input
                type="password"
                value={loginPass}
                onChange={e => setLoginPass(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#171A24] border border-slate-700/60 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] text-sm text-white outline-none transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#D4AF37] via-[#ECC665] to-[#B38622] hover:opacity-95 active:scale-[0.99] text-black shadow-lg shadow-[#D4AF37]/20 transition flex items-center justify-center gap-2"
            >
              {loginLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>ورود به مرکز کنترل امنیت مکران گارد</span>
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800/80 text-center text-xs text-slate-400 flex flex-col gap-1">
            <span>نسخه تجاری ۲.۴ — سرور مرکزی ابری مکران</span>
            <span className="text-[#D4AF37]/80 font-mono-num text-[11px]">Server-Centric AI • On-Demand WebRTC</span>
          </div>
        </div>
      </div>
    );
  }

  const isAlarmTriggered = guardState?.alarm_status === 'TRIGGERED';
  const primaryAgent = agents[0];

  return (
    <div className="min-h-screen bg-[#07080B] text-slate-200 flex flex-col antialiased selection:bg-[#D4AF37]/30 selection:text-white" dir="rtl">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 left-6 z-50 px-5 py-3 rounded-xl shadow-2xl border text-sm flex items-center gap-3 transition-all animate-in fade-in duration-200 ${
          toast.type === 'error' ? 'bg-red-950/90 border-red-500/50 text-red-200' :
          toast.type === 'info' ? 'bg-amber-950/90 border-[#D4AF37]/50 text-[#F5E296]' :
          'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
        }`}>
          {toast.type === 'error' ? <AlertTriangle className="w-5 h-5 text-red-400" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          <span className="font-medium">{toast.text}</span>
        </div>
      )}

      {/* TOP NAVBAR & BRAND HEADER */}
      <header className="sticky top-0 z-40 bg-[#0B0D13]/95 backdrop-blur-md border-b border-[#D4AF37]/25 px-4 lg:px-8 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 p-1 rounded-xl bg-gradient-to-br from-[#1C1810] to-[#0A0B0E] border border-[#D4AF37]/50 shadow-md flex items-center justify-center">
              <img src="/logo-icon.svg" alt="Makoran Logo" className="w-full h-full object-contain filter drop-shadow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight gold-gradient-text">
                  MAKORAN ONE
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#ECC665]">
                  MAKORAN GUARD
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                {tenantsList.length > 1 ? (
                  <select
                    value={user.tenantId}
                    onChange={e => handleSwitchTenant(e.target.value)}
                    className="bg-[#141724] text-xs font-semibold text-[#FFE082] border border-[#D4AF37]/40 rounded-lg px-2 py-0.5 outline-none cursor-pointer hover:border-[#D4AF37]"
                  >
                    {tenantsList.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                ) : (
                  <span>{user.tenantName}</span>
                )}
                <span className="text-slate-600">•</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  سرور ابری هوشمند متصل
                </span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4 bg-[#12151E] px-4 py-1.5 rounded-full border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="text-slate-400">مینی پی‌سی گیت‌وی:</span>
              <span className={`font-semibold ${primaryAgent?.is_live_connected ? 'text-emerald-400' : 'text-amber-400'}`}>
                {primaryAgent?.is_live_connected ? 'آنلاین (Intel N100)' : 'در حال انتظار'}
              </span>
            </div>
            <div className="w-px h-3.5 bg-slate-700"></div>
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-400">هوش مصنوعی سرور:</span>
              <span className="text-blue-400 font-semibold font-mono-num">ACTIVE (Contract v1)</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setAudioEnabled(!audioEnabled);
                showToast(audioEnabled ? 'صدای آژیر سامانه قطع شد' : 'صدای آژیر صوتی فعال گردید', 'info');
              }}
              title={audioEnabled ? 'قطع صدای آژیر سیستم' : 'فعال‌سازی صدای آژیر'}
              className={`p-2 rounded-xl border transition ${
                audioEnabled
                  ? 'bg-[#171A24] border-slate-700/60 text-[#ECC665] hover:border-[#D4AF37]'
                  : 'bg-red-950/40 border-red-800 text-red-400'
              }`}
            >
              <Bell className="w-4 h-4" />
            </button>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold text-slate-200">{user.fullName}</div>
              <div className="text-[10px] text-[#ECC665] font-mono-num uppercase">{user.role}</div>
            </div>
            <button
              onClick={handleLogout}
              title="خروج از حساب"
              className="p-2 rounded-xl bg-[#171A24] border border-slate-700/60 hover:border-red-500/50 hover:bg-red-950/20 text-slate-400 hover:text-red-300 transition"
            >
              <Power className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* CRITICAL ALARM BANNER (When Active) */}
      {isAlarmTriggered && (
        <div className="bg-red-600 text-white px-4 py-3 shadow-2xl border-b-2 border-red-800 animate-pulse flex flex-wrap items-center justify-between gap-4 z-30">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 text-white animate-bounce shrink-0" />
            <div>
              <div className="font-extrabold text-base tracking-wide flex items-center gap-2">
                <span>🚨 هشدار نفوذ امنیتی مکران گارد فعال شده است!</span>
                <span className="text-xs px-2 py-0.5 rounded bg-black/40 font-mono-num">ALARM CONFIRMED</span>
              </div>
              <p className="text-xs text-red-100 mt-0.5">
                دستور فعال‌سازی آژیر و رله به مینی‌پی‌سی ارسال گردید. پیامک و تماس اضطراری مخابره شد.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAlarmAction('ACKNOWLEDGE')}
              className="px-3 py-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-xs font-bold transition border border-white/30"
            >
              تایید رویت (Acknowledge)
            </button>
            <button
              onClick={() => handleAlarmAction('SILENCE')}
              className="px-3 py-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold transition shadow"
            >
              قطع صدای آژیر (Silence)
            </button>
            <button
              onClick={() => handleAlarmAction('RESOLVE')}
              className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-red-600 text-xs font-extrabold transition shadow"
            >
              پایان وضعیت هشدار (Resolve)
            </button>
          </div>
        </div>
      )}

      {/* NAVIGATION TABS */}
      <nav className="bg-[#0D0F16] border-b border-slate-800/80 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto py-2">
          {[
            { id: 'monitor', label: 'مانیتورینگ زنده و گارد', icon: Video },
            { id: 'events', label: 'رویدادها و هشدارهای AI', icon: Activity, count: alarms.length },
            { id: 'cameras', label: 'دوربین‌ها و مینی‌پی‌سی', icon: CamIcon },
            { id: 'attendance', label: 'ثبت تردد پرسنل (Face Attendance)', icon: Clock },
            { id: 'facilities', label: 'تاسیسات و اتوماسیون هوشمند', icon: Lightbulb },
            { id: 'shop', label: 'فروشگاه تجهیزات مکران', icon: ShoppingBag },
            { id: 'rules', label: 'موتور قوانین امنیتی', icon: Sliders },
            { id: 'biometrics', label: 'دایرکتوری چهره و پلاک', icon: Users },
            { id: 'commercial', label: 'اشتراک SaaS و CRM', icon: Building }
          ].map(tab => {
            const Icon = tab.icon;
            const active = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  active
                    ? 'bg-gradient-to-r from-[#D4AF37]/25 to-[#B38622]/15 text-[#FFE082] border border-[#D4AF37]/50 shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#151822]'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-[#ECC665]' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center font-mono-num">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* MAIN VIEW CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">

        {/* TAB 1: MONITOR & LIVE VIEW */}
        {currentTab === 'monitor' && (
          <div className="space-y-6">
            {/* GUARD ARMING CONSOLE */}
            <div className="bg-[#0F1118] border border-[#D4AF37]/35 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#ECC665]">
                    <Shield className="w-4 h-4 text-[#D4AF37]" />
                    <span>کنسول فرماندهی امنیت هوشمند مکران گارد (Makoran Guard Controller)</span>
                  </div>
                  <h2 className="text-xl font-black text-white mt-1">
                    وضعیت فعلی سیستم حفاظتی:
                    <span className={`mr-2 px-3 py-1 rounded-lg text-sm font-extrabold ${
                      guardState?.armed_state === 'ARMED_AWAY' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                      guardState?.armed_state === 'ARMED_STAY' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' :
                      guardState?.armed_state === 'PANIC' ? 'bg-red-500/20 text-red-300 border border-red-500/40' :
                      'bg-slate-700/30 text-slate-300 border border-slate-600'
                    }`}>
                      {guardState?.armed_state === 'ARMED_AWAY' ? '🛡️ فعال - خروج کامل (ARMED AWAY)' :
                       guardState?.armed_state === 'ARMED_STAY' ? '🏠 فعال - در محل (ARMED STAY)' :
                       guardState?.armed_state === 'PANIC' ? '🚨 اضطراری پَنیک (PANIC)' :
                       '🔓 غیرفعال (DISARMED)'}
                    </span>
                  </h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-auto">
                  <button
                    onClick={() => setArmedState('ARMED_AWAY')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition border ${
                      guardState?.armed_state === 'ARMED_AWAY'
                        ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-lg shadow-[#D4AF37]/30'
                        : 'bg-[#171A24] text-slate-300 border-slate-700 hover:border-[#D4AF37]'
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    <span>فعال خروج (Away)</span>
                  </button>

                  <button
                    onClick={() => setArmedState('ARMED_STAY')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition border ${
                      guardState?.armed_state === 'ARMED_STAY'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/30'
                        : 'bg-[#171A24] text-slate-300 border-slate-700 hover:border-blue-500'
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                    <span>فعال در محل (Stay)</span>
                  </button>

                  <button
                    onClick={() => setArmedState('DISARMED')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition border ${
                      guardState?.armed_state === 'DISARMED'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-500/30'
                        : 'bg-[#171A24] text-slate-300 border-slate-700 hover:border-emerald-500'
                    }`}
                  >
                    <Unlock className="w-4 h-4" />
                    <span>غیرفعال (Disarm)</span>
                  </button>

                  <button
                    onClick={() => setArmedState('PANIC')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition border ${
                      guardState?.armed_state === 'PANIC'
                        ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-500/30 animate-pulse'
                        : 'bg-red-950/40 text-red-300 border-red-800 hover:bg-red-900/50'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>آژیر دستی (Panic)</span>
                  </button>
                </div>
              </div>

              {/* Hardware Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                <div className="bg-[#141721] p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-3 h-3 rounded-full ${guardState?.relay_active ? 'bg-amber-400 animate-ping' : 'bg-slate-600'}`}></div>
                    <div>
                      <div className="text-xs font-bold text-slate-200">رله خروجی شماره ۱ (گیت / درب)</div>
                      <div className="text-[11px] text-slate-400">وضعیت: {guardState?.relay_active ? 'وصل (Active)' : 'قطع (Idle)'}</div>
                    </div>
                  </div>
                  <button onClick={() => testAgentRelay(primaryAgent?.id || 'agent-mini-01', 1)} className="px-2.5 py-1 text-[11px] font-semibold bg-[#1F2432] hover:bg-[#D4AF37] hover:text-black rounded-lg border border-slate-700 transition">
                    تست ۱۰ ثانیه
                  </button>
                </div>

                <div className="bg-[#141721] p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-3 h-3 rounded-full ${guardState?.siren_active ? 'bg-red-500 animate-ping' : 'bg-slate-600'}`}></div>
                    <div>
                      <div className="text-xs font-bold text-slate-200">آژیر فیزیکی محیطی (۱۱۰ دسی‌بل)</div>
                      <div className="text-[11px] text-slate-400">وضعیت: {guardState?.siren_active ? 'در حال پخش آژیر!' : 'خاموش'}</div>
                    </div>
                  </div>
                  <button onClick={() => testAgentSiren(primaryAgent?.id || 'agent-mini-01')} className="px-2.5 py-1 text-[11px] font-semibold bg-[#1F2432] hover:bg-red-500 hover:text-white rounded-lg border border-slate-700 transition">
                    تست آژیر
                  </button>
                </div>

                <div className="bg-[#141721] p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-200">معماری بدون استریم مداوم</div>
                    <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>No Request = No Stream</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono-num bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                    WebRTC H.264
                  </span>
                </div>
              </div>
            </div>

            {/* LIVE VIEW CAMERA GRID (WebRTC On-Demand) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Video className="w-4 h-4 text-[#D4AF37]" />
                    <span>ماتریس نظارت تصویری دوربین‌ها (Live View Plane)</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    با کلیک روی «مشاهده زنده»، خط لوله WebRTC مستقیماً از مینی‌پی‌سی استارت می‌شود.
                  </p>
                </div>
                <div className="text-xs font-medium text-slate-400 bg-[#0F1118] px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
                  <span>پخش فعال:</span>
                  <span className="text-[#ECC665] font-bold font-mono-num">{Object.keys(activeLiveStreams).length} دوربین</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cameras.map(cam => {
                  const isLive = !!activeLiveStreams[cam.id];
                  const stats = streamingStats[cam.id] || { fps: 25, kbps: 2200, frame: 1 };

                  return (
                    <div
                      key={cam.id}
                      className={`bg-[#0D0F16] border rounded-2xl overflow-hidden shadow-xl transition relative flex flex-col ${
                        isLive ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]/50' : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                        {isLive ? (
                          <div className="w-full h-full relative bg-gradient-to-br from-slate-950 via-[#0e121b] to-[#0A0C12] flex items-center justify-center">
                            {/* Animated Crosshair & Bounding Box Simulation */}
                            <div className="absolute inset-0 flex flex-col justify-between p-3 pointer-events-none z-10">
                              <div className="flex justify-between items-start">
                                <div className="bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[11px] text-emerald-400 font-mono-num flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                                  <span>LIVE WebRTC • {stats.fps} FPS • {(stats.kbps / 1000).toFixed(1)} Mbps</span>
                                </div>
                                <div className="bg-black/60 px-2 py-0.5 rounded text-[10px] text-[#ECC665] font-mono-num">
                                  MAKORAN GUARD
                                </div>
                              </div>
                              <div className="flex justify-between items-end text-[10px] text-slate-400 font-mono-num">
                                <span>ZONE: {cam.zone.toUpperCase()}</span>
                                <span>{new Date().toLocaleTimeString('fa-IR')}</span>
                              </div>
                            </div>

                            <div className="text-center">
                              <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center mx-auto mb-2 animate-pulse">
                                <Video className="w-8 h-8 text-[#D4AF37]" />
                              </div>
                              <div className="text-xs font-semibold text-slate-200">جریان زنده تصویری برقرار است</div>
                              <div className="text-[10px] text-slate-400 mt-0.5 font-mono-num">
                                Session: {activeLiveStreams[cam.id].sessionId}
                              </div>
                            </div>

                            {/* Floating PTZ & Preset Controls on Active Stream */}
                            <div className="absolute bottom-2 left-2 z-20 bg-black/70 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/80 flex items-center gap-1 shadow-lg">
                              <button onClick={() => handlePTZ(cam.id, 'pan_left')} title="چرخش به چپ" className="p-1 hover:bg-[#D4AF37] hover:text-black rounded text-[10px] text-slate-300 transition">◀</button>
                              <button onClick={() => handlePTZ(cam.id, 'tilt_up')} title="چرخش به بالا" className="p-1 hover:bg-[#D4AF37] hover:text-black rounded text-[10px] text-slate-300 transition">▲</button>
                              <button onClick={() => handlePTZ(cam.id, 'tilt_down')} title="چرخش به پایین" className="p-1 hover:bg-[#D4AF37] hover:text-black rounded text-[10px] text-slate-300 transition">▼</button>
                              <button onClick={() => handlePTZ(cam.id, 'pan_right')} title="چرخش به راست" className="p-1 hover:bg-[#D4AF37] hover:text-black rounded text-[10px] text-slate-300 transition">▶</button>
                              <div className="w-px h-3 bg-slate-600 mx-0.5"></div>
                              <button onClick={() => handlePTZ(cam.id, 'zoom_in')} title="بزرگنمایی Zoom +" className="px-1.5 py-0.5 hover:bg-[#D4AF37] hover:text-black rounded text-[10px] font-mono-num text-slate-300 transition">+</button>
                              <button onClick={() => handlePTZ(cam.id, 'zoom_out')} title="کوچک‌نمایی Zoom -" className="px-1.5 py-0.5 hover:bg-[#D4AF37] hover:text-black rounded text-[10px] font-mono-num text-slate-300 transition">-</button>
                              <div className="w-px h-3 bg-slate-600 mx-0.5"></div>
                              <button onClick={() => handlePTZ(cam.id, 'preset_1')} title="پریست ۱: گیت ورودی" className="px-1.5 py-0.5 hover:bg-[#ECC665] hover:text-black rounded text-[9px] font-bold text-slate-400 transition">P1</button>
                              <button onClick={() => handlePTZ(cam.id, 'preset_2')} title="پریست ۲: دیوار پیرامونی" className="px-1.5 py-0.5 hover:bg-[#ECC665] hover:text-black rounded text-[9px] font-bold text-slate-400 transition">P2</button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center p-6">
                            <div className="w-14 h-14 rounded-2xl bg-[#141722] border border-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-500">
                              <Video className="w-6 h-6" />
                            </div>
                            <div className="text-xs font-bold text-slate-300">{cam.name}</div>
                            <div className="text-[11px] text-slate-400 mt-1">
                              پروتکل: {cam.protocol} • زون: {cam.zone}
                            </div>
                            <div className="mt-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] text-slate-400 font-mono-num">
                              <span>NO STREAM (Bandwidth Saved)</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="p-3.5 bg-[#10131C] border-t border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-2">
                            <span>{cam.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono-num">
                              CH{cam.channel_index}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono-num mt-0.5">
                            {cam.resolution} @ {cam.fps}fps • {cam.protocol}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => triggerAISimulation('human_detected', cam.id)}
                            title="شبیه‌سازی رویداد و ارسال اسنپ‌شات به هوش مصنوعی"
                            disabled={aiSimulating}
                            className="p-2 rounded-xl bg-[#171B26] hover:bg-[#D4AF37]/20 border border-slate-700 text-slate-300 hover:text-[#ECC665] text-xs transition"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => toggleLiveStream(cam)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                              isLive
                                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40'
                                : 'bg-[#D4AF37] hover:bg-[#ECC665] text-black shadow-md shadow-[#D4AF37]/20'
                            }`}
                          >
                            {isLive ? (
                              <>
                                <Square className="w-3.5 h-3.5 fill-current" />
                                <span>توقف پخش</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>مشاهده زنده</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SERVER-SIDE AI THREAT PIPELINE DEMONSTRATOR */}
            <div className="bg-[#0F1118] border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                    <span>تست زنده خط لوله هوش مصنوعی سرور (Server AI Pipeline Simulator)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    بررسی فرآیند دریافت اسنپ‌شات از مینی‌پی‌سی، آنالیز در سرور ابری، ارزیابی در موتور قوانین و صدور دستور آژیر.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-[#161924] px-3 py-1 rounded-lg border border-slate-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>استاندارد قرارداد: Contract v1</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-4">
                <button onClick={() => triggerAISimulation('human_detected')} disabled={aiSimulating} className="p-3 rounded-xl bg-[#141722] hover:bg-[#1A1F2E] border border-slate-800 hover:border-[#D4AF37] text-right transition group">
                  <div className="text-xs font-bold text-white group-hover:text-[#ECC665]">تشخیص انسان</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Human Detection</div>
                </button>

                <button onClick={() => triggerAISimulation('unknown_face')} disabled={aiSimulating} className="p-3 rounded-xl bg-[#141722] hover:bg-[#1A1F2E] border border-slate-800 hover:border-amber-500 text-right transition group">
                  <div className="text-xs font-bold text-white group-hover:text-amber-400">چهره ناشناس</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Unknown Face Alert</div>
                </button>

                <button onClick={() => triggerAISimulation('vip_face')} disabled={aiSimulating} className="p-3 rounded-xl bg-[#141722] hover:bg-[#1A1F2E] border border-slate-800 hover:border-blue-500 text-right transition group">
                  <div className="text-xs font-bold text-white group-hover:text-blue-400">شناسایی چهره VIP</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">VIP Face Recognition</div>
                </button>

                <button onClick={() => triggerAISimulation('blocked_plate')} disabled={aiSimulating} className="p-3 rounded-xl bg-[#141722] hover:bg-[#1A1F2E] border border-slate-800 hover:border-red-500 text-right transition group">
                  <div className="text-xs font-bold text-white group-hover:text-red-400">پلاک مسدود / حراست</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Blacklisted Plate</div>
                </button>

                <button onClick={() => triggerAISimulation('vehicle_detected')} disabled={aiSimulating} className="p-3 rounded-xl bg-[#141722] hover:bg-[#1A1F2E] border border-slate-800 hover:border-emerald-500 text-right transition group">
                  <div className="text-xs font-bold text-white group-hover:text-emerald-400">تشخیص خودرو</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Vehicle Classification</div>
                </button>
              </div>

              {aiLastResult && (
                <div className="mt-4 p-4 rounded-xl bg-[#090A0E] border border-slate-800 font-mono text-xs">
                  <div className="flex items-center justify-between text-slate-400 pb-2 mb-2 border-b border-slate-800">
                    <span className="text-[#ECC665] font-bold">خروجی هوش مصنوعی سرور (JSON AI Response):</span>
                    <span className="text-emerald-400 font-mono-num">{aiLastResult.processing_time_ms}ms latency</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-slate-300 font-bold mb-1">Detections:</div>
                      {aiLastResult.detections?.map((d: any, idx: number) => (
                        <div key={idx} className="bg-[#12151F] p-2 rounded border border-slate-800 text-[11px] mb-1">
                          <div className="text-[#FFE082] font-semibold">{d.label}</div>
                          <div className="text-slate-400 text-[10px]">
                            Type: {d.type} • Confidence: {(d.confidence * 100).toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <div className="text-slate-300 font-bold mb-1">Rule Engine Decision:</div>
                      <div className="bg-[#12151F] p-2.5 rounded border border-slate-800 text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">تصمیم امنیتی:</span>
                          <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                            aiLastResult.decision === 'alarm' ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'bg-blue-500/20 text-blue-300'
                          }`}>
                            {aiLastResult.decision.toUpperCase()}
                          </span>
                        </div>
                        <div className="mt-2 text-slate-400 text-[10px]">
                          دستورات ارسالی به مینی‌پی‌سی: {aiLastResult.actions?.length || 0} مورد
                        </div>
                        {aiLastResult.actions?.map((act: any, i: number) => (
                          <div key={i} className="text-emerald-400 text-[10px] mt-0.5">
                            → {act.command} (Relay: {act.relay || 1}, Duration: {act.duration}s)
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: EVENTS & ALARMS */}
        {currentTab === 'events' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#D4AF37]" />
                  <span>لاگ رویدادها و هشدارهای امنیتی مکران</span>
                </h3>
                <p className="text-xs text-slate-400">تمامی رویدادهای تصویری پس از پردازش هوش مصنوعی در سرور و تایید موتور قوانین در این بخش بایگانی می‌شوند.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportEventsCSV}
                  className="px-3 py-1.5 rounded-xl bg-[#141722] hover:bg-[#1A1F2E] border border-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>خروجی CSV</span>
                </button>
                <button
                  onClick={handleExportEventsJSON}
                  className="px-3 py-1.5 rounded-xl bg-[#141722] hover:bg-[#1A1F2E] border border-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition"
                >
                  <span>خروجی JSON</span>
                </button>
                <button onClick={loadAllData} className="px-3 py-1.5 rounded-xl bg-[#141722] hover:bg-[#1A1F2E] border border-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>بروزرسانی</span>
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#11131C] p-3 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'ALL', label: 'همه رویدادها' },
                  { id: 'human', label: 'انسان (Human)' },
                  { id: 'face', label: 'چهره (Face)' },
                  { id: 'vehicle', label: 'خودرو (Vehicle)' },
                  { id: 'plate', label: 'پلاک‌خوان (LPR)' },
                  { id: 'alarm', label: 'فقط آژیرها (Alarms)' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setEventFilterType(tab.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
                      eventFilterType === tab.id
                        ? 'bg-[#D4AF37] text-black shadow font-bold'
                        : 'bg-[#181B26] text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="w-full sm:w-72">
                <input
                  type="text"
                  placeholder="جستجوی عنوان، دوربین یا زون..."
                  value={eventSearchText}
                  onChange={e => setEventSearchText(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#181B26] border border-slate-700 text-xs text-white"
                />
              </div>
            </div>

            <div className="bg-[#0F1118] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="divide-y divide-slate-800/80">
                {events.filter(ev => {
                  if (eventFilterType === 'human' && !ev.event_type.includes('human')) return false;
                  if (eventFilterType === 'face' && !ev.event_type.includes('face')) return false;
                  if (eventFilterType === 'vehicle' && !ev.event_type.includes('vehicle')) return false;
                  if (eventFilterType === 'plate' && !ev.event_type.includes('plate')) return false;
                  if (eventFilterType === 'alarm' && !ev.alarm_triggered) return false;
                  if (eventSearchText) {
                    const q = eventSearchText.toLowerCase();
                    const matchLabel = ev.label?.toLowerCase().includes(q);
                    const matchCam = (ev.camera_name || ev.camera_id)?.toLowerCase().includes(q);
                    const matchZone = ev.zone?.toLowerCase().includes(q);
                    if (!matchLabel && !matchCam && !matchZone) return false;
                  }
                  return true;
                }).length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">هیچ رویدادی مطابق با فیلترها یافت نشد.</div>
                ) : (
                  events.filter(ev => {
                    if (eventFilterType === 'human' && !ev.event_type.includes('human')) return false;
                    if (eventFilterType === 'face' && !ev.event_type.includes('face')) return false;
                    if (eventFilterType === 'vehicle' && !ev.event_type.includes('vehicle')) return false;
                    if (eventFilterType === 'plate' && !ev.event_type.includes('plate')) return false;
                    if (eventFilterType === 'alarm' && !ev.alarm_triggered) return false;
                    if (eventSearchText) {
                      const q = eventSearchText.toLowerCase();
                      const matchLabel = ev.label?.toLowerCase().includes(q);
                      const matchCam = (ev.camera_name || ev.camera_id)?.toLowerCase().includes(q);
                      const matchZone = ev.zone?.toLowerCase().includes(q);
                      if (!matchLabel && !matchCam && !matchZone) return false;
                    }
                    return true;
                  }).map(ev => (
                    <div
                      key={ev.id}
                      onClick={() => setSelectedEventModal(ev)}
                      className="p-4 hover:bg-[#131622] transition flex items-center justify-between gap-4 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          ev.alarm_triggered ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                        }`}>
                          {ev.alarm_triggered ? <AlertTriangle className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white group-hover:text-[#ECC665] flex items-center gap-2 transition">
                            <span>{ev.label}</span>
                            {ev.alarm_triggered === 1 && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-500 text-white font-bold">ALARM</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>دوربین: {ev.camera_name || ev.camera_id}</span>
                            <span>•</span>
                            <span>زون: {ev.zone || 'عمومی'}</span>
                            <span>•</span>
                            <span className="text-[#ECC665] font-mono-num">اطمینان: {(ev.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-left font-mono-num text-xs text-slate-400 shrink-0">
                        <div>{new Date(ev.created_at).toLocaleDateString('fa-IR')}</div>
                        <div className="text-[11px] text-slate-500">{new Date(ev.created_at).toLocaleTimeString('fa-IR')}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CAMERAS & AGENTS */}
        {currentTab === 'cameras' && (
          <div className="space-y-6">
            {primaryAgent && (
              <div className="bg-[#0F1118] border border-[#D4AF37]/30 rounded-2xl p-6 shadow-xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1C1810] to-[#12141D] border border-[#D4AF37]/50 flex items-center justify-center">
                      <Cpu className="w-6 h-6 text-[#D4AF37]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white">{primaryAgent.name}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                          {primaryAgent.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 font-mono-num">
                        IP: {primaryAgent.ip_address} • فریم‌ورک: v{primaryAgent.version} • معماری: Intel N100 Linux Mini PC
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button onClick={() => testAgentRelay(primaryAgent.id, 1)} className="px-3 py-1.5 rounded-xl bg-[#171B26] hover:bg-[#D4AF37] hover:text-black border border-slate-700 text-xs font-semibold transition">
                      تست رله ۱
                    </button>
                    <button onClick={() => testAgentSiren(primaryAgent.id)} className="px-3 py-1.5 rounded-xl bg-[#171B26] hover:bg-red-500 hover:text-white border border-slate-700 text-xs font-semibold transition">
                      تست آژیر
                    </button>
                    <button onClick={() => testAgentOTA(primaryAgent.id)} className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B38622] text-black text-xs font-bold transition flex items-center gap-1.5 shadow">
                      <Download className="w-3.5 h-3.5" />
                      <span>ارتقای OTA فوری</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                  <div className="bg-[#141722] p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">بار پردازنده مینی‌پی‌سی</div>
                    <div className="text-xl font-bold font-mono-num text-emerald-400 mt-1">{primaryAgent.cpu_usage}%</div>
                    <div className="text-[10px] text-slate-500 mt-1.5">سبک (بدون هوش مصنوعی سنگین)</div>
                  </div>

                  <div className="bg-[#141722] p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">حافظه رم (RAM)</div>
                    <div className="text-xl font-bold font-mono-num text-blue-400 mt-1">{(primaryAgent.memory_usage_mb / 1024).toFixed(1)} GB</div>
                    <div className="text-[10px] text-slate-500 mt-1.5">از ۸ گیگابایت موجود</div>
                  </div>

                  <div className="bg-[#141722] p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">فضای ذخیره محلی (SSD)</div>
                    <div className="text-xl font-bold font-mono-num text-purple-400 mt-1">{primaryAgent.disk_used_gb} GB</div>
                    <div className="text-[10px] text-slate-500 mt-1.5">از ۲۵۶ گیگابایت NVMe</div>
                  </div>

                  <div className="bg-[#141722] p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">اتصال کلاود کنترل‌پلین</div>
                    <div className="text-xl font-bold font-mono-num text-emerald-400 mt-1">SECURE WSS</div>
                    <div className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
                      <Wifi className="w-3 h-3 text-emerald-400" />
                      <span>اتصال خروجی امن (بدون پورت فوروارد)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FLEET OTA DEPLOYMENT BAR */}
            <div className="bg-[#121520] border border-[#D4AF37]/40 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-[#D4AF37]" />
                  <span>مدیریت یکپارچه ناوگان مینی‌پی‌سی مکران (Fleet OTA Deployment Manager)</span>
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  ارتقای اتمیک فریم‌ورک تمام گیت‌وی‌های منطقه مکران (چابهار، کنارک، جاسک) با اعتبارسنجی یکپارچگی SHA256 و رول‌بک خودکار.
                </p>
              </div>
              <button
                onClick={handleFleetOTA}
                disabled={otaDeploying}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B38622] hover:opacity-95 text-black text-xs font-bold transition flex items-center gap-2 shadow shrink-0"
              >
                {otaDeploying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>{otaDeploying ? 'در حال ارسال و استقرار OTA...' : 'ارتقای سراسری ناوگان به v1.3.0'}</span>
              </button>
            </div>

            {/* REGIONAL AGENTS FLEET GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {agents.map(ag => {
                const progress = otaProgress[ag.id];
                return (
                  <div key={ag.id} className="bg-[#0F1118] border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                        <span className="text-xs font-bold text-white truncate max-w-[180px]">{ag.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                          {ag.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono-num space-y-1 mt-2">
                        <div>IP: {ag.ip_address}</div>
                        <div>نسخه فعلی: v{ag.version}</div>
                        <div>بار CPU: {ag.cpu_usage}% • حافظه: {(ag.memory_usage_mb / 1024).toFixed(1)} GB</div>
                      </div>

                      {progress !== undefined && (
                        <div className="mt-3">
                          <div className="flex justify-between text-[10px] text-slate-400 font-mono-num mb-1">
                            <span>OTA Progress:</span>
                            <span>{progress}%</span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-[#D4AF37] h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      <button onClick={() => testAgentRelay(ag.id, 1)} className="px-2 py-1 rounded bg-[#181C28] hover:bg-[#D4AF37] hover:text-black font-semibold text-slate-300 transition">
                        تست رله ۱
                      </button>
                      <button onClick={() => testAgentSiren(ag.id)} className="px-2 py-1 rounded bg-[#181C28] hover:bg-red-500 hover:text-white font-semibold text-slate-300 transition">
                        تست آژیر
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <CamIcon className="w-4 h-4 text-[#D4AF37]" />
                    <span>فهرست دوربین‌ها و آداپتورهای CCTV متصل</span>
                  </h3>
                  <p className="text-xs text-slate-400">پشتیبانی از پروتکل‌های استاندارد ONVIF و RTSP و برندهای داهوا (Dahua)، هایک‌ویژن (Hikvision) و ایکس‌ام‌آی (XMEye).</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDiscoverCameras}
                    disabled={discovering}
                    className="px-3.5 py-1.5 rounded-xl bg-[#141722] hover:bg-[#1A1F2E] border border-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 shadow"
                  >
                    {discovering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5 text-[#D4AF37]" />}
                    <span>{discovering ? 'در حال اسکن ساب‌نت...' : 'اسکن شبکه (Auto-Discover)'}</span>
                  </button>
                  <button onClick={() => setShowAddCamera(true)} className="px-3.5 py-1.5 rounded-xl bg-[#D4AF37] hover:bg-[#ECC665] text-black text-xs font-bold transition flex items-center gap-1.5 shadow">
                    <span>+ افزودن دستی</span>
                  </button>
                </div>
              </div>

              {/* Discovery Results Modal */}
              {showDiscoveryModal && (
                <div className="bg-[#12151F] border border-[#D4AF37]/50 rounded-2xl p-6 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-[#D4AF37]" />
                      <h4 className="text-sm font-bold text-white">تجهیزات کشف‌شده روی شبکه محلی مینی‌پی‌سی (ONVIF WS-Discovery)</h4>
                    </div>
                    <button onClick={() => setShowDiscoveryModal(false)} className="text-slate-400 hover:text-white">✕</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {discoveredCams.map((dc, i) => (
                      <div key={i} className="bg-[#171A24] p-3.5 rounded-xl border border-slate-700 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-xs">{dc.manufacturer}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-[#ECC665] font-mono-num">{dc.protocol}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono-num mt-1">
                            IP: {dc.ip}:{dc.port} • Model: {dc.model}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono-num truncate mt-0.5">
                            MAC: {dc.macAddress}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            api.addCamera({
                              name: `${dc.manufacturer} (${dc.ip})`,
                              protocol: dc.protocol,
                              zone: 'entrance',
                              stream_url: dc.rtspUrl,
                              channel_index: 1,
                              agent_id: agents[0]?.id || 'agent-mini-01'
                            });
                            showToast(`دوربین ${dc.ip} با موفقیت به ماتریس نظارتی افزوده شد`, 'success');
                            loadAllData();
                            setShowDiscoveryModal(false);
                          }}
                          className="mt-3 py-1.5 px-3 rounded-lg bg-[#D4AF37] hover:bg-[#ECC665] text-black text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <span>+ افزودن به مانیتورینگ</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showAddCamera && (
                <div className="bg-[#12151F] border border-[#D4AF37]/50 rounded-2xl p-6 shadow-2xl">
                  <h4 className="text-sm font-bold text-white mb-3">افزودن دوربین / کانال جدید به سیستم</h4>
                  <form onSubmit={handleAddCamera} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">نام دوربین</label>
                      <input type="text" placeholder="دوربین سالن اداری" value={newCam.name} onChange={e => setNewCam({ ...newCam, name: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-xs text-white" required />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">پروتکل ارتباطی (Adapter)</label>
                      <select value={newCam.protocol} onChange={e => setNewCam({ ...newCam, protocol: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-xs text-white">
                        <option value="ONVIF">ONVIF (استاندارد جهانی)</option>
                        <option value="RTSP">Universal RTSP</option>
                        <option value="DAHUA">Dahua Technology</option>
                        <option value="HIKVISION">Hikvision ISAPI</option>
                        <option value="XMEYE">XMEye / Xiongmai</option>
                        <option value="VIRTUAL">Virtual Simulator</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">زون حفاظتی (Security Zone)</label>
                      <select value={newCam.zone} onChange={e => setNewCam({ ...newCam, zone: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-xs text-white">
                        <option value="entrance">ورودی اصلی (Entrance)</option>
                        <option value="perimeter">پیرامونی و دیوار (Perimeter)</option>
                        <option value="gate_lpr">گیت پلاک‌خوان (Gate LPR)</option>
                        <option value="vault">خزانه و گاوصندوق (Vault)</option>
                        <option value="parking">پارکینگ (Parking)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-3 flex justify-end gap-2 mt-2">
                      <button type="button" onClick={() => setShowAddCamera(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300">انصراف</button>
                      <button type="submit" className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black text-xs font-bold">ثبت و اتصال دوربین</button>
                    </div>
                  </form>
                </div>
              )}

              <div className="bg-[#0F1118] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#141722] text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">نام دوربین</th>
                      <th className="p-3.5">آداپتور / برند</th>
                      <th className="p-3.5">زون حفاظتی</th>
                      <th className="p-3.5">کیفیت و فریم</th>
                      <th className="p-3.5">وضعیت</th>
                      <th className="p-3.5 text-left">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {cameras.map(cam => (
                      <tr key={cam.id} className="hover:bg-[#131622] transition">
                        <td className="p-3.5 font-bold text-white">{cam.name}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-[#ECC665] font-mono-num text-[11px]">{cam.protocol}</span>
                        </td>
                        <td className="p-3.5 text-slate-300">{cam.zone}</td>
                        <td className="p-3.5 font-mono-num text-slate-400">{cam.resolution} @ {cam.fps}fps</td>
                        <td className="p-3.5">
                          <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            {cam.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-left">
                          <button onClick={() => toggleLiveStream(cam)} className="px-3 py-1 rounded-lg bg-[#181C28] hover:bg-[#D4AF37] hover:text-black font-semibold text-[11px] transition">
                            مشاهده استریم
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ATTENDANCE & FACE CLOCK-IN */}
        {currentTab === 'attendance' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#D4AF37]" />
                  <span>سامانه حضور و غیاب هوشمند با تشخیص چهره (Face Attendance)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  ثبت خودکار ورود و خروج پرسنل با هوش مصنوعی سرور بدون نیاز به تماس فیزیکی یا کارت تردد.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAttendanceModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B38622] text-black text-xs font-bold transition flex items-center gap-1.5 shadow"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>اسکن و ثبت تردد هوشمند</span>
                </button>
              </div>
            </div>

            {/* Attendance KPI Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono-num">
              <div className="bg-[#0F1118] border border-slate-800 p-4 rounded-xl">
                <div className="text-slate-400 font-sans">حاضرین شیفت جاری</div>
                <div className="text-xl font-black text-emerald-400 mt-1">
                  {attendance.filter(a => a.check_type === 'CHECK_IN').length} نفر
                </div>
                <div className="text-[10px] text-slate-500 font-sans mt-0.5">وضعیت فعال در سایت</div>
              </div>
              <div className="bg-[#0F1118] border border-slate-800 p-4 rounded-xl">
                <div className="text-slate-400 font-sans">خروج‌های ثبت‌شده</div>
                <div className="text-xl font-black text-amber-400 mt-1">
                  {attendance.filter(a => a.check_type === 'CHECK_OUT').length} مورد
                </div>
                <div className="text-[10px] text-slate-500 font-sans mt-0.5">ثبت‌شده توسط گیت‌ها</div>
              </div>
              <div className="bg-[#0F1118] border border-slate-800 p-4 rounded-xl">
                <div className="text-slate-400 font-sans">میانگین تطابق هوش مصنوعی</div>
                <div className="text-xl font-black text-[#ECC665] mt-1">98.6%</div>
                <div className="text-[10px] text-slate-500 font-sans mt-0.5">مدل استخراج بردار چهره</div>
              </div>
              <div className="bg-[#0F1118] border border-slate-800 p-4 rounded-xl">
                <div className="text-slate-400 font-sans">پرسنل تایید‌شده در سیستم</div>
                <div className="text-xl font-black text-white mt-1">
                  {faces.filter(f => f.category === 'EMPLOYEE' || f.category === 'VIP').length} پرسنل
                </div>
                <div className="text-[10px] text-slate-500 font-sans mt-0.5">دایرکتوری بیومتریک</div>
              </div>
            </div>

            {/* Attendance Check-in Modal */}
            {showAttendanceModal && (
              <div className="bg-[#121520] border border-[#D4AF37]/50 rounded-2xl p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                    <span>ثبت تردد پرسنل با تطبیق بردار چهره (Face Biometric Check-In)</span>
                  </h4>
                  <button onClick={() => setShowAttendanceModal(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <form onSubmit={handleAttendanceSubmit} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 mb-1">پرسنل مورد نظر</label>
                      <select
                        value={attendanceForm.person_name}
                        onChange={e => {
                          const selected = faces.find(f => f.name === e.target.value);
                          setAttendanceForm({
                            ...attendanceForm,
                            person_name: e.target.value,
                            person_id: selected?.id || 'face-custom'
                          });
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-white"
                      >
                        {faces.map(f => (
                          <option key={f.id} value={f.name}>{f.name} ({f.category})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">دوربین گیت ثبت‌کننده</label>
                      <select
                        value={attendanceForm.camera_id}
                        onChange={e => setAttendanceForm({ ...attendanceForm, camera_id: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-white"
                      >
                        {cameras.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.zone})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">نوع تردد</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setAttendanceForm({ ...attendanceForm, check_type: 'CHECK_IN' })}
                          className={`py-2 rounded-xl font-bold transition ${
                            attendanceForm.check_type === 'CHECK_IN' ? 'bg-emerald-500 text-black shadow' : 'bg-[#181B26] text-slate-400'
                          }`}
                        >
                          ثبت ورود (Check-In)
                        </button>
                        <button
                          type="button"
                          onClick={() => setAttendanceForm({ ...attendanceForm, check_type: 'CHECK_OUT' })}
                          className={`py-2 rounded-xl font-bold transition ${
                            attendanceForm.check_type === 'CHECK_OUT' ? 'bg-amber-500 text-black shadow' : 'bg-[#181B26] text-slate-400'
                          }`}
                        >
                          ثبت خروج (Check-Out)
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">
                        دقت تطابق چهره: {(attendanceForm.confidence * 100).toFixed(0)}%
                      </label>
                      <input
                        type="range"
                        min="0.80"
                        max="0.99"
                        step="0.01"
                        value={attendanceForm.confidence}
                        onChange={e => setAttendanceForm({ ...attendanceForm, confidence: parseFloat(e.target.value) })}
                        className="w-full accent-[#D4AF37]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                    <button type="button" onClick={() => setShowAttendanceModal(false)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300">انصراف</button>
                    <button type="submit" className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-bold">تایید و ثبت تردد بیومتریک</button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-[#0F1118] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#141722] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">نام پرسنل</th>
                    <th className="p-3.5">نوع تردد</th>
                    <th className="p-3.5">دوربین ثبت‌کننده</th>
                    <th className="p-3.5">میزان اطمینان چهره</th>
                    <th className="p-3.5 text-left">زمان و تاریخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {attendance.map(att => (
                    <tr key={att.id} className="hover:bg-[#131622] transition">
                      <td className="p-3.5 font-bold text-white flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-[#D4AF37]/40 flex items-center justify-center text-[10px] text-[#ECC665]">
                          {att.person_name.substring(0, 1)}
                        </div>
                        <span>{att.person_name}</span>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          att.check_type === 'CHECK_IN' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}>
                          {att.check_type === 'CHECK_IN' ? 'ورود (Check-in)' : 'خروج (Check-out)'}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-300 font-mono-num">{att.camera_id}</td>
                      <td className="p-3.5 font-mono-num text-[#ECC665]">{(att.confidence * 100).toFixed(1)}% Match</td>
                      <td className="p-3.5 text-left font-mono-num text-slate-400">
                        {new Date(att.timestamp).toLocaleString('fa-IR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: FACILITY MANAGEMENT & BUILDING AUTOMATION */}
        {currentTab === 'facilities' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-[#D4AF37]" />
                  <span>مدیریت تاسیسات، تجهیزات هوشمند و اتوماسیون ساختمان</span>
                </h3>
                <p className="text-xs text-slate-400">
                  کنترل متمرکز روشنایی، قفل‌های الکترونیکی، سیستم تهویه، جک بازویی و پایش مصرف انرژی از طریق رله‌های مینی‌پی‌سی مکران.
                </p>
              </div>

              {/* Master Control Shortcuts */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleFacilityMaster('ALL_OFF')}
                  className="px-3 py-1.5 rounded-xl bg-[#141722] hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Power className="w-3.5 h-3.5 text-amber-400" />
                  <span>خاموشی همه چراغ‌ها</span>
                </button>
                <button
                  onClick={() => handleFacilityMaster('LOCKDOWN')}
                  className="px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-700 text-red-300 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>قرنطینه امنیتی (Lockdown)</span>
                </button>
                <button
                  onClick={() => setShowAddFacilityModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#D4AF37] hover:bg-[#ECC665] text-black text-xs font-bold transition flex items-center gap-1.5 shadow"
                >
                  <span>+ افزودن رله / دستگاه جدید</span>
                </button>
              </div>
            </div>

            {/* Add Facility Device Modal */}
            {showAddFacilityModal && (
              <div className="bg-[#121520] border border-[#D4AF37]/50 rounded-2xl p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#D4AF37]" />
                    <span>تعریف و پیکربندی رله هوشمند تاسیسات</span>
                  </h4>
                  <button onClick={() => setShowAddFacilityModal(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <form onSubmit={handleAddFacilitySubmit} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-400 mb-1">نام دستگاه / رله</label>
                      <input
                        type="text"
                        placeholder="مثال: روشنایی سوله شماره ۲"
                        value={newFacility.name}
                        onChange={e => setNewFacility({ ...newFacility, name: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">نوع تجهیز</label>
                      <select
                        value={newFacility.type}
                        onChange={e => setNewFacility({ ...newFacility, type: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-white"
                      >
                        <option value="LIGHT">روشنایی (Light Control)</option>
                        <option value="HVAC">سیستم تهویه و سرمایش (HVAC)</option>
                        <option value="SMART_LOCK">قفل برقی ضدسرقت (Smart Lock)</option>
                        <option value="GATE">راهبند / جک بازویی خودرو (Smart Gate)</option>
                        <option value="POWER_METER">پاورمتر و مانیتور مصرف برق</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">موقعیت و زون</label>
                      <input
                        type="text"
                        placeholder="مثال: perimeter / entrance"
                        value={newFacility.zone}
                        onChange={e => setNewFacility({ ...newFacility, zone: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-white"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                    <button type="button" onClick={() => setShowAddFacilityModal(false)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300">انصراف</button>
                    <button type="submit" className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-bold">افزودن و فعال‌سازی رله</button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {facilities.map(dev => (
                <div key={dev.id} className="bg-[#0F1118] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <span className="text-xs font-bold text-white">{dev.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono-num">{dev.type}</span>
                    </div>

                    <div className="mt-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">موقعیت و زون:</span>
                        <span className="text-slate-200 font-semibold">{dev.zone}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">وضعیت کنونی:</span>
                        <span className={`font-bold font-mono-num ${
                          dev.state === 'ON' || dev.state === 'OPEN' ? 'text-emerald-400' : 'text-slate-400'
                        }`}>
                          {dev.state} {dev.value > 0 ? `(${dev.value})` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-mono-num">
                      رله متصل به Agent
                    </span>
                    <button
                      onClick={() => handleToggleFacility(dev)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        dev.state === 'ON' || dev.state === 'OPEN'
                          ? 'bg-amber-500 hover:bg-amber-400 text-black shadow'
                          : 'bg-[#181C28] hover:bg-slate-700 text-slate-200 border border-slate-700'
                      }`}
                    >
                      تغییر وضعیت (سوئیچ)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: E-COMMERCE PRODUCTS CATALOG */}
        {currentTab === 'shop' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#D4AF37]" />
                  <span>فروشگاه آنلاین تجهیزات سخت‌افزاری و پکیج‌های مکران گارد</span>
                </h3>
                <p className="text-xs text-slate-400">
                  تامین مستقیم مینی‌پی‌سی‌های گیت‌وی N100، دوربین‌های هوشمند 4K، دستگاه‌های NVR صنعتی و ماژول‌های رله تحت شبکه.
                </p>
              </div>

              {(user?.role === 'SUPERADMIN' || user?.role === 'ORG_ADMIN') && (
                <button
                  onClick={() => setShowAddProductModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#D4AF37] hover:bg-[#ECC665] text-black text-xs font-bold transition flex items-center gap-1.5 shadow"
                >
                  <span>+ افزودن محصول جدید به فروشگاه</span>
                </button>
              )}
            </div>

            {/* Filter and Search Bar for Products */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#11131C] p-3 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'ALL', label: 'همه دسته‌ها' },
                  { id: 'MINI_PC_AGENT', label: 'مینی‌پی‌سی گیت‌وی' },
                  { id: 'CAMERA_4K', label: 'دوربین‌های ۴K' },
                  { id: 'NVR', label: 'دستگاه‌های NVR' },
                  { id: 'SENSORS_RELAYS', label: 'رله و سنسورها' },
                  { id: 'PACKAGES', label: 'پکیج‌های جامع' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setShopCategory(cat.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
                      shopCategory === cat.id
                        ? 'bg-[#D4AF37] text-black shadow font-bold'
                        : 'bg-[#181B26] text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="w-full sm:w-64">
                <input
                  type="text"
                  placeholder="جستجوی نام یا مدل کالا..."
                  value={shopSearchText}
                  onChange={e => setShopSearchText(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#181B26] border border-slate-700 text-xs text-white"
                />
              </div>
            </div>

            {/* Add Product Modal */}
            {showAddProductModal && (
              <div className="bg-[#121520] border border-[#D4AF37]/50 rounded-2xl p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-[#D4AF37]" />
                    <span>افزودن محصول سخت‌افزاری جدید به کاتالوگ فروشگاه</span>
                  </h4>
                  <button onClick={() => setShowAddProductModal(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <form onSubmit={handleAddProduct} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-400 mb-1">نام محصول</label>
                      <input
                        type="text"
                        placeholder="مثال: دوربین اسپیددام مکران PTZ 4K"
                        value={newProduct.name}
                        onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">دسته‌بندی</label>
                      <select
                        value={newProduct.category}
                        onChange={e => setNewProduct({ ...newProduct, category: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-white"
                      >
                        <option value="MINI_PC_AGENT">مینی‌پی‌سی گیت‌وی (Mini PC Agent)</option>
                        <option value="CAMERA_4K">دوربین تحت شبکه 4K</option>
                        <option value="NVR">دستگاه ذخیره‌ساز NVR</option>
                        <option value="SENSORS_RELAYS">ماژول رله و سنسور IoT</option>
                        <option value="PACKAGES">پکیج جامع امنیتی</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">کد محصول (SKU)</label>
                      <input
                        type="text"
                        placeholder="MK-IPC-PTZ-01"
                        value={newProduct.sku}
                        onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-white font-mono-num"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">قیمت فروش (تومان)</label>
                      <input
                        type="number"
                        value={newProduct.price}
                        onChange={e => setNewProduct({ ...newProduct, price: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-white font-mono-num"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">موجودی انبار</label>
                      <input
                        type="number"
                        value={newProduct.stock}
                        onChange={e => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-white font-mono-num"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">توضیحات کوتاه</label>
                      <input
                        type="text"
                        placeholder="توضیح مختصر در مورد مشخصات"
                        value={newProduct.description}
                        onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                    <button type="button" onClick={() => setShowAddProductModal(false)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300">انصراف</button>
                    <button type="submit" className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-bold">ثبت و انتشار محصول در فروشگاه</button>
                  </div>
                </form>
              </div>
            )}

            {/* Product Details Specs Modal */}
            {selectedProductDetails && (
              <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
                <div className="bg-[#10131D] border border-[#D4AF37]/50 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#D4AF37]" />
                      <span>دیتاشیت و مشخصات فنی تجهیز</span>
                    </h4>
                    <button onClick={() => setSelectedProductDetails(null)} className="text-slate-400 hover:text-white">✕</button>
                  </div>

                  <div>
                    <h5 className="font-bold text-white text-sm">{selectedProductDetails.name}</h5>
                    <p className="text-xs text-slate-400 mt-1">{selectedProductDetails.description}</p>
                  </div>

                  <div className="bg-[#151926] p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">شناسه فنی (SKU):</span>
                      <span className="text-[#ECC665] font-mono-num font-bold">{selectedProductDetails.sku}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">دسته محصول:</span>
                      <span className="text-white font-semibold">{selectedProductDetails.category}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">موجودی انبار چابهار:</span>
                      <span className="text-emerald-400 font-mono-num font-bold">{selectedProductDetails.stock} عدد آماده ارسال</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">قیمت مصوب شرکتی:</span>
                      <span className="text-emerald-400 font-mono-num font-bold">{selectedProductDetails.price.toLocaleString('fa-IR')} تومان</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">گارانتی و خدمات پس از فروش:</span>
                      <span className="text-white font-semibold">۲۴ ماه تعویض بی‌قید و شرط مکران سرویس</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setSelectedProductDetails(null)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white"
                    >
                      بستن
                    </button>
                    <button
                      onClick={() => {
                        setCartModal(selectedProductDetails);
                        setSelectedProductDetails(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#ECC665] text-black text-xs font-bold transition flex items-center gap-1"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>ثبت سفارش خرید</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {products.filter(p => {
                if (shopCategory !== 'ALL' && p.category !== shopCategory) return false;
                if (shopSearchText) {
                  const q = shopSearchText.toLowerCase();
                  if (!p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
                }
                return true;
              }).map(p => (
                <div key={p.id} className="bg-[#0F1118] border border-slate-800 hover:border-[#D4AF37]/40 rounded-2xl p-5 shadow-xl flex flex-col justify-between transition group">
                  <div>
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#D4AF37]/15 text-[#ECC665] font-mono-num">
                        {p.sku}
                      </span>
                      <span className="text-[11px] text-emerald-400 font-semibold">موجود در انبار ({p.stock})</span>
                    </div>

                    <h4 className="text-sm font-bold text-white group-hover:text-[#ECC665] transition">{p.name}</h4>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed line-clamp-3">{p.description}</p>
                    
                    <button
                      onClick={() => setSelectedProductDetails(p)}
                      className="mt-3 text-[11px] text-[#ECC665] hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>مشخصات فنی و دیتاشیت</span>
                      <ChevronRight className="w-3 h-3 rotate-180" />
                    </button>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400">قیمت مصرف‌کننده:</div>
                      <div className="text-sm font-extrabold text-[#D4AF37] font-mono-num">
                        {p.price.toLocaleString('fa-IR')} تومان
                      </div>
                    </div>

                    <button
                      onClick={() => setCartModal(p)}
                      className="px-3 py-1.5 rounded-xl bg-[#D4AF37] hover:bg-[#ECC665] text-black text-xs font-bold transition flex items-center gap-1.5 shadow"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>ثبت سفارش</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Cart / Order Checkout Modal */}
            {cartModal && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-[#121520] border border-[#D4AF37]/50 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <h4 className="text-sm font-bold text-white">صدور پیش‌فاکتور و ثبت سفارش خرید</h4>
                    <button onClick={() => setCartModal(null)} className="text-slate-400 hover:text-white">✕</button>
                  </div>

                  <form onSubmit={handlePlaceOrder} className="mt-4 space-y-3">
                    <div className="p-3 rounded-xl bg-[#181B26] border border-slate-800 text-xs">
                      <div className="font-bold text-white">{cartModal.name}</div>
                      <div className="text-[#ECC665] font-mono-num mt-1">{cartModal.price.toLocaleString('fa-IR')} تومان</div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">نام خریدار / شرکت متقاضی</label>
                      <input
                        type="text"
                        placeholder="مثال: حراست منطقه آزاد"
                        value={orderCustomer.name}
                        onChange={e => setOrderCustomer({ ...orderCustomer, name: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-xs text-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">شماره تماس هماهنگی</label>
                      <input
                        type="tel"
                        placeholder="0912..."
                        value={orderCustomer.phone}
                        onChange={e => setOrderCustomer({ ...orderCustomer, phone: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-xs text-white"
                        required
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button type="button" onClick={() => setCartModal(null)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300">انصراف</button>
                      <button type="submit" className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black text-xs font-bold">تایید و ثبت سفارش نهایی</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Hardware Orders History & Tracking */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#D4AF37]" />
                    <span>سفارشات و پیگیری ارسال تجهیزات (Hardware Orders & Delivery)</span>
                  </h4>
                  <p className="text-xs text-slate-400">پیگیری مراحل آماده‌سازی، برنامه‌ریزی فریم‌ور ایجنت و ارسال به سایت‌های مشتریان.</p>
                </div>
                <span className="text-xs text-[#ECC665] font-mono-num">{orders.length} سفارش ثبت‌شده</span>
              </div>

              <div className="bg-[#0F1118] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#141722] text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">کد سفارش</th>
                      <th className="p-3.5">متقاضی / شرکت</th>
                      <th className="p-3.5">شماره تماس</th>
                      <th className="p-3.5">مبلغ کل سفارش</th>
                      <th className="p-3.5">وضعیت تامین</th>
                      <th className="p-3.5">تاریخ ثبت</th>
                      <th className="p-3.5 text-left">عملیات تامین</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-mono-num">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-500 font-sans">هیچ سفارشی ثبت نشده است</td>
                      </tr>
                    ) : (
                      orders.map(ord => (
                        <tr key={ord.id} className="hover:bg-[#131622] transition">
                          <td className="p-3.5 font-bold text-[#ECC665]">{ord.id}</td>
                          <td className="p-3.5 font-sans font-semibold text-white">{ord.customer_name}</td>
                          <td className="p-3.5 text-slate-400">{ord.phone}</td>
                          <td className="p-3.5 font-bold text-emerald-400">
                            {ord.total_amount?.toLocaleString('fa-IR')} تومان
                          </td>
                          <td className="p-3.5 font-sans">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              ord.status === 'DELIVERED'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : ord.status === 'SHIPPED'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}>
                              {ord.status === 'CONFIRMED' ? 'آماده‌سازی در انبار' : ord.status === 'SHIPPED' ? 'ارسال شده (در مسیر سایت)' : 'تحویل موفق به مشتری'}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-400 text-[11px]">
                            {new Date(ord.created_at).toLocaleDateString('fa-IR')}
                          </td>
                          <td className="p-3.5 text-left font-sans">
                            {ord.status === 'CONFIRMED' && (
                              <button
                                onClick={() => handleUpdateOrderStatus(ord.id, 'SHIPPED')}
                                className="px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/50 text-[10px] font-bold transition"
                              >
                                ثبت ارسال 🚚
                              </button>
                            )}
                            {ord.status === 'SHIPPED' && (
                              <button
                                onClick={() => handleUpdateOrderStatus(ord.id, 'DELIVERED')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/50 text-[10px] font-bold transition"
                              >
                                تایید تحویل ✅
                              </button>
                            )}
                            {ord.status === 'DELIVERED' && (
                              <span className="text-emerald-400 text-[10px] font-bold">تحویل‌شده</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: RULES */}
        {currentTab === 'rules' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#D4AF37]" />
                  <span>موتور قوانین امنیتی و تصمیم‌گیری هوشمند (Rule Engine)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  اگر (وضعیت سیستم == فعال) و (رویداد == انسان) در (زون == پیرامونی) رخ دهد → فعال‌سازی آژیر + ارسال پیامک و تماس خودکار.
                </p>
              </div>
              <button
                onClick={() => setShowAddRule(true)}
                className="px-3.5 py-1.5 rounded-xl bg-[#D4AF37] hover:bg-[#ECC665] text-black text-xs font-bold transition flex items-center gap-1.5 shadow"
              >
                <span>+ ایجاد قانون امنیتی جدید</span>
              </button>
            </div>

            {/* Visual Rule Builder Modal */}
            {showAddRule && (
              <div className="bg-[#121520] border border-[#D4AF37]/50 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                  <h4 className="text-sm font-bold text-white">طراحی قانون امنیتی هوشمند (Visual Rule Builder)</h4>
                  <button onClick={() => setShowAddRule(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">نام قانون</label>
                    <input
                      type="text"
                      placeholder="مثال: نفوذ شبانه به محوطه انبار مرکزی"
                      value={newRule.name}
                      onChange={e => setNewRule({ ...newRule, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-white"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Condition 1: Armed States */}
                    <div className="bg-[#161925] p-3 rounded-xl border border-slate-800">
                      <span className="font-bold text-[#ECC665] block mb-2">۱. وضعیت مسلح سیستم:</span>
                      <label className="flex items-center gap-2 mb-1.5 text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={newRule.armed_away} onChange={e => setNewRule({ ...newRule, armed_away: e.target.checked })} />
                        <span>فعال - خروج (Away)</span>
                      </label>
                      <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={newRule.armed_stay} onChange={e => setNewRule({ ...newRule, armed_stay: e.target.checked })} />
                        <span>فعال - در محل (Stay)</span>
                      </label>
                    </div>

                    {/* Condition 2: Event Trigger */}
                    <div className="bg-[#161925] p-3 rounded-xl border border-slate-800">
                      <span className="font-bold text-[#ECC665] block mb-2">۲. رویداد هوش مصنوعی:</span>
                      <label className="flex items-center gap-2 mb-1.5 text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={newRule.human} onChange={e => setNewRule({ ...newRule, human: e.target.checked })} />
                        <span>تشخیص انسان (Human)</span>
                      </label>
                      <label className="flex items-center gap-2 mb-1.5 text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={newRule.face} onChange={e => setNewRule({ ...newRule, face: e.target.checked })} />
                        <span>چهره ناشناس (Unknown)</span>
                      </label>
                      <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={newRule.plate} onChange={e => setNewRule({ ...newRule, plate: e.target.checked })} />
                        <span>پلاک مسدود (Blacklist)</span>
                      </label>
                    </div>

                    {/* Condition 3: Zones */}
                    <div className="bg-[#161925] p-3 rounded-xl border border-slate-800">
                      <span className="font-bold text-[#ECC665] block mb-2">۳. زون تحت پوشش:</span>
                      <label className="flex items-center gap-2 mb-1.5 text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={newRule.zone_entrance} onChange={e => setNewRule({ ...newRule, zone_entrance: e.target.checked })} />
                        <span>ورودی اصلی (Entrance)</span>
                      </label>
                      <label className="flex items-center gap-2 mb-1.5 text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={newRule.zone_perimeter} onChange={e => setNewRule({ ...newRule, zone_perimeter: e.target.checked })} />
                        <span>پیرامونی و دیوارها</span>
                      </label>
                      <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={newRule.zone_vault} onChange={e => setNewRule({ ...newRule, zone_vault: e.target.checked })} />
                        <span>خزانه و گاوصندوق</span>
                      </label>
                    </div>
                  </div>

                  {/* Actions to Execute */}
                  <div className="bg-[#161925] p-3 rounded-xl border border-slate-800">
                    <span className="font-bold text-red-400 block mb-2">۴. فرامین و اقدامات خودکار در صورت احراز خطر:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={newRule.trigger_alarm} onChange={e => setNewRule({ ...newRule, trigger_alarm: e.target.checked })} />
                        <span className="font-bold text-red-400">تحریک رله و آژیر</span>
                      </label>
                      <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={newRule.send_push} onChange={e => setNewRule({ ...newRule, send_push: e.target.checked })} />
                        <span>ارسال اعلان Push</span>
                      </label>
                      <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={newRule.send_sms} onChange={e => setNewRule({ ...newRule, send_sms: e.target.checked })} />
                        <span>ارسال پیامک اضطراری</span>
                      </label>
                      <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={newRule.send_call} onChange={e => setNewRule({ ...newRule, send_call: e.target.checked })} />
                        <span>تماس صوتی خودکار</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setShowAddRule(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300">انصراف</button>
                    <button type="submit" className="px-5 py-2 rounded-xl bg-[#D4AF37] text-black font-bold">ذخیره و فعال‌سازی قانون</button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rules.map(rule => {
                const actions = JSON.parse(rule.actions || '{}');
                const armedStates = JSON.parse(rule.armed_states || '[]');
                const eventTypes = JSON.parse(rule.event_types || '[]');
                const zones = JSON.parse(rule.zones || '[]');

                return (
                  <div key={rule.id} className="bg-[#0F1118] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <span className="text-xs font-bold text-white">{rule.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                          فعال (Active)
                        </span>
                      </div>

                      <div className="space-y-2 mt-3 text-xs">
                        <div>
                          <span className="text-slate-500">شرط وضعیت سیستم: </span>
                          <span className="text-[#ECC665] font-mono-num">{armedStates.join(', ') || 'تمامی حالات'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">رویدادهای محرک: </span>
                          <span className="text-slate-300 font-mono-num">{eventTypes.join(', ')}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">زون‌های تحت پوشش: </span>
                          <span className="text-blue-400">{zones.join(', ')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-slate-400">
                        {actions.trigger_alarm && <span className="text-red-400 font-bold">آژیر رله #{actions.relay_output || 1}</span>}
                        {actions.send_push && <span>• اعلان Push</span>}
                        {actions.send_sms && <span>• پیامک</span>}
                        {actions.send_phone_call && <span>• تماس صوتی</span>}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono-num">
                        مدت: {actions.alarm_duration_sec || 15}s
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 8: BIOMETRICS & LPR */}
        {currentTab === 'biometrics' && (
          <div className="space-y-6">
            {/* BIOMETRIC & LPR TIMELINE SEARCH */}
            <div className="bg-[#11131C] border border-[#D4AF37]/40 rounded-2xl p-4 shadow-xl space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                    <span>کاوشگر سوابق تردد و رویت چهره/پلاک (Sighting Timeline Search)</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">جستجوی بلادرنگ در تاریخچه عبور خودروها یا افراد شناسایی‌شده در کلیه دوربین‌های محوطه.</p>
                </div>

                <form onSubmit={handleSearchFace} className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="نام شخص یا شماره پلاک (مثال: رضا یا 85ج124)..."
                    value={searchPersonName}
                    onChange={e => setSearchPersonName(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-[#181B26] border border-slate-700 text-xs text-white w-full sm:w-64"
                  />
                  <button type="submit" className="px-3.5 py-1.5 rounded-xl bg-[#D4AF37] hover:bg-[#ECC665] text-black text-xs font-bold transition flex items-center gap-1 shadow whitespace-nowrap">
                    <span>جستجو</span>
                  </button>
                </form>
              </div>

              {/* Search Results Timeline */}
              {searchResults.length > 0 && (
                <div className="pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-xs font-bold text-[#ECC665]">{searchResults.length} رخداد تردد یافت شد:</span>
                    <button onClick={() => setSearchResults([])} className="text-[10px] text-slate-400 hover:text-white">بستن نتایج ✕</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {searchResults.map((sr, idx) => (
                      <div key={idx} className="bg-[#181B26] p-2.5 rounded-xl border border-slate-800 text-xs flex items-center justify-between">
                        <div>
                          <div className="font-bold text-white text-[11px] truncate max-w-[170px]">{sr.label}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">دوربین: {sr.camera_name || sr.camera_id} • زون: {sr.zone}</div>
                        </div>
                        <div className="text-left font-mono-num text-[10px] text-slate-400">
                          {new Date(sr.created_at).toLocaleTimeString('fa-IR')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#D4AF37]" />
                    <span>دایرکتوری چهره‌ها (Face Recognition DB)</span>
                  </h3>
                  <p className="text-xs text-slate-400">لیست کارمندان، افراد VIP و لیست مسدودی حراست</p>
                </div>
                <button onClick={() => setShowAddFace(true)} className="px-3 py-1.5 rounded-xl bg-[#D4AF37] hover:bg-[#ECC665] text-black text-xs font-bold transition">
                  + افزودن چهره
                </button>
              </div>

              {showAddFace && (
                <form onSubmit={handleAddFace} className="bg-[#121520] p-4 rounded-xl border border-slate-700 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="نام و نام خانوادگی" value={newFace.name} onChange={e => setNewFace({ ...newFace, name: e.target.value })} className="px-3 py-2 rounded-lg bg-[#181B26] border border-slate-700 text-xs text-white" required />
                    <select value={newFace.category} onChange={e => setNewFace({ ...newFace, category: e.target.value as any })} className="px-3 py-2 rounded-lg bg-[#181B26] border border-slate-700 text-xs text-white">
                      <option value="VIP">VIP (مهمان ویژه)</option>
                      <option value="EMPLOYEE">EMPLOYEE (پرسنل)</option>
                      <option value="VISITOR">VISITOR (مراجع)</option>
                      <option value="BLOCKED">BLOCKED (مسدود / خطر)</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowAddFace(false)} className="px-3 py-1.5 text-xs text-slate-400">انصراف</button>
                    <button type="submit" className="px-3 py-1.5 rounded-lg bg-[#D4AF37] text-black text-xs font-bold">ذخیره چهره</button>
                  </div>
                </form>
              )}

              <div className="bg-[#0F1118] border border-slate-800 rounded-2xl divide-y divide-slate-800/80 overflow-hidden shadow-xl">
                {faces.map(face => (
                  <div key={face.id} className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                        {face.name.substring(0, 1)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{face.name}</div>
                        <div className="text-[11px] text-slate-400">{face.notes || 'بدون یادداشت'}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      face.category === 'VIP' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                      face.category === 'BLOCKED' ? 'bg-red-500/20 text-red-300 border border-red-500/40' :
                      'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    }`}>
                      {face.category}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Car className="w-4 h-4 text-[#D4AF37]" />
                    <span>دایرکتوری پلاک خودروها (LPR Database)</span>
                  </h3>
                  <p className="text-xs text-slate-400">لیست مجاز و مسدود گیت ورودی خودرویی</p>
                </div>
                <button onClick={() => setShowAddPlate(true)} className="px-3 py-1.5 rounded-xl bg-[#D4AF37] hover:bg-[#ECC665] text-black text-xs font-bold transition">
                  + افزودن پلاک
                </button>
              </div>

              {showAddPlate && (
                <form onSubmit={handleAddPlate} className="bg-[#121520] p-4 rounded-xl border border-slate-700 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="شماره پلاک (مثال: 85ج124-ایران85)" value={newPlate.plate_number} onChange={e => setNewPlate({ ...newPlate, plate_number: e.target.value })} className="px-3 py-2 rounded-lg bg-[#181B26] border border-slate-700 text-xs text-white" required />
                    <input type="text" placeholder="مالک خودرو" value={newPlate.owner_name} onChange={e => setNewPlate({ ...newPlate, owner_name: e.target.value })} className="px-3 py-2 rounded-lg bg-[#181B26] border border-slate-700 text-xs text-white" required />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowAddPlate(false)} className="px-3 py-1.5 text-xs text-slate-400">انصراف</button>
                    <button type="submit" className="px-3 py-1.5 rounded-lg bg-[#D4AF37] text-black text-xs font-bold">ذخیره پلاک</button>
                  </div>
                </form>
              )}

              <div className="bg-[#0F1118] border border-slate-800 rounded-2xl divide-y divide-slate-800/80 overflow-hidden shadow-xl">
                {plates.map(plt => (
                  <div key={plt.id} className="p-3.5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white font-mono-num tracking-wide">{plt.plate_number}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">مالک: {plt.owner_name} • مدل: {plt.vehicle_model || 'ثبت نشده'}</div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      plt.category === 'ALLOWED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                      plt.category === 'BLOCKED' ? 'bg-red-500/20 text-red-300 border border-red-500/40' :
                      'bg-blue-500/20 text-blue-300'
                    }`}>
                      {plt.category}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </div>
        )}

        {/* TAB 9: COMMERCIAL SAAS & CRM */}
        {currentTab === 'commercial' && (
          <div className="space-y-6">
            {/* MULTI-TENANT SWITCHER & TENANT CREATION */}
            <div className="bg-[#121520] border border-[#D4AF37]/40 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <Building className="w-4 h-4 text-[#D4AF37]" />
                  <span>سازمان و محیط مستأجر فعال (Active Multi-Tenant Environment)</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  شناسه مستأجر کنونی: <span className="font-mono-num text-[#ECC665] font-bold">{user?.tenantId}</span> • نقش: <span className="text-white font-bold">{user?.role}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <select
                  value={user?.tenantId}
                  onChange={e => handleSwitchTenant(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-xs text-white font-bold"
                >
                  {tenantsList.length === 0 ? (
                    <option value={user?.tenantId}>{user?.tenantId}</option>
                  ) : (
                    tenantsList.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.plan})
                      </option>
                    ))
                  )}
                </select>

                <button
                  onClick={() => setShowAddTenantModal(true)}
                  className="px-3 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#ECC665] text-black text-xs font-bold transition flex items-center gap-1 shadow whitespace-nowrap"
                >
                  <span>+ افزودن سازمان جدید</span>
                </button>
              </div>
            </div>

            {/* Add Tenant Modal */}
            {showAddTenantModal && (
              <div className="bg-[#121520] border border-[#D4AF37]/50 rounded-2xl p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Building className="w-4 h-4 text-[#D4AF37]" />
                    <span>تعریف و ایزوله‌سازی سازمان جدید در پلتفرم ابری مکران</span>
                  </h4>
                  <button onClick={() => setShowAddTenantModal(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <form onSubmit={handleCreateTenant} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-400 mb-1">نام سازمان / شرکت</label>
                      <input
                        type="text"
                        placeholder="مثال: مجتمع پتروشیمی نگین مکران"
                        value={newTenant.name}
                        onChange={e => setNewTenant({ ...newTenant, name: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">شناسه یکتا (Slug انگلیسی)</label>
                      <input
                        type="text"
                        placeholder="مثال: negin-petro"
                        value={newTenant.slug}
                        onChange={e => setNewTenant({ ...newTenant, slug: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-white font-mono-num"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">بسته اشتراک سازمانی</label>
                      <select
                        value={newTenant.plan}
                        onChange={e => setNewTenant({ ...newTenant, plan: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-white"
                      >
                        <option value="Enterprise Guard">Enterprise Guard (32 دوربین / AI نامحدود)</option>
                        <option value="Commercial Pro">Commercial Pro (16 دوربین / AI پیشرفته)</option>
                        <option value="Starter SME">Starter SME (8 دوربین / پایش اساسی)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                    <button type="button" onClick={() => setShowAddTenantModal(false)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300">انصراف</button>
                    <button type="submit" className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-bold">ایجاد و ایزولاسیون کامل دیتابیس سازمان</button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-[#0F1118] border border-[#D4AF37]/30 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Building className="w-4 h-4 text-[#D4AF37]" />
                    <span>پلن اشتراک تجاری سازمان (SaaS Commercial Tier)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    بسته انتخابی: <span className="text-[#ECC665] font-bold">Makoran Guard Enterprise AI</span>
                  </p>
                </div>
                <div className="text-left font-mono-num flex flex-col items-end gap-1">
                  <div className="text-lg font-black text-[#D4AF37]">45,000,000 تومان / ماهانه</div>
                  <div className="text-[10px] text-slate-400">تمدید بعدی: ۲۰۲۶/۱۰/۱۷</div>
                  <button
                    onClick={() => setShowInvoiceModal(true)}
                    className="mt-1 px-3 py-1 rounded-lg bg-[#1D212E] hover:bg-[#D4AF37] hover:text-black border border-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1 font-sans"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>چاپ پیش‌فاکتور رسمی</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 text-xs">
                <div className="bg-[#141722] p-4 rounded-xl border border-slate-800">
                  <div className="text-slate-400">سقف مجاز دوربین‌ها</div>
                  <div className="text-xl font-bold font-mono-num text-white mt-1">32 کانال</div>
                  <div className="text-[10px] text-emerald-400 mt-1">فعلی: {cameras.length} دوربین</div>
                </div>
                <div className="bg-[#141722] p-4 rounded-xl border border-slate-800">
                  <div className="text-slate-400">سقف گیت‌وی مینی‌پی‌سی</div>
                  <div className="text-xl font-bold font-mono-num text-white mt-1">8 دستگاه</div>
                  <div className="text-[10px] text-emerald-400 mt-1">فعلی: {agents.length} مینی‌پی‌سی</div>
                </div>
                <div className="bg-[#141722] p-4 rounded-xl border border-slate-800">
                  <div className="text-slate-400">مدت نگهداری وقایع</div>
                  <div className="text-xl font-bold font-mono-num text-white mt-1">60 روز</div>
                  <div className="text-[10px] text-slate-500 mt-1">ذخیره‌سازی امن ابری S3</div>
                </div>
                <div className="bg-[#141722] p-4 rounded-xl border border-slate-800">
                  <div className="text-slate-400">موتور آنالیز هوش مصنوعی</div>
                  <div className="text-xl font-bold font-mono-num text-[#ECC665] mt-1">نامحدود</div>
                  <div className="text-[10px] text-emerald-400 mt-1">انسان • چهره • خودرو • پلاک</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-[#D4AF37]" />
                <span>مشتریان و سایت‌های تحت حفاظت مکران در منطقه</span>
              </h3>
              <div className="bg-[#0F1118] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#141722] text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">نام مشتری / سازمان</th>
                      <th className="p-3.5">محل سایت</th>
                      <th className="p-3.5">شماره تماس</th>
                      <th className="p-3.5">تعداد دوربین</th>
                      <th className="p-3.5">وضعیت سرویس</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {crm.map(c => (
                      <tr key={c.id} className="hover:bg-[#131622] transition">
                        <td className="p-3.5 font-bold text-white">
                          <div>{c.company}</div>
                          <div className="text-[11px] text-slate-400 font-normal">{c.name}</div>
                        </td>
                        <td className="p-3.5 text-slate-300">{c.site_address}</td>
                        <td className="p-3.5 font-mono-num text-slate-400">{c.phone}</td>
                        <td className="p-3.5 font-mono-num text-[#ECC665] font-bold">{c.devices_installed} دوربین</td>
                        <td className="p-3.5">
                          <span className="text-emerald-400 font-semibold">{c.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AUDIT LOGS & SECURITY AUDIT EXPLORER */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#D4AF37]" />
                    <span>لاگ‌های حسابرسی امنیتی و انطباق حراست (Security Audit Logs)</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    بایگانی غیرقابل‌دستکاری از تمامی ورودها، تغییر وضعیت گارد، سوئیچ رله‌ها و ارتقاهای OTA.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
                    const dl = document.createElement('a');
                    dl.setAttribute("href", dataStr);
                    dl.setAttribute("download", `makoran_audit_logs_${Date.now()}.json`);
                    dl.click();
                    showToast('فایل گزارش حسابرسی امنیتی صادر گردید', 'success');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#141722] hover:bg-[#1A1F2E] border border-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>خروجی JSON</span>
                </button>
              </div>

              <div className="bg-[#0F1118] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#141722] text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">عنوان عملیات</th>
                      <th className="p-3.5">بخش / منبع</th>
                      <th className="p-3.5">جزئیات عملیات</th>
                      <th className="p-3.5 text-left">زمان و تاریخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-mono-num">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-500 font-sans">هیچ لاگ حسابرسی ثبت نشده است</td>
                      </tr>
                    ) : (
                      auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-[#131622] transition">
                          <td className="p-3.5 font-bold text-[#ECC665]">{log.action}</td>
                          <td className="p-3.5 text-slate-300">{log.resource}</td>
                          <td className="p-3.5 text-slate-400 text-[11px] truncate max-w-xs">{log.details || '-'}</td>
                          <td className="p-3.5 text-left text-slate-400 text-[11px]">
                            {new Date(log.created_at).toLocaleString('fa-IR')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SITE ADMIN: USER MANAGEMENT & RBAC */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#D4AF37]" />
                    <span>مدیریت کاربران سامانه و سطوح دسترسی (User Management & RBAC)</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    تعریف نقش‌های SuperAdmin، مدیر سازمان (OrgAdmin)، اپراتور شیفت (Operator) و بیننده (Viewer).
                  </p>
                </div>
                {(user?.role === 'SUPERADMIN' || user?.role === 'ORG_ADMIN') && (
                  <button
                    onClick={() => setShowAddUserModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-[#D4AF37] hover:bg-[#ECC665] text-black text-xs font-bold transition flex items-center gap-1.5 shadow"
                  >
                    <span>+ افزودن کاربر جدید</span>
                  </button>
                )}
              </div>

              {/* Add User Modal */}
              {showAddUserModal && (
                <div className="bg-[#121520] border border-[#D4AF37]/50 rounded-2xl p-6 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <User className="w-4 h-4 text-[#D4AF37]" />
                      <span>تعریف حساب کاربری جدید با سطح دسترسی</span>
                    </h4>
                    <button onClick={() => setShowAddUserModal(false)} className="text-slate-400 hover:text-white">✕</button>
                  </div>

                  <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-400 mb-1">نام و نام خانوادگی</label>
                        <input
                          type="text"
                          placeholder="مثال: علی احمدی"
                          value={newUser.full_name}
                          onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-white"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1">پست الکترونیکی (ایمیل ورود)</label>
                        <input
                          type="email"
                          placeholder="operator@makoran.io"
                          value={newUser.email}
                          onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-white font-mono-num"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1">رمز عبور ورود</label>
                        <input
                          type="password"
                          placeholder="حداقل ۸ کاراکتر"
                          value={newUser.password}
                          onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-white"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1">نقش و سطح دسترسی (RBAC Role)</label>
                        <select
                          value={newUser.role}
                          onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-white"
                        >
                          <option value="OPERATOR">اپراتور مانیتورینگ (OPERATOR)</option>
                          <option value="ORG_ADMIN">مدیر سازمان و سایت (ORG_ADMIN)</option>
                          <option value="VIEWER">بیننده استریم زنده (VIEWER)</option>
                          <option value="SUPERADMIN">مدیر ارشد سامانه (SUPERADMIN)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1">شماره تماس اضطراری</label>
                        <input
                          type="tel"
                          placeholder="0912..."
                          value={newUser.phone}
                          onChange={e => setNewUser({ ...newUser, phone: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-[#181B26] border border-slate-700 text-white font-mono-num"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                      <button type="button" onClick={() => setShowAddUserModal(false)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300">انصراف</button>
                      <button type="submit" className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-bold">ایجاد حساب کاربری</button>
                    </div>
                  </form>
                </div>
              )}

              <div className="bg-[#0F1118] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#141722] text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">نام کاربر</th>
                      <th className="p-3.5">ایمیل ورود</th>
                      <th className="p-3.5">سطح دسترسی (Role)</th>
                      <th className="p-3.5">شماره همراه</th>
                      <th className="p-3.5">وضعیت</th>
                      <th className="p-3.5 text-left">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-mono-num">
                    {usersList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-500 font-sans">هیچ کاربری یافت نشد</td>
                      </tr>
                    ) : (
                      usersList.map(u => (
                        <tr key={u.id} className="hover:bg-[#131622] transition">
                          <td className="p-3.5 font-bold font-sans text-white">{u.full_name}</td>
                          <td className="p-3.5 text-slate-300">{u.email}</td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              u.role === 'SUPERADMIN' ? 'bg-[#D4AF37]/20 text-[#ECC665] border border-[#D4AF37]/40' :
                              u.role === 'ORG_ADMIN' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' :
                              u.role === 'OPERATOR' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' :
                              'bg-slate-700 text-slate-300'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-400">{u.phone || '-'}</td>
                          <td className="p-3.5">
                            <span className="text-emerald-400 font-semibold text-[11px] font-sans">
                              {u.status === 'ACTIVE' ? 'فعال' : u.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-left font-sans">
                            {u.id !== user?.id && (
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                className="text-red-400 hover:text-red-300 text-xs transition"
                              >
                                حذف
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PLATFORM INFRASTRUCTURE & SETTINGS */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#D4AF37]" />
                <span>پیکربندی زیرساخت و تنظیمات پلتفرم (Platform Infrastructure)</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-[#0F1118] border border-slate-800 p-4 rounded-xl space-y-2">
                  <div className="font-bold text-[#ECC665] flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>درگاه‌های اعلان و پیامک</span>
                  </div>
                  <div className="text-slate-300 text-[11px]">سامانه پیامک کاوه‌نگار: <span className="text-emerald-400 font-bold">متصل</span></div>
                  <div className="text-slate-300 text-[11px]">موتور تماس صوتی IVR: <span className="text-emerald-400 font-bold">فعال (فراز)</span></div>
                  <div className="text-slate-300 text-[11px]">پوش نوتیفیکیشن وب/PWA: <span className="text-emerald-400 font-bold">فعال</span></div>
                </div>

                <div className="bg-[#0F1118] border border-slate-800 p-4 rounded-xl space-y-2">
                  <div className="font-bold text-[#ECC665] flex items-center gap-2">
                    <Radio className="w-4 h-4" />
                    <span>سیگنالینگ و استریم WebRTC</span>
                  </div>
                  <div className="text-slate-300 text-[11px]">پروتکل استریم: <span className="text-white font-mono-num">H.264 / WebRTC DataChannel</span></div>
                  <div className="text-slate-300 text-[11px]">سرورهای STUN: <span className="text-white font-mono-num">Google STUN L1/L2</span></div>
                  <div className="text-slate-300 text-[11px]">خط‌مشی پهنای باند: <span className="text-emerald-400 font-bold">استریم strictly on-demand</span></div>
                </div>

                <div className="bg-[#0F1118] border border-slate-800 p-4 rounded-xl space-y-2">
                  <div className="font-bold text-[#ECC665] flex items-center gap-2">
                    <HardDrive className="w-4 h-4" />
                    <span>ذخیره‌سازی و حریم خصوصی</span>
                  </div>
                  <div className="text-slate-300 text-[11px]">ذخیره‌سازی اسنپ‌شات‌ها: <span className="text-white">ابری سازگار با S3</span></div>
                  <div className="text-slate-300 text-[11px]">دوره نگهداری لاگ‌ها: <span className="text-white font-mono-num font-bold">60 روز</span></div>
                  <div className="text-slate-300 text-[11px]">امحای خودکار بیومتریک: <span className="text-emerald-400 font-bold">فعال</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EVENT SNAPSHOT INSPECTOR MODAL */}
        {selectedEventModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#10131D] border border-[#D4AF37]/50 rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-[#D4AF37]" />
                  <span className="font-bold text-sm text-white">بازرسی تصویر رویداد هوش مصنوعی (AI Snapshot Inspector)</span>
                </div>
                <button onClick={() => setSelectedEventModal(null)} className="text-slate-400 hover:text-white text-lg">✕</button>
              </div>

              {/* Snapshot View with Simulated Bounding Box Overlay */}
              <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                {/* Surveillance Screen Background */}
                <div className="w-full h-full bg-gradient-to-br from-slate-950 via-[#121622] to-black flex items-center justify-center relative">
                  <div className="text-center">
                    <Video className="w-12 h-12 text-[#D4AF37]/40 mx-auto mb-2" />
                    <div className="text-xs text-slate-400 font-mono-num">{selectedEventModal.snapshot_url}</div>
                  </div>

                  {/* Bounding Box Visualizer */}
                  <div className="absolute inset-x-1/3 inset-y-1/4 border-2 border-[#D4AF37] bg-[#D4AF37]/10 rounded flex flex-col justify-between p-1.5 pointer-events-none">
                    <span className="bg-[#D4AF37] text-black text-[10px] font-bold px-1.5 py-0.5 rounded w-max">
                      {selectedEventModal.label} ({(selectedEventModal.confidence * 100).toFixed(0)}%)
                    </span>
                    <span className="text-[9px] text-[#ECC665] font-mono-num">
                      TARGET DETECTED • ZONE: {selectedEventModal.zone || 'PERIMETER'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Event Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-[#161925] p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">نوع رویداد:</span>
                  <span className="font-bold text-slate-200">{selectedEventModal.event_type}</span>
                </div>
                <div className="bg-[#161925] p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">دوربین:</span>
                  <span className="font-bold text-slate-200">{selectedEventModal.camera_name || selectedEventModal.camera_id}</span>
                </div>
                <div className="bg-[#161925] p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">تصمیم امنیتی:</span>
                  <span className={`font-bold ${selectedEventModal.alarm_triggered ? 'text-red-400' : 'text-blue-400'}`}>
                    {selectedEventModal.decision.toUpperCase()}
                  </span>
                </div>
                <div className="bg-[#161925] p-2.5 rounded-xl border border-slate-800 font-mono-num">
                  <span className="text-slate-500 block text-[10px]">زمان رخداد:</span>
                  <span className="text-slate-300">{new Date(selectedEventModal.created_at).toLocaleTimeString('fa-IR')}</span>
                </div>
              </div>

              {/* Quick Security Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      api.addFace({ name: `مشکوک - ${selectedEventModal.camera_id}`, category: 'BLOCKED', notes: 'ثبت خودکار از رویداد مشکوک' });
                      showToast('شخص شناسایی شده به لیست سیاه حراست افزوده شد', 'error');
                      setSelectedEventModal(null);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-800 text-red-300 text-xs font-bold transition"
                  >
                    + افزودن به لیست سیاه (Blacklist)
                  </button>
                  <button
                    onClick={() => {
                      api.addFace({ name: `کارمند تایید شده`, category: 'EMPLOYEE', notes: 'ثبت سریع از تصویر' });
                      showToast('به لیست پرسنل مجاز افزوده شد', 'success');
                      setSelectedEventModal(null);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800 text-emerald-300 text-xs font-bold transition"
                  >
                    + تایید هویت مجاز (Whitelist)
                  </button>
                </div>
                <button
                  onClick={() => setSelectedEventModal(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300"
                >
                  بستن
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PRINTABLE OFFICIAL SAAS INVOICE MODAL */}
        {showInvoiceModal && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-[#0B0D13] border border-[#D4AF37]/60 rounded-2xl max-w-3xl w-full p-8 shadow-2xl text-slate-200 relative my-8">
              <div className="flex items-center justify-between pb-6 border-b border-[#D4AF37]/30">
                <div className="flex items-center gap-3">
                  <img src="/logo-icon.svg" alt="Makoran Logo" className="w-12 h-12 object-contain" />
                  <div>
                    <h2 className="text-lg font-black gold-gradient-text">صورت‌حساب خدمات ابری مکران وان</h2>
                    <div className="text-[11px] text-slate-400">سامانه جامع امنیت هوشمند و نظارت تصویری مکران گارد</div>
                  </div>
                </div>
                <div className="text-left font-mono-num text-xs">
                  <div>شماره فاکتور: <span className="text-[#ECC665]">MK-INV-2026-09</span></div>
                  <div>تاریخ صدور: <span className="text-slate-300">۱۴۰۵/۰۶/۲۷</span></div>
                </div>
              </div>

              {/* Customer Info Box */}
              <div className="grid grid-cols-2 gap-4 my-6 p-4 rounded-xl bg-[#121520] border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">مشترک / سازمان:</span>
                  <span className="font-bold text-white text-sm">{user.tenantName}</span>
                  <div className="text-slate-400 text-[11px] mt-1">شناسه سازمانی: {user.tenantId}</div>
                </div>
                <div className="text-left">
                  <span className="text-slate-400 block text-[10px]">موقعیت سایت:</span>
                  <span className="text-slate-200">منطقه آزاد تجاری صنعتی چابهار، سواحل مکران</span>
                  <div className="text-emerald-400 text-[11px] mt-1">وضعیت پرداخت: تایید شده (PAID)</div>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-right text-xs border border-slate-800 rounded-xl overflow-hidden mb-6">
                <thead className="bg-[#151926] text-slate-300">
                  <tr>
                    <th className="p-3">شرح خدمت / پکیج</th>
                    <th className="p-3">تعداد دوربین</th>
                    <th className="p-3">گیت‌وی N100</th>
                    <th className="p-3">مبلغ واحد (تومان)</th>
                    <th className="p-3 text-left">مجموع (تومان)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-mono-num">
                  <tr>
                    <td className="p-3 font-bold text-white font-sans">اشتراک ابری مکران گارد انترپرایز (ماهانه)</td>
                    <td className="p-3">32 کانال</td>
                    <td className="p-3">8 دستگاه</td>
                    <td className="p-3">45,000,000</td>
                    <td className="p-3 text-left text-[#ECC665] font-bold">45,000,000</td>
                  </tr>
                </tbody>
              </table>

              <div className="flex flex-col items-end gap-1 text-xs font-mono-num pb-6 border-b border-slate-800">
                <div className="text-slate-400">مالیات بر ارزش افزوده (۱۰٪): ۴,۵۰۰,۰۰۰ تومان</div>
                <div className="text-base font-black text-[#D4AF37]">مبلغ کل پرداختی: ۴۹,۵۰۰,۰۰۰ تومان</div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4">
                <div className="text-[11px] text-slate-500">
                  این صورت‌حساب الکترونیکی دارای امضای دیجیتال و تاییدیه مالی شرکت مکران وان می‌باشد.
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => window.print()} className="px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#ECC665] text-black text-xs font-bold transition flex items-center gap-1.5 shadow">
                    <span>🖨️ چاپ فاکتور رسمی</span>
                  </button>
                  <button onClick={() => setShowInvoiceModal(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300">
                    بستن
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B0D13]/95 backdrop-blur-md border-t border-[#D4AF37]/30 px-2 py-1.5 flex items-center justify-around text-[10px]">
        <button onClick={() => setCurrentTab('monitor')} className={`flex flex-col items-center gap-1 p-1 ${currentTab === 'monitor' ? 'text-[#ECC665]' : 'text-slate-400'}`}>
          <Video className="w-4 h-4" />
          <span>مانیتورینگ</span>
        </button>
        <button onClick={() => setCurrentTab('events')} className={`flex flex-col items-center gap-1 p-1 ${currentTab === 'events' ? 'text-[#ECC665]' : 'text-slate-400'}`}>
          <Activity className="w-4 h-4" />
          <span>رویدادها</span>
        </button>
        <button onClick={() => setCurrentTab('cameras')} className={`flex flex-col items-center gap-1 p-1 ${currentTab === 'cameras' ? 'text-[#ECC665]' : 'text-slate-400'}`}>
          <CamIcon className="w-4 h-4" />
          <span>دوربین‌ها</span>
        </button>
        <button onClick={() => setCurrentTab('attendance')} className={`flex flex-col items-center gap-1 p-1 ${currentTab === 'attendance' ? 'text-[#ECC665]' : 'text-slate-400'}`}>
          <Clock className="w-4 h-4" />
          <span>تردد</span>
        </button>
        <button onClick={() => setCurrentTab('shop')} className={`flex flex-col items-center gap-1 p-1 ${currentTab === 'shop' ? 'text-[#ECC665]' : 'text-slate-400'}`}>
          <ShoppingBag className="w-4 h-4" />
          <span>فروشگاه</span>
        </button>
      </nav>

      {/* FOOTER */}
      <footer className="bg-[#08090C] border-t border-slate-800/80 py-4 px-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <img src="/logo-icon.svg" alt="Makoran" className="w-5 h-5 object-contain" />
            <span className="font-bold text-slate-300">مَکُران وان • سامانه‌های امنیت هوشمند مکران گارد</span>
          </div>
          <div className="text-[11px] font-mono-num text-slate-400">
            Enterprise CCTV & AI Security Platform • All Rights Reserved © 2026
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
