import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { 
  Layout, Activity, Settings, Info, Save, Trash2, 
  RotateCw, Factory, Zap, Box, ArrowRight, Lock, 
  Upload, CloudLightning, FileText, CheckCircle, AlertTriangle, X, Database, Wifi, RefreshCw, LogOut
} from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- Global Firebase References ---
let app;
let auth;
let db;

// --- Mock Data Generators ---
const generateWorkOrderData = () => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map(day => ({
    name: day,
    completed: Math.floor(Math.random() * 50) + 120,
    target: 150
  }));
};

const generateDowntimeData = () => {
  return Array.from({ length: 10 }, (_, i) => ({
    hour: `0${i}:00`,
    minutes: Math.floor(Math.random() * 15)
  }));
};

const generateErrorTypeData = () => [
  { name: 'Mechanical', value: 400, color: '#ef4444' },
  { name: 'Electrical', value: 300, color: '#f59e0b' },
  { name: 'Software', value: 300, color: '#3b82f6' },
  { name: 'Sensor', value: 200, color: '#10b981' },
];

// Robot IDs Generator (23-43, 48-67)
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

// Custom SVG Radial Gauge
const RadialGauge = ({ value, label, color, subLabel, size = 120, onClick }) => {
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  
  return (
    <div 
      className={`flex flex-col items-center justify-center relative ${onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
      onClick={onClick}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e2e8f0" strokeWidth="8" fill="transparent" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-xl font-bold text-gray-800">{value}%</span>
      </div>
      <span className="mt-2 text-xs font-bold text-gray-500 uppercase tracking-wide text-center">{label}</span>
      {subLabel && <span className="text-[10px] text-gray-400">{subLabel}</span>}
    </div>
  );
};

const HmiComponent = ({ item, isSelected, isEditable, onMouseDown, onRotate, onInfo, onDelete }) => {
  const style = {
    transform: `translate(${item.x}px, ${item.y}px) rotate(${item.rotation}deg)`,
    position: 'absolute',
    cursor: isEditable ? (isSelected ? 'grabbing' : 'grab') : 'default',
    transition: isEditable ? 'none' : 'transform 0.3s ease',
  };

  const renderIcon = () => {
    const color = isSelected ? "#2563eb" : "#475569"; 
    const fill = isSelected ? "#eff6ff" : "#f8fafc";

    switch (item.type) {
      case 'conveyor-straight':
        return (
          <svg width="60" height="20" viewBox="0 0 60 20" fill="none" stroke={color} strokeWidth="2">
            <rect x="0" y="0" width="60" height="20" rx="2" fill={fill} />
            <path d="M5 0V20 M15 0V20 M25 0V20 M35 0V20 M45 0V20 M55 0V20" opacity="0.3" />
            <path d="M20 10H40M35 5L40 10L35 15" stroke={color} strokeWidth="2" />
          </svg>
        );
      case 'conveyor-curve':
        return (
          <svg width="60" height="60" viewBox="0 0 60 60" fill="none" stroke={color} strokeWidth="2">
            <path d="M0 20H20C31.0457 20 40 28.9543 40 40V60" stroke={color} fill="none" strokeWidth="20" opacity="0.1"/>
            <path d="M0 10H20C36.5685 10 50 23.4315 50 40V60" />
            <path d="M0 30H20C25.5228 30 30 34.4772 30 40V60" />
          </svg>
        );
      case 'motor':
        return (
          <div className="w-12 h-12 bg-white rounded-full border-2 flex items-center justify-center shadow-sm" style={{borderColor: color}}>
            <Zap size={24} color={color} fill={isSelected ? color : "none"} />
          </div>
        );
      case 'sensor':
        return (
          <div className="w-8 h-8 bg-white rotate-45 border-2 flex items-center justify-center shadow-sm" style={{borderColor: color}}>
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          </div>
        );
      case 'junction':
        return (
           <div className="w-14 h-14 bg-white border-2 flex items-center justify-center shadow-sm" style={{borderColor: color}}>
            <ArrowRight size={24} color={color} />
          </div>
        );
      default:
        return <div className="w-10 h-10 bg-red-500">?</div>;
    }
  };

  return (
    <div 
      style={style} 
      className={`group select-none ${isSelected ? 'z-50' : 'z-10'}`}
      onMouseDown={(e) => isEditable && onMouseDown(e, item.id)}
      onDoubleClick={() => isEditable && onRotate(item.id)}
      onClick={(e) => { if(!isEditable) onInfo(item); }}
    >
      {renderIcon()}
      {isSelected && isEditable && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-1 bg-white p-1 rounded shadow-xl border border-gray-200 z-50">
           <button onClick={(e) => { e.stopPropagation(); onInfo(item); }} className="p-1 hover:bg-gray-100 rounded text-blue-600" title="Details"><Info size={14} /></button>
          <button onClick={(e) => { e.stopPropagation(); onRotate(item.id); }} className="p-1 hover:bg-gray-100 rounded text-emerald-600" title="Rotate"><RotateCw size={14} /></button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} className="p-1 hover:bg-gray-100 rounded text-red-600" title="Delete"><Trash2 size={14} /></button>
        </div>
      )}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap text-gray-500 bg-white/80 backdrop-blur px-1.5 py-0.5 rounded shadow-sm border border-gray-100">
        {item.data.name || item.type}
      </div>
    </div>
  );
};

export default function IndustrialApp() {
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [activeBuildingId, setActiveBuildingId] = useState(1);
  
  // --- Auth & Config State ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [firebaseConfigStr, setFirebaseConfigStr] = useState('');
  const [dbConnected, setDbConnected] = useState(false);
  
  // --- Building List ---
  const [buildings, setBuildings] = useState([
    { id: 1, name: "Wellford", color: "blue", theme: "from-blue-600 to-blue-400", text: "text-blue-600", bg: "bg-blue-50" },
    { id: 2, name: "The Power Center (TPC)", color: "emerald", theme: "from-emerald-600 to-emerald-400", text: "text-emerald-600", bg: "bg-emerald-50" },
    { id: 3, name: "EDC", color: "violet", theme: "from-violet-600 to-violet-400", text: "text-violet-600", bg: "bg-violet-50" },
    { id: 4, name: "Prime Robots", color: "orange", theme: "from-orange-600 to-orange-400", text: "text-orange-600", bg: "bg-orange-50" },
  ]);

  // --- Dashboard State ---
  const [workOrderData, setWorkOrderData] = useState(generateWorkOrderData());
  const [downtimeData, setDowntimeData] = useState(generateDowntimeData());
  const [errorTypeData, setErrorTypeData] = useState(generateErrorTypeData());
  
  // Gauge Data
  const [gaugeData, setGaugeData] = useState({
    raft: 98, conveyor: 95, autostore: 99, quicktron: 92
  });

  // Robot Data
  const [robotList, setRobotList] = useState(generateRobotList());
  const [robotStatus, setRobotStatus] = useState({});
  const [selectedRobot, setSelectedRobot] = useState(null);
  const [isRobotModalOpen, setIsRobotModalOpen] = useState(false);

  // --- Layout/HMI State ---
  const [layoutItems, setLayoutItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  
  // --- Modal State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const currentTheme = buildings.find(b => b.id === activeBuildingId) || buildings[0];

  // --- FIREBASE INITIALIZATION LOGIC ---
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
      
      // Check if already initialized to avoid duplicate app error
      if (!getApps().length) {
        app = initializeApp(config);
      } else {
        app = getApp(); // Get default app
      }

      auth = getAuth(app);
      db = getFirestore(app);

      // Attempt to sign in
      await signInAnonymously(auth);
      setDbConnected(true);
      
      // Setup Listeners
      setupDatabaseListeners();

    } catch (error) {
      console.error("Firebase Connection Failed:", error);
      setDbConnected(false);
      // Don't alert on auto-connect attempt to avoid annoyance, only log
    }
  };

  const setupDatabaseListeners = () => {
    if (!db) return;
    // Sync Layout
    const layoutRef = doc(db, 'artifacts', 'tti-auto', 'public', 'data', 'layout');
    onSnapshot(layoutRef, (docSnap) => {
      if (docSnap.exists()) {
        // Only update if we aren't actively editing (rudimentary conflict avoidance)
        if (!unsavedChanges) {
           setLayoutItems(docSnap.data().items || []);
        }
      }
    });
  };

  const handleSaveConfig = () => {
    try {
      // Validate JSON
      JSON.parse(firebaseConfigStr);
      localStorage.setItem('tti_firebase_config', firebaseConfigStr);
      tryConnectFirebase(firebaseConfigStr);
      alert("Configuration saved. Attempting to connect...");
    } catch (e) {
      alert("Invalid JSON format. Please check your config object.");
    }
  };

  const handleClearConfig = () => {
    localStorage.removeItem('tti_firebase_config');
    setFirebaseConfigStr('');
    setDbConnected(false);
    alert("Configuration cleared. You are now in Offline Mode.");
    window.location.reload(); // Reload to clear firebase instance cleanly
  };

  // --- MOCK DATA ENGINE ---
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

  // --- Handlers ---
  const handleRobotClick = (id) => { setSelectedRobot(id); setIsRobotModalOpen(true); };
  
  const saveLayoutToDatabase = async () => {
    if (dbConnected && db) {
       try {
         await setDoc(doc(db, 'artifacts', 'tti-auto', 'public', 'data', 'layout'), { items: layoutItems });
         setUnsavedChanges(false);
         alert("Layout saved to Cloud Database successfully.");
       } catch (e) {
         alert("Error saving to cloud: " + e.message);
       }
    } else {
       setUnsavedChanges(false);
       alert("Layout saved locally (Offline Mode). Connect Database in Settings to save to cloud.");
    }
  };

  const addItem = (type) => {
    if (!isLoggedIn) return;
    const newItem = { id: Date.now(), type, x: 300, y: 300, rotation: 0, data: { name: type, model: '-', serial: '-' }};
    setLayoutItems([...layoutItems, newItem]);
    setSelectedItemId(newItem.id);
    setUnsavedChanges(true);
  };
  const handleMouseDown = (e, id) => { if (isLoggedIn) { e.stopPropagation(); setSelectedItemId(id); setIsDragging(true); const i = layoutItems.find(x=>x.id===id); setDragOffset({x: e.clientX-i.x, y:e.clientY-i.y}); }};
  const handleCanvasMouseMove = (e) => { if (isDragging && selectedItemId && isLoggedIn) { const nx = e.clientX-dragOffset.x; const ny = e.clientY-dragOffset.y; setLayoutItems(prev => prev.map(i => i.id===selectedItemId ? {...i, x:nx, y:ny} : i)); setUnsavedChanges(true); }};
  const handleCanvasMouseUp = () => setIsDragging(false);
  const handleRotate = (id) => { if(isLoggedIn) { setLayoutItems(prev => prev.map(i => i.id===id ? {...i, rotation:(i.rotation+90)%360} : i)); setUnsavedChanges(true); }};
  const handleDelete = (id) => { if(isLoggedIn) { setLayoutItems(prev => prev.filter(i => i.id!==id)); setSelectedItemId(null); setUnsavedChanges(true); }};
  const handleInfoClick = (item) => { setEditingItem({...item}); setIsModalOpen(true); };
  const saveItemDetails = () => { setLayoutItems(prev => prev.map(i => i.id===editingItem.id ? editingItem : i)); setIsModalOpen(false); setUnsavedChanges(true); };

  // --- View Renderers (Condensed for brevity, logic identical to previous) ---
  const renderChartSection = (title, icon, ChartComponent, data) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2 h-[300px]">
       <h3 className="text-lg font-semibold mb-4 text-gray-700 flex items-center gap-2">{icon} {title}</h3>
       <div className="w-full h-[200px]"><ResponsiveContainer width="100%" height="100%">{ChartComponent}</ResponsiveContainer></div>
    </div>
  );

  const renderWellfordDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2 h-[300px]">
           <h3 className="text-lg font-semibold mb-4 text-gray-700 flex items-center gap-2"><Activity size={18} className="text-red-500"/> Downtime Hours (Daily)</h3>
           <div className="w-full h-[200px]">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={downtimeData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                  <XAxis dataKey="hour" stroke="#94a3b8" fontSize={12}/>
                  <YAxis stroke="#94a3b8" fontSize={12}/>
                  <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px'}}/>
                  <Bar dataKey="minutes" fill="#ef4444" radius={[4,4,0,0]} name="Minutes Down"/>
                </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-2 gap-4 place-items-center h-[300px] overflow-y-auto">
           <div className="col-span-2 w-full text-left font-semibold text-gray-700 mb-2 border-b pb-2">System Uptime</div>
           <RadialGauge value={Math.round(gaugeData.raft)} label="Raft" color="#3b82f6" size={100} />
           <RadialGauge value={Math.round(gaugeData.conveyor)} label="Conveyor" color="#10b981" size={100} />
           <div className="col-span-2 pt-2"><RadialGauge value={Math.round(gaugeData.autostore)} label="AutoStore" color="#8b5cf6" size={100} /></div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Work Orders */}
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2 h-[350px]">
            <h3 className="text-lg font-semibold mb-4 text-gray-700 flex items-center gap-2"><CheckCircle size={18} className="text-blue-500"/> Work Orders Completed</h3>
            <div className="w-full h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={workOrderData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                   <XAxis dataKey="name" stroke="#94a3b8"/><YAxis stroke="#94a3b8"/>
                   <RechartsTooltip contentStyle={{borderRadius: '8px'}}/>
                   <Line type="monotone" dataKey="completed" stroke="#3b82f6" strokeWidth={3} dot={{r:4}} activeDot={{r:6}}/>
                 </LineChart>
              </ResponsiveContainer>
            </div>
         </div>
         {/* Errors Pie */}
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-[350px]">
            <h3 className="text-lg font-semibold mb-4 text-gray-700">Errors by Type</h3>
            <div className="w-full h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={errorTypeData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {errorTypeData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
         </div>
      </div>
    </div>
  );

  const renderStandardBuilding = (gaugeType, gaugeLabel, gaugeColor) => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2 h-[300px]">
           <h3 className="text-lg font-semibold mb-4 text-gray-700 flex items-center gap-2"><Activity size={18} className="text-red-500"/> Downtime Hours (Daily)</h3>
           <div className="w-full h-[200px]">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={downtimeData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                  <XAxis dataKey="hour" stroke="#94a3b8" fontSize={12}/>
                  <YAxis stroke="#94a3b8" fontSize={12}/>
                  <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px'}}/>
                  <Bar dataKey="minutes" fill="#ef4444" radius={[4,4,0,0]} name="Minutes Down"/>
                </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center h-[300px]">
           <div className="w-full text-left font-semibold text-gray-700 mb-4 border-b pb-2">Primary System Uptime</div>
           <RadialGauge value={Math.round(gaugeData[gaugeType])} label={gaugeLabel} color={gaugeColor} size={160} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Reuse Work Orders & Pie */}
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2 h-[350px]">
            <h3 className="text-lg font-semibold mb-4 text-gray-700 flex items-center gap-2"><CheckCircle size={18} className="text-blue-500"/> Work Orders Completed</h3>
            <div className="w-full h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={workOrderData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                   <XAxis dataKey="name" stroke="#94a3b8"/><YAxis stroke="#94a3b8"/>
                   <RechartsTooltip contentStyle={{borderRadius: '8px'}}/>
                   <Line type="monotone" dataKey="completed" stroke="#3b82f6" strokeWidth={3} dot={{r:4}} activeDot={{r:6}}/>
                 </LineChart>
              </ResponsiveContainer>
            </div>
         </div>
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-[350px]">
            <h3 className="text-lg font-semibold mb-4 text-gray-700">Errors by Type</h3>
            <div className="w-full h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={errorTypeData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {errorTypeData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
         </div>
      </div>
    </div>
  );

  const renderPrimeRobots = () => (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-xl font-bold mb-6 text-gray-800 flex items-center justify-between">
          <span>Robot Fleet Status (45 Units)</span>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div>Optimal</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500"></div>Warning</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div>Critical</div>
          </div>
        </h3>
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-6">
          {robotList.map(id => {
            const val = Math.round(robotStatus[id] || 0);
            let color = '#10b981'; if (val < 90) color = '#f59e0b'; if (val < 70) color = '#ef4444';
            return <div key={id} className="flex justify-center"><RadialGauge value={val} label={`Robot ${id}`} color={color} size={90} subLabel={val < 90 ? "ERR" : "OK"} onClick={() => handleRobotClick(id)} /></div>;
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-gray-50 text-gray-800 overflow-hidden font-sans">
      {/* --- Sidebar --- */}
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
           <div className={`w-3 h-3 rounded-full ${isLoggedIn ? 'bg-blue-500' : 'bg-gray-300'} border-2 border-white shadow-sm`} title={isLoggedIn ? "Admin Logged In" : "Guest Mode"}></div>
        </div>
      </aside>

      {/* --- Main Content --- */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className={`h-16 border-b border-gray-200 flex items-center justify-between px-8 bg-white z-10 transition-colors duration-500`}>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {activeTab === 'dashboard' ? 'Operations Dashboard' : activeTab === 'layout' ? 'System Layout' : 'System Configuration'}
            </h1>
            <p className={`text-xs font-medium ${currentTheme.text}`}>
              {activeTab === 'dashboard' ? `Facility: ${currentTheme.name}` : 'Administrator Access'}
            </p>
          </div>
          {activeTab === 'dashboard' && (
            <div className="flex bg-gray-100 rounded-lg p-1 gap-1 overflow-x-auto max-w-[60vw]">
              {buildings.map(b => (
                <button key={b.id} onClick={() => setActiveBuildingId(b.id)} className={`px-4 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all ${activeBuildingId === b.id ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>{b.name}</button>
              ))}
            </div>
          )}
          {activeTab === 'layout' && isLoggedIn && (
             <button onClick={saveLayoutToDatabase} className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow text-white bg-gradient-to-r ${currentTheme.theme} hover:opacity-90 transition-opacity ${unsavedChanges ? 'animate-pulse' : ''}`}><Save size={16} /> {unsavedChanges ? 'Save Changes' : 'Layout Saved'}</button>
          )}
        </header>

        {/* --- TAB CONTENT --- */}
        {activeTab === 'dashboard' && (
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
            {activeBuildingId === 1 && renderWellfordDashboard()}
            {activeBuildingId === 2 && renderStandardBuilding('conveyor', 'Conveyor System', '#10b981')}
            {activeBuildingId === 3 && renderStandardBuilding('quicktron', 'Quicktron AGV', '#8b5cf6')}
            {activeBuildingId === 4 && renderPrimeRobots()}
          </div>
        )}

        {activeTab === 'layout' && (
          <div className="flex-1 flex relative overflow-hidden bg-white" onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseUp}>
            {!isLoggedIn && (
              <div className="absolute top-4 left-4 z-50 bg-white/90 backdrop-blur border border-gray-200 p-3 rounded-lg shadow-lg flex items-center gap-3">
                <Lock size={18} className="text-gray-500" /><div className="text-xs text-gray-600"><strong>Read-Only Mode</strong><br/>Log in to edit layout.</div>
              </div>
            )}
            {isLoggedIn && (
              <div className="w-64 bg-white border-r border-gray-200 p-4 flex flex-col gap-4 z-10 shadow-xl">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Toolbox</h3>
                {['conveyor-straight', 'conveyor-curve', 'junction', 'motor', 'sensor'].map(type => (
                   <button key={type} onClick={() => addItem(type)} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-white hover:shadow-md border border-gray-100 hover:border-blue-200 transition-all group text-left">
                    <span className="text-sm font-medium text-gray-600 group-hover:text-blue-600 capitalize">{type.replace('-', ' ')}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1 relative overflow-hidden bg-gray-50" style={{backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px'}} onClick={() => setSelectedItemId(null)}>
              {layoutItems.map(item => <HmiComponent key={item.id} item={item} isSelected={selectedItemId === item.id} isEditable={isLoggedIn} onMouseDown={handleMouseDown} onRotate={handleRotate} onDelete={handleDelete} onInfo={handleInfoClick} />)}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-10 bg-gray-50">
             <div className="max-w-4xl mx-auto space-y-8">
               
               {/* Login */}
               <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
                 <div className="flex justify-between items-start">
                   <div><h2 className="text-xl font-bold text-gray-900">Administrative Access</h2><p className="text-sm text-gray-500 mt-1">Log in to edit layouts and configure connectivity.</p></div>
                   {isLoggedIn ? ( <button onClick={() => setIsLoggedIn(false)} className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-100 transition-colors">Log Out</button> ) : ( <div className="flex gap-3"><input type="text" placeholder="User: admin" className="border rounded px-3 py-2 text-sm" disabled /><button onClick={() => setIsLoggedIn(true)} className="bg-gray-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800">Log In</button></div>)}
                 </div>
               </div>

               {/* Database Configuration (Firebase) */}
               {isLoggedIn && (
                 <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 transition-all">
                   <div className="flex items-center gap-3 mb-6">
                      <div className={`p-2 rounded-lg ${dbConnected ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                        <Database size={24} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">Database Connection</h2>
                        <p className="text-sm text-gray-500">Connect Google Firebase for real-time cloud storage.</p>
                      </div>
                   </div>

                   <div className="space-y-4">
                     <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                       <strong>How to connect:</strong>
                       <ol className="list-decimal list-inside mt-1 space-y-1 text-blue-700">
                         <li>Go to the <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="underline hover:text-blue-900">Firebase Console</a>.</li>
                         <li>Create a project &gt; Project Settings &gt; General &gt; Your Apps &gt; Web &gt; SDK Setup.</li>
                         <li>Copy the <code>firebaseConfig</code> object (JSON) and paste it below.</li>
                       </ol>
                     </div>

                     <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Firebase Config JSON</label>
                       <textarea 
                         className="w-full h-32 font-mono text-xs border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                         placeholder='{ "apiKey": "...", "authDomain": "...", "projectId": "...", ... }'
                         value={firebaseConfigStr}
                         onChange={(e) => setFirebaseConfigStr(e.target.value)}
                       />
                     </div>

                     <div className="flex justify-between items-center pt-2">
                       <div className="flex items-center gap-2 text-sm">
                         <div className={`w-2 h-2 rounded-full ${dbConnected ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                         <span className={dbConnected ? 'text-green-600 font-medium' : 'text-gray-500'}>
                           {dbConnected ? 'Connected to Cloud' : 'Offline / Not Configured'}
                         </span>
                       </div>
                       <div className="flex gap-3">
                         <button onClick={handleClearConfig} className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><LogOut size={16}/> Clear</button>
                         <button onClick={handleSaveConfig} className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-md transition-all active:scale-95">
                           <RefreshCw size={16} /> Save & Connect
                         </button>
                       </div>
                     </div>
                   </div>
                 </div>
               )}

               {/* Locked State for Settings */}
               {!isLoggedIn && (
                 <div className="p-12 text-center bg-gray-100 rounded-xl border-2 border-dashed border-gray-300"><Lock size={48} className="mx-auto text-gray-400 mb-4"/><h3 className="text-lg font-semibold text-gray-600">Settings Locked</h3></div>
               )}
             </div>
          </div>
        )}

      </main>

      {/* --- Modals --- */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isLoggedIn ? "Edit Component Config" : "Component Details"}>
        {editingItem && (
          <div className="flex flex-col gap-4">
            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label><input type="text" disabled={!isLoggedIn} className="w-full border border-gray-300 rounded p-2 text-gray-800 focus:border-blue-500 outline-none disabled:bg-gray-100" value={editingItem.data.name} onChange={(e) => setEditingItem({...editingItem, data: {...editingItem.data, name: e.target.value}})}/></div>
            <div className="pt-4 flex justify-end gap-3"><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500">Close</button>{isLoggedIn && (<button onClick={saveItemDetails} className="px-4 py-2 bg-blue-600 text-white rounded font-medium shadow">Save</button>)}</div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isRobotModalOpen} onClose={() => setIsRobotModalOpen(false)} title={`Robot ${selectedRobot} Diagnostics`}>
         <div className="space-y-4">
           <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-100">
             <div className="flex items-center gap-3"><div className="p-2 bg-white rounded-full shadow-sm"><AlertTriangle className="text-red-500" size={24} /></div><div><div className="text-sm font-bold text-red-800">Current Status: Faulted</div><div className="text-xs text-red-600">Uptime: {robotStatus[selectedRobot]}%</div></div></div>
             <button className="text-xs bg-white border border-red-200 text-red-600 px-3 py-1 rounded hover:bg-red-100">Reset Robot</button>
           </div>
           <div>
             <h4 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Recent Error Logs</h4>
             <div className="border border-gray-200 rounded-lg overflow-hidden">
               <table className="w-full text-sm text-left"><thead className="bg-gray-50 text-gray-500 font-medium"><tr><th className="p-3 border-b">Time</th><th className="p-3 border-b">Code</th><th className="p-3 border-b">Description</th></tr></thead><tbody className="divide-y divide-gray-100">{MOCK_ROBOT_ERRORS.map((err, idx) => (<tr key={idx} className="hover:bg-gray-50"><td className="p-3 text-gray-500 font-mono">{err.time}</td><td className="p-3 font-bold text-gray-700">{err.code}</td><td className="p-3 text-gray-600">{err.desc}</td></tr>))}</tbody></table>
             </div>
           </div>
         </div>
      </Modal>
    </div>
  );
}
