const SETTINGS = Object.freeze({
  ownerEmail: "nanquimori@gmail.com",
  campaignsSheet: "Campanhas",
  registrationsSheet: "Inscricoes",
  senderName: "Nanquimori Testers",
  requiredCampaignIds: ["nyxovira", "nyxalira"],
  webAppUrl:
    "https://script.google.com/macros/s/AKfycbwDldu0Ob-On92Es7fYvXws3f-oQ5wqRghNo-WtLXg6yVhpzkDFEFVVaOcsEIuWFvzNUQ/exec",
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
        "URLAndroid",
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
        "https://play.google.com/store/apps/details?id=com.nyxalira.reader&hl=pt-BR&gl=BR",
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
        "https://play.google.com/store/apps/details?id=com.nyxovira.app&hl=pt-BR&gl=BR&ah=A_TUJx658zx3jjRKRiagSWTiaw4",
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
      .getRange(1, 1, 1, 9)
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
          "AcessoEnviadoEm",
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
    if (action === "release") return releaseTester(event.parameter || {});
    if (action !== "status")
      return json({ ok: false, message: "Ação inválida." });
    sendReleasedAccessEmails();
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
    const campaignMap = Object.fromEntries(
      campaigns().map((campaign) => [campaign.id, campaign]),
    );
    const requiredCampaigns = SETTINGS.requiredCampaignIds.map(
      (id) => campaignMap[id],
    );
    if (requiredCampaigns.some((campaign) => !campaign || !campaign.enabled)) {
      throw new Error("O cadastro conjunto não está disponível.");
    }
    const sheet = registrationsSheet(),
      rows = registrationRows(sheet);
    const missingCampaigns = requiredCampaigns.filter(
      (campaign) =>
        !rows.some(
          (row) =>
            row.campaignId === campaign.id &&
            row.email === normalized &&
            row.status !== "cancelado",
        ),
    );
    if (!missingCampaigns.length)
      return json({ ok: true, status: "duplicate" });
    const counts = Object.fromEntries(
      requiredCampaigns.map((campaign) => [
        campaign.id,
        rows.filter(
          (row) => row.campaignId === campaign.id && row.status !== "cancelado",
        ).length,
      ]),
    );
    const fullCampaigns = missingCampaigns.filter(
      (campaign) => counts[campaign.id] >= campaign.capacity,
    );
    if (fullCampaigns.length)
      return json({
        ok: false,
        code: "FULL",
        message: `Não há vaga disponível em ${fullCampaigns.map((item) => item.name).join(" e ")}. O cadastro precisa incluir os dois aplicativos.`,
      });
    const now = new Date();
    const source = String(data.source || "").slice(0, 500);
    const userAgent = String(data.userAgent || "").slice(0, 300);
    sheet
      .getRange(sheet.getLastRow() + 1, 1, missingCampaigns.length, 9)
      .setValues(
        missingCampaigns.map((campaign) => [
          now,
          campaign.id,
          campaign.name,
          email,
          normalized,
          "Pendente",
          source,
          userAgent,
          "",
        ]),
      );
    missingCampaigns.forEach((campaign) =>
      notifyOwner(campaign, email, normalized, counts[campaign.id] + 1),
    );
    return json({
      ok: true,
      status: "registered",
      campaigns: missingCampaigns.map((campaign) => campaign.id),
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
      feedbackEmail: String(row[5] || SETTINGS.ownerEmail).trim(),
      testDays: Math.max(1, Number(row[6]) || 14),
      description: String(row[7] || "Campanha de teste fechado.").trim(),
      storeUrl: String(row[8] || "").trim(),
      role: String(row[9] || "Aplicativo Android").trim(),
    }))
    .sort((a, b) => {
      const aIndex = SETTINGS.requiredCampaignIds.indexOf(a.id);
      const bIndex = SETTINGS.requiredCampaignIds.indexOf(b.id);
      return (
        (aIndex < 0 ? SETTINGS.requiredCampaignIds.length : aIndex) -
        (bIndex < 0 ? SETTINGS.requiredCampaignIds.length : bIndex)
      );
    });
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
      storeUrl: item.storeUrl,
    };
  });
}
function registrationsSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    SETTINGS.registrationsSheet,
  );
  if (!sheet) throw new Error("Execute setup primeiro.");
  if (sheet.getLastColumn() < 9 || !String(sheet.getRange(1, 9).getValue())) {
    sheet.getRange(1, 9).setValue("AcessoEnviadoEm");
  }
  return sheet;
}
function registrationRows(sheet) {
  if (sheet.getLastRow() < 2) return [];
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 9)
    .getValues()
    .map((row, index) => ({
      rowNumber: index + 2,
      campaignId: String(row[1]).trim(),
      email: normalizeEmail(row[4] || row[3]),
      status: String(row[5] || "pendente")
        .trim()
        .toLowerCase(),
      accessSentAt: row[8],
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

function notifyOwner(campaign, email, normalizedEmail, position) {
  const releaseUrl = buildReleaseUrl(campaign.id, normalizedEmail);
  MailApp.sendEmail({
    to: SETTINGS.ownerEmail,
    subject: `[Testadores] Nova inscrição — ${campaign.name}`,
    name: SETTINGS.senderName,
    htmlBody: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Nova inscrição em ${safe(campaign.name)}</h2><p><b>E-mail:</b> ${safe(email)}</p><p><b>Ocupação:</b> ${position}/${campaign.capacity}</p><p>Primeiro adicione esse endereço à lista do Google Play Console. Somente depois clique no botão abaixo.</p><p><a href="${safe(releaseUrl)}" style="display:inline-block;padding:12px 18px;background:#151311;color:#fff;text-decoration:none"><b>Confirmar liberação e enviar link</b></a></p><p>O botão autoriza o cadastro na planilha e envia o link ao testador uma única vez.</p></div>`,
  });
}
function buildReleaseUrl(campaignId, email) {
  const token = releaseToken(campaignId, email);
  return `${SETTINGS.webAppUrl}?action=release&campaignId=${encodeURIComponent(campaignId)}&email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
}

function releaseToken(campaignId, email) {
  const properties = PropertiesService.getScriptProperties();
  let secret = properties.getProperty("RELEASE_SECRET");
  if (!secret) {
    secret = `${Utilities.getUuid()}${Utilities.getUuid()}`;
    properties.setProperty("RELEASE_SECRET", secret);
  }
  const signature = Utilities.computeHmacSha256Signature(
    `${campaignId}\n${normalizeEmail(email)}`,
    secret,
  );
  return Utilities.base64EncodeWebSafe(signature).replace(/=+$/g, "");
}

function releaseTester(parameters) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const campaignId = String(parameters.campaignId || "").trim();
    const email = normalizeEmail(parameters.email);
    const token = String(parameters.token || "");
    if (
      !campaignId ||
      !validEmail(email) ||
      token !== releaseToken(campaignId, email)
    ) {
      return releasePage(
        "Link inválido",
        "Esta autorização não é válida.",
        false,
      );
    }
    const campaign = campaigns().find((item) => item.id === campaignId);
    if (!campaign) {
      return releasePage(
        "Campanha não encontrada",
        "O aplicativo não está mais disponível.",
        false,
      );
    }
    const sheet = registrationsSheet();
    const registration = registrationRows(sheet).find(
      (row) =>
        row.campaignId === campaignId &&
        row.email === email &&
        row.status !== "cancelado",
    );
    if (!registration) {
      return releasePage(
        "Inscrição não encontrada",
        "Nenhum cadastro ativo corresponde a este link.",
        false,
      );
    }
    if (registration.accessSentAt) {
      return releasePage(
        "Acesso já enviado",
        "O testador já recebeu o link anteriormente.",
        true,
      );
    }
    sheet.getRange(registration.rowNumber, 6).setValue("Liberado");
    sendAccessEmail(campaign, email);
    sheet.getRange(registration.rowNumber, 9).setValue(new Date());
    return releasePage(
      "Acesso liberado",
      `O link do ${campaign.name} foi enviado para ${email}.`,
      true,
    );
  } catch (error) {
    console.error(error);
    return releasePage(
      "Não foi possível liberar",
      "Tente novamente em alguns instantes.",
      false,
    );
  } finally {
    try {
      lock.releaseLock();
    } catch (ignored) {}
  }
}

function sendAccessEmail(campaign, email) {
  const feedback = campaign.feedbackEmail || SETTINGS.ownerEmail;
  MailApp.sendEmail({
    to: email,
    replyTo: feedback,
    subject: `Acesso liberado — teste fechado do ${campaign.name}`,
    name: SETTINGS.senderName,
    htmlBody: `<div style="max-width:620px;font-family:Arial,sans-serif;line-height:1.65"><h2>Seu acesso foi liberado.</h2><p>A Conta Google <b>${safe(email)}</b> foi autorizada no teste fechado do <b>${safe(campaign.name)}</b> — ${safe(campaign.role)}.</p><h3>Participar no Android</h3><p><a href="${safe(campaign.storeUrl)}"><b>Participar no Android</b></a></p><h3>Durante os ${campaign.testDays} dias</h3><ul><li>permaneça inscrito;</li><li>use o app em dias diferentes;</li><li>mantenha a versão atualizada;</li><li>também se cadastre no outro aplicativo da rodada;</li><li>envie feedback para <a href="mailto:${safe(feedback)}">${safe(feedback)}</a>.</li></ul><p>Informe o app, modelo do aparelho, Android, passos do problema e uma captura quando possível.</p><p>Obrigado por ajudar um projeto independente.</p></div>`,
  });
}

function sendReleasedAccessEmails() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const sheet = registrationsSheet();
    const campaignMap = Object.fromEntries(
      campaigns().map((campaign) => [campaign.id, campaign]),
    );
    registrationRows(sheet).forEach((registration) => {
      if (registration.status !== "liberado" || registration.accessSentAt)
        return;
      const campaign = campaignMap[registration.campaignId];
      if (!campaign) return;
      sendAccessEmail(campaign, registration.email);
      sheet.getRange(registration.rowNumber, 9).setValue(new Date());
    });
  } catch (error) {
    console.error(error);
  } finally {
    lock.releaseLock();
  }
}

function releasePage(title, message, success) {
  return HtmlService.createHtmlOutput(
    `<main style="max-width:620px;margin:70px auto;padding:32px;font-family:Arial,sans-serif;line-height:1.6;border:1px solid #ddd"><h1 style="color:${success ? "#276749" : "#9b2c2c"}">${safe(title)}</h1><p>${safe(message)}</p><p>Esta página pode ser fechada.</p></main>`,
  ).setTitle(title);
}
