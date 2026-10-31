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
