const form=document.querySelector("#article-form");
const status=document.querySelector("#status");
if(form)form.addEventListener("submit",async e=>{e.preventDefault();status.textContent="Saving…";const data=Object.fromEntries(new FormData(form));try{const r=await fetch("/api/admin/articles",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});const result=await r.json();status.textContent=r.ok?"Draft created: "+result.id:result.error||"Failed";if(r.ok)form.reset();}catch{status.textContent="Network error";}});
