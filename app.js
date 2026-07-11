(() => {
  "use strict";
  const config = window.NANQUIMORI_TESTERS_CONFIG || {};
  const state = {
    campaigns: sortCampaigns((config.campaigns || []).map(normalize)),
    loading: false,
  };
  const $ = (id) => document.getElementById(id);
  const refs = {
    grid: $("campaignsGrid"),
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
  function sortCampaigns(campaigns) {
    const order = ["nyxovira", "nyxalira"];
    return campaigns.sort((a, b) => {
      const aIndex = order.indexOf(a.id);
      const bIndex = order.indexOf(b.id);
      return (
        (aIndex < 0 ? order.length : aIndex) -
        (bIndex < 0 ? order.length : bIndex)
      );
    });
  }
  const escape = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  function render() {
    const pairAvailable =
      state.campaigns.length >= 2 && state.campaigns.every(open);
    refs.grid.innerHTML = state.campaigns.length
      ? state.campaigns
          .map((item) => {
            const available = open(item);
            const percent = item.capacity
              ? Math.min(100, Math.round((item.current / item.capacity) * 100))
              : 100;
            return `<article class="campaign-card ${available ? "" : "full-card"}"><p class="status"><i></i>${available ? "Inscrições abertas" : "Inscrições encerradas"}</p><p class="app-role">${escape(item.role)}</p><h3>${escape(item.name)}</h3><p>${escape(item.description)}</p><div class="android-participation"><strong>Como os testadores podem participar do seu teste</strong><span>Participar no Android</span><small>Os testadores podem participar do teste usando o Google Play no Android</small><a href="${escape(item.storeUrl)}" target="_blank" rel="noopener">Participar no Android</a></div><div class="capacity"><strong>${available ? `${item.remaining} ${item.remaining === 1 ? "vaga" : "vagas"}` : "Lista encerrada"}</strong><small>${item.current}/${item.capacity} inscritos</small></div><div class="bar"><i style="width:${percent}%"></i></div><div class="tags"><span>${item.testDays} dias</span><span>Android</span><span>Google Play</span></div><button class="button ${pairAvailable ? "primary" : "disabled"}" type="button" data-joint-registration ${pairAvailable ? "" : "disabled"}>${pairAvailable ? "Cadastrar nos dois apps" : "Cadastro conjunto indisponível"}</button></article>`;
          })
          .join("")
      : '<p class="empty">Nenhuma campanha disponível no momento.</p>';
    refs.grid.querySelectorAll("[data-joint-registration]").forEach((button) =>
      button.addEventListener("click", () => {
        $("cadastro").scrollIntoView({ behavior: "smooth" });
      }),
    );
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
      state.campaigns = sortCampaigns(data.campaigns.map(normalize));
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
    refs.submit.disabled = true;
    refs.submit.textContent = "Enviando…";
    try {
      const payload = {
        action: "register",
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
      message(
        result.status === "duplicate"
          ? "Este e-mail já está inscrito nos dois aplicativos."
          : "Inscrição concluída no Nyxovira e no Nyxalira! Nenhum e-mail é enviado agora. Os links chegarão somente depois que os acessos forem liberados.",
        "success",
      );
      refs.form.reset();
      await load();
    } catch (error) {
      message(
        error.message || "Não foi possível enviar. Tente novamente.",
        "error",
      );
    } finally {
      refs.submit.disabled = false;
      refs.submit.textContent = "Cadastrar nos dois apps";
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
