"use client";
// These values identify a browser app. Use ONLY a website/API-restricted Picker developer key.
// Never put a client secret, an AI provider key or a server credential in NEXT_PUBLIC variables.
export const DRIVE_SCOPE="https://www.googleapis.com/auth/drive.file";
export type DriveConfig={clientId:string;pickerKey:string;projectNumber:string};
export function driveConfig():DriveConfig|null{
  const clientId=process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const pickerKey=process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY;
  const projectNumber=process.env.NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER;
  return clientId&&pickerKey&&projectNumber?{clientId,pickerKey,projectNumber}:null;
}
export type DriveToken={accessToken:string;expiresAt:number};
export type DriveFile={id:string;name:string;resourceKey?:string};
type TokenResponse={access_token?:string;expires_in?:number;scope?:string;error?:string};
type PickerEvent={action:string;docs?:DriveFile[]};
type PickerView={setMimeTypes(v:string):PickerView;setIncludeFolders(v:boolean):PickerView;setSelectFolderEnabled(v:boolean):PickerView};
type Picker={setVisible(v:boolean):void};
type PickerBuilder={enableFeature(v:string):PickerBuilder;setDeveloperKey(v:string):PickerBuilder;setAppId(v:string):PickerBuilder;setOAuthToken(v:string):PickerBuilder;setOrigin(v:string):PickerBuilder;addView(v:PickerView):PickerBuilder;setCallback(v:(event:PickerEvent)=>void):PickerBuilder;build():Picker};
type GoogleSdk={accounts:{oauth2:{initTokenClient(options:{client_id:string;scope:string;include_granted_scopes:boolean;callback:(r:TokenResponse)=>void;error_callback:()=>void}):{requestAccessToken(options:{prompt:string}):void};revoke(token:string,callback:()=>void):void}};picker:{DocsView:new (id:string)=>PickerView;ViewId:{DOCS:string};PickerBuilder:new()=>PickerBuilder;Feature:{MULTISELECT_ENABLED:string};Action:{PICKED:string;CANCEL:string}}};
type GoogleWindow=Window&{google?:GoogleSdk;gapi?:{load(name:string,options:{callback:()=>void;onerror:()=>void;timeout:number;ontimeout:()=>void}):void}};
function sdkWindow(){return window as GoogleWindow;}
function script(id:string,url:string):Promise<void>{return new Promise((resolve,reject)=>{
  const old=document.getElementById(id) as HTMLScriptElement|null;
  if(old?.dataset.loaded){resolve();return;}
  const element=old||document.createElement("script");
  element.addEventListener("load",()=>{element.dataset.loaded="true";resolve();},{once:true});
  element.addEventListener("error",()=>{element.remove();reject(new Error("Chưa tải được kết nối Google. Hãy kiểm tra mạng hoặc trình chặn nội dung."));},{once:true});
  if(!old){element.id=id;element.src=url;element.async=true;document.head.appendChild(element);}
});}
let preparation:Promise<void>|null=null;
export function prepareGoogleDrive():Promise<void>{
  if(!preparation) preparation=(async()=>{
    await Promise.all([script("google-gis","https://accounts.google.com/gsi/client"),script("google-picker-api","https://apis.google.com/js/api.js")]);
    await new Promise<void>((resolve,reject)=>{
      const gapi=sdkWindow().gapi;if(!gapi){reject(new Error("Kết nối Google chưa sẵn sàng."));return;}
      gapi.load("picker",{callback:resolve,onerror:()=>reject(new Error("Chưa tải được bộ chọn form Google.")),timeout:15000,ontimeout:()=>reject(new Error("Kết nối Google quá lâu. Hãy thử lại."))});
    });
  })().catch(error=>{preparation=null;throw error;});
  return preparation;
}
// Called synchronously from a click once the SDK is prepared, preserving the popup user gesture.
export function authorizeDrive(config:DriveConfig):Promise<DriveToken>{return new Promise((resolve,reject)=>{
  const google=sdkWindow().google;if(!google?.accounts?.oauth2){reject(new Error("Kết nối Google chưa sẵn sàng. Hãy thử lại."));return;}
  const client=google.accounts.oauth2.initTokenClient({client_id:config.clientId,scope:DRIVE_SCOPE,include_granted_scopes:false,
    callback:response=>{
      if(response.error||!response.access_token||!response.scope?.split(" ").includes(DRIVE_SCOPE)){reject(new Error("Chưa được cấp quyền đọc các form đã chọn trên Drive."));return;}
      resolve({accessToken:response.access_token,expiresAt:Date.now()+(Number(response.expires_in)||3600)*1000-60000});
    },error_callback:()=>reject(new Error("Cửa sổ Google đã đóng hoặc bị chặn. Hãy cho phép cửa sổ bật lên và thử lại."))});
  client.requestAccessToken({prompt:""});
});}
export function pickDriveForms(token:DriveToken,config:DriveConfig):Promise<DriveFile[]>{return new Promise((resolve,reject)=>{
  try{
    const google=sdkWindow().google!;
    const view=new google.picker.DocsView(google.picker.ViewId.DOCS).setMimeTypes("application/vnd.google-apps.document,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,text/plain").setIncludeFolders(true).setSelectFolderEnabled(false);
    let picker:Picker;
    picker=new google.picker.PickerBuilder().enableFeature(google.picker.Feature.MULTISELECT_ENABLED).setDeveloperKey(config.pickerKey).setAppId(config.projectNumber).setOAuthToken(token.accessToken).setOrigin(window.location.origin).addView(view).setCallback(event=>{
      if(event.action===google.picker.Action.PICKED){picker.setVisible(false);resolve(event.docs||[]);}
      if(event.action===google.picker.Action.CANCEL){picker.setVisible(false);resolve([]);}
    }).build();picker.setVisible(true);
  }catch{reject(new Error("Chưa mở được bộ chọn Drive. Hãy kiểm tra cấu hình kết nối Google của website."));}
});}
export function revokeDrive(token:DriveToken):Promise<void>{return new Promise(resolve=>{
  const google=sdkWindow().google;if(!google?.accounts?.oauth2){resolve();return;}
  google.accounts.oauth2.revoke(token.accessToken,resolve);
});}
