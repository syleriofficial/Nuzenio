async function submitForm(form,endpoint,status){
 status.textContent="Saving…";
 const data=Object.fromEntries(new FormData(form));
 try{
  const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});
  const result=await r.json();
  status.textContent=r.ok?(result.message||("Saved: "+result.status+" · "+result.id)):(result.error||"Request failed");
  if(r.ok)form.reset();
 }catch{status.textContent="Network error";}
}
const form=document.querySelector("#article-form"),status=document.querySelector("#status");
if(form&&status)form.addEventListener("submit",async e=>{e.preventDefault();await submitForm(form,"/api/admin/articles",status);});
const source=document.querySelector("#source-form"),sourceStatus=document.querySelector("#source-status");
if(source&&sourceStatus)source.addEventListener("submit",async e=>{e.preventDefault();await submitForm(source,"/api/admin/sources",sourceStatus);});

document.addEventListener("click",async event=>{
 const button=event.target.closest("button[data-source-action],button[data-article-action]");
 if(!button)return;
 const sourceAction=button.dataset.sourceAction,articleAction=button.dataset.articleAction;
 const action=sourceAction||articleAction,id=sourceAction?button.dataset.sourceId:button.dataset.articleId;
 if(!/^[0-9a-f-]{36}$/i.test(id||""))return;
 let endpoint="",payload={};
 if(sourceAction){
  endpoint="/api/admin/sources/"+id+"/"+action;
  if(action==="approve"){
   if(!confirm("Have you independently verified that commercial reuse of this publisher's RSS headlines and links is licensed and documented?"))return;
   payload.attestation="I HAVE VERIFIED RIGHTS";
  }else if(!confirm("Revoke this publisher's rights and immediately hide its items?"))return;
 }else{
  endpoint="/api/admin/articles/"+id+"/"+action;
  if(!confirm("Confirm "+action+" of this original article?"))return;
 }
 button.disabled=true;
 try{
  const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
  const data=await response.json();
  alert(response.ok?"Updated: "+data.status:data.error||"Request failed");
  if(response.ok)location.reload();
 }catch{alert("Unable to update. Try again.");}
 finally{button.disabled=false;}
});
