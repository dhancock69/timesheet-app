import { useState, useEffect, useRef } from "react";

const C = {
  bg: "#0f1117", surface: "#1a1d27", card: "#20243a", border: "#2a2f4a",
  accent: "#4f8ef7", accentDim: "#1e3a6e", green: "#2dd4a0", greenDim: "#0d3d2e",
  amber: "#f5a623", amberDim: "#3d2800", red: "#f75f5f", redDim: "#3d1010",
  text: "#e8ecf4", muted: "#7b82a0", white: "#ffffff", purple: "#a78bfa", purpleDim: "#2e1f5e",
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
function dateOfDay(ws, i) {
  const d = new Date(ws); d.setDate(d.getDate() + i);
  return d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
}
function excelDate(ws, i) {
  const d = new Date(ws); d.setDate(d.getDate() + i);
  return d.toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"numeric"});
}
function totalHoursType(entries, type) {
  return entries.reduce((s,e) => s + (parseFloat(e[type])||0), 0);
}
function uid() { return Math.random().toString(36).slice(2,9); }
function todayWeekdayName() {
  return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()];
}
function isWeekday() { const d = new Date().getDay(); return d>=1&&d<=5; }
function parseTime(t) { const [h,m]=t.split(":").map(Number); return {h:isNaN(h)?0:h,m:isNaN(m)?0:m}; }
function fmt12(t) { const {h,m}=parseTime(t); const ap=h>=12?"PM":"AM"; const hh=h%12||12; return `${hh}:${String(m).padStart(2,"0")} ${ap}`; }

const STORAGE_KEY = "tsp_v3";
function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY))||{}; } catch { return {}; } }
function save(data) { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(data)); } catch {} }

const DEFAULT_PROJECTS = [
  {id:"p1", projectNum:"10-11-6010", taskNum:"OH", expenseType:"", ocip:""},
  {id:"p2", projectNum:"10-11-6035", taskNum:"HOL", expenseType:"", ocip:""},
  {id:"p3", projectNum:"25-201-240", taskNum:"90", expenseType:"486", ocip:"sm1 cusw"},
];
const DEFAULT_EMPLOYEES = [
  {id:"emp1", name:"Dan Hancock", empNo:"HAN4127", role:"VDC/BIM Manager", projects:["p1","p2","p3"]},
  {id:"emp2", name:"Jose Barron", empNo:"BAR9939", role:"Team Member", projects:["p1","p2","p3"]},
  {id:"emp3", name:"James Pugh III", empNo:"", role:"Team Member", projects:["p1","p2","p3"]},
];

// ── Reminder hook ─────────────────────────────────────────────────────────────
function useReminders(empId, reminderPrefs, timesheetData, weekKey) {
  const timerRefs = useRef([]);
  const [toast, setToast] = useState(null);
  const shownRef = useRef({});
  const alreadySubmitted = !!timesheetData[empId]?.[weekKey]?._submitted;
  useEffect(() => {
    timerRefs.current.forEach(clearTimeout); timerRefs.current = [];
    if (!empId || alreadySubmitted || !isWeekday()) return;
    const schedule = (timeStr, label) => {
      if (!timeStr) return;
      const now = new Date(); const {h,m} = parseTime(timeStr);
      const target = new Date(); target.setHours(h,m,0,0);
      const diff = target - now;
      if (diff > 0 && diff < 24*60*60*1000) {
        const key = `${empId}-${timeStr}-${new Date().toDateString()}`;
        if (shownRef.current[key]) return;
        const tid = setTimeout(() => {
          shownRef.current[key] = true;
          const today = todayWeekdayName();
          const dayData = timesheetData[empId]?.[weekKey]?.[today];
          const hasEntries = dayData?.entries?.some(e => e.project);
          if (!hasEntries) setToast(`${label}: Don't forget to log your time and daily report for ${today}!`);
        }, diff);
        timerRefs.current.push(tid);
      }
    };
    schedule("13:00","Daily Reminder");
    if (reminderPrefs?.extra && reminderPrefs.extra !== "13:00") schedule(reminderPrefs.extra,"Extra Reminder");
    return () => timerRefs.current.forEach(clearTimeout);
  }, [empId, reminderPrefs?.extra, alreadySubmitted, weekKey]);
  return { toast, setToast };
}

// ── UI primitives ─────────────────────────────────────────────────────────────
function Badge({ color, children }) {
  const map = { green:[C.greenDim,C.green], amber:[C.amberDim,C.amber], red:[C.redDim,C.red], purple:[C.purpleDim,C.purple], accent:[C.accentDim,C.accent] };
  const [bg,fg] = map[color]||[C.accentDim,C.accent];
  return <span style={{background:bg,color:fg,borderRadius:6,padding:"2px 10px",fontSize:11,fontWeight:700,letterSpacing:.5,whiteSpace:"nowrap"}}>{children}</span>;
}
function Btn({ children, onClick, variant="primary", small, disabled, style={} }) {
  const base = {border:"none",borderRadius:8,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",fontWeight:700,letterSpacing:.3,transition:"opacity .15s",opacity:disabled?.45:1,padding:small?"6px 14px":"10px 22px",fontSize:small?12:13,...style};
  const variants = {primary:{background:C.accent,color:C.white},green:{background:C.green,color:"#05150f"},danger:{background:C.red,color:C.white},ghost:{background:"transparent",color:C.muted,border:`1px solid ${C.border}`},amber:{background:C.amber,color:"#1a0d00"},purple:{background:C.purple,color:"#0d0820"}};
  return <button style={{...base,...variants[variant]}} onClick={onClick} disabled={disabled} onMouseEnter={e=>{if(!disabled)e.currentTarget.style.opacity=".8";}} onMouseLeave={e=>{e.currentTarget.style.opacity=disabled?".45":"1";}}>{children}</button>;
}
function Input({ value, onChange, placeholder, type="text", style={}, disabled }) {
  return <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
    style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontFamily:"inherit",fontSize:13,padding:"8px 12px",outline:"none",width:"100%",boxSizing:"border-box",...style}}
    onFocus={e=>{e.target.style.borderColor=C.accent;}} onBlur={e=>{e.target.style.borderColor=C.border;}}/>;
}
function Textarea({ value, onChange, placeholder, rows=3, disabled }) {
  return <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} disabled={disabled}
    style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontFamily:"inherit",fontSize:13,padding:"8px 12px",outline:"none",width:"100%",boxSizing:"border-box",resize:"vertical"}}
    onFocus={e=>{e.target.style.borderColor=C.accent;}} onBlur={e=>{e.target.style.borderColor=C.border;}}/>;
}
function Select({ value, onChange, children, style={} }) {
  return <select value={value} onChange={e=>onChange(e.target.value)}
    style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:value?C.text:C.muted,fontFamily:"inherit",fontSize:13,padding:"8px 12px",outline:"none",...style}}>
    {children}
  </select>;
}
function ReminderToast({ message, onDismiss }) {
  if (!message) return null;
  return <div style={{position:"fixed",top:70,left:"50%",transform:"translateX(-50%)",zIndex:200,background:"linear-gradient(135deg,#1e3a6e,#0d3d2e)",border:`1px solid ${C.accent}`,borderRadius:14,padding:"16px 22px",display:"flex",alignItems:"center",gap:14,boxShadow:"0 8px 32px rgba(0,0,0,.5)",maxWidth:480,width:"calc(100% - 40px)"}}>
    <div style={{fontSize:26}}>⏰</div>
    <div style={{flex:1}}><div style={{fontWeight:800,color:C.accent,fontSize:13,marginBottom:3}}>Time to log your hours!</div><div style={{color:C.text,fontSize:13}}>{message}</div></div>
    <button onClick={onDismiss} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:20}}>×</button>
  </div>;
}

// ── Excel export ──────────────────────────────────────────────────────────────
function exportToExcel(employees, weekStart, timesheetData, projects, settings) {
  const weekKey = weekStart.toISOString().slice(0,10);
  const weekEndDate = new Date(weekStart); weekEndDate.setDate(weekEndDate.getDate()+6);
  const weekEndStr = weekEndDate.toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"numeric"});

  // Build CSV with one section per employee (simulating tabs)
  let csv = "";
  employees.forEach((emp, ei) => {
    if (ei > 0) csv += "\n\n\n";
    const weekData = timesheetData[emp.id]?.[weekKey] || {};
    const empProjects = projects.filter(p => emp.projects?.includes(p.id));

    // Header block
    csv += `EMPLOYEE TIMESHEET - ${settings.company}\n`;
    csv += `Employee No.,${emp.empNo || "PENDING"},,,,,,,Employee Name,${emp.name}\n`;
    csv += `Week/Period Ending,${weekEndStr},,,,,,,Supervisor,${settings.supervisor || "Daniel Hancock"}\n`;
    csv += `\n`;

    // Column headers
    csv += `PROJECT #,TASK #,EXPENSE TYPE,OCIP Y/N,`;
    DAYS.forEach(day => { csv += `${day.toUpperCase()} REG,${day.toUpperCase()} OT,${day.toUpperCase()} DT,`; });
    csv += `TOTAL REG,TOTAL OT,TOTAL DT\n`;

    // Date row
    csv += `,,,,`;
    DAYS.forEach((_,i) => { csv += `${excelDate(weekStart,i)},,,`; });
    csv += `,,\n`;

    // Project rows
    let grandReg=0, grandOT=0, grandDT=0;
    const dayTotals = DAYS.map(()=>({reg:0,ot:0,dt:0}));

    empProjects.forEach(proj => {
      let rowReg=0, rowOT=0, rowDT=0;
      csv += `${proj.projectNum},${proj.taskNum},${proj.expenseType},${proj.ocip},`;
      DAYS.forEach((day,di) => {
        const dayData = weekData[day];
        const entry = dayData?.entries?.find(e => e.projectId === proj.id);
        const reg = parseFloat(entry?.reg)||0;
        const ot = parseFloat(entry?.ot)||0;
        const dt = parseFloat(entry?.dt)||0;
        csv += `${reg||""},${ot||""},${dt||""},`;
        rowReg+=reg; rowOT+=ot; rowDT+=dt;
        dayTotals[di].reg+=reg; dayTotals[di].ot+=ot; dayTotals[di].dt+=dt;
      });
      grandReg+=rowReg; grandOT+=rowOT; grandDT+=rowDT;
      csv += `${rowReg||0},${rowOT||0},${rowDT||0}\n`;
    });

    // Day totals row
    csv += `,,TOTAL,`;
    dayTotals.forEach(d => { csv += `${d.reg||0},${d.ot||0},${d.dt||0},`; });
    csv += `${grandReg},${grandOT},${grandDT}\n`;

    csv += `\nUse these codes on appropriate days: A = Absent  H = Holiday  JD = Jury Duty  V = Vacation  S = Sick Leave  LA = Leave of Absence\n`;
  });

  const blob = new Blob([csv],{type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=`Timesheet_${weekKey}_AllEmployees.csv`; a.click();
  URL.revokeObjectURL(url);
}

function exportDailyReport(employees, weekStart, timesheetData) {
  const weekKey = weekStart.toISOString().slice(0,10);
  let csv = "EMPLOYEE,DAY,DATE,DAILY REPORT,WEEK\n";
  employees.forEach(emp => {
    const weekData = timesheetData[emp.id]?.[weekKey]||{};
    DAYS.forEach((day,i) => {
      const report = weekData[day]?.report;
      if (report) csv += `"${emp.name}","${day}","${dateOfDay(weekStart,i)}","${report.replace(/"/g,'""')}","${weekLabel(weekStart)}"\n`;
    });
  });
  const blob = new Blob([csv],{type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=`DailyReport_${weekKey}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Admin Console ─────────────────────────────────────────────────────────────
function AdminConsole({ employees, setEmployees, projects, setProjects, settings, setSettings }) {
  const [tab, setTab] = useState("team");
  const [saved, setSaved] = useState("");

  // Team state
  const [newName, setNewName] = useState(""); const [newEmpNo, setNewEmpNo] = useState("");
  const [newRole, setNewRole] = useState(""); const [editEmp, setEditEmp] = useState(null);

  // Project state
  const [newProj, setNewProj] = useState({projectNum:"",taskNum:"",expenseType:"",ocip:""});
  const [editProj, setEditProj] = useState(null);

  // Settings state
  const [settingsForm, setSettingsForm] = useState({...settings});

  const flash = (msg) => { setSaved(msg); setTimeout(()=>setSaved(""),2500); };

  const addEmployee = () => {
    if (!newName.trim()) return;
    const emp = {id:uid(), name:newName.trim(), empNo:newEmpNo.trim(), role:newRole.trim()||"Team Member", projects:projects.map(p=>p.id)};
    setEmployees(p=>[...p,emp]); setNewName(""); setNewEmpNo(""); setNewRole(""); flash("Employee added!");
  };
  const removeEmployee = id => { if(window.confirm("Remove this employee?")) setEmployees(p=>p.filter(e=>e.id!==id)); };
  const saveEmpEdit = () => {
    setEmployees(p=>p.map(e=>e.id===editEmp.id?editEmp:e)); setEditEmp(null); flash("Employee updated!");
  };
  const toggleEmpProject = (empId, projId) => {
    setEmployees(p=>p.map(e=>e.id===empId?{...e,projects:e.projects?.includes(projId)?e.projects.filter(x=>x!==projId):[...(e.projects||[]),projId]}:e));
  };

  const addProject = () => {
    if (!newProj.projectNum.trim()) return;
    const proj = {id:uid(),...newProj};
    setProjects(p=>[...p,proj]);
    setEmployees(p=>p.map(e=>({...e,projects:[...(e.projects||[]),proj.id]})));
    setNewProj({projectNum:"",taskNum:"",expenseType:"",ocip:""}); flash("Project code added!");
  };
  const removeProject = id => { if(window.confirm("Remove this project code?")) { setProjects(p=>p.filter(x=>x.id!==id)); setEmployees(p=>p.map(e=>({...e,projects:(e.projects||[]).filter(x=>x!==id)}))); }};
  const saveProjEdit = () => { setProjects(p=>p.map(x=>x.id===editProj.id?editProj:x)); setEditProj(null); flash("Project updated!"); };

  const tabs = [{id:"team",label:"👥 Team Members"},{id:"projects",label:"📋 Project Codes"},{id:"settings",label:"⚙ Settings"}];

  return (
    <div style={{maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <div style={{width:36,height:36,background:`linear-gradient(135deg,${C.purple},${C.accent})`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🔧</div>
        <div><h2 style={{margin:0,color:C.text,fontSize:22,fontWeight:800}}>Admin Console</h2><p style={{margin:0,color:C.muted,fontSize:13}}>Manage team, project codes, and platform settings</p></div>
        {saved && <Badge color="green">✓ {saved}</Badge>}
      </div>

      {/* Sub-tabs */}
      <div style={{display:"flex",gap:0,borderBottom:`1px solid ${C.border}`,marginBottom:24}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",borderBottom:`3px solid ${tab===t.id?C.purple:"transparent"}`,color:tab===t.id?C.purple:C.muted,cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:13,padding:"12px 20px",transition:"color .15s"}}>{t.label}</button>
        ))}
      </div>

      {/* TEAM TAB */}
      {tab==="team" && (
        <div>
          {/* Existing employees */}
          {employees.map(emp=>(
            <div key={emp.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,marginBottom:12,overflow:"hidden"}}>
              {editEmp?.id===emp.id ? (
                <div style={{padding:20}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
                    <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>FULL NAME</label><Input value={editEmp.name} onChange={v=>setEditEmp(p=>({...p,name:v}))}/></div>
                    <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>EMPLOYEE NO.</label><Input value={editEmp.empNo} onChange={v=>setEditEmp(p=>({...p,empNo:v}))} placeholder="e.g. HAN4127"/></div>
                    <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>ROLE</label><Input value={editEmp.role} onChange={v=>setEditEmp(p=>({...p,role:v}))}/></div>
                  </div>
                  <div style={{marginBottom:16}}>
                    <label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:8}}>ASSIGNED PROJECT CODES</label>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                      {projects.map(proj=>(
                        <button key={proj.id} onClick={()=>toggleEmpProject(emp.id,proj.id)}
                          style={{background:editEmp.projects?.includes(proj.id)?C.accentDim:C.surface,border:`1px solid ${editEmp.projects?.includes(proj.id)?C.accent:C.border}`,borderRadius:8,color:editEmp.projects?.includes(proj.id)?C.accent:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:12,padding:"6px 12px"}}>
                          {proj.projectNum} {proj.taskNum}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:10}}><Btn variant="green" small onClick={saveEmpEdit}>Save</Btn><Btn variant="ghost" small onClick={()=>setEditEmp(null)}>Cancel</Btn></div>
                </div>
              ) : (
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",flexWrap:"wrap",gap:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:16}}>
                    <div style={{width:38,height:38,background:C.accentDim,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:C.accent,fontSize:14}}>{emp.name.split(" ").map(x=>x[0]).join("").slice(0,2)}</div>
                    <div>
                      <div style={{fontWeight:800,color:C.text,fontSize:14}}>{emp.name}</div>
                      <div style={{color:C.muted,fontSize:12,marginTop:2}}>{emp.role} · <span style={{color:emp.empNo?C.accent:C.amber}}>{emp.empNo||"⚠ No Employee No. yet"}</span></div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{color:C.muted,fontSize:12}}>{(emp.projects||[]).length} project codes</span>
                    <Btn variant="ghost" small onClick={()=>setEditEmp({...emp})}>Edit</Btn>
                    <Btn variant="danger" small onClick={()=>removeEmployee(emp.id)}>Remove</Btn>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add new employee */}
          <div style={{background:C.card,border:`2px dashed ${C.border}`,borderRadius:12,padding:20,marginTop:8}}>
            <div style={{color:C.accent,fontWeight:700,fontSize:13,marginBottom:14}}>+ Add New Team Member</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:14}}>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>FULL NAME *</label><Input value={newName} onChange={setNewName} placeholder="First Last"/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>EMPLOYEE NO.</label><Input value={newEmpNo} onChange={setNewEmpNo} placeholder="e.g. PUG1234 (can add later)"/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>ROLE</label><Input value={newRole} onChange={setNewRole} placeholder="Team Member"/></div>
            </div>
            <Btn variant="purple" onClick={addEmployee} disabled={!newName.trim()}>Add Team Member</Btn>
          </div>
        </div>
      )}

      {/* PROJECTS TAB */}
      {tab==="projects" && (
        <div>
          {projects.map(proj=>(
            <div key={proj.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,marginBottom:10,overflow:"hidden"}}>
              {editProj?.id===proj.id ? (
                <div style={{padding:16}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:12}}>
                    <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>PROJECT #</label><Input value={editProj.projectNum} onChange={v=>setEditProj(p=>({...p,projectNum:v}))}/></div>
                    <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>TASK #</label><Input value={editProj.taskNum} onChange={v=>setEditProj(p=>({...p,taskNum:v}))}/></div>
                    <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>EXPENSE TYPE</label><Input value={editProj.expenseType} onChange={v=>setEditProj(p=>({...p,expenseType:v}))}/></div>
                    <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>OCIP Y/N</label><Input value={editProj.ocip} onChange={v=>setEditProj(p=>({...p,ocip:v}))}/></div>
                  </div>
                  <div style={{display:"flex",gap:10}}><Btn variant="green" small onClick={saveProjEdit}>Save</Btn><Btn variant="ghost" small onClick={()=>setEditProj(null)}>Cancel</Btn></div>
                </div>
              ) : (
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",flexWrap:"wrap",gap:10}}>
                  <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
                    <div><span style={{color:C.muted,fontSize:11,fontWeight:700}}>PROJECT # </span><span style={{color:C.accent,fontWeight:800,fontSize:14}}>{proj.projectNum}</span></div>
                    <div><span style={{color:C.muted,fontSize:11,fontWeight:700}}>TASK # </span><span style={{color:C.text,fontWeight:700}}>{proj.taskNum}</span></div>
                    {proj.expenseType&&<div><span style={{color:C.muted,fontSize:11,fontWeight:700}}>EXPENSE </span><span style={{color:C.text,fontWeight:700}}>{proj.expenseType}</span></div>}
                    {proj.ocip&&<div><span style={{color:C.muted,fontSize:11,fontWeight:700}}>OCIP </span><span style={{color:C.text,fontWeight:700}}>{proj.ocip}</span></div>}
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <Btn variant="ghost" small onClick={()=>setEditProj({...proj})}>Edit</Btn>
                    <Btn variant="danger" small onClick={()=>removeProject(proj.id)}>Remove</Btn>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add new project */}
          <div style={{background:C.card,border:`2px dashed ${C.border}`,borderRadius:12,padding:20,marginTop:8}}>
            <div style={{color:C.accent,fontWeight:700,fontSize:13,marginBottom:14}}>+ Add New Project Code</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:14}}>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>PROJECT # *</label><Input value={newProj.projectNum} onChange={v=>setNewProj(p=>({...p,projectNum:v}))} placeholder="e.g. 10-11-6010"/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>TASK #</label><Input value={newProj.taskNum} onChange={v=>setNewProj(p=>({...p,taskNum:v}))} placeholder="e.g. OH"/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>EXPENSE TYPE</label><Input value={newProj.expenseType} onChange={v=>setNewProj(p=>({...p,expenseType:v}))} placeholder="e.g. 486"/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>OCIP Y/N</label><Input value={newProj.ocip} onChange={v=>setNewProj(p=>({...p,ocip:v}))} placeholder="e.g. sm1 cusw"/></div>
            </div>
            <Btn variant="purple" onClick={addProject} disabled={!newProj.projectNum.trim()}>Add Project Code</Btn>
          </div>
        </div>
      )}

      {/* SETTINGS TAB */}
      {tab==="settings" && (
        <div style={{maxWidth:540}}>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24}}>
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>COMPANY NAME</label><Input value={settingsForm.company} onChange={v=>setSettingsForm(p=>({...p,company:v}))} placeholder="Beard Integrated"/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>SUPERVISOR NAME (for timesheet)</label><Input value={settingsForm.supervisor} onChange={v=>setSettingsForm(p=>({...p,supervisor:v}))} placeholder="Daniel Hancock"/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>MANAGER EMAIL (You)</label><Input value={settingsForm.managerEmail} onChange={v=>setSettingsForm(p=>({...p,managerEmail:v}))} placeholder="you@company.com"/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>PAYROLL EMAIL</label><Input value={settingsForm.payrollEmail} onChange={v=>setSettingsForm(p=>({...p,payrollEmail:v}))} placeholder="payroll@company.com"/></div>
            </div>
            <div style={{marginTop:20}}><Btn variant="purple" onClick={()=>{setSettings(settingsForm);flash("Settings saved!");}}>Save Settings</Btn></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Employee view ─────────────────────────────────────────────────────────────
function EmployeeView({ employee, weekStart, data, onSave, reminderPrefs, onSaveReminder, projects }) {
  const weekKey = weekStart.toISOString().slice(0,10);
  const stored = data[employee.id]?.[weekKey] || {};
  const empProjects = projects.filter(p => employee.projects?.includes(p.id));

  const [days, setDays] = useState(() =>
    DAYS.map((d,i) => ({
      name:d, date:dateOfDay(weekStart,i),
      entries: stored[d]?.entries || empProjects.map(p=>({id:uid(),projectId:p.id,reg:"",ot:"",dt:""})),
      notes: stored[d]?.notes||"", report: stored[d]?.report||"",
    }))
  );
  const [submitted, setSubmitted] = useState(!!stored._submitted);
  const [savedMsg, setSavedMsg] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const { toast, setToast } = useReminders(employee.id, reminderPrefs[employee.id], data, weekKey);

  useEffect(()=>{ if("Notification" in window && Notification.permission==="default") Notification.requestPermission(); },[]);

  const updateEntry=(dayIdx,projId,field,val)=>{
    setDays(p=>p.map((d,i)=>i===dayIdx?{...d,entries:d.entries.map(e=>e.projectId===projId?{...e,[field]:val}:e)}:d));
    setSavedMsg(false);
  };
  const updateDay=(i,field,val)=>{ setDays(p=>p.map((d,idx)=>idx===i?{...d,[field]:val}:d)); setSavedMsg(false); };

  const grandReg = days.reduce((s,d)=>s+d.entries.reduce((ss,e)=>ss+(parseFloat(e.reg)||0),0),0);
  const grandOT  = days.reduce((s,d)=>s+d.entries.reduce((ss,e)=>ss+(parseFloat(e.ot)||0),0),0);
  const grandDT  = days.reduce((s,d)=>s+d.entries.reduce((ss,e)=>ss+(parseFloat(e.dt)||0),0),0);
  const grandTotal = grandReg+grandOT+grandDT;

  const handleSave=(submit=false)=>{
    const dayData={};
    days.forEach(d=>{dayData[d.name]={entries:d.entries,notes:d.notes,report:d.report};});
    if(submit) dayData._submitted=true;
    onSave(employee.id,weekKey,dayData); setSavedMsg(true);
    if(submit) setSubmitted(true);
  };

  const todayName = todayWeekdayName();

  const timeOptions=[];
  for(let h=7;h<=19;h++) ["00","30"].forEach(m=>{ const v=`${String(h).padStart(2,"0")}:${m}`; if(v!=="13:00") timeOptions.push(v); });

  return (
    <div style={{maxWidth:1000,margin:"0 auto"}}>
      <ReminderToast message={toast} onDismiss={()=>setToast(null)}/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{margin:0,color:C.text,fontSize:22,fontWeight:800}}>{employee.name}</h2>
          <p style={{margin:"4px 0 0",color:C.muted,fontSize:13}}>{weekLabel(weekStart)} · {employee.empNo ? <span style={{color:C.accent}}>#{employee.empNo}</span> : <span style={{color:C.amber}}>⚠ Employee No. pending</span>}</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          {submitted?<Badge color="green">✓ Submitted</Badge>:savedMsg?<Badge color="amber">Saved</Badge>:null}
          <div style={{background:C.accentDim,borderRadius:8,padding:"8px 14px",fontWeight:800,fontSize:13,color:C.accent}}>
            REG {grandReg.toFixed(1)} · OT {grandOT.toFixed(1)} · DT {grandDT.toFixed(1)} · <span style={{color:C.green}}>Total {grandTotal.toFixed(1)}</span>
          </div>
          <Btn variant="ghost" small onClick={()=>setShowReminders(r=>!r)}>🔔 Reminders</Btn>
        </div>
      </div>

      {/* Reminder panel */}
      {showReminders && (
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20,marginBottom:20}}>
          <div style={{fontWeight:800,color:C.text,fontSize:14,marginBottom:14}}>🔔 Reminder Settings</div>
          <div style={{background:C.surface,borderRadius:10,padding:"12px 16px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontWeight:700,color:C.text,fontSize:13}}>Default Reminder</div><div style={{color:C.muted,fontSize:12}}>Every weekday at 1:00 PM</div></div>
            <Badge color="green">Always On</Badge>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <Select value={reminderPrefs[employee.id]?.extra||""} onChange={v=>onSaveReminder(employee.id,{extra:v})} style={{flex:1}}>
              <option value="">— No extra reminder —</option>
              {timeOptions.map(t=><option key={t} value={t}>{fmt12(t)}</option>)}
            </Select>
            <span style={{color:C.muted,fontSize:12}}>Additional reminder time</span>
          </div>
        </div>
      )}

      {/* Day cards */}
      {days.map((day,i)=>{
        const isToday = day.name===todayName;
        const dayReg=day.entries.reduce((s,e)=>s+(parseFloat(e.reg)||0),0);
        const dayOT=day.entries.reduce((s,e)=>s+(parseFloat(e.ot)||0),0);
        const dayDT=day.entries.reduce((s,e)=>s+(parseFloat(e.dt)||0),0);
        const dayTotal=dayReg+dayOT+dayDT;
        return (
          <div key={day.name} style={{background:C.card,border:`1px solid ${isToday?C.accent:C.border}`,borderRadius:12,marginBottom:14,overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 18px",borderBottom:`1px solid ${C.border}`,background:isToday?`linear-gradient(90deg,${C.accentDim},${C.surface})`:C.surface}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontWeight:800,color:isToday?C.accent:C.text,fontSize:14}}>{day.name}</span>
                <span style={{color:C.muted,fontSize:12}}>{day.date}</span>
                {isToday&&<Badge color="accent">Today</Badge>}
              </div>
              <div style={{display:"flex",gap:12,fontSize:12,color:C.muted}}>
                <span>REG <strong style={{color:C.text}}>{dayReg.toFixed(1)}</strong></span>
                <span>OT <strong style={{color:dayOT>0?C.amber:C.text}}>{dayOT.toFixed(1)}</strong></span>
                <span>DT <strong style={{color:dayDT>0?C.red:C.text}}>{dayDT.toFixed(1)}</strong></span>
                <span style={{color:C.green,fontWeight:800}}>{dayTotal.toFixed(1)} hrs</span>
              </div>
            </div>
            <div style={{padding:18}}>
              {/* Project hour grid */}
              <div style={{marginBottom:14}}>
                <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:8,marginBottom:6}}>
                  <div style={{color:C.muted,fontSize:11,fontWeight:700,letterSpacing:.8}}>PROJECT / TASK</div>
                  <div style={{color:C.muted,fontSize:11,fontWeight:700,letterSpacing:.8,textAlign:"center"}}>REG HRS</div>
                  <div style={{color:C.amber,fontSize:11,fontWeight:700,letterSpacing:.8,textAlign:"center"}}>OT HRS</div>
                  <div style={{color:C.red,fontSize:11,fontWeight:700,letterSpacing:.8,textAlign:"center"}}>DT HRS</div>
                </div>
                {empProjects.map(proj=>{
                  const entry=day.entries.find(e=>e.projectId===proj.id)||{reg:"",ot:"",dt:""};
                  return (
                    <div key={proj.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:8,marginBottom:8,alignItems:"center"}}>
                      <div style={{background:C.surface,borderRadius:8,padding:"8px 12px"}}>
                        <span style={{color:C.accent,fontWeight:700,fontSize:13}}>{proj.projectNum}</span>
                        <span style={{color:C.muted,fontSize:12,marginLeft:8}}>{proj.taskNum}{proj.expenseType?` · ${proj.expenseType}`:""}</span>
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
          <Btn variant="green" onClick={()=>handleSave(true)} disabled={grandTotal===0}>Submit Timesheet ✓</Btn>
        </div>
      )}
      {submitted&&<div style={{background:C.greenDim,border:`1px solid ${C.green}`,borderRadius:10,padding:"14px 20px",color:C.green,fontWeight:700,textAlign:"center",marginTop:8}}>Timesheet submitted. Your manager will review and send to payroll.</div>}
    </div>
  );
}

// ── Manager view ──────────────────────────────────────────────────────────────
function ManagerView({ employees, weekStart, data, settings, projects, onApprove }) {
  const weekKey = weekStart.toISOString().slice(0,10);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const submitted = employees.filter(e=>data[e.id]?.[weekKey]?._submitted);

  const handleExport = async (toPayroll) => {
    if(!settings.managerEmail){setStatus("⚠️ Set manager email in Admin → Settings first.");return;}
    setSending(true); setStatus("");
    await new Promise(r=>setTimeout(r,1500));
    setSending(false);
    exportToExcel(submitted, weekStart, data, projects, settings);
    exportDailyReport(submitted, weekStart, data);
    const target = toPayroll?(settings.payrollEmail||"payroll"):settings.managerEmail;
    setStatus(`✓ Timesheet & Daily Report exported. In live deployment, files email to ${target} automatically.`);
    if(toPayroll) onApprove(weekKey, submitted.map(e=>e.id));
  };

  return (
    <div style={{maxWidth:960,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:28,flexWrap:"wrap",gap:12}}>
        <div><h2 style={{margin:0,color:C.text,fontSize:22,fontWeight:800}}>Manager Review</h2><p style={{margin:"4px 0 0",color:C.muted,fontSize:13}}>{weekLabel(weekStart)}</p></div>
        <Badge color={submitted.length>0?"green":"amber"}>{submitted.length}/{employees.length} submitted</Badge>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:28}}>
        {employees.map(emp=>{
          const wd=data[emp.id]?.[weekKey]; const sub=!!wd?._submitted;
          const reg=sub?DAYS.reduce((s,d)=>s+(wd[d]?.entries||[]).reduce((ss,e)=>ss+(parseFloat(e.reg)||0),0),0):0;
          const ot=sub?DAYS.reduce((s,d)=>s+(wd[d]?.entries||[]).reduce((ss,e)=>ss+(parseFloat(e.ot)||0),0),0):0;
          const dt=sub?DAYS.reduce((s,d)=>s+(wd[d]?.entries||[]).reduce((ss,e)=>ss+(parseFloat(e.dt)||0),0),0):0;
          return(
            <div key={emp.id} onClick={()=>sub?setSelected(selected===emp.id?null:emp.id):null}
              style={{background:C.card,border:`1px solid ${sub?C.green:C.border}`,borderRadius:12,padding:16,cursor:sub?"pointer":"default"}}>
              <div style={{fontWeight:800,color:C.text,fontSize:14,marginBottom:2}}>{emp.name}</div>
              <div style={{color:C.muted,fontSize:12,marginBottom:10}}>{emp.empNo||<span style={{color:C.amber}}>No Emp# yet</span>}</div>
              {sub?<>
                <Badge color="green">Submitted</Badge>
                <div style={{marginTop:10,fontSize:12,display:"flex",gap:10}}>
                  <span>REG <strong style={{color:C.text}}>{reg.toFixed(1)}</strong></span>
                  <span>OT <strong style={{color:C.amber}}>{ot.toFixed(1)}</strong></span>
                  <span>DT <strong style={{color:C.red}}>{dt.toFixed(1)}</strong></span>
                </div>
              </>:<Badge color="amber">Pending</Badge>}
            </div>
          );
        })}
      </div>

      {/* Detail panel */}
      {selected&&(()=>{
        const emp=employees.find(e=>e.id===selected);
        const wd=data[emp.id][weekKey];
        const empProjects=projects.filter(p=>emp.projects?.includes(p.id));
        return(
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,marginBottom:24,padding:24}}>
            <h3 style={{margin:"0 0 16px",color:C.text}}>{emp.name} — {emp.empNo} — Detailed View</h3>
            {DAYS.map((day,i)=>{
              const d=wd[day]; if(!d) return null;
              const hasHours=d.entries?.some(e=>(parseFloat(e.reg)||0)+(parseFloat(e.ot)||0)+(parseFloat(e.dt)||0)>0);
              if(!hasHours&&!d.report) return null;
              return(
                <div key={day} style={{borderBottom:`1px solid ${C.border}`,paddingBottom:14,marginBottom:14}}>
                  <div style={{fontWeight:700,color:C.accent,fontSize:13,marginBottom:8}}>{day} · {dateOfDay(weekStart,i)}</div>
                  {empProjects.map(proj=>{
                    const entry=d.entries?.find(e=>e.projectId===proj.id);
                    const reg=parseFloat(entry?.reg)||0; const ot=parseFloat(entry?.ot)||0; const dt=parseFloat(entry?.dt)||0;
                    if(!reg&&!ot&&!dt) return null;
                    return(
                      <div key={proj.id} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:C.text,padding:"3px 0"}}>
                        <span style={{color:C.accent}}>{proj.projectNum} <span style={{color:C.muted}}>{proj.taskNum}</span></span>
                        <span>REG <strong>{reg}</strong> · OT <strong style={{color:C.amber}}>{ot}</strong> · DT <strong style={{color:C.red}}>{dt}</strong></span>
                      </div>
                    );
                  })}
                  {d.notes&&<p style={{color:C.muted,fontSize:12,margin:"6px 0 0"}}>📝 {d.notes}</p>}
                  {d.report&&<div style={{background:C.surface,borderRadius:8,padding:"10px 12px",marginTop:8,fontSize:13,color:C.text,borderLeft:`3px solid ${C.accent}`}}><span style={{color:C.accent,fontSize:11,fontWeight:700}}>DAILY REPORT · </span>{d.report}</div>}
                </div>
              );
            })}
          </div>
        );
      })()}

      {submitted.length>0&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24}}>
          <h3 style={{margin:"0 0 16px",color:C.text,fontSize:16}}>Export & Send</h3>
          <p style={{color:C.muted,fontSize:12,marginBottom:16}}>Exports match your company timesheet format with one tab per employee (REG/OT/DT), plus a separate Daily Report file.</p>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <Btn variant="amber" onClick={()=>handleExport(false)} disabled={sending}>{sending?"Exporting…":"📧 Send to My Email for Review"}</Btn>
            <Btn variant="green" onClick={()=>handleExport(true)} disabled={sending}>{sending?"Exporting…":"✓ Approve & Send to Payroll"}</Btn>
          </div>
          {status&&<div style={{marginTop:14,padding:"12px 16px",borderRadius:8,background:status.startsWith("⚠")?C.amberDim:C.greenDim,color:status.startsWith("⚠")?C.amber:C.green,fontSize:13}}>{status}</div>}
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const stored = load();
  const [settings,setSettings]   = useState(stored.settings   || {company:"Beard Integrated",supervisor:"Daniel Hancock",managerEmail:"",payrollEmail:""});
  const [employees,setEmployees] = useState(stored.employees  || DEFAULT_EMPLOYEES);
  const [projects,setProjects]   = useState(stored.projects   || DEFAULT_PROJECTS);
  const [timesheetData,setTD]    = useState(stored.timesheetData || {});
  const [reminderPrefs,setRP]    = useState(stored.reminderPrefs || {});
  const [view,setView]           = useState("manager");
  const weekStart = WEEK_START;
  const weekKey   = weekStart.toISOString().slice(0,10);

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
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'DM Sans',system-ui,sans-serif",color:C.text}}>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 24px",position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:60}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:32,height:32,background:`linear-gradient(135deg,${C.accent},${C.green})`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>⏱</div>
            <div><span style={{fontWeight:900,fontSize:16,color:C.text}}>{settings.company}</span><span style={{color:C.muted,fontSize:12,marginLeft:8}}>Timesheet Platform</span></div>
          </div>
        </div>
      </div>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 24px"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",gap:0,overflowX:"auto"}}>
          {navTabs.map(tab=>(
            <button key={tab.id} onClick={()=>setView(tab.id)}
              style={{background:"none",border:"none",borderBottom:`3px solid ${view===tab.id?(tab.id==="admin"?C.purple:C.accent):"transparent"}`,
                color:view===tab.id?(tab.id==="admin"?C.purple:C.accent):C.muted,cursor:"pointer",fontFamily:"inherit",
                fontWeight:700,fontSize:13,padding:"14px 18px",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:7}}>
              {tab.label}{tab.badge&&<Badge color="green">{tab.badge}</Badge>}
            </button>
          ))}
        </div>
      </div>
      <div style={{padding:"32px 24px",maxWidth:1100,margin:"0 auto"}}>
        {view==="manager" && <ManagerView employees={employees} weekStart={weekStart} data={timesheetData} settings={settings} projects={projects} onApprove={handleApprove}/>}
        {view==="admin"   && <AdminConsole employees={employees} setEmployees={setEmployees} projects={projects} setProjects={setProjects} settings={settings} setSettings={setSettings}/>}
        {employees.find(e=>e.id===view) && <EmployeeView employee={employees.find(e=>e.id===view)} weekStart={weekStart} data={timesheetData} onSave={saveEntry} reminderPrefs={reminderPrefs} onSaveReminder={saveReminder} projects={projects}/>}
      </div>
    </div>
  );
}
