'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Play, Clock, Activity, Users, Settings2, Sparkles, X, AlertCircle, ArrowRight, Zap, Info, ChevronRight } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import {
  generateDeepChart,
  calculateGroupBarycenter,
  generateEphemeris,
  calculateInterMatrix,
  getCoordinates,
  calculateAspectType,
  evaluateElementalAspect,
  ELEMENT_MAP,
  SIGNS,
} from '@/lib/astrology';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' });

type Person = {
  id: string;
  name: string;
  dob: string;
  hour: number;
  minute: number;
  weight: number;
};

type StressPoint = {
  type: 'synastry' | 'transit' | 'polarity';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  involved: string[];
  details?: string;
};

const ELEMENTS = ["Wood", "Fire", "Earth", "Metal", "Water"];
const ELEMENT_COLORS: Record<string, string> = {
  Wood: "#4ADE80",
  Fire: "#F87171",
  Earth: "#FBBF24",
  Metal: "#E5E7EB",
  Water: "#60A5FA"
};

export default function VibeGraphIDE() {
  const [people, setPeople] = useState<Person[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toISOString());
  const [stressPoints, setStressPoints] = useState<StressPoint[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [selectedStressPoint, setSelectedStressPoint] = useState<StressPoint | null>(null);

  // Intermediate states for visualization
  const [groupEntity, setGroupEntity] = useState<any>(null);
  const [transits, setTransits] = useState<any>(null);
  const [synastry, setSynastry] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    const savedPeople = localStorage.getItem('vibegraph_people');
    if (savedPeople) {
      try {
        setPeople(JSON.parse(savedPeople));
      } catch (e) {
        console.error("Failed to load people from persistence", e);
        setPeople([
          { id: '1', name: 'Founder A', dob: '1990-05-15', hour: 12, minute: 0, weight: 1.5 },
          { id: '2', name: 'Co-Founder B', dob: '1992-11-22', hour: 12, minute: 0, weight: 1.2 },
        ]);
      }
    } else {
      setPeople([
        { id: '1', name: 'Founder A', dob: '1990-05-15', hour: 12, minute: 0, weight: 1.5 },
        { id: '2', name: 'Co-Founder B', dob: '1992-11-22', hour: 12, minute: 0, weight: 1.2 },
      ]);
    }
    const timer = setInterval(() => setCurrentTime(new Date().toISOString()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('vibegraph_people', JSON.stringify(people));
    }
  }, [people, mounted]);

  const addPerson = () => {
    setPeople([
      ...people,
      {
        id: Math.random().toString(36).substring(7),
        name: `Person ${people.length + 1}`,
        dob: '2000-01-01',
        hour: 12,
        minute: 0,
        weight: 1.0,
      },
    ]);
  };

  const removePerson = (id: string) => {
    setPeople(people.filter((p) => p.id !== id));
  };

  const updatePerson = (id: string, field: keyof Person, value: string | number) => {
    setPeople(people.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const runVibeCode = async () => {
    if (people.length < 2) {
      alert('Need at least 2 people to form a composite entity.');
      return;
    }
    setIsProcessing(true);
    setReport(null);
    setStressPoints([]);
    setSelectedStressPoint(null);

    try {
      // 1. Generate Individual Matrices
      const matrices = people.map((p) => generateDeepChart(p.dob, p.name, p.hour, p.minute));

      // 2. Generate Weighted Composite Entity
      const weights = people.map((p) => p.weight);
      const composite = calculateGroupBarycenter(matrices, weights);
      setGroupEntity(composite);

      // 3. Apply Header Transformation (Transits)
      const currentSky = generateEphemeris(currentTime);
      setTransits(currentSky);

      // 4. Interpersonal Cross-Wiring
      const synastryCircuits = [];
      const alerts: StressPoint[] = [];

      for (let i = 0; i < matrices.length; i++) {
        for (let j = i + 1; j < matrices.length; j++) {
          const circuit = calculateInterMatrix(matrices[i], matrices[j]);
          synastryCircuits.push(...circuit);

          // Detect Stress Points: Critical Overcoming Cycles
          circuit.forEach(c => {
            if (c.type === 'overcoming' && (c.aspectType === 'Square' || c.aspectType === 'Opposition')) {
              alerts.push({
                type: 'synastry',
                severity: c.aspectType === 'Opposition' ? 'high' : 'medium',
                title: `Elemental Friction: ${c.p1} vs ${c.p2}`,
                description: `${c.vibe}. This creates a structural tension that requires conscious integration.`,
                involved: [c.p1, c.p2],
                details: `Planetary interaction between ${c.p1} and ${c.p2} in signs ${c.sign1} and ${c.sign2}. The ${c.aspectType} aspect creates a direct conflict in the ${c.cycle} cycle, where ${c.vibe}.`
              });
            }
          });
        }
      }
      setSynastry(synastryCircuits);

      // Detect Stress Points: Intense Transits to Composite
      Object.entries(composite.placements).forEach(([planet, data]: any) => {
        Object.entries(currentSky.placements).forEach(([tPlanet, tData]: any) => {
          const diff = Math.abs(data.degree - tData.degree);
          const normalizedDiff = diff > 180 ? 360 - diff : diff;
          
          if (Math.abs(normalizedDiff - 90) < 5 || Math.abs(normalizedDiff - 180) < 5) {
            const aspect = Math.abs(normalizedDiff - 180) < 5 ? 'Opposition' : 'Square';
            alerts.push({
              type: 'transit',
              severity: aspect === 'Opposition' ? 'high' : 'medium',
              title: `Transit Pressure: ${tPlanet} ⊼ Composite ${planet}`,
              description: `Current ${tPlanet} is in a hard aspect to the group's ${planet}, signaling a period of external challenge.`,
              involved: [tPlanet, `Composite ${planet}`],
              details: `The transiting ${tPlanet} is currently forming a ${aspect} aspect to the group's composite ${planet}. This creates a ${aspect === 'Opposition' ? 'polarized tension' : 'dynamic friction'} that may manifest as external pressure on the group's core ${planet} function.`
            });
          }
        });
      });

      // Detect Stress Points: 6D Polarity Friction (Elemental Imbalance)
      const elementCounts: Record<string, number> = {};
      Object.values(composite.placements).forEach((p: any) => {
        elementCounts[p.element] = (elementCounts[p.element] || 0) + 1;
      });
      
      const missingElements = ELEMENTS.filter(e => !elementCounts[e]);
      if (missingElements.length > 0) {
        alerts.push({
          type: 'polarity',
          severity: 'medium',
          title: 'Elemental Void Detected',
          description: `The composite matrix lacks ${missingElements.join(', ')} energy, creating a phase space vacuum.`,
          involved: missingElements,
          details: `The group's composite chart shows a complete absence of ${missingElements.join(' and ')} energy. In Wu Xing, this creates a break in the Generative cycle, making it difficult for the group to naturally transition through certain phases of development or interaction.`
        });
      }

      setStressPoints(alerts);

      // 5. NLP Synthesis via Five Element Theory (Gemini API)
      const prompt = `
        You are the VibeGraph Engine, an advanced relational architecture system.
        Analyze the following data using Wu Xing (Five Elements) and 6D Phase Space.
        
        Group Entity (Barycenter Composite):
        ${JSON.stringify(composite)}
        
        Current Temporal Weather (Transits):
        ${JSON.stringify(currentSky)}
        
        Internal Wu Xing Circuits (Synastry):
        ${JSON.stringify(synastryCircuits)}

        Stress Points Identified:
        ${JSON.stringify(alerts)}
        
        Provide a concise, highly technical, and esoteric analysis with three sections:
        1. Group Soul Blueprint (Analyze the composite placements and elements)
        2. Current Temporal Weather (Analyze how the transits affect the composite)
        3. Internal Wu Xing Circuits (Analyze the interpersonal dynamics and friction)
        
        Format the output in Markdown. Use a cold, analytical, yet mystical tone.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      setReport(response.text || 'Synthesis failed.');
    } catch (error) {
      console.error('VibeCode Execution Error:', error);
      setReport('Error executing VibeCode. Check console for details.');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderCanvas = () => {
    const size = 500;
    const center = size / 2;
    const radius = size * 0.4;
    const innerRadius = radius * 0.8;

    return (
      <div className="relative bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
          {/* Zodiac Ring */}
          <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="40" />
          {SIGNS.map((sign, i) => {
            const angle = i * 30;
            const coords = getCoordinates(angle + 15, radius, center, center);
            return (
              <text
                key={sign}
                x={coords.x}
                y={coords.y}
                fill="rgba(255,255,255,0.3)"
                fontSize="8"
                textAnchor="middle"
                alignmentBaseline="middle"
                className="font-mono"
              >
                {sign.substring(0, 3).toUpperCase()}
              </text>
            );
          })}

          {/* Aspect Lines */}
          {groupEntity && (() => {
            const placements = Object.entries(groupEntity.placements);
            const lines: React.ReactNode[] = [];
            
            for (let i = 0; i < placements.length; i++) {
              for (let j = i + 1; j < placements.length; j++) {
                const [p1, d1]: [string, any] = placements[i];
                const [p2, d2]: [string, any] = placements[j];
                
                const aspect = calculateAspectType(d1.degree, d2.degree);
                if (aspect !== "None") {
                  const c1 = getCoordinates(d1.degree, innerRadius, center, center);
                  const c2 = getCoordinates(d2.degree, innerRadius, center, center);
                  
                  const cycle = evaluateElementalAspect(d1.sign, d2.sign, aspect);
                  const color = cycle.type === 'generative' ? 'rgba(74, 222, 128, 0.3)' : 
                                cycle.type === 'overcoming' ? 'rgba(248, 113, 113, 0.3)' : 
                                'rgba(255, 255, 255, 0.1)';
                  
                  lines.push(
                    <line
                      key={`${p1}-${p2}`}
                      x1={c1.x} y1={c1.y}
                      x2={c2.x} y2={c2.y}
                      stroke={color}
                      strokeWidth={aspect === 'Conjunction' || aspect === 'Opposition' ? '2' : '1'}
                      strokeDasharray={aspect === 'Square' ? '4 2' : 'none'}
                    />
                  );
                }
              }
            }
            return lines;
          })()}

          {/* Composite Placements */}
          {groupEntity && Object.entries(groupEntity.placements).map(([planet, data]: any) => {
            const coords = getCoordinates(data.degree, innerRadius, center, center);
            const color = ELEMENT_COLORS[data.element];
            const isHighlighted = !selectedElement || selectedElement === data.element;

            return (
              <g key={planet} className="cursor-pointer transition-opacity duration-300" style={{ opacity: isHighlighted ? 1 : 0.2 }}>
                <circle cx={coords.x} cy={coords.y} r="4" fill={color} className="shadow-lg" />
                <text x={coords.x + 8} y={coords.y + 4} fill="white" fontSize="10" className="font-mono opacity-70">
                  {planet.substring(0, 2).toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* Transit Placements */}
          {transits && Object.entries(transits.placements).map(([planet, data]: any) => {
            const coords = getCoordinates(data.degree, radius + 20, center, center);
            return (
              <g key={`transit-${planet}`} className="opacity-30">
                <circle cx={coords.x} cy={coords.y} r="2" fill="#FFC800" />
              </g>
            );
          })}

          {/* Wu Xing Cycle Overlay (Center) */}
          <g transform={`translate(${center}, ${center})`} className="opacity-20">
            <defs>
              <marker id="arrowhead-sheng" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#4ADE80" />
              </marker>
              <marker id="arrowhead-ke" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#F87171" />
              </marker>
            </defs>
            {ELEMENTS.map((el, i) => {
              const angle = (i * 360) / ELEMENTS.length;
              const coords = getCoordinates(angle, 40, 0, 0);
              return (
                <g key={el}>
                  <circle cx={coords.x} cy={coords.y} r="12" fill="none" stroke={ELEMENT_COLORS[el]} strokeWidth="1" />
                  <text x={coords.x} y={coords.y} fill={ELEMENT_COLORS[el]} fontSize="6" textAnchor="middle" alignmentBaseline="middle" className="font-mono">
                    {el.substring(0, 1)}
                  </text>
                  
                  {/* Sheng Cycle Arrows (Outer) */}
                  {(() => {
                    const nextAngle = ((i + 1) * 360) / ELEMENTS.length;
                    const c1 = getCoordinates(angle + 15, 45, 0, 0);
                    const c2 = getCoordinates(nextAngle - 15, 45, 0, 0);
                    return (
                      <path
                        d={`M ${c1.x} ${c1.y} A 45 45 0 0 1 ${c2.x} ${c2.y}`}
                        fill="none"
                        stroke="#4ADE80"
                        strokeWidth="0.5"
                        markerEnd="url(#arrowhead-sheng)"
                      />
                    );
                  })()}

                  {/* Ke Cycle Arrows (Inner) */}
                  {(() => {
                    const nextAngle = ((i + 2) * 360) / ELEMENTS.length;
                    const c1 = getCoordinates(angle, 35, 0, 0);
                    const c2 = getCoordinates(nextAngle, 35, 0, 0);
                    return (
                      <line
                        x1={c1.x} y1={c1.y}
                        x2={c2.x} y2={c2.y}
                        stroke="#F87171"
                        strokeWidth="0.5"
                        strokeDasharray="2 1"
                        markerEnd="url(#arrowhead-ke)"
                      />
                    );
                  })()}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Stress Point Markers on Canvas */}
        {stressPoints.map((point, idx) => {
          // Simplified: just show icons in a corner for now, or map them to the circle if they involve specific degrees
          return null;
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans overflow-hidden relative">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/10 bg-black/50 backdrop-blur-md p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-[#00FF00]" />
          <h1 className="text-xl font-mono font-bold tracking-tight">
            VibeGraph_Engine<span className="text-white/50">_v4</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="font-mono text-xs text-white/50 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {mounted ? new Date(currentTime).toLocaleTimeString() : '--:--:--'}
          </div>
          <button
            onClick={runVibeCode}
            disabled={isProcessing}
            className="flex items-center gap-2 bg-[#00FF00] hover:bg-[#00CC00] text-black px-4 py-2 rounded-md font-mono text-sm font-bold transition-colors disabled:opacity-50"
          >
            {isProcessing ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              >
                <Settings2 className="w-4 h-4" />
              </motion.div>
            ) : (
              <Play className="w-4 h-4" />
            )}
            EXECUTE_VIBECODE
          </button>
        </div>
      </header>

      {/* Main Canvas */}
      <main className="relative z-10 p-8 h-[calc(100vh-73px)] overflow-auto flex gap-8 items-start">
        
        {/* Column 1: Inputs & Elemental UI */}
        <div className="flex flex-col gap-6 w-80 shrink-0">
          {/* Elemental Filter UI */}
          <div className="bg-[#111] border border-white/10 rounded-xl p-4">
            <h2 className="font-mono text-[10px] text-white/50 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              Elemental Resonance
            </h2>
            <div className="grid grid-cols-5 gap-2">
              {ELEMENTS.map(el => (
                <button
                  key={el}
                  onClick={() => setSelectedElement(selectedElement === el ? null : el)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
                    selectedElement === el ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: ELEMENT_COLORS[el] }} />
                  <span className="font-mono text-[8px] uppercase">{el.substring(0, 3)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <h2 className="font-mono text-sm text-[#00FF00] uppercase tracking-widest flex items-center gap-2">
              <Users className="w-4 h-4" />
              Input Matrices
            </h2>
            <button
              onClick={addPerson}
              className="text-[#00FF00] hover:bg-[#00FF00]/10 p-1 rounded transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <AnimatePresence>
            {people.map((person) => (
              <motion.div
                key={person.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-[#111] border border-[#00FF00]/30 rounded-lg p-4 shadow-[0_0_15px_rgba(0,255,0,0.05)]"
              >
                <div className="flex justify-between items-start mb-4">
                  <input
                    type="text"
                    value={person.name}
                    onChange={(e) => updatePerson(person.id, 'name', e.target.value)}
                    className="bg-transparent border-b border-white/10 focus:border-[#00FF00] outline-none font-mono text-sm w-3/4 pb-1"
                  />
                  <button onClick={() => removePerson(person.id)} className="text-white/30 hover:text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <label className="block font-mono text-[10px] text-white/50 uppercase mb-1">Date of Birth</label>
                      <input
                        type="date"
                        value={person.dob}
                        onChange={(e) => updatePerson(person.id, 'dob', e.target.value)}
                        className="w-full bg-black border border-white/10 rounded px-2 py-1 font-mono text-xs text-white/80 focus:border-[#00FF00] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] text-white/50 uppercase mb-1">Hour</label>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={person.hour}
                        onChange={(e) => updatePerson(person.id, 'hour', parseInt(e.target.value) || 0)}
                        className="w-full bg-black border border-white/10 rounded px-2 py-1 font-mono text-xs text-white/80 focus:border-[#00FF00] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] text-white/50 uppercase mb-1">Minute</label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={person.minute}
                        onChange={(e) => updatePerson(person.id, 'minute', parseInt(e.target.value) || 0)}
                        className="w-full bg-black border border-white/10 rounded px-2 py-1 font-mono text-xs text-white/80 focus:border-[#00FF00] outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="font-mono text-[10px] text-white/50 uppercase">Density Weight</label>
                      <span className="font-mono text-[10px] text-[#00FF00]">{person.weight.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="3.0"
                      step="0.1"
                      value={person.weight}
                      onChange={(e) => updatePerson(person.id, 'weight', parseFloat(e.target.value))}
                      className="w-full accent-[#00FF00]"
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Column 2: Interactive Canvas */}
        <div className="flex flex-col gap-6 flex-1">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-sm text-[#0096FF] uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              6D Phase Space Canvas
            </h2>
            <div className="flex gap-4">
               {/* Legend */}
               <div className="flex items-center gap-2 font-mono text-[10px] text-white/40">
                  <div className="w-2 h-2 rounded-full bg-green-500" /> Sheng
                  <div className="w-2 h-2 rounded-full bg-red-500 ml-2" /> Ke
               </div>
            </div>
          </div>
          
          <div className="relative group">
            {renderCanvas()}
            
            {/* Stress Point Overlays on Canvas */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              {stressPoints.map((point, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedStressPoint(point)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 ${
                    point.severity === 'high' ? 'bg-red-500' : 'bg-orange-500'
                  }`}
                >
                  <Zap className="w-4 h-4 text-white" />
                </button>
              ))}
            </div>
          </div>

          {/* Detailed Stress Point View */}
          <AnimatePresence>
            {selectedStressPoint && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="bg-[#111] border border-white/20 rounded-xl p-6 shadow-2xl relative"
              >
                <button
                  onClick={() => setSelectedStressPoint(null)}
                  className="absolute top-4 right-4 text-white/30 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className={`w-6 h-6 ${selectedStressPoint.severity === 'high' ? 'text-red-500' : 'text-orange-500'}`} />
                  <div>
                    <h3 className="font-mono text-sm font-bold uppercase tracking-tight">{selectedStressPoint.title}</h3>
                    <span className="font-mono text-[10px] text-white/40 uppercase">{selectedStressPoint.type} anomaly</span>
                  </div>
                </div>
                <p className="font-mono text-xs text-white/70 leading-relaxed mb-4">
                  {selectedStressPoint.details || selectedStressPoint.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedStressPoint.involved.map(item => (
                    <span key={item} className="px-2 py-1 bg-white/5 rounded font-mono text-[9px] text-white/50 uppercase">
                      {item}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Column 3: Wu Xing & Output */}
        <div className="flex flex-col gap-8 w-[400px] shrink-0">
           {/* Wu Xing Processor (Purple) */}
           <motion.div
            animate={isProcessing ? { boxShadow: '0 0 30px rgba(180,0,255,0.2)' } : {}}
            className="bg-[#111] border border-[#B400FF]/40 rounded-lg p-4 relative"
          >
            <h2 className="font-mono text-sm text-[#B400FF] uppercase tracking-widest mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Wu Xing Processor
            </h2>
            {synastry ? (
              <div className="space-y-3 font-mono text-[10px] max-h-60 overflow-y-auto pr-2">
                {synastry.map((circuit: any, idx: number) => (
                  <div key={idx} className={`bg-black/50 p-3 rounded border ${
                    circuit.type === 'generative' ? 'border-green-500/20' : 
                    circuit.type === 'overcoming' ? 'border-red-500/20' : 'border-white/5'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-white/80">{circuit.p1}</span>
                        <div className="flex items-center gap-1">
                          <div className={`h-[1px] w-4 ${circuit.type === 'generative' ? 'bg-green-500' : circuit.type === 'overcoming' ? 'bg-red-500' : 'bg-white/20'}`} />
                          <ArrowRight className={`w-3 h-3 ${circuit.type === 'generative' ? 'text-green-500' : circuit.type === 'overcoming' ? 'text-red-500' : 'text-white/20'}`} />
                        </div>
                        <span className="text-white/80">{circuit.p2}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                        circuit.type === 'generative' ? 'bg-green-500/10 text-green-400' : 
                        circuit.type === 'overcoming' ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-white/40'
                      }`}>
                        {circuit.cycle}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-white/50 italic">
                      <div className={`w-1.5 h-1.5 rounded-full ${circuit.type === 'generative' ? 'bg-green-500' : circuit.type === 'overcoming' ? 'bg-red-500' : 'bg-white/20'}`} />
                      {circuit.vibe}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-white/30 font-mono text-xs text-center py-4">Awaiting Execution...</div>
            )}
          </motion.div>

          {/* Final Output */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: report ? 1 : 0.5 }}
            className="bg-[#111] border border-white/20 rounded-lg p-6 flex-1 flex flex-col"
          >
            <h2 className="font-mono text-sm text-white uppercase tracking-widest mb-4 border-b border-white/10 pb-2">
              Final Synthesis
            </h2>
            <div className="flex-1 overflow-auto font-mono text-xs leading-relaxed text-white/80 whitespace-pre-wrap">
              {isProcessing ? (
                <div className="flex items-center justify-center h-full text-white/50 animate-pulse">
                  Synthesizing 6D Phase Space...
                </div>
              ) : report ? (
                <div className="markdown-body prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{report}</ReactMarkdown>
                </div>
              ) : (
                <div className="text-white/30 text-center mt-10">
                  Run VibeCode to generate the final synthesis report.
                </div>
              )}
            </div>
          </motion.div>
        </div>

      </main>
    </div>
  );
}
