# Nanquimori Testers

Portal reutilizável para inscrições em testes fechados dos aplicativos Nanquimori.

## Endereços

- Site: `https://nanquimori.github.io/Nanquimori-Testers/`
- URL de feedback: `https://nanquimori.github.io/Nanquimori-Testers/#feedback`
- E-mail de feedback: `nanquimori@gmail.com`

## Recursos

- vários aplicativos no mesmo site;
- inscrição conjunta obrigatória no Nyxovira e no Nyxalira;
- limite individual por campanha e bloqueio automático;
- prevenção de duplicados;
- planilha privada com os e-mails;
- aviso para `nanquimori@gmail.com`;
- envio do link somente após a liberação solicitada pelo administrador;
- Política de Privacidade.

## Estado do serviço

O formulário está conectado ao Google Apps Script e à Planilha Google privada `Nanquimori Testers`. O endpoint público retorna somente a contagem e os dados públicos das campanhas; os endereços de e-mail nunca são retornados ao site.

## Adicionar outro app

Adicione uma linha na aba `Campanhas`:

| Id         | Aplicativo | Limite | Ativa  | URLAndroid   | EmailFeedback | Dias | Descricao         | URLLoja      | Papel         |
| ---------- | ---------- | -----: | ------ | ------------ | ------------- | ---: | ----------------- | ------------ | ------------- |
| `novo-app` | `Novo App` |   `20` | `TRUE` | link Android | e-mail        | `14` | descrição pública | link Android | função do app |

Não é necessário alterar o site. Para liberar uma vaga, marque a inscrição como `Cancelado`. Depois de cadastrar o e-mail no Play Console, marque como `Liberado`.

Os e-mails nunca são enviados ao navegador nem publicados no GitHub.
