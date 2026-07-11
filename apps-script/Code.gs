const SETTINGS = Object.freeze({
  ownerEmail: "nanquimori@gmail.com",
  campaignsSheet: "Campanhas",
  registrationsSheet: "Inscricoes",
  senderName: "Nanquimori Testers",
});

function setup() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book)
    throw new Error("Abra este script a partir de uma Planilha Google.");
  let campaigns =
    book.getSheetByName(SETTINGS.campaignsSheet) ||
    book.insertSheet(SETTINGS.campaignsSheet);
  if (campaigns.getLastRow() === 0) {
    campaigns.getRange(1, 1, 3, 10).setValues([
      [
        "Id",
        "Aplicativo",
        "Limite",
        "Ativa",
        "URLTeste",
        "EmailFeedback",
        "Dias",
        "Descricao",
        "URLLoja",
        "Papel",
      ],
      [
        "nyxalira",
        "Nyxalira",
        20,
        true,
        "https://play.google.com/apps/testing/com.nyxalira.reader?hl=pt-BR",
        SETTINGS.ownerEmail,
        14,
        "Leitor Android para bibliotecas locais, mangás, quadrinhos e novels.",
        "https://play.google.com/store/apps/details?id=com.nyxalira.reader&hl=pt-BR&gl=BR",
        "Leitor offline",
      ],
      [
        "nyxovira",
        "Nyxovira",
        20,
        true,
        "https://play.google.com/apps/testing/com.nyxovira.app?hl=pt-BR",
        SETTINGS.ownerEmail,
        14,
        "Baixa obras de fontes online por plugins e prepara a biblioteca para leitura offline no Nyxalira.",
        "https://play.google.com/store/apps/details?id=com.nyxovira.app&hl=pt-BR&gl=BR&ah=A_TUJx658zx3jjRKRiagSWTiaw4",
        "Downloads e fontes online",
      ],
    ]);
    campaigns.setFrozenRows(1);
  }
  let registrations =
    book.getSheetByName(SETTINGS.registrationsSheet) ||
    book.insertSheet(SETTINGS.registrationsSheet);
  if (registrations.getLastRow() === 0) {
    registrations
      .getRange(1, 1, 1, 8)
      .setValues([
        [
          "Data",
          "CampanhaId",
          "Aplicativo",
          "Email",
          "EmailNormalizado",
          "Status",
          "Origem",
          "UserAgent",
        ],
      ]);
    registrations.setFrozenRows(1);
  }
  [campaigns, registrations].forEach((sheet) => {
    sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .setFontWeight("bold")
      .setBackground("#151311")
      .setFontColor("#ffffff");
    sheet.autoResizeColumns(1, sheet.getLastColumn());
  });
}

function doGet(event) {
  try {
    const action = String(
      (event && event.parameter && event.parameter.action) || "status",
    ).toLowerCase();
    if (action !== "status")
      return json({ ok: false, message: "Ação inválida." });
    return json({ ok: true, campaigns: publicCampaigns() });
  } catch (error) {
    console.error(error);
    return json({
      ok: false,
      message: "Não foi possível consultar as campanhas.",
    });
  }
}

function doPost(event) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const data = parse(event);
    if (data.action !== "register") throw new Error("Solicitação inválida.");
    if (String(data.website || "").trim())
      return json({ ok: true, status: "received" });
    if (data.commitment !== true || data.privacy !== true)
      throw new Error("Confirme o compromisso e a Política de Privacidade.");
    const email = String(data.email || "").trim(),
      normalized = normalizeEmail(email);
    if (!validEmail(normalized))
      throw new Error("Informe um endereço de e-mail válido.");
    const campaign = campaigns().find(
      (item) => item.id === String(data.campaignId || "").trim(),
    );
    if (!campaign || !campaign.enabled)
      throw new Error("Essa campanha não está disponível.");
    const sheet = registrationsSheet(),
      rows = registrationRows(sheet);
    if (
      rows.some(
        (row) =>
          row.campaignId === campaign.id &&
          row.email === normalized &&
          row.status !== "cancelado",
      )
    )
      return json({ ok: true, status: "duplicate" });
    const current = rows.filter(
      (row) => row.campaignId === campaign.id && row.status !== "cancelado",
    ).length;
    if (current >= campaign.capacity)
      return json({
        ok: false,
        code: "FULL",
        message: "A lista deste aplicativo já atingiu o limite de inscrições.",
      });
    sheet.appendRow([
      new Date(),
      campaign.id,
      campaign.name,
      email,
      normalized,
      "Pendente",
      String(data.source || "").slice(0, 500),
      String(data.userAgent || "").slice(0, 300),
    ]);
    notifyOwner(campaign, email, current + 1);
    confirmTester(campaign, email);
    return json({
      ok: true,
      status: "registered",
      remaining: Math.max(0, campaign.capacity - current - 1),
    });
  } catch (error) {
    console.error(error);
    return json({
      ok: false,
      message: error.message || "Não foi possível concluir a inscrição.",
    });
  } finally {
    try {
      lock.releaseLock();
    } catch (ignored) {}
  }
}

function campaigns() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    SETTINGS.campaignsSheet,
  );
  if (!sheet) throw new Error("Execute setup primeiro.");
  if (sheet.getLastRow() < 2) return [];
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 10)
    .getValues()
    .filter((row) => String(row[0]).trim())
    .map((row) => ({
      id: String(row[0]).trim(),
      name: String(row[1]).trim(),
      capacity: Math.max(0, Number(row[2]) || 0),
      enabled:
        row[3] === true ||
        ["true", "sim"].includes(String(row[3]).toLowerCase()),
      testUrl: String(row[4] || "").trim(),
      feedbackEmail: String(row[5] || SETTINGS.ownerEmail).trim(),
      testDays: Math.max(1, Number(row[6]) || 14),
      description: String(row[7] || "Campanha de teste fechado.").trim(),
      storeUrl: String(row[8] || "").trim(),
      role: String(row[9] || "Aplicativo Android").trim(),
    }));
}
function publicCampaigns() {
  const rows = registrationRows(registrationsSheet());
  return campaigns().map((item) => {
    const current = rows.filter(
      (row) => row.campaignId === item.id && row.status !== "cancelado",
    ).length;
    return {
      id: item.id,
      name: item.name,
      role: item.role,
      description: item.description,
      capacity: item.capacity,
      current,
      remaining: Math.max(0, item.capacity - current),
      testDays: item.testDays,
      enabled: item.enabled,
      testUrl: item.testUrl,
      storeUrl: item.storeUrl,
    };
  });
}
function registrationsSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    SETTINGS.registrationsSheet,
  );
  if (!sheet) throw new Error("Execute setup primeiro.");
  return sheet;
}
function registrationRows(sheet) {
  if (sheet.getLastRow() < 2) return [];
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 8)
    .getValues()
    .map((row) => ({
      campaignId: String(row[1]).trim(),
      email: normalizeEmail(row[4] || row[3]),
      status: String(row[5] || "pendente")
        .trim()
        .toLowerCase(),
    }));
}
function parse(event) {
  if (!event || !event.postData || !event.postData.contents)
    throw new Error("Conteúdo ausente.");
  try {
    return JSON.parse(event.postData.contents);
  } catch (error) {
    throw new Error("Conteúdo inválido.");
  }
}
function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}
function validEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}
function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
function safe(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function notifyOwner(campaign, email, position) {
  MailApp.sendEmail({
    to: SETTINGS.ownerEmail,
    subject: `[Testadores] Nova inscrição — ${campaign.name}`,
    name: SETTINGS.senderName,
    htmlBody: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Nova inscrição em ${safe(campaign.name)}</h2><p><b>E-mail:</b> ${safe(email)}</p><p><b>Ocupação:</b> ${position}/${campaign.capacity}</p><p>Adicione esse endereço à lista do Google Play Console e altere o status na planilha para <b>Liberado</b>.</p></div>`,
  });
}
function confirmTester(campaign, email) {
  const feedback = campaign.feedbackEmail || SETTINGS.ownerEmail;
  MailApp.sendEmail({
    to: email,
    replyTo: feedback,
    subject: `Cadastro recebido — teste fechado do ${campaign.name}`,
    name: SETTINGS.senderName,
    htmlBody: `<div style="max-width:620px;font-family:Arial,sans-serif;line-height:1.65"><h2>Seu cadastro foi recebido.</h2><p>Você solicitou uma vaga no teste fechado do <b>${safe(campaign.name)}</b> — ${safe(campaign.role)}.</p><p>Aguarde a inclusão do seu e-mail e depois use a mesma Conta Google no celular.</p><h3>1. Aceitar o convite</h3><p><a href="${safe(campaign.testUrl)}"><b>Abrir convite do Google</b></a></p><p>A página pode aparecer em inglês. Se houver o botão <b>“Become a tester”</b>, clique nele para aceitar.</p><p style="padding:14px;background:#fff3e8;border-left:4px solid #b6382d">Se a página já mostrar <b>“You’ll receive an update”</b> e <b>“Leave the program”</b>, sua conta já está participando. Não clique em “Leave the program”: esse botão serve exclusivamente para sair do teste.</p><h3>2. Instalar depois de aceitar</h3><p><a href="${safe(campaign.storeUrl)}"><b>Instalar no Google Play</b></a></p><p>O link de instalação não aceita o convite; ele somente instala o app depois que a participação foi aceita.</p><h3>Durante os ${campaign.testDays} dias</h3><ul><li>permaneça inscrito;</li><li>use o app em dias diferentes;</li><li>mantenha a versão atualizada;</li><li>também se cadastre no outro aplicativo da rodada;</li><li>envie feedback para <a href="mailto:${safe(feedback)}">${safe(feedback)}</a>.</li></ul><p>Informe o app, modelo do aparelho, Android, passos do problema e uma captura quando possível.</p><p>Obrigado por ajudar um projeto independente.</p></div>`,
  });
}
