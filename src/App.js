import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

// ── Beard Brand ───────────────────────────────────────────────────────────────
const C = {
  bg:"#1a1010",surface:"#241818",card:"#2e1e1e",border:"#3a2525",
  accent:"#c0392b",accentDim:"#3d0f0a",accentHover:"#e74c3c",
  green:"#2dd4a0",greenDim:"#0d3d2e",amber:"#f5a623",amberDim:"#3d2800",
  red:"#e74c3c",redDim:"#3d1010",text:"#f0ece8",muted:"#8a7f7a",white:"#ffffff",
  purple:"#a78bfa",purpleDim:"#2e1f5e",gold:"#c9a84c",goldDim:"#3d2e10",
};

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DEFAULT_LOCATIONS = ["Office","Jobsite","Remote","Shop","Other"];
const PTO_ACCRUAL_RATE = 1.54 / 40; // 1.54 hrs PTO per 40 hrs worked

function calcPTOAccrued(regHours) {
  return Math.round(regHours * PTO_ACCRUAL_RATE * 100) / 100;
}

function weekStart() {
  const d=new Date(); const day=d.getDay();
  const diff=day===0?-6:1-day;
  d.setDate(d.getDate()+diff); d.setHours(0,0,0,0); return d;
}
function weekLabel(s) {
  const e=new Date(s); e.setDate(e.getDate()+6);
  const f=d=>d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
  return `${f(s)} – ${f(e)}, ${e.getFullYear()}`;
}
function dateOfDay(ws,i) { const d=new Date(ws); d.setDate(d.getDate()+i); return d.toLocaleDateString("en-US",{month:"short",day:"numeric"}); }
function excelDate(ws,i) { const d=new Date(ws); d.setDate(d.getDate()+i); return d.toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"numeric"}); }
function uid() { return Math.random().toString(36).slice(2,9); }
function todayName() { return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()]; }
function isWeekday() { const d=new Date().getDay(); return d>=1&&d<=5; }
function fmt12(t) { const [h,m]=t.split(":").map(Number); const ap=h>=12?"PM":"AM"; const hh=h%12||12; return `${hh}:${String(m).padStart(2,"0")} ${ap}`; }
function toDateStr(d) { return d.toISOString().slice(0,10); }

const WS = weekStart();
const WEEK_KEY = toDateStr(WS);

// ── BIM Slideshow ─────────────────────────────────────────────────────────────
const BIM_IMAGES=["/bim-bg.png","/bim-bg-2.png","/bim-bg-3.png","/bim-bg-4.png","/bim-bg-5.png","/bim-bg-6.png","/bim-bg-7.png"];
const FADE_MS=2000, HOLD_MS=7000;

function BeardCanvas() {
  const [current,setCurrent]=useState(()=>Math.floor(Math.random()*BIM_IMAGES.length));
  const [next,setNext]=useState(null);
  const [fading,setFading]=useState(false);
  useEffect(()=>{
    const iv=setInterval(()=>{
      const n=(current+1)%BIM_IMAGES.length;
      setNext(n); setFading(true);
      setTimeout(()=>{ setCurrent(n); setNext(null); setFading(false); },FADE_MS);
    },HOLD_MS);
    return ()=>clearInterval(iv);
  },[current]);

  // Diagonal stripe pattern — alternates within each row AND between rows
  const items=[];
  const stripeSpacingY=80, angleOffset=0.4;
  const canvasW=1600, canvasH=1100;
  let stripeIdx=0;
  for(let y=-100;y<canvasH+100;y+=stripeSpacingY){
    const rowIsBeardFirst=stripeIdx%2===0;
    const depth=stripeIdx%3;
    let itemIdx=0;
    for(let x=-200;x<canvasW+200;x+=220){
      const isBeard=rowIsBeardFirst?itemIdx%2===0:itemIdx%2!==0;
      const opacity=isBeard?[0.22,0.15,0.19][depth]:[0.13,0.08,0.11][depth];
      const size=isBeard?[12,10,11][depth]:[10,9,10][depth];
      const px=x+(y*angleOffset);
      items.push({text:isBeard?'BEARD \u201CONE\u201D':'1% BETTER EVERY DAY',opacity,size,px,py:y,isBeard});
      itemIdx++;
    }
    stripeIdx++;
  }

  const imgBase={position:"absolute",inset:0,backgroundSize:"cover",backgroundPosition:"center",filter:"grayscale(60%) sepia(30%)",transition:`opacity ${FADE_MS}ms ease-in-out`};
  return(
    <div style={{position:"fixed",inset:0,zIndex:0,overflow:"hidden",pointerEvents:"none"}}>
      {BIM_IMAGES.map((src,idx)=>{
        const iC=idx===current,iN=idx===next;
        const op=iC?(fading?0:.18):iN?(fading?.18:0):0;
        return <div key={src} style={{...imgBase,backgroundImage:`url('${src}')`,opacity:op}}/>;
      })}
      <div style={{position:"absolute",inset:0,background:"rgba(30,8,8,0.55)"}}/>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at center,transparent 30%,rgba(80,10,5,0.25) 100%)"}}/>
      <div style={{position:"absolute",inset:0,overflow:"hidden"}}>
        {items.map((item,i)=>(
          <span key={i} style={{
            position:"absolute", left:item.px, top:item.py,
            color:item.isBeard?`rgba(220,80,60,${item.opacity})`:`rgba(240,220,210,${item.opacity})`,
            fontSize:item.size, fontWeight:900, letterSpacing:2,
            textTransform:"uppercase", whiteSpace:"nowrap", userSelect:"none",
          }}>
            {item.text}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── UI Primitives ─────────────────────────────────────────────────────────────
function Badge({color,children}) {
  const map={green:[C.greenDim,C.green],amber:[C.amberDim,C.amber],red:[C.redDim,C.red],purple:[C.purpleDim,C.purple],accent:[C.accentDim,C.accent],gold:[C.goldDim,C.gold]};
  const [bg,fg]=map[color]||[C.accentDim,C.accent];
  return <span style={{background:bg,color:fg,borderRadius:6,padding:"2px 10px",fontSize:11,fontWeight:700,letterSpacing:.5,whiteSpace:"nowrap"}}>{children}</span>;
}
function Btn({children,onClick,variant="primary",small,disabled,style={}}) {
  const base={border:"none",borderRadius:8,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",fontWeight:700,letterSpacing:.3,transition:"opacity .15s",opacity:disabled?.45:1,padding:small?"6px 14px":"10px 22px",fontSize:small?12:13,...style};
  const v={primary:{background:C.accent,color:C.white},green:{background:C.green,color:"#05150f"},danger:{background:C.red,color:C.white},ghost:{background:"transparent",color:C.muted,border:`1px solid ${C.border}`},amber:{background:C.amber,color:"#1a0d00"},purple:{background:C.purple,color:"#0d0820"},gold:{background:C.gold,color:"#1a0d00"}};
  return <button style={{...base,...v[variant]}} onClick={onClick} disabled={disabled} onMouseEnter={e=>{if(!disabled)e.currentTarget.style.opacity=".8";}} onMouseLeave={e=>{e.currentTarget.style.opacity=disabled?".45":"1";}}>{children}</button>;
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
function Card({children,style={}}) {
  return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,...style}}>{children}</div>;
}
function SectionHead({children}) {
  return <div style={{color:C.accent,fontWeight:700,fontSize:13,marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
    <div style={{width:3,height:16,background:C.accent,borderRadius:2}}/>{children}
  </div>;
}

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({onLogin}) {
  const [mode,setMode]=useState("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [showPw,setShowPw]=useState(false);
  const [name,setName]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const [success,setSuccess]=useState("");

  const handleLogin=async()=>{
    setLoading(true); setError("");
    const {data,error:e}=await supabase.auth.signInWithPassword({email,password});
    if(e){
      if(e.message?.includes("fetch")||e.message?.includes("network")){
        setError("Connection error — please check your internet and try again.");
      } else {
        setError(e.message);
      }
      setLoading(false);return;
    }
    onLogin(data.user);
    setLoading(false);
  };

  const handleSignup=async()=>{
    if(!name.trim()){setError("Please enter your name.");return;}
    setLoading(true); setError("");
    const {data,error:e}=await supabase.auth.signUp({email,password,options:{data:{name}}});
    if(e){setError(e.message);setLoading(false);return;}
    // Create profile
    if(data.user){
      await supabase.from("profiles").upsert({id:data.user.id,name:name.trim(),email,role:"employee",is_manager:false});
    }
    setSuccess("Account created! You can now sign in.");
    setMode("login");
    setLoading(false);
  };

  const handleForgot=async()=>{
    if(!email){setError("Enter your email first.");return;}
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email,{redirectTo:"https://timesheet-app-snowy.vercel.app"});
    setSuccess("Password reset email sent!");
    setLoading(false);
  };

  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',system-ui,sans-serif",position:"relative"}}>
      <BeardCanvas/>
      <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:420,padding:"0 20px"}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:60,height:60,borderRadius:16,background:"linear-gradient(135deg,#8b0000,#c0392b)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",boxShadow:"0 0 24px rgba(192,57,43,0.4)"}}>
            <span style={{fontWeight:900,fontSize:24,color:C.white}}>B</span>
          </div>
          <div style={{display:"flex",alignItems:"baseline",gap:8,justifyContent:"center"}}>
            <span style={{fontWeight:900,fontSize:22,color:C.white,letterSpacing:2}}>BEARD</span>
            <span style={{fontWeight:900,fontSize:22,color:C.accent,letterSpacing:2}}>&ldquo;ONE&rdquo;</span>
          </div>
          <div style={{color:C.muted,fontSize:11,letterSpacing:3,textTransform:"uppercase",marginTop:4}}>VDC Department · Timesheet Platform</div>
        </div>

        <Card style={{padding:28}}>
          <h2 style={{margin:"0 0 20px",color:C.text,fontSize:18,fontWeight:800,textAlign:"center"}}>
            {mode==="login"?"Sign In":mode==="signup"?"Create Account":"Reset Password"}
          </h2>

          {error&&<div style={{background:C.redDim,border:`1px solid ${C.red}`,borderRadius:8,padding:"10px 14px",color:C.red,fontSize:13,marginBottom:16}}>{error}</div>}
          {success&&<div style={{background:C.greenDim,border:`1px solid ${C.green}`,borderRadius:8,padding:"10px 14px",color:C.green,fontSize:13,marginBottom:16}}>{success}</div>}

          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {mode==="signup"&&(
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>FULL NAME</label>
              <Input value={name} onChange={setName} placeholder="Your full name"/></div>
            )}
            <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>EMAIL</label>
            <Input value={email} onChange={setEmail} placeholder="you@beardintegrated.com" type="email"/></div>
            {mode!=="forgot"&&(
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>PASSWORD</label>
              <div style={{position:"relative"}}>
                <input type={showPw?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"
                  style={{background:"#0f0f0f",border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontFamily:"inherit",fontSize:13,padding:"8px 40px 8px 12px",outline:"none",width:"100%",boxSizing:"border-box"}}
                  onFocus={e=>{e.target.style.borderColor=C.accent;}} onBlur={e=>{e.target.style.borderColor=C.border;}}/>
                <button onClick={()=>setShowPw(v=>!v)} type="button"
                  style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:16,padding:"0 2px",lineHeight:1}}>
                  {showPw?"Hide":"Show"}
                </button>
              </div></div>
            )}
          </div>

          <div style={{marginTop:20}}>
            {mode==="login"&&<Btn variant="primary" style={{width:"100%"}} onClick={handleLogin} disabled={loading}>{loading?"Signing in…":"Sign In"}</Btn>}
            {mode==="signup"&&<Btn variant="primary" style={{width:"100%"}} onClick={handleSignup} disabled={loading}>{loading?"Creating…":"Create Account"}</Btn>}
            {mode==="forgot"&&<Btn variant="amber" style={{width:"100%"}} onClick={handleForgot} disabled={loading}>{loading?"Sending…":"Send Reset Email"}</Btn>}
          </div>

          <div style={{textAlign:"center",marginTop:16,display:"flex",flexDirection:"column",gap:8}}>
            {mode==="login"&&<>
              <button onClick={()=>{setMode("signup");setError("");setSuccess("");}} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>Don't have an account? Sign up</button>
              <button onClick={()=>{setMode("forgot");setError("");setSuccess("");}} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Forgot password?</button>
            </>}
            {mode!=="login"&&<button onClick={()=>{setMode("login");setError("");setSuccess("");}} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>← Back to sign in</button>}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── PTO Request Modal ─────────────────────────────────────────────────────────
function PTOModal({profile,onClose,onSubmit}) {
  const [type,setType]=useState("PTO");
  const [startDate,setStartDate]=useState("");
  const [endDate,setEndDate]=useState("");
  const [hours,setHours]=useState("");
  const [reason,setReason]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const handleSubmit=async()=>{
    if(!startDate||!endDate){setError("Please select start and end dates.");return;}
    setLoading(true);
    const {error:e}=await supabase.from("pto_requests").insert({
      employee_id:profile.id, request_type:type,
      start_date:startDate, end_date:endDate,
      hours:parseFloat(hours)||null, reason, status:"pending"
    });
    if(e){setError(e.message);setLoading(false);return;}
    onSubmit();
    onClose();
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <Card style={{padding:28,width:"100%",maxWidth:440}}>
        <h3 style={{margin:"0 0 20px",color:C.text,fontSize:16,fontWeight:800}}>📅 Request Time Off</h3>
        {error&&<div style={{background:C.redDim,color:C.red,borderRadius:8,padding:"10px 14px",fontSize:13,marginBottom:14}}>{error}</div>}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>TYPE</label>
            <Select value={type} onChange={setType} style={{width:"100%"}}>
              <option value="PTO">PTO (Paid Time Off)</option>
              <option value="Unpaid">Unpaid Time Off</option>
              <option value="Sick">Sick Leave</option>
              <option value="Holiday">Holiday</option>
              <option value="Jury Duty">Jury Duty</option>
              <option value="Leave of Absence">Leave of Absence</option>
            </Select>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>START DATE</label><Input value={startDate} onChange={setStartDate} type="date"/></div>
            <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>END DATE</label><Input value={endDate} onChange={setEndDate} type="date"/></div>
          </div>
          <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>HOURS (optional)</label><Input value={hours} onChange={setHours} type="number" placeholder="e.g. 8"/></div>
          <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:6}}>REASON (optional)</label><Textarea value={reason} onChange={setReason} placeholder="Brief description..." rows={2}/></div>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20}}>
          <Btn variant="ghost" small onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" small onClick={handleSubmit} disabled={loading}>{loading?"Submitting…":"Submit Request"}</Btn>
        </div>
      </Card>
    </div>
  );
}

// ── Employee Timesheet View ───────────────────────────────────────────────────
function EmployeeView({profile,projects,settings}) {
  const [days,setDays]=useState(()=>DAYS.map((n,i)=>({name:n,date:dateOfDay(WS,i),entries:{},notes:"",report:"",location:""})));
  const [submitted,setSubmitted]=useState(false);
  const [savedMsg,setSavedMsg]=useState(false);
  const [loading,setLoading]=useState(true);
  const [timesheetId,setTimesheetId]=useState(null);
  const [showPTO,setShowPTO]=useState(false);
  const [myPTO,setMyPTO]=useState([]);
  const [showReminderPanel,setShowReminderPanel]=useState(false);
  const [extraReminder,setExtraReminder]=useState("");
  const locations=settings?.locations||DEFAULT_LOCATIONS;
  const empProjects=projects.filter(p=>p.assigned);

  useEffect(()=>{ loadTimesheet(); loadMyPTO(); },[]);

  const loadTimesheet=async()=>{
    setLoading(true);
    const weekEnd=new Date(WS); weekEnd.setDate(weekEnd.getDate()+6);
    const {data:ts}=await supabase.from("timesheets").select("*").eq("employee_id",profile.id).eq("week_start",WEEK_KEY).single();
    if(ts){
      setTimesheetId(ts.id);
      setSubmitted(ts.status==="submitted"||ts.status==="approved");
      const {data:entries}=await supabase.from("timesheet_entries").select("*").eq("timesheet_id",ts.id);
      const {data:reports}=await supabase.from("daily_reports").select("*").eq("timesheet_id",ts.id);
      setDays(prev=>prev.map((d,i)=>{
        const dayEntries={};
        (entries||[]).filter(e=>e.day_name===d.name).forEach(e=>{ dayEntries[e.project_id]={reg:e.reg_hours||"",ot:e.ot_hours||"",dt:e.dt_hours||""}; });
        const rep=(reports||[]).find(r=>r.day_name===d.name);
        return{...d,entries:dayEntries,notes:rep?.notes||"",report:rep?.report_text||"",location:rep?.location||profile.default_location||""};
      }));
    }
    setLoading(false);
  };

  const loadMyPTO=async()=>{
    const {data}=await supabase.from("pto_requests").select("*").eq("employee_id",profile.id).order("created_at",{ascending:false}).limit(10);
    setMyPTO(data||[]);
  };

  const updateEntry=(dayIdx,projId,field,val)=>{
    setDays(p=>p.map((d,i)=>i===dayIdx?{...d,entries:{...d.entries,[projId]:{...(d.entries[projId]||{}), [field]:val}}}:d));
    setSavedMsg(false);
  };
  const updateDay=(i,field,val)=>{setDays(p=>p.map((d,idx)=>idx===i?{...d,[field]:val}:d));setSavedMsg(false);};

  const grandReg=days.reduce((s,d)=>s+empProjects.reduce((ss,p)=>ss+(parseFloat(d.entries[p.id]?.reg)||0),0),0);
  const grandOT=days.reduce((s,d)=>s+empProjects.reduce((ss,p)=>ss+(parseFloat(d.entries[p.id]?.ot)||0),0),0);
  const grandDT=days.reduce((s,d)=>s+empProjects.reduce((ss,p)=>ss+(parseFloat(d.entries[p.id]?.dt)||0),0),0);
  const grandTotal=grandReg+grandOT+grandDT;
  // Calculate PTO balance: total accrued from all approved timesheets minus used hours
  const weekAccrued = calcPTOAccrued(grandReg);
  const ptoUsedHours = myPTO.filter(r=>r.status==="approved"&&r.hours).reduce((s,r)=>s+(parseFloat(r.hours)||0),0);

  const handleSave=async(submit=false)=>{
    const weekEnd=new Date(WS); weekEnd.setDate(weekEnd.getDate()+6);
    let tsId=timesheetId;
    if(!tsId){
      const {data:ts,error:e}=await supabase.from("timesheets").upsert({
        employee_id:profile.id, week_start:WEEK_KEY,
        week_end:toDateStr(weekEnd), status:submit?"submitted":"draft",
        submitted_at:submit?new Date().toISOString():null
      },{onConflict:"employee_id,week_start"}).select().single();
      if(e){alert("Save error: "+e.message);return;}
      tsId=ts.id; setTimesheetId(tsId);
    } else if(submit){
      await supabase.from("timesheets").update({status:"submitted",submitted_at:new Date().toISOString()}).eq("id",tsId);
    }
    // Save entries
    for(const day of days){
      for(const proj of empProjects){
        const entry=day.entries[proj.id]||{};
        const reg=parseFloat(entry.reg)||0, ot=parseFloat(entry.ot)||0, dt=parseFloat(entry.dt)||0;
        if(reg||ot||dt){
          await supabase.from("timesheet_entries").upsert({
            timesheet_id:tsId, project_id:proj.id, day_name:day.name,
            reg_hours:reg, ot_hours:ot, dt_hours:dt
          },{onConflict:"timesheet_id,project_id,day_name"});
        }
      }
      if(day.notes||day.report||day.location){
        await supabase.from("daily_reports").upsert({
          timesheet_id:tsId, day_name:day.name,
          report_text:day.report, notes:day.notes, location:day.location
        },{onConflict:"timesheet_id,day_name"});
      }
    }
    setSavedMsg(true);
    if(submit) setSubmitted(true);
  };

  const timeOptions=[];
  for(let h=7;h<=19;h++) ["00","30"].forEach(m=>{ const v=`${String(h).padStart(2,"0")}:${m}`; if(v!=="13:00") timeOptions.push(v); });

  if(loading) return <div style={{textAlign:"center",padding:60,color:C.muted}}>Loading your timesheet…</div>;

  return(
    <div style={{maxWidth:1000,margin:"0 auto",position:"relative",zIndex:1}}>
      {showPTO&&<PTOModal profile={profile} onClose={()=>setShowPTO(false)} onSubmit={loadMyPTO}/>}

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{margin:0,color:C.text,fontSize:22,fontWeight:900}}>{profile.name}</h2>
          <p style={{margin:"4px 0 0",color:C.muted,fontSize:13}}>{weekLabel(WS)} · <span style={{color:C.gold}}>#{profile.emp_no||"No Emp# yet"}</span></p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          {submitted?<Badge color="green">✓ Submitted</Badge>:savedMsg?<Badge color="amber">Saved</Badge>:null}
          <div style={{background:C.accentDim,borderRadius:8,padding:"8px 14px",fontWeight:800,fontSize:12,color:C.accent,border:`1px solid ${C.accent}33`}}>
            REG {grandReg.toFixed(1)} · OT {grandOT.toFixed(1)} · DT {grandDT.toFixed(1)} · <span style={{color:C.green}}>Total {grandTotal.toFixed(1)}</span>
          </div>
          <Btn variant="ghost" small onClick={()=>setShowPTO(true)}>📅 Request Time Off</Btn>
          <Btn variant="ghost" small onClick={()=>setShowReminderPanel(r=>!r)}>🔔 Reminders</Btn>
        </div>
      </div>

      {showReminderPanel&&(
        <Card style={{padding:18,marginBottom:20}}>
          <div style={{fontWeight:800,color:C.text,fontSize:14,marginBottom:14}}>🔔 Reminder Settings</div>
          <div style={{background:"#0f0f0f",borderRadius:10,padding:"12px 16px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",border:`1px solid ${C.border}`}}>
            <div><div style={{fontWeight:700,color:C.text,fontSize:13}}>Default Reminder</div><div style={{color:C.muted,fontSize:12}}>Every weekday at 1:00 PM</div></div>
            <Badge color="green">Always On</Badge>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <Select value={extraReminder} onChange={setExtraReminder} style={{flex:1}}>
              <option value="">— No extra reminder —</option>
              {timeOptions.map(t=><option key={t} value={t}>{fmt12(t)}</option>)}
            </Select>
            <span style={{color:C.muted,fontSize:12}}>Additional reminder</span>
          </div>
        </Card>
      )}

      {/* PTO Balance */}
      <Card style={{padding:16,marginBottom:20,border:`1px solid ${C.goldDim}`}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontWeight:800,color:C.gold,fontSize:14,marginBottom:2}}>📊 PTO Balance</div>
            <div style={{color:C.muted,fontSize:12}}>Accrual rate: 1.54 hrs per 40 hrs worked</div>
          </div>
          <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
            <div style={{textAlign:"center"}}>
              <div style={{color:C.gold,fontWeight:900,fontSize:18}}>{weekAccrued.toFixed(2)}</div>
              <div style={{color:C.muted,fontSize:11}}>Accruing this week</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{color:C.amber,fontWeight:900,fontSize:18}}>{ptoUsedHours.toFixed(1)}</div>
              <div style={{color:C.muted,fontSize:11}}>Used (approved)</div>
            </div>
          </div>
        </div>
      </Card>

      {/* PTO history */}
      {myPTO.length>0&&(
        <Card style={{padding:16,marginBottom:20}}>
          <div style={{fontWeight:700,color:C.text,fontSize:13,marginBottom:12}}>My Time Off Requests</div>
          {myPTO.map(req=>(
            <div key={req.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}`,fontSize:13}}>
              <div>
                <span style={{color:C.gold,fontWeight:700}}>{req.request_type}</span>
                <span style={{color:C.muted,marginLeft:10}}>{req.start_date} → {req.end_date}</span>
                {req.reason&&<span style={{color:C.muted,marginLeft:8,fontSize:12}}>· {req.reason}</span>}
              </div>
              <Badge color={req.status==="approved"?"green":req.status==="rejected"?"red":"amber"}>
                {req.status.charAt(0).toUpperCase()+req.status.slice(1)}
              </Badge>
            </div>
          ))}
        </Card>
      )}

      {days.map((day,i)=>{
        const isToday=day.name===todayName();
        const dReg=empProjects.reduce((s,p)=>s+(parseFloat(day.entries[p.id]?.reg)||0),0);
        const dOT=empProjects.reduce((s,p)=>s+(parseFloat(day.entries[p.id]?.ot)||0),0);
        const dDT=empProjects.reduce((s,p)=>s+(parseFloat(day.entries[p.id]?.dt)||0),0);
        return(
          <Card key={day.name} style={{marginBottom:14,overflow:"hidden",border:`1px solid ${isToday?C.accent:C.border}`,boxShadow:isToday?`0 0 0 1px ${C.accent}22`:"none"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 18px",borderBottom:`1px solid ${C.border}`,background:isToday?`linear-gradient(90deg,${C.accentDim},${C.surface})`:C.surface}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontWeight:900,color:isToday?C.accent:C.text,fontSize:14}}>{day.name}</span>
                <span style={{color:C.muted,fontSize:12}}>{day.date}</span>
                {isToday&&<Badge color="accent">Today</Badge>}
              </div>
              <div style={{display:"flex",gap:12,fontSize:12,color:C.muted}}>
                <span>REG <strong style={{color:C.text}}>{dReg.toFixed(1)}</strong></span>
                <span>OT <strong style={{color:dOT>0?C.amber:C.text}}>{dOT.toFixed(1)}</strong></span>
                <span>DT <strong style={{color:dDT>0?C.red:C.text}}>{dDT.toFixed(1)}</strong></span>
                <span style={{color:C.green,fontWeight:800}}>{(dReg+dOT+dDT).toFixed(1)} hrs</span>
              </div>
            </div>
            <div style={{padding:18}}>
              {/* Location */}
              <div style={{marginBottom:14}}>
                <label style={{color:C.muted,fontSize:11,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",display:"block",marginBottom:8}}>📍 Location</label>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {locations.map(loc=>(
                    <button key={loc} onClick={()=>!submitted&&updateDay(i,"location",day.location===loc?"":loc)}
                      style={{background:day.location===loc?C.accentDim:"#0f0f0f",border:`1px solid ${day.location===loc?C.accent:C.border}`,borderRadius:8,color:day.location===loc?C.accent:C.muted,cursor:submitted?"default":"pointer",fontFamily:"inherit",fontSize:12,padding:"5px 12px"}}>
                      {loc}
                    </button>
                  ))}
                  {!submitted&&<Input value={locations.includes(day.location)?"":(day.location||"")} onChange={v=>updateDay(i,"location",v)} placeholder="Custom…" style={{width:130,fontSize:12,padding:"5px 10px"}}/>}
                </div>
              </div>

              {/* Hours grid */}
              <div style={{marginBottom:14}}>
                <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:8,marginBottom:6}}>
                  <div style={{color:C.muted,fontSize:11,fontWeight:700,letterSpacing:.8}}>PROJECT / TASK</div>
                  <div style={{color:C.muted,fontSize:11,fontWeight:700,letterSpacing:.8,textAlign:"center"}}>REG</div>
                  <div style={{color:C.amber,fontSize:11,fontWeight:700,letterSpacing:.8,textAlign:"center"}}>OT</div>
                  <div style={{color:C.red,fontSize:11,fontWeight:700,letterSpacing:.8,textAlign:"center"}}>DT</div>
                </div>
                {empProjects.map(proj=>{
                  const entry=day.entries[proj.id]||{reg:"",ot:"",dt:""};
                  return(
                    <div key={proj.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:8,marginBottom:8,alignItems:"center"}}>
                      <div style={{background:"#0f0f0f",borderRadius:8,padding:"8px 12px",border:`1px solid ${C.border}`}}>
                        <span style={{color:C.gold,fontWeight:700,fontSize:13}}>{proj.project_name||proj.project_num}</span>
                        <span style={{color:C.accent,fontSize:11,marginLeft:8}}>{proj.project_num}</span>
                        <span style={{color:C.muted,fontSize:11,marginLeft:6}}>{proj.task_num}</span>
                      </div>
                      <Input value={entry.reg||""} onChange={v=>updateEntry(i,proj.id,"reg",v)} placeholder="0" type="number" disabled={submitted} style={{textAlign:"center"}}/>
                      <Input value={entry.ot||""} onChange={v=>updateEntry(i,proj.id,"ot",v)} placeholder="0" type="number" disabled={submitted} style={{textAlign:"center",borderColor:entry.ot?C.amber:C.border}}/>
                      <Input value={entry.dt||""} onChange={v=>updateEntry(i,proj.id,"dt",v)} placeholder="0" type="number" disabled={submitted} style={{textAlign:"center",borderColor:entry.dt?C.red:C.border}}/>
                    </div>
                  );
                })}
              </div>
              <div style={{marginBottom:12}}>
                <label style={{color:C.muted,fontSize:11,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",display:"block",marginBottom:6}}>Notes</label>
                <Textarea value={day.notes} onChange={v=>updateDay(i,"notes",v)} placeholder="Overtime reason, absence codes…" rows={2} disabled={submitted}/>
              </div>
              <div>
                <label style={{color:C.muted,fontSize:11,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",display:"block",marginBottom:6}}>Daily Report <span style={{color:C.accent,fontSize:10}}>→ Daily Report spreadsheet</span></label>
                <Textarea value={day.report} onChange={v=>updateDay(i,"report",v)} placeholder="What did you accomplish today? Blockers, milestones, updates?" rows={3} disabled={submitted}/>
              </div>
            </div>
          </Card>
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
function ManagerView({employees,projects,settings}) {
  const [selected,setSelected]=useState(null);
  const [detail,setDetail]=useState(null);
  const [ptoRequests,setPtoRequests]=useState([]);
  const [status,setStatus]=useState("");
  const [rejectNote,setRejectNote]=useState("");
  const [showReject,setShowReject]=useState(null);
  const [timesheets,setTimesheets]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{ loadData(); },[]);

  const loadData=async()=>{
    setLoading(true);
    const {data:ts}=await supabase.from("timesheets").select("*,profiles(name,emp_no)").eq("week_start",WEEK_KEY);
    const {data:pto}=await supabase.from("pto_requests").select("*,profiles(name)").eq("status","pending").order("created_at",{ascending:false});
    setTimesheets(ts||[]); setPtoRequests(pto||[]);
    setLoading(false);
  };

  const loadDetail=async(empId,tsId)=>{
    const {data:entries}=await supabase.from("timesheet_entries").select("*").eq("timesheet_id",tsId);
    const {data:reports}=await supabase.from("daily_reports").select("*").eq("timesheet_id",tsId);
    setDetail({empId,tsId,entries:entries||[],reports:reports||[]});
    setSelected(empId);
  };

  const handleApprove=async(tsId)=>{
    await supabase.from("timesheets").update({status:"approved",approved_at:new Date().toISOString()}).eq("id",tsId);
    setStatus("✓ Timesheet approved!"); loadData();
    exportTimesheets();
  };

  const handleReject=async(tsId)=>{
    await supabase.from("timesheets").update({status:"rejected",rejected_at:new Date().toISOString(),rejection_note:rejectNote}).eq("id",tsId);
    setShowReject(null); setRejectNote(""); setStatus("Timesheet sent back to employee."); loadData();
  };

  const handlePTO=async(id,approved)=>{
    await supabase.from("pto_requests").update({status:approved?"approved":"rejected",reviewed_at:new Date().toISOString()}).eq("id",id);
    loadData();
  };

  const exportTimesheets=()=>{
    const submitted=timesheets.filter(t=>t.status==="submitted"||t.status==="approved");
    if(!submitted.length){setStatus("No submitted timesheets to export.");return;}
    let csv="";
    submitted.forEach((ts,ei)=>{
      if(ei>0)csv+="\n\n";
      const emp=employees.find(e=>e.id===ts.employee_id)||ts.profiles||{};
      const weekEnd=new Date(WS); weekEnd.setDate(weekEnd.getDate()+6);
      csv+=`=== ${(emp.name||"").toUpperCase()} ===\n`;
      csv+=`EMPLOYEE NO.,${emp.emp_no||"PENDING"},,,,,,,,EMPLOYEE NAME,${emp.name||""}\n`;
      csv+=`WEEK/PERIOD ENDING,${weekEnd.toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"numeric"})},,,,,,,,SUPERVISOR,${settings?.supervisor||"Daniel Hancock"}\n\n`;
      csv+=`PROJECT #,TASK #,EXPENSE TYPE,PROJECT DESCRIPTION,`;
      DAYS.forEach(d=>{csv+=`${d.toUpperCase()} REG,${d.toUpperCase()} OT,${d.toUpperCase()} DT,`;});
      csv+=`TOTAL REG,TOTAL OT,TOTAL DT\n`;
      csv+=`,,,,`;
      DAYS.forEach((_,i)=>{csv+=`${excelDate(WS,i)},,,`;});
      csv+=`,,\n`;
      let gR=0,gO=0,gD=0;
      projects.forEach(proj=>{
        let rR=0,rO=0,rD=0;
        csv+=`${proj.project_num},${proj.task_num},${proj.expense_type||""},"${proj.project_name||""}",`;
        DAYS.forEach(day=>{
          const e=detail?.entries?.find(e=>e.project_id===proj.id&&e.day_name===day);
          const r=parseFloat(e?.reg_hours)||0,o=parseFloat(e?.ot_hours)||0,d=parseFloat(e?.dt_hours)||0;
          csv+=`${r||""},${o||""},${d||""},`;
          rR+=r;rO+=o;rD+=d;
        });
        gR+=rR;gO+=rO;gD+=rD;
        csv+=`${rR},${rO},${rD}\n`;
      });
      csv+=`,,TOTALS,,`;
      DAYS.forEach(()=>{csv+=`,,,`;});
      csv+=`${gR},${gO},${gD}\n`;
    });
    const blob=new Blob([csv],{type:"text/csv"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=`BIS_Timesheets_${WEEK_KEY}.csv`;a.click();
    URL.revokeObjectURL(url);
  };

  if(loading) return <div style={{textAlign:"center",padding:60,color:C.muted}}>Loading…</div>;

  const submitted=timesheets.filter(t=>t.status==="submitted"||t.status==="approved");
  const pending=employees.filter(e=>!timesheets.find(t=>t.employee_id===e.id&&(t.status==="submitted"||t.status==="approved")));

  return(
    <div style={{maxWidth:960,margin:"0 auto",position:"relative",zIndex:1}}>
      {showReject&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Card style={{padding:24,width:"100%",maxWidth:400}}>
            <h3 style={{margin:"0 0 14px",color:C.text}}>Reject Timesheet</h3>
            <Textarea value={rejectNote} onChange={setRejectNote} placeholder="Reason for rejection (employee will see this)…" rows={3}/>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:14}}>
              <Btn variant="ghost" small onClick={()=>setShowReject(null)}>Cancel</Btn>
              <Btn variant="danger" small onClick={()=>handleReject(showReject)}>Send Back</Btn>
            </div>
          </Card>
        </div>
      )}

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{margin:0,color:C.text,fontSize:22,fontWeight:900}}>Manager Review</h2>
          <p style={{margin:"4px 0 0",color:C.muted,fontSize:13}}>{weekLabel(WS)}</p>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Badge color={submitted.length>0?"green":"amber"}>{submitted.length}/{employees.length} submitted</Badge>
          {pending.length>0&&<Badge color="red">⚠ {pending.length} not submitted</Badge>}
        </div>
      </div>

      {/* PTO Requests */}
      {ptoRequests.length>0&&(
        <Card style={{padding:20,marginBottom:24}}>
          <SectionHead>📅 Pending Time Off Requests</SectionHead>
          {ptoRequests.map(req=>(
            <div key={req.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${C.border}`,gap:12,flexWrap:"wrap"}}>
              <div>
                <span style={{color:C.text,fontWeight:700}}>{req.profiles?.name}</span>
                <span style={{color:C.gold,marginLeft:10,fontSize:13}}>{req.request_type}</span>
                <span style={{color:C.muted,marginLeft:10,fontSize:13}}>{req.start_date} → {req.end_date}</span>
                {req.reason&&<span style={{color:C.muted,marginLeft:8,fontSize:12}}>· {req.reason}</span>}
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn variant="green" small onClick={()=>handlePTO(req.id,true)}>✓ Approve</Btn>
                <Btn variant="danger" small onClick={()=>handlePTO(req.id,false)}>✕ Deny</Btn>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Employee cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:24}}>
        {employees.map(emp=>{
          const ts=timesheets.find(t=>t.employee_id===emp.id);
          const sub=ts&&(ts.status==="submitted"||ts.status==="approved");
          return(
            <Card key={emp.id} style={{padding:16,cursor:sub?"pointer":"default",border:`1px solid ${sub?C.accent:C.border}`}}
              onClick={()=>sub&&(selected===emp.id?(setSelected(null),setDetail(null)):loadDetail(emp.id,ts.id))}>
              <div style={{fontWeight:900,color:C.text,fontSize:14,marginBottom:2}}>{emp.name}</div>
              <div style={{color:C.gold,fontSize:12,marginBottom:10}}>{emp.emp_no||"No Emp# yet"}</div>
              {sub?<>
                <Badge color={ts.status==="approved"?"green":"accent"}>{ts.status==="approved"?"✓ Approved":"Submitted"}</Badge>
                {ts.status==="submitted"&&(
                  <div style={{display:"flex",gap:8,marginTop:10}}>
                    <Btn variant="green" small onClick={e=>{e.stopPropagation();handleApprove(ts.id);}}>Approve</Btn>
                    <Btn variant="danger" small onClick={e=>{e.stopPropagation();setShowReject(ts.id);}}>Reject</Btn>
                  </div>
                )}
              </>:<Badge color="amber">Pending</Badge>}
            </Card>
          );
        })}
      </div>

      {/* Detail panel */}
      {selected&&detail&&(()=>{
        const emp=employees.find(e=>e.id===selected);
        const ts=timesheets.find(t=>t.employee_id===selected);
        return(
          <Card style={{marginBottom:24,padding:24}}>
            <h3 style={{margin:"0 0 16px",color:C.text,fontWeight:900}}>{emp?.name} <span style={{color:C.gold,fontWeight:400,fontSize:14}}>#{emp?.emp_no}</span></h3>
            {DAYS.map(day=>{
              const dayEntries=detail.entries.filter(e=>e.day_name===day);
              const rep=detail.reports.find(r=>r.day_name===day);
              const hasHours=dayEntries.some(e=>e.reg_hours||e.ot_hours||e.dt_hours);
              if(!hasHours&&!rep?.report_text) return null;
              return(
                <div key={day} style={{borderBottom:`1px solid ${C.border}`,paddingBottom:12,marginBottom:12}}>
                  <div style={{fontWeight:700,color:C.accent,fontSize:13,marginBottom:6}}>
                    {day}{rep?.location&&<span style={{color:C.gold,marginLeft:10,fontSize:12}}>📍{rep.location}</span>}
                  </div>
                  {dayEntries.filter(e=>e.reg_hours||e.ot_hours||e.dt_hours).map(e=>{
                    const proj=projects.find(p=>p.id===e.project_id);
                    return(
                      <div key={e.id} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:C.text,padding:"2px 0"}}>
                        <span style={{color:C.gold}}>{proj?.project_name||proj?.project_num} <span style={{color:C.muted,fontSize:11}}>{proj?.task_num}</span></span>
                        <span>REG <strong>{e.reg_hours}</strong> · OT <strong style={{color:C.amber}}>{e.ot_hours}</strong> · DT <strong style={{color:C.red}}>{e.dt_hours}</strong></span>
                      </div>
                    );
                  })}
                  {rep?.notes&&<p style={{color:C.muted,fontSize:12,margin:"6px 0 0"}}>📝 {rep.notes}</p>}
                  {rep?.report_text&&<div style={{background:"#0f0f0f",borderRadius:8,padding:"10px 12px",marginTop:8,fontSize:13,color:C.text,borderLeft:`3px solid ${C.accent}`}}><span style={{color:C.accent,fontSize:11,fontWeight:700}}>DAILY REPORT · </span>{rep.report_text}</div>}
                </div>
              );
            })}
          </Card>
        );
      })()}

      {/* Export panel */}
      {submitted.length>0&&(
        <Card style={{padding:24}}>
          <h3 style={{margin:"0 0 8px",color:C.text,fontSize:16,fontWeight:900}}>Export & Send</h3>
          <p style={{color:C.muted,fontSize:12,marginBottom:16}}>Exports timesheet in your company format with PROJECT DESCRIPTION column.</p>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <Btn variant="primary" onClick={exportTimesheets}>↓ Export Timesheets CSV</Btn>
          </div>
          {status&&<div style={{marginTop:14,padding:"12px 16px",borderRadius:8,background:C.greenDim,color:C.green,fontSize:13}}>{status}</div>}
        </Card>
      )}
    </div>
  );
}

// ── Admin Console ─────────────────────────────────────────────────────────────
function AdminConsole({employees,setEmployees,projects,setProjects,settings,setSettings,currentUser}) {
  const [tab,setTab]=useState("team");
  const [saved,setSaved]=useState("");
  const [newEmpEmail,setNewEmpEmail]=useState("");
  const [newEmpName,setNewEmpName]=useState("");
  const [newEmpNo,setNewEmpNo]=useState("");
  const [newEmpRole,setNewEmpRole]=useState("");
  const [newProj,setNewProj]=useState({project_num:"",task_num:"",expense_type:"",ocip:"",project_name:""});
  const [editEmp,setEditEmp]=useState(null);
  const [editProj,setEditProj]=useState(null);
  const [settingsForm,setSettingsForm]=useState({...settings,locations:(settings?.locations||DEFAULT_LOCATIONS)});
  const [newLocation,setNewLocation]=useState("");
  const [ptoAll,setPtoAll]=useState([]);

  useEffect(()=>{ if(tab==="pto") loadPTO(); },[tab]);

  const loadPTO=async()=>{
    const {data}=await supabase.from("pto_requests").select("*,profiles(name)").order("created_at",{ascending:false}).limit(50);
    setPtoAll(data||[]);
  };

  const flash=msg=>{setSaved(msg);setTimeout(()=>setSaved(""),2500);};

  const inviteEmployee=async()=>{
    if(!newEmpEmail.trim()||!newEmpName.trim()) return;
    // Create user in Supabase auth via admin (we'll upsert profile; they sign up themselves)
    // For now, create profile record — they'll link when they sign up with same email
    const {data:existing}=await supabase.from("profiles").select("id").eq("email",newEmpEmail).single();
    if(!existing){
      await supabase.from("profiles").insert({id:uid(),name:newEmpName.trim(),emp_no:newEmpNo.trim(),role:newEmpRole.trim()||"employee",is_manager:false,email:newEmpEmail.trim()});
    }
    setNewEmpEmail("");setNewEmpName("");setNewEmpNo("");setNewEmpRole("");
    flash("Employee added! They can sign up with that email.");
    const {data}=await supabase.from("profiles").select("*");
    setEmployees(data||[]);
  };

  const removeEmployee=async id=>{
    if(!window.confirm("Remove this employee?")) return;
    await supabase.from("profiles").delete().eq("id",id);
    setEmployees(p=>p.filter(e=>e.id!==id));
    flash("Employee removed.");
  };

  const saveEmpEdit=async()=>{
    await supabase.from("profiles").update({name:editEmp.name,emp_no:editEmp.emp_no,role:editEmp.role,is_manager:editEmp.is_manager,default_location:editEmp.default_location||null}).eq("id",editEmp.id);
    setEmployees(p=>p.map(e=>e.id===editEmp.id?editEmp:e));
    setEditEmp(null); flash("Employee updated!");
  };

  const toggleEmpProject=async(empId,projId,assigned)=>{
    if(assigned){
      await supabase.from("employee_projects").delete().eq("employee_id",empId).eq("project_id",projId);
    } else {
      await supabase.from("employee_projects").insert({employee_id:empId,project_id:projId});
    }
    const {data}=await supabase.from("projects").select("*,employee_projects(employee_id)");
    setProjects((data||[]).map(p=>({...p,assigned:p.employee_projects?.some(ep=>ep.employee_id===currentUser?.id)})));
  };

  const addProject=async()=>{
    if(!newProj.project_num.trim()) return;
    const {data}=await supabase.from("projects").insert(newProj).select().single();
    if(data){ setProjects(p=>[...p,{...data,assigned:true}]); setNewProj({project_num:"",task_num:"",expense_type:"",ocip:"",project_name:""}); flash("Project added!"); }
  };

  const removeProject=async id=>{
    if(!window.confirm("Remove this project?")) return;
    await supabase.from("projects").delete().eq("id",id);
    setProjects(p=>p.filter(x=>x.id!==id)); flash("Project removed.");
  };

  const saveProjEdit=async()=>{
    await supabase.from("projects").update(editProj).eq("id",editProj.id);
    setProjects(p=>p.map(x=>x.id===editProj.id?{...x,...editProj}:x));
    setEditProj(null); flash("Project updated!");
  };

  const saveSettings=async()=>{
    const pairs=Object.entries(settingsForm).filter(([k])=>k!=="locations");
    for(const [key,value] of pairs){
      await supabase.from("app_settings").upsert({key,value:String(value)},{onConflict:"key"});
    }
    setSettings(settingsForm); flash("Settings saved!");
  };

  const addLocation=()=>{
    if(!newLocation.trim()) return;
    const locs=settingsForm.locations||DEFAULT_LOCATIONS;
    if(!locs.includes(newLocation.trim())) setSettingsForm(p=>({...p,locations:[...locs,newLocation.trim()]}));
    setNewLocation("");
  };
  const removeLocation=loc=>setSettingsForm(p=>({...p,locations:(p.locations||[]).filter(l=>l!==loc)}));

  const tabs=[{id:"team",label:"👥 Team"},{id:"projects",label:"📋 Projects"},{id:"locations",label:"📍 Locations"},{id:"pto",label:"📅 PTO History"},{id:"settings",label:"⚙ Settings"}];

  return(
    <div style={{maxWidth:960,margin:"0 auto",position:"relative",zIndex:1}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <div style={{width:40,height:40,background:`linear-gradient(135deg,${C.accent},${C.gold})`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🔧</div>
        <div><h2 style={{margin:0,color:C.text,fontSize:22,fontWeight:900}}>Admin Console</h2><p style={{margin:0,color:C.muted,fontSize:13}}>Manage team, projects, locations & settings</p></div>
        {saved&&<Badge color="green">✓ {saved}</Badge>}
      </div>
      <div style={{display:"flex",gap:0,borderBottom:`1px solid ${C.border}`,marginBottom:24}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",borderBottom:`3px solid ${tab===t.id?C.accent:"transparent"}`,color:tab===t.id?C.accent:C.muted,cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:13,padding:"12px 16px",transition:"color .15s"}}>{t.label}</button>
        ))}
      </div>

      {/* TEAM */}
      {tab==="team"&&(
        <div>
          {employees.map(emp=>(
            <Card key={emp.id} style={{marginBottom:10,overflow:"hidden"}}>
              {editEmp?.id===emp.id?(
                <div style={{padding:18}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
                    <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>NAME</label><Input value={editEmp.name||""} onChange={v=>setEditEmp(p=>({...p,name:v}))}/></div>
                    <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>EMPLOYEE NO.</label><Input value={editEmp.emp_no||""} onChange={v=>setEditEmp(p=>({...p,emp_no:v}))}/></div>
                    <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>ROLE</label><Input value={editEmp.role||""} onChange={v=>setEditEmp(p=>({...p,role:v}))}/></div>
                  </div>
                  <div style={{marginBottom:12}}>
                    <label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:8}}>ASSIGNED PROJECTS</label>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                      {projects.map(proj=>{
                        const assigned=proj.employee_projects?.some(ep=>ep.employee_id===emp.id);
                        return <button key={proj.id} onClick={()=>toggleEmpProject(emp.id,proj.id,assigned)}
                          style={{background:assigned?C.accentDim:"#0f0f0f",border:`1px solid ${assigned?C.accent:C.border}`,borderRadius:8,color:assigned?C.accent:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:12,padding:"5px 12px"}}>
                          {assigned?"✓ ":""}{proj.project_name||proj.project_num}
                        </button>;
                      })}
                    </div>
                  </div>
                  <div style={{marginBottom:12}}>
                    <label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:8}}>DEFAULT LOCATION</label>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                      {(settingsForm.locations||DEFAULT_LOCATIONS).map(loc=>{
                        const selected=(editEmp.default_location||"")=== loc;
                        return <button key={loc} onClick={()=>setEditEmp(p=>({...p,default_location:selected?"":loc}))}
                          style={{background:selected?C.goldDim:"#0f0f0f",border:`1px solid ${selected?C.gold:C.border}`,borderRadius:8,color:selected?C.gold:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:12,padding:"5px 12px"}}>
                          {selected?"📍 ":""}{loc}
                        </button>;
                      })}
                    </div>
                    <p style={{color:C.muted,fontSize:11,marginTop:6}}>Sets the pre-filled location on this employee's timesheet each day.</p>
                  </div>
                  <label style={{display:"flex",alignItems:"center",gap:8,color:C.muted,fontSize:13,cursor:"pointer",marginBottom:12}}>
                    <input type="checkbox" checked={!!editEmp.is_manager} onChange={e=>setEditEmp(p=>({...p,is_manager:e.target.checked}))} style={{width:16,height:16}}/>
                    Manager access (can see all timesheets & approve)
                  </label>
                  <div style={{display:"flex",gap:10}}><Btn variant="green" small onClick={saveEmpEdit}>Save</Btn><Btn variant="ghost" small onClick={()=>setEditEmp(null)}>Cancel</Btn></div>
                </div>
              ):(
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",flexWrap:"wrap",gap:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:38,height:38,background:C.accentDim,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,color:C.accent,fontSize:13}}>{(emp.name||"?").split(" ").map(x=>x[0]).join("").slice(0,2)}</div>
                    <div>
                      <div style={{fontWeight:800,color:C.text,fontSize:14}}>{emp.name}</div>
                      <div style={{color:C.muted,fontSize:12}}>{emp.role} · <span style={{color:emp.emp_no?C.gold:C.amber}}>{emp.emp_no||"No Emp# yet"}</span>{emp.is_manager&&<span style={{color:C.purple,marginLeft:8,fontSize:11}}>● Manager</span>}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8}}><Btn variant="ghost" small onClick={()=>setEditEmp({...emp})}>✏ Edit</Btn><Btn variant="danger" small onClick={()=>removeEmployee(emp.id)}>Remove</Btn></div>
                </div>
              )}
            </Card>
          ))}
          <Card style={{padding:20,marginTop:8,border:`2px dashed ${C.border}`}}>
            <SectionHead>Add Team Member</SectionHead>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:12}}>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>FULL NAME *</label><Input value={newEmpName} onChange={setNewEmpName} placeholder="First Last"/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>EMAIL *</label><Input value={newEmpEmail} onChange={setNewEmpEmail} placeholder="email@company.com" type="email"/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>EMPLOYEE NO.</label><Input value={newEmpNo} onChange={setNewEmpNo} placeholder="e.g. HAN4127"/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>ROLE</label><Input value={newEmpRole} onChange={setNewEmpRole} placeholder="Team Member"/></div>
            </div>
            <Btn variant="primary" onClick={inviteEmployee} disabled={!newEmpName.trim()||!newEmpEmail.trim()}>+ Add Team Member</Btn>
          </Card>
        </div>
      )}

      {/* PROJECTS */}
      {tab==="projects"&&(
        <div>
          {projects.map(proj=>(
            <Card key={proj.id} style={{marginBottom:10,overflow:"hidden"}}>
              {editProj?.id===proj.id?(
                <div style={{padding:16}}>
                  <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",gap:10,marginBottom:12}}>
                    <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>PROJECT NAME</label><Input value={editProj.project_name||""} onChange={v=>setEditProj(p=>({...p,project_name:v}))}/></div>
                    <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>PROJECT #</label><Input value={editProj.project_num||""} onChange={v=>setEditProj(p=>({...p,project_num:v}))}/></div>
                    <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>TASK #</label><Input value={editProj.task_num||""} onChange={v=>setEditProj(p=>({...p,task_num:v}))}/></div>
                    <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>EXPENSE TYPE</label><Input value={editProj.expense_type||""} onChange={v=>setEditProj(p=>({...p,expense_type:v}))}/></div>
                    <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>OCIP</label><Input value={editProj.ocip||""} onChange={v=>setEditProj(p=>({...p,ocip:v}))}/></div>
                  </div>
                  <div style={{display:"flex",gap:10}}><Btn variant="green" small onClick={saveProjEdit}>Save</Btn><Btn variant="ghost" small onClick={()=>setEditProj(null)}>Cancel</Btn></div>
                </div>
              ):(
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",flexWrap:"wrap",gap:10}}>
                  <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
                    {proj.project_name&&<span style={{color:C.gold,fontWeight:800}}>{proj.project_name}</span>}
                    <span style={{color:C.accent,fontWeight:700}}>{proj.project_num}</span>
                    <span style={{color:C.muted,fontSize:12}}>Task: <strong style={{color:C.text}}>{proj.task_num}</strong></span>
                    {proj.expense_type&&<span style={{color:C.muted,fontSize:12}}>Exp: <strong style={{color:C.text}}>{proj.expense_type}</strong></span>}
                  </div>
                  <div style={{display:"flex",gap:8}}><Btn variant="ghost" small onClick={()=>setEditProj({...proj})}>✏ Edit</Btn><Btn variant="danger" small onClick={()=>removeProject(proj.id)}>Remove</Btn></div>
                </div>
              )}
            </Card>
          ))}
          <Card style={{padding:20,marginTop:8,border:`2px dashed ${C.border}`}}>
            <SectionHead>Add New Project Code</SectionHead>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",gap:10,marginBottom:12}}>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>PROJECT NAME</label><Input value={newProj.project_name} onChange={v=>setNewProj(p=>({...p,project_name:v}))} placeholder="e.g. Q-Cells Ingot"/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>PROJECT # *</label><Input value={newProj.project_num} onChange={v=>setNewProj(p=>({...p,project_num:v}))} placeholder="10-11-6010"/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>TASK #</label><Input value={newProj.task_num} onChange={v=>setNewProj(p=>({...p,task_num:v}))} placeholder="OH"/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>EXPENSE TYPE</label><Input value={newProj.expense_type} onChange={v=>setNewProj(p=>({...p,expense_type:v}))} placeholder="486"/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>OCIP</label><Input value={newProj.ocip} onChange={v=>setNewProj(p=>({...p,ocip:v}))} placeholder="sm1 cusw"/></div>
            </div>
            <Btn variant="primary" onClick={addProject} disabled={!newProj.project_num.trim()}>+ Add Project</Btn>
          </Card>
        </div>
      )}

      {/* LOCATIONS */}
      {tab==="locations"&&(
        <div style={{maxWidth:500}}>
          <Card style={{padding:20,marginBottom:16}}>
            <SectionHead>Location List</SectionHead>
            {(settingsForm.locations||DEFAULT_LOCATIONS).map(loc=>(
              <div key={loc} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"#0f0f0f",borderRadius:8,marginBottom:8,border:`1px solid ${C.border}`}}>
                <span style={{color:C.text,fontWeight:600}}>📍 {loc}</span>
                <Btn variant="danger" small onClick={()=>removeLocation(loc)}>Remove</Btn>
              </div>
            ))}
            <div style={{display:"flex",gap:10,marginTop:14}}>
              <Input value={newLocation} onChange={setNewLocation} placeholder="Add new location…" style={{flex:1}}/>
              <Btn variant="primary" onClick={addLocation} disabled={!newLocation.trim()}>Add</Btn>
            </div>
          </Card>
          <Btn variant="gold" onClick={saveSettings}>Save Locations</Btn>
        </div>
      )}

      {/* PTO HISTORY */}
      {tab==="pto"&&(
        <div>
          {/* Accrual summary per employee */}
          <Card style={{padding:20,marginBottom:16}}>
            <SectionHead>PTO Accrual Summary</SectionHead>
            <div style={{background:"#0f0f0f",borderRadius:8,padding:"10px 14px",marginBottom:14,border:`1px solid ${C.border}`}}>
              <span style={{color:C.muted,fontSize:12}}>Accrual rate: </span>
              <span style={{color:C.gold,fontWeight:700}}>1.54 hrs PTO per 40 hrs worked</span>
              <span style={{color:C.muted,fontSize:12,marginLeft:16}}>({(1.54/40*100).toFixed(4)}% of REG hours)</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
              {employees.map(emp=>{
                const used=ptoAll.filter(r=>r.employee_id===emp.id&&r.status==="approved"&&r.hours).reduce((s,r)=>s+(parseFloat(r.hours)||0),0);
                const pending=ptoAll.filter(r=>r.employee_id===emp.id&&r.status==="pending"&&r.hours).reduce((s,r)=>s+(parseFloat(r.hours)||0),0);
                return(
                  <div key={emp.id} style={{background:"#0f0f0f",borderRadius:10,padding:"14px 16px",border:`1px solid ${C.border}`}}>
                    <div style={{fontWeight:800,color:C.text,fontSize:13,marginBottom:8}}>{emp.name}</div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                      <span style={{color:C.muted}}>Used (approved)</span>
                      <span style={{color:C.amber,fontWeight:700}}>{used.toFixed(1)} hrs</span>
                    </div>
                    {pending>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                      <span style={{color:C.muted}}>Pending requests</span>
                      <span style={{color:C.gold,fontWeight:700}}>{pending.toFixed(1)} hrs</span>
                    </div>}
                  </div>
                );
              })}
            </div>
          </Card>
          <Card style={{padding:20}}>
            <SectionHead>All Time Off Requests</SectionHead>
            {ptoAll.length===0&&<p style={{color:C.muted,fontSize:13}}>No requests yet.</p>}
            {ptoAll.map(req=>(
              <div key={req.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${C.border}`,gap:12,flexWrap:"wrap",fontSize:13}}>
                <div>
                  <span style={{color:C.text,fontWeight:700}}>{req.profiles?.name}</span>
                  <span style={{color:C.gold,marginLeft:10}}>{req.request_type}</span>
                  <span style={{color:C.muted,marginLeft:10}}>{req.start_date} → {req.end_date}</span>
                  {req.hours&&<span style={{color:C.muted,marginLeft:8,fontSize:12}}>· {req.hours} hrs</span>}
                  {req.reason&&<span style={{color:C.muted,marginLeft:8,fontSize:12}}>· {req.reason}</span>}
                </div>
                <Badge color={req.status==="approved"?"green":req.status==="rejected"?"red":"amber"}>
                  {req.status.charAt(0).toUpperCase()+req.status.slice(1)}
                </Badge>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* SETTINGS */}
      {tab==="settings"&&(
        <div style={{maxWidth:560}}>
          <Card style={{padding:24}}>
            <SectionHead>Platform Settings</SectionHead>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>COMPANY NAME</label><Input value={settingsForm.company||""} onChange={v=>setSettingsForm(p=>({...p,company:v}))}/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>SUPERVISOR NAME</label><Input value={settingsForm.supervisor||""} onChange={v=>setSettingsForm(p=>({...p,supervisor:v}))}/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>MANAGER EMAIL</label><Input value={settingsForm.manager_email||""} onChange={v=>setSettingsForm(p=>({...p,manager_email:v}))}/></div>
              <div><label style={{color:C.muted,fontSize:11,fontWeight:700,display:"block",marginBottom:5}}>PAYROLL EMAIL</label><Input value={settingsForm.payroll_email||""} onChange={v=>setSettingsForm(p=>({...p,payroll_email:v}))}/></div>
            </div>
            <div style={{marginTop:20}}><Btn variant="primary" onClick={saveSettings}>Save Settings</Btn></div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [employees,setEmployees]=useState([]);
  const [projects,setProjects]=useState([]);
  const [settings,setSettings]=useState({});
  const [loading,setLoading]=useState(true);
  const [view,setView]=useState("timesheet");
  const [appError,setAppError]=useState(null);

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{ if(session?.user) handleLogin(session.user); else setLoading(false); });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>{ if(session?.user) handleLogin(session.user); else { setUser(null); setProfile(null); setLoading(false); } });
    return ()=>subscription.unsubscribe();
  },[]);

  const handleLogin=async(u)=>{
    setUser(u);
    try {
      // Load or create profile
      let {data:prof}=await supabase.from("profiles").select("*").eq("id",u.id).single();
      if(!prof){
        const name=u.user_metadata?.name||u.email?.split("@")[0]||"User";
        const {data:newProf}=await supabase.from("profiles").insert({id:u.id,name,email:u.email,role:"employee",is_manager:false}).select().single();
        prof=newProf||{id:u.id,name:u.user_metadata?.name||"User",email:u.email,is_manager:false,role:"employee"};
      }
      setProfile(prof);
      // Load all data with error handling
      const [{data:emps},{data:projs},{data:setts}]=await Promise.all([
        supabase.from("profiles").select("*").order("name"),
        supabase.from("projects").select("*,employee_projects(employee_id)").order("project_num"),
        supabase.from("app_settings").select("*"),
      ]);
      setEmployees(emps||[]);
      setProjects((projs||[]).map(p=>({...p,assigned:p.employee_projects?.some(ep=>ep.employee_id===u.id)})));
      const settObj={locations:DEFAULT_LOCATIONS};
      (setts||[]).forEach(s=>{settObj[s.key]=s.value;});
      setSettings(settObj);
    } catch(err) {
      console.error("Login data load error:",err);
      setAppError(err?.message||"Unknown error loading app data. Please refresh and try again.");
    }
    setLoading(false);
  };

  const handleSignOut=async()=>{
    await supabase.auth.signOut();
    setUser(null); setProfile(null);
  };

  if(loading) return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <BeardCanvas/>
      <div style={{position:"relative",zIndex:1,textAlign:"center",color:C.muted}}>
        <div style={{width:48,height:48,borderRadius:12,background:"linear-gradient(135deg,#8b0000,#c0392b)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
          <span style={{fontWeight:900,fontSize:20,color:C.white}}>B</span>
        </div>
        Loading…
      </div>
    </div>
  );

  if(appError) return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',system-ui,sans-serif",padding:24}}>
      <BeardCanvas/>
      <div style={{position:"relative",zIndex:1,textAlign:"center",maxWidth:500}}>
        <div style={{background:C.redDim,border:`1px solid ${C.red}`,borderRadius:14,padding:28,marginBottom:20}}>
          <div style={{color:C.red,fontWeight:800,fontSize:16,marginBottom:10}}>⚠ App Error</div>
          <div style={{color:C.text,fontSize:13,lineHeight:1.6,marginBottom:16}}>{appError}</div>
          <div style={{background:"#0f0f0f",borderRadius:8,padding:"10px 14px",fontSize:11,color:C.muted,textAlign:"left",fontFamily:"monospace",wordBreak:"break-all"}}>{appError}</div>
        </div>
        <Btn variant="primary" onClick={()=>{setAppError(null);setLoading(false);setUser(null);setProfile(null);}}>← Back to Login</Btn>
      </div>
    </div>
  );

  if(!user||!profile) return <LoginScreen onLogin={handleLogin}/>;

  const isManager=profile.is_manager;
  const myProjects=projects.filter(p=>p.assigned||p.employee_projects?.some(ep=>ep.employee_id===profile.id));

  const navTabs=[
    {id:"timesheet",label:"⏱ My Timesheet"},
    ...(isManager?[{id:"manager",label:"📋 Manager Review"},{id:"admin",label:"🔧 Admin"}]:[]),
  ];

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'DM Sans',system-ui,sans-serif",color:C.text,position:"relative"}}>
      <BeardCanvas/>
      {/* Header */}
      <div style={{background:"rgba(26,16,16,0.96)",borderBottom:`1px solid ${C.border}`,padding:"0 24px",position:"sticky",top:0,zIndex:50,backdropFilter:"blur(10px)"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:64,position:"relative"}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:40,height:40,borderRadius:10,background:"linear-gradient(135deg,#8b0000,#c0392b)",display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid #c0392b44",boxShadow:"0 0 16px rgba(192,57,43,0.3)"}}>
              <span style={{fontWeight:900,fontSize:16,color:C.white}}>B</span>
            </div>
            <div>
              <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                <span style={{fontWeight:900,fontSize:17,color:C.white,letterSpacing:2,textTransform:"uppercase"}}>BEARD</span>
                <span style={{fontWeight:900,fontSize:17,color:C.accent,letterSpacing:2,textTransform:"uppercase"}}>&ldquo;ONE&rdquo;</span>
              </div>
              <div style={{color:C.muted,fontSize:10,letterSpacing:2,textTransform:"uppercase",marginTop:-1}}>1% better every day</div>
            </div>
          </div>
          <div style={{position:"absolute",left:"50%",transform:"translateX(-50%)",textAlign:"center"}}>
            <div style={{fontWeight:900,fontSize:13,color:C.text,letterSpacing:3,textTransform:"uppercase"}}>VDC Department</div>
            <div style={{color:C.accent,fontSize:9,letterSpacing:3,textTransform:"uppercase",marginTop:1}}>Timesheet Platform</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{textAlign:"right"}}>
              <div style={{color:C.text,fontSize:13,fontWeight:700}}>{profile.name}</div>
              <div style={{color:C.muted,fontSize:11}}>{isManager?"Manager":"Employee"}</div>
            </div>
            <Btn variant="ghost" small onClick={handleSignOut}>Sign Out</Btn>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{background:"rgba(26,16,16,0.92)",borderBottom:`1px solid ${C.border}`,padding:"0 24px",position:"sticky",top:64,zIndex:49,backdropFilter:"blur(10px)"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",gap:0,overflowX:"auto"}}>
          {navTabs.map(tab=>(
            <button key={tab.id} onClick={()=>setView(tab.id)}
              style={{background:"none",border:"none",borderBottom:`3px solid ${view===tab.id?C.accent:"transparent"}`,color:view===tab.id?C.accent:C.muted,cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:13,padding:"14px 18px",whiteSpace:"nowrap",letterSpacing:.3,transition:"color .15s"}}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{padding:"32px 24px",maxWidth:1100,margin:"0 auto"}}>
        {view==="timesheet"&&<EmployeeView profile={profile} projects={myProjects} settings={settings}/>}
        {view==="manager"&&isManager&&<ManagerView employees={employees} projects={projects} settings={settings}/>}
        {view==="admin"&&isManager&&<AdminConsole employees={employees} setEmployees={setEmployees} projects={projects} setProjects={setProjects} settings={settings} setSettings={setSettings} currentUser={profile}/>}
      </div>
    </div>
  );
}
