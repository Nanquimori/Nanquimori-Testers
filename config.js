window.NANQUIMORI_TESTERS_CONFIG = Object.freeze({
  apiEndpoint:
    "https://script.google.com/macros/s/AKfycbwDldu0Ob-On92Es7fYvXws3f-oQ5wqRghNo-WtLXg6yVhpzkDFEFVVaOcsEIuWFvzNUQ/exec",
  feedbackEmail: "nanquimori@gmail.com",
  campaigns: [
    {
      id: "nyxalira",
      name: "Nyxalira",
      role: "Leitor offline",
      description:
        "Leitor Android para bibliotecas locais, mangás, quadrinhos e novels.",
      capacity: 20,
      current: 0,
      testDays: 14,
      enabled: true,
      testUrl:
        "https://play.google.com/apps/testing/com.nyxalira.reader?hl=pt-BR",
      storeUrl:
        "https://play.google.com/store/apps/details?id=com.nyxalira.reader&hl=pt-BR&gl=BR",
    },
    {
      id: "nyxovira",
      name: "Nyxovira",
      role: "Downloads e fontes online",
      description:
        "Baixa obras de fontes online por plugins e prepara a biblioteca para leitura offline no Nyxalira.",
      capacity: 20,
      current: 0,
      testDays: 14,
      enabled: true,
      testUrl: "https://play.google.com/apps/testing/com.nyxovira.app?hl=pt-BR",
      storeUrl:
        "https://play.google.com/store/apps/details?id=com.nyxovira.app&hl=pt-BR&gl=BR&ah=A_TUJx658zx3jjRKRiagSWTiaw4",
    },
  ],
});
