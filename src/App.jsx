import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, RadialBarChart, RadialBar, AreaChart, Area
} from 'recharts';
import { 
  Layout, Activity, Settings, Info, Save, Trash2, Edit3, Plus, Minus,
  RotateCw, Factory, Zap, Box, ArrowRight, Lock, Unlock,
  Upload, CloudLightning, FileText, CheckCircle, AlertTriangle, X, Database, Wifi, RefreshCw, LogOut, Play, Square, Bell, Wrench, UserPlus, Users, Shield,
  Camera, Map, ChevronDown, Folder, Paperclip, Package, AlertOctagon, CornerUpLeft, MessageSquare, Clock, Mail, Circle, Palette, Hash, Cpu, Rss, Settings2, UserMinus, Search, Eye
} from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    onAuthStateChanged, 
    signOut 
} from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';

// --- Global Firebase References ---
let app;
let auth;
let db;
const FIREBASE_CONFIG_STORAGE_KEY = 'tti_dashboard_firebase_config';

// --- Constants & Brands ---
const BRANDS = [
  { name: 'TTI', color: '#1B64F5', text: '#FFFFFF', desc: 'Automation Systems' },
  { name: 'RYOBI', color: '#DAF600', text: '#000000', desc: 'Power Tools' },
  { name: 'RIDGID', color: '#E24E1B', text: '#FFFFFF', desc: 'Professional' },
  { name: 'HART', color: '#005EB8', text: '#FFFFFF', desc: 'Do It With Hart' },
  { name: 'HOOVER', color: '#AA0000', text: '#FFFFFF', desc: 'Floor Care' },
];
const AVAILABLE_CHART_TYPES = ['LineChart', 'BarChart', 'AreaChart', 'PieChart', 'RadialGauge'];

// --- MOCK DATA GENERATORS (Moved to Top for Reference Access) ---

const generateWorkOrderData = () => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map(day => ({ name: day, completed: Math.floor(Math.random() * 50) + 120, target: 150 }));
};
const generateDowntimeData = () => Array.from({ length: 10 }, (_, i) => ({ hour: `0${i}:00`, minutes: Math.floor(Math.random() * 15) }));
const generateErrorTypeData = () => [{ name: 'Mechanical', value: 400, color: '#ef4444' }, { name: 'Electrical', value: 300, color: '#f59e0b' }, { name: 'Software', value: 300, color: '#3b82f6' }, { name: 'Sensor', value: 200, color: '#10b981' }];
const generateRobotList = () => { const robots = []; for (let i = 23; i <= 43; i++) robots.push(i); for (let i = 48; i <= 67; i++) robots.push(i); return robots; };
const ROBOT_IDS = generateRobotList();

// Mock Asset List
const MOCK_ASSETS = [
    { id: 'A001', name: 'Wellford Conveyor 1', model: 'CVR-1000', serial: 'WLF-C1001', type: 'conveyor', location: 'Zone 1', data: { parts: [], image: null, notes: '' } },
    { id: 'A002', name: 'TPC Palletizer 2', model: 'PLT-500', serial: 'TPC-P0502', type: 'robot', location: 'Shipping', data: { parts: [], image: null, notes: '' } },
    { id: 'A003', name: 'EDC AGV Fleet Base', model: 'AGV-BASE', serial: 'EDC-B001', type: 'other', location: 'Dock 4', data: { parts: [], image: null, notes: '' } },
    { id: 'A004', name: 'Prime Robot #55', model: 'ROB-550', serial: 'PR-R055', type: 'robot', location: 'Cell 5', data: { parts: [], image: null, notes: '' } },
    { id: 'A005', name: 'Wellford Drive Motor', model: 'MOT-IND-L', serial: 'WLF-M345', type: 'motor', location: 'Zone 1', data: { parts: [], image: null, notes: '' } },
];

// --- UI COMPONENTS ---

const Modal = React.memo(({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;
  const widthClass = size === 'lg' ? 'max-w-4xl' : size === 'sm' ? 'max-w-md' : 'max-w-xl';
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className={`bg-white rounded-xl shadow-2xl w-full ${widthClass} p-6 relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200`}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800"><X size={20}/></button>
        <h3 className="text-xl font-bold text-gray-800 mb-4 pr-8">{title}</h3>
        {children}
        <div className="h-6"></div> {/* Spacer */}
      </div>
    </div>
  );
});

const RadialGauge = React.memo(({ value, label, color, subLabel, size = 120, onClick }) => {
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  
  const strokeColor = color || '#1B64F5';

  return (
    <div className={`flex flex-col items-center justify-center relative ${onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`} onClick={onClick}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e2e8f0" strokeWidth="8" fill="transparent" />
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={strokeColor} strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-xl font-bold text-gray-800">{value}%</span>
      </div>
      <span className="mt-2 text-xs font-bold text-gray-500 uppercase tracking-wide text-center">{label}</span>
      {subLabel && <span className="text-[10px] text-gray-400">{subLabel}</span>}
    </div>
  );
});

const ErrorCodeModal = React.memo(({ isOpen, onClose, robotId }) => {
  const MOCK_ROBOT_ERRORS = useMemo(() => [
    { code: "E-404", desc: "Motor Sync Failure", time: "10:23 AM" }, 
    { code: "E-201", desc: "Lidar Obstruction", time: "09:15 AM" }
  ], []);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Robot ${robotId} Error History`} size="md">
        <p className="text-sm text-gray-600 mb-4">Displaying recent critical fault codes for immediate action.</p>
        <div className="space-y-3">
            {MOCK_ROBOT_ERRORS.map((err, index) => (
                <div key={index} className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertOctagon className="text-red-600 mr-3" size={20} />
                    <div>
                        <p className="font-bold text-sm text-gray-800">{err.code}: {err.desc}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1"><Clock size={10} /> {err.time}</p>
                    </div>
                </div>
            ))}
            <div className="p-3 bg-gray-100 text-gray-600 text-sm rounded-lg text-center">
              No further critical errors reported since last maintenance.
            </div>
        </div>
    </Modal>
  );
});

const ChartEditModal = React.memo(({ isOpen, onClose, editingChart, onSave, AVAILABLE_CHART_TYPES }) => {
    const [tempChart, setTempChart] = useState(editingChart);

    useEffect(() => {
        setTempChart(editingChart);
    }, [editingChart]);
    
    if (!tempChart) return null;

    const handleSave = () => {
        if (!tempChart.title || !tempChart.type) {
            alert("Title and Type are required.");
            return;
        }
        onSave(tempChart);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Edit Chart: ${tempChart.title}`} size="sm">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Chart Title</label>
                    <input type="text" className="w-full border rounded p-2" value={tempChart.title} onChange={(e) => setTempChart({...tempChart, title: e.target.value})} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Chart Type</label>
                    <select className="w-full border rounded p-2" value={tempChart.type} onChange={(e) => setTempChart({...tempChart, type: e.target.value})}>
                        {AVAILABLE_CHART_TYPES.map(type => <option key={type} value={type}>{type.replace(/([A-Z])/g, ' $1').trim()}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data Source (Key)</label>
                    <input type="text" disabled={true} className="w-full border bg-gray-100 rounded p-2 text-gray-500" value={tempChart.dataKey} />
                    <p className="text-xs text-gray-500 mt-1">Data Key is fixed based on initial chart type.</p>
                </div>
                <div className="flex justify-end pt-4 border-t">
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save Chart</button>
                </div>
            </div>
        </Modal>
    );
});

const AssetCardModal = React.memo(({ isOpen, onClose, asset, onSave, isDev }) => {
    const [tempAsset, setTempAsset] = useState(asset);
    const [newPart, setNewPart] = useState({ name: '', model: '', picture: '', notes: '' });

    useEffect(() => {
        setTempAsset(asset);
    }, [asset]);

    if (!asset) return null;
    
    const handleSave = () => {
        onSave(tempAsset);
        onClose();
    };

    const handleAddPart = () => {
        if (!newPart.name || !newPart.model) return alert("Part Name and Model are required.");
        setTempAsset(prev => ({
            ...prev,
            data: {
                ...prev.data,
                parts: [...(prev.data.parts || []), { ...newPart, id: Date.now() }]
            }
        }));
        setNewPart({ name: '', model: '', picture: '', notes: '' });
    };

    const handleDeletePart = (id) => {
        setTempAsset(prev => ({
            ...prev,
            data: {
                ...prev.data,
                parts: prev.data.parts.filter(p => p.id !== id)
            }
        }));
    };
    
    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setTempAsset(prev => ({ ...prev, data: { ...prev.data, image: reader.result } }));
          };
          reader.readAsDataURL(file);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Asset Details: ${asset.name}`} size="lg">
            <div className="flex flex-col lg:flex-row gap-6">
                
                {/* Left Column: Image & Main Info */}
                <div className="lg:w-1/3 space-y-4">
                    <div className="relative w-full aspect-square bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden group">
                        {tempAsset.data?.image ? (
                            <img src={tempAsset.data.image} alt="Asset" className="w-full h-full object-cover" />
                        ) : (
                            <div className="text-center text-gray-400"><Camera size={48} className="mx-auto mb-2"/><span>No Image</span></div>
                        )}
                        {isDev && (
                            <label className="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                                <Upload size={24} className="mr-2" /> Upload Photo
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={!isDev} />
                            </label>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Model</label>
                        <input type="text" disabled={!isDev} className="w-full border rounded p-2 text-sm" value={tempAsset.model} onChange={(e) => setTempAsset(p => ({...p, model: e.target.value}))} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Serial Number</label>
                        <input type="text" disabled={!isDev} className="w-full border rounded p-2 text-sm" value={tempAsset.serial} onChange={(e) => setTempAsset(p => ({...p, serial: e.target.value}))} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">QR Code / Location</label>
                        <div className="flex items-center gap-2">
                            <Hash size={16} className="text-gray-400"/>
                            <span className="text-sm font-mono text-gray-700">{tempAsset.id}</span>
                            <Map size={16} className="text-gray-400 ml-auto"/>
                            <span className="text-sm font-semibold text-gray-700">{tempAsset.location}</span>
                        </div>
                    </div>
                </div>

                {/* Right Column: Parts and Files */}
                <div className="lg:w-2/3 space-y-6">
                    
                    {/* Parts Section */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <h4 className="font-bold text-lg text-gray-700 flex items-center gap-2 mb-3"><Wrench size={20}/> Spare Parts Inventory</h4>
                        
                        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                            {tempAsset.data?.parts?.length > 0 ? (
                                tempAsset.data.parts.map(part => (
                                    <div key={part.id} className="bg-white border border-gray-200 p-3 rounded shadow-sm flex justify-between items-center group">
                                        <div className="flex items-center gap-3">
                                            <Package size={18} className="text-blue-500"/>
                                            <div>
                                                <div className="font-bold text-sm text-gray-800">{part.name}</div>
                                                <div className="text-xs text-gray-500">Model: {part.model}</div>
                                                {part.notes && <div className="text-xs text-red-500 italic">{part.notes}</div>}
                                            </div>
                                        </div>
                                        {isDev && <button onClick={() => handleDeletePart(part.id)} className="text-red-400 hover:text-red-600 p-1 rounded"><Trash2 size={16}/></button>}
                                    </div>
                                ))
                            ) : <div className="text-sm text-gray-400 italic text-center py-4">No critical spare parts added.</div>}
                        </div>

                        {/* Add Part Form (Dev Only) */}
                        {isDev && (
                            <div className="mt-4 pt-3 border-t border-gray-200 space-y-2">
                                <h5 className="text-sm font-semibold text-gray-700 mb-1">Add New Part:</h5>
                                <input type="text" placeholder="Part Name (e.g., Conveyor Belt)" className="w-full text-sm border p-2 rounded" value={newPart.name} onChange={e => setNewPart({...newPart, name: e.target.value})} />
                                <input type="text" placeholder="Part Model/SKU" className="w-full text-sm border p-2 rounded" value={newPart.model} onChange={e => setNewPart({...newPart, model: e.target.value})} />
                                <textarea placeholder="Notes/Location in Parts Cage" className="w-full text-sm border p-2 rounded h-16" value={newPart.notes} onChange={e => setNewPart({...newPart, notes: e.target.value})} />
                                <button onClick={handleAddPart} className="w-full bg-green-600 text-white py-2 rounded text-sm flex items-center justify-center gap-2 hover:bg-green-700">
                                    <Plus size={16}/> Add Part to BOM
                                </button>
                            </div>
                        )}
                    </div>
                    
                    {/* Files Section (Placeholder for future functionality) */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <h4 className="font-bold text-lg text-gray-700 flex items-center gap-2 mb-3"><Folder size={20}/> Attached Documentation</h4>
                        <div className="text-sm text-gray-500 italic">
                            PDF manuals, schematics, and work instructions will be managed here.
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-6 pt-4 border-t flex justify-end gap-3">
                <button onClick={onClose} className="px-4 py-2 text-gray-500 hover:text-gray-800 rounded-lg">Close</button>
                {isDev && (
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 flex items-center gap-2">
                        <Save size={16}/> Save Asset Changes
                    </button>
                )}
            </div>
        </Modal>
    );
});

// --- LOGIN COMPONENT (Moved above App to fix ReferenceError) ---

const LoginScreen = React.memo(({ onLogin, error }) => {
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
  
  // Public URL for the latest image provided
  const backgroundImageUrl = 'http://googleusercontent.com/image_generation_content/0'; // Public URL of the generated conveyor image

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden flex items-center justify-center font-sans perspective-1000">
      
      {/* --- Background Image (Public URL for reliability) --- */}
      <div 
        className="absolute inset-0 z-0 bg-cover" 
        style={{ 
          backgroundImage: `url('${backgroundImageUrl}')`, 
          backgroundColor: 'black', // Fallback color
          backgroundPosition: 'center', 
          backgroundRepeat: 'no-repeat', 
          filter: 'brightness(0.3) contrast(1.1)', 
          backgroundSize: 'cover',
        }}
      ></div>

      {/* --- 2. Interactive Entry: 3D Brand Box Overlay --- */}
      {!showLogin && (
        <div className="z-20 animate-in fade-in duration-1000 flex flex-col items-center perspective-500">
          
          {/* Main Box - positioned to overlay the box in the background image */}
          <div 
            onClick={() => setShowLogin(true)}
            className="absolute cursor-pointer group transition-all duration-500"
            style={{ 
              width: '320px',    
              height: '240px',   
              top: '55%',        
              left: '50.5%',       
              transform: 'translate(-50%, -50%) rotateX(10deg) rotateY(-10deg) rotateZ(0deg)', 
              transformStyle: 'preserve-3d',
              boxShadow: `0 0 40px ${currentBrand.color}60`, 
              borderRadius: '8px'
            }}
          >
            {/* Front Face of the 3D Box */}
            <div 
              className="absolute inset-0 rounded flex flex-col items-center justify-center transition-colors duration-1000 ease-in-out shadow-2xl group-hover:scale-105"
              style={{ 
                backgroundColor: currentBrand.color,
                color: currentBrand.text,
                transform: 'translateZ(20px)',
                borderRadius: '8px'
              }}
            >
              <h1 className="text-5xl font-black tracking-tighter z-10">{currentBrand.name}</h1>
              <p className="text-sm font-bold uppercase tracking-widest mt-2 opacity-80">{currentBrand.desc}</p>
            </div>

            {/* Top Face of the 3D Box */}
            <div 
              className="absolute w-full h-10 bg-black/20"
              style={{
                top: '0', left: '0',
                transform: 'rotateX(90deg) translateY(-20px) translateZ(-20px)', 
                transformOrigin: 'top left',
                backgroundColor: `${currentBrand.color}E0`, 
                borderRadius: '8px 8px 0 0'
              }}
            ></div>

            {/* Right Face of the 3D Box */}
            <div 
              className="absolute h-full w-10 bg-black/20"
              style={{
                top: '0', right: '0',
                transform: 'rotateY(90deg) translateX(20px) translateZ(-20px)', 
                transformOrigin: 'top right',
                backgroundColor: `${currentBrand.color}C0`, 
                borderRadius: '0 8px 8px 0'
              }}
            ></div>

            {/* Click Hint */}
            <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur border border-white/20 text-white px-4 py-2 rounded-full text-xs font-bold animate-bounce cursor-pointer">
              ENTER SYSTEM
            </div>
          </div>

        </div>
      )}

      {/* --- 3. Login Form Overlay --- */}
      {showLogin && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center animate-in fade-in zoom-in duration-300">
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
});


// --- HOOKS ---

const useDashboardData = (buildings, activeBuildingId) => {
  const activeBuilding = buildings.find(b => b.id === activeBuildingId);
  const themeColor = activeBuilding ? activeBuilding.color : '#1B64F5';

  const initialChartConfig = useMemo(() => {
    // Default charts for Wellford
    const wellfordCharts = [
      { id: 1, title: 'Wellford Downtime (Min/Hr)', type: 'BarChart', dataKey: 'downtime', w: 6, h: 4 },
      { id: 2, title: 'Raft Uptime', type: 'RadialGauge', dataKey: 'raft', w: 2, h: 2 },
      { id: 3, title: 'Conveyor Uptime', type: 'RadialGauge', dataKey: 'conveyor', w: 2, h: 2 },
      { id: 4, title: 'AutoStore Uptime', type: 'RadialGauge', dataKey: 'autostore', w: 2, h: 2 },
      { id: 5, title: 'Work Orders Completed', type: 'LineChart', dataKey: 'workorders', w: 8, h: 4 },
      { id: 6, title: 'Errors by Type', type: 'PieChart', dataKey: 'errors', w: 4, h: 6 },
    ];
    
    // Default charts for TPC
    const tpcCharts = [
      { id: 1, title: 'TPC Conveyor Uptime', type: 'RadialGauge', dataKey: 'conveyor', w: 3, h: 3 },
      { id: 2, title: 'TPC Downtime Minutes', type: 'AreaChart', dataKey: 'downtime', w: 9, h: 4 },
    ];

    // Default charts for EDC
    const edcCharts = [
      { id: 1, title: 'EDC Quicktron AGV Uptime', type: 'RadialGauge', dataKey: 'quicktron', w: 3, h: 3 },
      { id: 2, title: 'EDC Work Orders', type: 'LineChart', dataKey: 'workorders', w: 9, h: 4 },
    ];

    // Default charts for Prime Robots (45 gauges)
    const primeRobotCharts = ROBOT_IDS.map((id, index) => ({
      id: index + 1,
      title: `Robot ${id} Uptime`,
      type: 'RadialGauge',
      dataKey: `robot${id}`,
      w: 2, h: 2,
      isRobot: true,
      robotId: id
    }));

    return {
      'Wellford': wellfordCharts,
      'The Power Center (TPC)': tpcCharts,
      'EDC': edcCharts,
      'Prime Robots': primeRobotCharts,
    };
  }, []);

  const [chartConfigs, setChartConfigs] = useState(() => {
    // Load from local storage or use initial defaults
    const savedConfig = localStorage.getItem('tti_dashboard_charts');
    if (savedConfig) {
      return JSON.parse(savedConfig);
    }
    return initialChartConfig;
  });

  const activeCharts = chartConfigs[activeBuilding?.name] || [];

  // Function to update a single chart's data, position, or type
  const updateChartConfig = useCallback((id, updates) => {
    setChartConfigs(prevConfigs => {
      const currentCharts = prevConfigs[activeBuilding.name] || [];
      const updatedCharts = currentCharts.map(chart => 
        chart.id === id ? { ...chart, ...updates } : chart
      );
      const newConfigs = { ...prevConfigs, [activeBuilding.name]: updatedCharts };
      localStorage.setItem('tti_dashboard_charts', JSON.stringify(newConfigs));
      return newConfigs;
    });
  }, [activeBuilding]);

  const deleteChartConfig = useCallback((id) => {
    setChartConfigs(prevConfigs => {
      const currentCharts = prevConfigs[activeBuilding.name] || [];
      const updatedCharts = currentCharts.filter(chart => chart.id !== id);
      const newConfigs = { ...prevConfigs, [activeBuilding.name]: updatedCharts };
      localStorage.setItem('tti_dashboard_charts', JSON.stringify(newConfigs));
      return newConfigs;
    });
  }, [activeBuilding]);

  const resetAllCharts = useCallback(() => {
    setChartConfigs(initialChartConfig);
    localStorage.removeItem('tti_dashboard_charts');
  }, [initialChartConfig]);

  // Combined data structure for easy access
  const dashboardData = useMemo(() => ({
    downtime: generateDowntimeData(),
    workorders: generateWorkOrderData(),
    errors: generateErrorTypeData(),
    raft: { value: Math.floor(Math.random() * 10) + 90 },
    conveyor: { value: Math.floor(Math.random() * 10) + 90 },
    autostore: { value: Math.floor(Math.random() * 10) + 90 },
    quicktron: { value: Math.floor(Math.random() * 10) + 90 },
    ...ROBOT_IDS.reduce((acc, id) => {
        acc[`robot${id}`] = { value: Math.floor(Math.random() * 10) + 90 };
        return acc;
    }, {})
  }), [activeBuildingId]); 

  return { activeCharts, dashboardData, themeColor, updateChartConfig, deleteChartConfig, resetAllCharts };
};

const useSettingsManager = () => {
    const [settings, setSettings] = useState(() => {
        const savedSettings = localStorage.getItem('tti_dashboard_settings');
        if (savedSettings) {
            return JSON.parse(savedSettings);
        }
        return {
            buildings: [
                { id: 1, name: 'Wellford', color: '#3b82f6' }, // blue
                { id: 2, name: 'The Power Center (TPC)', color: '#10b981' }, // emerald
                { id: 3, name: 'EDC', color: '#f59e0b' }, // amber
                { id: 4, name: 'Prime Robots', color: '#8b5cf6' }, // violet
            ],
            users: [
                { id: 'u1', username: 'dev', password: 'admin', role: 'developer' },
                { id: 'u2', username: 'operator', password: '1234', role: 'user' },
            ],
            firebaseConfig: '',
            apiEndpoint: 'https://mock-api.com/v1/data',
        };
    });

    const saveSettings = useCallback((newSettings) => {
        setSettings(newSettings);
        localStorage.setItem('tti_dashboard_settings', JSON.stringify(newSettings));
    }, []);
    
    const addUser = useCallback((user) => {
        setSettings(prev => {
            const newSettings = { ...prev, users: [...prev.users, { ...user, id: `u${Date.now()}` }] };
            localStorage.setItem('tti_dashboard_settings', JSON.stringify(newSettings));
            return newSettings;
        });
    }, []);
    
    const deleteUser = useCallback((id) => {
        setSettings(prev => {
            const newSettings = { ...prev, users: prev.users.filter(u => u.id !== id) };
            localStorage.setItem('tti_dashboard_settings', JSON.stringify(newSettings));
            return newSettings;
        });
    }, []);

    return { settings, saveSettings, addUser, deleteUser };
}

const useAssetManager = () => {
    const [assets, setAssets] = useState(() => {
        const savedAssets = localStorage.getItem('tti_asset_list');
        if (savedAssets) {
            return JSON.parse(savedAssets);
        }
        // Initialize mock assets with default data structure
        return MOCK_ASSETS.map(asset => ({
            ...asset,
            data: asset.data || { parts: [], image: null, notes: '' }
        }));
    });
    
    const updateAsset = useCallback((updatedAsset) => {
        setAssets(prev => {
            const updatedList = prev.map(a => a.id === updatedAsset.id ? updatedAsset : a);
            localStorage.setItem('tti_asset_list', JSON.stringify(updatedList));
            return updatedList;
        });
    }, []);
    
    const getAssetById = useCallback((id) => assets.find(a => a.id === id), [assets]);
    
    return { assets, updateAsset, getAssetById };
};


// --- UI LAYOUTS ---

const DashboardLayout = React.memo(({ activeBuilding, activeCharts, dashboardData, themeColor, isEditable, toggleEditMode, updateChartConfig, deleteChartConfig, resetAllCharts, currentUser }) => {
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [selectedRobotId, setSelectedRobotId] = useState(null);
  const [chartEditModalOpen, setChartEditModalOpen] = useState(false);
  const [editingChart, setEditingChart] = useState(null);

  const getChartComponent = useCallback((chart) => {
    const data = dashboardData[chart.dataKey];
    const chartColor = themeColor;
    
    if (chart.type === 'RadialGauge') {
        const handleClick = chart.isRobot 
            ? () => { setSelectedRobotId(chart.robotId); setErrorModalOpen(true); } 
            : undefined;

        // RadialGauge uses the data.value directly (a single percentage)
        return (
            <RadialGauge 
                value={data.value} 
                label={chart.title.split(' ').slice(0, 2).join(' ')} 
                subLabel={chart.title.split(' ').slice(2).join(' ')}
                color={chartColor} 
                onClick={handleClick}
                size={120}
            />
        );
    }
    
    // For other charts, render the appropriate Recharts component
    const ChartComponent = chart.type === 'LineChart' ? LineChart : (chart.type === 'AreaChart' ? AreaChart : BarChart);

    // Dynamic rendering of data lines/bars based on dataKey
    let renderElement;
    let dataLabelKey = chart.dataKey === 'downtime' ? 'minutes' : 'completed';

    if (chart.type === 'BarChart') {
        renderElement = <Bar dataKey={dataLabelKey} fill={chartColor} radius={[4, 4, 0, 0]} />;
    } else if (chart.type === 'AreaChart') {
        renderElement = <Area type="monotone" dataKey={dataLabelKey} stroke={chartColor} fill={`url(#colorUv-${chart.id})`} strokeWidth={2} />;
    } else if (chart.type === 'LineChart') {
        renderElement = <Line type="monotone" dataKey={dataLabelKey} stroke={chartColor} strokeWidth={3} dot={{ stroke: chartColor, strokeWidth: 2, r: 4 }} activeDot={{ r: 8 }} />;
    } else if (chart.type === 'PieChart') {
        return (
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill={chartColor} label>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#ef4444', '#f59e0b', '#3b82f6', '#10b981'][index % 4]} />
                        ))}
                    </Pie>
                    <RechartsTooltip />
                </PieChart>
            </ResponsiveContainer>
        );
    }

    // Standard Cartesian Charts (Line, Bar, Area)
    return (
        <ResponsiveContainer width="100%" height="100%">
            <ChartComponent data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <defs>
                    <linearGradient id={`colorUv-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColor} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ccc" opacity={0.3} />
                <XAxis dataKey="name" stroke="#666" fontSize={12} />
                <YAxis stroke="#666" fontSize={12} />
                <RechartsTooltip contentStyle={{ backgroundColor: '#2d3748', border: 'none', color: '#fff' }} cursor={{ fill: chartColor, opacity: 0.1 }} />
                {renderElement}
            </ChartComponent>
        </ResponsiveContainer>
    );
  }, [dashboardData, themeColor]);

  const handleEditChart = useCallback((chart) => {
    setEditingChart(chart);
    setChartEditModalOpen(true);
  }, []);

  const handleSaveChartEdit = useCallback((updates) => {
    updateChartConfig(editingChart.id, updates);
    setChartEditModalOpen(false);
    setEditingChart(null);
  }, [editingChart, updateChartConfig]);
  
  // Render Charts in a Grid
  const renderCharts = useMemo(() => activeCharts.map(chart => (
    <div 
        key={chart.id} 
        style={{ gridColumn: `span ${chart.w}`, gridRow: `span ${chart.h}` }}
        className={`relative bg-white rounded-2xl shadow-xl transition-all duration-300 transform ${isEditable ? 'ring-4 ring-blue-400/50 shadow-blue-500/30' : 'hover:shadow-2xl'}`}
    >
      <div 
        className={`absolute top-0 left-0 right-0 h-8 rounded-t-2xl px-4 flex items-center justify-between ${isEditable ? 'bg-blue-600 cursor-move' : 'bg-gray-100'}`}
        style={isEditable ? { backgroundColor: themeColor } : {}}
      >
        <h4 className={`text-sm font-bold ${isEditable ? 'text-white' : 'text-gray-700'}`}>{chart.title}</h4>
        {isEditable && (
          <div className="flex gap-2">
            <button onClick={() => handleEditChart(chart)} className="text-white hover:text-yellow-300"><Edit3 size={14} /></button>
            <button onClick={() => deleteChartConfig(chart.id)} className="text-white hover:text-red-300"><Trash2 size={14} /></button>
          </div>
        )}
      </div>
      <div className={`p-4 pt-10 h-full w-full ${chart.type === 'RadialGauge' ? 'flex items-center justify-center' : ''}`}>
          {getChartComponent(chart)}
      </div>
    </div>
  )), [activeCharts, isEditable, getChartComponent, handleEditChart, deleteChartConfig, themeColor]);


  return (
    <div className="flex-1 p-6 overflow-y-auto w-full h-full" style={{ backgroundColor: '#f1f5f9' }}>
      
      {/* Header and Edit Controls */}
      <div className="flex justify-between items-center mb-6 sticky top-0 bg-white/90 p-4 rounded-xl shadow-lg z-30">
        <h3 className="text-2xl font-bold text-gray-800">{activeBuilding.name} Dashboard</h3>
        {currentUser?.role === 'developer' && (
          <div className="flex gap-3">
            <button 
              onClick={toggleEditMode} 
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all ${isEditable ? 'bg-red-500 text-white shadow-lg' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              {isEditable ? <Lock size={16}/> : <Edit3 size={16}/>}
              {isEditable ? 'Exit Edit Mode' : 'Edit Dashboard'}
            </button>
          </div>
        )}
      </div>

      {/* Grid Layout (Fixed 12 Column Grid) */}
      <div className={`grid gap-6 ${isEditable ? 'grid-cols-12' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-12'}`} style={{ gridAutoRows: 'minmax(150px, auto)' }}>
        {renderCharts}
        
        {/* Placeholder for adding new charts */}
        {isEditable && (
          <div style={{ gridColumn: 'span 4', gridRow: 'span 3' }} className="border-4 border-dashed border-gray-300 rounded-2xl flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => { setEditingChart({ id: Date.now(), title: 'New Chart', type: 'LineChart', dataKey: 'workorders', w: 6, h: 4 }); setChartEditModalOpen(true); }}>
            <div className="text-center text-gray-500">
              <Plus size={36} className="mx-auto" />
              <p className="font-semibold mt-2">Add New Chart</p>
            </div>
          </div>
        )}
      </div>

      {/* Robot Error Modal */}
      <ErrorCodeModal isOpen={errorModalOpen} onClose={() => setErrorModalOpen(false)} robotId={selectedRobotId} />
      
      {/* Chart Configuration Modal */}
      <ChartEditModal 
        isOpen={chartEditModalOpen} 
        onClose={() => setChartEditModalOpen(false)} 
        editingChart={editingChart} 
        onSave={handleSaveChartEdit} 
        AVAILABLE_CHART_TYPES={AVAILABLE_CHART_TYPES} 
      />

    </div>
  );
});

const AssetManagerLayout = React.memo(({ assets, updateAsset, isDev }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const filteredAssets = useMemo(() => {
        if (!searchTerm) return assets;
        const lowerCaseSearch = searchTerm.toLowerCase();
        return assets.filter(asset => 
            asset.name.toLowerCase().includes(lowerCaseSearch) ||
            asset.model.toLowerCase().includes(lowerCaseSearch) ||
            asset.serial.toLowerCase().includes(lowerCaseSearch)
        );
    }, [assets, searchTerm]);

    const handleOpenAssetCard = useCallback((asset) => {
        setSelectedAsset(asset);
        setIsModalOpen(true);
    }, []);

    const handleSaveAsset = useCallback((updatedAsset) => {
        updateAsset(updatedAsset);
    }, [updateAsset]);

    return (
        <div className="flex-1 p-6 space-y-6 overflow-y-auto bg-gray-50/90 backdrop-blur-sm">
            
            {/* Search Header */}
            <div className="sticky top-0 bg-white p-4 rounded-xl shadow-lg z-20">
                <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-2"><Search size={24}/> Asset Search & Management</h3>
                <input 
                    type="text" 
                    placeholder="Search by Asset Name, Model, or Serial Number..." 
                    className="w-full border-2 border-gray-300 rounded-full py-3 px-6 text-lg focus:border-blue-500 focus:ring-blue-500 outline-none transition-all shadow-inner"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Asset List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredAssets.map(asset => (
                    <div key={asset.id} className="bg-white p-5 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-all flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <span className={`px-3 py-1 text-xs font-semibold rounded-full uppercase ${asset.type === 'robot' ? 'bg-red-100 text-red-600' : asset.type === 'conveyor' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>{asset.type}</span>
                                <Info size={18} className="text-gray-400" />
                            </div>
                            <h4 className="text-xl font-bold text-gray-900 mb-1">{asset.name}</h4>
                            <p className="text-sm text-gray-600">Model: {asset.model}</p>
                            <p className="text-sm text-gray-600">Location: {asset.location}</p>
                        </div>
                        <button 
                            onClick={() => handleOpenAssetCard(asset)}
                            className="mt-4 flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                        >
                            <Eye size={16} /> View/Manage Details
                        </button>
                    </div>
                ))}
                {filteredAssets.length === 0 && (
                    <div className="col-span-full p-20 text-center text-gray-500">
                        <Search size={40} className="mx-auto mb-4"/>
                        <p className="text-lg font-semibold">No assets match your search criteria.</p>
                    </div>
                )}
            </div>

            {/* Asset Details Modal */}
            <AssetCardModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                asset={selectedAsset} 
                onSave={handleSaveAsset} 
                isDev={isDev}
            />
        </div>
    );
});

const SettingsLayout = React.memo(({ settings, saveSettings, addUser, deleteUser, resetAllCharts, dbConnected, firebaseUser, handleGoogleSignIn, handleFirebaseSignOut, currentUser }) => {
    const [tempSettings, setTempSettings] = useState(settings);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
    const [isAddingUser, setIsAddingUser] = useState(false);
    
    useEffect(() => {
        setTempSettings(settings);
    }, [settings]);

    const handleSave = () => {
        saveSettings(tempSettings);
        // Re-initialize Firebase if config changed
        if (tempSettings.firebaseConfig) {
            try {
                const config = JSON.parse(tempSettings.firebaseConfig);
                if (!getApps().length) {
                    initializeApp(config);
                    getAuth(app);
                    getFirestore(app);
                }
            } catch (e) {
                alert("Error parsing Firebase Config. Please check the JSON format.");
            }
        }
        alert("Settings saved successfully!");
    };
    
    const handleAddUser = () => {
        if (!newUser.username || !newUser.password) return alert("Username and Password are required.");
        addUser(newUser);
        setNewUser({ username: '', password: '', role: 'user' });
        setIsAddingUser(false);
    };

    const handleUpdateBuilding = (id, field, value) => {
        setTempSettings(prev => ({
            ...prev,
            buildings: prev.buildings.map(b => b.id === id ? { ...b, [field]: value } : b)
        }));
    };
    
    return (
        <div className="flex-1 p-8 space-y-8 overflow-y-auto bg-gray-50/90 backdrop-blur-sm">
            <div className="max-w-4xl mx-auto space-y-8">
                
                {/* User Management */}
                <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-purple-600">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-4"><Users size={20} className="text-purple-600"/> User Management (Developer Only)</h3>
                    
                    <div className="grid grid-cols-1 gap-4">
                        {tempSettings.users.map(user => (
                            <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                                <div>
                                    <p className="font-semibold">{user.username} <span className="text-xs text-gray-500">({user.role})</span></p>
                                </div>
                                {user.role !== 'developer' && currentUser?.role === 'developer' && (
                                    <button onClick={() => deleteUser(user.id)} className="text-red-500 hover:text-red-700 p-1 rounded"><UserMinus size={16} /></button>
                                )}
                                {user.role === 'developer' && <span className="text-xs text-gray-500">Fixed Account</span>}
                            </div>
                        ))}
                    </div>

                    {currentUser?.role === 'developer' && (
                        <div className="mt-4 pt-4 border-t">
                            <button onClick={() => setIsAddingUser(!isAddingUser)} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                {isAddingUser ? <Minus size={16}/> : <UserPlus size={16}/>} {isAddingUser ? 'Cancel' : 'Add New User'}
                            </button>
                            {isAddingUser && (
                                <div className="mt-3 p-4 bg-blue-50 rounded-lg space-y-2">
                                    <input type="text" placeholder="Username" className="w-full border rounded p-2 text-sm" value={newUser.username} onChange={(e) => setNewUser({...newUser, username: e.target.value})} />
                                    <input type="password" placeholder="Password" className="w-full border rounded p-2 text-sm" value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} />
                                    <select className="w-full border rounded p-2 text-sm" value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})}>
                                        <option value="user">User (View Only)</option>
                                        <option value="developer">Developer (Full Access)</option>
                                    </select>
                                    <button onClick={handleAddUser} className="w-full bg-blue-600 text-white py-2 rounded text-sm">Create User</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Building Configuration */}
                <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-yellow-600">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-4"><Factory size={20} className="text-yellow-600"/> Building & Theme Management</h3>
                    
                    <div className="space-y-4">
                        {tempSettings.buildings.map(building => (
                            <div key={building.id} className="flex items-center gap-4 p-3 border rounded-lg bg-gray-50">
                                <div className="w-6 h-6 rounded-full shadow" style={{ backgroundColor: building.color }}></div>
                                <input 
                                    type="text" 
                                    className="flex-1 border rounded p-2 text-sm" 
                                    value={building.name} 
                                    onChange={(e) => handleUpdateBuilding(building.id, 'name', e.target.value)}
                                />
                                <input 
                                    type="color" 
                                    className="w-10 h-10 border-none p-0 rounded-md cursor-pointer" 
                                    value={building.color} 
                                    onChange={(e) => handleUpdateBuilding(building.id, 'color', e.target.value)}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Database & API Configuration */}
                <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-red-600">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-4"><Database size={20} className="text-red-600"/> Data Source & API Setup</h3>
                    
                    {/* Firebase Connection */}
                    <div className="mb-4 p-4 border rounded-lg bg-red-50">
                        <p className="font-semibold flex items-center gap-2 mb-2">
                            <Wifi size={16} className={dbConnected ? 'text-green-600' : 'text-red-600'} />
                            Firebase Status: <span className={`font-bold ${dbConnected ? 'text-green-600' : 'text-red-600'}`}>{dbConnected ? 'CONNECTED' : 'OFFLINE'}</span>
                        </p>
                        {firebaseUser ? (
                            <div className="flex justify-between items-center bg-white p-2 rounded border">
                                <p className="text-sm">Signed in as: <span className="font-bold text-blue-600">{firebaseUser.email}</span></p>
                                <button onClick={handleFirebaseSignOut} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"><LogOut size={14}/> Sign Out</button>
                            </div>
                        ) : (
                            <button onClick={handleGoogleSignIn} disabled={!dbConnected} className="w-full bg-blue-600 text-white py-2 rounded flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50">
                                <CloudLightning size={16}/> {dbConnected ? 'Link to Google Firebase' : 'Connect Firebase Config First'}
                            </button>
                        )}
                    </div>
                    
                    <label className="block text-sm font-medium text-gray-700 mb-1">Firebase Config JSON</label>
                    <textarea 
                        className="w-full border rounded p-2 text-sm font-mono h-24" 
                        placeholder="Paste your Firebase Config JSON object here..." 
                        value={tempSettings.firebaseConfig} 
                        onChange={(e) => setTempSettings({...tempSettings, firebaseConfig: e.target.value})}
                    ></textarea>

                    <label className="block text-sm font-medium text-gray-700 mb-1 mt-4">Postman/Mock API Endpoint</label>
                    <input 
                        type="text" 
                        className="w-full border rounded p-2 text-sm" 
                        value={tempSettings.apiEndpoint} 
                        onChange={(e) => setTempSettings({...tempSettings, apiEndpoint: e.target.value})}
                    />
                </div>
                
                {/* Maintenance & Reset */}
                <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-gray-400 space-y-4">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Settings2 size={20} className="text-gray-600"/> Maintenance</h3>
                    <button onClick={resetAllCharts} className="flex items-center gap-2 bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300">
                        <RefreshCw size={16}/> Reset All Dashboard Charts to Default
                    </button>
                </div>
                
                {/* Save Button */}
                <div className="flex justify-end">
                    <button onClick={handleSave} className="px-6 py-3 bg-green-600 text-white rounded-xl shadow-lg hover:bg-green-700 font-bold transition-transform transform hover:scale-[1.02]">
                        <Save size={20} className="inline mr-2"/> Save All Settings
                    </button>
                </div>
                
            </div>
        </div>
    );
});


// --- MAIN APP COMPONENT ---

export default function IndustrialApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginError, setLoginError] = useState('');
  
  const { settings, saveSettings, addUser, deleteUser } = useSettingsManager();
  const { assets, updateAsset, getAssetById } = useAssetManager();
  
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [activeBuildingId, setActiveBuildingId] = useState(settings.buildings[0].id);
  const [isEditMode, setIsEditMode] = useState(false);

  // --- Firebase/Auth State ---
  const [dbConnected, setDbConnected] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);

  // Initialize Firebase when settings loaded
  useEffect(() => {
    const configStr = settings.firebaseConfig;
    if (configStr) {
      try {
        const config = JSON.parse(configStr);
        if (!getApps().length) {
          app = initializeApp(config);
          auth = getAuth(app);
          db = getFirestore(app);
          setDbConnected(true);
        } else {
          app = getApp();
          auth = getAuth(app);
          db = getFirestore(app);
          setDbConnected(true);
        }

        // Set up Auth State Listener
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          setFirebaseUser(user);
        });
        return () => unsubscribe();

      } catch (e) {
        console.error("Failed to initialize Firebase:", e);
        setDbConnected(false);
      }
    }
  }, [settings.firebaseConfig]);

  // Handle Firebase Login/Logout
  const handleGoogleSignIn = async () => {
    if (!dbConnected) {
      alert("Please ensure Firebase configuration is valid and saved before connecting."); 
      return;
    }
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google Sign-In Failed:", error);
      alert(`Sign-in failed: ${error.message}`);
    }
  };

  const handleFirebaseSignOut = async () => {
    if (auth) {
      await signOut(auth);
      setFirebaseUser(null);
    }
  };

  // --- Auth Handlers ---
  const handleLogin = (u, p) => {
    const user = settings.users.find(user => user.username === u && user.password === p);
    if (user) { setCurrentUser(user); setIsAuthenticated(true); setLoginError(''); } 
    else setLoginError('Invalid credentials.');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setIsEditMode(false);
  };
  
  const toggleEditMode = () => {
      if (currentUser?.role === 'developer') {
          setIsEditMode(prev => !prev);
      }
  };

  // --- Building & Dashboard Hooks ---
  const activeBuilding = settings.buildings.find(b => b.id === activeBuildingId) || settings.buildings[0];
  const { activeCharts, dashboardData, themeColor, updateChartConfig, deleteChartConfig, resetAllCharts } = useDashboardData(settings.buildings, activeBuildingId);

  
  // --- UI RENDERING ---
  
  // If not authenticated, show the login screen
  if (!isAuthenticated) return <LoginScreen onLogin={handleLogin} error={loginError} />;

  // Main App Content (After Login)
  return (
    <div className="flex h-screen w-full text-gray-800 overflow-hidden font-sans" style={{ backgroundColor: '#f1f5f9' }}>
      
      {/* Global Background (Placeholder for the entire dashboard area) */}
      <div className="absolute inset-0 z-0" style={{ background: 'linear-gradient(135deg, #f0f0f0 0%, #e2e8f0 100%)' }}></div>

      {/* Sidebar */}
      <aside className="w-20 flex flex-col items-center py-6 bg-white border-r border-gray-200 z-20 shadow-xl relative">
        <div className="mb-8 p-2 rounded-lg bg-blue-600 shadow-lg"><Factory className="text-white" size={28} /></div>
        <nav className="flex flex-col gap-6 w-full">
          {/* Main Tabs */}
          <button onClick={() => setActiveTab('dashboard')} className={`p-3 mx-auto rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-gray-100 text-blue-600 shadow-md' : 'text-gray-500 hover:bg-gray-50'}`} title="Dashboard"><Activity size={24} /></button>
          <button onClick={() => setActiveTab('assetManager')} className={`p-3 mx-auto rounded-xl transition-all ${activeTab === 'assetManager' ? 'bg-gray-100 text-blue-600 shadow-md' : 'text-gray-500 hover:bg-gray-50'}`} title="Asset Management"><Layout size={24} /></button>
          {currentUser?.role === 'developer' && (
              <button onClick={() => setActiveTab('settings')} className={`p-3 mx-auto rounded-xl transition-all ${activeTab === 'settings' ? 'bg-gray-100 text-blue-600 shadow-md' : 'text-gray-500 hover:bg-gray-50'}`} title="Settings"><Settings size={24} /></button>
          )}
        </nav>
        
        <div className="mt-auto flex flex-col items-center gap-4 mb-4">
           {/* Logout Button */}
           <button onClick={handleLogout} className="p-3 mx-auto rounded-xl text-red-500 hover:bg-red-50/50 transition-colors" title="Logout"><LogOut size={24} /></button>
           {/* User Indicator */}
           <div className={`w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-xs font-bold text-white ${currentUser?.role === 'developer' ? 'bg-purple-600' : 'bg-blue-500'}`}>{currentUser?.username.substring(0,2).toUpperCase()}</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        <header className="h-16 border-b border-gray-200 bg-white/95 backdrop-blur flex items-center justify-between px-8 shadow-sm z-30 sticky top-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                {activeTab === 'dashboard' ? activeBuilding.name : 
                 activeTab === 'assetManager' ? 'Asset Management' : 'Configuration'}
            </h1>
            <p className="text-xs font-medium text-gray-500">
                {activeTab === 'dashboard' ? 'Real-Time Operational Metrics' : 
                 activeTab === 'assetManager' ? 'Inventory Search & Maintenance' : 'System Administration'}
            </p>
          </div>
          
          {/* Building Selector (Only on Dashboard Tab) */}
          {activeTab === 'dashboard' && (
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              {settings.buildings.map(building => (
                <button 
                  key={building.id} 
                  onClick={() => setActiveBuildingId(building.id)} 
                  className={`px-3 py-1 text-sm rounded-lg font-semibold transition-all flex items-center gap-2 ${
                    activeBuildingId === building.id 
                      ? 'bg-white text-gray-900 shadow-md ring-2 ring-inset' 
                      : 'text-gray-600 hover:bg-white/50'
                  }`}
                  style={activeBuildingId === building.id ? { borderColor: building.color, ringColor: building.color } : {}}
                >
                  <Circle size={10} style={{ fill: building.color, color: building.color }} />
                  {building.name}
                </button>
              ))}
            </div>
          )}
        </header>

        {/* --- DYNAMIC CONTENT --- */}
        <div className="flex-1 overflow-y-auto relative" style={{ '--theme-color': activeBuilding.color }}>

          {/* Dashboard View */}
          {activeTab === 'dashboard' && (
             <DashboardLayout 
                activeBuilding={activeBuilding} 
                activeCharts={activeCharts} 
                dashboardData={dashboardData} 
                themeColor={activeBuilding.color} 
                isEditable={isEditMode}
                toggleEditMode={toggleEditMode}
                updateChartConfig={updateChartConfig}
                deleteChartConfig={deleteChartConfig}
                resetAllCharts={resetAllCharts}
                currentUser={currentUser}
             />
          )}

          {/* Asset Manager View (New) */}
          {activeTab === 'assetManager' && (
             <AssetManagerLayout 
                assets={assets} 
                updateAsset={updateAsset} 
                isDev={currentUser?.role === 'developer'} 
             />
          )}

          {/* Settings View */}
          {activeTab === 'settings' && currentUser?.role === 'developer' && (
            <SettingsLayout 
                settings={settings} 
                saveSettings={saveSettings} 
                addUser={addUser} 
                deleteUser={deleteUser} 
                resetAllCharts={resetAllCharts}
                dbConnected={dbConnected}
                firebaseUser={firebaseUser}
                handleGoogleSignIn={handleGoogleSignIn}
                handleFirebaseSignOut={handleFirebaseSignOut}
                currentUser={currentUser}
            />
          )}
        </div>
      </main>
    </div>
  );
}