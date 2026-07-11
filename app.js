(() => {
  "use strict";
  const config = window.NANQUIMORI_TESTERS_CONFIG || {};
  const state = {
    campaigns: (config.campaigns || []).map(normalize),
    loading: false,
    registeredThisSession: new Set(),
  };
  const $ = (id) => document.getElementById(id);
  const refs = {
    grid: $("campaignsGrid"),
    select: $("campaignSelect"),
    form: $("registrationForm"),
    submit: $("submitButton"),
    message: $("formMessage"),
    refresh: $("refreshStatus"),
  };

  function normalize(item) {
    const capacity = Math.max(0, Number(item.capacity) || 0);
    const current = Math.max(0, Number(item.current) || 0);
    return {
      id: String(item.id || ""),
      name: String(item.name || "Aplicativo"),
      role: String(item.role || "Aplicativo Android"),
      description: String(item.description || "Campanha de teste fechado."),
      capacity,
      current,
      remaining: Math.max(
        0,
        Number.isFinite(Number(item.remaining))
          ? Number(item.remaining)
          : capacity - current,
      ),
      testDays: Math.max(1, Number(item.testDays) || 14),
      enabled: item.enabled !== false,
      storeUrl: String(item.storeUrl || ""),
    };
  }
  const open = (item) => item.enabled && item.remaining > 0;
  const escape = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  function render() {
    refs.grid.innerHTML = state.campaigns.length
      ? state.campaigns
          .map((item) => {
            const available = open(item);
            const percent = item.capacity
              ? Math.min(100, Math.round((item.current / item.capacity) * 100))
              : 100;
            return `<article class="campaign-card ${available ? "" : "full-card"}"><p class="status"><i></i>${available ? "Inscrições abertas" : "Inscrições encerradas"}</p><p class="app-role">${escape(item.role)}</p><h3>${escape(item.name)}</h3><p>${escape(item.description)}</p><div class="android-participation"><strong>Como os testadores podem participar do seu teste</strong><span>Participar no Android</span><small>Os testadores podem participar do teste usando o Google Play no Android</small><a href="${escape(item.storeUrl)}" target="_blank" rel="noopener">Participar no Android</a></div><div class="capacity"><strong>${available ? `${item.remaining} ${item.remaining === 1 ? "vaga" : "vagas"}` : "Lista encerrada"}</strong><small>${item.current}/${item.capacity} inscritos</small></div><div class="bar"><i style="width:${percent}%"></i></div><div class="tags"><span>${item.testDays} dias</span><span>Android</span><span>Google Play</span></div><button class="button ${available ? "primary" : "disabled"}" type="button" data-campaign="${escape(item.id)}" ${available ? "" : "disabled"}>${available ? "Cadastrar neste app" : "Limite atingido"}</button></article>`;
          })
          .join("")
      : '<p class="empty">Nenhuma campanha disponível no momento.</p>';
    refs.grid.querySelectorAll("[data-campaign]").forEach((button) =>
      button.addEventListener("click", () => {
        refs.select.value = button.dataset.campaign;
        $("cadastro").scrollIntoView({ behavior: "smooth" });
      }),
    );
    const selected = refs.select.value;
    refs.select.innerHTML =
      '<option value="">Selecione uma campanha</option>' +
      state.campaigns
        .map(
          (item) =>
            `<option value="${escape(item.id)}" ${open(item) ? "" : "disabled"}>${escape(item.name)} — ${open(item) ? `${item.remaining} vagas` : "lotado"}</option>`,
        )
        .join("");
    if (state.campaigns.some((item) => item.id === selected && open(item)))
      refs.select.value = selected;
  }

  function message(text, type = "") {
    refs.message.textContent = text;
    refs.message.className = `form-message ${type}`;
  }

  async function load(show = false) {
    if (!config.apiEndpoint || state.loading) {
      if (show && !config.apiEndpoint)
        message(
          "O cadastro online está sendo configurado. Use o e-mail de feedback enquanto isso.",
          "warning",
        );
      render();
      return;
    }
    state.loading = true;
    refs.refresh.disabled = true;
    refs.refresh.textContent = "Atualizando…";
    try {
      const url = new URL(config.apiEndpoint);
      url.searchParams.set("action", "status");
      url.searchParams.set("_", Date.now());
      const response = await fetch(url, {
        cache: "no-store",
        redirect: "follow",
      });
      const data = await response.json();
      if (!data.ok || !Array.isArray(data.campaigns)) throw new Error();
      state.campaigns = data.campaigns.map(normalize);
      if (show) message("Vagas atualizadas.", "success");
    } catch {
      if (show)
        message("Não foi possível atualizar agora. Tente novamente.", "error");
    } finally {
      state.loading = false;
      refs.refresh.disabled = false;
      refs.refresh.textContent = "Atualizar vagas";
      render();
    }
  }

  refs.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message("");
    if (!refs.form.reportValidity()) return;
    if (!config.apiEndpoint) {
      message(
        "O cadastro online ainda está em configuração. Envie uma mensagem para nanquimori@gmail.com.",
        "warning",
      );
      return;
    }
    const form = new FormData(refs.form);
    const campaign = state.campaigns.find(
      (item) => item.id === form.get("campaignId"),
    );
    if (!campaign || !open(campaign)) {
      message("Essa lista já está completa.", "error");
      await load();
      return;
    }
    refs.submit.disabled = true;
    refs.submit.textContent = "Enviando…";
    try {
      const payload = {
        action: "register",
        campaignId: campaign.id,
        email: String(form.get("email") || "").trim(),
        website: String(form.get("website") || ""),
        commitment: form.get("commitment") === "on",
        privacy: form.get("privacy") === "on",
        source: location.href,
        userAgent: navigator.userAgent.slice(0, 300),
      };
      const response = await fetch(config.apiEndpoint, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!result.ok)
        throw new Error(result.message || "Não foi possível concluir.");
      state.registeredThisSession.add(campaign.id);
      const nextCampaign = state.campaigns.find(
        (item) => open(item) && !state.registeredThisSession.has(item.id),
      );
      if (nextCampaign) {
        message(
          `${result.status === "duplicate" ? "Este e-mail já estava inscrito" : "Inscrição recebida"} no ${campaign.name}. Agora envie o mesmo e-mail para o ${nextCampaign.name} para completar a rodada.`,
          "success",
        );
        refs.select.value = nextCampaign.id;
      } else {
        message(
          "Inscrições recebidas nos dois aplicativos! Nenhum e-mail é enviado agora. O link chegará somente depois que o acesso for liberado.",
          "success",
        );
        refs.form.reset();
      }
      await load();
    } catch (error) {
      message(
        error.message || "Não foi possível enviar. Tente novamente.",
        "error",
      );
    } finally {
      refs.submit.disabled = false;
      refs.submit.textContent = "Enviar inscrição";
    }
  });
  refs.refresh.addEventListener("click", () => load(true));
  if (!config.apiEndpoint) {
    refs.submit.disabled = true;
    refs.submit.textContent = "Cadastro em configuração";
    message(
      "O formulário será liberado após a autorização do serviço de inscrições.",
      "warning",
    );
  }
  load();
})();
