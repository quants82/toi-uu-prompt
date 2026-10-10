// Isolated test build: dummy browser identifiers, never deploy this fixture build.
const {spawnSync,spawn}=require("node:child_process");
const env={...process.env,NEXT_PUBLIC_GOOGLE_CLIENT_ID:"TEST-CLIENT-ID.apps.googleusercontent.com",NEXT_PUBLIC_GOOGLE_PICKER_API_KEY:"PUBLIC-TEST-PICKER-DEVELOPER-KEY",NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER:"1234567890"};
const next=require.resolve("next/dist/bin/next");
const build=spawnSync(process.execPath,[next,"build"],{env,stdio:"inherit",windowsHide:true});
if(build.status!==0)process.exit(build.status||1);
const server=spawn(process.execPath,[next,"start","--hostname","127.0.0.1"],{env,stdio:"inherit",windowsHide:true});
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>{server.kill();process.exit(0);});
server.on("exit",code=>process.exit(code||0));
