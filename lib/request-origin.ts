import type { NextRequest } from "next/server";
// Next can expose its internal hostname in nextUrl. Browsers send the public Host.
// Do not accept an arbitrary forwarded hostname from request headers.
export function isSameOrigin(request:NextRequest):boolean{
  const origin=request.headers.get("origin");if(!origin)return true;
  try{
    const parsed=new URL(origin);if(parsed.origin!==origin)return false;
    const host=request.headers.get("host")||request.nextUrl.host;
    if(!/^[a-zA-Z0-9.:[\]-]+$/.test(host))return false;
    const protocol=process.env.VERCEL==="1"?"https:":request.nextUrl.protocol;
    return parsed.origin===new URL(protocol+"//"+host).origin;
  }catch{return false;}
}