import { NextRequest,NextResponse } from 'next/server';
import { requireGrowthOSAccess,runtimeAccessErrorResponse } from '@/lib/auth/runtime-guard';
import { processMetaQueue } from '@/lib/call-commerce/meta-worker';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function POST(request:NextRequest){
  try{
    const access=await requireGrowthOSAccess({request,moduleId:'call-commerce',submoduleId:'meta-events',required:'editor'});
    const data=await processMetaQueue(access.workspaceId,access.brandId);
    return NextResponse.json({ok:true,data});
  }catch(error:unknown){const r=runtimeAccessErrorResponse(error);if(r)return r;return NextResponse.json({ok:false,error:error instanceof Error?error.message:'META_WORKER_ERROR'},{status:500});}
}
