import { NextRequest, NextResponse } from 'next/server';
import { resolveRequestTenantContext } from '@/lib/tenancy/request-context';
import { getIntegrationConnection, upsertIntegrationConnection } from '@/lib/integrations/store';
import { readIntegrationSecret, storeIntegrationSecret } from '@/lib/integrations/secrets';

export const dynamic='force-dynamic';
export const runtime='nodejs';

export async function GET(request:NextRequest){
  try{
    const {tenant}=await resolveRequestTenantContext(request);
    const connection=await getIntegrationConnection(tenant.workspaceId,tenant.brandId,'meta_events');
    if(!connection)return NextResponse.json({ok:true,data:{connected:false}});
    return NextResponse.json({ok:true,data:{connected:connection.status==='connected',datasetId:connection.provider_account_id||'',datasetName:connection.provider_account_name||'',connectionId:connection.connection_id}});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||'META_EVENTS_ERROR'},{status:500});}
}

export async function POST(request:NextRequest){
  try{
    const {tenant}=await resolveRequestTenantContext(request);
    const body=await request.json().catch(()=>({}));
    const datasetId=String(body?.datasetId||'').trim();
    const accessToken=String(body?.accessToken||'').trim();
    if(!datasetId||!accessToken)return NextResponse.json({ok:false,error:'datasetId and accessToken are required'},{status:400});
    const secretName=await storeIntegrationSecret({workspaceId:tenant.workspaceId,brandId:tenant.brandId,provider:'meta_events',value:{access_token:accessToken}});
    await upsertIntegrationConnection({workspaceId:tenant.workspaceId,brandId:tenant.brandId,provider:'meta_events',connectionMode:'api',ingestionAdapter:'meta_capi',status:'connected',providerAccountId:datasetId,providerAccountName:`Meta Dataset ${datasetId}`,secretName});
    return NextResponse.json({ok:true});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||'META_EVENTS_ERROR'},{status:500});}
}
