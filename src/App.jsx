import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { 
  Layout, Activity, Settings, Info, Save, Trash2, 
  RotateCw, Factory, Zap, Box, ArrowRight, Lock, 
  Upload, CloudLightning, FileText, CheckCircle, AlertTriangle, X, Database, Wifi, RefreshCw, LogOut, Play, Square, Bell, Wrench, UserPlus, Users, Shield
} from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- Global Firebase References ---
let app;
let auth;
let db;

// --- Constants & Brands ---
const BRANDS = [
  { name: 'RYOBI', color: '#DAF600', text: '#000000', desc: 'Power Tools' }, // Ryobi Green
  { name: 'RIDGID', color: '#E24E1B', text: '#FFFFFF', desc: 'Professional' }, // Rigid Orange
  { name: 'HART', color: '#005EB8', text: '#FFFFFF', desc: 'Do It With Hart' }, // Hart Blue
  { name: 'HOOVER', color: '#AA0000', text: '#FFFFFF', desc: 'Floor Care' }, // Hoover Red
];

// --- Mock Data Generators ---
const generateWorkOrderData = () => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map(day => ({
    name: day,
    completed: Math.floor(Math.random() * 50) + 120,
    target: 150
  }));
};

const generateDowntimeData = () => Array.from({ length: 10 }, (_, i) => ({ hour: `0${i}:00`, minutes: Math.floor(Math.random() * 15) }));
const generateErrorTypeData = () => [
  { name: 'Mechanical', value: 400, color: '#ef4444' },
  { name: 'Electrical', value: 300, color: '#f59e0b' },
  { name: 'Software', value: 300, color: '#3b82f6' },
  { name: 'Sensor', value: 200, color: '#10b981' },
];
const generateRobotList = () => {
  const robots = [];
  for (let i = 23; i <= 43; i++) robots.push(i);
  for (let i = 48; i <= 67; i++) robots.push(i);
  return robots;
};
const MOCK_ROBOT_ERRORS = [
  { code: "E-404", desc: "Motor Sync Failure", time: "10:23 AM" },
  { code: "E-201", desc: "Lidar Obstruction", time: "09:15 AM" },
  { code: "W-105", desc: "Battery Voltage Low", time: "08:45 AM" },
  { code: "E-332", desc: "Pathing Timeout", time: "04:20 AM" },
];
const MOCK_ALERTS = [
  { id: 1, type: 'critical', msg: 'Conveyor 04 Jammed', time: 'Just now' },
  { id: 2, type: 'warning', msg: 'Robot 23 High Temp', time: '2m ago' },
  { id: 3, type: 'info', msg: 'Shift Change Completed', time: '15m ago' },
];

// --- Components ---

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white border border-gray-200 rounded-xl shadow-2xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800"><X size={20}/></button>
        <h3 className="text-xl font-bold text-gray-800 mb-4 pr-8">{title}</h3>
        {children}
      </div>
    </div>
  );
};

const RadialGauge = ({ value, label, color, subLabel, size = 120, onClick }) => {
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className={`flex flex-col items-center justify-center relative ${onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`} onClick={onClick}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e2e8f0" strokeWidth="8" fill="transparent" />
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-xl font-bold text-gray-800">{value}%</span></div>
      <span className="mt-2 text-xs font-bold text-gray-500 uppercase tracking-wide text-center">{label}</span>
      {subLabel && <span className="text-[10px] text-gray-400">{subLabel}</span>}
    </div>
  );
};

const HmiComponent = ({ item, isSelected, isEditable, onMouseDown, onRotate, onInfo, onDelete, onToggleRun }) => {
  const isRunning = item.data?.status === 'running';
  const style = { transform: `translate(${item.x}px, ${item.y}px) rotate(${item.rotation}deg)`, position: 'absolute', cursor: isEditable ? (isSelected ? 'grabbing' : 'grab') : 'pointer', transition: isEditable ? 'none' : 'transform 0.3s ease' };
  const renderIcon = () => {
    const color = isSelected ? "#2563eb" : (isRunning ? "#10b981" : "#475569"); 
    const fill = isSelected ? "#eff6ff" : (isRunning ? "#ecfdf5" : "#f8fafc");
    switch (item.type) {
      case 'conveyor-straight': return (<svg width="60" height="20" viewBox="0 0 60 20" fill="none" stroke={color} strokeWidth="2"><rect x="0" y="0" width="60" height="20" rx="2" fill={fill} /><path d="M5 0V20 M15 0V20 M25 0V20 M35 0V20 M45 0V20 M55 0V20" opacity="0.3" className={isRunning ? 'animate-pulse' : ''} />{isRunning && <path d="M0 10 L60 10" stroke={color} strokeDasharray="4 2" className="animate-[dash_1s_linear_infinite]" />}{!isRunning && <path d="M20 10H40M35 5L40 10L35 15" stroke={color} strokeWidth="2" />}</svg>);
      case 'conveyor-curve': return (<svg width="60" height="60" viewBox="0 0 60 60" fill="none" stroke={color} strokeWidth="2"><path d="M0 20H20C31.0457 20 40 28.9543 40 40V60" stroke={color} fill="none" strokeWidth="20" opacity="0.1"/><path d="M0 10H20C36.5685 10 50 23.4315 50 40V60" /><path d="M0 30H20C25.5228 30 30 34.4772 30 40V60" /></svg>);
      case 'motor': return (<div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center shadow-sm ${isRunning ? 'bg-green-50 border-green-500' : 'bg-white border-slate-600'}`}><Zap size={24} className={isRunning ? "text-green-500 animate-spin-slow" : "text-slate-500"} fill={isRunning ? "currentColor" : "none"} /></div>);
      case 'sensor': return (<div className="w-8 h-8 bg-white rotate-45 border-2 flex items-center justify-center shadow-sm" style={{borderColor: color}}><div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-ping' : 'bg-red-500'}`}></div></div>);
      case 'junction': return (<div className="w-14 h-14 bg-white border-2 flex items-center justify-center shadow-sm" style={{borderColor: color}}><ArrowRight size={24} color={color} /></div>);
      default: return <div className="w-10 h-10 bg-red-500">?</div>;
    }
  };
  return (
    <div style={style} className={`group select-none ${isSelected ? 'z-50' : 'z-10'}`} onMouseDown={(e) => isEditable && onMouseDown(e, item.id)} onDoubleClick={() => isEditable && onRotate(item.id)} onClick={(e) => { if(!isEditable && onToggleRun) onToggleRun(item.id); if(isEditable) onInfo(item); }}>
      {renderIcon()}
      {isSelected && isEditable && (<div className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-1 bg-white p-1 rounded shadow-xl border border-gray-200 z-50"><button onClick={(e) => { e.stopPropagation(); onInfo(item); }} className="p-1 hover:bg-gray-100 rounded text-blue-600"><Info size={14} /></button><button onClick={(e) => { e.stopPropagation(); onRotate(item.id); }} className="p-1 hover:bg-gray-100 rounded text-emerald-600"><RotateCw size={14} /></button><button onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} className="p-1 hover:bg-gray-100 rounded text-red-600"><Trash2 size={14} /></button></div>)}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap text-gray-500 bg-white/80 backdrop-blur px-1.5 py-0.5 rounded shadow-sm border border-gray-100">{item.data.name || item.type}</div>
    </div>
  );
};

// --- LOGIN SCREEN COMPONENT ---
const LoginScreen = ({ onLogin, error }) => {
  const [brandIndex, setBrandIndex] = useState(0);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setBrandIndex((prev) => (prev + 1) % BRANDS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const currentBrand = BRANDS[brandIndex];

  return (
    <div className="relative h-screen w-full bg-gray-900 overflow-hidden flex items-center justify-center font-sans perspective-1000">
      
      {/* --- 1. The Actual Picture (Environment) --- */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{
          // High-res factory background from Unsplash
          backgroundImage: 'url("https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=2670&auto=format&fit=crop")',
          filter: 'brightness(0.6) blur(2px)',
          transform: 'scale(1.1)' // Slight zoom to hide blurred edges
        }}
      ></div>

      {/* --- 2. The Realistic Conveyor System (CSS) --- */}
      {/* This sits ON TOP of the background image to provide a "track" for the box */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 z-10 flex flex-col items-center justify-end perspective-1000 pointer-events-none">
        
        {/* The Belt Surface */}
        <div 
          className="w-full h-64 relative"
          style={{
            background: 'linear-gradient(180deg, #1f2937 0%, #374151 20%, #111827 100%)',
            transform: 'rotateX(60deg) scale(1.5)',
            boxShadow: '0 -20px 50px rgba(0,0,0,0.8)'
          }}
        >
          {/* Moving Roller Texture */}
          <div className="absolute inset-0 opacity-30" 
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 40px, #000 40px, #000 42px)',
              animation: 'rollBelt 1s linear infinite'
            }}
          ></div>
          
          {/* Side Rails */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-yellow-500/80 border-r border-yellow-600"></div>
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-yellow-500/80 border-l border-yellow-600"></div>
        </div>
        
        {/* Animation Keyframes */}
        <style>{`
          @keyframes rollBelt {
            from { background-position: 0 0; }
            to { background-position: 0 42px; }
          }
        `}</style>
      </div>

      {/* --- 3. The Interactive Box (Part of the picture) --- */}
      {!showLogin && (
        <div 
          onClick={() => setShowLogin(true)}
          className="relative z-20 cursor-pointer group animate-in fade-in duration-1000"
          style={{ 
            marginBottom: '-80px', // Sink it into the "belt" visual
            transform: 'scale(0.8) translateY(50px)' 
          }} 
        >
          <div 
            className="w-80 h-72 relative rounded-sm flex flex-col items-center justify-center transition-all duration-500 ease-in-out transform group-hover:scale-105 group-hover:-translate-y-4"
            style={{ 
              backgroundColor: currentBrand.color,
              color: currentBrand.text,
              // Realistic box shadowing and lighting
              boxShadow: '0 20px 40px rgba(0,0,0,0.6), inset 0 2px 10px rgba(255,255,255,0.2), inset 0 -10px 30px rgba(0,0,0,0.2)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            {/* Box Flaps/Tape visual */}
            <div className="absolute top-0 w-full h-full border-t-2 border-black/10 pointer-events-none"></div>
            <div className="absolute left-1/2 -translate-x-1/2 w-16 h-full bg-black/5 mix-blend-multiply"></div>
            
            {/* Content */}
            <div className="z-10 text-center p-6">
              <h1 className="text-6xl font-black tracking-tighter mb-1 drop-shadow-md">{currentBrand.name}</h1>
              <p className="text-xs font-bold uppercase tracking-[0.3em] opacity-70">{currentBrand.desc}</p>
            </div>

            {/* Reflection on the "floor" */}
            <div 
              className="absolute -bottom-16 left-0 right-0 h-16 w-full opacity-30 blur-sm transform scale-y-[-1]"
              style={{ 
                backgroundColor: currentBrand.color,
                maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1), rgba(0,0,0,0))',
                WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1), rgba(0,0,0,0))'
              }}
            ></div>

            {/* Click Hint */}
            <div className="absolute -top-12 bg-white/90 text-black px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-lg animate-bounce">
              System Entry
            </div>
          </div>
        </div>
      )}

      {/* --- 4. Login Form Overlay (Unchanged logic) --- */}
      {showLogin && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in zoom-in duration-300">
          <div className="relative bg-gray-900 border border-gray-700 p-8 rounded-2xl shadow-2xl w-96">
            <button onClick={() => setShowLogin(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"><X size={20} /></button>
            
            <div className="flex flex-col items-center mb-6">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-3 shadow-lg shadow-blue-900/50">
                <Box className="text-white" size={24} />
              </div>
              <h2 className="text-white font-bold text-xl">System Access</h2>
              <p className="text-gray-400 text-xs mt-1">TTI Automation Secure Portal</p>
            </div>

            {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs text-center flex items-center gap-2 justify-center"><AlertTriangle size={12}/> {error}</div>}
            
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Username</label>
                <div className="relative mt-1">
                  <input 
                    type="text" 
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Enter ID"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                  <Users className="absolute left-3 top-3.5 text-gray-500" size={16} />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Password</label>
                <div className="relative mt-1">
                  <input 
                    type="password" 
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Lock className="absolute left-3 top-3.5 text-gray-500" size={16} />
                </div>
              </div>
              <button 
                onClick={() => onLogin(username, password)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-blue-900/20 mt-4"
              >
                Authenticate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Compact Mobile View (shown when a mobile device is detected)
const MobileView = ({ gaugeData, alerts, onContinue, onOpenRobot }) => {
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white p-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="bg-white rounded-xl shadow p-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">TTI Mobile</h3>
            <p className="text-xs text-gray-500">Compact operations overview</p>
          </div>
          <div>
            <button onClick={onContinue} className="text-xs px-3 py-1 bg-gray-100 rounded">Desktop</button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <div className="grid grid-cols-3 gap-2 items-center">
            <div className="flex flex-col items-center">
              <RadialGauge value={Math.round(gaugeData.raft)} label="Raft" color="#3b82f6" size={80} />
            </div>
            <div className="flex flex-col items-center">
              <RadialGauge value={Math.round(gaugeData.conveyor)} label="Conveyor" color="#10b981" size={80} />
            </div>
            <div className="flex flex-col items-center">
              <RadialGauge value={Math.round(gaugeData.autostore)} label="AutoStore" color="#8b5cf6" size={80} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold">Live Alerts</h4>
            <span className="text-xs text-gray-400">{alerts.length}</span>
          </div>
          <div className="space-y-2">
            {alerts.slice(0,4).map(a => (
              <div key={a.id} className={`p-2 rounded border ${a.type === 'critical' ? 'border-red-200 bg-red-50' : a.type === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-blue-100 bg-blue-50'}`}>
                <div className="flex justify-between items-center">
                  <div className="text-xs font-semibold text-gray-800">{a.msg}</div>
                  <div className="text-[10px] text-gray-500">{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => onOpenRobot && onOpenRobot()} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md">Open Fleet</button>
          <button onClick={onContinue} className="flex-1 px-4 py-2 bg-gray-100 rounded-md">Desktop</button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---
export default function IndustrialApp() {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); // { username, role }
  const [loginError, setLoginError] = useState('');
  
  // Users Database (Simulated persistence)
  const [userList, setUserList] = useState([
    { id: 1, username: 'dev', password: 'admin', role: 'developer' },
    { id: 2, username: 'operator', password: '1234', role: 'user' },
  ]);

  // --- App State ---
  // Responsive state: detect mobile vs desktop
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOverride, setMobileOverride] = useState(false); // allow user to continue to desktop view
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [activeBuildingId, setActiveBuildingId] = useState(1);
  const [firebaseConfigStr, setFirebaseConfigStr] = useState('');
  const [dbConnected, setDbConnected] = useState(false);
  const [buildings, setBuildings] = useState([
    { id: 1, name: "Wellford", color: "blue", theme: "from-blue-600 to-blue-400", text: "text-blue-600", bg: "bg-blue-50" },
    { id: 2, name: "The Power Center (TPC)", color: "emerald", theme: "from-emerald-600 to-emerald-400", text: "text-emerald-600", bg: "bg-emerald-50" },
    { id: 3, name: "EDC", color: "violet", theme: "from-violet-600 to-violet-400", text: "text-violet-600", bg: "bg-violet-50" },
    { id: 4, name: "Prime Robots", color: "orange", theme: "from-orange-600 to-orange-400", text: "text-orange-600", bg: "bg-orange-50" },
  ]);
  const [workOrderData, setWorkOrderData] = useState(generateWorkOrderData());
  const [downtimeData, setDowntimeData] = useState(generateDowntimeData());
  const [errorTypeData, setErrorTypeData] = useState(generateErrorTypeData());
  const [gaugeData, setGaugeData] = useState({ raft: 98, conveyor: 95, autostore: 99, quicktron: 92 });
  const [robotList, setRobotList] = useState(generateRobotList());
  const [robotStatus, setRobotStatus] = useState({});
  const [selectedRobot, setSelectedRobot] = useState(null);
  const [isRobotModalOpen, setIsRobotModalOpen] = useState(false);
  const [alerts, setAlerts] = useState(MOCK_ALERTS);
  const [layoutItems, setLayoutItems] = useState([{ id: 1, type: 'motor', x: 100, y: 100, rotation: 0, data: { name: 'Main Drive', status: 'stopped' } }]);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // User Management State
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });

  const currentTheme = buildings.find(b => b.id === activeBuildingId) || buildings[0];

  // Detect mobile by width (and keep live on resize)
  useEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // --- Auth Logic ---
  const handleLogin = (u, p) => {
    const user = userList.find(user => user.username === u && user.password === p);
    if (user) {
      setCurrentUser(user);
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Invalid credentials. Try dev/admin');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  const handleAddUser = () => {
    if (!newUser.username || !newUser.password) return;
    const u = { id: Date.now(), ...newUser };
    const updatedList = [...userList, u];
    setUserList(updatedList);
    setNewUser({ username: '', password: '', role: 'user' });
    // Sync with DB if connected
    if (dbConnected && db) {
      setDoc(doc(db, 'artifacts', 'tti-auto', 'private', 'users'), { list: updatedList });
    }
  };

  const handleDeleteUser = (id) => {
    const updatedList = userList.filter(u => u.id !== id);
    setUserList(updatedList);
    if (dbConnected && db) {
      setDoc(doc(db, 'artifacts', 'tti-auto', 'private', 'users'), { list: updatedList });
    }
  };

  // --- Standard Logic ---
  useEffect(() => {
    const savedConfig = localStorage.getItem('tti_firebase_config');
    if (savedConfig) {
      setFirebaseConfigStr(savedConfig);
      tryConnectFirebase(savedConfig);
    }
  }, []);

  const tryConnectFirebase = async (configStr) => {
    try {
      const config = JSON.parse(configStr);
      if (!getApps().length) app = initializeApp(config); else app = getApp();
      auth = getAuth(app);
      db = getFirestore(app);
      await signInAnonymously(auth);
      setDbConnected(true);
      // Load layout
      onSnapshot(doc(db, 'artifacts', 'tti-auto', 'public', 'data', 'layout'), (snap) => {
        if(snap.exists() && !unsavedChanges) setLayoutItems(snap.data().items);
      });
      // Load users (Private)
      onSnapshot(doc(db, 'artifacts', 'tti-auto', 'private', 'users'), (snap) => {
        if(snap.exists()) setUserList(snap.data().list);
      });
    } catch (error) { console.error("DB Error", error); setDbConnected(false); }
  };

  const handleSaveConfig = () => {
    try {
      JSON.parse(firebaseConfigStr);
      localStorage.setItem('tti_firebase_config', firebaseConfigStr);
      tryConnectFirebase(firebaseConfigStr);
      alert("Saved.");
    } catch (e) { alert("Invalid JSON"); }
  };

  // Mock Data Loop
  useEffect(() => {
    const initialRobotData = {};
    robotList.forEach(id => initialRobotData[id] = Math.floor(Math.random() * 15) + 85);
    setRobotStatus(initialRobotData);
    const interval = setInterval(() => {
      setGaugeData(prev => ({
        raft: Math.min(100, Math.max(0, prev.raft + (Math.random() - 0.5) * 2)),
        conveyor: Math.min(100, Math.max(0, prev.conveyor + (Math.random() - 0.5) * 3)),
        autostore: Math.min(100, Math.max(0, prev.autostore + (Math.random() - 0.5) * 1)),
        quicktron: Math.min(100, Math.max(0, prev.quicktron + (Math.random() - 0.5) * 4)),
      }));
      setRobotStatus(prev => {
        const next = { ...prev };
        const randomId = robotList[Math.floor(Math.random() * robotList.length)];
        next[randomId] = Math.min(100, Math.max(40, next[randomId] + (Math.random() - 0.5) * 10));
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const saveLayoutToDatabase = async () => {
    if (dbConnected && db) {
       await setDoc(doc(db, 'artifacts', 'tti-auto', 'public', 'data', 'layout'), { items: layoutItems });
       setUnsavedChanges(false);
       alert("Layout synced to Cloud.");
    } else {
       setUnsavedChanges(false);
       alert("Saved Locally.");
    }
  };

  // Canvas Handlers
  const addItem = (type) => {
    if (currentUser?.role !== 'developer') return;
    const newItem = { id: Date.now(), type, x: 300, y: 300, rotation: 0, data: { name: type, model: '-', serial: '-', status: 'stopped' }};
    setLayoutItems([...layoutItems, newItem]);
    setSelectedItemId(newItem.id);
    setUnsavedChanges(true);
  };
  const handleToggleRun = (id) => {
    setLayoutItems(prev => prev.map(item => item.id === id ? { ...item, data: { ...item.data, status: item.data.status === 'running' ? 'stopped' : 'running' } } : item));
    setUnsavedChanges(true);
  };
  const handleMouseDown = (e, id) => { if (currentUser?.role === 'developer') { e.stopPropagation(); setSelectedItemId(id); setIsDragging(true); const i = layoutItems.find(x=>x.id===id); setDragOffset({x: e.clientX-i.x, y:e.clientY-i.y}); }};
  const handleCanvasMouseMove = (e) => { if (isDragging && selectedItemId && currentUser?.role === 'developer') { const nx = e.clientX-dragOffset.x; const ny = e.clientY-dragOffset.y; setLayoutItems(prev => prev.map(i => i.id===selectedItemId ? {...i, x:nx, y:ny} : i)); setUnsavedChanges(true); }};
  const handleCanvasMouseUp = () => setIsDragging(false);
  const handleRotate = (id) => { if(currentUser?.role === 'developer') { setLayoutItems(prev => prev.map(i => i.id===id ? {...i, rotation:(i.rotation+90)%360} : i)); setUnsavedChanges(true); }};
  const handleDelete = (id) => { if(currentUser?.role === 'developer') { setLayoutItems(prev => prev.filter(i => i.id!==id)); setSelectedItemId(null); setUnsavedChanges(true); }};
  const handleInfoClick = (item) => { setEditingItem({...item}); setIsModalOpen(true); };
  const saveItemDetails = () => { setLayoutItems(prev => prev.map(i => i.id===editingItem.id ? editingItem : i)); setIsModalOpen(false); setUnsavedChanges(true); };

  // --- RENDER CHECK ---
  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} error={loginError} />;
  }

  // If on a small screen and user hasn't chosen to continue to desktop, show mobile view
  if (isMobile && !mobileOverride) {
    return (
      <MobileView
        gaugeData={gaugeData}
        alerts={alerts}
        onContinue={() => setMobileOverride(true)}
        onOpenRobot={() => { setActiveTab('dashboard'); setMobileOverride(true); }}
      />
    );
  }

  const renderWellfordDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2 h-[300px]">
           <h3 className="text-lg font-semibold mb-4 text-gray-700 flex items-center gap-2"><Activity size={18} className="text-red-500"/> Downtime Hours (Daily)</h3>
           <div className="w-full h-[200px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={downtimeData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/><XAxis dataKey="hour" stroke="#94a3b8" fontSize={12}/><YAxis stroke="#94a3b8" fontSize={12}/><RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px'}}/><Bar dataKey="minutes" fill="#ef4444" radius={[4,4,0,0]} name="Minutes Down"/></BarChart></ResponsiveContainer></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-2 gap-4 place-items-center h-[300px] overflow-y-auto">
           <div className="col-span-2 w-full text-left font-semibold text-gray-700 mb-2 border-b pb-2">System Uptime</div>
           <RadialGauge value={Math.round(gaugeData.raft)} label="Raft" color="#3b82f6" size={100} />
           <RadialGauge value={Math.round(gaugeData.conveyor)} label="Conveyor" color="#10b981" size={100} />
           <div className="col-span-2 pt-2"><RadialGauge value={Math.round(gaugeData.autostore)} label="AutoStore" color="#8b5cf6" size={100} /></div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2 h-[350px]">
            <h3 className="text-lg font-semibold mb-4 text-gray-700 flex items-center gap-2"><CheckCircle size={18} className="text-blue-500"/> Work Orders Completed</h3>
            <div className="w-full h-[250px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={workOrderData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/><XAxis dataKey="name" stroke="#94a3b8"/><YAxis stroke="#94a3b8"/><RechartsTooltip contentStyle={{borderRadius: '8px'}}/><Line type="monotone" dataKey="completed" stroke="#3b82f6" strokeWidth={3} dot={{r:4}} activeDot={{r:6}}/></LineChart></ResponsiveContainer></div>
         </div>
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-[350px]">
            <h3 className="text-lg font-semibold mb-4 text-gray-700">Errors by Type</h3>
            <div className="w-full h-[250px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={errorTypeData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{errorTypeData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie><RechartsTooltip /></PieChart></ResponsiveContainer></div>
         </div>
      </div>
    </div>
  );

  const renderStandardBuilding = (gaugeType, gaugeLabel, gaugeColor) => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2 h-[300px]">
           <h3 className="text-lg font-semibold mb-4 text-gray-700 flex items-center gap-2"><Activity size={18} className="text-red-500"/> Downtime Hours (Daily)</h3>
           <div className="w-full h-[200px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={downtimeData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/><XAxis dataKey="hour" stroke="#94a3b8" fontSize={12}/><YAxis stroke="#94a3b8" fontSize={12}/><RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px'}}/><Bar dataKey="minutes" fill="#ef4444" radius={[4,4,0,0]} name="Minutes Down"/></BarChart></ResponsiveContainer></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center h-[300px]">
           <div className="w-full text-left font-semibold text-gray-700 mb-4 border-b pb-2">Primary System Uptime</div>
           <RadialGauge value={Math.round(gaugeData[gaugeType])} label={gaugeLabel} color={gaugeColor} size={160} />
        </div>
      </div>
    </div>
  );

  const renderPrimeRobots = () => (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-xl font-bold mb-6 text-gray-800 flex items-center justify-between">
          <span>Robot Fleet Status (45 Units)</span>
          <div className="flex gap-4 text-sm"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div>Optimal</div><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500"></div>Warning</div><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div>Critical</div></div>
        </h3>
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-6">
          {robotList.map(id => {
            const val = Math.round(robotStatus[id] || 0);
            let color = '#10b981'; if (val < 90) color = '#f59e0b'; if (val < 70) color = '#ef4444';
            return <div key={id} className="flex justify-center"><RadialGauge value={val} label={`Robot ${id}`} color={color} size={90} subLabel={val < 90 ? "ERR" : "OK"} onClick={() => setSelectedRobot(id) || setIsRobotModalOpen(true)} /></div>;
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-gray-50 text-gray-800 overflow-hidden font-sans">
      <aside className="w-20 flex flex-col items-center py-6 bg-white border-r border-gray-200 z-20 shadow-sm">
        <div className={`mb-8 p-2 rounded-lg bg-gradient-to-br ${currentTheme.theme} shadow-lg`}>
          <Factory className="text-white" size={28} />
        </div>
        <nav className="flex flex-col gap-6 w-full">
          <button onClick={() => setActiveTab('dashboard')} className={`p-3 mx-auto rounded-xl transition-all ${activeTab === 'dashboard' ? `bg-gray-100 ${currentTheme.text}` : 'text-gray-400 hover:text-gray-600'}`}><Activity size={24} /></button>
          <button onClick={() => setActiveTab('layout')} className={`p-3 mx-auto rounded-xl transition-all ${activeTab === 'layout' ? `bg-gray-100 ${currentTheme.text}` : 'text-gray-400 hover:text-gray-600'}`}><Layout size={24} /></button>
          <button onClick={() => setActiveTab('settings')} className={`p-3 mx-auto rounded-xl transition-all ${activeTab === 'settings' ? `bg-gray-100 ${currentTheme.text}` : 'text-gray-400 hover:text-gray-600'}`}><Settings size={24} /></button>
        </nav>
        <div className="mt-auto flex flex-col items-center gap-4 mb-4">
           {dbConnected ? <Database className="text-green-500 animate-pulse" size={16} /> : <Wifi className="text-gray-300" size={16} />}
           <div className={`w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-xs font-bold text-white ${currentUser?.role === 'developer' ? 'bg-purple-600' : 'bg-blue-500'}`}>{currentUser?.username.substring(0,2).toUpperCase()}</div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className={`h-16 border-b border-gray-200 flex items-center justify-between px-8 bg-white z-10 transition-colors duration-500`}>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{activeTab === 'dashboard' ? 'Operations Dashboard' : activeTab === 'layout' ? 'System Layout' : 'Configuration'}</h1>
            <p className={`text-xs font-medium ${currentTheme.text}`}>Logged in as: <span className="font-bold uppercase">{currentUser?.username}</span> ({currentUser?.role})</p>
          </div>
          {activeTab === 'dashboard' && (
            <div className="flex bg-gray-100 rounded-lg p-1 gap-1 overflow-x-auto max-w-[60vw]">
              {buildings.map(b => (
                <button key={b.id} onClick={() => setActiveBuildingId(b.id)} className={`px-4 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all ${activeBuildingId === b.id ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>{b.name}</button>
              ))}
            </div>
          )}
          {activeTab === 'layout' && currentUser?.role === 'developer' && (
             <button onClick={saveLayoutToDatabase} className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow text-white bg-gradient-to-r ${currentTheme.theme} hover:opacity-90 transition-opacity ${unsavedChanges ? 'animate-pulse' : ''}`}><Save size={16} /> {unsavedChanges ? 'Save Changes' : 'Layout Saved'}</button>
          )}
        </header>

        {activeTab === 'dashboard' && (
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 flex gap-6">
            <div className="flex-1">
              {activeBuildingId === 1 && renderWellfordDashboard()}
              {activeBuildingId === 2 && renderStandardBuilding('conveyor', 'Conveyor System', '#10b981')}
              {activeBuildingId === 3 && renderStandardBuilding('quicktron', 'Quicktron AGV', '#8b5cf6')}
              {activeBuildingId === 4 && renderPrimeRobots()}
            </div>
            <div className="w-80 bg-white border-l border-gray-200 p-4 hidden xl:block overflow-y-auto">
               <div className="flex items-center gap-2 mb-4 text-gray-800 font-bold"><Bell size={20} /> Live Alerts</div>
               <div className="space-y-3">{alerts.map(alert => (
                   <div key={alert.id} className={`p-3 rounded-lg border-l-4 ${alert.type === 'critical' ? 'bg-red-50 border-red-500' : alert.type === 'warning' ? 'bg-amber-50 border-amber-500' : 'bg-blue-50 border-blue-500'} animate-in slide-in-from-right duration-300`}><div className="flex justify-between items-start"><span className={`text-xs font-bold uppercase ${alert.type === 'critical' ? 'text-red-700' : alert.type === 'warning' ? 'text-amber-700' : 'text-blue-700'}`}>{alert.type}</span><span className="text-[10px] text-gray-400">{alert.time}</span></div><p className="text-sm font-medium text-gray-800 mt-1">{alert.msg}</p></div>
                 ))}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'layout' && (
          <div className="flex-1 flex relative overflow-hidden bg-white" onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseUp}>
            {currentUser?.role !== 'developer' && (
              <div className="absolute top-4 left-4 z-50 bg-white/90 backdrop-blur border border-gray-200 p-3 rounded-lg shadow-lg flex items-center gap-3"><Lock size={18} className="text-gray-500" /><div className="text-xs text-gray-600"><strong>View Only</strong><br/>Developer access required to edit.</div></div>
            )}
            {currentUser?.role === 'developer' && (
              <div className="w-64 bg-white border-r border-gray-200 p-4 flex flex-col gap-4 z-10 shadow-xl">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Toolbox</h3>
                {['conveyor-straight', 'conveyor-curve', 'junction', 'motor', 'sensor'].map(type => (<button key={type} onClick={() => addItem(type)} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-white hover:shadow-md border border-gray-100 hover:border-blue-200 transition-all group text-left"><span className="text-sm font-medium text-gray-600 group-hover:text-blue-600 capitalize">{type.replace('-', ' ')}</span></button>))}
              </div>
            )}
            <div className="flex-1 relative overflow-hidden bg-gray-50" style={{backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px'}} onClick={() => setSelectedItemId(null)}>
              {layoutItems.map(item => <HmiComponent key={item.id} item={item} isSelected={selectedItemId === item.id} isEditable={currentUser?.role === 'developer'} onMouseDown={handleMouseDown} onRotate={handleRotate} onDelete={handleDelete} onInfo={handleInfoClick} onToggleRun={handleToggleRun} />)}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-10 bg-gray-50">
             <div className="max-w-4xl mx-auto space-y-8">
               
               {/* User Profile / Logout */}
               <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 flex justify-between items-center">
                 <div className="flex items-center gap-4">
                   <div className="h-12 w-12 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-xl">{currentUser.username.substring(0,1).toUpperCase()}</div>
                   <div><h2 className="text-xl font-bold text-gray-900">Hi, {currentUser.username}</h2><p className="text-sm text-gray-500 capitalize">Role: {currentUser.role}</p></div>
                 </div>
                 <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-100"><LogOut size={18}/> Sign Out</button>
               </div>

               {/* User Management (Developer Only) */}
               {currentUser.role === 'developer' && (
                 <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 animate-in slide-in-from-bottom-4 duration-500">
                   <div className="flex items-center gap-3 mb-6 text-purple-700"><Users size={24} /><h2 className="text-xl font-bold text-gray-900">User Management</h2></div>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     <div className="md:col-span-1 bg-gray-50 p-4 rounded-xl border border-gray-200">
                       <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase">Create New User</h3>
                       <div className="space-y-3">
                         <input type="text" placeholder="Username" className="w-full border p-2 rounded text-sm" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                         <input type="text" placeholder="Password" className="w-full border p-2 rounded text-sm" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                         <select className="w-full border p-2 rounded text-sm" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                           <option value="user">Operator (Read Only)</option>
                           <option value="developer">Developer (Admin)</option>
                         </select>
                         <button onClick={handleAddUser} className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 flex justify-center items-center gap-2 text-sm font-bold"><UserPlus size={16} /> Add User</button>
                       </div>
                     </div>
                     <div className="md:col-span-2">
                       <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase">Active Accounts</h3>
                       <div className="space-y-2">
                         {userList.map(u => (
                           <div key={u.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded shadow-sm">
                             <div className="flex items-center gap-3">
                               <div className={`w-2 h-2 rounded-full ${u.role === 'developer' ? 'bg-purple-500' : 'bg-blue-500'}`}></div>
                               <div><div className="font-bold text-sm text-gray-800">{u.username}</div><div className="text-xs text-gray-400 capitalize">{u.role}</div></div>
                             </div>
                             {u.username !== 'dev' && <button onClick={() => handleDeleteUser(u.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>}
                           </div>
                         ))}
                       </div>
                     </div>
                   </div>
                 </div>
               )}

               {/* Database Configuration (Developer Only) */}
               {currentUser.role === 'developer' && (
                 <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 transition-all">
                   <div className="flex items-center gap-3 mb-6"><div className={`p-2 rounded-lg ${dbConnected ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}><Database size={24} /></div><div><h2 className="text-xl font-bold text-gray-900">Cloud Database</h2><p className="text-sm text-gray-500">Sync users and layouts to Firebase.</p></div></div>
                   <div className="space-y-4">
                     <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Firebase Config JSON</label><textarea className="w-full h-24 font-mono text-xs border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none resize-y" value={firebaseConfigStr} onChange={(e) => setFirebaseConfigStr(e.target.value)} /></div>
                     <div className="flex justify-between items-center pt-2"><div className="flex items-center gap-2 text-sm"><div className={`w-2 h-2 rounded-full ${dbConnected ? 'bg-green-500' : 'bg-gray-300'}`}></div><span className={dbConnected ? 'text-green-600 font-medium' : 'text-gray-500'}>{dbConnected ? 'Connected to Cloud' : 'Offline / Not Configured'}</span></div><div className="flex gap-3"><button onClick={handleClearConfig} className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><LogOut size={16}/> Disconnect</button><button onClick={handleSaveConfig} className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-md transition-all active:scale-95"><RefreshCw size={16} /> Save & Connect</button></div></div>
                   </div>
                 </div>
               )}
             </div>
          </div>
        )}
      </main>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Component Details">
        {editingItem && (
          <div className="flex flex-col gap-4">
            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label><input type="text" disabled={currentUser?.role !== 'developer'} className="w-full border border-gray-300 rounded p-2 text-gray-800 focus:border-blue-500 outline-none disabled:bg-gray-100" value={editingItem.data.name} onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, name: e.target.value}})}/></div>
            <div className="pt-4 flex justify-end gap-3"><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500">Close</button>{currentUser?.role === 'developer' && (<button onClick={saveItemDetails} className="px-4 py-2 bg-blue-600 text-white rounded font-medium shadow">Save</button>)}</div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isRobotModalOpen} onClose={() => setIsRobotModalOpen(false)} title={`Robot ${selectedRobot} Diagnostics`}>
         <div className="space-y-4">
           <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-100"><div className="flex items-center gap-3"><div className="p-2 bg-white rounded-full shadow-sm"><AlertTriangle className="text-red-500" size={24} /></div><div><div className="text-sm font-bold text-red-800">Current Status: Faulted</div><div className="text-xs text-red-600">Uptime: {robotStatus[selectedRobot]}%</div></div></div><button className="text-xs bg-white border border-red-200 text-red-600 px-3 py-1 rounded hover:bg-red-100">Reset Robot</button></div>
           <div><h4 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Recent Error Logs</h4><div className="border border-gray-200 rounded-lg overflow-hidden"><table className="w-full text-sm text-left"><thead className="bg-gray-50 text-gray-500 font-medium"><tr><th className="p-3 border-b">Time</th><th className="p-3 border-b">Code</th><th className="p-3 border-b">Description</th></tr></thead><tbody className="divide-y divide-gray-100">{MOCK_ROBOT_ERRORS.map((err, idx) => (<tr key={idx} className="hover:bg-gray-50"><td className="p-3 text-gray-500 font-mono">{err.time}</td><td className="p-3 font-bold text-gray-700">{err.code}</td><td className="p-3 text-gray-600">{err.desc}</td></tr>))}</tbody></table></div></div>
         </div>
      </Modal>
    </div>
  );
}