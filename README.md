# Nanquimori Testers

Portal reutilizável para inscrições em testes fechados dos aplicativos Nanquimori.

## Endereços

- Site: `https://nanquimori.github.io/Nanquimori-Testers/`
- URL de feedback: `https://nanquimori.github.io/Nanquimori-Testers/#feedback`
- E-mail de feedback: `nanquimori@gmail.com`

## Recursos

- vários aplicativos no mesmo site;
- limite individual por campanha e bloqueio automático;
- prevenção de duplicados;
- planilha privada com os e-mails;
- aviso para `nanquimori@gmail.com`;
- confirmação e instruções automáticas para o testador;
- Política de Privacidade.

## Ativar o formulário (uma única vez)

1. Crie uma Planilha Google chamada `Nanquimori Testers`.
2. Abra **Extensões > Apps Script**.
3. Substitua `Code.gs` pelo conteúdo de `apps-script/Code.gs`.
4. Execute `setup` e autorize planilha e envio de e-mail.
5. Selecione **Implantar > Nova implantação > Aplicativo da Web**.
6. Use **Executar como: Eu** e **Quem pode acessar: Qualquer pessoa**.
7. Copie a URL terminada em `/exec` para `apiEndpoint` em `config.js`.
8. Faça commit e push.

Enquanto `apiEndpoint` estiver vazio, o site fica público, mas informa que o cadastro está em configuração.

## Adicionar outro app

Adicione uma linha na aba `Campanhas`:

| Id | Aplicativo | Limite | Ativa | URLTeste | EmailFeedback | Dias | Descricao |
|---|---|---:|---|---|---|---:|---|
| `novo-app` | `Novo App` | `20` | `TRUE` | link do teste | e-mail | `14` | descrição pública |

Não é necessário alterar o site. Para liberar uma vaga, marque a inscrição como `Cancelado`. Depois de cadastrar o e-mail no Play Console, marque como `Liberado`.

Os e-mails nunca são enviados ao navegador nem publicados no GitHub.
