const SETTINGS = Object.freeze({ownerEmail:"nanquimori@gmail.com",campaignsSheet:"Campanhas",registrationsSheet:"Inscricoes",senderName:"Nanquimori Testers"});

function setup(){
  const book=SpreadsheetApp.getActiveSpreadsheet();
  if(!book) throw new Error("Abra este script a partir de uma Planilha Google.");
  let campaigns=book.getSheetByName(SETTINGS.campaignsSheet)||book.insertSheet(SETTINGS.campaignsSheet);
  if(campaigns.getLastRow()===0){campaigns.getRange(1,1,2,8).setValues([
    ["Id","Aplicativo","Limite","Ativa","URLTeste","EmailFeedback","Dias","Descricao"],
    ["nyxalira","Nyxalira",20,true,"https://play.google.com/apps/testing/com.nyxalira.reader",SETTINGS.ownerEmail,14,"Leitor Android para bibliotecas locais, mangás, quadrinhos e novels."]
  ]);campaigns.setFrozenRows(1)}
  let registrations=book.getSheetByName(SETTINGS.registrationsSheet)||book.insertSheet(SETTINGS.registrationsSheet);
  if(registrations.getLastRow()===0){registrations.getRange(1,1,1,8).setValues([["Data","CampanhaId","Aplicativo","Email","EmailNormalizado","Status","Origem","UserAgent"]]);registrations.setFrozenRows(1)}
  [campaigns,registrations].forEach(sheet=>{sheet.getRange(1,1,1,sheet.getLastColumn()).setFontWeight("bold").setBackground("#151311").setFontColor("#ffffff");sheet.autoResizeColumns(1,sheet.getLastColumn())});
}

function doGet(event){try{const action=String(event&&event.parameter&&event.parameter.action||"status").toLowerCase();if(action!=="status")return json({ok:false,message:"Ação inválida."});return json({ok:true,campaigns:publicCampaigns()})}catch(error){console.error(error);return json({ok:false,message:"Não foi possível consultar as campanhas."})}}

function doPost(event){
  const lock=LockService.getScriptLock();
  try{
    lock.waitLock(10000);
    const data=parse(event);
    if(data.action!=="register")throw new Error("Solicitação inválida.");
    if(String(data.website||"").trim())return json({ok:true,status:"received"});
    if(data.commitment!==true||data.privacy!==true)throw new Error("Confirme o compromisso e a Política de Privacidade.");
    const email=String(data.email||"").trim(),normalized=normalizeEmail(email);
    if(!validEmail(normalized))throw new Error("Informe um endereço de e-mail válido.");
    const campaign=campaigns().find(item=>item.id===String(data.campaignId||"").trim());
    if(!campaign||!campaign.enabled)throw new Error("Essa campanha não está disponível.");
    const sheet=registrationsSheet(),rows=registrationRows(sheet);
    if(rows.some(row=>row.campaignId===campaign.id&&row.email===normalized&&row.status!=="cancelado"))return json({ok:true,status:"duplicate"});
    const current=rows.filter(row=>row.campaignId===campaign.id&&row.status!=="cancelado").length;
    if(current>=campaign.capacity)return json({ok:false,code:"FULL",message:"A lista deste aplicativo já atingiu o limite de inscrições."});
    sheet.appendRow([new Date(),campaign.id,campaign.name,email,normalized,"Pendente",String(data.source||"").slice(0,500),String(data.userAgent||"").slice(0,300)]);
    notifyOwner(campaign,email,current+1);confirmTester(campaign,email);
    return json({ok:true,status:"registered",remaining:Math.max(0,campaign.capacity-current-1)});
  }catch(error){console.error(error);return json({ok:false,message:error.message||"Não foi possível concluir a inscrição."})}
  finally{try{lock.releaseLock()}catch(ignored){}}
}

function campaigns(){
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS.campaignsSheet);
  if(!sheet)throw new Error("Execute setup primeiro.");
  if(sheet.getLastRow()<2)return[];
  return sheet.getRange(2,1,sheet.getLastRow()-1,8).getValues().filter(row=>String(row[0]).trim()).map(row=>({id:String(row[0]).trim(),name:String(row[1]).trim(),capacity:Math.max(0,Number(row[2])||0),enabled:row[3]===true||["true","sim"].includes(String(row[3]).toLowerCase()),testUrl:String(row[4]||"").trim(),feedbackEmail:String(row[5]||SETTINGS.ownerEmail).trim(),testDays:Math.max(1,Number(row[6])||14),description:String(row[7]||"Campanha de teste fechado.").trim()}));
}
function publicCampaigns(){const rows=registrationRows(registrationsSheet());return campaigns().map(item=>{const current=rows.filter(row=>row.campaignId===item.id&&row.status!=="cancelado").length;return{id:item.id,name:item.name,description:item.description,capacity:item.capacity,current,remaining:Math.max(0,item.capacity-current),testDays:item.testDays,enabled:item.enabled,testUrl:item.testUrl}})}
function registrationsSheet(){const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS.registrationsSheet);if(!sheet)throw new Error("Execute setup primeiro.");return sheet}
function registrationRows(sheet){if(sheet.getLastRow()<2)return[];return sheet.getRange(2,1,sheet.getLastRow()-1,8).getValues().map(row=>({campaignId:String(row[1]).trim(),email:normalizeEmail(row[4]||row[3]),status:String(row[5]||"pendente").trim().toLowerCase()}))}
function parse(event){if(!event||!event.postData||!event.postData.contents)throw new Error("Conteúdo ausente.");try{return JSON.parse(event.postData.contents)}catch(error){throw new Error("Conteúdo inválido.")}}
function normalizeEmail(value){return String(value||"").trim().toLowerCase()}
function validEmail(value){return value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)}
function json(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON)}
function safe(value){return String(value||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}

function notifyOwner(campaign,email,position){
  MailApp.sendEmail({to:SETTINGS.ownerEmail,subject:`[Testadores] Nova inscrição — ${campaign.name}`,name:SETTINGS.senderName,htmlBody:`<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Nova inscrição em ${safe(campaign.name)}</h2><p><b>E-mail:</b> ${safe(email)}</p><p><b>Ocupação:</b> ${position}/${campaign.capacity}</p><p>Adicione esse endereço à lista do Google Play Console e altere o status na planilha para <b>Liberado</b>.</p></div>`});
}
function confirmTester(campaign,email){
  const feedback=campaign.feedbackEmail||SETTINGS.ownerEmail;
  MailApp.sendEmail({to:email,replyTo:feedback,subject:`Cadastro recebido — teste fechado do ${campaign.name}`,name:SETTINGS.senderName,htmlBody:`<div style="max-width:620px;font-family:Arial,sans-serif;line-height:1.65"><h2>Seu cadastro foi recebido.</h2><p>Você solicitou uma vaga no teste fechado do <b>${safe(campaign.name)}</b>.</p><p>Aguarde a inclusão do seu e-mail. Depois, use a mesma Conta Google no celular e abra:</p><p><a href="${safe(campaign.testUrl)}">${safe(campaign.testUrl)}</a></p><h3>Durante os ${campaign.testDays} dias</h3><ul><li>permaneça inscrito;</li><li>use o app em dias diferentes;</li><li>mantenha a versão atualizada;</li><li>envie feedback para <a href="mailto:${safe(feedback)}">${safe(feedback)}</a>.</li></ul><p>Informe o app, modelo do aparelho, Android, passos do problema e uma captura quando possível.</p><p>Obrigado por ajudar um projeto independente.</p></div>`});
}
