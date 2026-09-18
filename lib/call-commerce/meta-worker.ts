import 'server-only';
import crypto from 'crypto';
import { bigquery } from '@/lib/bigquery';
import { CALL_COMMERCE_DATASET,CALL_COMMERCE_LOCATION,CALL_COMMERCE_DEFAULTS } from './config';
import { ensureCallCommerceSchema } from './schema';
import { getIntegrationConnection } from '@/lib/integrations/store';
import { readIntegrationSecret } from '@/lib/integrations/secrets';

const PROJECT_ID=process.env.GCP_PROJECT_ID||process.env.BQ_PROJECT_ID||'';
const table=(name:string)=>`\`${PROJECT_ID}.${CALL_COMMERCE_DATASET}.${name}\``;
const sha=(v:string)=>crypto.createHash('sha256').update(v.trim().toLowerCase()).digest('hex');

export async function processMetaQueue(workspaceId:string,brandId:string){
  if(!PROJECT_ID)throw new Error('GCP project missing');
  await ensureCallCommerceSchema();
  const connection=await getIntegrationConnection(workspaceId,brandId,'meta_events');
  if(!connection||connection.status!=='connected'||!connection.secret_name||!connection.provider_account_id){
    return {processed:0,skipped:'META_EVENTS_NOT_CONNECTED'};
  }
  const secret=await readIntegrationSecret<{access_token:string}>(connection.secret_name);
  const token=String(secret?.access_token||'').trim();
  if(!token)throw new Error('META_EVENTS_ACCESS_TOKEN_MISSING');
  const [rows]=await bigquery.query({location:CALL_COMMERCE_LOCATION,query:`SELECT * FROM ${table('meta_event_queue')} WHERE workspace_id=@workspace_id AND brand_id=@brand_id AND status IN ('PENDING','RETRY') AND (next_attempt_at IS NULL OR next_attempt_at<=CURRENT_TIMESTAMP()) ORDER BY created_at ASC LIMIT 100`,params:{workspace_id:workspaceId,brand_id:brandId}});
  let processed=0;
  for(const row of rows as any[]){
    const payload=typeof row.payload==='string'?JSON.parse(row.payload):row.payload||{};
    const phone=String(payload.phone||'').replace(/\D/g,'');
    const email=String(payload.email||'').trim().toLowerCase();
    const eventTime=Math.floor(Date.now()/1000);
    const body:any={data:[{event_name:row.event_name,event_time:eventTime,event_id:row.event_id,action_source:'phone_call',user_data:{external_id:[sha(String(row.lead_id))],...(phone?{ph:[sha(phone)]}:{}),...(email?{em:[sha(email)]}:{})},custom_data:{...payload,lead_type:'call',source_module:'call_commerce'}}]};
    const url=`https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION||'v24.0'}/${encodeURIComponent(connection.provider_account_id)}/events?access_token=${encodeURIComponent(token)}`;
    let ok=false,status=0,responsePayload:any=null,errorMessage:string|null=null;
    try{
      const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
      status=response.status; const text=await response.text(); try{responsePayload=JSON.parse(text)}catch{responsePayload={raw:text.slice(0,2000)}}; ok=response.ok && !responsePayload?.error; if(!ok)errorMessage=responsePayload?.error?.message||`Meta HTTP ${status}`;
    }catch(error:any){errorMessage=error?.message||'Meta request failed';}
    await bigquery.query({location:CALL_COMMERCE_LOCATION,query:`INSERT INTO ${table('meta_event_log')} (log_id,workspace_id,brand_id,lead_id,call_id,event_key,event_name,event_id,request_payload,response_payload,success,http_status,error,sent_at) VALUES (@log_id,@workspace_id,@brand_id,@lead_id,@call_id,@event_key,@event_name,@event_id,PARSE_JSON(@request_payload),PARSE_JSON(@response_payload),@success,@http_status,@error,CURRENT_TIMESTAMP())`,params:{log_id:`mel_${crypto.randomUUID().replace(/-/g,'')}`,workspace_id:workspaceId,brand_id:brandId,lead_id:row.lead_id,call_id:row.call_id||null,event_key:row.event_key,event_name:row.event_name,event_id:row.event_id,request_payload:JSON.stringify(body),response_payload:JSON.stringify(responsePayload||{}),success:ok,http_status:status||null,error:errorMessage}});
    const attempts=Number(row.attempts||0)+1;
    const nextStatus=ok?'SUCCESS':attempts>=CALL_COMMERCE_DEFAULTS.metaMaxAttempts?'NEEDS_ATTENTION':'RETRY';
    await bigquery.query({location:CALL_COMMERCE_LOCATION,query:`UPDATE ${table('meta_event_queue')} SET status=@status,attempts=@attempts,last_error=@last_error,next_attempt_at=IF(@status='RETRY',TIMESTAMP_ADD(CURRENT_TIMESTAMP(),INTERVAL ${CALL_COMMERCE_DEFAULTS.metaRetryDelayMinutes} MINUTE),NULL),updated_at=CURRENT_TIMESTAMP() WHERE queue_id=@queue_id`,params:{status:nextStatus,attempts,last_error:errorMessage,queue_id:row.queue_id}});
    processed++;
  }
  return {processed};
}
