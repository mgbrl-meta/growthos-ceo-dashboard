'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, Trash2, Webhook } from 'lucide-react';

const canonicalFields = [
  'providerCallId','providerEventId','customerPhone','businessNumber','agentName','agentId','agentPhone',
  'startedAt','answeredAt','endedAt','updatedAt','durationSeconds','rawEventType','rawStatus','direction',
  'disconnectedBy','recordingUrl','reason','ivrInputs',
];

type CallingRuntimeStatus = 'not_connected' | 'testing' | 'active' | 'error';

export default function CallingIntegrationManager({ onStatusChange }: { onStatusChange?: (status: CallingRuntimeStatus) => void }) {
  const [data,setData]=useState<any>({connections:[],presets:[],latestTestEvent:null});
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [selectedId,setSelectedId]=useState('');
  const [platformName,setPlatformName]=useState('');
  const [connectionName,setConnectionName]=useState('Primary Calling');
  const [created,setCreated]=useState<any>(null);
  const [fieldMappings,setFieldMappings]=useState<any[]>([]);
  const [valueMappings,setValueMappings]=useState<any[]>([]);
  const [samplePayload,setSamplePayload]=useState('');
  const [sampleError,setSampleError]=useState('');

  const selected = useMemo(() => data.connections.find((x:any)=>x.connection_id===selectedId) || data.connections[0] || null,[data.connections,selectedId]);
  const detectedPreset = useMemo(() => {
    const name=platformName.trim().toLowerCase();
    if(!name) return null;
    return (data.presets||[]).find((p:any)=>String(p.key||'').toLowerCase()===name || String(p.name||'').toLowerCase()===name) || null;
  },[data.presets,platformName]);

  useEffect(()=>{
    const connections = data.connections || [];
    const status: CallingRuntimeStatus = connections.some((x:any)=>x.status==='active')
      ? 'active'
      : connections.some((x:any)=>x.status==='failed' || x.last_error)
        ? 'error'
        : connections.length
          ? 'testing'
          : 'not_connected';
    onStatusChange?.(status);
  },[data.connections,onStatusChange]);

  async function load(connectionId?:string){
    setLoading(true);
    const url=connectionId?`/api/integrations/calling?connectionId=${encodeURIComponent(connectionId)}`:'/api/integrations/calling';
    const r=await fetch(url,{cache:'no-store'}); const j=await r.json();
    if(j?.ok){ setData(j.data); if(!selectedId && j.data.connections?.[0]) setSelectedId(j.data.connections[0].connection_id); }
    setLoading(false);
  }
  useEffect(()=>{load();},[]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    setFieldMappings([]);
    setValueMappings([]);
    setSampleError('');
    if(selectedId) load(selectedId);
  },[selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function create(){
    const cleanPlatformName=platformName.trim();
    const cleanConnectionName=connectionName.trim();
    if(!cleanPlatformName){ alert('Enter the calling platform name.'); return; }
    if(!cleanConnectionName){ alert('Enter a connection name.'); return; }
    setBusy(true);
    const r=await fetch('/api/integrations/calling',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'create',platformName:cleanPlatformName,connectionName:cleanConnectionName})});
    const j=await r.json();
    if(j?.ok){ setCreated(j.data); setSelectedId(j.data.connectionId); await load(j.data.connectionId); }
    else alert(j?.error || 'Unable to create calling connection');
    setBusy(false);
  }

  useEffect(()=>{
    const evt=data.latestTestEvent;
    if(!evt) return;
    const discovered = typeof evt.discovered_fields === 'string' ? JSON.parse(evt.discovered_fields) : evt.discovered_fields || [];
    if(!fieldMappings.length){
      const presetFields = data.suggestedPreset?.fieldMappings || [];
      setFieldMappings(discovered.map((x:any)=>{
        const preset = presetFields.find((m:any)=>m.sourcePath===x.path);
        return {canonicalField:preset?.canonicalField||'',sourcePath:x.path,transform:preset?.transform||'',required:Boolean(preset?.required),example:x.example};
      }));
    }
    if(!valueMappings.length && Array.isArray(data.suggestedPreset?.valueMappings)) {
      setValueMappings(data.suggestedPreset.valueMappings);
    }
  },[data.latestTestEvent,data.suggestedPreset]); // eslint-disable-line react-hooks/exhaustive-deps

  async function captureSample(){
    if(!selected) return;
    setSampleError('');
    let payload:any;
    try { payload=JSON.parse(samplePayload); }
    catch { setSampleError('Paste a valid JSON object.'); return; }
    if(!payload || Array.isArray(payload) || typeof payload!=='object'){ setSampleError('Sample payload must be a JSON object.'); return; }

    setBusy(true);
    try {
      const r=await fetch('/api/integrations/calling',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'capture_test_payload',connectionId:selected.connection_id,payload}),
      });
      const j=await r.json();
      if(!j?.ok){ setSampleError(j?.error || 'Unable to capture sample event'); return; }
      setFieldMappings([]);
      setValueMappings([]);
      await load(selected.connection_id);
    } finally {
      setBusy(false);
    }
  }

  async function deleteConnection(){
    if(!selected) return;
    const ok=window.confirm(`Delete calling connection "${selected.connection_name}"? Historical call/audit data will be retained, but this webhook connection will stop accepting events.`);
    if(!ok) return;
    setBusy(true);
    try {
      const r=await fetch('/api/integrations/calling',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'delete',connectionId:selected.connection_id})});
      const j=await r.json();
      if(!j?.ok){ alert(j?.error || 'Unable to delete calling connection'); return; }
      setCreated(null);
      setSelectedId('');
      setFieldMappings([]);
      setValueMappings([]);
      setSamplePayload('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function activate(){
    if(!selected) return;
    const cleaned=fieldMappings.filter(x=>x.canonicalField && x.sourcePath).map(({example,...x})=>x);
    if(!cleaned.some(x=>x.canonicalField==='providerCallId') || !cleaned.some(x=>x.canonicalField==='customerPhone')){
      alert('Map at least Provider Call ID and Customer Phone.'); return;
    }
    setBusy(true);
    const r=await fetch('/api/integrations/calling',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'activate_mapping',connectionId:selected.connection_id,fieldMappings:cleaned,valueMappings})});
    const j=await r.json(); if(!j?.ok) alert(j?.error || 'Unable to activate mapping'); else await load(selected.connection_id); setBusy(false);
  }

  if(loading) return <div className="py-8 text-center text-[10px] text-slate-500"><RefreshCw className="mx-auto mb-2 animate-spin" size={16}/>Loading calling integration…</div>;

  return <div className="space-y-4">
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Generic calling connector</div>
      <p className="mt-1 text-[10px] leading-5 text-slate-600">Enter any calling platform name. If Growth OS recognizes it, a preset can suggest mappings; otherwise the same test-webhook and mapping flow works without a preset.</p>
    </div>

    <div className="grid gap-2 md:grid-cols-3">
      <div>
        <input value={platformName} onChange={e=>setPlatformName(e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[10px]" placeholder="Calling platform name, e.g. MSG91"/>
        <div className={`mt-1 text-[8px] ${detectedPreset?'text-emerald-600':'text-slate-400'}`}>{platformName.trim() ? (detectedPreset ? `${detectedPreset.name} preset detected — suggested mappings will be prepared.` : 'No preset required — test webhook mapping will be used.') : 'Any provider name is accepted.'}</div>
      </div>
      <input value={connectionName} onChange={e=>setConnectionName(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-[10px]" placeholder="Connection name"/>
      <button disabled={busy} onClick={create} className="h-9 rounded-lg bg-slate-950 px-3 text-[10px] font-semibold text-white">+ Add Calling Connection</button>
    </div>

    {(data.connections||[]).length>0 && <>
      <div className="flex flex-wrap gap-2">
        {(data.connections||[]).map((c:any)=><button key={c.connection_id} onClick={()=>setSelectedId(c.connection_id)} className={`rounded-lg border px-3 py-2 text-[10px] font-semibold ${selected?.connection_id===c.connection_id?'border-slate-950 bg-slate-950 text-white':'border-slate-200 bg-white text-slate-600'}`}>{c.connection_name} · {c.provider_key}</button>)}
      </div>

      {selected && <div className="space-y-3 rounded-lg border border-slate-200 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[11px] font-semibold text-slate-950">{selected.connection_name}</div>
              {selected.status==='active' ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700"><CheckCircle2 size={11}/>Active</span> : selected.last_error ? <span className="rounded-full bg-rose-50 px-2 py-1 text-[9px] font-semibold text-rose-700">Error</span> : <span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-semibold text-amber-700">Testing</span>}
            </div>
            <div className="mt-0.5 text-[9px] text-slate-500">Platform: {selected.provider_key}</div>
            {data.suggestedPreset&&<div className="mt-0.5 text-[8px] font-medium text-emerald-600">Preset recognized: {data.suggestedPreset.name}</div>}
          </div>
          <button disabled={busy} onClick={deleteConnection} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[9px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40"><Trash2 size={11}/>Delete Connection</button>
        </div>
        <div className="rounded-lg bg-slate-50 p-2.5"><div className="text-[9px] font-semibold uppercase text-slate-400">Webhook endpoint</div><div className="mt-1 break-all font-mono text-[9px] text-slate-700">{created?.connectionId===selected.connection_id?created.webhookUrl:(typeof window!=='undefined'?`${window.location.origin}/api/webhooks/calling/${selected.connection_id}`:'')}</div><div className="mt-2 text-[9px] text-slate-500">Preferred authentication: send header <code>x-growthos-webhook-secret</code>. The secret is returned only when the connection is created. Providers that cannot send custom headers can still use the supported query-token fallback during setup.</div></div>
        {created?.connectionId===selected.connection_id && <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[9px] text-amber-800"><b>Save this webhook secret now:</b><div className="mt-1 break-all font-mono">{created.webhookSecret}</div></div>}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-semibold text-slate-900">Test event & mapping</div><div className="text-[9px] text-slate-500">Use a live webhook event, or paste a sample JSON payload to configure mapping before the provider is publicly reachable.</div></div><button onClick={()=>load(selected.connection_id)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[9px] font-semibold"><RefreshCw size={11}/>Refresh Test</button></div>
          <div className="rounded-lg border border-slate-200 bg-white p-2.5">
            <div className="text-[9px] font-semibold text-slate-700">Paste sample provider JSON</div>
            <p className="mt-1 text-[8px] leading-4 text-slate-400">Useful during localhost setup. Paste one real webhook example from your calling platform; Growth OS will discover its fields exactly like a received test webhook.</p>
            <textarea value={samplePayload} onChange={e=>{setSamplePayload(e.target.value);setSampleError('');}} placeholder={'{\n  \"call_id\": \"example-123\",\n  \"phone\": \"919999999999\"\n}'} className="mt-2 min-h-28 w-full rounded-lg border border-slate-200 p-2 font-mono text-[9px]"/>
            {sampleError&&<div className="mt-1 text-[8px] font-medium text-rose-600">{sampleError}</div>}
            <button disabled={busy||!samplePayload.trim()} onClick={captureSample} className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[9px] font-semibold text-slate-700 disabled:opacity-40">Use Sample Event</button>
          </div>
        </div>

        {data.latestTestEvent ? <div className="space-y-2">
          <div className="overflow-hidden rounded-lg border border-slate-200"><div className="grid grid-cols-[1.2fr_1fr_1fr] bg-slate-50 px-2 py-1.5 text-[9px] font-semibold text-slate-500"><span>Provider field</span><span>Example</span><span>Growth OS field</span></div>{fieldMappings.map((m:any,i:number)=><div key={`${m.sourcePath}-${i}`} className="grid grid-cols-[1.2fr_1fr_1fr] items-center border-t border-slate-100 px-2 py-1.5 text-[9px]"><code className="truncate">{m.sourcePath}</code><span className="truncate text-slate-500">{String(m.example??'')}</span><select value={m.canonicalField} onChange={e=>setFieldMappings(x=>x.map((v,j)=>j===i?{...v,canonicalField:e.target.value}:v))} className="h-7 rounded border border-slate-200 bg-white px-1"><option value="">Ignore</option>{canonicalFields.map(f=><option key={f} value={f}>{f}</option>)}</select></div>)}</div>
          <div className="rounded-lg border border-slate-200 p-2.5"><div className="text-[9px] font-semibold text-slate-700">Status/value mappings</div><textarea value={JSON.stringify(valueMappings,null,2)} onChange={e=>{try{setValueMappings(JSON.parse(e.target.value))}catch{}}} placeholder='[{"mappingType":"CALL_STATUS","sourceValue":"answered","canonicalValue":"ANSWERED"}]' className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 p-2 font-mono text-[9px]"/><p className="mt-1 text-[8px] text-slate-400">Known presets can be edited here; custom providers can map event, status and direction values.</p></div>
          <button disabled={busy} onClick={activate} className="rounded-lg bg-violet-600 px-3 py-2 text-[10px] font-semibold text-white">Validate & Activate Mapping</button>
        </div> : <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-[9px] text-slate-500"><Webhook className="mx-auto mb-2" size={18}/>No test event captured yet.</div>}
      </div>}
    </>}
  </div>;
}
