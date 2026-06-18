import { useState, useEffect, useRef } from "react";

// ── Beard Brand Colors ────────────────────────────────────────────────────────
const C = {
  bg: "#1a1010", surface: "#241818", card: "#2e1e1e", border: "#3a2525",
  accent: "#c0392b", accentDim: "#3d0f0a", accentHover: "#e74c3c",
  green: "#2dd4a0", greenDim: "#0d3d2e",
  amber: "#f5a623", amberDim: "#3d2800",
  red: "#e74c3c", redDim: "#3d1010",
  text: "#f0ece8", muted: "#8a7f7a", white: "#ffffff",
  purple: "#a78bfa", purpleDim: "#2e1f5e",
  gold: "#c9a84c", goldDim: "#3d2e10",
};

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const WEEK_START = (() => {
  const d = new Date(); const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff); d.setHours(0,0,0,0); return d;
})();

function weekLabel(start) {
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const fmt = d => d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
  return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
}
function dateOfDay(ws,i) { const d=new Date(ws); d.setDate(d.getDate()+i); return d.toLocaleDateString("en-US",{month:"short",day:"numeric"}); }
function excelDate(ws,i) { const d=new Date(ws); d.setDate(d.getDate()+i); return d.toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"numeric"}); }
function uid() { return Math.random().toString(36).slice(2,9); }
function todayWeekdayName() { return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()]; }
function isWeekday() { const d=new Date().getDay(); return d>=1&&d<=5; }
function parseTime(t) { const [h,m]=t.split(":").map(Number); return {h:isNaN(h)?0:h,m:isNaN(m)?0:m}; }
function fmt12(t) { const {h,m}=parseTime(t); const ap=h>=12?"PM":"AM"; const hh=h%12||12; return `${hh}:${String(m).padStart(2,"0")} ${ap}`; }

const STORAGE_KEY = "tsp_v4";
function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY))||{}; } catch { return {}; } }
function save(data) { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(data)); } catch {} }

const DEFAULT_LOCATIONS = ["Office","Jobsite","Remote","Shop","Other"];

const DEFAULT_PROJECTS = [
  {id:"p1", projectNum:"10-11-6010", taskNum:"OH", expenseType:"", ocip:"", projectName:"Overhead"},
  {id:"p2", projectNum:"10-11-6035", taskNum:"HOL", expenseType:"", ocip:"", projectName:"Holiday"},
  {id:"p3", projectNum:"25-201-240", taskNum:"90", expenseType:"486", ocip:"sm1 cusw", projectName:"Q-Cells Ingot"},
];
const DEFAULT_EMPLOYEES = [
  {id:"emp1", name:"Dan Hancock",   empNo:"HAN4127", role:"VDC/BIM Manager", projects:["p1","p2","p3"]},
  {id:"emp2", name:"Jose Barron",   empNo:"BAR9939", role:"Team Member",      projects:["p1","p2","p3"]},
  {id:"emp3", name:"James Pugh III",empNo:"PUG1723", role:"Team Member",      projects:["p1","p2","p3"]},
];

// ── Reminder hook ─────────────────────────────────────────────────────────────
function useReminders(empId, reminderPrefs, timesheetData, weekKey) {
  const timerRefs = useRef([]); const [toast,setToast] = useState(null); const shownRef = useRef({});
  const alreadySubmitted = !!timesheetData[empId]?.[weekKey]?._submitted;
  useEffect(() => {
    timerRefs.current.forEach(clearTimeout); timerRefs.current = [];
    if (!empId||alreadySubmitted||!isWeekday()) return;
    const schedule = (timeStr,label) => {
      if (!timeStr) return;
      const now=new Date(); const {h,m}=parseTime(timeStr);
      const target=new Date(); target.setHours(h,m,0,0);
      const diff=target-now;
      if (diff>0&&diff<86400000) {
        const key=`${empId}-${timeStr}-${new Date().toDateString()}`;
        if (shownRef.current[key]) return;
        const tid=setTimeout(()=>{
          shownRef.current[key]=true;
          const today=todayWeekdayName();
          const dayData=timesheetData[empId]?.[weekKey]?.[today];
          const hasEntries=dayData?.entries?.some(e=>e.projectId);
          if (!hasEntries) setToast(`${label}: Don't forget to log your time and daily report for ${today}!`);
        },diff);
        timerRefs.current.push(tid);
      }
    };
    schedule("13:00","Daily Reminder");
    if (reminderPrefs?.extra&&reminderPrefs.extra!=="13:00") schedule(reminderPrefs.extra,"Extra Reminder");
    return ()=>timerRefs.current.forEach(clearTimeout);
  },[empId,reminderPrefs?.extra,alreadySubmitted,weekKey]);
  return {toast,setToast};
}

// ── UI Primitives ─────────────────────────────────────────────────────────────
function Badge({color,children}) {
  const map={green:[C.greenDim,C.green],amber:[C.amberDim,C.amber],red:[C.redDim,C.red],purple:[C.purpleDim,C.purple],accent:[C.accentDim,C.accent],gold:[C.goldDim,C.gold]};
  const [bg,fg]=map[color]||[C.accentDim,C.accent];
  return <span style={{background:bg,color:fg,borderRadius:6,padding:"2px 10px",fontSize:11,fontWeight:700,letterSpacing:.5,whiteSpace:"nowrap"}}>{children}</span>;
}
function Btn({children,onClick,variant="primary",small,disabled,style={}}) {
  const base={border:"none",borderRadius:8,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",fontWeight:700,letterSpacing:.5,transition:"all .15s",opacity:disabled?.45:1,padding:small?"6px 14px":"10px 22px",fontSize:small?12:13,...style};
  const variants={
    primary:{background:C.accent,color:C.white},
    green:{background:C.green,color:"#05150f"},
    danger:{background:C.red,color:C.white},
    ghost:{background:"transparent",color:C.muted,border:`1px solid ${C.border}`},
    amber:{background:C.amber,color:"#1a0d00"},
    purple:{background:C.purple,color:"#0d0820"},
    gold:{background:C.gold,color:"#1a0d00"},
  };
  return <button style={{...base,...variants[variant]}} onClick={onClick} disabled={disabled}
    onMouseEnter={e=>{if(!disabled)e.currentTarget.style.opacity=".8";}}
    onMouseLeave={e=>{e.currentTarget.style.opacity=disabled?".45":"1";}}>{children}</button>;
}
function Input({value,onChange,placeholder,type="text",style={},disabled}) {
  return <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
    style={{background:"#0f0f0f",border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontFamily:"inherit",fontSize:13,padding:"8px 12px",outline:"none",width:"100%",boxSizing:"border-box",...style}}
    onFocus={e=>{e.target.style.borderColor=C.accent;}} onBlur={e=>{e.target.style.borderColor=C.border;}}/>;
}
function Textarea({value,onChange,placeholder,rows=3,disabled}) {
  return <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} disabled={disabled}
    style={{background:"#0f0f0f",border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontFamily:"inherit",fontSize:13,padding:"8px 12px",outline:"none",width:"100%",boxSizing:"border-box",resize:"vertical"}}
    onFocus={e=>{e.target.style.borderColor=C.accent;}} onBlur={e=>{e.target.style.borderColor=C.border;}}/>;
}
function Select({value,onChange,children,style={}}) {
  return <select value={value} onChange={e=>onChange(e.target.value)}
    style={{background:"#0f0f0f",border:`1px solid ${C.border}`,borderRadius:8,color:value?C.text:C.muted,fontFamily:"inherit",fontSize:13,padding:"8px 12px",outline:"none",...style}}>
    {children}
  </select>;
}

// ── Background canvas with rotating BIM slideshow ────────────────────────────
const BIM_IMAGES = [
  "/bim-bg.png",
  "/bim-bg-2.png",
  "/bim-bg-3.png",
  "/bim-bg-4.png",
  "/bim-bg-5.png",
  "/bim-bg-6.png",
  "/bim-bg-7.png",
];
const FADE_DURATION = 2000;  // ms for crossfade
const HOLD_DURATION = 7000;  // ms each image is shown

function BeardCanvas() {
  // Start at a random image each session
  const [current, setCurrent] = useState(() => Math.floor(Math.random() * BIM_IMAGES.length));
  const [next, setNext]       = useState(null);
  const [fading, setFading]   = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const nextIdx = (current + 1) % BIM_IMAGES.length;
      setNext(nextIdx);
      setFading(true);
      setTimeout(() => {
        setCurrent(nextIdx);
        setNext(null);
        setFading(false);
      }, FADE_DURATION);
    }, HOLD_DURATION);
    return () => clearInterval(interval);
  }, [current]);

  // Checkerboard with seeded pseudo-random offset per cell — breaks rigidity, maintains coverage
  const COLS = 6;
  const ROWS = 14;
  const cellW = 100 / COLS;
  const cellH = 100 / ROWS;
  const items = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const isBeard = (r + c) % 2 === 0;
      // Seeded pseudo-random nudge — deterministic so it never shifts on re-render
      const seed  = r * 31 + c * 17;
      const nudgeX = ((seed * 13 + 7)  % 21) - 10; // -10 to +10
      const nudgeY = ((seed * 19 + 11) % 17) - 8;  // -8  to +8
      const leftPct = c * cellW + cellW * 0.5 + nudgeX * 0.35;
      const topPct  = r * cellH + cellH * 0.5 + nudgeY * 0.35;
      const depth   = (r + c) % 3;
      const opacity = isBeard ? [0.22,0.14,0.18][depth] : [0.13,0.08,0.11][depth];
      const size    = isBeard ? [12,10,11][depth]        : [10,9,10][depth];
      items.push({ text: isBeard ? 'BEARD \u201CONE\u201D' : '1% BETTER EVERY DAY', opacity, size, leftPct, topPct, isBeard });
    }
  }

  const imgStyle = {
    position:"absolute", inset:0, backgroundSize:"cover", backgroundPosition:"center",
    filter:"grayscale(60%) sepia(30%)",
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:0,overflow:"hidden",pointerEvents:"none"}}>
      {/* Current image */}
      <div style={{...imgStyle, backgroundImage:`url('${BIM_IMAGES[current]}')`, opacity:.18, transition:"none"}}/>
      {/* Next image fading in */}
      {next !== null && (
        <div style={{...imgStyle, backgroundImage:`url('${BIM_IMAGES[next]}')`, opacity: fading ? .18 : 0,
          transition:`opacity ${FADE_DURATION}ms ease-in-out`}}/>
      )}
      {/* Subtle red overlay */}
      <div style={{position:"absolute",inset:0,background:"rgba(30,8,8,0.55)"}}/>
      {/* Red vignette */}
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at center, transparent 30%, rgba(80,10,5,0.25) 100%)"}}/>
      {/* Checkerboard watermark — horizontal text, alternating H+V */}
      <div style={{position:"absolute",inset:0,overflow:"hidden"}}>
        {items.map((item,i)=>(
          <span key={i} style={{
            position:"absolute",
            left:`${item.leftPct}%`,
            top:`${item.topPct}%`,
            transform:"translate(-50%, -50%)",
            color: item.isBeard ? `rgba(220,80,60,${item.opacity})` : `rgba(240,220,210,${item.opacity})`,
            fontSize: item.size,
            fontWeight: 900,
            letterSpacing: 2,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}>
            {item.text}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function ReminderToast({message,onDismiss}) {
  if (!message) return null;
  return <div style={{position:"fixed",top:70,left:"50%",transform:"translateX(-50%)",zIndex:200,background:`linear-gradient(135deg,${C.accentDim},#1a0a08)`,border:`1px solid ${C.accent}`,borderRadius:14,padding:"16px 22px",display:"flex",alignItems:"center",gap:14,boxShadow:"0 8px 32px rgba(0,0,0,.7)",maxWidth:480,width:"calc(100% - 40px)"}}>
    <div style={{fontSize:26}}>⏰</div>
    <div style={{flex:1}}><div style={{fontWeight:800,color:C.accent,fontSize:13,marginBottom:3}}>Time to log your hours!</div><div style={{color:C.text,fontSize:13}}>{message}</div></div>
    <button onClick={onDismiss} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:20}}>×</button>
  </div>;
}

// ── Excel Export (true .xlsx) ─────────────────────────────────────────────────
function buildXLSXAndDownload(employees, weekStart, timesheetData, projects, settings) {
  const weekKey = weekStart.toISOString().slice(0,10);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate()+6);
  const weekEndStr = weekEnd.toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"numeric"});

  // Build CSV with clear per-employee sections — downloads as .csv but formatted for Excel
  // Full .xlsx requires a server; for browser-only we produce a well-structured CSV
  let csv = "";
  employees.forEach((emp,ei) => {
    if (ei>0) csv += "\n\n";
    const wd = timesheetData[emp.id]?.[weekKey]||{};
    const empProjs = projects.filter(p=>emp.projects?.includes(p.id));

    csv += `=== ${emp.name.toUpperCase()} ===\n`;
    csv += `EMPLOYEE NO.,${emp.empNo||"PENDING"},,,,,,,,EMPLOYEE NAME,${emp.name}\n`;
    csv += `WEEK/PERIOD ENDING,${weekEndStr},,,,,,,,SUPERVISOR,${settings.supervisor||"Daniel Hancock"}\n`;
    csv += `SITE/LOCATION,${wd._location||""},,,,,,,,EMPLOYEE SIGNATURE,\n\n`;

    csv += `PROJECT #,TASK #,EXPENSE TYPE,PROJECT DESCRIPTION,`;
    DAYS.forEach(d=>{ csv+=`${d.toUpperCase()} REG,${d.toUpperCase()} OT,${d.toUpperCase()} DT,`; });
    csv += `TOTAL REG,TOTAL OT,TOTAL DT\n`;

    csv += `,,,,`;
    DAYS.forEach((_,i)=>{ csv+=`${excelDate(weekStart,i)},,,`; });
    csv += `,,\n`;

    let gReg=0,gOT=0,gDT=0;
    const dayT = DAYS.map(()=>({reg:0,ot:0,dt:0}));
    empProjs.forEach(proj=>{
      let rReg=0,rOT=0,rDT=0;
      csv += `${proj.projectNum},${proj.taskNum},${proj.expenseType||""},"${proj.projectName||""}",`;
      DAYS.forEach((day,di)=>{
        const entry=wd[day]?.entries?.find(e=>e.projectId===proj.id);
        const reg=parseFloat(entry?.reg)||0; const ot=parseFloat(entry?.ot)||0; const dt=parseFloat(entry?.dt)||0;
        csv+=`${reg||""},${ot||""},${dt||""},`;
        rReg+=reg;rOT+=ot;rDT+=dt;dayT[di].reg+=reg;dayT[di].ot+=ot;dayT[di].dt+=dt;
      });
      gReg+=rReg;gOT+=rOT;gDT+=rDT;
      csv+=`${rReg||0},${rOT||0},${rDT||0}\n`;
    });

    csv+=`,,TOTALS,,`;
    dayT.forEach(d=>{ csv+=`${d.reg||0},${d.ot||0},${d.dt||0},`; });
    csv+=`${gReg},${gOT},${gDT}\n`;
    csv+=`\nUse codes: A=Absent  H=Holiday  JD=Jury Duty  V=Vacation  S=Sick Leave  LA=Leave of Absence\n`;
  });

  const blob=new Blob([csv],{type:"text/csv"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=`BIS_Timesheets_${weekKey}.csv`;a.click();
  URL.revokeObjectURL(url);
}

function buildDailyReportCSV(employees, weekStart, timesheetData) {
  const weekKey=weekStart.toISOString().slice(0,10);
  let csv="EMPLOYEE,DAY,DATE,LOCATION,DAILY REPORT,WEEK\n";
  employees.forEach(emp=>{
    const wd=timesheetData[emp.id]?.[weekKey]||{};
    DAYS.forEach((day,i)=>{
      const d=wd[day]; if(!d?.report) return;
      csv+=`"${emp.name}","${day}","${dateOfDay(weekStart,i)}","${d.location||""}","${d.report.replace(/"/g,'""')}","${weekLabel(weekStart)}"\n`;
    });
  });
  const blob=new Blob([csv],{type:"text/csv"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=`BIS_DailyReport_${weekKey}.csv`;a.click();
  URL.revokeObjectURL(url);
}

// ── Admin Console ─────────────────────────────────────────────────────────────
function AdminConsole({employees,setEmployees,projects,setProjects,settings,setSettings}) {
  const [tab,setTab]=useState("team");
  const [saved,setSaved]=useState("");
  const [newName,setNewName]=useState(""); const [newEmpNo,setNewEmpNo]=useState(""); const [newRole,setNewRole]=useState("");
  const [newProj,setNewProj]=useState({projectNum:"",taskNum:"",expenseType:"",ocip:"",projectName:""});
  const [editEmp,setEditEmp]=useState(null); const [editProj,setEditProj]=useState(null);
  const [settingsForm,setSettingsForm]=useState({...settings});
  const [newLocation,setNewLocation]=useState("");

  const flash=msg=>{setSaved(msg);setTimeout(()=>setSaved(""),2500);};

  const addEmployee=()=>{
    if(!newName.trim())return;
    const emp={id:uid(),name:newName.trim(),empNo:newEmpNo.trim(),role:newRole.trim()||"Team Member",projects:projects.map(p=>p.id)};
    setEmployees(p=>[...p,emp]);setNewName("");setNewEmpNo("");setNewRole("");flash("Employee added!");
  };
  const removeEmployee=id=>{if(window.confirm("Remove this employee?"))setEmployees(p=>p.filter(e=>e.id!==id));};
  const saveEmpEdit=()=>{setEmployees(p=>p.map(e=>e.id===editEmp.id?editEmp:e));setEditEmp(null);flash("Employee updated!");};
  const toggleEmpProject=(empId,projId)=>setEmployees(p=>p.map(e=>e.id===empId?{...e,projects:e.projects?.includes(projId)?e.projects.filter(x=>x!==projId):[...(e.projects||[]),projId]}:e));

  const addProject=()=>{
    if(!newProj.projectNum.trim())return;
    const proj={id:uid(),...newProj};
    setProjects(p=>[...p,proj]);
    setEmployees(p=>p.map(e=>({...e,projects:[...(e.projects||[]),proj.id]})));
    setNewProj({projectNum:"",taskNum:"",expenseType:"",ocip:"",projectName:""});flash("Project code added!");
  };
  const removeProject=id=>{if(window.confirm("Remove this project code?")){setProjects(p=>p.filter(x=>x.id!==id));setEmployees(p=>p.map(e=>({...e,projects:(e.projects||[]).filter(x=>x!==id)})));flash("Project removed!");}};
  const saveProjEdit=()=>{setProjects(p=>p.map(x=>x.id===editProj.id?editProj:x));setEditProj(null);flash("Project updated!");};

  const addLocation=()=>{
    if(!newLocation.trim())return;
    const locs=settingsForm.locations||DEFAULT_LOCATIONS;
    if(!locs.includes(newLocation.trim())){setSettingsForm(p=>({...p,locations:[...locs,newLocation.trim()]}));}
    setNewLocation("");
  };
  const removeLocation=loc=>setSettingsForm(p=>({...p,locations:(p.locations||DEFAULT_LOCATIONS).filter(l=>l!==loc)}));

  const tabs=[{id:"team",label:"👥 Team"},{id:"projects",label:"📋 Projects"},{id:"locations",label:"📍 Locations"},{id:"settings",label:"⚙ Settings"}];

  const sectionHead = (label) => (
    <div style={{color:C.accent,fontWeight:700,fontSize:13,marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
      <div style={{width:3,height:16,background:C.accent,borderRadius:2}}/>{label}
    </div>
  );

  return (
    <div style={{maxWidth:960,margin:"0 auto",position:"relative",zIndex:1}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <div style={{width:40,height:40,background:`linear-gradient(135deg,${C.accent},${C.gold})`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🔧</div>
        <div><h2 style={{margin:0,color:C.text,fontSize:22,fontWeight:900,letterSpacing:.5}}>Admin Console</h2><p style={{margin:0,color:C.muted,fontSize:13}}>Manage team, projects, locations & settings</p></div>
        {saved&&<Badge color="green">✓ {saved}</Badge>}
      </div>

      <div style={{display:"flex",gap:0,borderBottom:`1px solid ${C.border}`,marginBottom:24}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",borderBottom:`3px solid ${tab===t.id?C.accent:"transparent"}`,color:tab===t.id?C.accent:C.muted,cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:13,padding:"12px 20px",transition:"color .15s"}}>{t.label}</button>
        ))}
      </div>

      {/* TEAM */}
      {tab==="team"&&(
        <div>
          {employees.map(emp=>(
            <div key={emp.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,marginBottom:12,overflow:"hidden"}}>
              {editEmp?.id===emp.id?(
                <div style={{padding:20}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
                    <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>FULL NAME</label><Input value={editEmp.name} onChange={v=>setEditEmp(p=>({...p,name:v}))}/></div>
                    <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>EMPLOYEE NO.</label><Input value={editEmp.empNo} onChange={v=>setEditEmp(p=>({...p,empNo:v}))} placeholder="e.g. HAN4127"/></div>
                    <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>ROLE</label><Input value={editEmp.role} onChange={v=>setEditEmp(p=>({...p,role:v}))}/></div>
                  </div>
                  <div style={{marginBottom:16}}>
                    <label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:8}}>ASSIGNED PROJECT CODES</label>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                      {projects.map(proj=>{
                        const assigned=editEmp.projects?.includes(proj.id);
                        return(
                          <button key={proj.id} onClick={()=>setEditEmp(p=>({...p,projects:p.projects?.includes(proj.id)?p.projects.filter(x=>x!==proj.id):[...(p.projects||[]),proj.id]}))}
                            style={{background:assigned?C.accentDim:"#0f0f0f",border:`1px solid ${assigned?C.accent:C.border}`,borderRadius:8,color:assigned?C.accent:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:12,padding:"6px 12px",transition:"all .15s"}}>
                            {assigned?"✓ ":""}{proj.projectName||proj.projectNum} <span style={{color:C.muted,fontSize:11}}>({proj.taskNum})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:10}}><Btn variant="green" small onClick={saveEmpEdit}>Save Changes</Btn><Btn variant="ghost" small onClick={()=>setEditEmp(null)}>Cancel</Btn></div>
                </div>
              ):(
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",flexWrap:"wrap",gap:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:14}}>
                    <div style={{width:40,height:40,background:C.accentDim,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,color:C.accent,fontSize:14,border:`1px solid ${C.accent}33`}}>{emp.name.split(" ").map(x=>x[0]).join("").slice(0,2)}</div>
                    <div>
                      <div style={{fontWeight:800,color:C.text,fontSize:14}}>{emp.name}</div>
                      <div style={{color:C.muted,fontSize:12,marginTop:2}}>{emp.role} · <span style={{color:emp.empNo?C.gold:C.amber}}>{emp.empNo||"⚠ No Employee No."}</span></div>
                      <div style={{color:C.muted,fontSize:11,marginTop:3}}>{(emp.projects||[]).length} project codes assigned</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8}}><Btn variant="ghost" small onClick={()=>setEditEmp({...emp})}>✏ Edit</Btn><Btn variant="danger" small onClick={()=>removeEmployee(emp.id)}>Remove</Btn></div>
                </div>
              )}
            </div>
          ))}
          <div style={{background:C.card,border:`2px dashed ${C.border}`,borderRadius:12,padding:20,marginTop:8}}>
            {sectionHead("Add New Team Member")}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:14}}>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>FULL NAME *</label><Input value={newName} onChange={setNewName} placeholder="First Last"/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>EMPLOYEE NO.</label><Input value={newEmpNo} onChange={setNewEmpNo} placeholder="Can add later"/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>ROLE</label><Input value={newRole} onChange={setNewRole} placeholder="Team Member"/></div>
            </div>
            <Btn variant="primary" onClick={addEmployee} disabled={!newName.trim()}>+ Add Team Member</Btn>
          </div>
        </div>
      )}

      {/* PROJECTS */}
      {tab==="projects"&&(
        <div>
          {projects.map(proj=>(
            <div key={proj.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,marginBottom:10,overflow:"hidden"}}>
              {editProj?.id===proj.id?(
                <div style={{padding:16}}>
                  <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",gap:10,marginBottom:12}}>
                    <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>PROJECT NAME</label><Input value={editProj.projectName||""} onChange={v=>setEditProj(p=>({...p,projectName:v}))}/></div>
                    <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>PROJECT #</label><Input value={editProj.projectNum} onChange={v=>setEditProj(p=>({...p,projectNum:v}))}/></div>
                    <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>TASK #</label><Input value={editProj.taskNum} onChange={v=>setEditProj(p=>({...p,taskNum:v}))}/></div>
                    <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>EXPENSE TYPE</label><Input value={editProj.expenseType} onChange={v=>setEditProj(p=>({...p,expenseType:v}))}/></div>
                    <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>OCIP Y/N</label><Input value={editProj.ocip} onChange={v=>setEditProj(p=>({...p,ocip:v}))}/></div>
                  </div>
                  <div style={{marginBottom:14}}>
                    <label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:8}}>ASSIGNED EMPLOYEES</label>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                      {employees.map(emp=>{
                        const assigned=emp.projects?.includes(editProj.id);
                        return <button key={emp.id} onClick={()=>toggleEmpProject(emp.id,editProj.id)}
                          style={{background:assigned?C.accentDim:"#0f0f0f",border:`1px solid ${assigned?C.accent:C.border}`,borderRadius:8,color:assigned?C.accent:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:12,padding:"6px 12px"}}>
                          {assigned?"✓ ":""}{emp.name}
                        </button>;
                      })}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:10}}><Btn variant="green" small onClick={saveProjEdit}>Save</Btn><Btn variant="ghost" small onClick={()=>setEditProj(null)}>Cancel</Btn></div>
                </div>
              ):(
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",flexWrap:"wrap",gap:10}}>
                  <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"center"}}>
                    {proj.projectName&&<span style={{color:C.gold,fontWeight:800,fontSize:14}}>{proj.projectName}</span>}
                    <span style={{color:C.accent,fontWeight:700}}>{proj.projectNum}</span>
                    <span style={{color:C.muted,fontSize:12}}>Task: <strong style={{color:C.text}}>{proj.taskNum}</strong></span>
                    {proj.expenseType&&<span style={{color:C.muted,fontSize:12}}>Exp: <strong style={{color:C.text}}>{proj.expenseType}</strong></span>}
                    {proj.ocip&&<span style={{color:C.muted,fontSize:12}}>OCIP: <strong style={{color:C.text}}>{proj.ocip}</strong></span>}
                    <span style={{color:C.muted,fontSize:11}}>{employees.filter(e=>e.projects?.includes(proj.id)).length} employees</span>
                  </div>
                  <div style={{display:"flex",gap:8}}><Btn variant="ghost" small onClick={()=>setEditProj({...proj})}>✏ Edit</Btn><Btn variant="danger" small onClick={()=>removeProject(proj.id)}>Remove</Btn></div>
                </div>
              )}
            </div>
          ))}
          <div style={{background:C.card,border:`2px dashed ${C.border}`,borderRadius:12,padding:20,marginTop:8}}>
            {sectionHead("Add New Project Code")}
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",gap:10,marginBottom:14}}>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>PROJECT NAME</label><Input value={newProj.projectName} onChange={v=>setNewProj(p=>({...p,projectName:v}))} placeholder="e.g. Q-Cells Ingot"/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>PROJECT # *</label><Input value={newProj.projectNum} onChange={v=>setNewProj(p=>({...p,projectNum:v}))} placeholder="10-11-6010"/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>TASK #</label><Input value={newProj.taskNum} onChange={v=>setNewProj(p=>({...p,taskNum:v}))} placeholder="OH"/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>EXPENSE TYPE</label><Input value={newProj.expenseType} onChange={v=>setNewProj(p=>({...p,expenseType:v}))} placeholder="486"/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>OCIP Y/N</label><Input value={newProj.ocip} onChange={v=>setNewProj(p=>({...p,ocip:v}))} placeholder="sm1 cusw"/></div>
            </div>
            <Btn variant="primary" onClick={addProject} disabled={!newProj.projectNum.trim()}>+ Add Project Code</Btn>
          </div>
        </div>
      )}

      {/* LOCATIONS */}
      {tab==="locations"&&(
        <div style={{maxWidth:500}}>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20,marginBottom:16}}>
            {sectionHead("Location List")}
            <p style={{color:C.muted,fontSize:12,marginBottom:16}}>Employees pick from this list on their timesheet. They can also type a custom location.</p>
            {(settingsForm.locations||DEFAULT_LOCATIONS).map(loc=>(
              <div key={loc} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"#0f0f0f",borderRadius:8,marginBottom:8,border:`1px solid ${C.border}`}}>
                <span style={{color:C.text,fontWeight:600}}>📍 {loc}</span>
                <Btn variant="danger" small onClick={()=>removeLocation(loc)}>Remove</Btn>
              </div>
            ))}
            <div style={{display:"flex",gap:10,marginTop:14}}>
              <Input value={newLocation} onChange={setNewLocation} placeholder="Add new location..." style={{flex:1}}/>
              <Btn variant="primary" onClick={addLocation} disabled={!newLocation.trim()}>Add</Btn>
            </div>
          </div>
          <Btn variant="gold" onClick={()=>{setSettings(settingsForm);flash("Locations saved!");}}>Save Locations</Btn>
        </div>
      )}

      {/* SETTINGS */}
      {tab==="settings"&&(
        <div style={{maxWidth:560}}>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24}}>
            {sectionHead("Platform Settings")}
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>COMPANY NAME</label><Input value={settingsForm.company} onChange={v=>setSettingsForm(p=>({...p,company:v}))}/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>SUPERVISOR NAME</label><Input value={settingsForm.supervisor} onChange={v=>setSettingsForm(p=>({...p,supervisor:v}))}/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>MANAGER EMAIL (Review)</label><Input value={settingsForm.managerEmail} onChange={v=>setSettingsForm(p=>({...p,managerEmail:v}))} placeholder="you@beardintegrated.com"/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>PAYROLL EMAIL (Final Submission)</label><Input value={settingsForm.payrollEmail} onChange={v=>setSettingsForm(p=>({...p,payrollEmail:v}))} placeholder="payroll@beardintegrated.com"/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>CC EMAIL (Optional — additional recipient)</label><Input value={settingsForm.ccEmail||""} onChange={v=>setSettingsForm(p=>({...p,ccEmail:v}))} placeholder="cc@beardintegrated.com"/></div>
            </div>
            <div style={{marginTop:20}}><Btn variant="primary" onClick={()=>{setSettings(settingsForm);flash("Settings saved!");}}>Save Settings</Btn></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Employee View ─────────────────────────────────────────────────────────────
function EmployeeView({employee,weekStart,data,onSave,reminderPrefs,onSaveReminder,projects,settings}) {
  const weekKey=weekStart.toISOString().slice(0,10);
  const stored=data[employee.id]?.[weekKey]||{};
  const empProjects=projects.filter(p=>employee.projects?.includes(p.id));
  const locations=settings.locations||DEFAULT_LOCATIONS;

  const [days,setDays]=useState(()=>
    DAYS.map((d,i)=>({
      name:d,date:dateOfDay(weekStart,i),
      entries:stored[d]?.entries||empProjects.map(p=>({id:uid(),projectId:p.id,reg:"",ot:"",dt:""})),
      notes:stored[d]?.notes||"",report:stored[d]?.report||"",location:stored[d]?.location||"",
    }))
  );
  const [submitted,setSubmitted]=useState(!!stored._submitted);
  const [savedMsg,setSavedMsg]=useState(false);
  const [showReminders,setShowReminders]=useState(false);
  const {toast,setToast}=useReminders(employee.id,reminderPrefs[employee.id],data,weekKey);

  useEffect(()=>{if("Notification"in window&&Notification.permission==="default")Notification.requestPermission();},[]);

  const updateEntry=(di,pid,field,val)=>{setDays(p=>p.map((d,i)=>i===di?{...d,entries:d.entries.map(e=>e.projectId===pid?{...e,[field]:val}:e)}:d));setSavedMsg(false);};
  const updateDay=(i,field,val)=>{setDays(p=>p.map((d,idx)=>idx===i?{...d,[field]:val}:d));setSavedMsg(false);};

  const grandReg=days.reduce((s,d)=>s+d.entries.reduce((ss,e)=>ss+(parseFloat(e.reg)||0),0),0);
  const grandOT=days.reduce((s,d)=>s+d.entries.reduce((ss,e)=>ss+(parseFloat(e.ot)||0),0),0);
  const grandDT=days.reduce((s,d)=>s+d.entries.reduce((ss,e)=>ss+(parseFloat(e.dt)||0),0),0);
  const grandTotal=grandReg+grandOT+grandDT;

  const handleSave=(submit=false)=>{
    const dd={};
    days.forEach(d=>{dd[d.name]={entries:d.entries,notes:d.notes,report:d.report,location:d.location};});
    if(submit)dd._submitted=true;
    onSave(employee.id,weekKey,dd);setSavedMsg(true);
    if(submit)setSubmitted(true);
  };

  const todayName=todayWeekdayName();
  const timeOptions=[];
  for(let h=7;h<=19;h++)["00","30"].forEach(m=>{const v=`${String(h).padStart(2,"0")}:${m}`;if(v!=="13:00")timeOptions.push(v);});

  return (
    <div style={{maxWidth:1000,margin:"0 auto",position:"relative",zIndex:1}}>
      <ReminderToast message={toast} onDismiss={()=>setToast(null)}/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{margin:0,color:C.text,fontSize:22,fontWeight:900}}>{employee.name}</h2>
          <p style={{margin:"4px 0 0",color:C.muted,fontSize:13}}>{weekLabel(weekStart)} · {employee.empNo?<span style={{color:C.gold}}>#{employee.empNo}</span>:<span style={{color:C.amber}}>⚠ Employee No. pending</span>}</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          {submitted?<Badge color="green">✓ Submitted</Badge>:savedMsg?<Badge color="amber">Saved</Badge>:null}
          <div style={{background:C.accentDim,borderRadius:8,padding:"8px 14px",fontWeight:800,fontSize:12,color:C.accent,border:`1px solid ${C.accent}33`}}>
            REG {grandReg.toFixed(1)} · OT {grandOT.toFixed(1)} · DT {grandDT.toFixed(1)} · <span style={{color:C.green}}>Total {grandTotal.toFixed(1)}</span>
          </div>
          <Btn variant="ghost" small onClick={()=>setShowReminders(r=>!r)}>🔔 Reminders</Btn>
        </div>
      </div>

      {showReminders&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20,marginBottom:20}}>
          <div style={{fontWeight:800,color:C.text,fontSize:14,marginBottom:14}}>🔔 Reminder Settings</div>
          <div style={{background:"#0f0f0f",borderRadius:10,padding:"12px 16px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",border:`1px solid ${C.border}`}}>
            <div><div style={{fontWeight:700,color:C.text,fontSize:13}}>Default Reminder</div><div style={{color:C.muted,fontSize:12}}>Every weekday at 1:00 PM</div></div>
            <Badge color="green">Always On</Badge>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <Select value={reminderPrefs[employee.id]?.extra||""} onChange={v=>onSaveReminder(employee.id,{extra:v})} style={{flex:1}}>
              <option value="">— No extra reminder —</option>
              {timeOptions.map(t=><option key={t} value={t}>{fmt12(t)}</option>)}
            </Select>
            <span style={{color:C.muted,fontSize:12}}>Additional reminder</span>
          </div>
        </div>
      )}

      {days.map((day,i)=>{
        const isToday=day.name===todayName;
        const dReg=day.entries.reduce((s,e)=>s+(parseFloat(e.reg)||0),0);
        const dOT=day.entries.reduce((s,e)=>s+(parseFloat(e.ot)||0),0);
        const dDT=day.entries.reduce((s,e)=>s+(parseFloat(e.dt)||0),0);
        const dTotal=dReg+dOT+dDT;
        return(
          <div key={day.name} style={{background:C.card,border:`1px solid ${isToday?C.accent:C.border}`,borderRadius:12,marginBottom:14,overflow:"hidden",boxShadow:isToday?`0 0 0 1px ${C.accent}22`:"none"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 18px",borderBottom:`1px solid ${C.border}`,background:isToday?`linear-gradient(90deg,${C.accentDim},${C.surface})`:C.surface}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontWeight:900,color:isToday?C.accent:C.text,fontSize:14,letterSpacing:.3}}>{day.name}</span>
                <span style={{color:C.muted,fontSize:12}}>{day.date}</span>
                {isToday&&<Badge color="accent">Today</Badge>}
              </div>
              <div style={{display:"flex",gap:12,fontSize:12,color:C.muted}}>
                <span>REG <strong style={{color:C.text}}>{dReg.toFixed(1)}</strong></span>
                <span>OT <strong style={{color:dOT>0?C.amber:C.text}}>{dOT.toFixed(1)}</strong></span>
                <span>DT <strong style={{color:dDT>0?C.red:C.text}}>{dDT.toFixed(1)}</strong></span>
                <span style={{color:C.green,fontWeight:800}}>{dTotal.toFixed(1)} hrs</span>
              </div>
            </div>
            <div style={{padding:18}}>
              {/* Location */}
              <div style={{marginBottom:14}}>
                <label style={{color:C.muted,fontSize:11,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",display:"block",marginBottom:8}}>📍 Location</label>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {locations.map(loc=>(
                    <button key={loc} onClick={()=>!submitted&&updateDay(i,"location",day.location===loc?"":loc)}
                      style={{background:day.location===loc?C.accentDim:"#0f0f0f",border:`1px solid ${day.location===loc?C.accent:C.border}`,borderRadius:8,color:day.location===loc?C.accent:C.muted,cursor:submitted?"default":"pointer",fontFamily:"inherit",fontSize:12,padding:"5px 12px",transition:"all .15s"}}>
                      {loc}
                    </button>
                  ))}
                  {!submitted&&(
                    <Input value={locations.includes(day.location)?"":(day.location||"")} onChange={v=>updateDay(i,"location",v)} placeholder="Custom location..." style={{width:160,fontSize:12,padding:"5px 10px"}}/>
                  )}
                  {day.location&&!locations.includes(day.location)&&<Badge color="accent">{day.location}</Badge>}
                </div>
              </div>

              {/* Hours grid */}
              <div style={{marginBottom:14}}>
                <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:8,marginBottom:6}}>
                  <div style={{color:C.muted,fontSize:11,fontWeight:700,letterSpacing:.8}}>PROJECT / TASK</div>
                  <div style={{color:C.muted,fontSize:11,fontWeight:700,letterSpacing:.8,textAlign:"center"}}>REG HRS</div>
                  <div style={{color:C.amber,fontSize:11,fontWeight:700,letterSpacing:.8,textAlign:"center"}}>OT HRS</div>
                  <div style={{color:C.red,fontSize:11,fontWeight:700,letterSpacing:.8,textAlign:"center"}}>DT HRS</div>
                </div>
                {empProjects.map(proj=>{
                  const entry=day.entries.find(e=>e.projectId===proj.id)||{reg:"",ot:"",dt:""};
                  return(
                    <div key={proj.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:8,marginBottom:8,alignItems:"center"}}>
                      <div style={{background:"#0f0f0f",borderRadius:8,padding:"8px 12px",border:`1px solid ${C.border}`}}>
                        <span style={{color:C.gold,fontWeight:700,fontSize:13}}>{proj.projectName||proj.projectNum}</span>
                        <span style={{color:C.accent,fontSize:11,marginLeft:8}}>{proj.projectNum}</span>
                        <span style={{color:C.muted,fontSize:11,marginLeft:6}}>{proj.taskNum}</span>
                      </div>
                      <Input value={entry.reg} onChange={v=>updateEntry(i,proj.id,"reg",v)} placeholder="0" type="number" disabled={submitted} style={{textAlign:"center"}}/>
                      <Input value={entry.ot} onChange={v=>updateEntry(i,proj.id,"ot",v)} placeholder="0" type="number" disabled={submitted} style={{textAlign:"center",borderColor:entry.ot?C.amber:C.border}}/>
                      <Input value={entry.dt} onChange={v=>updateEntry(i,proj.id,"dt",v)} placeholder="0" type="number" disabled={submitted} style={{textAlign:"center",borderColor:entry.dt?C.red:C.border}}/>
                    </div>
                  );
                })}
              </div>

              <div style={{marginBottom:12}}>
                <label style={{color:C.muted,fontSize:11,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",display:"block",marginBottom:6}}>Notes</label>
                <Textarea value={day.notes} onChange={v=>updateDay(i,"notes",v)} placeholder="Overtime reason, absence codes (A/H/V/S/JD/LA), etc." rows={2} disabled={submitted}/>
              </div>
              <div>
                <label style={{color:C.muted,fontSize:11,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",display:"block",marginBottom:6}}>Daily Report <span style={{color:C.accent,fontSize:10}}>→ Daily Report spreadsheet</span></label>
                <Textarea value={day.report} onChange={v=>updateDay(i,"report",v)} placeholder="What did you accomplish today? Blockers, milestones, updates?" rows={3} disabled={submitted}/>
              </div>
            </div>
          </div>
        );
      })}

      {!submitted&&(
        <div style={{display:"flex",gap:12,justifyContent:"flex-end",marginTop:8}}>
          <Btn variant="ghost" onClick={()=>handleSave(false)}>Save Draft</Btn>
          <Btn variant="primary" onClick={()=>handleSave(true)} disabled={grandTotal===0}>Submit Timesheet ✓</Btn>
        </div>
      )}
      {submitted&&<div style={{background:C.greenDim,border:`1px solid ${C.green}`,borderRadius:10,padding:"14px 20px",color:C.green,fontWeight:700,textAlign:"center",marginTop:8}}>Timesheet submitted. Your manager will review and send to payroll.</div>}
    </div>
  );
}

// ── Manager View ──────────────────────────────────────────────────────────────
function ManagerView({employees,weekStart,data,settings,projects,onApprove}) {
  const weekKey=weekStart.toISOString().slice(0,10);
  const [selected,setSelected]=useState(null);
  const [status,setStatus]=useState("");
  const [sending,setSending]=useState(false);
  const submitted=employees.filter(e=>data[e.id]?.[weekKey]?._submitted);

  const handleExport=async(toPayroll)=>{
    if(!settings.managerEmail){setStatus("⚠️ Set manager email in Admin → Settings first.");return;}
    setSending(true);setStatus("");
    await new Promise(r=>setTimeout(r,1200));
    setSending(false);
    buildXLSXAndDownload(submitted,weekStart,data,projects,settings);
    buildDailyReportCSV(submitted,weekStart,data);
    const target=toPayroll?(settings.payrollEmail||"payroll"):settings.managerEmail;
    setStatus(`✓ Timesheet & Daily Report exported. In live deployment, files email to ${target} automatically.`);
    if(toPayroll)onApprove(weekKey,submitted.map(e=>e.id));
  };

  return(
    <div style={{maxWidth:960,margin:"0 auto",position:"relative",zIndex:1}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:28,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{margin:0,color:C.text,fontSize:22,fontWeight:900}}>Manager Review</h2>
          <p style={{margin:"4px 0 0",color:C.muted,fontSize:13}}>{weekLabel(weekStart)}</p>
        </div>
        <Badge color={submitted.length>0?"green":"amber"}>{submitted.length}/{employees.length} submitted</Badge>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:28}}>
        {employees.map(emp=>{
          const wd=data[emp.id]?.[weekKey];const sub=!!wd?._submitted;
          const reg=sub?DAYS.reduce((s,d)=>s+(wd[d]?.entries||[]).reduce((ss,e)=>ss+(parseFloat(e.reg)||0),0),0):0;
          const ot=sub?DAYS.reduce((s,d)=>s+(wd[d]?.entries||[]).reduce((ss,e)=>ss+(parseFloat(e.ot)||0),0),0):0;
          const dt=sub?DAYS.reduce((s,d)=>s+(wd[d]?.entries||[]).reduce((ss,e)=>ss+(parseFloat(e.dt)||0),0),0):0;
          return(
            <div key={emp.id} onClick={()=>sub?setSelected(selected===emp.id?null:emp.id):null}
              style={{background:C.card,border:`1px solid ${sub?C.accent:C.border}`,borderRadius:12,padding:16,cursor:sub?"pointer":"default",transition:"border-color .2s"}}>
              <div style={{fontWeight:900,color:C.text,fontSize:14,marginBottom:2}}>{emp.name}</div>
              <div style={{color:C.gold,fontSize:12,marginBottom:10}}>{emp.empNo||<span style={{color:C.amber}}>No Emp# yet</span>}</div>
              {sub?<>
                <Badge color="green">✓ Submitted</Badge>
                <div style={{marginTop:10,fontSize:12,display:"flex",gap:10}}>
                  <span style={{color:C.muted}}>REG <strong style={{color:C.text}}>{reg.toFixed(1)}</strong></span>
                  <span style={{color:C.muted}}>OT <strong style={{color:C.amber}}>{ot.toFixed(1)}</strong></span>
                  <span style={{color:C.muted}}>DT <strong style={{color:C.red}}>{dt.toFixed(1)}</strong></span>
                </div>
              </>:<Badge color="amber">Pending</Badge>}
            </div>
          );
        })}
      </div>

      {selected&&(()=>{
        const emp=employees.find(e=>e.id===selected);
        const wd=data[emp.id][weekKey];
        const empProjs=projects.filter(p=>emp.projects?.includes(p.id));
        return(
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,marginBottom:24,padding:24}}>
            <h3 style={{margin:"0 0 16px",color:C.text,fontWeight:900}}>{emp.name} <span style={{color:C.gold,fontWeight:400,fontSize:14}}>#{emp.empNo}</span> — Detailed View</h3>
            {DAYS.map((day,i)=>{
              const d=wd[day];if(!d)return null;
              const hasHours=d.entries?.some(e=>(parseFloat(e.reg)||0)+(parseFloat(e.ot)||0)+(parseFloat(e.dt)||0)>0);
              if(!hasHours&&!d.report)return null;
              return(
                <div key={day} style={{borderBottom:`1px solid ${C.border}`,paddingBottom:14,marginBottom:14}}>
                  <div style={{fontWeight:700,color:C.accent,fontSize:13,marginBottom:6,display:"flex",justifyContent:"space-between"}}>
                    <span>{day} · <span style={{color:C.muted,fontWeight:400}}>{dateOfDay(weekStart,i)}</span>{d.location&&<span style={{color:C.gold,marginLeft:10}}>📍{d.location}</span>}</span>
                  </div>
                  {empProjs.map(proj=>{
                    const entry=d.entries?.find(e=>e.projectId===proj.id);
                    const reg=parseFloat(entry?.reg)||0;const ot=parseFloat(entry?.ot)||0;const dt=parseFloat(entry?.dt)||0;
                    if(!reg&&!ot&&!dt)return null;
                    return(
                      <div key={proj.id} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:C.text,padding:"3px 0"}}>
                        <span style={{color:C.gold}}>{proj.projectName||proj.projectNum} <span style={{color:C.muted,fontSize:11}}>{proj.taskNum}</span></span>
                        <span>REG <strong>{reg}</strong> · OT <strong style={{color:C.amber}}>{ot}</strong> · DT <strong style={{color:C.red}}>{dt}</strong></span>
                      </div>
                    );
                  })}
                  {d.notes&&<p style={{color:C.muted,fontSize:12,margin:"6px 0 0"}}>📝 {d.notes}</p>}
                  {d.report&&<div style={{background:"#0f0f0f",borderRadius:8,padding:"10px 12px",marginTop:8,fontSize:13,color:C.text,borderLeft:`3px solid ${C.accent}`}}><span style={{color:C.accent,fontSize:11,fontWeight:700}}>DAILY REPORT · </span>{d.report}</div>}
                </div>
              );
            })}
          </div>
        );
      })()}

      {submitted.length>0&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24}}>
          <h3 style={{margin:"0 0 8px",color:C.text,fontSize:16,fontWeight:900}}>Export & Send</h3>
          <p style={{color:C.muted,fontSize:12,marginBottom:20}}>Exports your company timesheet format (PROJECT DESCRIPTION column included) + Daily Report, one section per employee.</p>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <Btn variant="amber" onClick={()=>handleExport(false)} disabled={sending}>{sending?"Exporting…":"📧 Send to My Email for Review"}</Btn>
            <Btn variant="primary" onClick={()=>handleExport(true)} disabled={sending}>{sending?"Exporting…":"✓ Approve & Send to Payroll"}</Btn>
          </div>
          {status&&<div style={{marginTop:14,padding:"12px 16px",borderRadius:8,background:status.startsWith("⚠")?C.amberDim:C.greenDim,color:status.startsWith("⚠")?C.amber:C.green,fontSize:13}}>{status}</div>}
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const stored=load();
  const [settings,setSettings]   = useState(stored.settings   ||{company:"Beard Integrated Systems",supervisor:"Daniel Hancock",managerEmail:"",payrollEmail:"",ccEmail:"",locations:DEFAULT_LOCATIONS});
  const [employees,setEmployees] = useState(stored.employees  ||DEFAULT_EMPLOYEES);
  const [projects,setProjects]   = useState(stored.projects   ||DEFAULT_PROJECTS);
  const [timesheetData,setTD]    = useState(stored.timesheetData||{});
  const [reminderPrefs,setRP]    = useState(stored.reminderPrefs||{});
  const [view,setView]           = useState("manager");
  const weekStart=WEEK_START;
  const weekKey=weekStart.toISOString().slice(0,10);

  useEffect(()=>{ save({settings,employees,projects,timesheetData,reminderPrefs}); },[settings,employees,projects,timesheetData,reminderPrefs]);

  const saveEntry=(empId,wk,dd)=>setTD(p=>({...p,[empId]:{...(p[empId]||{}),[wk]:dd}}));
  const saveReminder=(empId,prefs)=>setRP(p=>({...p,[empId]:prefs}));
  const handleApprove=(wk,ids)=>setTD(p=>{const n={...p};ids.forEach(id=>{if(n[id]?.[wk])n[id][wk]._approved=true;});return n;});

  const submittedCount=employees.filter(e=>timesheetData[e.id]?.[weekKey]?._submitted).length;

  const navTabs=[
    {id:"manager",label:"📋 Manager",badge:submittedCount>0?`${submittedCount} ready`:null},
    {id:"admin",label:"🔧 Admin",badge:null},
    ...employees.map(e=>({id:e.id,label:`👤 ${e.name.split(" ")[0]}`})),
  ];

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'DM Sans',system-ui,sans-serif",color:C.text,position:"relative"}}>
      <BeardCanvas/>

      {/* Header */}
      <div style={{background:"rgba(10,10,10,0.95)",borderBottom:`1px solid ${C.border}`,padding:"0 24px",position:"sticky",top:0,zIndex:50,backdropFilter:"blur(10px)"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:64}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            {/* Beard Logo */}
            <div style={{width:40,height:40,borderRadius:10,background:"linear-gradient(135deg,#8b0000,#c0392b)",display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid #c0392b44",boxShadow:"0 0 16px rgba(192,57,43,0.3)"}}>
              <span style={{fontWeight:900,fontSize:16,color:C.white,letterSpacing:1}}>B</span>
            </div>
            <div>
              <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                <span style={{fontWeight:900,fontSize:17,color:C.white,letterSpacing:2,textTransform:"uppercase"}}>BEARD</span>
                <span style={{fontWeight:900,fontSize:17,color:C.accent,letterSpacing:2,textTransform:"uppercase"}}>&ldquo;ONE&rdquo;</span>
              </div>
              <div style={{color:C.muted,fontSize:10,letterSpacing:2,textTransform:"uppercase",marginTop:-1}}>1% better every day</div>
            </div>
          </div>
          {/* Center — VDC Department */}
          <div style={{position:"absolute",left:"50%",transform:"translateX(-50%)",textAlign:"center"}}>
            <div style={{fontWeight:900,fontSize:13,color:C.text,letterSpacing:3,textTransform:"uppercase"}}>VDC Department</div>
            <div style={{color:C.accent,fontSize:9,letterSpacing:3,textTransform:"uppercase",marginTop:1}}>Timesheet Platform</div>
          </div>
          <div style={{color:C.muted,fontSize:12,letterSpacing:1,visibility:"hidden"}}>Timesheet Platform</div>
        </div>
      </div>

      {/* Nav */}
      <div style={{background:"rgba(10,10,10,0.9)",borderBottom:`1px solid ${C.border}`,padding:"0 24px",position:"sticky",top:64,zIndex:49,backdropFilter:"blur(10px)"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",gap:0,overflowX:"auto"}}>
          {navTabs.map(tab=>(
            <button key={tab.id} onClick={()=>setView(tab.id)}
              style={{background:"none",border:"none",borderBottom:`3px solid ${view===tab.id?C.accent:"transparent"}`,
                color:view===tab.id?C.accent:C.muted,cursor:"pointer",fontFamily:"inherit",
                fontWeight:700,fontSize:13,padding:"14px 18px",whiteSpace:"nowrap",
                letterSpacing:.3,transition:"color .15s",display:"flex",alignItems:"center",gap:7}}>
              {tab.label}{tab.badge&&<Badge color="accent">{tab.badge}</Badge>}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{padding:"32px 24px",maxWidth:1100,margin:"0 auto"}}>
        {view==="manager"&&<ManagerView employees={employees} weekStart={weekStart} data={timesheetData} settings={settings} projects={projects} onApprove={handleApprove}/>}
        {view==="admin"&&<AdminConsole employees={employees} setEmployees={setEmployees} projects={projects} setProjects={setProjects} settings={settings} setSettings={setSettings}/>}
        {employees.find(e=>e.id===view)&&<EmployeeView employee={employees.find(e=>e.id===view)} weekStart={weekStart} data={timesheetData} onSave={saveEntry} reminderPrefs={reminderPrefs} onSaveReminder={saveReminder} projects={projects} settings={settings}/>}
      </div>
    </div>
  );
}
